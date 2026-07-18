import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { computePhash } from 'cortex-matching';
import { matchFoundReport } from 'cortex-matching';

export const matchRouter = Router();

// ─────────────────────────────────────────────────────────────────────────────
// Request validation schema
// ─────────────────────────────────────────────────────────────────────────────

const MatchRequestSchema = z.object({
  /** Wallet address of the finder — optional (anonymous reporting allowed) */
  finderAddress: z.string().optional(),

  /** Structured attributes of the found item */
  category: z.string().min(1, 'category is required'),
  brand: z.string().default(''),
  colour: z.string().default(''),
  distinguishing: z.string().default(''),

  /**
   * One or more base64-encoded photos of the found item.
   * The first photo is used to compute the pHash.
   * Each must be a plain base64 string or a data-URI
   * (e.g. "data:image/jpeg;base64,...").
   */
  photos: z.array(z.string()).min(1).max(5).optional(),

  locationHint: z.string().optional(),
  description: z.string().optional(),
  foundAt: z.string().datetime().optional(),
});

type MatchRequest = z.infer<typeof MatchRequestSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// POST /match
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Accept a FoundReport, compute its pHash, query the lost-items store, and
 * return ranked MatchCandidate results.
 *
 * Response shape:
 * {
 *   foundReportId: string,
 *   matches: MatchResult[]   // ordered by confidenceScore descending
 * }
 */
matchRouter.post('/', async (req: Request, res: Response): Promise<void> => {
  // 1. Validate request body
  const parseResult = MatchRequestSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({
      error: 'Invalid request body',
      details: parseResult.error.flatten(),
    });
    return;
  }

  const body: MatchRequest = parseResult.data;

  // 2. Compute pHash from the first photo (if provided)
  let phash: string | undefined;
  if (body.photos && body.photos.length > 0) {
    try {
      phash = await computePhash(body.photos[0]);
    } catch (err) {
      console.error('[match] pHash computation failed:', err);
      // Non-fatal — proceed without visual matching
      phash = undefined;
    }
  }

  // 3. Run matching pipeline
  try {
    const matches = await matchFoundReport(
      {
        finderAddress: body.finderAddress,
        category: body.category,
        brand: body.brand,
        colour: body.colour,
        distinguishing: body.distinguishing,
        phash,
        locationHint: body.locationHint,
        description: body.description,
        foundAt: body.foundAt,
      },
      /* topN= */ 10
    );

    const foundReportId = matches[0]?.foundReportId ?? null;

    res.json({
      foundReportId,
      phashComputed: !!phash,
      matchCount: matches.length,
      matches,
    });
  } catch (err) {
    console.error('[match] Matching pipeline error:', err);
    res.status(500).json({ error: 'Internal server error during matching' });
  }
});
