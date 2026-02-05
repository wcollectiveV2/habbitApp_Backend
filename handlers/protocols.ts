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
  const pathParts = path.split('/');
  
  // Extract ID (UUID support)
  // Assumes structure /api/protocols/:id or /protocols/:id
  const protocolsIndex = pathParts.indexOf('protocols');
  const id = (protocolsIndex !== -1 && pathParts.length > protocolsIndex + 1 && pathParts[protocolsIndex + 1]) 
    ? pathParts[protocolsIndex + 1] 
    : null;
  
  // GET /api/protocols
  if (req.method === 'GET' && !id && (path.endsWith('/protocols') || path.endsWith('/protocols/'))) {
    return listProtocols(userId, req, res);
  }

  // POST /api/protocols
  if (req.method === 'POST' && (path.endsWith('/protocols') || path.endsWith('/protocols/'))) {
    return createProtocol(userId, req, res);
  }

  // GET /api/protocols/:id
  if (req.method === 'GET' && id && !path.includes('/leaderboard') && !path.includes('/elements') && !path.includes('/my-progress')) {
    return getProtocol(id, res, req);
  }
  
  // PATCH /api/protocols/:id
  if (req.method === 'PATCH' && id && !path.includes('/elements')) {
    return updateProtocol(userId, id, req, res);
  }
  
  // DELETE /api/protocols/:id
  if (req.method === 'DELETE' && id && !path.includes('/elements')) {
    return deleteProtocol(userId, id, req, res);
  }

  // POST /api/protocols/:id/elements
  if (req.method === 'POST' && id && path.includes('/elements')) {
    return addProtocolElement(id, req, res);
  }
  
  // PATCH /api/protocols/:id/elements/:elementId
  if (req.method === 'PATCH' && id && path.includes('/elements')) {
    const elementId = pathParts[pathParts.indexOf('elements') + 1];
    if (elementId) {
      return updateProtocolElement(elementId, req, res);
    }
  }
  
  // DELETE /api/protocols/:id/elements/:elementId
  if (req.method === 'DELETE' && id && path.includes('/elements')) {
    const elementId = pathParts[pathParts.indexOf('elements') + 1];
    if (elementId) {
      return deleteProtocolElement(elementId, req, res);
    }
  }

  // POST /api/protocols/:id/assign
  if (req.method === 'POST' && id && path.includes('/assign') && !path.includes('assign-organization')) {
    return assignProtocol(userId, id, req, res);
  }
  
  // POST /api/protocols/:id/assign-organization
  if (req.method === 'POST' && id && path.includes('/assign-organization')) {
    return assignProtocolToOrganization(userId, id, req, res);
  }
  
  // POST /api/protocols/:id/log
  if (req.method === 'POST' && id && path.includes('/log')) {
    return logProtocolElement(userId, id, req, res);
  }
  
  // GET /api/protocols/:id/leaderboard
  if (req.method === 'GET' && id && path.includes('/leaderboard')) {
    return getProtocolLeaderboard(userId, id, req, res);
  }
  
  // GET /api/protocols/:id/my-progress
  if (req.method === 'GET' && id && path.includes('/my-progress')) {
    return getMyProtocolProgress(userId, id, req, res);
  }
  
  // POST /api/protocols/:id/duplicate - Duplicate a protocol
  if (req.method === 'POST' && id && path.includes('/duplicate')) {
    return duplicateProtocol(userId, id, req, res);
  }
  
  // POST /api/protocols/:id/activate - Change status to active
  if (req.method === 'POST' && id && path.includes('/activate')) {
    return changeProtocolStatus(userId, id, 'active', req, res);
  }
  
  // POST /api/protocols/:id/archive - Change status to archived
  if (req.method === 'POST' && id && path.includes('/archive')) {
    return changeProtocolStatus(userId, id, 'archived', req, res);
  }
  
  // POST /api/protocols/:id/draft - Change status to draft
  if (req.method === 'POST' && id && path.includes('/draft')) {
    return changeProtocolStatus(userId, id, 'draft', req, res);
  }
  
  // POST /api/protocols/:id/join - User joins an open protocol
  if (req.method === 'POST' && id && path.includes('/join')) {
    return joinProtocol(userId, id, req, res);
  }
  
  // POST /api/protocols/:id/leave - User leaves a protocol
  if (req.method === 'POST' && id && path.includes('/leave')) {
    return leaveProtocol(userId, id, req, res);
  }
  
  // GET /api/protocols/:id/participants - Get protocol participants
  if (req.method === 'GET' && id && path.includes('/participants')) {
    return getProtocolParticipants(userId, id, req, res);
  }

  return error(res, 'Not found', 404, req);
}

