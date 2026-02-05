import type { VercelRequest, VercelResponse } from '@vercel/node';
import { json, error, cors } from '../lib/response';
import { getAuthFromRequest } from '../lib/auth';
import { query } from '../lib/db';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

/**
 * Admin Management Handler
 * 
 * Provides super_admin and admin functionality:
 * - Promote/demote admins
 * - Reset user passwords
 * - Audit organization relationships
 * - Cross-organization analytics
 */

export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(res, req);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const auth = getAuthFromRequest(req);
  if (!auth) return error(res, 'Unauthorized', 401, req);

  const userId = auth.sub;
  const userRoles = auth.permissions || [];
  
  // Check for admin or super_admin role
  const isSuperAdmin = userRoles.includes('super_admin');
  const isAdmin = userRoles.includes('admin') || isSuperAdmin;

  if (!isAdmin) {
    return error(res, 'Forbidden. Admin access required.', 403, req);
  }

  const path = req.url?.split('?')[0] || '';
  const parts = path.split('/');
  // /api/admin/users/:id/promote -> ['', 'api', 'admin', 'users', ':id', 'promote']
  const resource = parts[3]; // 'users', 'stats', 'audit', etc.
  const resourceId = parts[4];
  const action = parts[5];

  // GET /api/admin/stats - Get platform statistics
  if (req.method === 'GET' && resource === 'stats') {
    return getStats(req, res, userId, isSuperAdmin);
  }

  // GET /api/admin/notifications - Get admin notifications
  if (req.method === 'GET' && resource === 'notifications') {
    return getAdminNotifications(req, res, userId, isSuperAdmin);
  }

  // POST /api/admin/notifications/mark-all-read - Mark all admin notifications as read
  if (req.method === 'POST' && resource === 'notifications' && resourceId === 'mark-all-read') {
    return markAllAdminNotificationsRead(req, res, userId);
  }

  // PATCH /api/admin/notifications/:id/read - Mark single notification as read
  if (req.method === 'PATCH' && resource === 'notifications' && resourceId && action === 'read') {
    return markAdminNotificationRead(req, res, userId, resourceId);
  }

  // GET /api/admin/audit - Get audit logs (super_admin only)
  if (req.method === 'GET' && resource === 'audit') {
    return getAuditLogs(req, res, userId, isSuperAdmin);
  }

  // GET /api/admin/organizations - Get all organizations with hierarchy
  if (req.method === 'GET' && resource === 'organizations') {
    return getOrganizationsWithHierarchy(req, res);
  }

  // GET /api/admin/users - List all users
  if (req.method === 'GET' && resource === 'users' && !resourceId) {
    return listAllUsers(req, res);
  }

  // User management endpoints
  if (resource === 'users' && resourceId) {
    // POST /api/admin/users/:id/promote - Promote user to admin
    if (req.method === 'POST' && action === 'promote') {
      return promoteUser(userId, resourceId, isSuperAdmin, req, res);
    }

    // POST /api/admin/users/:id/demote - Demote admin to user
    if (req.method === 'POST' && action === 'demote') {
      return demoteUser(userId, resourceId, isSuperAdmin, req, res);
    }

    // POST /api/admin/users/:id/reset-password - Reset user password
    if (req.method === 'POST' && action === 'reset-password') {
      return resetUserPassword(userId, resourceId, isSuperAdmin, req, res);
    }

    // POST /api/admin/users/:id/set-roles - Set specific roles (super_admin only)
    if (req.method === 'POST' && action === 'set-roles') {
      if (!isSuperAdmin) {
        return error(res, 'Super admin access required', 403, req);
      }
      return setUserRoles(userId, resourceId, req, res);
    }

    // GET /api/admin/users/:id/organizations - Get user's organization relationships
    if (req.method === 'GET' && action === 'organizations') {
      return getUserOrganizations(resourceId, req, res);
    }
  }

  return error(res, 'Not found', 404, req);
}

/**
 * List all users for admin dashboard
 */
