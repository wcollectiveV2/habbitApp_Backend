import { neon } from '@neondatabase/serverless';
import { Pool } from 'pg';

// Determine if we're in local Docker environment
const isLocalDocker = process.env.NODE_ENV === 'development' && process.env.DATABASE_URL?.includes('postgres:5432');

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

// Local PostgreSQL pool for Docker environment
let _pool: Pool | null = null;
function getPool(): Pool {
  if (!_pool) {
    _pool = new Pool({
      connectionString: getDatabaseUrl(),
    });
  }
  return _pool;
}

// Neon serverless connection for production
let _sql: any;
function getSql() {
  if (!_sql) _sql = neon(getDatabaseUrl());
  return _sql;
}

export const sql = (stringsOrQuery: any, ...values: any[]) => {
  return getSql()(stringsOrQuery, ...values);
};

// Helper to run queries - supports both local PostgreSQL and Neon serverless
export async function query<T = any>(queryText: string, params: any[] = []): Promise<T[]> {
  try {
    // Always use pg pool for Node environment (including Vercel Node Runtime)
    // Neon HTTP driver (getSql) now requires tagged templates which 'query' helper doesn't support easily.
    // Also pg is more robust for general Node usage.
    // We strictly use getSql() aka neon() only if we are specifically not able to use pg (unlikely in this stack).
    
    const pool = getPool();
    const result = await pool.query(queryText, params);
    return result.rows as T[];

    /* 
    Legacy Neon driver support:
    else {
      // Use Neon serverless for production
      // @ts-ignore - Neon driver signature handling
      const result = await getSql()(queryText, params);
      return result as T[];
    }
    */
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
}
