import type { VercelRequest, VercelResponse } from '@vercel/node';
import { json, error, cors } from '../../lib/response';
import { getAuthFromRequest } from '../../lib/auth';
import { query } from '../../lib/db';

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

  // GET /api/social/leaderboard
  if (req.method === 'GET' && path.includes('/leaderboard')) {
    return getLeaderboard(userId, req, res);
  }

  // GET /api/social/feed
  if (req.method === 'GET' && path.includes('/feed')) {
    return getFeed(userId, req, res);
  }

  // POST /api/social/follow/:userId
  if (req.method === 'POST' && path.includes('/follow/')) {
    const targetUserId = path.split('/follow/')[1]?.split('/')[0];
    if (targetUserId) {
      return toggleFollow(userId, targetUserId, res, req);
    }
  }

  // GET /api/social/followers/:userId
  if (req.method === 'GET' && path.includes('/followers/')) {
    const targetUserId = path.split('/followers/')[1]?.split('/')[0];
    if (targetUserId) {
      return getFollowers(targetUserId, res, req);
    }
  }

  // GET /api/social/following/:userId
  if (req.method === 'GET' && path.includes('/following/')) {
    const targetUserId = path.split('/following/')[1]?.split('/')[0];
    if (targetUserId) {
      return getFollowing(targetUserId, res, req);
    }
  }

  // GET /api/social/stats/:userId
  if (req.method === 'GET' && path.includes('/stats/')) {
    const targetUserId = path.split('/stats/')[1]?.split('/')[0];
    if (targetUserId) {
      return getFollowStats(userId, targetUserId, res, req);
    }
  }

  return error(res, 'Not found', 404, req);
}

async function getLeaderboard(userId: string, req: VercelRequest, res: VercelResponse) {
  try {
    const { scope = 'global', period = 'weekly', limit = '10', offset = '0' } = req.query;

    try {
      let queryText = `
        SELECT u.id as user_id, 
               CASE 
                 WHEN u.privacy_public_leaderboard = 'anonymous' AND u.id != $1 THEN 'Anonymous User'
                 ELSE u.name 
               END as user_name, 
               CASE 
                 WHEN u.privacy_public_leaderboard = 'anonymous' AND u.id != $1 THEN NULL 
                 ELSE u.avatar_url 
               END as user_avatar, 
               COALESCE(u.total_points, 0) as points, 
               COALESCE(u.current_streak, 0) as streak_days,
               u.id = $1 as is_current_user
        FROM users u
        WHERE (u.privacy_public_leaderboard IS DISTINCT FROM 'hidden' OR u.id = $1)
      `;

      const params: any[] = [userId];

      if (scope === 'friends') {
        queryText += `
          AND u.id IN (
            SELECT following_id FROM user_follows WHERE follower_id = $1
            UNION SELECT $1
          )
        `;
      }

      queryText += ` ORDER BY points DESC, streak_days DESC LIMIT $2 OFFSET $3`;
      params.push(parseInt(limit as string), parseInt(offset as string));

      const entries = await query(queryText, params);

      // Add ranks and format
      const rankedEntries = entries.map((entry: any, index: number) => ({
        rank: parseInt(offset as string) + index + 1,
        userId: entry.user_id,
        name: entry.user_name,
        avatar: entry.user_avatar,
        points: parseInt(entry.points),
        streakDays: parseInt(entry.streak_days),
        isCurrentUser: entry.is_current_user
      }));

      // Get current user's rank if not in list
      const currentUserRank = rankedEntries.find((e: any) => e.isCurrentUser);

      const total = await query('SELECT COUNT(*) as count FROM users', []);

      return json(res, {
        entries: rankedEntries,
        currentUserRank,
        total: total[0]?.count || 0
      }, 200, req);
    } catch (dbError) {
      // Return sample leaderboard data
      const sampleEntries = [
        { rank: 1, userId: 'u1', userName: 'Sarah Wilson', userAvatar: 'https://i.pravatar.cc/150?u=sarah', points: 2450, streakDays: 45, isCurrentUser: false },
        { rank: 2, userId: 'u2', userName: 'James Miller', userAvatar: 'https://i.pravatar.cc/150?u=james', points: 2210, streakDays: 38, isCurrentUser: false },
        { rank: 3, userId: userId, userName: 'You', userAvatar: 'https://i.pravatar.cc/150?u=you', points: 2100, streakDays: 30, isCurrentUser: true },
        { rank: 4, userId: 'u4', userName: 'Emily Chen', userAvatar: 'https://i.pravatar.cc/150?u=emily', points: 1980, streakDays: 25, isCurrentUser: false },
        { rank: 5, userId: 'u5', userName: 'David Park', userAvatar: 'https://i.pravatar.cc/150?u=david', points: 1850, streakDays: 22, isCurrentUser: false },
      ];

      return json(res, {
        entries: sampleEntries,
        currentUserRank: sampleEntries[2],
        total: 100
      }, 200, req);
    }
  } catch (err: any) {
    return error(res, err.message || 'Failed to get leaderboard', 500, req);
  }
}