async function listAllUsers(req: VercelRequest, res: VercelResponse) {
  try {
    const users = await query('SELECT id, email, name, roles, created_at FROM users ORDER BY created_at DESC');
    return json(res, { users }, 200, req);
  } catch (err: any) {
    return error(res, err.message, 500, req);
  }
}

/**
 * Log an admin action for auditing
 */
async function logAdminAction(
  adminId: string,
  action: string,
  targetType: string,
  targetId: string,
  previousState: any,
  newState: any,
  req: VercelRequest
) {
  try {
    const ipAddress = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';

    await query(
      `INSERT INTO admin_audit_logs 
       (admin_id, action, target_type, target_id, previous_state, new_state, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        adminId,
        action,
        targetType,
        targetId,
        JSON.stringify(previousState),
        JSON.stringify(newState),
        typeof ipAddress === 'string' ? ipAddress : ipAddress[0],
        userAgent
      ]
    );
  } catch (err) {
    console.error('Failed to log admin action:', err);
    // Don't fail the main operation if logging fails
  }
}

/**
 * Get platform statistics
 */
async function getStats(req: VercelRequest, res: VercelResponse, userId: string, isSuperAdmin: boolean) {
  try {
    let orgIds: string[] = [];
    let filterByOrg = false;

    if (!isSuperAdmin) {
       // Get organizations where user is admin
       const orgs = await query<{organization_id: string}>(
         "SELECT organization_id FROM organization_members WHERE user_id = $1 AND role = 'admin'",
         [userId]
       );
       orgIds = orgs.map((o: any) => o.organization_id);
       
       if (orgIds.length === 0) {
           return json(res, {
               totalUsers: 0,
               totalOrganizations: 0,
               activeChallenges: 0,
               activeUsersLast7Days: 0,
               organizationsByType: {},
               usersByRole: {}
           }, 200, req);
       }
       filterByOrg = true;
    }

    // Build Queries
    const queries = {
      users: filterByOrg 
        ? { text: "SELECT COUNT(DISTINCT user_id) as count FROM organization_members WHERE organization_id = ANY($1)", values: [orgIds] }
        : { text: "SELECT COUNT(*) as count FROM users", values: [] },
        
      orgs: filterByOrg
        ? { text: "SELECT COUNT(*) as count FROM organizations WHERE id = ANY($1)", values: [orgIds] }
        : { text: "SELECT COUNT(*) as count FROM organizations", values: [] },
        
      challenges: filterByOrg
        ? { text: "SELECT COUNT(*) as count FROM challenges WHERE status = 'active' AND organization_id = ANY($1)", values: [orgIds] }
        : { text: "SELECT COUNT(*) as count FROM challenges WHERE status = 'active'", values: [] },
        
      activeUsers: filterByOrg
        ? { text: `
            SELECT COUNT(DISTINCT cl.user_id) as count 
            FROM challenge_logs cl
            JOIN challenges c ON cl.challenge_id = c.id
            WHERE c.organization_id = ANY($1) 
            AND cl.logged_at > NOW() - INTERVAL '7 days'
          `, values: [orgIds] }
        : { text: `
            SELECT COUNT(DISTINCT user_id) as count 
            FROM challenge_logs 
            WHERE logged_at > NOW() - INTERVAL '7 days'
          `, values: [] }
    };

    const [
      usersResult,
      orgsResult,
      challengesResult,
      activeUsersResult
    ] = await Promise.all([
      query(queries.users.text, queries.users.values),
      query(queries.orgs.text, queries.orgs.values),
      query(queries.challenges.text, queries.challenges.values),
      query(queries.activeUsers.text, queries.activeUsers.values)
    ]);

    // Activity Data (last 7 days)
    const activityQuery = filterByOrg
      ? { text: `
          SELECT 
            to_char(cl.logged_at, 'Dy') as day,
            COUNT(*) as tasks,
            COUNT(DISTINCT cl.user_id) as users 
          FROM challenge_logs cl
          JOIN challenges c ON cl.challenge_id = c.id
          WHERE cl.logged_at > NOW() - INTERVAL '7 days'
          AND c.organization_id = ANY($1)
          GROUP BY to_char(cl.logged_at, 'Dy'), date(cl.logged_at)
          ORDER BY date(cl.logged_at)
        `, values: [orgIds] }
      : { text: `
          SELECT 
            to_char(logged_at, 'Dy') as day,
            COUNT(*) as tasks,
            COUNT(DISTINCT user_id) as users 
          FROM challenge_logs 
          WHERE logged_at > NOW() - INTERVAL '7 days'
          GROUP BY to_char(logged_at, 'Dy'), date(logged_at)
          ORDER BY date(logged_at)
        `, values: [] };
        
    const activityData = await query<{day: string, tasks: string, users: string}>(activityQuery.text, activityQuery.values);

    // Top Challenges (Active)
    const topChallengesQuery = filterByOrg
      ? { text: `
          SELECT c.title as name, COUNT(cp.user_id)::int as users, COALESCE(AVG(cp.progress), 0)::int as progress
          FROM challenges c
          LEFT JOIN challenge_participants cp ON c.id = cp.challenge_id
          WHERE c.status = 'active' AND c.organization_id = ANY($1)
          GROUP BY c.id, c.title
          ORDER BY users DESC
          LIMIT 4
        `, values: [orgIds] }
      : { text: `
          SELECT c.title as name, COUNT(cp.user_id)::int as users, COALESCE(AVG(cp.progress), 0)::int as progress
          FROM challenges c
          LEFT JOIN challenge_participants cp ON c.id = cp.challenge_id
          WHERE c.status = 'active'
          GROUP BY c.id, c.title
          ORDER BY users DESC
          LIMIT 4
        `, values: [] };

    const topChallengesData = await query<{name: string, users: number, progress: number}>(topChallengesQuery.text, topChallengesQuery.values);
    
    // Assign colors
    const colors = ['bg-blue-600', 'bg-emerald-600', 'bg-purple-600', 'bg-indigo-600'];
    const topChallenges = topChallengesData.map((c: any, i: number) => ({
        ...c,
        color: colors[i % colors.length]
    }));

    // Get organization breakdown by type
    const orgTypeQuery = filterByOrg
        ? { text: "SELECT type, COUNT(*) as count FROM organizations WHERE id = ANY($1) GROUP BY type", values: [orgIds] }
        : { text: "SELECT type, COUNT(*) as count FROM organizations GROUP BY type", values: [] };
        
    const orgTypeBreakdown = await query(orgTypeQuery.text, orgTypeQuery.values);

    // Get user role distribution
    const roleQuery = filterByOrg
        ? { text: "SELECT role, COUNT(*) as count FROM organization_members WHERE organization_id = ANY($1) GROUP BY role", values: [orgIds] }
        : { text: "SELECT unnest(roles) as role, COUNT(*) as count FROM users GROUP BY role", values: [] };

    const roleDistribution = await query(roleQuery.text, roleQuery.values);

    return json(res, {
      totalUsers: parseInt(usersResult[0]?.count || '0'),
      totalOrganizations: parseInt(orgsResult[0]?.count || '0'),
      activeChallenges: parseInt(challengesResult[0]?.count || '0'),
      activeUsersLast7Days: parseInt(activeUsersResult[0]?.count || '0'),
      organizationsByType: orgTypeBreakdown.reduce((acc: any, row: any) => {
        acc[row.type] = parseInt(row.count);
        return acc;
      }, {}),
      usersByRole: roleDistribution.reduce((acc: any, row: any) => {
        acc[row.role] = parseInt(row.count);
        return acc;
      }, {}),
      activityData: activityData.map((row: any) => ({
        day: row.day,
        tasks: parseInt(row.tasks),
        users: parseInt(row.users)
      })),
      topChallenges
    }, 200, req);
  } catch (err: any) {
    console.error('Get stats error:', err);
    return error(res, 'Failed to get statistics', 500, req);
  }
}

/**
 * Get audit logs (super_admin only)
 */
async function getAuditLogs(req: VercelRequest, res: VercelResponse, userId: string, isSuperAdmin: boolean) {
  try {
    const { limit = '50', offset = '0', action, targetType, adminId } = req.query;

    let orgIds: string[] = [];
    if (!isSuperAdmin) {
       const orgs = await query<{organization_id: string}>(
         "SELECT organization_id FROM organization_members WHERE user_id = $1 AND role = 'admin'",
         [userId]
       );
       orgIds = orgs.map((o: any) => o.organization_id);
       
       if (orgIds.length === 0) {
           return json(res, { logs: [], total: 0 }, 200, req);
       }
    }

    let sqlQuery = `
      SELECT a.*, u.name as admin_name, u.email as admin_email
      FROM admin_audit_logs a
      JOIN users u ON a.admin_id = u.id
    `;
    
    const params: any[] = [];
    const conditions: string[] = [];

    if (!isSuperAdmin) {
        // Complex filter for Org Admin
        // 1. Actions performed by this admin
        // 2. Actions on managed organizations
        // 3. Actions on users in managed organizations
        const orgsParamIdx = params.length + 1;
        const userParamIdx = params.length + 2;
        
        conditions.push(`(
          a.admin_id = $${userParamIdx} 
          OR 
          (a.target_type = 'organization' AND a.target_id = ANY($${orgsParamIdx}))
          OR
          (a.target_type = 'user' AND EXISTS (
            SELECT 1 FROM organization_members om 
            WHERE om.user_id::text = a.target_id AND om.organization_id = ANY($${orgsParamIdx})
          ))
        )`);
        params.push(orgIds);
        params.push(userId);
    }

    if (action) {
      conditions.push(`a.action = $${params.length + 1}`);
      params.push(action);
    }

    if (targetType) {
      conditions.push(`a.target_type = $${params.length + 1}`);
      params.push(targetType);
    }

    if (adminId) {
      conditions.push(`a.admin_id = $${params.length + 1}`);
      params.push(adminId);
    }

    if (conditions.length > 0) {
      sqlQuery += ' WHERE ' + conditions.join(' AND ');
    }

    sqlQuery += ` ORDER BY a.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(limit as string), parseInt(offset as string));

    const logs = await query(sqlQuery, params);

    // Also get total count for pagination (simplified, maybe skip for now to save perf)
    
    return json(res, { logs }, 200, req);
  } catch (err: any) {
    console.error('Get audit logs error:', err);
    return error(res, 'Failed to get audit logs', 500, req);
  }
}

