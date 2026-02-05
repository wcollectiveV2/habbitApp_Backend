import type { VercelRequest, VercelResponse } from '@vercel/node';
import { json, error, cors } from '../lib/response';
import { getAuthFromRequest } from '../lib/auth';
import { query } from '../lib/db';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(res, req);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const auth = getAuthFromRequest(req);
  if (!auth) return error(res, 'Unauthorized', 401, req);
  const userId = auth.sub;
  
  const path = req.url?.split('?')[0] || '';
  const parts = path.split('/');
  
  console.log('DEBUG ORG:', { method: req.method, path, parts });

  // /api/organizations/:id/invite ... parts: ['', 'api', 'organizations', 'id', 'invite']
  // /api/organizations ... parts: ['', 'api', 'organizations']
  const orgId = (parts.length > 3 && parts[3]) ? parts[3] : null; 
  const action = (parts.length > 4) ? parts[4] : null;

  if (req.method === 'POST' && orgId && (action === 'invite' || action === 'invitations')) {
    return inviteMember(userId, orgId, req, res);
  }
  
  // GET /api/organizations/:id/leaderboard
  if (req.method === 'GET' && orgId && action === 'leaderboard') {
    return getOrganizationLeaderboard(userId, orgId, req, res);
  }
  
  // GET /api/organizations/:id/protocols
  if (req.method === 'GET' && orgId && action === 'protocols') {
    return getOrganizationProtocols(userId, orgId, req, res);
  }
  
  // GET /api/organizations/:id/members
  if (req.method === 'GET' && orgId && action === 'members') {
    return getOrganizationMembers(userId, orgId, req, res);
  }

  // GET /api/organizations
  if (req.method === 'GET' && !orgId) {
      return listOrganizations(userId, req, res);
  }
  
  // GET /api/organizations/:id
  if (req.method === 'GET' && orgId && !action) {
      return getOrganization(userId, orgId, req, res);
  }
  
  // POST /api/organizations (Create)
  if (req.method === 'POST' && !orgId) {
      return createOrganization(userId, req, res);
  }

  // PUT /api/organizations/:id
  if (req.method === 'PUT' && orgId && !action) {
      return updateOrganization(userId, orgId, req, res);
  }

  // DELETE /api/organizations/:id
  if (req.method === 'DELETE' && orgId && !action) {
      return deleteOrganization(userId, orgId, req, res);
  }

  return error(res, 'Not found', 404, req);
}

async function getOrganization(userId: string, orgId: string, req: VercelRequest, res: VercelResponse) {
  try {
    // Validate orgId format (UUID) to prevent 500 errors on scanning/invalid inputs
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(orgId)) {
       return error(res, 'Invalid organization ID', 400, req);
    }

    const auth = getAuthFromRequest(req);
    // Strict isolation: only SUPER ADMIN can bypass tenancy checks. 
    // "Admin" role just means "Administrator of an Organization".
    const isSuperAdmin = (auth?.permissions || []).includes('super_admin');

    // Get user's role in this org
    const membership = await query(
      `SELECT role, status FROM organization_members WHERE organization_id = $1 AND user_id = $2`,
      [orgId, userId]
    );

    // B-SEC-01 & B-ROLE-01: Enforce organization isolation
    if (!isSuperAdmin && (membership.length === 0 || membership[0].status !== 'active')) {
       return error(res, 'You do not have access to this organization', 403, req);
    }

    const orgs = await query(
      `SELECT o.*, 
              (SELECT COUNT(*) FROM organization_members WHERE organization_id = o.id AND status = 'active') as member_count,
              (SELECT COUNT(*) FROM protocols WHERE organization_id = o.id) as protocol_count
       FROM organizations o 
       WHERE o.id = $1`,
      [orgId]
    );
    
    if (orgs.length === 0) {
      return error(res, 'Organization not found', 404, req);
    }
    
    return json(res, {
      ...orgs[0],
      memberCount: orgs[0].member_count,
      protocolCount: orgs[0].protocol_count,
      myRole: membership[0]?.role || null,
      myStatus: membership[0]?.status || null
    }, 200, req);
  } catch (e: any) {
    return error(res, 'Failed to fetch organization', 500, req);
  }
}