async function listProtocols(userId: string, req: VercelRequest, res: VercelResponse) {
  try {
    const { organization_id, status = 'active' } = req.query;
    
    let protocols;
    
    if (organization_id) {
      // B-SEC-01: Organization isolation
      const auth = getAuthFromRequest(req);
      const isGlobalAdmin = (auth?.permissions || []).includes('admin');
      
      const membership = await query(
         `SELECT 1 FROM organization_members WHERE organization_id = $1 AND user_id = $2 AND status = 'active'`,
         [organization_id, userId]
      );
      
      if (!isGlobalAdmin && membership.length === 0) {
          return error(res, 'You do not have access to this organization protocols', 403, req);
      }

      // Get protocols for a specific organization
      protocols = await query(
        `SELECT p.*, 
                poa.assigned_at as org_assigned_at,
                o.name as organization_name
         FROM protocols p
         LEFT JOIN protocol_organization_assignments poa ON p.id = poa.protocol_id
         LEFT JOIN organizations o ON poa.organization_id = o.id
         WHERE poa.organization_id = $1
         ORDER BY p.created_at DESC`,
        [organization_id]
      );
    } else {
      // Get all protocols (for admin) or user's assigned protocols
      const auth = getAuthFromRequest(req);
      const isAdmin = (auth?.permissions || []).includes('admin');
      
      if (isAdmin) {
        protocols = await query(
          `SELECT p.*
           FROM protocols p
           ORDER BY p.created_at DESC`
        );
      } else {
        // Get protocols assigned to user
        protocols = await query(
          `SELECT p.*
           FROM protocols p
           JOIN user_protocols up ON p.id = up.protocol_id
           WHERE up.user_id = $1
           ORDER BY p.created_at DESC`,
          [userId]
        );
      }
    }
    
    // For each protocol, get elements
    const protocolsWithElements = await Promise.all(protocols.map(async (p: any) => {
      const elements = await query(
        `SELECT * FROM protocol_elements WHERE protocol_id = $1 ORDER BY display_order, created_at`,
        [p.id]
      );
      return {
        ...p,
        creatorId: p.creator_id,
        organizationId: p.organization_id,
        organizationName: p.organization_name,
        createdAt: p.created_at,
        elements: elements.map((e: any) => ({
          id: e.id,
          title: e.title,
          description: e.description,
          type: e.type,
          unit: e.unit,
          goal: e.goal,
          minValue: e.min_value,
          maxValue: e.max_value,
          points: e.points,
          frequency: e.frequency,
          displayOrder: e.display_order,
          isRequired: e.is_required
        }))
      };
    }));
    
    return json(res, protocolsWithElements);
  } catch (err: any) {
    return error(res, err.message, 500, req);
  }
}