/**
 * Get all organizations with their hierarchy
 */
async function getOrganizationsWithHierarchy(req: VercelRequest, res: VercelResponse) {
  try {
    const orgs = await query(`
      SELECT 
        o.*,
        p.name as parent_name,
        COUNT(DISTINCT om.user_id) as member_count,
        COUNT(DISTINCT c.id) as challenge_count
      FROM organizations o
      LEFT JOIN organizations p ON o.parent_id = p.id
      LEFT JOIN organization_members om ON o.id = om.organization_id AND om.status = 'active'
      LEFT JOIN challenges c ON o.id = c.organization_id
      GROUP BY o.id, p.name
      ORDER BY o.type, o.name
    `);

    // Build hierarchy tree
    const orgMap = new Map();
    const rootOrgs: any[] = [];

    // Parse counts as integers and build map
    orgs.forEach((org: any) => {
      org.member_count = parseInt(org.member_count || '0');
      org.challenge_count = parseInt(org.challenge_count || '0');
      orgMap.set(org.id, { ...org, children: [] });
    });

    orgs.forEach((org: any) => {
      const orgNode = orgMap.get(org.id);
      if (org.parent_id && orgMap.has(org.parent_id)) {
        orgMap.get(org.parent_id).children.push(orgNode);
      } else {
        rootOrgs.push(orgNode);
      }
    });

    return json(res, { 
      organizations: orgs,
      hierarchy: rootOrgs
    }, 200, req);
  } catch (err: any) {
    console.error('Get organizations error:', err);
    return error(res, 'Failed to get organizations', 500, req);
  }
}

