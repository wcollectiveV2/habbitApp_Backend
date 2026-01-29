import type { VercelRequest, VercelResponse } from '@vercel/node';
import { json, error, cors } from '../../lib/response';
import { getAuthFromRequest, generateToken, verifyToken } from '../../lib/auth';
import { query } from '../../lib/db';
import bcrypt from 'bcryptjs';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Handle CORS preflight
  cors(res, req);
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const path = req.url?.split('?')[0] || '';
  
  // POST /api/auth/login
  if (req.method === 'POST' && path.endsWith('/login')) {
    return handleLogin(req, res);
  }

  // POST /api/auth/register
  if (req.method === 'POST' && path.endsWith('/register')) {
    return handleRegister(req, res);
  }

  // POST /api/auth/refresh
  if (req.method === 'POST' && path.endsWith('/refresh')) {
    return handleRefresh(req, res);
  }

  // GET /api/auth/me
  if (req.method === 'GET' && path.endsWith('/me')) {
    return handleMe(req, res);
  }

  return error(res, 'Not found', 404, req);
}

async function handleLogin(req: VercelRequest, res: VercelResponse) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return error(res, 'Email and password required', 400, req);
    }

    // Query user from database
    const users = await query<{ id: string; email: string; password_hash: string; name: string }>(
      'SELECT id, email, password_hash, name FROM users WHERE email = $1',
      [email]
    );

    if (users.length === 0) {
      return error(res, 'Invalid credentials', 401, req);
    }

    const user = users[0];
    const validPassword = await bcrypt.compare(password, user.password_hash);

    if (!validPassword) {
      return error(res, 'Invalid credentials', 401, req);
    }

    const accessToken = generateToken({
      sub: user.id,
      email: user.email,
      permissions: ['habit:read', 'habit:write'],
    });

    const refreshToken = generateToken({
      sub: user.id,
      email: user.email,
      permissions: ['habit:read', 'habit:write'],
    });

    return json(res, {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    }, 200, req);
  } catch (err: any) {
    console.error('Login error:', err);
    return error(res, err.message || 'Login failed', 500, req);
  }
}

async function handleRegister(req: VercelRequest, res: VercelResponse) {
  try {
    const { email, password, name } = req.body;

    if (!email || !password || !name) {
      return error(res, 'Email, password, and name required', 400, req);
    }

    // Check if user exists
    const existing = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.length > 0) {
      return error(res, 'User already exists', 400, req);
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user
    const users = await query<{ id: string; email: string; name: string }>(
      'INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3) RETURNING id, email, name',
      [email, passwordHash, name]
    );

    const user = users[0];
    const accessToken = generateToken({
      sub: user.id,
      email: user.email,
      permissions: ['habit:read', 'habit:write'],
    });

    const refreshToken = generateToken({
      sub: user.id,
      email: user.email,
      permissions: ['habit:read', 'habit:write'],
    });

    return json(res, {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    }, 201, req);
  } catch (err: any) {
    console.error('Register error:', err);
    return error(res, err.message || 'Registration failed', 500, req);
  }
}

async function handleRefresh(req: VercelRequest, res: VercelResponse) {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return error(res, 'Refresh token required', 400, req);
    }

    const payload = verifyToken(refreshToken);
    if (!payload) {
      return error(res, 'Invalid refresh token', 401, req);
    }

    const newToken = generateToken({
      sub: payload.sub,
      email: payload.email,
      permissions: payload.permissions || ['habit:read', 'habit:write'],
    });

    return json(res, { accessToken: newToken }, 200, req);
  } catch (err: any) {
    return error(res, err.message || 'Refresh failed', 500, req);
  }
}

async function handleMe(req: VercelRequest, res: VercelResponse) {
  try {
    const auth = getAuthFromRequest(req);
    if (!auth) {
      return error(res, 'Unauthorized', 401, req);
    }

    const users = await query<{ id: string; email: string; name: string }>(
      'SELECT id, email, name FROM users WHERE id = $1',
      [auth.sub]
    );

    if (users.length === 0) {
      return error(res, 'User not found', 404, req);
    }

    return json(res, { user: users[0] }, 200, req);
  } catch (err: any) {
    return error(res, err.message || 'Failed to get user', 500, req);
  }
}
