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
    return getStats(req, res);
  }

  // GET /api/admin/audit - Get audit logs (super_admin only)
  if (req.method === 'GET' && resource === 'audit') {
    if (!isSuperAdmin) {
      return error(res, 'Super admin access required', 403, req);
    }
    return getAuditLogs(req, res);
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
async function getStats(req: VercelRequest, res: VercelResponse) {
  try {
    const [
      usersResult,
      orgsResult,
      challengesResult,
      activeUsersResult
    ] = await Promise.all([
      query('SELECT COUNT(*) as count FROM users'),
      query('SELECT COUNT(*) as count FROM organizations'),
      query("SELECT COUNT(*) as count FROM challenges WHERE status = 'active'"),
      query(`
        SELECT COUNT(DISTINCT user_id) as count 
        FROM challenge_logs 
        WHERE logged_at > NOW() - INTERVAL '7 days'
      `)
    ]);

    // Get organization breakdown by type
    const orgTypeBreakdown = await query(`
      SELECT type, COUNT(*) as count 
      FROM organizations 
      GROUP BY type
    `);

    // Get user role distribution
    const roleDistribution = await query(`
      SELECT unnest(roles) as role, COUNT(*) as count 
      FROM users 
      GROUP BY role
    `);

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
      }, {})
    }, 200, req);
  } catch (err: any) {
    console.error('Get stats error:', err);
    return error(res, 'Failed to get statistics', 500, req);
  }
}

/**
 * Get audit logs (super_admin only)
 */
async function getAuditLogs(req: VercelRequest, res: VercelResponse) {
  try {
    const { limit = '50', offset = '0', action, targetType, adminId } = req.query;

    let sqlQuery = `
      SELECT a.*, u.name as admin_name, u.email as admin_email
      FROM admin_audit_logs a
      JOIN users u ON a.admin_id = u.id
    `;
    
    const params: any[] = [];
    const conditions: string[] = [];

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

    orgs.forEach((org: any) => {
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
