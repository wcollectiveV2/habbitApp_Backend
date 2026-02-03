import type { VercelRequest, VercelResponse } from '@vercel/node';
import { json, error, cors } from '../lib/response';
import { getAuthFromRequest } from '../lib/auth';
import { query } from '../lib/db';
import crypto from 'crypto';

// Default expiration times in days
const PRODUCT_ORG_EXPIRY_DAYS = 7;
const COMPANY_ORG_EXPIRY_DAYS = 30;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(res, req);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const path = req.url?.split('?')[0] || '';
  const parts = path.split('/');
  
  // Public endpoint: GET /api/invitations/:token (accept invitation)
  // This can be accessed without auth for new user registration
  if (req.method === 'GET' && parts.length >= 4 && parts[2] === 'invitations') {
    const token = parts[3];
    if (token && token !== 'validate') {
      return getInvitationByToken(token, req, res);
    }
  }

  // POST /api/invitations/accept - Accept an invitation (can be public for registration)
  if (req.method === 'POST' && path.endsWith('/accept')) {
    return acceptInvitation(req, res);
  }

  // All other endpoints require authentication
  const auth = getAuthFromRequest(req);
  if (!auth) return error(res, 'Unauthorized', 401, req);
  const userId = auth.sub;

  // POST /api/invitations - Create invitation link
  if (req.method === 'POST' && !path.includes('/accept')) {
    return createInvitation(userId, req, res);
  }

  // GET /api/invitations - List invitations for an organization
  if (req.method === 'GET') {
    return listInvitations(userId, req, res);
  }

  // DELETE /api/invitations/:id - Revoke invitation
  if (req.method === 'DELETE' && parts.length >= 4) {
    const invitationId = parts[3];
    return revokeInvitation(userId, invitationId, req, res);
  }

  return error(res, 'Not found', 404, req);
}

/**
 * Generate a secure random token
 */
function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Create a new invitation link
 */