/**
 * Promote a user to admin
 */
async function promoteUser(
  adminId: string, 
  targetUserId: string, 
  isSuperAdmin: boolean,
  req: VercelRequest, 
  res: VercelResponse
) {
  try {
    const { role = 'admin' } = req.body;

    // Validate role
    const allowedRoles = ['admin', 'manager', 'coach', 'protocol_manager'];
    if (!allowedRoles.includes(role)) {
      return error(res, `Invalid role. Allowed: ${allowedRoles.join(', ')}`, 400, req);
    }

    // super_admin can only be assigned by super_admin
    if (role === 'super_admin' && !isSuperAdmin) {
      return error(res, 'Only super admins can promote to super_admin', 403, req);
    }

    // Get current user data
    const users = await query(
      'SELECT id, email, name, roles FROM users WHERE id = $1',
      [targetUserId]
    );

    if (users.length === 0) {
      return error(res, 'User not found', 404, req);
    }

    const user = users[0];
    const currentRoles = user.roles || ['user'];

    // Check if already has role
    if (currentRoles.includes(role)) {
      return error(res, `User already has the ${role} role`, 400, req);
    }

    // Add role
    const newRoles = [...currentRoles, role];

    await query(
      'UPDATE users SET roles = $1, updated_at = NOW() WHERE id = $2',
      [newRoles, targetUserId]
    );

    // Log the action
    await logAdminAction(
      adminId,
      'promote_user',
      'user',
      targetUserId,
      { roles: currentRoles },
      { roles: newRoles, addedRole: role },
      req
    );

    return json(res, {
      success: true,
      message: `User promoted to ${role}`,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        roles: newRoles
      }
    }, 200, req);
  } catch (err: any) {
    console.error('Promote user error:', err);
    return error(res, 'Failed to promote user', 500, req);
  }
}