async function createProtocol(userId: string, req: VercelRequest, res: VercelResponse) {
  try {
    const { name, description, icon, status, organization_id } = req.body;
    
    // B-SEC-01: Input Validation
    if (!name || typeof name !== 'string') {
        return error(res, 'Invalid name', 400, req);
    }
    
    const auth = getAuthFromRequest(req);
    const isGlobalAdmin = (auth?.permissions || []).includes('admin');

    if (organization_id) {
      const membership = await query(
        `SELECT role FROM organization_members 
         WHERE organization_id = $1 AND user_id = $2 AND status = 'active'`,
        [organization_id, userId]
      );
      
      const isOrgAdmin = membership.length > 0 && ['admin', 'manager'].includes(membership[0].role);
      
      if (!isGlobalAdmin && !isOrgAdmin) {
        return error(res, 'You do not have permission to create protocols for this organization', 403, req);
      }
    } else {
        // Global/Public protocol creation - Only Global Admin
        if (!isGlobalAdmin) {
            return error(res, 'Only global admins can create global protocols', 403, req);
        }
    }

    const result = await query(
      `INSERT INTO protocols (name, description, creator_id, organization_id, icon, status) 
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [name, description, userId, organization_id || null, icon, status]
    );
    
    const protocol = result[0];
    
    return json(res, {
      ...protocol,
      creatorId: protocol.creator_id,
      organizationId: protocol.organization_id,
      createdAt: protocol.created_at,
      elements: []
    }, 201, req);

  } catch (err: any) {
    return error(res, err.message, 500, req);
  }
}

async function updateProtocol(userId: string, id: string, req: VercelRequest, res: VercelResponse) {
  try {
    const { name, description, icon, status, organization_id } = req.body;
    
    // Check permission
    const protocol = await query(`SELECT * FROM protocols WHERE id = $1`, [id]);
    if (protocol.length === 0) return error(res, 'Protocol not found', 404, req);
    
    const auth = getAuthFromRequest(req);
    const isGlobalAdmin = (auth?.permissions || []).includes('admin');
    const isCreator = protocol[0].creator_id === userId;
    
    if (!isGlobalAdmin && !isCreator) {
      return error(res, 'You do not have permission to update this protocol', 403, req);
    }
    
    const result = await query(
      `UPDATE protocols SET 
         name = COALESCE($1, name),
         description = COALESCE($2, description),
         icon = COALESCE($3, icon),
         status = COALESCE($4, status),
         organization_id = COALESCE($5, organization_id),
         updated_at = NOW()
       WHERE id = $6 RETURNING *`,
      [name, description, icon, status, organization_id, id]
    );
    
    return json(res, result[0], 200, req);
  } catch (err: any) {
    return error(res, err.message, 500, req);
  }
}

async function deleteProtocol(userId: string, id: string, req: VercelRequest, res: VercelResponse) {
  try {
    const protocol = await query(`SELECT * FROM protocols WHERE id = $1`, [id]);
    if (protocol.length === 0) return error(res, 'Protocol not found', 404, req);
    
    const auth = getAuthFromRequest(req);
    const userId = auth?.sub;
    const isGlobalAdmin = (auth?.permissions || []).includes('admin');
    const isCreator = protocol[0].creator_id === userId;
    
    // console.log('DEBUG DELETE:', { userId, id, isGlobalAdmin, isCreator });

    if (!isGlobalAdmin && !isCreator && userId) {
        // Check if Org Admin
        let isOrgAdmin = false;
        if (protocol[0].organization_id) {
             const membership = await query(
                `SELECT role FROM organization_members WHERE organization_id = $1 AND user_id = $2 AND status = 'active'`,
                [protocol[0].organization_id, userId]
             );
             isOrgAdmin = membership.length > 0 && ['admin', 'owner'].includes(membership[0].role);
        }
        
        if (!isOrgAdmin) {
            return error(res, 'You do not have permission to delete this protocol', 403, req);
        }
    }
    
    await query(`DELETE FROM protocols WHERE id = $1`, [id]);
    
    return json(res, { message: 'Protocol deleted' }, 200, req);
  } catch (err: any) {
    return error(res, err.message, 500, req);
  }
}

async function getProtocol(id: string, res: VercelResponse, req: VercelRequest) {
  try {
    const protocols = await query(
      `SELECT p.*, o.name as organization_name
       FROM protocols p
       LEFT JOIN organizations o ON p.organization_id = o.id
       WHERE p.id = $1`,
      [id]
    );
    if (protocols.length === 0) return error(res, 'Protocol not found', 404, req);
    
    const protocol = protocols[0];

    // Get protocol elements
    const elements = await query(
      `SELECT * FROM protocol_elements WHERE protocol_id = $1 ORDER BY display_order, created_at`,
      [id]
    );
    
    // Get assigned organizations
    const assignedOrgs = await query(
      `SELECT o.id, o.name, poa.assigned_at
       FROM protocol_organization_assignments poa
       JOIN organizations o ON poa.organization_id = o.id
       WHERE poa.protocol_id = $1`,
      [id]
    );
    
    return json(res, {
      ...protocol,
      creatorId: protocol.creator_id,
      organizationId: protocol.organization_id,
      organizationName: protocol.organization_name,
      createdAt: protocol.created_at,
      assignedOrganizations: assignedOrgs,
      elements: elements.map((e: any) => ({
        id: e.id,
        title: e.title,
        description: e.description,
        type: e.type,
        unit: e.unit,
        goal: e.goal,
        minValue: e.min_value,
        maxValue: e.max_value,
        points: e.points,
        frequency: e.frequency,
        displayOrder: e.display_order,
        isRequired: e.is_required
      }))
    }, 200, req);
  } catch (err: any) {
    return error(res, err.message, 500, req);
  }
}

async function addProtocolElement(protocolId: string, req: VercelRequest, res: VercelResponse) {
  try {
    const { 
      title, 
      description,
      type = 'check', 
      unit, 
      goal, 
      min_value,
      max_value,
      points = 10,
      frequency = 'daily',
      display_order = 0,
      is_required = true
    } = req.body;
    
    if (!title) return error(res, 'Title is required', 400, req);
    
    // Validate type
    const validTypes = ['check', 'number', 'range', 'timer', 'text'];
    if (!validTypes.includes(type)) {
      return error(res, `Invalid type. Must be one of: ${validTypes.join(', ')}`, 400, req);
    }
    
    const result = await query(
      `INSERT INTO protocol_elements 
         (protocol_id, title, description, type, unit, goal, min_value, max_value, points, frequency, display_order, is_required) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
      [protocolId, title, description, type, unit, goal, min_value, max_value, points, frequency, display_order, is_required]
    );
    
    const element = result[0];
    return json(res, {
      id: element.id,
      title: element.title,
      description: element.description,
      type: element.type,
      unit: element.unit,
      goal: element.goal,
      minValue: element.min_value,
      maxValue: element.max_value,
      points: element.points,
      frequency: element.frequency,
      displayOrder: element.display_order,
      isRequired: element.is_required
    }, 201, req);
  } catch (err: any) {
    return error(res, err.message, 500, req);
  }
}

