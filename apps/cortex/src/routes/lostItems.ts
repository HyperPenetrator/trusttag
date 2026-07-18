import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { withClient } from '../db/pool';

export const lostItemsRouter = Router();

// ─────────────────────────────────────────────────────────────────────────────
// POST /lost-items — ingest a lost item record
// Called by the on-chain event indexer when PoCT emits StatusChanged → LOST
// ─────────────────────────────────────────────────────────────────────────────

const IngestSchema = z.object({
  tokenId: z.number().int().positive(),
  ownerAddress: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  category: z.string().default(''),
  brand: z.string().default(''),
  colour: z.string().default(''),
  distinguishing: z.string().default(''),
  /** 16-char hex pHash — computed at registration time from the encrypted photo */
  phash: z.string().length(16).optional(),
});

lostItemsRouter.post('/', async (req: Request, res: Response): Promise<void> => {
  const parsed = IngestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid body', details: parsed.error.flatten() });
    return;
  }
  const d = parsed.data;

  try {
    const { rows } = await withClient((client) =>
      client.query<{ id: number }>(
        `INSERT INTO lost_items
           (token_id, owner_address, category, brand, colour, distinguishing, phash)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (token_id) DO UPDATE
           SET category = EXCLUDED.category,
               brand    = EXCLUDED.brand,
               colour   = EXCLUDED.colour,
               distinguishing = EXCLUDED.distinguishing,
               phash    = COALESCE(EXCLUDED.phash, lost_items.phash),
               lost_reported_at = NOW()
         RETURNING id`,
        [d.tokenId, d.ownerAddress, d.category, d.brand, d.colour, d.distinguishing, d.phash ?? null]
      )
    );
    res.status(201).json({ id: rows[0].id, tokenId: d.tokenId });
  } catch (err) {
    console.error('[lost-items] insert error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /lost-items — list active lost items (for the web dashboard)
lostItemsRouter.get('/', async (_req: Request, res: Response): Promise<void> => {
  try {
    const { rows } = await withClient((client) =>
      client.query(
        `SELECT id, token_id, owner_address, category, brand, colour,
                distinguishing, lost_reported_at
         FROM lost_items
         ORDER BY lost_reported_at DESC
         LIMIT 100`
      )
    );
    res.json(rows);
  } catch (err) {
    console.error('[lost-items] query error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});
