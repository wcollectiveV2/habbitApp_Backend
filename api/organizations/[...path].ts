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
  const orgId = parts[3]; 
  const action = parts[4]; // invite

  if (req.method === 'POST' && orgId && action === 'invite') {
    return inviteMember(userId, orgId, req, res);
  }

  // GET /api/organizations
  if (req.method === 'GET' && (!orgId || orgId === '')) {
      return getMyOrganizations(userId, req, res);
  }

  return error(res, 'Not found', 404, req);
}

async function getMyOrganizations(userId: string, req: VercelRequest, res: VercelResponse) {
    try {
        const orgs = await query(
            `SELECT o.*, om.role FROM organizations o 
             JOIN organization_members om ON o.id = om.organization_id 
             WHERE om.user_id = $1 AND om.status = 'active'`,
            [userId]
        );
        return json(res, orgs, 200, req);
    } catch (e: any) {
        return error(res, 'Failed to fetch organizations', 500, req);
    }
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
