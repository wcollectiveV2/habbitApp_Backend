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
  const { habitId } = req.query;

  // GET /api/habits - List habits
  if (req.method === 'GET' && !habitId && path.endsWith('/habits')) {
    return listHabits(userId, res, req);
  }

  // POST /api/habits - Create habit
  if (req.method === 'POST' && path.endsWith('/habits')) {
    return createHabit(userId, req, res);
  }

  // GET /api/habits/:id - Get single habit
  if (req.method === 'GET' && habitId) {
    return getHabit(userId, habitId as string, res, req);
  }

  // PATCH /api/habits/:id - Update habit
  if (req.method === 'PATCH' && habitId) {
    return updateHabit(userId, habitId as string, req, res);
  }

  // DELETE /api/habits/:id - Delete habit
  if (req.method === 'DELETE' && habitId) {
    return deleteHabit(userId, habitId as string, res, req);
  }

  // Handle /complete endpoints (POST and DELETE)
  if (path.includes('/complete')) {
    const id = path.split('/habits/')[1]?.split('/')[0];
    if (id) {
      if (req.method === 'POST') {
        return completeHabit(userId, id, res, req);
      }
      if (req.method === 'DELETE') {
        return uncompleteHabit(userId, id, res, req);
      }
    }
  }

  // Handle /stats endpoints
  if (path.includes('/stats')) {
    const id = path.split('/habits/')[1]?.split('/')[0];
    if (id && req.method === 'GET') {
      return getHabitStats(userId, id, res, req);
    }
  }

  // Handle /logs endpoints
  if (path.includes('/logs')) {
    const id = path.split('/habits/')[1]?.split('/')[0];
    if (id && req.method === 'GET') {
      return getHabitLogs(userId, id, req, res);
    }
  }

  return error(res, 'Not found', 404, req);
}

async function listHabits(userId: string, res: VercelResponse, req: VercelRequest) {
  try {
    // Get habits with TODAY'S completion count
    const habits = await query(
      `SELECT h.*, 
        (SELECT CAST(COUNT(*) AS INTEGER) FROM habit_logs hl WHERE hl.habit_id = h.id AND CAST(hl.completed_at AS DATE) = CURRENT_DATE) as completions_today
      FROM habits h 
      WHERE h.user_id = $1 
      ORDER BY h.created_at DESC`,
      [userId]
    );

    const formattedHabits = habits.map((h: any) => ({
      id: h.id,
      name: h.name,
      description: h.description,
      frequency: h.frequency,
      targetCount: h.target_count,
      category: h.category,
      isActive: h.is_active,
      createdAt: h.created_at,
      updatedAt: h.updated_at,
      completedToday: h.completions_today >= h.target_count,
      completionsToday: h.completions_today
    }));

    return json(res, { habits: formattedHabits }, 200, req);
  } catch (err: any) {
    return error(res, err.message || 'Failed to list habits', 500, req);
  }
}

