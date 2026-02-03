import type { VercelRequest, VercelResponse } from '@vercel/node';
import { json, error, cors } from '../lib/response';
import { getAuthFromRequest, generateToken, verifyToken } from '../lib/auth';
import { query } from '../lib/db';
import bcrypt from 'bcryptjs';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Handle CORS preflight
  cors(res, req);
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const path = req.url?.split('?')[0] || '';
  
  // POST /api/auth/login
  if (req.method === 'POST' && path.endsWith('/login')) {
    return handleLogin(req, res);
  }

  // POST /api/auth/register
  if (req.method === 'POST' && path.endsWith('/register')) {
    return handleRegister(req, res);
  }

  // POST /api/auth/refresh
  if (req.method === 'POST' && path.endsWith('/refresh')) {
    return handleRefresh(req, res);
  }

  // GET /api/auth/me
  if (req.method === 'GET' && path.endsWith('/me')) {
    return handleMe(req, res);
  }

  // POST /api/auth/forgot-password
  if (req.method === 'POST' && path.endsWith('/forgot-password')) {
    return handleForgotPassword(req, res);
  }

  // POST /api/auth/verify-reset-code
  if (req.method === 'POST' && path.endsWith('/verify-reset-code')) {
    return handleVerifyResetCode(req, res);
  }

  // POST /api/auth/reset-password
  if (req.method === 'POST' && path.endsWith('/reset-password')) {
    return handleResetPassword(req, res);
  }

  return error(res, 'Not found', 404, req);
}

async function handleLogin(req: VercelRequest, res: VercelResponse) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return error(res, 'Email and password required', 400, req);
    }

    // Query user from database
    const users = await query<{ id: string; email: string; password_hash: string; name: string; roles: string[] }>(
      'SELECT id, email, password_hash, name, roles FROM users WHERE email = $1',
      [email]
    );

    if (users.length === 0) {
      return error(res, 'Invalid credentials', 401, req);
    }

    const user = users[0];
    const validPassword = await bcrypt.compare(password, user.password_hash);

    if (!validPassword) {
      return error(res, 'Invalid credentials', 401, req);
    }

    const accessToken = generateToken({
      sub: user.id,
      email: user.email,
      permissions: user.roles || [],
    });

    const refreshToken = generateToken({
      sub: user.id,
      email: user.email,
      permissions: user.roles || [],
    });

    return json(res, {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        roles: user.roles || [],
      },
    }, 200, req);
  } catch (err: any) {
    console.error('Login error:', err);
    return error(res, err.message || 'Login failed', 500, req);
  }
}

