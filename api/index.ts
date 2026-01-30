import type { VercelRequest, VercelResponse } from '@vercel/node';
import { cors, json } from '../lib/response';
import { query } from '../lib/db';
import { neon } from '@neondatabase/serverless';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(res, req);
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { route } = req.query;
  const path = req.url?.split('?')[0] || '';

  // --- Health Check ---
  if (route === 'health' || path.includes('/health')) {
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

  // --- Admin Stats ---
  if (route === 'stats' || path.includes('/stats')) {
    try {
        const dbUrl = process.env.DATABASE_URL || process.env.WCLTV_POSTGRES_URL;
        if (!dbUrl) throw new Error('Missing Database URL');
        
        const sql = neon(dbUrl);
    
        // Get counts
        const [userCount] = await sql`SELECT COUNT(*)::int as count FROM users`;
        // Handle case where protocols table might not exist or be empty
        let protocolCount = { count: 0 };
        try {
            const [pCount] = await sql`SELECT COUNT(*)::int as count FROM protocols`;
            protocolCount = { count: Number(pCount?.count ?? 0) };
        } catch (e) { console.log('Protocols table check failed', e); }

        const [challengeCount] = await sql`SELECT COUNT(*)::int as count FROM challenges`;
        
        // Calculate total active protocols (protocols + active challenges)
        const activeProtocols = protocolCount.count + challengeCount.count;
    
        return res.status(200).json({
          totalUsers: userCount.count,
          activeProtocols: activeProtocols,
          ordersToday: 0 // Retail coming soon
        });
    
      } catch (error: any) {
        console.error('Stats Error:', error);
        return res.status(500).json({ error: error.message });
      }
  }

  // --- Default API Root ---
  return res.status(200).json({
    status: 'ok',
    service: 'HabitPulse API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    endpoints: {
      health: '/api/health',
      stats: '/api/admin/stats',
      auth: '/api/auth/*',
      habits: '/api/habits/*',
      tasks: '/api/tasks/*',
      user: '/api/user/*'
    }
  });
}
