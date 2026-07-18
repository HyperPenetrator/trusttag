import { withClient } from './pool';

// ─────────────────────────────────────────────────────────────────────────────
// Schema migration — idempotent (safe to run multiple times)
// ─────────────────────────────────────────────────────────────────────────────
//
// Tables:
//
//  lost_items
//    Populated by an indexer (or manually in dev) when PoCT.sol emits a
//    StatusChanged(tokenId, Status.LOST) event.  Stores the off-chain
//    structured attributes (category, brand, colour) and the perceptual hash
//    of the registered photo computed at registration time.
//
//    NOTE: phash here is the pHash of the ENCRYPTED original image, computed
//    during registration and stored off-chain.  It is NOT the
//    metadataIntegrityHash (Keccak-256) stored on-chain — see PoCT.sol for
//    that field's purpose.
//
//  found_reports
//    Populated by POST /found-reports or by POST /match itself.  Stores the
//    finder's submitted attributes and pHash of the submitted photo.
//
//  match_candidates
//    The output of the Cortex matching engine.  Consumed by the web front-end
//    and eventually by the HandoffVerifier contract.
// ─────────────────────────────────────────────────────────────────────────────

const MIGRATION_SQL = /* sql */ `
-- Enable the pgcrypto extension (provides gen_random_uuid())
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── lost_items ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lost_items (
  id              SERIAL PRIMARY KEY,
  token_id        BIGINT       NOT NULL UNIQUE,   -- PoCT.sol tokenId
  owner_address   TEXT         NOT NULL,
  category        TEXT         NOT NULL DEFAULT '',
  brand           TEXT         NOT NULL DEFAULT '',
  colour          TEXT         NOT NULL DEFAULT '',
  distinguishing  TEXT         NOT NULL DEFAULT '', -- free-text marks
  phash           TEXT,                             -- 16-char hex pHash (nullable if no photo)
  registered_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  lost_reported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT lost_items_phash_format CHECK (phash IS NULL OR length(phash) = 16)
);

CREATE INDEX IF NOT EXISTS idx_lost_items_category ON lost_items (category);
CREATE INDEX IF NOT EXISTS idx_lost_items_brand    ON lost_items (brand);

-- ─── found_reports ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS found_reports (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  finder_address  TEXT,                   -- optional (anonymous reporting allowed)
  category        TEXT         NOT NULL DEFAULT '',
  brand           TEXT         NOT NULL DEFAULT '',
  colour          TEXT         NOT NULL DEFAULT '',
  distinguishing  TEXT         NOT NULL DEFAULT '',
  phash           TEXT,                   -- computed from submitted photo
  found_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  location_hint   TEXT,
  description     TEXT,
  CONSTRAINT found_reports_phash_format CHECK (phash IS NULL OR length(phash) = 16)
);

-- ─── match_candidates ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS match_candidates (
  id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  lost_item_id        INT          REFERENCES lost_items(id) ON DELETE CASCADE,
  found_report_id     UUID         REFERENCES found_reports(id) ON DELETE CASCADE,
  phash_similarity    NUMERIC(5,4) NOT NULL,   -- [0, 1]
  attribute_overlap   NUMERIC(5,4) NOT NULL,   -- [0, 1]
  confidence_score    NUMERIC(5,4) NOT NULL,   -- weighted combined score
  status              TEXT         NOT NULL DEFAULT 'Pending'
                        CHECK (status IN ('Pending', 'Verified', 'Rejected')),
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (lost_item_id, found_report_id)
);

CREATE INDEX IF NOT EXISTS idx_match_candidates_lost    ON match_candidates (lost_item_id);
CREATE INDEX IF NOT EXISTS idx_match_candidates_found   ON match_candidates (found_report_id);
CREATE INDEX IF NOT EXISTS idx_match_candidates_score   ON match_candidates (confidence_score DESC);
`;

export async function runMigrations(): Promise<void> {
  console.log('[migrate] Running schema migrations…');
  await withClient(async (client) => {
    await client.query(MIGRATION_SQL);
  });
  console.log('[migrate] ✓ Schema up to date');
}

// Allow running directly: ts-node src/db/migrate.ts
if (require.main === module) {
  import('./pool').then(() => {
    runMigrations()
      .then(() => process.exit(0))
      .catch((err) => {
        console.error('[migrate] Fatal:', err);
        process.exit(1);
      });
  });
}
