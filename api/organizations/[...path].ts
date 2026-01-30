import type { VercelRequest, VercelResponse } from '@vercel/node';
import { json, error, cors } from '../../lib/response';
import { getAuthFromRequest } from '../../lib/auth';
import { query } from '../../lib/db';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(res, req);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const auth = getAuthFromRequest(req);
  if (!auth) return error(res, 'Unauthorized', 401, req);
  const userId = auth.sub;
  
  const path = req.url?.split('?')[0] || '';
  const parts = path.split('/');
  // /api/organizations/:id/invite ... parts: ['', 'api', 'organizations', 'id', 'invite']
  // /api/organizations ... parts: ['', 'api', 'organizations']
  const orgId = (parts.length > 3 && parts[3]) ? parts[3] : null; 
  const action = (parts.length > 4) ? parts[4] : null;

  if (req.method === 'POST' && orgId && action === 'invite') {
    return inviteMember(userId, orgId, req, res);
  }

  // GET /api/organizations
  if (req.method === 'GET' && !orgId) {
      return listOrganizations(userId, req, res);
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

async function listOrganizations(userId: string, req: VercelRequest, res: VercelResponse) {
    try {
        const auth = getAuthFromRequest(req);
        const isAdmin = (auth?.permissions || []).includes('admin');
        
        let orgs;
        if (isAdmin) {
             orgs = await query('SELECT * FROM organizations ORDER BY created_at DESC');
        } else {
             orgs = await query(
                `SELECT o.*, om.role FROM organizations o 
                 JOIN organization_members om ON o.id = om.organization_id 
                 WHERE om.user_id = $1 AND om.status = 'active'`,
                [userId]
            );
        }
        return json(res, orgs, 200, req);
    } catch (e: any) {
        return error(res, 'Failed to fetch organizations', 500, req);
    }
}

async function createOrganization(userId: string, req: VercelRequest, res: VercelResponse) {
    try {
        const { name, logo_url } = req.body;
        if (!name) return error(res, 'Name required', 400, req);
        
        const result = await query(
            'INSERT INTO organizations (name, logo_url) VALUES ($1, $2) RETURNING *',
            [name, logo_url]
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
        const { name, logo_url } = req.body;
        
        // Check permission (admin or org admin)
        const membership = await query(
             `SELECT role FROM organization_members WHERE organization_id = $1 AND user_id = $2`,
             [orgId, userId]
        );
        const auth = getAuthFromRequest(req);
        const isGlobalAdmin = (auth?.permissions || []).includes('admin');
        const isOrgAdmin = membership.length > 0 && membership[0].role === 'admin';
        
        if (!isGlobalAdmin && !isOrgAdmin) {
            return error(res, 'Forbidden', 403, req);
        }
        
        const result = await query(
            'UPDATE organizations SET name = COALESCE($1, name), logo_url = COALESCE($2, logo_url), updated_at = NOW() WHERE id = $3 RETURNING *',
            [name, logo_url, orgId]
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
        // Invite non-existing user? Skip for now, assume user exists
        return error(res, 'User not found', 404, req);
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
