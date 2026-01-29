import type { VercelRequest, VercelResponse } from '@vercel/node';
import { json, error, cors } from '../lib/response';
import { query } from '../lib/db';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    cors(res, req);
    return res.status(200).end();
  }

  // Check database health
  let dbStatus = 'unknown';
  let dbError: string | null = null;
  let dbTables: string[] = [];

  try {
    // Simple connectivity check
    const result = await query<{ now: Date }>('SELECT NOW() as now');
    if (result.length > 0) {
      dbStatus = 'connected';
    }

    // Check if required tables exist
    const tables = await query<{ tablename: string }>(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public'`
    );
    dbTables = tables.map(t => t.tablename);

    // Check for required tables
    const requiredTables = ['users', 'habits', 'habit_logs', 'tasks'];
    const missingTables = requiredTables.filter(t => !dbTables.includes(t));
    
    if (missingTables.length > 0) {
      dbStatus = 'missing_tables';
      dbError = `Missing tables: ${missingTables.join(', ')}`;
    }
  } catch (err: any) {
    dbStatus = 'error';
    dbError = err.message || 'Unknown database error';
  }

  const isHealthy = dbStatus === 'connected';

  return json(res, {
    status: isHealthy ? 'healthy' : 'degraded',
    service: 'chrislo-vercel-backend',
    timestamp: new Date().toISOString(),
    environment: process.env.VERCEL_ENV || 'development',
    database: {
      status: dbStatus,
      error: dbError,
      tables: dbTables,
    }
  }, isHealthy ? 200 : 503, req);
}
