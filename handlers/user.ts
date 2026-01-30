import type { VercelRequest, VercelResponse } from '@vercel/node';
import { json, error, cors } from '../lib/response';
import { getAuthFromRequest, getUserId } from '../lib/auth';
import { query } from '../lib/db';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Handle CORS preflight
  cors(res, req);
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const auth = getAuthFromRequest(req);
  if (!auth) {
    return error(res, 'Unauthorized', 401, req);
  }

  const userId = auth.sub;
  const path = req.url?.split('?')[0] || '';

  // GET /api/user/profile
  if (req.method === 'GET' && path.includes('/profile')) {
    return getProfile(userId, res, req);
  }

  // PATCH /api/user/profile
  if (req.method === 'PATCH' && path.includes('/profile')) {
    return updateProfile(userId, req, res);
  }

  // GET /api/user/stats
  if (req.method === 'GET' && path.includes('/stats')) {
    return getStats(userId, res, req);
  }

  // GET /api/user/activity
  if (req.method === 'GET' && path.includes('/activity')) {
    return getActivity(userId, res, req);
  }

  // POST /api/user/sync
  if (req.method === 'POST' && path.includes('/sync')) {
    return syncUser(userId, req, res);
  }

  return error(res, 'Not found', 404, req);
}

async function getProfile(userId: string, res: VercelResponse, req: VercelRequest) {
  try {
    const users = await query<{
      id: string;
      email: string;
      name: string;
      avatar_url?: string;
      bio?: string;
      current_streak?: number;
      total_points?: number;
      created_at: string;
      privacy_public_leaderboard?: string;
      privacy_challenge_leaderboard?: string;
    }>(
      'SELECT id, email, name, avatar_url, bio, current_streak, total_points, created_at, privacy_public_leaderboard, privacy_challenge_leaderboard FROM users WHERE id = $1',
      [userId]
    );

    if (users.length === 0) {
      return error(res, 'User not found', 404, req);
    }

    const user = users[0];
    return json(res, {
      id: user.id,
      externalId: user.id,
      name: user.name,
      email: user.email,
      avatarUrl: user.avatar_url,
      avatar: user.avatar_url,
      bio: user.bio || '',
      streakCount: user.current_streak || 0,
      totalPoints: user.total_points || 0,
      currentXp: user.total_points || 0,
      level: Math.floor((user.total_points || 0) / 100) + 1,
      privacyShowLeaderboard: user.privacy_public_leaderboard !== 'hidden',
      privacyShowActivity: true,
      privacyAllowFollowers: true,
      privacyPublicLeaderboard: user.privacy_public_leaderboard || 'visible',
      privacyChallengeLeaderboard: user.privacy_challenge_leaderboard || 'visible',
    }, 200, req);
  } catch (err: any) {
    return error(res, err.message || 'Failed to get profile', 500, req);
  }
}

async function updateProfile(userId: string, req: VercelRequest, res: VercelResponse) {
  try {
    const { 
      name, 
      avatar_url, 
      avatarUrl, 
      bio, 
      privacyPublicLeaderboard, 
      privacyChallengeLeaderboard 
    } = req.body;

    const users = await query<{ 
      id: string; 
      email: string; 
      name: string; 
      avatar_url?: string; 
      bio?: string; 
      current_streak?: number; 
      total_points?: number;
      privacy_public_leaderboard?: string;
      privacy_challenge_leaderboard?: string;
    }>(
      `UPDATE users SET 
        name = COALESCE($1, name), 
        avatar_url = COALESCE($2, avatar_url),
        bio = COALESCE($3, bio),
        privacy_public_leaderboard = COALESCE($4, privacy_public_leaderboard),
        privacy_challenge_leaderboard = COALESCE($5, privacy_challenge_leaderboard),
        updated_at = NOW()
       WHERE id = $6
       RETURNING id, email, name, avatar_url, bio, current_streak, total_points, privacy_public_leaderboard, privacy_challenge_leaderboard`,
      [
        name, 
        avatar_url || avatarUrl, 
        bio, 
        privacyPublicLeaderboard,
        privacyChallengeLeaderboard,
        userId
      ]
    );

    const user = users[0];
    return json(res, {
      id: user.id,
      externalId: user.id,
      name: user.name,
      email: user.email,
      avatarUrl: user.avatar_url,
      avatar: user.avatar_url,
      bio: user.bio,
      streakCount: user.current_streak || 0,
      totalPoints: user.total_points || 0,
      currentXp: user.total_points || 0,
      level: Math.floor((user.total_points || 0) / 100) + 1,
      privacyShowLeaderboard: user.privacy_public_leaderboard !== 'hidden',
      privacyShowActivity: true,
      privacyAllowFollowers: true,
      privacyPublicLeaderboard: user.privacy_public_leaderboard || 'visible',
      privacyChallengeLeaderboard: user.privacy_challenge_leaderboard || 'visible',
    }, 200, req);
  } catch (err: any) {
    return error(res, err.message || 'Failed to update profile', 500, req);
  }
}

