import type { VercelRequest, VercelResponse } from '@vercel/node';
import { json, error, cors } from '../lib/response';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    cors(res);
    return res.status(200).end();
  }

  return json(res, {
    status: 'healthy',
    service: 'chrislo-vercel-backend',
    timestamp: new Date().toISOString(),
    environment: process.env.VERCEL_ENV || 'development',
  });
}
