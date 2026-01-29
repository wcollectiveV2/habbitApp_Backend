import type { VercelResponse } from '@vercel/node';

export function cors(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );
}

export function handleCors(res: VercelResponse): boolean {
  cors(res);
  return false;
}

export function json(res: VercelResponse, data: any, status = 200) {
  cors(res);
  return res.status(status).json(data);
}

export function error(res: VercelResponse, message: string, status = 500) {
  cors(res);
  return res.status(status).json({ error: message });
}
