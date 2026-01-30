import type { VercelRequest, VercelResponse } from '@vercel/node';
import { json, error, cors } from '../../lib/response';
import { getAuthFromRequest } from '../../lib/auth';
import { query } from '../../lib/db';

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
  // path usually /api/protocols/... or /protocols/... depending on rewrite
  // If rewrote from /protocols/123 -> /api/protocols/123, parts might look different properly
  // But let's assume standard vercel logic: if file is api/protocols/[...path].ts, then path is relevant part to wildcard
  // Wait, req.url is the full URL.
  
  const id = pathParts.find(p => !isNaN(parseInt(p)) && parseInt(p) > 0);
  
  // GET /api/protocols
  if (req.method === 'GET' && !id && (path.endsWith('/protocols') || path.endsWith('/protocols/'))) {
    return listProtocols(userId, req, res);
  }

  // POST /api/protocols
  if (req.method === 'POST' && (path.endsWith('/protocols') || path.endsWith('/protocols/'))) {
    return createProtocol(userId, req, res);
  }

  // GET /api/protocols/:id
  if (req.method === 'GET' && id && !path.includes('/leaderboard')) {
    return getProtocol(id, res, req);
  }

  // POST /api/protocols/:id/elements
  if (req.method === 'POST' && id && path.includes('/elements')) {
    return addProtocolElement(id, req, res);
  }

  // POST /api/protocols/:id/assign
  if (req.method === 'POST' && id && path.includes('/assign')) {
    return assignProtocol(userId, id, req, res);
  }
  
  // GET /api/protocols/:id/leaderboard
  if (req.method === 'GET' && id && path.includes('/leaderboard')) {
     // Mock response for now
     return json(res, { leaderboard: [] }, 200, req);
  }

  return error(res, 'Not found', 404, req);
}

async function listProtocols(userId: string, req: VercelRequest, res: VercelResponse) {
  try {
    const protocols = await query(
      `SELECT * FROM protocols ORDER BY created_at DESC`
    );
    
    // For each protocol, get elements
    const protocolsWithElements = await Promise.all(protocols.map(async (p: any) => {
        const elements = await query(`SELECT * FROM protocol_elements WHERE protocol_id = $1`, [p.id]);
        return {
            ...p,
            creatorId: p.creator_id,
            createdAt: p.created_at,
            elements: elements.map((e: any) => ({
                id: e.id,
                title: e.title,
                type: e.type,
                unit: e.unit,
                goal: e.goal,
                frequency: e.frequency
            }))
        };
    }));

    return json(res, protocolsWithElements, 200, req);
  } catch (err: any) {
    return error(res, err.message, 500, req);
  }
}

async function createProtocol(userId: string, req: VercelRequest, res: VercelResponse) {
    try {
        const { name, description } = req.body;
        if (!name) return error(res, 'Name required', 400, req);

        const result = await query(
            `INSERT INTO protocols (name, description, creator_id) VALUES ($1, $2, $3) RETURNING *`,
            [name, description, userId]
        );
        
        const protocol = result[0];
        
        return json(res, {
            ...protocol,
            creatorId: protocol.creator_id,
            createdAt: protocol.created_at,
            elements: []
        }, 201, req);

    } catch (err: any) {
        return error(res, err.message, 500, req);
    }
}

async function getProtocol(id: string, res: VercelResponse, req: VercelRequest) {
    try {
        const protocols = await query(`SELECT * FROM protocols WHERE id = $1`, [id]);
        if (protocols.length === 0) return error(res, 'Protocol not found', 404, req);
        
        const protocol = protocols[0];
        const elements = await query(`SELECT * FROM protocol_elements WHERE protocol_id = $1`, [id]);
        
        return json(res, {
            ...protocol,
            creatorId: protocol.creator_id,
            createdAt: protocol.created_at,
            elements: elements.map((e: any) => ({
                id: e.id,
                title: e.title,
                type: e.type,
                unit: e.unit,
                goal: e.goal,
                frequency: e.frequency
            }))
        }, 200, req);
    } catch (err: any) {
        return error(res, err.message, 500, req);
    }
}

async function addProtocolElement(protocolId: string, req: VercelRequest, res: VercelResponse) {
    try {
        const { title, type, unit, goal, frequency } = req.body;
        
        const result = await query(
            `INSERT INTO protocol_elements (protocol_id, title, type, unit, goal, frequency) 
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [protocolId, title, type || 'check', unit, goal, frequency || 'daily']
        );
        
        return json(res, result[0], 201, req);
    } catch (err: any) {
        return error(res, err.message, 500, req);
    }
}

async function assignProtocol(assignerId: string, protocolId: string, req: VercelRequest, res: VercelResponse) {
    try {
        const { userId } = req.body; // Target user
        if (!userId) return error(res, 'Target user ID required', 400, req);
        
        await query(
            `INSERT INTO user_protocols (user_id, protocol_id, assigned_by) 
             VALUES ($1, $2, $3) 
             ON CONFLICT (user_id, protocol_id) DO NOTHING`,
            [userId, protocolId, assignerId]
        );
        
        // Logic to create actual habits from protocol elements could go here
        // For now just tracking the assignment
        
        return json(res, { success: true }, 200, req);
    } catch (err: any) {
        return error(res, err.message, 500, req);
    }
}
