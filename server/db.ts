// server/db.ts
import 'dotenv/config';
import { neonConfig, Pool } from '@neondatabase/serverless';
import ws from 'ws';
import { drizzle } from 'drizzle-orm/neon-serverless';
import * as schema from '../shared/schema'; // adjust path if needed

// Only set ws constructor in Node (not in edge/browser)
if (typeof window === 'undefined') {
  neonConfig.webSocketConstructor = ws as any;
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is missing. Provision the DB and set it in .env');
}

// --- Singleton pattern ---
let _pool: Pool | undefined;
let _db: ReturnType<typeof drizzle> | undefined;

export function getPool() {
  if (!_pool) _pool = new Pool({ connectionString });
  return _pool;
}

export function getDb() {
  if (!_db) _db = drizzle(getPool(), { schema });
  return _db;
}

// Common exports
export const pool = getPool();
export const db = getDb();

// Optional quick healthcheck
export async function healthcheck() {
  await pool.query('select 1');
}
