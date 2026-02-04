// ============================================================================
// Test Constants - Service URLs and Configuration
// ============================================================================

// Service URLs
export const FRONTEND_URL = process.env.E2E_BASE_URL || 'http://localhost:3000';
export const ADMIN_DASHBOARD_URL = process.env.E2E_ADMIN_URL || 'http://localhost:3002';
export const BACKEND_API_URL = process.env.E2E_API_URL || 'http://localhost:3001';

// API Endpoints
export const API_ENDPOINTS = {
  // Auth
  LOGIN: `${BACKEND_API_URL}/api/auth/login`,
  REGISTER: `${BACKEND_API_URL}/api/auth/register`,
  LOGOUT: `${BACKEND_API_URL}/api/auth/logout`,
  ME: `${BACKEND_API_URL}/api/auth/me`,
  
  // User
  USER_PROFILE: `${BACKEND_API_URL}/api/user/profile`,
  USER_SYNC: `${BACKEND_API_URL}/api/user/sync`,
  
  // Organizations
  ORGANIZATIONS: `${BACKEND_API_URL}/api/organizations`,
  
  // Invitations
  INVITATIONS: `${BACKEND_API_URL}/api/invitations`,
  
  // Protocols
  PROTOCOLS: `${BACKEND_API_URL}/api/protocols`,
  
  // Social / Leaderboard
  LEADERBOARD: `${BACKEND_API_URL}/api/social/leaderboard`,
  
  // Admin
  ADMIN_STATS: `${BACKEND_API_URL}/api/admin/stats`,
  ADMIN_AUDIT: `${BACKEND_API_URL}/api/admin/audit`,
  ADMIN_USERS: `${BACKEND_API_URL}/api/admin/users`,
  
  // Tasks
  TASKS: `${BACKEND_API_URL}/api/tasks`,
  
  // Habits
  HABITS: `${BACKEND_API_URL}/api/habits`,
};

// Test Timeouts
export const TIMEOUTS = {
  SHORT: 5000,
  MEDIUM: 10000,
  LONG: 30000,
  NAVIGATION: 15000,
};

// Test User Credentials
export const TEST_CREDENTIALS = {
  SUPER_ADMIN: {
    email: 'superadmin@habitpulse.com',
    password: 'SuperAdmin123!',
  },
  ADMIN: {
    email: 'admin@habitpulse.com', 
    password: 'Admin123!',
  },
  USER: {
    email: 'testuser@example.com',
    password: 'TestUser123!',
  },
};

export default {
  FRONTEND_URL,
  ADMIN_DASHBOARD_URL,
  BACKEND_API_URL,
  API_ENDPOINTS,
  TIMEOUTS,
  TEST_CREDENTIALS,
};