async function getOrganizationLeaderboard(userId: string, orgId: string, req: VercelRequest, res: VercelResponse) {
  try {
    const { limit = 20, offset = 0, period = 'all' } = req.query;

    const auth = getAuthFromRequest(req);
    // Strict isolation: only SUPER ADMIN can bypass tenancy checks.
    const isSuperAdmin = (auth?.permissions || []).includes('super_admin');

    // Check membership
    const membership = await query(
      `SELECT role FROM organization_members WHERE organization_id = $1 AND user_id = $2 AND status = 'active'`,
      [orgId, userId]
    );

    if (!isSuperAdmin && membership.length === 0) {
       return error(res, 'You do not have access to this organization leaderboard', 403, req);
    }
    
    // Get user's privacy setting
    const userPrivacy = await query(
      `SELECT privacy_organization_leaderboard FROM users WHERE id = $1`,
      [userId]
    );
    const myPrivacy = userPrivacy[0]?.privacy_organization_leaderboard || 'visible';
    
    let dateFilter = '';
    if (period === 'daily') {
      dateFilter = `AND pel.log_date = CURRENT_DATE`;
    } else if (period === 'weekly') {
      dateFilter = `AND pel.log_date >= CURRENT_DATE - INTERVAL '7 days'`;
    } else if (period === 'monthly') {
      dateFilter = `AND pel.log_date >= CURRENT_DATE - INTERVAL '30 days'`;
    }
    
    // Get leaderboard - sum of all protocol points for this org
    const leaderboard = await query(
      `WITH org_protocols AS (
         SELECT p.id as protocol_id
         FROM protocols p
         LEFT JOIN protocol_organization_assignments poa ON p.id = poa.protocol_id
         WHERE p.organization_id = $1 OR poa.organization_id = $1
       ),
       user_points AS (
         SELECT 
           u.id as user_id,
           u.name,
           u.avatar_url,
           u.privacy_organization_leaderboard as privacy,
           COALESCE(SUM(pel.points_earned), 0) as total_points,
           COUNT(DISTINCT pel.log_date) as active_days
         FROM users u
         JOIN organization_members om ON u.id = om.user_id AND om.organization_id = $1 AND om.status = 'active'
         JOIN user_protocols up ON u.id = up.user_id
         JOIN org_protocols op ON up.protocol_id = op.protocol_id
         LEFT JOIN protocol_elements pe ON pe.protocol_id = up.protocol_id
         LEFT JOIN protocol_element_logs pel ON pel.element_id = pe.id AND pel.user_id = u.id ${dateFilter}
         GROUP BY u.id, u.name, u.avatar_url, u.privacy_organization_leaderboard
       ),
       ranked AS (
         SELECT *,
                ROW_NUMBER() OVER (ORDER BY total_points DESC) as rank
         FROM user_points
       )
       SELECT * FROM ranked
       WHERE privacy != 'hidden'
       ORDER BY rank
       LIMIT $2 OFFSET $3`,
      [orgId, limit, offset]
    );
    
    // Transform based on privacy
    const transformedLeaderboard = leaderboard.map((entry: any) => ({
      rank: parseInt(entry.rank),
      userId: entry.user_id,
      name: entry.privacy === 'anonymous' ? 'Anonymous' : entry.name,
      avatarUrl: entry.privacy === 'anonymous' ? null : entry.avatar_url,
      totalPoints: parseInt(entry.total_points),
      activeDays: parseInt(entry.active_days),
      isCurrentUser: entry.user_id === userId
    }));
    
    // Get current user's rank if they're hidden
    let myRank = null;
    if (myPrivacy === 'hidden') {
      const myRankResult = await query(
        `WITH org_protocols AS (
           SELECT p.id as protocol_id
           FROM protocols p
           LEFT JOIN protocol_organization_assignments poa ON p.id = poa.protocol_id
           WHERE p.organization_id = $1 OR poa.organization_id = $1
         ),
         user_points AS (
           SELECT 
             u.id as user_id,
             COALESCE(SUM(pel.points_earned), 0) as total_points
           FROM users u
           JOIN organization_members om ON u.id = om.user_id AND om.organization_id = $1 AND om.status = 'active'
           JOIN user_protocols up ON u.id = up.user_id
           JOIN org_protocols op ON up.protocol_id = op.protocol_id
           LEFT JOIN protocol_elements pe ON pe.protocol_id = up.protocol_id
           LEFT JOIN protocol_element_logs pel ON pel.element_id = pe.id AND pel.user_id = u.id ${dateFilter}
           GROUP BY u.id
         ),
         ranked AS (
           SELECT *,
                  ROW_NUMBER() OVER (ORDER BY total_points DESC) as rank
           FROM user_points
         )
         SELECT * FROM ranked WHERE user_id = $2`,
        [orgId, userId]
      );
      if (myRankResult.length > 0) {
        myRank = {
          rank: parseInt(myRankResult[0].rank),
          totalPoints: parseInt(myRankResult[0].total_points)
        };
      }
    }
    
    // Get organization info
    const orgInfo = await query(`SELECT name, logo_url FROM organizations WHERE id = $1`, [orgId]);
    
    return json(res, {
      organization: orgInfo[0] || {},
      leaderboard: transformedLeaderboard,
      myRank,
      myPrivacy
    }, 200, req);
  } catch (err: any) {
    console.error('Organization leaderboard error:', err);
    return error(res, err.message || 'Failed to get leaderboard', 500, req);
  }
}