async function updateProtocolElement(elementId: string, req: VercelRequest, res: VercelResponse) {
  try {
    const { title, description, type, unit, goal, min_value, max_value, points, frequency, display_order, is_required } = req.body;
    
    const result = await query(
      `UPDATE protocol_elements SET 
         title = COALESCE($1, title),
         description = COALESCE($2, description),
         type = COALESCE($3, type),
         unit = COALESCE($4, unit),
         goal = COALESCE($5, goal),
         min_value = COALESCE($6, min_value),
         max_value = COALESCE($7, max_value),
         points = COALESCE($8, points),
         frequency = COALESCE($9, frequency),
         display_order = COALESCE($10, display_order),
         is_required = COALESCE($11, is_required)
       WHERE id = $12 RETURNING *`,
      [title, description, type, unit, goal, min_value, max_value, points, frequency, display_order, is_required, elementId]
    );
    
    if (result.length === 0) return error(res, 'Element not found', 404, req);
    
    const element = result[0];
    return json(res, {
      id: element.id,
      title: element.title,
      description: element.description,
      type: element.type,
      unit: element.unit,
      goal: element.goal,
      minValue: element.min_value,
      maxValue: element.max_value,
      points: element.points,
      frequency: element.frequency,
      displayOrder: element.display_order,
      isRequired: element.is_required
    }, 200, req);
  } catch (err: any) {
    return error(res, err.message, 500, req);
  }
}

async function deleteProtocolElement(elementId: string, req: VercelRequest, res: VercelResponse) {
  try {
    const result = await query(`DELETE FROM protocol_elements WHERE id = $1 RETURNING id`, [elementId]);
    if (result.length === 0) return error(res, 'Element not found', 404, req);
    
    return json(res, { message: 'Element deleted' }, 200, req);
  } catch (err: any) {
    return error(res, err.message, 500, req);
  }
}

async function assignProtocol(assignerId: string, protocolId: string, req: VercelRequest, res: VercelResponse) {
  try {
    const { userId, targetType = 'USER', targetId } = req.body;
    
    // For backward compatibility, support both userId and targetId
    const targetUserId = userId || targetId;
    
    if (targetType === 'USER') {
      if (!targetUserId) return error(res, 'Target user ID required', 400, req);
      
      await query(
        `INSERT INTO user_protocols (user_id, protocol_id, assigned_by) 
         VALUES ($1, $2, $3) 
         ON CONFLICT (user_id, protocol_id) DO NOTHING`,
        [targetUserId, protocolId, assignerId]
      );
    } else if (targetType === 'ORGANIZATION') {
      // Assign to all members of an organization
      const members = await query(
        `SELECT user_id FROM organization_members WHERE organization_id = $1 AND status = 'active'`,
        [targetUserId]
      );
      
      for (const member of members) {
        await query(
          `INSERT INTO user_protocols (user_id, protocol_id, assigned_by) 
           VALUES ($1, $2, $3) 
           ON CONFLICT (user_id, protocol_id) DO NOTHING`,
          [member.user_id, protocolId, assignerId]
        );
      }
    }
    
    return json(res, { success: true }, 200, req);
  } catch (err: any) {
    return error(res, err.message, 500, req);
  }
}

async function assignProtocolToOrganization(userId: string, protocolId: string, req: VercelRequest, res: VercelResponse) {
  try {
    const { organization_id, assign_to_all_members = false } = req.body;
    
    if (!organization_id) return error(res, 'Organization ID required', 400, req);
    
    // Check permission
    const membership = await query(
      `SELECT role FROM organization_members 
       WHERE organization_id = $1 AND user_id = $2 AND status = 'active'`,
      [organization_id, userId]
    );
    
    const auth = getAuthFromRequest(req);
    const isGlobalAdmin = (auth?.permissions || []).includes('admin');
    const isOrgAdmin = membership.length > 0 && ['admin', 'manager'].includes(membership[0].role);
    
    if (!isGlobalAdmin && !isOrgAdmin) {
      return error(res, 'You do not have permission to assign protocols to this organization', 403, req);
    }
    
    // Create organization assignment
    await query(
      `INSERT INTO protocol_organization_assignments (protocol_id, organization_id, assigned_by)
       VALUES ($1, $2, $3)
       ON CONFLICT (protocol_id, organization_id) DO NOTHING`,
      [protocolId, organization_id, userId]
    );
    
    // Optionally assign to all members
    if (assign_to_all_members) {
      const members = await query(
        `SELECT user_id FROM organization_members WHERE organization_id = $1 AND status = 'active'`,
        [organization_id]
      );
      
      for (const member of members) {
        await query(
          `INSERT INTO user_protocols (user_id, protocol_id, assigned_by) 
           VALUES ($1, $2, $3) 
           ON CONFLICT (user_id, protocol_id) DO NOTHING`,
          [member.user_id, protocolId, userId]
        );
      }
    }
    
    return json(res, { success: true, message: 'Protocol assigned to organization' }, 200, req);
  } catch (err: any) {
    return error(res, err.message, 500, req);
  }
}