/**
 * Demote an admin
 */
async function demoteUser(
  adminId: string, 
  targetUserId: string, 
  isSuperAdmin: boolean,
  req: VercelRequest, 
  res: VercelResponse
) {
  try {
    const { role = 'admin' } = req.body;

    // Prevent self-demotion
    if (adminId === targetUserId) {
      return error(res, 'You cannot demote yourself', 400, req);
    }

    // Get current user data
    const users = await query(
      'SELECT id, email, name, roles FROM users WHERE id = $1',
      [targetUserId]
    );

    if (users.length === 0) {
      return error(res, 'User not found', 404, req);
    }

    const user = users[0];
    const currentRoles = user.roles || ['user'];

    // Check if has role
    if (!currentRoles.includes(role)) {
      return error(res, `User does not have the ${role} role`, 400, req);
    }

    // super_admin can only be demoted by super_admin
    if (role === 'super_admin' && !isSuperAdmin) {
      return error(res, 'Only super admins can demote super_admin', 403, req);
    }

    // Remove role, ensure 'user' remains
    let newRoles = currentRoles.filter((r: string) => r !== role);
    if (newRoles.length === 0) {
      newRoles = ['user'];
    }

    await query(
      'UPDATE users SET roles = $1, updated_at = NOW() WHERE id = $2',
      [newRoles, targetUserId]
    );

    // Log the action
    await logAdminAction(
      adminId,
      'demote_user',
      'user',
      targetUserId,
      { roles: currentRoles },
      { roles: newRoles, removedRole: role },
      req
    );

    return json(res, {
      success: true,
      message: `${role} role removed from user`,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        roles: newRoles
      }
    }, 200, req);
  } catch (err: any) {
    console.error('Demote user error:', err);
    return error(res, 'Failed to demote user', 500, req);
  }
}

/**
 * Reset user password (generates a new random password)
 */
