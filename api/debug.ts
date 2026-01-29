import type { VercelRequest, VercelResponse } from '@vercel/node';
import { cors } from '../lib/response';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    cors(res);
    return res.status(200).end();
  }

  // First just check env vars without DB connection
  const envCheck = {
    hasDbUrl: !!process.env.DATABASE_URL,
    dbUrlStart: process.env.DATABASE_URL?.substring(0, 30) + '...',
    hasJwtSecret: !!process.env.JWT_SECRET,
    nodeEnv: process.env.NODE_ENV,
    vercelEnv: process.env.VERCEL_ENV,
  };

  // If no DATABASE_URL, return early
  if (!process.env.DATABASE_URL) {
    cors(res);
    return res.status(500).json({
      status: 'error',
      message: 'DATABASE_URL environment variable is not set',
      env: envCheck
    });
  }

  try {
    // Dynamic import to avoid crash if DATABASE_URL is missing
    const { neon } = await import('@neondatabase/serverless');
    const sql = neon(process.env.DATABASE_URL);
    
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