async function logProtocolElement(userId: string, protocolId: string, req: VercelRequest, res: VercelResponse) {
  try {
    const { element_id, completed, value, text_value, log_date } = req.body;
    
    if (!element_id) return error(res, 'Element ID required', 400, req);
    
    // Get element info for points
    const elements = await query(
      `SELECT * FROM protocol_elements WHERE id = $1 AND protocol_id = $2`,
      [element_id, protocolId]
    );
    
    if (elements.length === 0) {
      return error(res, 'Element not found in this protocol', 404, req);
    }
    
    // B-SEC-01: Rate limiting on submissions
    const recentLogs = await query(
      `SELECT COUNT(*) as count FROM protocol_element_logs 
       WHERE user_id = $1 AND logged_at > NOW() - INTERVAL '1 minute'`,
      [userId]
    );
    
    if (parseInt(recentLogs[0]?.count || '0') > 30) {
       return error(res, 'Rate limit exceeded. Please try again later.', 429, req);
    }
    
    const element = elements[0];
    
    // Calculate points earned
    let pointsEarned = 0;
    if (element.type === 'check' && completed) {
      pointsEarned = element.points || 10;
    } else if (element.type === 'number' || element.type === 'timer') {
      if (value >= (element.goal || 1)) {
        pointsEarned = element.points || 10;
      } else if (value > 0) {
        // Partial points
        pointsEarned = Math.floor((value / (element.goal || 1)) * (element.points || 10));
      }
    } else if (element.type === 'range') {
      // Range gives full points for any selection
      if (value !== null && value !== undefined) {
        pointsEarned = element.points || 10;
      }
    } else if (element.type === 'text') {
      // Text gives points if not empty
      if (text_value && text_value.trim().length > 0) {
        pointsEarned = element.points || 10;
      }
    }
    
    const dateToLog = log_date || new Date().toISOString().split('T')[0];
    
    const result = await query(
      `INSERT INTO protocol_element_logs 
         (element_id, user_id, completed, value, text_value, points_earned, log_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (element_id, user_id, log_date) DO UPDATE SET
         completed = EXCLUDED.completed,
         value = EXCLUDED.value,
         text_value = EXCLUDED.text_value,
         points_earned = EXCLUDED.points_earned,
         logged_at = NOW()
       RETURNING *`,
      [element_id, userId, completed || false, value, text_value, pointsEarned, dateToLog]
    );

    // B-CALC-01: Bonus for full protocol completion (50 points)
    const requiredElements = await query(
        `SELECT id, points FROM protocol_elements WHERE protocol_id = $1 AND is_required = true`,
        [protocolId]
    );
    
    if (requiredElements.length > 0) {
        // Check completion status of all required elements for today
        const completionStats = await query(
            `SELECT COUNT(DISTINCT element_id) as count, SUM(points_earned) as total_points
             FROM protocol_element_logs 
             WHERE user_id = $1 
               AND log_date = $2 
               AND points_earned > 0 -- Assuming earning points means completion/progress
               AND element_id IN (SELECT id FROM protocol_elements WHERE protocol_id = $3 AND is_required = true)`,
            [userId, dateToLog, protocolId]
        );
        
        const completedCount = parseInt(completionStats[0].count || '0');
        
        if (completedCount >= requiredElements.length) {
             // Calculate max base points to detect if bonus already applied
             const maxBasePoints = requiredElements.reduce((sum: number, el: any) => sum + (el.points || 10), 0);
             const currentTotal = parseInt(completionStats[0].total_points || '0');
             const BONUS_POINTS = 50;

             // Ensure we don't double award (if current total is close to max base, it likely lacks bonus)
             // This is heuristic but works without extra schema
             if (currentTotal <= maxBasePoints + (BONUS_POINTS / 2)) {
                 await query(
                   `UPDATE protocol_element_logs SET points_earned = points_earned + $1 WHERE id = $2`,
                   [BONUS_POINTS, result[0].id]
                 );
                 result[0].points_earned += BONUS_POINTS;
             }
        }
    }
    
    return json(res, {
      ...result[0],
      pointsEarned: result[0].points_earned
    }, 200, req);
  } catch (err: any) {
    return error(res, err.message, 500, req);
  }
}

