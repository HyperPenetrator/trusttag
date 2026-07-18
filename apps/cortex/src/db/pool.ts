import { Pool, PoolClient } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// ─────────────────────────────────────────────────────────────────────────────
// Connection pool — reused across all requests
// ─────────────────────────────────────────────────────────────────────────────
let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL environment variable is not set');
    }
    pool = new Pool({ connectionString, max: 10 });

    pool.on('error', (err) => {
      console.error('[pg] Unexpected pool error:', err.message);
    });
  }
  return pool;
}

export async function withClient<T>(
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await getPool().connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}
