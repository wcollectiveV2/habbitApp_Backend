import type { VercelRequest, VercelResponse } from '@vercel/node';
import { json, error, cors } from '../../lib/response';
import { getAuthFromRequest, getUserId } from '../../lib/auth';
import { query } from '../../lib/db';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    cors(res);
    return res.status(200).end();
  }

  const auth = getAuthFromRequest(req);
  if (!auth) {
    return error(res, 'Unauthorized', 401);
  }

  const userId = auth.sub;
  const path = req.url?.split('?')[0] || '';

  // GET /api/user/profile
  if (req.method === 'GET' && path.includes('/profile')) {
    return getProfile(userId, res);
  }

  // PATCH /api/user/profile
  if (req.method === 'PATCH' && path.includes('/profile')) {
    return updateProfile(userId, req, res);
  }

  // GET /api/user/stats
  if (req.method === 'GET' && path.includes('/stats')) {
    return getStats(userId, res);
  }

  return error(res, 'Not found', 404);
}

async function getProfile(userId: string, res: VercelResponse) {
  try {
    const users = await query<{
      id: string;
      email: string;
      name: string;
      avatar_url?: string;
      created_at: string;
    }>(
      'SELECT id, email, name, avatar_url, created_at FROM users WHERE id = $1',
      [userId]
    );

    if (users.length === 0) {
      return error(res, 'User not found', 404);
    }

    return json(res, { user: users[0] });
  } catch (err: any) {
    return error(res, err.message || 'Failed to get profile', 500);
  }
}

async function updateProfile(userId: string, req: VercelRequest, res: VercelResponse) {
  try {
    const { name, avatar_url } = req.body;

    const users = await query<{ id: string; email: string; name: string }>(
      'UPDATE users SET name = COALESCE($1, name), avatar_url = COALESCE($2, avatar_url) WHERE id = $3 RETURNING id, email, name',
      [name, avatar_url, userId]
    );

    if (users.length === 0) {
      return error(res, 'User not found', 404);
    }

    return json(res, { user: users[0] });
  } catch (err: any) {
    return error(res, err.message || 'Failed to update profile', 500);
  }
}

async function getStats(userId: string, res: VercelResponse) {
  try {
    // Get habit statistics
    const stats = await query<{ total_habits: number; completed_today: number; streak: number }>(
      `SELECT 
        COUNT(DISTINCT h.id) as total_habits,
        COUNT(DISTINCT CASE WHEN hl.completed_at::date = CURRENT_DATE THEN hl.id END) as completed_today,
        COALESCE(MAX(u.current_streak), 0) as streak
      FROM users u
      LEFT JOIN habits h ON h.user_id = u.id
      LEFT JOIN habit_logs hl ON hl.habit_id = h.id
      WHERE u.id = $1`,
      [userId]
    );

    return json(res, {
      totalHabits: stats[0]?.total_habits || 0,
      completedToday: stats[0]?.completed_today || 0,
      currentStreak: stats[0]?.streak || 0,
    });
  } catch (err: any) {
    return error(res, err.message || 'Failed to get stats', 500);
  }
}