async function getProtocolLeaderboard(userId: string, protocolId: string, req: VercelRequest, res: VercelResponse) {
  try {
    const { limit = 20, offset = 0, period = 'all' } = req.query;
    
    // Get user's privacy setting
    const userPrivacy = await query(
      `SELECT privacy_protocol_leaderboard FROM users WHERE id = $1`,
      [userId]
    );
    const myPrivacy = userPrivacy[0]?.privacy_protocol_leaderboard || 'visible';
    
    let dateFilter = '';
    if (period === 'daily') {
      dateFilter = `AND pel.log_date = CURRENT_DATE`;
    } else if (period === 'weekly') {
      dateFilter = `AND pel.log_date >= CURRENT_DATE - INTERVAL '7 days'`;
    } else if (period === 'monthly') {
      dateFilter = `AND pel.log_date >= CURRENT_DATE - INTERVAL '30 days'`;
    }
    
    // Get leaderboard with privacy
    const leaderboard = await query(
      `WITH ranked AS (
         SELECT 
           u.id as user_id,
           u.name,
           u.avatar_url,
           u.privacy_protocol_leaderboard as privacy,
           COALESCE(SUM(pel.points_earned), 0) as total_points,
           COUNT(DISTINCT pel.log_date) as active_days,
           ROW_NUMBER() OVER (ORDER BY COALESCE(SUM(pel.points_earned), 0) DESC) as rank
         FROM users u
         JOIN user_protocols up ON u.id = up.user_id
         LEFT JOIN protocol_elements pe ON pe.protocol_id = up.protocol_id
         LEFT JOIN protocol_element_logs pel ON pel.element_id = pe.id AND pel.user_id = u.id ${dateFilter}
         WHERE up.protocol_id = $1
         GROUP BY u.id, u.name, u.avatar_url, u.privacy_protocol_leaderboard
         ORDER BY total_points DESC
       )
       SELECT * FROM ranked
       WHERE privacy != 'hidden'
       LIMIT $2 OFFSET $3`,
      [protocolId, limit, offset]
    );
    
    // Transform based on privacy
    const transformedLeaderboard = leaderboard.map((entry: any) => ({
      rank: entry.rank,
      userId: entry.user_id,
      name: entry.privacy === 'anonymous' ? 'Anonymous' : entry.name,
      avatarUrl: entry.privacy === 'anonymous' ? null : entry.avatar_url,
      totalPoints: entry.total_points,
      activeDays: entry.active_days,
      isCurrentUser: entry.user_id === userId
    }));
    
    // Get current user's rank if they're hidden
    let myRank = null;
    if (myPrivacy === 'hidden') {
      const myRankResult = await query(
        `WITH ranked AS (
           SELECT 
             u.id as user_id,
             COALESCE(SUM(pel.points_earned), 0) as total_points,
             ROW_NUMBER() OVER (ORDER BY COALESCE(SUM(pel.points_earned), 0) DESC) as rank
           FROM users u
           JOIN user_protocols up ON u.id = up.user_id
           LEFT JOIN protocol_elements pe ON pe.protocol_id = up.protocol_id
           LEFT JOIN protocol_element_logs pel ON pel.element_id = pe.id AND pel.user_id = u.id ${dateFilter}
           WHERE up.protocol_id = $1
           GROUP BY u.id
         )
         SELECT * FROM ranked WHERE user_id = $2`,
        [protocolId, userId]
      );
      if (myRankResult.length > 0) {
        myRank = {
          rank: myRankResult[0].rank,
          totalPoints: myRankResult[0].total_points
        };
      }
    }
    
    return json(res, {
      leaderboard: transformedLeaderboard,
      myRank,
      myPrivacy
    }, 200, req);
  } catch (err: any) {
    return error(res, err.message, 500, req);
  }
}

async function getMyProtocolProgress(userId: string, protocolId: string, req: VercelRequest, res: VercelResponse) {
  try {
    const { date } = req.query;
    const targetDate = date || new Date().toISOString().split('T')[0];
    
    // Get protocol with elements
    const protocol = await query(`SELECT * FROM protocols WHERE id = $1`, [protocolId]);
    if (protocol.length === 0) return error(res, 'Protocol not found', 404, req);
    
    const elements = await query(
      `SELECT pe.*, 
              pel.completed, pel.value, pel.text_value, pel.points_earned
       FROM protocol_elements pe
       LEFT JOIN protocol_element_logs pel 
         ON pe.id = pel.element_id AND pel.user_id = $2 AND pel.log_date = $3
       WHERE pe.protocol_id = $1
       ORDER BY pe.display_order, pe.created_at`,
      [protocolId, userId, targetDate]
    );
    
    // Get user stats
    const stats = await query(
      `SELECT * FROM protocol_user_stats WHERE protocol_id = $1 AND user_id = $2`,
      [protocolId, userId]
    );
    
    // Calculate today's progress
    const totalRequired = elements.filter((e: any) => e.is_required).length;
    const completedToday = elements.filter((e: any) => {
      if (e.type === 'check') return e.completed;
      if (e.type === 'text') return e.text_value && e.text_value.trim().length > 0;
      return e.value !== null && e.value !== undefined;
    }).length;
    
    const todayPoints = elements.reduce((sum: number, e: any) => sum + (e.points_earned || 0), 0);
    
    return json(res, {
      protocol: {
        id: protocol[0].id,
        name: protocol[0].name,
        description: protocol[0].description,
        icon: protocol[0].icon
      },
      date: targetDate,
      elements: elements.map((e: any) => ({
        id: e.id,
        title: e.title,
        description: e.description,
        type: e.type,
        unit: e.unit,
        goal: e.goal,
        minValue: e.min_value,
        maxValue: e.max_value,
        points: e.points,
        frequency: e.frequency,
        isRequired: e.is_required,
        // Today's log
        completed: e.completed || false,
        value: e.value,
        textValue: e.text_value,
        pointsEarned: e.points_earned || 0
      })),
      todayProgress: {
        completed: completedToday,
        total: elements.length,
        required: totalRequired,
        pointsEarned: todayPoints,
        percentage: elements.length > 0 ? Math.round((completedToday / elements.length) * 100) : 0
      },
      stats: stats.length > 0 ? {
        totalPoints: stats[0].total_points,
        totalCompletions: stats[0].total_completions,
        currentStreak: stats[0].current_streak,
        longestStreak: stats[0].longest_streak,
        lastActivityDate: stats[0].last_activity_date
      } : null
    }, 200, req);
  } catch (err: any) {
    return error(res, err.message, 500, req);
  }
}

