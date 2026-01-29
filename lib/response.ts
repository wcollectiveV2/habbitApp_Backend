import type { VercelRequest, VercelResponse } from '@vercel/node';

// Allowed origins for CORS
const ALLOWED_ORIGINS = [
  // Production frontend
  'https://habbit-app-smoky.vercel.app',
  'https://habbit-app.vercel.app',
  // Vercel preview deployments
  /https:\/\/habbit-app[\w-]*\.vercel\.app$/,
  // Local development
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3002',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5173',
  // Mobile apps (Capacitor/Cordova)
  'capacitor://localhost',
  'ionic://localhost',
  'http://localhost',
  // Android WebView
  'file://',
];

function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return true; // Allow requests with no origin (mobile apps, Postman, etc.)
  
  return ALLOWED_ORIGINS.some(allowed => {
    if (typeof allowed === 'string') {
      return allowed === origin;
    }
    return allowed.test(origin);
  });
}

export function cors(res: VercelResponse, req?: VercelRequest) {
  const origin = req?.headers?.origin as string | undefined;
  
  // Set the origin dynamically if it's allowed, otherwise use the first allowed origin
  if (isAllowedOrigin(origin) && origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else if (!origin) {
    // For requests without origin (mobile apps), allow all
    res.setHeader('Access-Control-Allow-Origin', '*');
  } else {
    // Default to production frontend
    res.setHeader('Access-Control-Allow-Origin', 'https://habbit-app-smoky.vercel.app');
  }
  
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, Origin'
  );
  res.setHeader('Access-Control-Max-Age', '86400'); // Cache preflight for 24 hours
}

export function handleCors(res: VercelResponse, req?: VercelRequest): boolean {
  cors(res, req);
  return false;
}

export function json(res: VercelResponse, data: any, status = 200, req?: VercelRequest) {
  cors(res, req);
  return res.status(status).json(data);
}

export function error(res: VercelResponse, message: string, status = 500, req?: VercelRequest) {
  cors(res, req);
  return res.status(status).json({ error: message });
}
