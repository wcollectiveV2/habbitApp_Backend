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

  // POST /api/habits/:id/complete - Mark habit complete
  if (req.method === 'POST' && path.includes('/complete')) {
    const id = path.split('/habits/')[1]?.split('/')[0];
    if (id) {
      return completeHabit(userId, id, res, req);
    }
  }

  return error(res, 'Not found', 404, req);
}

async function listHabits(userId: string, res: VercelResponse, req: VercelRequest) {
  try {
    const habits = await query(
      `SELECT h.*, 
        (SELECT COUNT(*) FROM habit_logs hl WHERE hl.habit_id = h.id AND hl.completed_at::date = CURRENT_DATE) > 0 as completed_today
      FROM habits h 
      WHERE h.user_id = $1 
      ORDER BY h.created_at DESC`,
      [userId]
    );

    return json(res, { habits }, 200, req);
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

    return json(res, { habit: habits[0] }, 201, req);
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

    return json(res, { habit: habits[0] }, 200, req);
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

    return json(res, { habit: habits[0] }, 200, req);
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

    // Log completion
    const logs = await query(
      `INSERT INTO habit_logs (habit_id, user_id, completed_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (habit_id, user_id, completed_at::date) DO NOTHING
       RETURNING *`,
      [habitId, userId]
    );

    return json(res, { success: true, log: logs[0] || null }, 200, req);
  } catch (err: any) {
    return error(res, err.message || 'Failed to complete habit', 500, req);
  }
}