/**
 * Duplicate a protocol with all its elements
 * Resets leaderboards and user progress
 */
async function duplicateProtocol(userId: string, protocolId: string, req: VercelRequest, res: VercelResponse) {
  try {
    const { name, organization_id, status = 'draft' } = req.body;
    
    // Get original protocol
    const original = await query(`SELECT * FROM protocols WHERE id = $1`, [protocolId]);
    if (original.length === 0) return error(res, 'Protocol not found', 404, req);
    
    const protocol = original[0];
    
    // Check permission
    const auth = getAuthFromRequest(req);
    const isGlobalAdmin = (auth?.permissions || []).includes('admin');
    const isCreator = protocol.creator_id === userId;
    
    // For open protocols, anyone can duplicate (but not modify original)
    // For private protocols, need to be creator or admin
    if (!protocol.is_public && !isGlobalAdmin && !isCreator) {
      return error(res, 'You do not have permission to duplicate this protocol', 403, req);
    }
    
    // Create new protocol
    const newName = name || `${protocol.name} (Copy)`;
    const newOrgId = organization_id !== undefined ? organization_id : protocol.organization_id;
    
    const newProtocol = await query(
      `INSERT INTO protocols (name, description, creator_id, organization_id, icon, status, is_public)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [newName, protocol.description, userId, newOrgId, protocol.icon, status, false]
    );
    
    // Get original elements
    const elements = await query(
      `SELECT * FROM protocol_elements WHERE protocol_id = $1 ORDER BY display_order`,
      [protocolId]
    );
    
    // Duplicate elements
    for (const element of elements) {
      await query(
        `INSERT INTO protocol_elements 
         (protocol_id, title, description, type, unit, goal, min_value, max_value, points, frequency, display_order, is_required)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          newProtocol[0].id, element.title, element.description, element.type,
          element.unit, element.goal, element.min_value, element.max_value,
          element.points, element.frequency, element.display_order, element.is_required
        ]
      );
    }
    
    // Get the duplicated protocol with elements
    const duplicatedElements = await query(
      `SELECT * FROM protocol_elements WHERE protocol_id = $1 ORDER BY display_order`,
      [newProtocol[0].id]
    );
    
    return json(res, {
      ...newProtocol[0],
      creatorId: newProtocol[0].creator_id,
      organizationId: newProtocol[0].organization_id,
      createdAt: newProtocol[0].created_at,
      elements: duplicatedElements.map((e: any) => ({
        id: e.id,
        title: e.title,
        description: e.description,
        type: e.type,
        unit: e.unit,
        goal: e.goal,
        minValue: e.min_value,
        maxValue: e.max_value,
        points: e.points,
        frequency: e.frequency,
        displayOrder: e.display_order,
        isRequired: e.is_required
      })),
      originalProtocolId: protocolId
    }, 201, req);
  } catch (err: any) {
    return error(res, err.message, 500, req);
  }
}

/**
 * Change protocol status (draft, active, archived)
 */