async function handleRegister(req: VercelRequest, res: VercelResponse) {
  try {
    const { email, password, name, invitationToken } = req.body;

    if (!email || !password || !name) {
      return error(res, 'Email, password, and name required', 400, req);
    }

    // Check if user exists
    const existing = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.length > 0) {
      return error(res, 'User already exists', 400, req);
    }

    // If invitation token provided, validate it
    let invitation = null;
    let organizationId = null;
    let orgRole = 'member';
    
    if (invitationToken) {
      const invResult = await query(
        `SELECT i.*, o.name as organization_name, o.type as organization_type
         FROM organization_invitations i
         JOIN organizations o ON i.organization_id = o.id
         WHERE i.token = $1 AND i.status = 'active'`,
        [invitationToken]
      );
      
      if (invResult.length > 0) {
        invitation = invResult[0];
        
        // Validate invitation
        if (invitation.current_uses >= invitation.max_uses) {
          return error(res, 'Invitation has reached maximum uses', 400, req);
        }
        
        if (new Date(invitation.expires_at) < new Date()) {
          return error(res, 'Invitation has expired', 400, req);
        }
        
        // If invitation is for specific email, validate it
        if (invitation.email && invitation.email.toLowerCase() !== email.toLowerCase()) {
          return error(res, 'This invitation is for a different email address', 400, req);
        }
        
        organizationId = invitation.organization_id;
        orgRole = invitation.role || 'member';
      }
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user with optional primary organization
    const users = await query<{ id: string; email: string; name: string; roles: string[] }>(
      `INSERT INTO users (email, password_hash, name, primary_organization_id) 
       VALUES ($1, $2, $3, $4) RETURNING id, email, name, roles`,
      [email, passwordHash, name, organizationId]
    );

    const user = users[0];
    
    // If invitation was used, add user to organization and update invitation
    if (invitation) {
      await query(
        `INSERT INTO organization_members (organization_id, user_id, role, status)
         VALUES ($1, $2, $3, 'active')
         ON CONFLICT (organization_id, user_id) DO UPDATE SET status = 'active'`,
        [organizationId, user.id, orgRole]
      );
      
      // Update invitation usage
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
      
      // Handle any pending challenge invites
      if (invitation.metadata?.challengeId) {
        await query(
          `INSERT INTO challenge_participants (challenge_id, user_id) 
           VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [invitation.metadata.challengeId, user.id]
        );
      }
    }

    const accessToken = generateToken({
      sub: user.id,
      email: user.email,
      permissions: user.roles || ['user'],
    });

    const refreshToken = generateToken({
      sub: user.id,
      email: user.email,
      permissions: user.roles || ['user'],
    });

    // Build response with optional organization info
    const response: any = {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        roles: user.roles || ['user'],
      },
    };
    
    // Include organization info if user was invited
    if (invitation) {
      response.organization = {
        id: invitation.organization_id,
        name: invitation.organization_name,
        type: invitation.organization_type,
        role: orgRole
      };
      
      // Determine redirect based on org type
      response.redirectUrl = invitation.organization_type === 'product'
        ? (process.env.APP_URL || 'https://habitpulse.app')
        : (process.env.ADMIN_URL || 'https://admin.habitpulse.app');
    }

    return json(res, response, 201, req);
  } catch (err: any) {
    console.error('Register error:', err);
    return error(res, err.message || 'Registration failed', 500, req);
  }
}

async function handleRefresh(req: VercelRequest, res: VercelResponse) {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return error(res, 'Refresh token required', 400, req);
    }

    const payload = verifyToken(refreshToken);
    if (!payload) {
      return error(res, 'Invalid refresh token', 401, req);
    }

    const newToken = generateToken({
      sub: payload.sub,
      email: payload.email,
      permissions: payload.permissions || ['habit:read', 'habit:write'],
    });

    return json(res, { accessToken: newToken }, 200, req);
  } catch (err: any) {
    return error(res, err.message || 'Refresh failed', 500, req);
  }
}

async function handleMe(req: VercelRequest, res: VercelResponse) {
  try {
    const auth = getAuthFromRequest(req);
    if (!auth) {
      return error(res, 'Unauthorized', 401, req);
    }

    const users = await query<{ id: string; email: string; name: string }>(
      'SELECT id, email, name FROM users WHERE id = $1',
      [auth.sub]
    );

    if (users.length === 0) {
      return error(res, 'User not found', 404, req);
    }

    return json(res, { user: users[0] }, 200, req);
  } catch (err: any) {
    return error(res, err.message || 'Failed to get user', 500, req);
  }
}

// Generate a 6-digit reset code
function generateResetCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function handleForgotPassword(req: VercelRequest, res: VercelResponse) {
  try {
    const { email } = req.body;

    if (!email) {
      return error(res, 'Email is required', 400, req);
    }

    // Check if user exists
    const users = await query<{ id: string; email: string; name: string }>(
      'SELECT id, email, name FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    // Always return success to prevent email enumeration
    if (users.length === 0) {
      return json(res, { message: 'If an account exists, a reset code has been sent' }, 200, req);
    }

    const user = users[0];
    const resetCode = generateResetCode();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    // Store reset code in database (upsert)
    await query(
      `INSERT INTO password_reset_tokens (user_id, email, code, expires_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (email) DO UPDATE SET code = $3, expires_at = $4, used = false, created_at = NOW()`,
      [user.id, email.toLowerCase(), resetCode, expiresAt]
    );

    // TODO: Send email with reset code
    // For now, log it (in production, use email service)
    console.log(`Password reset code for ${email}: ${resetCode}`);

    return json(res, { message: 'If an account exists, a reset code has been sent' }, 200, req);
  } catch (err: any) {
    console.error('Forgot password error:', err);
    return error(res, 'Failed to process request', 500, req);
  }
}

async function handleVerifyResetCode(req: VercelRequest, res: VercelResponse) {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return error(res, 'Email and code are required', 400, req);
    }

    const tokens = await query<{ id: string; user_id: string; expires_at: Date; used: boolean }>(
      `SELECT id, user_id, expires_at, used FROM password_reset_tokens 
       WHERE email = $1 AND code = $2`,
      [email.toLowerCase(), code]
    );

    if (tokens.length === 0) {
      return error(res, 'Invalid or expired reset code', 400, req);
    }

    const token = tokens[0];

    if (token.used) {
      return error(res, 'Reset code has already been used', 400, req);
    }

    if (new Date(token.expires_at) < new Date()) {
      return error(res, 'Reset code has expired', 400, req);
    }

    return json(res, { valid: true }, 200, req);
  } catch (err: any) {
    console.error('Verify reset code error:', err);
    return error(res, 'Failed to verify code', 500, req);
  }
}

async function handleResetPassword(req: VercelRequest, res: VercelResponse) {
  try {
    const { email, code, newPassword } = req.body;

    if (!email || !code || !newPassword) {
      return error(res, 'Email, code, and new password are required', 400, req);
    }

    if (newPassword.length < 8) {
      return error(res, 'Password must be at least 8 characters', 400, req);
    }

    // Verify the reset token
    const tokens = await query<{ id: string; user_id: string; expires_at: Date; used: boolean }>(
      `SELECT id, user_id, expires_at, used FROM password_reset_tokens 
       WHERE email = $1 AND code = $2`,
      [email.toLowerCase(), code]
    );

    if (tokens.length === 0) {
      return error(res, 'Invalid or expired reset code', 400, req);
    }

    const token = tokens[0];

    if (token.used) {
      return error(res, 'Reset code has already been used', 400, req);
    }

    if (new Date(token.expires_at) < new Date()) {
      return error(res, 'Reset code has expired', 400, req);
    }

    // Hash new password and update user
    const passwordHash = await bcrypt.hash(newPassword, 10);

    await query(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
      [passwordHash, token.user_id]
    );

    // Mark token as used
    await query(
      'UPDATE password_reset_tokens SET used = true WHERE id = $1',
      [token.id]
    );

    return json(res, { message: 'Password has been reset successfully' }, 200, req);
  } catch (err: any) {
    console.error('Reset password error:', err);
    return error(res, 'Failed to reset password', 500, req);
  }
}
