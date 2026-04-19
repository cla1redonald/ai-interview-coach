import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from './schema';

// Use an in-memory SQLite database when the Turso env vars are absent.
// This lets Next.js complete static page generation at build time without
// a real database connection. At runtime (dev + production), the real
// Turso URL must be set or requests will fail.
const url = process.env.TURSO_DATABASE_URL ?? ':memory:';
const authToken = process.env.TURSO_AUTH_TOKEN;

const client = createClient({ url, authToken });
export const db = drizzle(client, { schema });