async function changeProtocolStatus(userId: string, protocolId: string, newStatus: string, req: VercelRequest, res: VercelResponse) {
  try {
    const validStatuses = ['draft', 'active', 'archived'];
    if (!validStatuses.includes(newStatus)) {
      return error(res, `Invalid status. Must be one of: ${validStatuses.join(', ')}`, 400, req);
    }
    
    // Get protocol
    const protocol = await query(`SELECT * FROM protocols WHERE id = $1`, [protocolId]);
    if (protocol.length === 0) return error(res, 'Protocol not found', 404, req);
    
    // Check permission
    const auth = getAuthFromRequest(req);
    const isGlobalAdmin = (auth?.permissions || []).includes('admin');
    const isCreator = protocol[0].creator_id === userId;
    
    if (!isGlobalAdmin && !isCreator) {
      return error(res, 'You do not have permission to change this protocol\'s status', 403, req);
    }
    
    // Business rules for status changes
    const currentStatus = protocol[0].status;
    
    // Archived protocols cannot be reactivated (optional business rule)
    // Comment out to allow reactivation
    // if (currentStatus === 'archived' && newStatus === 'active') {
    //   return error(res, 'Archived protocols cannot be reactivated', 400, req);
    // }
    
    // Update status
    const result = await query(
      `UPDATE protocols SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [newStatus, protocolId]
    );
    
    return json(res, {
      ...result[0],
      previousStatus: currentStatus,
      message: `Protocol status changed from ${currentStatus} to ${newStatus}`
    }, 200, req);
  } catch (err: any) {
    return error(res, err.message, 500, req);
  }
}

/**
 * User joins an open/public protocol
 */
async function joinProtocol(userId: string, protocolId: string, req: VercelRequest, res: VercelResponse) {
  try {
    // Get protocol
    const protocol = await query(`SELECT * FROM protocols WHERE id = $1`, [protocolId]);
    if (protocol.length === 0) return error(res, 'Protocol not found', 404, req);
    
    // Check if protocol is active
    if (protocol[0].status !== 'active') {
      return error(res, 'Cannot join a protocol that is not active', 400, req);
    }
    
    // Check if protocol is public or user has org membership
    if (!protocol[0].is_public) {
      // Check if user is in the protocol's organization
      if (protocol[0].organization_id) {
        const membership = await query(
          `SELECT id FROM organization_members 
           WHERE organization_id = $1 AND user_id = $2 AND status = 'active'`,
          [protocol[0].organization_id, userId]
        );
        
        if (membership.length === 0) {
          return error(res, 'This protocol is not public. You need to be invited or be a member of the organization.', 403, req);
        }
      } else {
        // Protocol is private but has no org - need assignment
        return error(res, 'This protocol is not public. You need to be assigned.', 403, req);
      }
    }
    
    // Check if already joined
    const existing = await query(
      `SELECT id FROM user_protocols WHERE user_id = $1 AND protocol_id = $2`,
      [userId, protocolId]
    );
    
    if (existing.length > 0) {
      return json(res, { message: 'Already joined', alreadyJoined: true }, 200, req);
    }
    
    // Join the protocol
    await query(
      `INSERT INTO user_protocols (user_id, protocol_id, assigned_by)
       VALUES ($1, $2, $1)`, // User assigns themselves
      [userId, protocolId]
    );
    
    return json(res, { 
      success: true, 
      message: 'Successfully joined protocol',
      protocolId,
      protocolName: protocol[0].name
    }, 200, req);
  } catch (err: any) {
    return error(res, err.message, 500, req);
  }
}

/**
 * User leaves a protocol
 */
async function leaveProtocol(userId: string, protocolId: string, req: VercelRequest, res: VercelResponse) {
  try {
    // Check if user is in the protocol
    const existing = await query(
      `SELECT id FROM user_protocols WHERE user_id = $1 AND protocol_id = $2`,
      [userId, protocolId]
    );
    
    if (existing.length === 0) {
      return error(res, 'You are not a participant in this protocol', 400, req);
    }
    
    // Remove from protocol
    await query(
      `DELETE FROM user_protocols WHERE user_id = $1 AND protocol_id = $2`,
      [userId, protocolId]
    );
    
    return json(res, { 
      success: true, 
      message: 'Successfully left protocol'
    }, 200, req);
  } catch (err: any) {
    return error(res, err.message, 500, req);
  }
}

/**
 * Get protocol participants
 */
async function getProtocolParticipants(userId: string, protocolId: string, req: VercelRequest, res: VercelResponse) {
  try {
    const { limit = 50, offset = 0 } = req.query;
    
    const participants = await query(
      `SELECT u.id, u.name, u.avatar_url, u.privacy_protocol_leaderboard as privacy,
              up.created_at as joined_at,
              COALESCE(pus.total_points, 0) as total_points,
              COALESCE(pus.current_streak, 0) as current_streak
       FROM user_protocols up
       JOIN users u ON up.user_id = u.id
       LEFT JOIN protocol_user_stats pus ON pus.user_id = u.id AND pus.protocol_id = up.protocol_id
       WHERE up.protocol_id = $1
       ORDER BY pus.total_points DESC NULLS LAST
       LIMIT $2 OFFSET $3`,
      [protocolId, limit, offset]
    );
    
    // Transform based on privacy
    const transformedParticipants = participants.map((p: any) => ({
      userId: p.id,
      name: p.privacy === 'anonymous' ? 'Anonymous' : (p.privacy === 'hidden' ? null : p.name),
      avatarUrl: p.privacy === 'anonymous' || p.privacy === 'hidden' ? null : p.avatar_url,
      joinedAt: p.joined_at,
      totalPoints: p.total_points,
      currentStreak: p.current_streak,
      isCurrentUser: p.id === userId
    })).filter((p: any) => p.name !== null || p.isCurrentUser);
    
    // Get total count
    const countResult = await query(
      `SELECT COUNT(*) as count FROM user_protocols WHERE protocol_id = $1`,
      [protocolId]
    );
    
    return json(res, {
      participants: transformedParticipants,
      total: parseInt(countResult[0]?.count || '0')
    }, 200, req);
  } catch (err: any) {
    return error(res, err.message, 500, req);
  }
}
