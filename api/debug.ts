import type { VercelRequest, VercelResponse } from '@vercel/node';
import { json, error, cors } from '../lib/response';
import { query } from '../lib/db';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    cors(res);
    return res.status(200).end();
  }

  try {
    // Test database connection
    const result = await query('SELECT NOW() as time, current_database() as db');
    
    // Check if users table exists
    const tables = await query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);

    return json(res, {
      status: 'connected',
      database: result[0],
      tables: tables.map((t: any) => t.table_name),
      hasUsersTable: tables.some((t: any) => t.table_name === 'users'),
      env: {
        hasDbUrl: !!process.env.DATABASE_URL,
        hasJwtSecret: !!process.env.JWT_SECRET,
      }
    });
  } catch (err: any) {
    return json(res, {
      status: 'error',
      message: err.message,
      code: err.code,
      env: {
        hasDbUrl: !!process.env.DATABASE_URL,
        hasJwtSecret: !!process.env.JWT_SECRET,
      }
    }, 500);
  }
}