async function resetUserPassword(
  adminId: string, 
  targetUserId: string, 
  isSuperAdmin: boolean,
  req: VercelRequest, 
  res: VercelResponse
) {
  try {
    const { newPassword, sendEmail = true } = req.body;

    // Get target user
    const users = await query(
      'SELECT id, email, name, roles FROM users WHERE id = $1',
      [targetUserId]
    );

    if (users.length === 0) {
      return error(res, 'User not found', 404, req);
    }

    const user = users[0];

    // Only super_admin can reset other admin's passwords
    const targetIsAdmin = user.roles?.includes('admin') || user.roles?.includes('super_admin');
    if (targetIsAdmin && !isSuperAdmin) {
      return error(res, 'Only super admins can reset admin passwords', 403, req);
    }

    // Generate or use provided password
    const password = newPassword || crypto.randomBytes(12).toString('base64').slice(0, 16);
    const passwordHash = await bcrypt.hash(password, 10);

    await query(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
      [passwordHash, targetUserId]
    );

    // Log the action (don't log the actual password)
    await logAdminAction(
      adminId,
      'reset_password',
      'user',
      targetUserId,
      { passwordReset: false },
      { passwordReset: true, emailSent: sendEmail },
      req
    );

    // TODO: Send email with new password if sendEmail is true
    // For now, we return the password in the response (only in dev/staging)

    return json(res, {
      success: true,
      message: 'Password reset successfully',
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      },
      // Only include temporary password in response for development
      // In production, this should be sent via email
      temporaryPassword: password,
      note: 'User should change this password immediately after login'
    }, 200, req);
  } catch (err: any) {
    console.error('Reset password error:', err);
    return error(res, 'Failed to reset password', 500, req);
  }
}

/**
 * Set specific roles for a user (super_admin only)
 */
async function setUserRoles(
  adminId: string, 
  targetUserId: string, 
  req: VercelRequest, 
  res: VercelResponse
) {
  try {
    const { roles } = req.body;

    if (!Array.isArray(roles) || roles.length === 0) {
      return error(res, 'Roles must be a non-empty array', 400, req);
    }

    // Validate all roles
    const validRoles = ['user', 'admin', 'super_admin', 'manager', 'coach', 'protocol_manager', 'retreat_manager'];
    const invalidRoles = roles.filter((r: string) => !validRoles.includes(r));
    if (invalidRoles.length > 0) {
      return error(res, `Invalid roles: ${invalidRoles.join(', ')}`, 400, req);
    }

    // Get current user data
    const users = await query(
      'SELECT id, email, name, roles FROM users WHERE id = $1',
      [targetUserId]
    );

    if (users.length === 0) {
      return error(res, 'User not found', 404, req);
    }

    const user = users[0];
    const currentRoles = user.roles || ['user'];

    await query(
      'UPDATE users SET roles = $1, updated_at = NOW() WHERE id = $2',
      [roles, targetUserId]
    );

    // Log the action
    await logAdminAction(
      adminId,
      'set_roles',
      'user',
      targetUserId,
      { roles: currentRoles },
      { roles },
      req
    );

    return json(res, {
      success: true,
      message: 'User roles updated',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        roles
      }
    }, 200, req);
  } catch (err: any) {
    console.error('Set roles error:', err);
    return error(res, 'Failed to set roles', 500, req);
  }
}

/**
 * Get user's organization relationships
 */
async function getUserOrganizations(targetUserId: string, req: VercelRequest, res: VercelResponse) {
  try {
    const memberships = await query(`
      SELECT 
        om.*,
        o.name as organization_name,
        o.type as organization_type,
        o.logo_url
      FROM organization_members om
      JOIN organizations o ON om.organization_id = o.id
      WHERE om.user_id = $1
      ORDER BY om.joined_at DESC
    `, [targetUserId]);

    return json(res, { memberships }, 200, req);
  } catch (err: any) {
    console.error('Get user organizations error:', err);
    return error(res, 'Failed to get user organizations', 500, req);
  }
}

/**
 * Get admin notifications
 * Returns recent platform activity as notifications for admins
 */