async function createInvitation(userId: string, req: VercelRequest, res: VercelResponse) {
  try {
    const { 
      organizationId, 
      email,           // Optional: specific email 
      role = 'member', 
      maxUses = 1,     // Default: single use
      expiresInDays,   // Optional: override default expiry
      redirectUrl,     // Optional: where to redirect after acceptance
      metadata = {}    // Optional: additional data
    } = req.body;

    if (!organizationId) {
      return error(res, 'organizationId is required', 400, req);
    }

    // Check if user has permission to create invitations for this org
    const membership = await query(
      `SELECT role FROM organization_members 
       WHERE organization_id = $1 AND user_id = $2 AND status = 'active'`,
      [organizationId, userId]
    );
    
    const auth = getAuthFromRequest(req);
    const isSuperAdmin = (auth?.permissions || []).includes('super_admin');
    const isGlobalAdmin = (auth?.permissions || []).includes('admin') || isSuperAdmin;
    const isOrgAdmin = membership.length > 0 && ['admin', 'manager'].includes(membership[0].role);

    if (!isGlobalAdmin && !isOrgAdmin) {
      return error(res, 'You do not have permission to create invitations for this organization', 403, req);
    }

    // Get organization type to determine default expiry
    const orgResult = await query(
      'SELECT id, name, type FROM organizations WHERE id = $1',
      [organizationId]
    );
    
    if (orgResult.length === 0) {
      return error(res, 'Organization not found', 404, req);
    }

    const org = orgResult[0];
    
    // Calculate expiration based on org type
    const defaultExpiryDays = org.type === 'product' 
      ? PRODUCT_ORG_EXPIRY_DAYS 
      : COMPANY_ORG_EXPIRY_DAYS;
    
    const expiryDays = expiresInDays || defaultExpiryDays;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiryDays);

    // Generate unique token
    const token = generateToken();

    // Create invitation record
    const result = await query(
      `INSERT INTO organization_invitations 
       (organization_id, token, created_by, email, role, expires_at, max_uses, redirect_url, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        organizationId, 
        token, 
        userId, 
        email || null, 
        role, 
        expiresAt, 
        maxUses,
        redirectUrl || null,
        JSON.stringify(metadata)
      ]
    );

    const invitation = result[0];

    // Construct the invitation URL
    const baseUrl = process.env.APP_URL || 'https://habitpulse.app';
    const invitationUrl = `${baseUrl}/invite?token=${token}`;

    return json(res, {
      invitation: {
        id: invitation.id,
        token: invitation.token,
        organizationId: invitation.organization_id,
        organizationName: org.name,
        organizationType: org.type,
        role: invitation.role,
        email: invitation.email,
        expiresAt: invitation.expires_at,
        maxUses: invitation.max_uses,
        currentUses: invitation.current_uses,
        status: invitation.status,
        invitationUrl
      }
    }, 201, req);
  } catch (err: any) {
    console.error('Create invitation error:', err);
    return error(res, err.message || 'Failed to create invitation', 500, req);
  }
}

/**
 * Get invitation details by token (public endpoint)
 */
async function getInvitationByToken(token: string, req: VercelRequest, res: VercelResponse) {
  try {
    // First, expire any old invitations
    await query(`
      UPDATE organization_invitations 
      SET status = 'expired', updated_at = NOW()
      WHERE status = 'active' AND expires_at < NOW()
    `);

    const result = await query(
      `SELECT i.*, o.name as organization_name, o.type as organization_type, o.logo_url,
              u.name as inviter_name
       FROM organization_invitations i
       JOIN organizations o ON i.organization_id = o.id
       JOIN users u ON i.created_by = u.id
       WHERE i.token = $1`,
      [token]
    );

    if (result.length === 0) {
      return error(res, 'Invitation not found', 404, req);
    }

    const invitation = result[0];

    // Check if invitation is still valid
    if (invitation.status !== 'active') {
      return error(res, `Invitation is ${invitation.status}`, 400, req);
    }

    if (invitation.current_uses >= invitation.max_uses) {
      return error(res, 'Invitation has reached maximum uses', 400, req);
    }

    if (new Date(invitation.expires_at) < new Date()) {
      return error(res, 'Invitation has expired', 400, req);
    }

    // Determine redirect behavior based on org type
    let redirectBehavior = 'app'; // Default: redirect to app
    if (invitation.organization_type === 'company') {
      redirectBehavior = 'admin'; // Company orgs redirect to admin panel
    }

    return json(res, {
      valid: true,
      invitation: {
        id: invitation.id,
        organizationId: invitation.organization_id,
        organizationName: invitation.organization_name,
        organizationType: invitation.organization_type,
        organizationLogo: invitation.logo_url,
        role: invitation.role,
        email: invitation.email,
        expiresAt: invitation.expires_at,
        inviterName: invitation.inviter_name,
        redirectBehavior,
        redirectUrl: invitation.redirect_url,
        metadata: invitation.metadata
      }
    }, 200, req);
  } catch (err: any) {
    console.error('Get invitation error:', err);
    return error(res, err.message || 'Failed to get invitation', 500, req);
  }
}

/**
 * Accept an invitation
 */
async function acceptInvitation(req: VercelRequest, res: VercelResponse) {
  try {
    const { token, userId, email, name, password } = req.body;

    if (!token) {
      return error(res, 'Invitation token is required', 400, req);
    }

    // Get invitation
    const invResult = await query(
      `SELECT i.*, o.name as organization_name, o.type as organization_type
       FROM organization_invitations i
       JOIN organizations o ON i.organization_id = o.id
       WHERE i.token = $1 AND i.status = 'active'`,
      [token]
    );

    if (invResult.length === 0) {
      return error(res, 'Invalid or expired invitation', 400, req);
    }

    const invitation = invResult[0];

    // Validate invitation
    if (invitation.current_uses >= invitation.max_uses) {
      return error(res, 'Invitation has reached maximum uses', 400, req);
    }

    if (new Date(invitation.expires_at) < new Date()) {
      // Mark as expired
      await query(
        `UPDATE organization_invitations SET status = 'expired', updated_at = NOW() WHERE id = $1`,
        [invitation.id]
      );
      return error(res, 'Invitation has expired', 400, req);
    }

    // If invitation is for specific email, validate it
    if (invitation.email && email && invitation.email.toLowerCase() !== email.toLowerCase()) {
      return error(res, 'This invitation is for a different email address', 400, req);
    }

    let targetUserId = userId;
    let isNewUser = false;

    // If no userId provided, check if this is a new user registration
    if (!targetUserId) {
      if (!email || !name) {
        return error(res, 'Email and name are required for new users', 400, req);
      }

      // Check if user already exists
      const existingUser = await query('SELECT id FROM users WHERE email = $1', [email]);
      
      if (existingUser.length > 0) {
        targetUserId = existingUser[0].id;
      } else {
        // Create new user (for product org invitations)
        if (!password) {
          return error(res, 'Password is required for new user registration', 400, req);
        }

        const bcrypt = require('bcryptjs');
        const passwordHash = await bcrypt.hash(password, 10);

        const newUser = await query(
          `INSERT INTO users (email, password_hash, name, primary_organization_id)
           VALUES ($1, $2, $3, $4) RETURNING id`,
          [email, passwordHash, name, invitation.organization_id]
        );
        targetUserId = newUser[0].id;
        isNewUser = true;
      }
    }

    // Add user to organization
    await query(
      `INSERT INTO organization_members (organization_id, user_id, role, status)
       VALUES ($1, $2, $3, 'active')
       ON CONFLICT (organization_id, user_id) 
       DO UPDATE SET role = EXCLUDED.role, status = 'active', joined_at = NOW()`,
      [invitation.organization_id, targetUserId, invitation.role]
    );

    // Increment usage count
    await query(
      `UPDATE organization_invitations 
       SET current_uses = current_uses + 1, updated_at = NOW()
       WHERE id = $1`,
      [invitation.id]
    );

    // Check if invitation is exhausted
    if (invitation.current_uses + 1 >= invitation.max_uses) {
      await query(
        `UPDATE organization_invitations SET status = 'exhausted', updated_at = NOW() WHERE id = $1`,
        [invitation.id]
      );
    }

    // Determine redirect URL based on org type
    let redirectUrl = invitation.redirect_url;
    if (!redirectUrl) {
      if (invitation.organization_type === 'product') {
        redirectUrl = process.env.APP_URL || 'https://habitpulse.app';
      } else {
        redirectUrl = process.env.ADMIN_URL || 'https://admin.habitpulse.app';
      }
    }

    // Handle any pending challenge invites in metadata
    if (invitation.metadata?.challengeId) {
      await query(
        `INSERT INTO challenge_participants (challenge_id, user_id) 
         VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [invitation.metadata.challengeId, targetUserId]
      );
    }

    return json(res, {
      success: true,
      isNewUser,
      userId: targetUserId,
      organizationId: invitation.organization_id,
      organizationName: invitation.organization_name,
      organizationType: invitation.organization_type,
      role: invitation.role,
      redirectUrl
    }, 200, req);
  } catch (err: any) {
    console.error('Accept invitation error:', err);
    return error(res, err.message || 'Failed to accept invitation', 500, req);
  }
}

