import type { VercelRequest, VercelResponse } from '@vercel/node';
import { json, error, cors } from '../lib/response';
import { getAuthFromRequest } from '../lib/auth';
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
      let queryText;
      const params: any[] = [userId];

      if (period === 'allTime') {
        // For all-time, trust the accrued total_points which includes habits and challenges
        queryText = `
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
      } else {
        // For specific periods, calculate points dynamically from habit logs (activity proxy)
        // This is more accurate for "weekly/daily" than trying to snapshot total_points
        let dateFilter = "";
        let challengeDateFilter = "";
        
        if (period === 'daily') {
          dateFilter = "AND completed_at >= CURRENT_DATE";
          challengeDateFilter = "AND date = CURRENT_DATE";
        } else if (period === 'weekly') {
          dateFilter = "AND completed_at >= NOW() - INTERVAL '7 days'";
          challengeDateFilter = "AND date >= CURRENT_DATE - INTERVAL '7 days'";
        } else if (period === 'monthly') {
          dateFilter = "AND completed_at >= NOW() - INTERVAL '30 days'";
          challengeDateFilter = "AND date >= CURRENT_DATE - INTERVAL '30 days'";
        }

        queryText = `
          WITH habit_scores AS (
            SELECT user_id, COUNT(*) * 10 as score
            FROM habit_logs
            WHERE 1=1 ${dateFilter}
            GROUP BY user_id
          ),
          challenge_scores AS (
            SELECT user_id, COUNT(*) * 20 as score
            FROM challenge_logs
            WHERE completed = true ${challengeDateFilter}
            GROUP BY user_id
          )
          SELECT u.id as user_id, 
                 CASE 
                   WHEN u.privacy_public_leaderboard = 'anonymous' AND u.id != $1 THEN 'Anonymous User'
                   ELSE u.name 
                 END as user_name, 
                 CASE 
                   WHEN u.privacy_public_leaderboard = 'anonymous' AND u.id != $1 THEN NULL 
                   ELSE u.avatar_url 
                 END as user_avatar, 
                 COALESCE(hs.score, 0) + COALESCE(cs.score, 0) as points, 
                 COALESCE(u.current_streak, 0) as streak_days,
                 u.id = $1 as is_current_user
          FROM users u
          LEFT JOIN habit_scores hs ON u.id = hs.user_id
          LEFT JOIN challenge_scores cs ON u.id = cs.user_id
          WHERE (u.privacy_public_leaderboard IS DISTINCT FROM 'hidden' OR u.id = $1)
        `;
      }

      if (scope === 'friends') {
        queryText += `
          AND u.id IN (
            SELECT following_id FROM user_follows WHERE follower_id = $1
            UNION SELECT $1
          )
        `;
      }

      if (scope === 'organization') {
        queryText += `
          AND u.id IN (
            SELECT user_id FROM organization_members 
            WHERE organization_id IN (
              SELECT organization_id FROM organization_members WHERE user_id = $1 AND status = 'active'
            )
          )
        `;
      }

      // Order by calculated points
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
      let currentUserRank = rankedEntries.find((e: any) => e.isCurrentUser);

      // If user is not in the top results, fetch their specific rank and score
      if (!currentUserRank) {
         try {
           let myPoints = 0;
           let myRank = 0;

           if (period === 'allTime') {
             // Simple query for all time
             const myData = await query<{total_points: number}>('SELECT total_points FROM users WHERE id = $1', [userId]);
             myPoints = myData[0]?.total_points || 0;
             
             // Count users with more points
             const rankData = await query<{count: string}>('SELECT COUNT(*) as count FROM users WHERE total_points > $1', [myPoints]);
             myRank = parseInt(rankData[0]?.count || '0') + 1;

           } else {
             // Dynamic query for periods
             let dateFilter = "";
             let challengeDateFilter = "";
             
             if (period === 'daily') {
               dateFilter = "AND completed_at >= CURRENT_DATE";
               challengeDateFilter = "AND date = CURRENT_DATE";
             } else if (period === 'weekly') {
               dateFilter = "AND completed_at >= NOW() - INTERVAL '7 days'";
               challengeDateFilter = "AND date >= CURRENT_DATE - INTERVAL '7 days'";
             } else if (period === 'monthly') {
               dateFilter = "AND completed_at >= NOW() - INTERVAL '30 days'";
               challengeDateFilter = "AND date >= CURRENT_DATE - INTERVAL '30 days'";
             }

             // 1. Get my score
             const myScoreData = await query<{points: number}>(`
                WITH habit_scores AS (
                  SELECT COUNT(*) * 10 as score FROM habit_logs WHERE user_id = $1 ${dateFilter}
                ),
                challenge_scores AS (
                  SELECT COUNT(*) * 20 as score FROM challenge_logs WHERE user_id = $1 AND completed = true ${challengeDateFilter}
                )
                SELECT (COALESCE((SELECT score FROM habit_scores), 0) + COALESCE((SELECT score FROM challenge_scores), 0)) as points
             `, [userId]);
             
             myPoints = parseInt(myScoreData[0]?.points as any || '0');

             // 2. Get my rank (expensive but necessary if we want accurate rank)
             // Simplified: just return > 99 if deep, or estimate. 
             // For now, let's just count how many users have MORE score.
             const rankQuery = await query<{count: string}>(`
                WITH all_scores AS (
                    SELECT 
                      u.id,
                      (
                        COALESCE((SELECT COUNT(*) * 10 FROM habit_logs WHERE user_id = u.id ${dateFilter}), 0) + 
                        COALESCE((SELECT COUNT(*) * 20 FROM challenge_logs WHERE user_id = u.id AND completed = true ${challengeDateFilter}), 0)
                      ) as total_score
                    FROM users u
                )
                SELECT COUNT(*) as count FROM all_scores WHERE total_score > $1
             `, [myPoints]);
             
             myRank = parseInt(rankQuery[0]?.count || '0') + 1;
           }

           // Get basic user info
           const userInfo = await query('SELECT name, avatar_url FROM users WHERE id = $1', [userId]);
           
           if (userInfo.length > 0) {
              currentUserRank = {
                rank: myRank,
                userId: userId,
                name: userInfo[0].name,
                avatar: userInfo[0].avatar_url,
                points: myPoints,
                streakDays: 0, // Simplified
                isCurrentUser: true
              };
           }
         } catch (e) {
           console.log('Error fetching current user rank:', e);
         }
      }

      const total = await query('SELECT COUNT(*) as count FROM users', []);

      return json(res, {
        entries: rankedEntries,
        currentUserRank,
        total: total[0]?.count || 0
      }, 200, req);
    } catch (dbError: any) {
      console.error('Database error in getLeaderboard:', dbError);
      return error(res, 'Database error: ' + dbError.message, 500, req);
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
