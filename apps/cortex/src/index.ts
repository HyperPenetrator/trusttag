import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { matchRouter } from './routes/match';
import { lostItemsRouter } from './routes/lostItems';
import { runMigrations } from './db/migrate';

const PORT = parseInt(process.env.PORT ?? '3001', 10);
const CORS_ORIGINS = (process.env.CORS_ORIGINS ?? 'http://localhost:3000').split(',');

async function main(): Promise<void> {
  // ── Run DB migrations on startup (idempotent) ──────────────────────────────
  try {
    await runMigrations();
  } catch (err) {
    console.warn('[cortex] DB migration failed — service running in no-DB mode:', (err as Error).message);
    console.warn('[cortex] Set DATABASE_URL to enable full matching functionality.');
  }

  const app = express();

  // ── Middleware ────────────────────────────────────────────────────────────
  app.use(cors({ origin: CORS_ORIGINS, credentials: true }));
  app.use(express.json({ limit: '20mb' })); // large because base64 photos

  // ── Health check ─────────────────────────────────────────────────────────
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'cortex', ts: new Date().toISOString() });
  });

  // ── Routes ────────────────────────────────────────────────────────────────
  app.use('/match', matchRouter);
  app.use('/lost-items', lostItemsRouter);

  // ── 404 catch-all ────────────────────────────────────────────────────────
  app.use((_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  // ── Start ────────────────────────────────────────────────────────────────
  app.listen(PORT, () => {
    console.log(`\n🧠  TrustTag Cortex running at http://localhost:${PORT}`);
    console.log(`   POST /match       — submit a found-item report & get ranked matches`);
    console.log(`   POST /lost-items  — ingest a lost-item record (for the indexer)`);
    console.log(`   GET  /lost-items  — list active lost items`);
    console.log(`   GET  /health      — liveness check\n`);
  });
}

main().catch((err) => {
  console.error('[cortex] Fatal startup error:', err);
  process.exit(1);
});