/**
 * List invitations for organizations the user manages
 */
async function listInvitations(userId: string, req: VercelRequest, res: VercelResponse) {
  try {
    const { organizationId, status } = req.query;
    
    const auth = getAuthFromRequest(req);
    const isSuperAdmin = (auth?.permissions || []).includes('super_admin');
    const isGlobalAdmin = (auth?.permissions || []).includes('admin') || isSuperAdmin;

    let sqlQuery = `
      SELECT i.*, o.name as organization_name, o.type as organization_type,
             u.name as created_by_name, u.email as created_by_email
      FROM organization_invitations i
      JOIN organizations o ON i.organization_id = o.id
      JOIN users u ON i.created_by = u.id
    `;
    
    const params: any[] = [];
    const conditions: string[] = [];

    if (!isGlobalAdmin) {
      // Only show invitations for orgs the user manages
      conditions.push(`
        i.organization_id IN (
          SELECT organization_id FROM organization_members 
          WHERE user_id = $${params.length + 1} AND role IN ('admin', 'manager') AND status = 'active'
        )
      `);
      params.push(userId);
    }

    if (organizationId) {
      conditions.push(`i.organization_id = $${params.length + 1}`);
      params.push(organizationId);
    }

    if (status) {
      conditions.push(`i.status = $${params.length + 1}`);
      params.push(status);
    }

    if (conditions.length > 0) {
      sqlQuery += ' WHERE ' + conditions.join(' AND ');
    }

    sqlQuery += ' ORDER BY i.created_at DESC';

    const result = await query(sqlQuery, params);

    // Generate URLs for each invitation
    const baseUrl = process.env.APP_URL || 'https://habitpulse.app';
    const invitations = result.map((inv: any) => ({
      ...inv,
      invitationUrl: `${baseUrl}/invite?token=${inv.token}`
    }));

    return json(res, { invitations }, 200, req);
  } catch (err: any) {
    console.error('List invitations error:', err);
    return error(res, err.message || 'Failed to list invitations', 500, req);
  }
}

/**
 * Revoke an invitation
 */
async function revokeInvitation(userId: string, invitationId: string, req: VercelRequest, res: VercelResponse) {
  try {
    // Get invitation and check permissions
    const invResult = await query(
      `SELECT i.*, o.name as organization_name
       FROM organization_invitations i
       JOIN organizations o ON i.organization_id = o.id
       WHERE i.id = $1`,
      [invitationId]
    );

    if (invResult.length === 0) {
      return error(res, 'Invitation not found', 404, req);
    }

    const invitation = invResult[0];

    // Check permissions
    const auth = getAuthFromRequest(req);
    const isSuperAdmin = (auth?.permissions || []).includes('super_admin');
    const isGlobalAdmin = (auth?.permissions || []).includes('admin') || isSuperAdmin;

    if (!isGlobalAdmin) {
      const membership = await query(
        `SELECT role FROM organization_members 
         WHERE organization_id = $1 AND user_id = $2 AND status = 'active'`,
        [invitation.organization_id, userId]
      );

      if (membership.length === 0 || !['admin', 'manager'].includes(membership[0].role)) {
        return error(res, 'You do not have permission to revoke this invitation', 403, req);
      }
    }

    // Revoke the invitation
    await query(
      `UPDATE organization_invitations SET status = 'revoked', updated_at = NOW() WHERE id = $1`,
      [invitationId]
    );

    return json(res, { 
      success: true, 
      message: 'Invitation revoked successfully' 
    }, 200, req);
  } catch (err: any) {
    console.error('Revoke invitation error:', err);
    return error(res, err.message || 'Failed to revoke invitation', 500, req);
  }
}
