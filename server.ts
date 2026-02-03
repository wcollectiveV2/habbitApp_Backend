// server.ts - Express wrapper for local development
import express, { Request, Response } from 'express';
import cors from 'cors';
import handler from './api/index';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3002', 'http://habbit-app:3000', 'http://admin-dashboard:3002'],
  credentials: true
}));
app.use(express.json());

// Route all requests to the Vercel handler
app.use('/api', async (req: Request, res: Response) => {
  // Create mock Vercel request/response
  const vercelReq = {
    ...req,
    query: { ...req.query, route: req.path.replace('/', '') },
    body: req.body,
    headers: req.headers,
    url: `/api${req.url}`,
    method: req.method
  };
  
  await handler(vercelReq as any, res as any);
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`🚀 Backend server running on http://localhost:${PORT}`);
  console.log(`📡 API available at http://localhost:${PORT}/api`);
});