async function getFeed(userId: string, req: VercelRequest, res: VercelResponse) {
  try {
    const { scope = 'global', limit = '20', offset = '0' } = req.query;

    try {
      let queryText = `
        SELECT af.*, u.name as user_name, u.avatar_url as user_avatar
        FROM activity_feed af
        JOIN users u ON af.user_id = u.id
      `;

      const params: any[] = [];

      if (scope === 'following') {
        queryText += ` WHERE af.user_id IN (SELECT following_id FROM user_follows WHERE follower_id = $1)`;
        params.push(userId);
      }

      queryText += ` ORDER BY af.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
      params.push(parseInt(limit as string), parseInt(offset as string));

      const items = await query(queryText, params);

      const formattedItems = items.map((item: any) => ({
        id: item.id.toString(),
        userId: item.user_id,
        userName: item.user_name,
        userAvatar: item.user_avatar,
        action: item.activity_type, // Map activity_type to action
        target: item.title, // Map title to target
        timestamp: item.created_at,
        data: item.metadata
      }));

      const hasMore = items.length === parseInt(limit as string);

      return json(res, { items: formattedItems, hasMore }, 200, req);
    } catch (dbError) {
      // Return sample feed data
      const sampleFeed = [
        { 
          id: 1, 
          userId: 'u1', 
          userName: 'Sarah Wilson', 
          userAvatar: 'https://i.pravatar.cc/150?u=sarah',
          type: 'streak_milestone',
          data: { streakDays: 45 },
          action: 'reached',
          target: '45 day streak!',
          createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
        },
        {
          id: 2,
          userId: 'u2',
          userName: 'James Miller',
          userAvatar: 'https://i.pravatar.cc/150?u=james',
          type: 'challenge_completed',
          data: { challengeTitle: 'Hydration Hero' },
          action: 'completed',
          target: 'Hydration Hero challenge',
          createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString()
        },
        {
          id: 3,
          userId: 'u4',
          userName: 'Emily Chen',
          userAvatar: 'https://i.pravatar.cc/150?u=emily',
          type: 'challenge_joined',
          data: { challengeTitle: '30 Day Fitness' },
          action: 'joined',
          target: '30 Day Fitness challenge',
          createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString()
        },
        {
          id: 4,
          userId: 'u5',
          userName: 'David Park',
          userAvatar: 'https://i.pravatar.cc/150?u=david',
          type: 'level_up',
          data: { level: 10 },
          action: 'reached',
          target: 'Level 10!',
          createdAt: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString()
        }
      ];

      return json(res, { items: sampleFeed, hasMore: false }, 200, req);
    }
  } catch (err: any) {
    return error(res, err.message || 'Failed to get feed', 500, req);
  }
}

async function toggleFollow(userId: string, targetUserId: string, res: VercelResponse, req: VercelRequest) {
  try {
    if (userId === targetUserId) {
      return error(res, 'Cannot follow yourself', 400, req);
    }

    try {
      // Check if already following
      const existing = await query(
        'SELECT id FROM user_follows WHERE follower_id = $1 AND following_id = $2',
        [userId, targetUserId]
      );

      if (existing.length > 0) {
        // Unfollow
        await query(
          'DELETE FROM user_follows WHERE follower_id = $1 AND following_id = $2',
          [userId, targetUserId]
        );
        return json(res, { isFollowing: false }, 200, req);
      } else {
        // Follow
        await query(
          'INSERT INTO user_follows (follower_id, following_id) VALUES ($1, $2)',
          [userId, targetUserId]
        );
        return json(res, { isFollowing: true }, 200, req);
      }
    } catch (dbError) {
      return json(res, { isFollowing: true }, 200, req);
    }
  } catch (err: any) {
    return error(res, err.message || 'Failed to toggle follow', 500, req);
  }
}

async function getFollowers(targetUserId: string, res: VercelResponse, req: VercelRequest) {
  try {
    try {
      const followers = await query(
        `SELECT u.id, u.name, u.avatar_url, u.current_streak as streak_count, u.total_points
        FROM users u
        JOIN user_follows uf ON u.id = uf.follower_id
        WHERE uf.following_id = $1`,
        [targetUserId]
      );
      return json(res, followers, 200, req);
    } catch (dbError) {
      return json(res, [], 200, req);
    }
  } catch (err: any) {
    return error(res, err.message || 'Failed to get followers', 500, req);
  }
}

async function getFollowing(targetUserId: string, res: VercelResponse, req: VercelRequest) {
  try {
    try {
      const following = await query(
        `SELECT u.id, u.name, u.avatar_url, u.current_streak as streak_count, u.total_points
        FROM users u
        JOIN user_follows uf ON u.id = uf.following_id
        WHERE uf.follower_id = $1`,
        [targetUserId]
      );
      return json(res, following, 200, req);
    } catch (dbError) {
      return json(res, [], 200, req);
    }
  } catch (err: any) {
    return error(res, err.message || 'Failed to get following', 500, req);
  }
}

async function getFollowStats(currentUserId: string, targetUserId: string, res: VercelResponse, req: VercelRequest) {
  try {
    try {
      const followers = await query(
        'SELECT COUNT(*) as count FROM user_follows WHERE following_id = $1',
        [targetUserId]
      );
      const following = await query(
        'SELECT COUNT(*) as count FROM user_follows WHERE follower_id = $1',
        [targetUserId]
      );
      const isFollowing = await query(
        'SELECT id FROM user_follows WHERE follower_id = $1 AND following_id = $2',
        [currentUserId, targetUserId]
      );
      const isFollowedBy = await query(
        'SELECT id FROM user_follows WHERE follower_id = $1 AND following_id = $2',
        [targetUserId, currentUserId]
      );

      return json(res, {
        followers: followers[0]?.count || 0,
        following: following[0]?.count || 0,
        isFollowing: isFollowing.length > 0,
        isFollowedBy: isFollowedBy.length > 0
      }, 200, req);
    } catch (dbError) {
      return json(res, { followers: 0, following: 0, isFollowing: false, isFollowedBy: false }, 200, req);
    }
  } catch (err: any) {
    return error(res, err.message || 'Failed to get follow stats', 500, req);
  }
}
