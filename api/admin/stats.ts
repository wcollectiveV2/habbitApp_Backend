
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { neon } from '@neondatabase/serverless';
import { cors } from '../../lib/response';
import { getAuthFromRequest } from '../../lib/auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(res, req);
  if (req.method === 'OPTIONS') return res.status(200).end();

//   const auth = getAuthFromRequest(req);
//   if (!auth) {
//       // For demo purposes, we might allow unauthenticated or check simplified token
//       // return res.status(401).json({ error: 'Unauthorized' });
//   }

  try {
    const dbUrl = process.env.DATABASE_URL || process.env.WCLTV_POSTGRES_URL;
    if (!dbUrl) throw new Error('Missing Database URL');
    
    const sql = neon(dbUrl);

    // Get counts
    const [userCount] = await sql`SELECT COUNT(*)::int as count FROM users`;
    const [protocolCount] = await sql`SELECT COUNT(*)::int as count FROM protocols`;
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
