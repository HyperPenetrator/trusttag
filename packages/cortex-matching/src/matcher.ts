import { withClient } from './db/pool';
import { hammingDistance, hammingToSimilarity } from './phash';

// ─────────────────────────────────────────────────────────────────────────────
// Attribute overlap scoring
// ─────────────────────────────────────────────────────────────────────────────
//
// Compares three structured fields (category, brand, colour) between the
// found-report and a lost-item row.  Each matching field contributes an equal
// share.  This is intentionally simple — it can be swapped for a fuzzy
// string-similarity algorithm (e.g. Jaro-Winkler) later without changing the
// surrounding scoring pipeline.
// ─────────────────────────────────────────────────────────────────────────────

const ATTRIBUTE_FIELDS = ['category', 'brand', 'colour'] as const;
type AttrKey = (typeof ATTRIBUTE_FIELDS)[number];

function attributeOverlap(
  found: Record<AttrKey, string>,
  lost: Record<AttrKey, string>
): number {
  let matches = 0;
  for (const field of ATTRIBUTE_FIELDS) {
    const f = found[field].trim().toLowerCase();
    const l = lost[field].trim().toLowerCase();
    if (f && l && f === l) matches++;
  }
  return matches / ATTRIBUTE_FIELDS.length;
}

// ─────────────────────────────────────────────────────────────────────────────
// DB row types
// ─────────────────────────────────────────────────────────────────────────────

interface LostItemRow {
  id: number;
  token_id: string;
  owner_address: string;
  category: string;
  brand: string;
  colour: string;
  distinguishing: string;
  phash: string | null;
}

export interface MatchInput {
  finderAddress?: string;
  category: string;
  brand: string;
  colour: string;
  distinguishing?: string;
  phash?: string;           // 16-char hex — caller computes this from the photo
  locationHint?: string;
  description?: string;
  foundAt?: string;         // ISO timestamp (defaults to NOW)
}

export interface MatchResult {
  foundReportId: string;
  lostItemId: number;
  tokenId: string;
  ownerAddress: string;
  phashSimilarity: number;
  attributeOverlap: number;
  confidenceScore: number;
  status: 'Pending' | 'Verified' | 'Rejected';
}

// ─────────────────────────────────────────────────────────────────────────────
// Core matching function
// ─────────────────────────────────────────────────────────────────────────────

const PHASH_WEIGHT = parseFloat(process.env.PHASH_WEIGHT ?? '0.6');
const ATTR_WEIGHT = parseFloat(process.env.ATTRIBUTE_WEIGHT ?? '0.4');

/**
 * 1. Persist the FoundReport to found_reports.
 * 2. Load all active LOST items from lost_items.
 * 3. Score each by:
 *      confidenceScore = PHASH_WEIGHT * phashSimilarity
 *                      + ATTR_WEIGHT  * attributeOverlap
 * 4. Persist top-N matches (score > 0) to match_candidates.
 * 5. Return results ordered by confidenceScore descending.
 */
export async function matchFoundReport(
  input: MatchInput,
  topN = 10
): Promise<MatchResult[]> {
  return withClient(async (client) => {
    // ── 1. Persist found report ──────────────────────────────────────────────
    const insertFound = await client.query<{ id: string }>(
      `INSERT INTO found_reports
         (finder_address, category, brand, colour, distinguishing, phash,
          location_hint, description, found_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, COALESCE($9::TIMESTAMPTZ, NOW()))
       RETURNING id`,
      [
        input.finderAddress ?? null,
        input.category.toLowerCase(),
        input.brand.toLowerCase(),
        input.colour.toLowerCase(),
        input.distinguishing ?? '',
        input.phash ?? null,
        input.locationHint ?? null,
        input.description ?? null,
        input.foundAt ?? null,
      ]
    );
    const foundReportId: string = insertFound.rows[0].id;

    // ── 2. Load LOST items ───────────────────────────────────────────────────
    const { rows: lostItems } = await client.query<LostItemRow>(
      `SELECT id, token_id, owner_address, category, brand, colour,
              distinguishing, phash
       FROM lost_items
       ORDER BY lost_reported_at DESC`
    );

    if (lostItems.length === 0) {
      return [];
    }

    // ── 3. Score each lost item ──────────────────────────────────────────────
    const scored: (MatchResult & { lostDbId: number })[] = [];

    for (const lost of lostItems) {
      // pHash similarity (skip if either side has no photo)
      let phashSim = 0;
      if (input.phash && lost.phash) {
        try {
          const dist = hammingDistance(input.phash, lost.phash);
          phashSim = hammingToSimilarity(dist);
        } catch {
          // length mismatch — treat as no visual match
          phashSim = 0;
        }
      }

      const attrSim = attributeOverlap(
        { category: input.category, brand: input.brand, colour: input.colour },
        { category: lost.category, brand: lost.brand, colour: lost.colour }
      );

      // Weight: if one signal is missing, redistribute fully to the other
      let confidence: number;
      if (!input.phash || !lost.phash) {
        // No photo comparison available — rely entirely on attributes
        confidence = attrSim;
      } else {
        confidence = PHASH_WEIGHT * phashSim + ATTR_WEIGHT * attrSim;
      }

      if (confidence > 0) {
        scored.push({
          foundReportId,
          lostItemId: lost.id,
          tokenId: lost.token_id,
          ownerAddress: lost.owner_address,
          phashSimilarity: round4(phashSim),
          attributeOverlap: round4(attrSim),
          confidenceScore: round4(confidence),
          status: 'Pending',
          lostDbId: lost.id,
        });
      }
    }

    // Sort descending by confidence
    scored.sort((a, b) => b.confidenceScore - a.confidenceScore);
    const topMatches = scored.slice(0, topN);

    // ── 4. Persist match_candidates ──────────────────────────────────────────
    for (const m of topMatches) {
      await client.query(
        `INSERT INTO match_candidates
           (lost_item_id, found_report_id, phash_similarity, attribute_overlap, confidence_score)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (lost_item_id, found_report_id) DO UPDATE
           SET phash_similarity  = EXCLUDED.phash_similarity,
               attribute_overlap = EXCLUDED.attribute_overlap,
               confidence_score  = EXCLUDED.confidence_score`,
        [
          m.lostDbId,
          foundReportId,
          m.phashSimilarity,
          m.attributeOverlap,
          m.confidenceScore,
        ]
      );
    }

    // ── 5. Return results (strip internal lostDbId) ──────────────────────────
    return topMatches.map(({ lostDbId: _omit, ...rest }) => rest);
  });
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}