async function getStats(userId: string, res: VercelResponse, req: VercelRequest) {
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

    // Get total points from user
    const userPoints = await query<{ total_points: number; current_streak: number }>(
      `SELECT COALESCE(total_points, 0) as total_points, COALESCE(current_streak, 0) as current_streak FROM users WHERE id = $1`,
      [userId]
    );

    const totalTasks = await query<{ count: number }>(
      `SELECT COUNT(*) as count FROM tasks WHERE user_id = $1 AND due_date::date = CURRENT_DATE`,
      [userId]
    );

    return json(res, {
      totalHabits: stats[0]?.total_habits || 0,
      completedToday: stats[0]?.completed_today || 0,
      currentStreak: userPoints[0]?.current_streak || stats[0]?.streak || 0,
      streakCount: userPoints[0]?.current_streak || stats[0]?.streak || 0,
      totalPoints: userPoints[0]?.total_points || 0,
      currentXp: userPoints[0]?.total_points || 0,
      level: Math.floor((userPoints[0]?.total_points || 0) / 100) + 1,
      totalToday: totalTasks[0]?.count || 0,
    }, 200, req);
  } catch (err: any) {
    return error(res, err.message || 'Failed to get stats', 500, req);
  }
}

async function getActivity(userId: string, res: VercelResponse, req: VercelRequest) {
  try {
    // Get activity for the last 30 days
    const activity = await query<{ date: string; count: number }>(
      `SELECT 
        DATE(completed_at) as date,
        COUNT(*) as count
      FROM habit_logs hl
      JOIN habits h ON hl.habit_id = h.id
      WHERE h.user_id = $1 
        AND hl.completed_at >= NOW() - INTERVAL '30 days'
      GROUP BY DATE(completed_at)
      ORDER BY date DESC`,
      [userId]
    );

    return json(res, activity, 200, req);
  } catch (err: any) {
    return error(res, err.message || 'Failed to get activity', 500, req);
  }
}

async function syncUser(userId: string, req: VercelRequest, res: VercelResponse) {
  try {
    const { externalId, name, email, avatarUrl } = req.body;

    // Check if user exists, update or create
    const existingUsers = await query(
      'SELECT id FROM users WHERE id = $1 OR email = $2',
      [userId, email]
    );

    let user;
    if (existingUsers.length > 0) {
      // Update existing user
      const updated = await query(
        `UPDATE users SET name = COALESCE($1, name), avatar_url = COALESCE($2, avatar_url), updated_at = NOW() 
         WHERE id = $3 OR email = $4 RETURNING *`,
        [name, avatarUrl, userId, email]
      );
      user = updated[0];
    } else {
      // Create new user (this case shouldn't typically happen if auth is working correctly)
      const created = await query(
        `INSERT INTO users (id, email, name, avatar_url) VALUES ($1, $2, $3, $4) RETURNING *`,
        [userId, email, name, avatarUrl]
      );
      user = created[0];
    }

    return json(res, {
      id: user.id,
      externalId: user.id,
      name: user.name,
      email: user.email,
      avatarUrl: user.avatar_url,
      streakCount: user.current_streak || 0,
      totalPoints: user.total_points || 0,
      currentXp: user.total_points || 0,
      level: Math.floor((user.total_points || 0) / 100) + 1,
    }, 200, req);
  } catch (err: any) {
    return error(res, err.message || 'Failed to sync user', 500, req);
  }
}