async function getAdminNotifications(req: VercelRequest, res: VercelResponse, userId: string, isSuperAdmin: boolean) {
  try {
    const { limit = '20' } = req.query;
    const limitNum = Math.min(parseInt(limit as string) || 20, 50);

    // Get recent user registrations (last 7 days)
    const newUsersQuery = await query(`
      SELECT id, name, email, created_at 
      FROM users 
      WHERE created_at > NOW() - INTERVAL '7 days'
      ORDER BY created_at DESC
      LIMIT 10
    `);

    // Get recent challenge completions
    const challengeCompletionsQuery = await query(`
      SELECT 
        c.title as challenge_title,
        COUNT(DISTINCT cp.user_id) as completion_count,
        MAX(cl.logged_at) as last_completion
      FROM challenges c
      JOIN challenge_participants cp ON c.id = cp.challenge_id
      JOIN challenge_logs cl ON cp.challenge_id = cl.challenge_id AND cp.user_id = cl.user_id
      WHERE cp.progress >= 100 
        AND cl.logged_at > NOW() - INTERVAL '7 days'
      GROUP BY c.id, c.title
      ORDER BY last_completion DESC
      LIMIT 5
    `);

    // Get recent protocol updates
    const protocolUpdatesQuery = await query(`
      SELECT id, name as title, updated_at
      FROM protocols
      WHERE updated_at > NOW() - INTERVAL '7 days'
        AND updated_at != created_at
      ORDER BY updated_at DESC
      LIMIT 5
    `);

    // Build notifications array
    const notifications: any[] = [];
    let notifId = 1;

    // Add new user notifications
    for (const user of newUsersQuery) {
      const timeDiff = Date.now() - new Date(user.created_at).getTime();
      const hours = Math.floor(timeDiff / (1000 * 60 * 60));
      const timeStr = hours < 1 ? 'just now' : hours < 24 ? `${hours}h` : `${Math.floor(hours / 24)}d`;
      
      notifications.push({
        id: `new-user-${notifId++}`,
        type: 'user_registered',
        title: 'New user registered',
        description: `${user.name || user.email} joined the platform`,
        time: timeStr,
        unread: hours < 24,
        created_at: user.created_at,
        data: { userId: user.id, email: user.email }
      });
    }

    // Add challenge completion notifications
    for (const completion of challengeCompletionsQuery) {
      const timeDiff = Date.now() - new Date(completion.last_completion).getTime();
      const hours = Math.floor(timeDiff / (1000 * 60 * 60));
      const timeStr = hours < 1 ? 'just now' : hours < 24 ? `${hours}h` : `${Math.floor(hours / 24)}d`;
      
      notifications.push({
        id: `challenge-complete-${notifId++}`,
        type: 'challenge_milestone',
        title: 'Protocol completed',
        description: `${completion.completion_count} users completed "${completion.challenge_title}"`,
        time: timeStr,
        unread: hours < 12,
        created_at: completion.last_completion,
        data: { challengeTitle: completion.challenge_title, count: completion.completion_count }
      });
    }

    // Add protocol update notifications
    for (const protocol of protocolUpdatesQuery) {
      const timeDiff = Date.now() - new Date(protocol.updated_at).getTime();
      const hours = Math.floor(timeDiff / (1000 * 60 * 60));
      const timeStr = hours < 1 ? 'just now' : hours < 24 ? `${hours}h` : `${Math.floor(hours / 24)}d`;
      
      notifications.push({
        id: `protocol-update-${notifId++}`,
        type: 'system',
        title: 'Protocol updated',
        description: `"${protocol.title}" has been updated`,
        time: timeStr,
        unread: hours < 6,
        created_at: protocol.updated_at,
        data: { protocolId: protocol.id, title: protocol.title }
      });
    }

    // Sort by created_at and limit
    notifications.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    const limitedNotifications = notifications.slice(0, limitNum);

    const unreadCount = limitedNotifications.filter(n => n.unread).length;

    return json(res, {
      notifications: limitedNotifications,
      unreadCount
    }, 200, req);
  } catch (err: any) {
    console.error('Get admin notifications error:', err);
    return error(res, 'Failed to get admin notifications', 500, req);
  }
}

/**
 * Mark all admin notifications as read
 * For admin notifications, we track read state in localStorage on frontend
 * This endpoint is a placeholder for potential future database-backed read tracking
 */
async function markAllAdminNotificationsRead(req: VercelRequest, res: VercelResponse, userId: string) {
  return json(res, { success: true, message: 'All notifications marked as read' }, 200, req);
}

/**
 * Mark a single admin notification as read
 */
async function markAdminNotificationRead(req: VercelRequest, res: VercelResponse, userId: string, notificationId: string) {
  return json(res, { success: true, notificationId }, 200, req);
}