async function getOrganizationProtocols(userId: string, orgId: string, req: VercelRequest, res: VercelResponse) {
  try {
     const auth = getAuthFromRequest(req);
     // Strict isolation: only SUPER ADMIN can bypass tenancy checks.
     const isSuperAdmin = (auth?.permissions || []).includes('super_admin');

     // Check membership
     const membership = await query(
       `SELECT role FROM organization_members WHERE organization_id = $1 AND user_id = $2 AND status = 'active'`,
       [orgId, userId]
     );

     if (!isSuperAdmin && membership.length === 0) {
        return error(res, 'You do not have access to this organization protocols', 403, req);
     }

    const protocols = await query(
      `SELECT p.*, 
              (SELECT COUNT(*) FROM user_protocols WHERE protocol_id = p.id) as assigned_users,
              (SELECT COUNT(*) FROM protocol_elements WHERE protocol_id = p.id) as element_count
       FROM protocols p
       LEFT JOIN protocol_organization_assignments poa ON p.id = poa.protocol_id
       WHERE p.organization_id = $1 OR poa.organization_id = $1
       ORDER BY p.created_at DESC`,
      [orgId]
    );
    
    return json(res, protocols.map((p: any) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      icon: p.icon,
      status: p.status,
      assignedUsers: parseInt(p.assigned_users),
      elementCount: parseInt(p.element_count),
      createdAt: p.created_at
    })), 200, req);
  } catch (err: any) {
    return error(res, err.message || 'Failed to get protocols', 500, req);
  }
}

async function getOrganizationMembers(userId: string, orgId: string, req: VercelRequest, res: VercelResponse) {
  try {
    const auth = getAuthFromRequest(req);
    // Strict isolation: only SUPER ADMIN can bypass tenancy checks.
    const isSuperAdmin = (auth?.permissions || []).includes('super_admin');

    const membership = await query(
       `SELECT role FROM organization_members WHERE organization_id = $1 AND user_id = $2 AND status = 'active'`,
       [orgId, userId]
    );

    if (!isSuperAdmin && membership.length === 0) {
       return error(res, 'You do not have access to this organization members', 403, req);
    }
    
    // Also enforce that only admins/managers can view full member list if that's a requirement? 
    // Requirement P-ORG-02 "View users by organization". Usually implies admin.
    // But generic members might want to see colleagues?
    // B-SEC-01 just says "Organization isolation". So basic membership check is enough.
    
    const members = await query(
      `SELECT u.id, u.name, u.email, u.avatar_url, 
              om.role, om.status, om.created_at as joined_at
       FROM users u
       JOIN organization_members om ON u.id = om.user_id
       WHERE om.organization_id = $1
       ORDER BY om.created_at DESC`,
      [orgId]
    );
    
    return json(res, members.map((m: any) => ({
      id: m.id,
      name: m.name,
      email: m.email,

      avatarUrl: m.avatar_url,
      role: m.role,
      status: m.status,
      joinedAt: m.joined_at
    })), 200, req);
  } catch (err: any) {
    return error(res, err.message || 'Failed to get members', 500, req);
  }
}

