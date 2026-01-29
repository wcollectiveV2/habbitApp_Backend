import type { VercelRequest, VercelResponse } from '@vercel/node';
import { cors } from '../lib/response';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(res);
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  return res.status(200).json({
    status: 'ok',
    service: 'HabitPulse API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    endpoints: {
      health: '/api/health',
      auth: '/api/auth/*',
      habits: '/api/habits/*',
      tasks: '/api/tasks/*',
      user: '/api/user/*'
    }
  });
}
