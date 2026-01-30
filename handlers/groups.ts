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
  const userRoles = auth.permissions || [];
  const isAdmin = userRoles.includes('admin');

  try {
    let groups;
    if (isAdmin) {
      // Admins see all organizations
      groups = await query(
        `SELECT id, name, 'organization' as type FROM organizations ORDER BY name ASC`
      );
    } else {
      // Others see organizations they are members of (and ideally admins of)
      // For now, let's show all orgs they are part of
      groups = await query(
        `SELECT o.id, o.name, 'organization' as type 
         FROM organizations o
         JOIN organization_members om ON o.id = om.organization_id
         WHERE om.user_id = $1`,
        [userId]
      );
    }
    
    // Map UUID to number if frontend expects number, but frontend User interface said ID is string now?
    // UserManagementView.tsx line 10 says id is string (UUID) but line 8 Group says id: number.
    // I should probably return string ID.
    // The frontend code: interface Group { id: number; ... }
    // I will update frontend to expect string IDs for groups too, as UUIDs are used in DB.
    
    return json(res, groups, 200, req);
  } catch (err: any) {
    console.error('List groups error:', err);
    return error(res, 'Failed to list groups', 500, req);
  }
}