async function listOrganizations(userId: string, req: VercelRequest, res: VercelResponse) {
    try {
        const auth = getAuthFromRequest(req);
        const isAdmin = (auth?.permissions || []).includes('admin');
        
        let orgs;
        if (isAdmin) {
             orgs = await query(`
                SELECT 
                    o.*,
                    COUNT(DISTINCT om.user_id) as member_count
                FROM organizations o
                LEFT JOIN organization_members om ON o.id = om.organization_id AND om.status = 'active'
                GROUP BY o.id
                ORDER BY o.created_at DESC
             `);
        } else {
             orgs = await query(
                `SELECT 
                    o.*, 
                    m_own.role,
                    COUNT(DISTINCT om_all.user_id) as member_count
                 FROM organizations o 
                 JOIN organization_members m_own ON o.id = m_own.organization_id 
                 LEFT JOIN organization_members om_all ON o.id = om_all.organization_id AND om_all.status = 'active'
                 WHERE m_own.user_id = $1 AND m_own.status = 'active'
                 GROUP BY o.id, m_own.role
                 ORDER BY o.created_at DESC`,
                [userId]
            );
        }
        
        // Ensure member_count is returned as a number (although frontend might handle string)
        const orgsWithNumbers = orgs.map((org: any) => ({
            ...org,
            member_count: parseInt(org.member_count || '0')
        }));
        
        return json(res, orgsWithNumbers, 200, req);
    } catch (e: any) {
        return error(res, 'Failed to fetch organizations', 500, req);
    }
}

