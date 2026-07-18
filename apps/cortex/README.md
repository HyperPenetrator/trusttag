# TrustTag Cortex

**Cortex** is the perceptual-hash matching engine for TrustTag Protocol.  
It runs as an independent Node.js/Express service on port `3001`.

## What it does

1. Accepts a `POST /match` request containing a finder's photo (base64) and structured attributes (category, brand, colour).
2. Computes a **perceptual hash (pHash)** of the photo using a DCT-based algorithm (see `src/services/phash.ts`).
3. Queries active `LOST` items from Postgres, scoring each by:
   - **pHash similarity** — Hamming distance between the found-photo hash and the stored registered-photo hash
   - **Attribute overlap** — exact match on category / brand / colour
   - **Combined score** = `0.6 × pHashSimilarity + 0.4 × attributeOverlap` (configurable via `.env`)
4. Persists the `FoundReport` and `MatchCandidate` rows, then returns ranked results.

### pHash ≠ cryptographic hash

> pHash provides **zero tamper-evidence guarantees**.  
> The `metadataIntegrityHash` stored on `PoCT.sol` is a Keccak-256 hash and is used *only* for data-integrity verification.  
> pHash is used *only* for fuzzy visual similarity and must never substitute for the on-chain integrity hash.

## API

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/match` | Submit a found report, get ranked match candidates |
| `POST` | `/lost-items` | Ingest a lost-item record (called by the on-chain indexer) |
| `GET` | `/lost-items` | List active lost items |
| `GET` | `/health` | Liveness check |

### POST /match — request body

```json
{
  "finderAddress": "0xOptional",
  "category": "laptop",
  "brand": "apple",
  "colour": "silver",
  "distinguishing": "dent on bottom-right corner",
  "photos": ["data:image/jpeg;base64,..."],
  "locationHint": "Central Park, NYC",
  "description": "Found near the fountain"
}
```

### POST /match — response

```json
{
  "foundReportId": "uuid",
  "phashComputed": true,
  "matchCount": 3,
  "matches": [
    {
      "foundReportId": "uuid",
      "lostItemId": 42,
      "tokenId": "7",
      "ownerAddress": "0xOwner",
      "phashSimilarity": 0.9531,
      "attributeOverlap": 1.0,
      "confidenceScore": 0.9719,
      "status": "Pending"
    }
  ]
}
```

## Local development

### Prerequisites

- Node.js 20+
- Docker (for Postgres) **or** an existing Postgres 16 instance

### Quick start

```bash
# 1. Start Postgres
docker run -d --name trusttag-pg \
  -e POSTGRES_PASSWORD=trusttag \
  -e POSTGRES_DB=trusttag_cortex \
  -p 5432:5432 postgres:16

# 2. Install dependencies (from monorepo root)
npm install

# 3. Run migrations
npm run cortex:migrate

# 4. Start in dev mode (hot-reload)
npm run cortex:dev

# 5. Test the health endpoint
curl http://localhost:3001/health
```

### Running tests (no DB required)

```bash
npm run cortex:test
```

## Environment variables

See `.env.example` for all variables.  Copy it to `.env` before starting.

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | HTTP port |
| `DATABASE_URL` | — | Postgres connection string |
| `CORS_ORIGINS` | `http://localhost:3000` | Comma-separated allowed origins |
| `PHASH_WEIGHT` | `0.6` | Weight of visual similarity in score |
| `ATTRIBUTE_WEIGHT` | `0.4` | Weight of attribute overlap in score |
| `PHASH_HAMMING_THRESHOLD` | `10` | Hamming distance considered a "strong match" |

## Docker

```bash
docker build -t trusttag-cortex .
docker run -e DATABASE_URL=... -p 3001:3001 trusttag-cortex
```

Use `docker-compose up` from the monorepo root to start Cortex + Postgres together.
