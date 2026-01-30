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
  
  // Extract notification ID from path if present
  // Expected format: /api/notifications or /api/notifications/:id/read
  const parts = path.split('/');
  const lastPart = parts[parts.length - 1];
  const secondLastPart = parts[parts.length - 2];

  // GET /api/notifications
  if (req.method === 'GET') {
    return getNotifications(userId, req, res);
  }

  // PATCH /api/notifications/:id/read
  if (req.method === 'PATCH' && lastPart === 'read' && secondLastPart) {
    const notificationId = secondLastPart;
    // Simple UUID validation could be added here
    return markAsRead(userId, notificationId, req, res);
  }

  // POST /api/notifications/:id/accept - Accept invitation
  if (req.method === 'POST' && lastPart === 'accept' && secondLastPart) {
    const notificationId = secondLastPart;
    return acceptNotification(userId, notificationId, req, res);
  }

  // POST /api/notifications/mark-all-read
  if (req.method === 'POST' && lastPart === 'mark-all-read') {
    return markAllAsRead(userId, req, res);
  }

  // POST /api/notifications (Create - Internal use mainly, but exposed for flexibility)
  if (req.method === 'POST') {
    return createNotification(userId, req, res);
  }

  return error(res, 'Not found', 404, req);
}

async function getNotifications(userId: string, req: VercelRequest, res: VercelResponse) {
  try {
    const { unreadOnly, limit = '20', offset = '0' } = req.query;
    
    let sqlQuery = `
      SELECT id, type, title, message, data, is_read, created_at
      FROM notifications
      WHERE user_id = $1
    `;
    
    const params: any[] = [userId];
    
    if (unreadOnly === 'true') {
      sqlQuery += ` AND is_read = false`;
    }
    
    sqlQuery += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(limit as string), parseInt(offset as string));
    
    const notifications = await query(sqlQuery, params);
    
    // Get unread count
    const countResult = await query(
      `SELECT COUNT(*) as count FROM notifications WHERE user_id = $1 AND is_read = false`,
      [userId]
    );
    const unreadCount = parseInt(countResult[0]?.count || '0');
    
    return json(res, {
      notifications,
      unreadCount
    });
  } catch (err) {
    console.error('Error fetching notifications:', err);
    return error(res, 'Failed to fetch notifications');
  }
}

async function acceptNotification(userId: string, notificationId: string, req: VercelRequest, res: VercelResponse) {
  try {
    const notifications = await query('SELECT * FROM notifications WHERE id = $1 AND user_id = $2', [notificationId, userId]);
    if (notifications.length === 0) return error(res, 'Notification not found', 404, req);
    
    const notification = notifications[0];
    
    // Logic for ORG_INVITE
    if (notification.type === 'ORG_INVITE') {
      const { organizationId, pendingChallengeId, role } = notification.data || {};
      
      // Add to organization
      await query(
        `INSERT INTO organization_members (organization_id, user_id, role, status)
         VALUES ($1, $2, $3, 'active')
         ON CONFLICT (organization_id, user_id) DO UPDATE SET status = 'active'`,
        [organizationId, userId, role || 'member']
      );
      
      // If there was a pending challenge invite, send it now
      if (pendingChallengeId) {
         const challenge = await query('SELECT title FROM challenges WHERE id = $1', [pendingChallengeId]);
         const challengeTitle = challenge[0]?.title || 'Unknown Challenge';
         
         await query(
           `INSERT INTO notifications (user_id, type, title, message, data)
            VALUES ($1, 'CHALLENGE_INVITE', $2, $3, $4)`,
           [
             userId, 
             'CHALLENGE_INVITE', 
             `Join ${challengeTitle}`, 
             `You have been invited to join the challenge: ${challengeTitle}`, 
             { challengeId: pendingChallengeId, organizationId }
           ]
         );
      }
    }
    
    // Logic for CHALLENGE_INVITE
    else if (notification.type === 'CHALLENGE_INVITE') {
        const { challengeId } = notification.data || {};
         await query(
        `INSERT INTO challenge_participants (challenge_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [challengeId, userId]
      );
    }
    
    // Mark as read
    await query('UPDATE notifications SET is_read = true WHERE id = $1', [notificationId]);
    
    return json(res, { success: true }, 200, req);
  } catch (err: any) {
    return error(res, err.message || 'Failed to accept notification', 500, req);
  }
}

async function markAsRead(userId: string, notificationId: string, req: VercelRequest, res: VercelResponse) {
  try {
    const result = await query(
      `UPDATE notifications 
       SET is_read = true 
       WHERE id = $1 AND user_id = $2
       RETURNING id`,
      [notificationId, userId]
    );
    
    if (result.length === 0) {
      return error(res, 'Notification not found or already read', 404);
    }
    
    return json(res, { success: true });
  } catch (err) {
    console.error('Error marking notification as read:', err);
    return error(res, 'Failed to mark notification as read');
  }
}

async function markAllAsRead(userId: string, req: VercelRequest, res: VercelResponse) {
  try {
    await query(
      `UPDATE notifications 
       SET is_read = true 
       WHERE user_id = $1 AND is_read = false`,
      [userId]
    );
    
    return json(res, { success: true });
  } catch (err) {
    console.error('Error marking all notifications as read:', err);
    return error(res, 'Failed to mark all notifications as read');
  }
}

async function createNotification(userId: string, req: VercelRequest, res: VercelResponse) {
  try {
    const { type, title, message, data, targetUserId } = req.body;
    
    // If targetUserId is provided (and maybe we check for admin rights later), use it.
    // Otherwise, create for self (mostly for testing).
    // In a real scenario, this endpoint might be secured with a service-to-service token
    // or checks if the logged-in user is allowed to notify the target.
    // For now, let's allow users to send notifications to themselves or others if logic permits.
    // Assuming simple self-notification or system-wide logic handled by caller.
    
    const recipientId = targetUserId || userId;

    if (!type || !title) {
        return error(res, 'Missing required fields: type, title');
    }

    const result = await query(
      `INSERT INTO notifications (user_id, type, title, message, data)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, created_at`,
       [recipientId, type, title, message, data || {}]
    );
    
    return json(res, { success: true, notification: result[0] }, 201);
  } catch (err) {
    console.error('Error creating notification:', err);
    return error(res, 'Failed to create notification');
  }
}