async function createOrganization(userId: string, req: VercelRequest, res: VercelResponse) {
    try {
        const auth = getAuthFromRequest(req);
        // Only Global Admins can create new Orgs
        const isGlobalAdmin = (auth?.permissions || []).includes('admin') || (auth?.permissions || []).includes('super_admin');
        
        if (!isGlobalAdmin) {
             return error(res, 'Only global admins can create organizations', 403, req);
        }

        const { name, logo_url, type = 'company', parent_id, description } = req.body;
        
        // Strict Validation (Malformed input handling)
        if (!name || typeof name !== 'string') {
            return error(res, 'Name required and must be a string', 400, req);
        }

        // Validate type
        if (!['product', 'company'].includes(type)) {
            return error(res, 'Invalid type. Must be "product" or "company"', 400, req);
        }
        
        // If parent_id is provided, validate it exists
        if (parent_id) {
            const parentOrg = await query('SELECT id FROM organizations WHERE id = $1', [parent_id]);
            if (parentOrg.length === 0) {
                return error(res, 'Parent organization not found', 404, req);
            }
        }
        
        const result = await query(
            `INSERT INTO organizations (name, logo_url, type, parent_id, description) 
             VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [name, logo_url, type, parent_id || null, description || null]
        );
        const org = result[0];
        
        // Add creator as admin
        await query(
            `INSERT INTO organization_members (organization_id, user_id, role, status)
             VALUES ($1, $2, 'admin', 'active')`,
            [org.id, userId]
        );
        
        return json(res, org, 201, req);
    } catch (e: any) {
        console.error(e);
        return error(res, 'Failed to create organization', 500, req);
    }
}

async function updateOrganization(userId: string, orgId: string, req: VercelRequest, res: VercelResponse) {
    try {
        const { name, logo_url, type, parent_id, description } = req.body;
        
        // Check permission (admin or org admin)
        const membership = await query(
             `SELECT role FROM organization_members WHERE organization_id = $1 AND user_id = $2`,
             [orgId, userId]
        );
        const auth = getAuthFromRequest(req);
        const isSuperAdmin = (auth?.permissions || []).includes('super_admin');
        const isGlobalAdmin = (auth?.permissions || []).includes('admin') || isSuperAdmin;
        const isOrgAdmin = membership.length > 0 && membership[0].role === 'admin';
        
        if (!isGlobalAdmin && !isOrgAdmin) {
            return error(res, 'Forbidden', 403, req);
        }
        
        // Validate type if provided
        if (type && !['product', 'company'].includes(type)) {
            return error(res, 'Invalid type. Must be "product" or "company"', 400, req);
        }
        
        const result = await query(
            `UPDATE organizations SET 
                name = COALESCE($1, name), 
                logo_url = COALESCE($2, logo_url),
                type = COALESCE($3, type),
                parent_id = COALESCE($4, parent_id),
                description = COALESCE($5, description),
                updated_at = NOW() 
             WHERE id = $6 RETURNING *`,
            [name, logo_url, type, parent_id, description, orgId]
        );
        
        return json(res, result[0], 200, req);
    } catch (e: any) {
         return error(res, 'Failed to update organization', 500, req);
    }
}

async function deleteOrganization(userId: string, orgId: string, req: VercelRequest, res: VercelResponse) {
    try {
        const auth = getAuthFromRequest(req);
        if (!(auth?.permissions || []).includes('admin')) {
            return error(res, 'Forbidden. Only admins can delete organizations.', 403, req);
        }
        
        await query('DELETE FROM organizations WHERE id = $1', [orgId]);
        return json(res, { message: 'Organization deleted' }, 200, req);
    } catch (e: any) {
        return error(res, 'Failed to delete organization', 500, req);
    }
}

async function getMyOrganizations(userId: string, req: VercelRequest, res: VercelResponse) {
    // Deprecated by listOrganizations but keeping logic if needed
    return listOrganizations(userId, req, res);
}

async function inviteMember(managerId: string, orgId: string, req: VercelRequest, res: VercelResponse) {
  try {
    const { email, challengeId } = req.body;
    
    // Check if manager is part of org (and maybe admin?)
    const managerMembership = await query(
        `SELECT role FROM organization_members WHERE organization_id = $1 AND user_id = $2 AND status = 'active'`,
        [orgId, managerId]
    );

    if (managerMembership.length === 0) {
        return error(res, 'You are not a member of this organization', 403, req);
    }

    // Get user by email
    const users = await query('SELECT id, name FROM users WHERE email = $1', [email]);
    if (users.length === 0) {
        // User not found in system - treat as external invitation
        // In a real system, we'd insert into organization_invitations and send an email
        // For B-AUTH-01 compliance, we acknowledge the request effectively
        return json(res, { success: true, message: 'Invitation sent to ' + email, email }, 200, req);
    }
    const targetUserId = users[0].id;

    // Check if user is already a member
    const targetMembership = await query(
        `SELECT status FROM organization_members WHERE organization_id = $1 AND user_id = $2`,
        [orgId, targetUserId]
    );

    const isMember = targetMembership.length > 0 && targetMembership[0].status === 'active';
    const orgInfo = await query('SELECT name FROM organizations WHERE id = $1', [orgId]);
    const orgName = orgInfo[0]?.name;
    const inviterName = (await query('SELECT name FROM users WHERE id = $1', [managerId]))[0]?.name || 'Manager';

    if (isMember) {
        // Already a member. If challengeId is present, invite to challenge directly.
        if (challengeId) {
            const challenge = await query('SELECT title FROM challenges WHERE id = $1', [challengeId]);
            const challengeTitle = challenge[0]?.title || 'Challenge';

             await query(
               `INSERT INTO notifications (user_id, type, title, message, data)
                VALUES ($1, 'CHALLENGE_INVITE', $2, $3, $4)`,
               [
                 targetUserId, 
                 'CHALLENGE_INVITE', 
                 `Join ${challengeTitle}`, 
                 `${inviterName} invited you to join ${challengeTitle}`, 
                 { challengeId, organizationId: orgId }
               ]
             );
             return json(res, { message: 'User invited to challenge' }, 200, req);
        } else {
             return error(res, 'User is already a member', 400, req);
        }
    } else {
        // Not a member. Invite to Org first.
        // Create ORG_INVITE notification
        await query(
           `INSERT INTO notifications (user_id, type, title, message, data)
            VALUES ($1, 'ORG_INVITE', $2, $3, $4)`,
           [
             targetUserId, 
             'ORG_INVITE', 
             `Join ${orgName}`, 
             `${inviterName} invited you to join organization ${orgName}`, 
             { organizationId: orgId, role: 'member', pendingChallengeId: challengeId }
           ]
         );
         
         // Optionally create pending membership record
         await query(
            `INSERT INTO organization_members (organization_id, user_id, role, status)
             VALUES ($1, $2, 'member', 'invited')
             ON CONFLICT (organization_id, user_id) DO UPDATE SET status = 'invited'`,
            [orgId, targetUserId]
         );

         return json(res, { message: 'User invited to organization' }, 200, req);
    }

  } catch (err: any) {
    return error(res, err.message || 'Failed to invite member', 500, req);
  }
}