async function createHabit(userId: string, req: VercelRequest, res: VercelResponse) {
  try {
    const { name, description, frequency, target_count, category } = req.body;

    if (!name) {
      return error(res, 'Habit name is required', 400, req);
    }

    const habits = await query(
      `INSERT INTO habits (user_id, name, description, frequency, target_count, category)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [userId, name, description || '', frequency || 'daily', target_count || 1, category || 'general']
    );

    const h = habits[0];
    const formattedHabit = {
      id: h.id,
      name: h.name,
      description: h.description,
      frequency: h.frequency,
      targetCount: h.target_count,
      category: h.category,
      isActive: h.is_active,
      createdAt: h.created_at,
      updatedAt: h.updated_at
    };

    return json(res, { habit: formattedHabit }, 201, req);
  } catch (err: any) {
    return error(res, err.message || 'Failed to create habit', 500, req);
  }
}

async function getHabit(userId: string, habitId: string, res: VercelResponse, req: VercelRequest) {
  try {
    const habits = await query(
      'SELECT * FROM habits WHERE id = $1 AND user_id = $2',
      [habitId, userId]
    );

    if (habits.length === 0) {
      return error(res, 'Habit not found', 404, req);
    }

    const h = habits[0];
    const formattedHabit = {
      id: h.id,
      name: h.name,
      description: h.description,
      frequency: h.frequency,
      targetCount: h.target_count,
      category: h.category,
      isActive: h.is_active,
      createdAt: h.created_at,
      updatedAt: h.updated_at
    };

    return json(res, { habit: formattedHabit }, 200, req);
  } catch (err: any) {
    return error(res, err.message || 'Failed to get habit', 500, req);
  }
}

async function updateHabit(userId: string, habitId: string, req: VercelRequest, res: VercelResponse) {
  try {
    const { name, description, frequency, target_count, category, is_active } = req.body;

    const habits = await query(
      `UPDATE habits 
       SET name = COALESCE($1, name),
           description = COALESCE($2, description),
           frequency = COALESCE($3, frequency),
           target_count = COALESCE($4, target_count),
           category = COALESCE($5, category),
           is_active = COALESCE($6, is_active),
           updated_at = NOW()
       WHERE id = $7 AND user_id = $8
       RETURNING *`,
      [name, description, frequency, target_count, category, is_active, habitId, userId]
    );

    if (habits.length === 0) {
      return error(res, 'Habit not found', 404, req);
    }

    const h = habits[0];
    const formattedHabit = {
      id: h.id,
      name: h.name,
      description: h.description,
      frequency: h.frequency,
      targetCount: h.target_count,
      category: h.category,
      isActive: h.is_active,
      createdAt: h.created_at,
      updatedAt: h.updated_at
    };

    return json(res, { habit: formattedHabit }, 200, req);
  } catch (err: any) {
    return error(res, err.message || 'Failed to update habit', 500, req);
  }
}

async function deleteHabit(userId: string, habitId: string, res: VercelResponse, req: VercelRequest) {
  try {
    const result = await query(
      'DELETE FROM habits WHERE id = $1 AND user_id = $2 RETURNING id',
      [habitId, userId]
    );

    if (result.length === 0) {
      return error(res, 'Habit not found', 404, req);
    }

    return json(res, { success: true }, 200, req);
  } catch (err: any) {
    return error(res, err.message || 'Failed to delete habit', 500, req);
  }
}

async function completeHabit(userId: string, habitId: string, res: VercelResponse, req: VercelRequest) {
  try {
    // Verify habit belongs to user
    const habits = await query('SELECT id FROM habits WHERE id = $1 AND user_id = $2', [habitId, userId]);
    if (habits.length === 0) {
      return error(res, 'Habit not found', 404, req);
    }

    // Insert log (now allows multiple per day)
    const logs = await query(
      `INSERT INTO habit_logs (habit_id, user_id, completed_at)
       VALUES ($1, $2, NOW())
       RETURNING *`,
      [habitId, userId]
    );

    // Award points (e.g 10 points per completion)
    await query(
      `UPDATE users SET total_points = COALESCE(total_points, 0) + 10 WHERE id = $1`,
      [userId]
    );

    // Update Global User Streak
    const checkTodayRef = await query(
      `SELECT CAST(COUNT(*) AS INTEGER) as count FROM habit_logs WHERE user_id = $1 AND CAST(completed_at AS DATE) = CURRENT_DATE`, 
      [userId]
    );
    
    if (checkTodayRef[0]?.count === 1) {
        // First completion today, check if we have a completion yesterday
        const checkYesterday = await query(
            `SELECT 1 FROM habit_logs WHERE user_id = $1 AND CAST(completed_at AS DATE) = CURRENT_DATE - INTERVAL '1 day' LIMIT 1`,
            [userId]
        );
        
        if (checkYesterday.length > 0) {
             // Increment streak
             await query(`UPDATE users SET current_streak = COALESCE(current_streak, 0) + 1 WHERE id = $1`, [userId]);
        } else {
             // Reset streak to 1
             await query(`UPDATE users SET current_streak = 1 WHERE id = $1`, [userId]);
        }
    }

    // Get updated status
    const countResult = await query(
      `SELECT CAST(COUNT(*) AS INTEGER) as count FROM habit_logs 
       WHERE habit_id = $1 AND user_id = $2 AND CAST(completed_at AS DATE) = CURRENT_DATE`,
      [habitId, userId]
    );
    const completionsToday = countResult[0]?.count || 0;

    return json(res, { success: true, log: logs[0] || null, completionsToday }, 200, req);
  } catch (err: any) {
    return error(res, err.message || 'Failed to complete habit', 500, req);
  }
}

async function uncompleteHabit(userId: string, habitId: string, res: VercelResponse, req: VercelRequest) {
  try {
    // Verify habit belongs to user
    const habits = await query('SELECT id FROM habits WHERE id = $1 AND user_id = $2', [habitId, userId]);
    if (habits.length === 0) {
      return error(res, 'Habit not found', 404, req);
    }

    // Delete ONLY THE MOST RECENT log for today
    await query(
      `DELETE FROM habit_logs 
       WHERE id IN (
         SELECT id FROM habit_logs 
         WHERE habit_id = $1 AND user_id = $2 AND CAST(completed_at AS DATE) = CURRENT_DATE
         ORDER BY completed_at DESC
         LIMIT 1
       )`,
      [habitId, userId]
    );

    // Deduct points
    await query(
      `UPDATE users SET total_points = GREATEST(0, COALESCE(total_points, 0) - 10) WHERE id = $1`,
      [userId]
    );

    // Update streak (if we removed the last action of the day)
    const checkTodayRefUn = await query(
      `SELECT CAST(COUNT(*) AS INTEGER) as count FROM habit_logs WHERE user_id = $1 AND CAST(completed_at AS DATE) = CURRENT_DATE`, 
      [userId]
    );

    if (checkTodayRefUn[0]?.count === 0) {
        // We removed the only action for today, so decrement streak
        // This reverts the increment that happened when we did the first action
        await query(
            `UPDATE users SET current_streak = GREATEST(0, COALESCE(current_streak, 0) - 1) WHERE id = $1`,
            [userId]
        );
    }

    // Get updated status
    const countResult = await query(
      `SELECT CAST(COUNT(*) AS INTEGER) as count FROM habit_logs 
       WHERE habit_id = $1 AND user_id = $2 AND CAST(completed_at AS DATE) = CURRENT_DATE`,
      [habitId, userId]
    );
    const completionsToday = countResult[0]?.count || 0;

    return json(res, { success: true, completionsToday }, 200, req);
  } catch (err: any) {
    return error(res, err.message || 'Failed to uncomplete habit', 500, req);
  }
}

async function getHabitStats(userId: string, habitId: string, res: VercelResponse, req: VercelRequest) {
  try {
    // Verify habit belongs to user
    const habits = await query('SELECT * FROM habits WHERE id = $1 AND user_id = $2', [habitId, userId]);
    if (habits.length === 0) {
      return error(res, 'Habit not found', 404, req);
    }

    const habit = habits[0];

    // Get total completions
    const totalResult = await query(
      `SELECT CAST(COUNT(*) AS INTEGER) as total FROM habit_logs WHERE habit_id = $1 AND user_id = $2`,
      [habitId, userId]
    );
    const totalCompletions = totalResult[0]?.total || 0;

    // Get last 7 days of completions
    const last7DaysResult = await query(
      `SELECT DATE(completed_at) as date, CAST(COUNT(*) AS INTEGER) as count
       FROM habit_logs 
       WHERE habit_id = $1 AND user_id = $2 
         AND completed_at >= CURRENT_DATE - INTERVAL '6 days'
       GROUP BY DATE(completed_at)`,
      [habitId, userId]
    );
    
    // Build last 7 days array (today is last)
    const last7Days: boolean[] = [];
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const found = last7DaysResult.find((r: any) => r.date?.toISOString?.().split('T')[0] === dateStr || String(r.date) === dateStr);
      const count = found?.count || 0;
      last7Days.push(count >= (habit.target_count || 1));
    }

    // Calculate current streak
    let currentStreak = 0;
    const streakResult = await query(
      `SELECT DISTINCT DATE(completed_at) as date
       FROM habit_logs 
       WHERE habit_id = $1 AND user_id = $2
       ORDER BY date DESC`,
      [habitId, userId]
    );
    
    if (streakResult.length > 0) {
      const dates = streakResult.map((r: any) => {
        const d = r.date instanceof Date ? r.date : new Date(r.date);
        return d.toISOString().split('T')[0];
      });
      
      const todayStr = today.toISOString().split('T')[0];
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      
      // Start from today or yesterday
      let checkDate = dates.includes(todayStr) ? today : (dates.includes(yesterdayStr) ? yesterday : null);
      
      if (checkDate) {
        while (true) {
          const checkStr = checkDate.toISOString().split('T')[0];
          if (dates.includes(checkStr)) {
            currentStreak++;
            checkDate.setDate(checkDate.getDate() - 1);
          } else {
            break;
          }
        }
      }
    }

    // Calculate longest streak (simplified - just use current streak or stored value)
    const longestStreak = Math.max(currentStreak, totalCompletions > 0 ? 1 : 0);

    // Calculate completion rate (last 30 days)
    const daysTracked = Math.min(30, Math.ceil((Date.now() - new Date(habit.created_at).getTime()) / (1000 * 60 * 60 * 24)));
    const completionRate = daysTracked > 0 ? Math.round((totalCompletions / daysTracked) * 100) : 0;

    return json(res, {
      stats: {
        totalCompletions,
        currentStreak,
        longestStreak,
        completionRate: Math.min(100, completionRate),
        lastSevenDays: last7Days
      }
    }, 200, req);
  } catch (err: any) {
    console.error('Error getting habit stats:', err);
    return error(res, err.message || 'Failed to get habit stats', 500, req);
  }
}

async function getHabitLogs(userId: string, habitId: string, req: VercelRequest, res: VercelResponse) {
  try {
    // Verify habit belongs to user
    const habits = await query('SELECT id FROM habits WHERE id = $1 AND user_id = $2', [habitId, userId]);
    if (habits.length === 0) {
      return error(res, 'Habit not found', 404, req);
    }

    const { start_date, end_date } = req.query;
    
    let logsQuery = `SELECT * FROM habit_logs WHERE habit_id = $1 AND user_id = $2`;
    const params: any[] = [habitId, userId];
    
    if (start_date) {
      params.push(start_date);
      logsQuery += ` AND completed_at >= $${params.length}`;
    }
    if (end_date) {
      params.push(end_date);
      logsQuery += ` AND completed_at <= $${params.length}`;
    }
    
    logsQuery += ' ORDER BY completed_at DESC LIMIT 100';
    
    const logs = await query(logsQuery, params);

    const formattedLogs = logs.map((l: any) => ({
      id: l.id,
      habitId: l.habit_id,
      userId: l.user_id,
      completedAt: l.completed_at,
      notes: l.notes
    }));

    return json(res, { logs: formattedLogs }, 200, req);
  } catch (err: any) {
    return error(res, err.message || 'Failed to get habit logs', 500, req);
  }
}
