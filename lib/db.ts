import { neon } from '@neondatabase/serverless';

// Build DATABASE_URL from various possible env var formats
function getDatabaseUrl(): string {
  // Try standard DATABASE_URL first
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }
  
  // Try WCLTV_ prefixed variables (Neon integration)
  if (process.env.WCLTV_POSTGRES_URL) {
    return process.env.WCLTV_POSTGRES_URL;
  }
  
  // Try to construct from WCLTV_ components
  if (process.env.WCLTV_PGHOST && process.env.WCLTV_PGUSER && process.env.WCLTV_PGPASSWORD && process.env.WCLTV_PGDATABASE) {
    return `postgresql://${process.env.WCLTV_PGUSER}:${process.env.WCLTV_PGPASSWORD}@${process.env.WCLTV_PGHOST}/${process.env.WCLTV_PGDATABASE}?sslmode=require`;
  }

  // Try POSTGRES_URL (Vercel Postgres)
  if (process.env.POSTGRES_URL) {
    return process.env.POSTGRES_URL;
  }

  throw new Error('No database URL found. Set DATABASE_URL, WCLTV_POSTGRES_URL, or WCLTV_PG* variables.');
}

// Serverless-compatible database connection
export const sql = neon(getDatabaseUrl());

// Helper to run queries
export async function query<T = any>(queryText: string, params?: any[]): Promise<T[]> {
  try {
    const result = await sql(queryText, params);
    return result as T[];
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
}
