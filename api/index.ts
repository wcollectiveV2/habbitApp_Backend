import type { VercelRequest, VercelResponse } from '@vercel/node';
import { cors, json } from '../lib/response';
import { query } from '../lib/db';
import { neon } from '@neondatabase/serverless';

// Request Handlers
import aiHandler from '../handlers/ai';
import authHandler from '../handlers/auth';
import challengesHandler from '../handlers/challenges';
import habitsHandler from '../handlers/habits';
import groupsHandler from '../handlers/groups';
import notificationsHandler from '../handlers/notifications';
import organizationsHandler from '../handlers/organizations';
import protocolsHandler from '../handlers/protocols';
import socialHandler from '../handlers/social';
import tasksHandler from '../handlers/tasks';
import userHandler from '../handlers/user';
import usersHandler from '../handlers/users';
import invitationsHandler from '../handlers/invitations';
import adminHandler from '../handlers/admin';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS first
  cors(res, req);
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { route } = req.query;
    const path = req.url?.split('?')[0] || '';

    console.log(`[Router] ${req.method} ${path} - Origin: ${req.headers.origin}`);

    const matchApi = (name: string) => path.startsWith(`/api/${name}`) || path.startsWith(`/${name}`);

    // --- Dispatch to Logic Handlers ---
    if (matchApi('ai')) return await aiHandler(req, res);
    if (matchApi('auth')) {
      console.log('Dispatching to auth handler');
      return await authHandler(req, res);
    }
    if (matchApi('challenges')) return await challengesHandler(req, res);
    if (matchApi('habits')) return await habitsHandler(req, res);
    
    // Groups/Organizations Logic
    if (path.startsWith('/api/groups')) return await groupsHandler(req, res);
    if (path.startsWith('/groups')) return await organizationsHandler(req, res);
    if (path.startsWith('/api/organizations')) return await organizationsHandler(req, res);

    if (matchApi('notifications')) return await notificationsHandler(req, res);
    if (matchApi('protocols')) return await protocolsHandler(req, res);
    if (matchApi('social')) return await socialHandler(req, res);
    if (matchApi('tasks')) return await tasksHandler(req, res);
    
    // Invitation system (public endpoint for accepting invitations)
    if (matchApi('invitations')) return await invitationsHandler(req, res);
    
    // Admin management endpoints
    if (matchApi('admin')) return await adminHandler(req, res);
    
    if (matchApi('users')) return await usersHandler(req, res);
    if (matchApi('user')) return await userHandler(req, res);

    // --- Health Check ---
    if (route === 'health' || path.includes('/health')) {
      let dbStatus = 'unknown';
      let dbError: string | null = null;
      let dbTables: string[] = [];

      try {
        const result = await query<{ now: Date }>('SELECT NOW() as now');
        if (result.length > 0) dbStatus = 'connected';
        
        const tables = await query<{ tablename: string }>(
          `SELECT tablename FROM pg_tables WHERE schemaname = 'public'`
        );
        dbTables = tables.map(t => t.tablename);

        const required = ['users', 'habits', 'habit_logs', 'tasks'];
        const missing = required.filter(t => !dbTables.includes(t));
        
        if (missing.length > 0) {
          dbStatus = 'missing_tables';
          dbError = `Missing tables: ${missing.join(', ')}`;
        }
      } catch (err: any) {
        dbStatus = 'error';
        dbError = err.message || 'Unknown database error';
      }

      const isHealthy = dbStatus === 'connected';

      return json(res, {
        status: isHealthy ? 'healthy' : 'degraded',
        service: 'wcollective-vercel-backend',
        timestamp: new Date().toISOString(),
        database: { status: dbStatus, error: dbError, tables: dbTables }
      }, isHealthy ? 200 : 503, req);
    }

    // --- Admin Stats ---
    if (route === 'stats' || path.includes('/stats')) {
      try {
          const dbUrl = process.env.DATABASE_URL || process.env.WCLTV_POSTGRES_URL;
          if (!dbUrl) throw new Error('Missing Database URL');
          
          const sql = neon(dbUrl);
      
          const [userCount] = await sql`SELECT COUNT(*)::int as count FROM users`;
          let protocolCount = { count: 0 };
          try {
              const [pCount] = await sql`SELECT COUNT(*)::int as count FROM protocols`;
              protocolCount = { count: Number(pCount?.count ?? 0) };
          } catch (e) { 
              console.log('Protocols table check failed', e); 
          }

          const [challengeCount] = await sql`SELECT COUNT(*)::int as count FROM challenges`;
          const activeProtocols = protocolCount.count + challengeCount.count;
      
          return res.status(200).json({
            totalUsers: userCount.count,
            activeProtocols: activeProtocols,
            ordersToday: 0
          });
      
      } catch (error: any) {
        console.error('Stats Error:', error);
        return res.status(500).json({ error: error.message });
      }
    }

    // --- Default API Root ---
    console.log(`[Router] No match found for ${path}`);
    return res.status(200).json({
      status: 'ok',
      service: 'HabitPulse API',
      version: '1.1.0',
      endpoints: {
        health: '/api/health',
        auth: '/api/auth',
        habits: '/api/habits',
        tasks: '/api/tasks',
        challenges: '/api/challenges',
        social: '/api/social',
        notifications: '/api/notifications',
        organizations: '/api/organizations',
        invitations: '/api/invitations',
        admin: '/api/admin',
        protocols: '/api/protocols',
        users: '/api/users',
        user: '/api/user',
        ai: '/api/ai'
      }
    });
  } catch (error: any) {
    console.error('Unhandled API Error:', error);
    // Attempt to send error response with CORS headers
    try {
      res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
    } catch (e) {
      // Ignore header setting error if sent
    }
    return res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
}
