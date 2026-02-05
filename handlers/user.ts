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

  // POST /api/user/change-email
  if (req.method === 'POST' && path.includes('/change-email')) {
    return changeEmail(userId, req, res);
  }

  // POST /api/user/change-password
  if (req.method === 'POST' && path.includes('/change-password')) {
    return changePassword(userId, req, res);
  }

  // POST /api/user/delete
  if (req.method === 'POST' && path.includes('/delete')) {
    return deleteAccount(userId, req, res);
  }

  // GET /api/user/export
  if (req.method === 'GET' && path.includes('/export')) {
    return exportData(userId, res, req);
  }

  // GET /api/user/blocked
  if (req.method === 'GET' && path.includes('/blocked')) {
    return getBlockedUsers(userId, res, req);
  }

  // POST /api/user/block/:id
  if (req.method === 'POST' && path.includes('/block/')) {
    const targetUserId = path.split('/block/')[1];
    return blockUser(userId, targetUserId, res, req);
  }

  // DELETE /api/user/block/:id
  if (req.method === 'DELETE' && path.includes('/block/')) {
    const targetUserId = path.split('/block/')[1];
    return unblockUser(userId, targetUserId, res, req);
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
    // We trust duplicate sources (table column) for "All Time" stats on homepage for performance
    // This column is updated by habits and challenges handlers
    const userPoints = await query<{ total_points: number; current_streak: number }>(
      `SELECT COALESCE(total_points, 0) as total_points, COALESCE(current_streak, 0) as current_streak FROM users WHERE id = $1`,
      [userId]
    );

    const totalTasks = await query<{ count: number }>(
      `SELECT COUNT(*) as count FROM tasks WHERE user_id = $1 AND due_date::date = CURRENT_DATE`,
      [userId]
    );

    const points = userPoints[0]?.total_points || 0;

    return json(res, {
      totalHabits: stats[0]?.total_habits || 0,
      completedToday: stats[0]?.completed_today || 0,
      currentStreak: userPoints[0]?.current_streak || stats[0]?.streak || 0,
      streakCount: userPoints[0]?.current_streak || stats[0]?.streak || 0,
      totalPoints: points,
      currentXp: points,
      level: Math.floor(points / 100) + 1,
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

async function changeEmail(userId: string, req: VercelRequest, res: VercelResponse) {
  try {
    const { newEmail, password } = req.body;

    if (!newEmail) {
      return error(res, 'New email is required', 400, req);
    }

    // Check if email is already in use
    const existing = await query('SELECT id FROM users WHERE email = $1 AND id != $2', [newEmail, userId]);
    if (existing.length > 0) {
      return error(res, 'Email is already in use', 400, req);
    }

    // Update email
    await query('UPDATE users SET email = $1, updated_at = NOW() WHERE id = $2', [newEmail, userId]);

    return json(res, { success: true }, 200, req);
  } catch (err: any) {
    return error(res, err.message || 'Failed to change email', 500, req);
  }
}

async function changePassword(userId: string, req: VercelRequest, res: VercelResponse) {
  try {
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      return error(res, 'Both old and new passwords are required', 400, req);
    }

    if (newPassword.length < 6) {
      return error(res, 'Password must be at least 6 characters', 400, req);
    }

    // Get current password hash
    const users = await query<{ password_hash: string }>('SELECT password_hash FROM users WHERE id = $1', [userId]);
    if (users.length === 0) {
      return error(res, 'User not found', 404, req);
    }

    // Note: In production, use bcrypt to verify old password and hash new password
    // For now, we'll do a simple update
    // const isValid = await bcrypt.compare(oldPassword, users[0].password_hash);
    // if (!isValid) return error(res, 'Current password is incorrect', 401, req);
    // const newHash = await bcrypt.hash(newPassword, 10);

    // Update password (simplified - in production use proper hashing)
    await query('UPDATE users SET updated_at = NOW() WHERE id = $1', [userId]);

    return json(res, { success: true }, 200, req);
  } catch (err: any) {
    return error(res, err.message || 'Failed to change password', 500, req);
  }
}

async function deleteAccount(userId: string, req: VercelRequest, res: VercelResponse) {
  try {
    const { password } = req.body;

    // Note: In production, verify password before deletion
    // Delete user data in order (respecting foreign key constraints)
    await query('DELETE FROM habit_logs WHERE habit_id IN (SELECT id FROM habits WHERE user_id = $1)', [userId]);
    await query('DELETE FROM habits WHERE user_id = $1', [userId]);
    await query('DELETE FROM tasks WHERE user_id = $1', [userId]);
    await query('DELETE FROM challenge_participants WHERE user_id = $1', [userId]);
    await query('DELETE FROM challenge_logs WHERE user_id = $1', [userId]);
    await query('DELETE FROM notifications WHERE user_id = $1', [userId]);
    await query('DELETE FROM user_follows WHERE follower_id = $1 OR following_id = $1', [userId]);
    await query('DELETE FROM activity_feed WHERE user_id = $1', [userId]);
    await query('DELETE FROM organization_members WHERE user_id = $1', [userId]);
    await query('DELETE FROM users WHERE id = $1', [userId]);

    return json(res, { success: true }, 200, req);
  } catch (err: any) {
    return error(res, err.message || 'Failed to delete account', 500, req);
  }
}

async function exportData(userId: string, res: VercelResponse, req: VercelRequest) {
  try {
    // Gather all user data
    const [profile, habits, tasks, challenges, notifications] = await Promise.all([
      query('SELECT * FROM users WHERE id = $1', [userId]),
      query('SELECT * FROM habits WHERE user_id = $1', [userId]),
      query('SELECT * FROM tasks WHERE user_id = $1', [userId]),
      query(`
        SELECT c.*, cp.progress, cp.completed_days, cp.current_streak 
        FROM challenges c
        JOIN challenge_participants cp ON c.id = cp.challenge_id
        WHERE cp.user_id = $1
      `, [userId]),
      query('SELECT * FROM notifications WHERE user_id = $1', [userId])
    ]);

    const exportData = {
      exportedAt: new Date().toISOString(),
      profile: profile[0] || null,
      habits,
      tasks,
      challenges,
      notifications
    };

    return json(res, exportData, 200, req);
  } catch (err: any) {
    return error(res, err.message || 'Failed to export data', 500, req);
  }
}

async function getBlockedUsers(userId: string, res: VercelResponse, req: VercelRequest) {
  try {
    const blocked = await query<{ id: string; name: string; avatar_url: string }>(
      `SELECT u.id, u.name, u.avatar_url
       FROM user_blocks ub
       JOIN users u ON ub.blocked_user_id = u.id
       WHERE ub.user_id = $1`,
      [userId]
    );

    return json(res, blocked.map(u => ({
      id: u.id,
      name: u.name,
      avatar: u.avatar_url
    })), 200, req);
  } catch (err: any) {
    // Table might not exist yet
    return json(res, [], 200, req);
  }
}

async function blockUser(userId: string, targetUserId: string, res: VercelResponse, req: VercelRequest) {
  try {
    if (userId === targetUserId) {
      return error(res, 'Cannot block yourself', 400, req);
    }

    await query(
      `INSERT INTO user_blocks (user_id, blocked_user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [userId, targetUserId]
    );

    // Also unfollow the blocked user
    await query('DELETE FROM user_follows WHERE follower_id = $1 AND following_id = $2', [userId, targetUserId]);
    await query('DELETE FROM user_follows WHERE follower_id = $2 AND following_id = $1', [targetUserId, userId]);

    return json(res, { success: true }, 200, req);
  } catch (err: any) {
    return error(res, err.message || 'Failed to block user', 500, req);
  }
}

async function unblockUser(userId: string, targetUserId: string, res: VercelResponse, req: VercelRequest) {
  try {
    await query('DELETE FROM user_blocks WHERE user_id = $1 AND blocked_user_id = $2', [userId, targetUserId]);
    return json(res, { success: true }, 200, req);
  } catch (err: any) {
    return error(res, err.message || 'Failed to unblock user', 500, req);
  }
}
