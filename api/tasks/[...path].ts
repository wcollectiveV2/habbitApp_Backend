import type { VercelRequest, VercelResponse } from '@vercel/node';
import { json, error, cors } from '../../lib/response';
import { getAuthFromRequest } from '../../lib/auth';
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
  const { taskId } = req.query;

  // GET /api/tasks/today
  if (req.method === 'GET' && path.includes('/today')) {
    return getTodayTasks(userId, res);
  }

  // POST /api/tasks
  if (req.method === 'POST' && path.endsWith('/tasks')) {
    return createTask(userId, req, res);
  }

  // PATCH /api/tasks/:id
  if (req.method === 'PATCH' && taskId) {
    return updateTask(userId, taskId as string, req, res);
  }

  // GET /api/tasks/history
  if (req.method === 'GET' && path.includes('/history')) {
    return getTaskHistory(userId, req, res);
  }

  return error(res, 'Not found', 404);
}

async function getTodayTasks(userId: string, res: VercelResponse) {
  try {
    const tasks = await query(
      `SELECT t.*, h.name as habit_name, h.category
       FROM tasks t
       LEFT JOIN habits h ON t.habit_id = h.id
       WHERE t.user_id = $1 AND t.due_date::date = CURRENT_DATE
       ORDER BY t.priority DESC, t.due_date ASC`,
      [userId]
    );

    return json(res, { tasks });
  } catch (err: any) {
    return error(res, err.message || 'Failed to get tasks', 500);
  }
}

async function createTask(userId: string, req: VercelRequest, res: VercelResponse) {
  try {
    const { title, description, habit_id, due_date, priority } = req.body;

    if (!title) {
      return error(res, 'Task title is required', 400);
    }

    const tasks = await query(
      `INSERT INTO tasks (user_id, title, description, habit_id, due_date, priority)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [userId, title, description || '', habit_id || null, due_date || new Date().toISOString(), priority || 'medium']
    );

    return json(res, { task: tasks[0] }, 201);
  } catch (err: any) {
    return error(res, err.message || 'Failed to create task', 500);
  }
}

async function updateTask(userId: string, taskId: string, req: VercelRequest, res: VercelResponse) {
  try {
    const { title, description, status, priority, completed_at } = req.body;

    const tasks = await query(
      `UPDATE tasks 
       SET title = COALESCE($1, title),
           description = COALESCE($2, description),
           status = COALESCE($3, status),
           priority = COALESCE($4, priority),
           completed_at = COALESCE($5, completed_at),
           updated_at = NOW()
       WHERE id = $6 AND user_id = $7
       RETURNING *`,
      [title, description, status, priority, completed_at, taskId, userId]
    );

    if (tasks.length === 0) {
      return error(res, 'Task not found', 404);
    }

    return json(res, { task: tasks[0] });
  } catch (err: any) {
    return error(res, err.message || 'Failed to update task', 500);
  }
}

async function getTaskHistory(userId: string, req: VercelRequest, res: VercelResponse) {
  try {
    const { limit = 20, offset = 0 } = req.query;

    const tasks = await query(
      `SELECT t.*, h.name as habit_name
       FROM tasks t
       LEFT JOIN habits h ON t.habit_id = h.id
       WHERE t.user_id = $1 AND t.status = 'completed'
       ORDER BY t.completed_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, Number(limit), Number(offset)]
    );

    return json(res, { tasks });
  } catch (err: any) {
    return error(res, err.message || 'Failed to get task history', 500);
  }
}
