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
  const { taskId } = req.query;

  // GET /api/tasks/today
  if (req.method === 'GET' && path.includes('/today')) {
    return getTodayTasks(userId, res, req);
  }

  // POST /api/tasks
  if (req.method === 'POST' && path.endsWith('/tasks')) {
    return createTask(userId, req, res);
  }

  // PATCH /api/tasks/:id
  if (req.method === 'PATCH' && taskId) {
    return updateTask(userId, taskId as string, req, res);
  }

  // DELETE /api/tasks/:id
  if (req.method === 'DELETE' && taskId) {
    return deleteTask(userId, taskId as string, res, req);
  }

  // GET /api/tasks/history
  if (req.method === 'GET' && path.includes('/history')) {
    return getTaskHistory(userId, req, res);
  }

  return error(res, 'Not found', 404, req);
}

async function getTodayTasks(userId: string, res: VercelResponse, req: VercelRequest) {
  try {
    const tasks = await query(
      `SELECT t.id, t.title, t.description, t.status, t.due_date, t.completed_at,
              t.type, t.goal, t.current_value, t.unit, t.step, t.icon,
              h.name as habit_name, h.category
       FROM tasks t
       LEFT JOIN habits h ON t.habit_id = h.id
       WHERE t.user_id = $1 AND t.due_date::date = CURRENT_DATE
       ORDER BY t.priority DESC, t.due_date ASC`,
      [userId]
    );

    const formattedTasks = tasks.map((t: any) => ({
      id: t.id,
      title: t.title,
      description: t.description,
      challengeName: t.habit_name || 'General Task',
      icon: t.icon || 'check_circle',
      iconBg: 'bg-indigo-500/20', // Default bg
      iconColor: 'text-indigo-500', // Default color
      completed: t.status === 'completed',
      status: t.status,
      dueDate: t.due_date,
      type: t.type || 'check',
      goal: t.goal || 1,
      currentValue: t.current_value || 0,
      unit: t.unit,
      step: t.step || 1,
      currentProgress: t.type === 'check' 
          ? (t.status === 'completed' ? 1 : 0) 
          : (t.current_value || 0),
      totalProgress: t.type === 'check' ? 1 : (t.goal || 1),
      progressBlocks: t.type === 'check' ? 1 : (t.goal || 1), // Simplistic, might need adjustment for large numbers
      activeBlocks: t.type === 'check' 
          ? (t.status === 'completed' ? 1 : 0) 
          : (t.current_value || 0)
    }));

    return json(res, { tasks: formattedTasks }, 200, req);
  } catch (err: any) {
    return error(res, err.message || 'Failed to get tasks', 500, req);
  }
}

async function createTask(userId: string, req: VercelRequest, res: VercelResponse) {
  try {
    const { 
      title, description, habit_id, due_date, priority,
      type, goal, unit, step, icon 
    } = req.body;

    if (!title) {
      return error(res, 'Task title is required', 400, req);
    }

    const tasks = await query(
      `INSERT INTO tasks (
          user_id, title, description, habit_id, due_date, priority,
          type, goal, unit, step, icon
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        userId, title, description || '', habit_id || null, due_date || new Date().toISOString(), priority || 'medium',
        type || 'check', goal || 1, unit || null, step || 1, icon || 'check_circle'
      ]
    );

    return json(res, { task: tasks[0] }, 201, req);
  } catch (err: any) {
    return error(res, err.message || 'Failed to create task', 500, req);
  }
}

async function updateTask(userId: string, taskId: string, req: VercelRequest, res: VercelResponse) {
  try {
    const { title, description, status, priority, completed_at, current_value, value } = req.body;

    const tasks = await query(
      `UPDATE tasks 
       SET title = COALESCE($1, title),
           description = COALESCE($2, description),
           status = COALESCE($3, status),
           priority = COALESCE($4, priority),
           completed_at = COALESCE($5, completed_at),
           current_value = COALESCE($6, current_value),
           updated_at = NOW()
       WHERE id = $7 AND user_id = $8
       RETURNING *`,
      [title, description, status, priority, completed_at, value ?? current_value, taskId, userId]
    );

    if (tasks.length === 0) {
      return error(res, 'Task not found', 404, req);
    }

    return json(res, { task: tasks[0] }, 200, req);
  } catch (err: any) {
    return error(res, err.message || 'Failed to update task', 500, req);
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

    return json(res, { tasks }, 200, req);
  } catch (err: any) {
    return error(res, err.message || 'Failed to get task history', 500, req);
  }
}

async function deleteTask(userId: string, taskId: string, res: VercelResponse, req: VercelRequest) {
  try {
    const result = await query(
      'DELETE FROM tasks WHERE id = $1 AND user_id = $2 RETURNING id',
      [taskId, userId]
    );

    if (result.length === 0) {
      return error(res, 'Task not found', 404, req);
    }

    return json(res, { success: true }, 200, req);
  } catch (err: any) {
    return error(res, err.message || 'Failed to delete task', 500, req);
  }
}
