import type { VercelRequest, VercelResponse } from '@vercel/node';
import { cors } from '../lib/response';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    cors(res);
    return res.status(200).end();
  }

  // Check all possible DB env vars
  const envCheck = {
    WCLTV_DATABASE_URL: !!process.env.WCLTV_DATABASE_URL,
    WCLTV_POSTGRES_URL: !!process.env.WCLTV_POSTGRES_URL,
    WCLTV_PGHOST: !!process.env.WCLTV_PGHOST,
    WCLTV_PGUSER: !!process.env.WCLTV_PGUSER,
    WCLTV_PGPASSWORD: !!process.env.WCLTV_PGPASSWORD,
    WCLTV_PGDATABASE: !!process.env.WCLTV_PGDATABASE,
    POSTGRES_URL: !!process.env.POSTGRES_URL,
    JWT_SECRET: !!process.env.JWT_SECRET,
    nodeEnv: process.env.NODE_ENV,
    vercelEnv: process.env.VERCEL_ENV,
  };

  try {
    // Dynamic import to test connection
    const { neon } = await import('@neondatabase/serverless');
    
    // Try to get DB URL
    let dbUrl: string | undefined;
    if (process.env.DATABASE_URL) dbUrl = process.env.DATABASE_URL;
    else if (process.env.WCLTV_POSTGRES_URL) dbUrl = process.env.WCLTV_POSTGRES_URL;
    else if (process.env.WCLTV_PGHOST) {
      dbUrl = `postgresql://${process.env.WCLTV_PGUSER}:${process.env.WCLTV_PGPASSWORD}@${process.env.WCLTV_PGHOST}/${process.env.WCLTV_PGDATABASE}?sslmode=require`;
    }
    else if (process.env.POSTGRES_URL) dbUrl = process.env.POSTGRES_URL;

    if (!dbUrl) {
      cors(res);
      return res.status(500).json({
        status: 'error',
        message: 'No database URL found',
        env: envCheck
      });
    }

    const sql = neon(dbUrl);
    
    // Test database connection
    const result = await sql`SELECT NOW() as time, current_database() as db`;
    
    // Check if users table exists
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `;

    cors(res);
    return res.status(200).json({
      status: 'connected',
      database: result[0],
      tables: tables.map((t: any) => t.table_name),
      hasUsersTable: tables.some((t: any) => t.table_name === 'users'),
      env: envCheck
    });
  } catch (err: any) {
    cors(res);
    return res.status(500).json({
      status: 'db_error',
      message: err.message,
      code: err.code,
      env: envCheck
    });
  }
}
