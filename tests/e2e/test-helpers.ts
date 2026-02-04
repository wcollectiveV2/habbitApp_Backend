// ============================================================================
// E2E Test Helpers - Seed-Based Testing
// Uses real database with seeded test data (no mocks)
// ============================================================================

import { Page, APIRequestContext } from '@playwright/test';
import { 
  TEST_USERS, 
  TEST_ORGANIZATIONS, 
  TEST_PROTOCOLS,
  TEST_CHALLENGES,
  login,
  loginToAdminDashboard,
  getAuthToken,
  apiRequest 
} from './e2e-test-config';
import { ADMIN_DASHBOARD_URL } from './constants';

// ============================================================================
// RE-EXPORT USER DATA FOR BACKWARDS COMPATIBILITY
// These match the old mock names but use seeded data
// ============================================================================

export const mockSuperAdmin = TEST_USERS.superAdmin;
export const mockProductAdmin = TEST_USERS.productAdmin;
export const mockCompanyOwner = TEST_USERS.companyOwner;
export const mockCompanyAdmin = TEST_USERS.companyAdmin;
export const mockRegularUser = TEST_USERS.testUser;
export const mockAnonymousUser = TEST_USERS.anonymousUser;
export const mockHiddenUser = TEST_USERS.hiddenUser;

// ============================================================================
// RE-EXPORT ORGANIZATION DATA
// ============================================================================

export const mockCompanyOrganization = TEST_ORGANIZATIONS.companyOrg;
export const mockProductOrganization = TEST_ORGANIZATIONS.productOrg;
export const mockSecondProductOrganization = TEST_ORGANIZATIONS.wellnessOrg;

// ============================================================================
// PROTOCOL/CHALLENGE DATA (from seeds)
// ============================================================================

export const mockDraftProtocol = {
  id: TEST_PROTOCOLS.draftMeditation.id,
  name: TEST_PROTOCOLS.draftMeditation.name,
  description: 'Build a daily meditation habit over 30 days',
  status: 'draft',
  icon: 'self_improvement',
  isPublic: false,
  isOpen: false,
  organizationId: TEST_PROTOCOLS.draftMeditation.organizationId,
  organizationName: 'E2E HabitPulse Product',
  creatorId: TEST_USERS.productAdmin.id,
  targetDays: 30,
  rewards: { xp: 500, badge: 'Meditation Master' },
  elements: [
    { id: 9010, title: 'Morning Meditation', type: 'check', points: 10, isRequired: true },
    { id: 9011, title: 'Minutes Meditated', type: 'number', goal: 15, unit: 'minutes', points: 15, isRequired: true },
    { id: 9012, title: 'Reflection Notes', type: 'text', points: 5, isRequired: false }
  ]
};

export const mockActiveProtocol = {
  id: TEST_PROTOCOLS.activeHydration.id,
  name: TEST_PROTOCOLS.activeHydration.name,
  description: 'Drink 8 glasses of water daily',
  status: 'active',
  icon: 'local_drink',
  isPublic: true,
  isOpen: true,
  organizationId: null,
  creatorId: TEST_USERS.productAdmin.id,
  targetDays: 21,
  rewards: { xp: 300, badge: 'Hydration Hero' },
  elements: [
    { id: 9013, title: 'Glasses of Water', type: 'range', minValue: 1, maxValue: 12, goal: 8, points: 10, isRequired: true }
  ],
  participantCount: 500
};

export const mockArchivedProtocol = {
  id: TEST_PROTOCOLS.archivedFitness.id,
  name: TEST_PROTOCOLS.archivedFitness.name,
  description: 'Complete daily fitness tasks',
  status: 'archived',
  icon: 'fitness_center',
  isPublic: true,
  isOpen: false,
  organizationId: TEST_PROTOCOLS.archivedFitness.organizationId,
  creatorId: TEST_USERS.productAdmin.id,
  targetDays: 30,
  rewards: { xp: 600, badge: 'Fitness Champion 2025' },
  elements: [
    { id: 9014, title: 'Workout Completed', type: 'check', points: 20, isRequired: true },
    { id: 9015, title: 'Minutes Exercised', type: 'timer', goal: 30, unit: 'minutes', points: 10, isRequired: false }
  ],
  participantCount: 1200
};

export const mockPrivateOrgProtocol = {
  id: TEST_PROTOCOLS.privateCompany.id,
  name: TEST_PROTOCOLS.privateCompany.name,
  description: 'Internal wellness tracking for employees',
  status: 'active',
  icon: 'corporate_fare',
  isPublic: false,
  isOpen: false,
  organizationId: TEST_PROTOCOLS.privateCompany.organizationId,
  organizationName: 'E2E Test Company Inc',
  creatorId: TEST_USERS.companyOwner.id,
  targetDays: 90,
  rewards: { xp: 1000 },
  elements: [
    { id: 9016, title: 'Daily Check-in', type: 'check', points: 5, isRequired: true },
    { id: 9017, title: 'Steps Walked', type: 'number', goal: 10000, unit: 'steps', points: 15, isRequired: false }
  ]
};

// ============================================================================
// INVITATION DATA (mock structure for tests that need it)
// Note: Actual invitations would need an invitations table in the database
// ============================================================================

export const mockActiveProductInvitation = {
  id: 'inv-001',
  token: 'e2e-product-invite-token-abc123',
  organizationId: TEST_ORGANIZATIONS.productOrg.id,
  organizationName: TEST_ORGANIZATIONS.productOrg.name,
  organizationType: 'product',
  role: 'member',
  email: null,
  expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  maxUses: 100,
  currentUses: 5,
  status: 'active',
  createdBy: TEST_USERS.productAdmin.id,
  inviterName: TEST_USERS.productAdmin.name,
  redirectBehavior: 'app'
};

export const mockActiveCompanyInvitation = {
  id: 'inv-002',
  token: 'e2e-company-invite-token-def456',
  organizationId: TEST_ORGANIZATIONS.companyOrg.id,
  organizationName: TEST_ORGANIZATIONS.companyOrg.name,
  organizationType: 'company',
  role: 'admin',
  email: 'newhire@e2etest.com',
  expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  maxUses: 1,
  currentUses: 0,
  status: 'active',
  createdBy: TEST_USERS.companyOwner.id,
  inviterName: TEST_USERS.companyOwner.name,
  redirectBehavior: 'admin'
};

export const mockExpiredInvitation = {
  id: 'inv-003',
  token: 'e2e-expired-invite-token-ghi789',
  organizationId: TEST_ORGANIZATIONS.productOrg.id,
  organizationName: TEST_ORGANIZATIONS.productOrg.name,
  organizationType: 'product',
  role: 'member',
  email: null,
  expiresAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
  maxUses: 10,
  currentUses: 0,
  status: 'expired',
  createdBy: TEST_USERS.productAdmin.id
};

export const mockExhaustedInvitation = {
  id: 'inv-004',
  token: 'e2e-exhausted-invite-token-jkl012',
  organizationId: TEST_ORGANIZATIONS.productOrg.id,
  organizationName: TEST_ORGANIZATIONS.productOrg.name,
  organizationType: 'product',
  role: 'member',
  email: null,
  expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  maxUses: 1,
  currentUses: 1,
  status: 'exhausted',
  createdBy: TEST_USERS.productAdmin.id
};

// Aliases
export const mockExpiredProductInvitation = mockExpiredInvitation;
export const code = mockActiveProductInvitation.token;

// ============================================================================
// LEADERBOARD DATA (from seeded participants)
// ============================================================================

export const mockProtocolLeaderboard = [
  { rank: 1, userId: TEST_USERS.friend1.id, name: TEST_USERS.friend1.name, avatarUrl: null, totalPoints: 60, activeDays: 7, isCurrentUser: false },
  { rank: 2, userId: TEST_USERS.anonymousUser.id, name: 'Anonymous', avatarUrl: null, totalPoints: 45, activeDays: 5, isCurrentUser: false },
  { rank: 3, userId: TEST_USERS.testUser.id, name: TEST_USERS.testUser.name, avatarUrl: null, totalPoints: 40, activeDays: 5, isCurrentUser: true },
  { rank: 4, userId: TEST_USERS.friend2.id, name: TEST_USERS.friend2.name, avatarUrl: null, totalPoints: 35, activeDays: 6, isCurrentUser: false }
];

export const mockOrganizationLeaderboard = [
  { rank: 1, userId: TEST_USERS.companyOwner.id, name: TEST_USERS.companyOwner.name, avatarUrl: null, totalPoints: 100, activeDays: 30, isCurrentUser: false },
  { rank: 2, userId: TEST_USERS.companyAdmin.id, name: TEST_USERS.companyAdmin.name, avatarUrl: null, totalPoints: 85, activeDays: 28, isCurrentUser: false },
  { rank: 3, userId: TEST_USERS.testUser.id, name: TEST_USERS.testUser.name, avatarUrl: null, totalPoints: 70, activeDays: 25, isCurrentUser: true }
];

export const mockGlobalLeaderboard = [
  { rank: 1, userId: TEST_USERS.superAdmin.id, name: TEST_USERS.superAdmin.name, avatarUrl: null, totalPoints: 5000, protocolsJoined: 12, isCurrentUser: false },
  { rank: 2, userId: TEST_USERS.friend1.id, name: TEST_USERS.friend1.name, avatarUrl: null, totalPoints: 4500, protocolsJoined: 10, isCurrentUser: false },
  { rank: 3, userId: TEST_USERS.anonymousUser.id, name: 'Anonymous', avatarUrl: null, totalPoints: 4200, protocolsJoined: 9, isCurrentUser: false }
];

// ============================================================================
// AUTH RESPONSE HELPER (for API testing)
// ============================================================================

export function createAuthResponse(user: any) {
  return {
    accessToken: `e2e_jwt_token_${user.id}`,
    refreshToken: `e2e_refresh_token_${user.id}`,
    user
  };
}

// ============================================================================
// HELPER FUNCTIONS (Seed-Based - No Mocking)
// ============================================================================

/**
 * Setup is now handled by global-setup.ts which seeds the database
 * These functions are kept for backwards compatibility but don't mock anymore
 */

export async function setupMockAuth(page: Page, user: any) {
  // No-op: Authentication now uses real API with seeded users
  // Just log in with the user's actual credentials
  console.log(`[Test Helper] Using seeded user: ${user.email}`);
}

export async function setupMockOrganizations(page: Page) {
  // No-op: Organizations are seeded in the database
  console.log('[Test Helper] Organizations loaded from seed data');
}

export async function setupMockInvitations(page: Page) {
  // No-op: Invitations would be seeded if the table exists
  console.log('[Test Helper] Invitations loaded from seed data (if table exists)');
}

export async function setupMockProtocols(page: Page) {
  // No-op: Protocols/Challenges are seeded in the database
  console.log('[Test Helper] Protocols loaded from seed data');
}

export async function setupMockAdmin(page: Page) {
  // No-op: Admin data comes from seeded users with admin roles
  console.log('[Test Helper] Admin data loaded from seed');
}

/**
 * Login as a specific user using real authentication
 */
export async function loginAsUser(page: Page, user: any) {
  await login(page, { email: user.email, password: 'admin' });
}

/**
 * Login as super admin
 */
export async function loginAsAdmin(page: Page) {
  // Use admin dashboard login on port 3002
  await loginToAdminDashboard(page, TEST_USERS.superAdmin);
}

/**
 * Login as product admin
 */
export async function loginAsProductAdmin(page: Page) {
  await loginAsUser(page, TEST_USERS.productAdmin);
}

/**
 * Login as company owner
 */
export async function loginAsCompanyOwner(page: Page) {
  await loginAsUser(page, TEST_USERS.companyOwner);
}

/**
 * Login as company admin
 */
export async function loginAsCompanyAdmin(page: Page) {
  await loginAsUser(page, TEST_USERS.companyAdmin);
}

/**
 * Login as regular user
 */
export async function loginAsRegularUser(page: Page) {
  await loginAsUser(page, TEST_USERS.testUser);
}

// ============================================================================
// API HELPERS FOR REAL DATABASE TESTS
// ============================================================================

/**
 * Get organizations from API
 */
export async function getOrganizations(request: APIRequestContext, token: string) {
  return await apiRequest(request, '/api/organizations', token);
}

/**
 * Get organization members
 */
export async function getOrganizationMembers(request: APIRequestContext, token: string, orgId: string) {
  return await apiRequest(request, `/api/organizations/${orgId}/members`, token);
}

/**
 * Get protocols/challenges from API
 */
export async function getProtocols(request: APIRequestContext, token: string) {
  return await apiRequest(request, '/api/protocols', token);
}

/**
 * Get leaderboard from API
 */
export async function getLeaderboard(request: APIRequestContext, token: string, protocolId?: number) {
  const endpoint = protocolId 
    ? `/api/protocols/${protocolId}/leaderboard`
    : '/api/leaderboard';
  return await apiRequest(request, endpoint, token);
}

/**
 * Join a protocol/challenge
 */
export async function joinProtocol(request: APIRequestContext, token: string, protocolId: number) {
  return await apiRequest(request, `/api/protocols/${protocolId}/join`, token, 'POST');
}

/**
 * Leave a protocol/challenge
 */
export async function leaveProtocol(request: APIRequestContext, token: string, protocolId: number) {
  return await apiRequest(request, `/api/protocols/${protocolId}/leave`, token, 'POST');
}

/**
 * Get admin stats
 */
export async function getAdminStats(request: APIRequestContext, token: string) {
  return await apiRequest(request, '/api/admin/stats', token);
}

/**
 * Get audit logs
 */
export async function getAuditLogs(request: APIRequestContext, token: string) {
  return await apiRequest(request, '/api/admin/audit', token);
}

// ============================================================================
// NAVIGATION HELPERS
// ============================================================================

/**
 * Navigate to admin panel
 */
export async function goToAdminPanel(page: Page) {
  await page.goto(ADMIN_DASHBOARD_URL);
  await page.waitForLoadState('networkidle');
}

/**
 * Navigate to organization settings
 */
export async function goToOrganizationSettings(page: Page, orgId: string) {
  // Use absolute URL for Admin App
  await page.goto(`${ADMIN_DASHBOARD_URL}/organizations`);
  await page.waitForLoadState('networkidle');
}

/**
 * Navigate to protocol management
 */
export async function goToProtocolManagement(page: Page) {
  await page.goto(`${ADMIN_DASHBOARD_URL}/protocols`);
  await page.waitForLoadState('networkidle');
}

/**
 * Navigate to user management
 */
export async function goToUserManagement(page: Page) {
  await page.goto(`${ADMIN_DASHBOARD_URL}/users`);
  await page.waitForLoadState('networkidle');
}

// ============================================================================
// ASSERTION HELPERS
// ============================================================================

/**
 * Check if user has admin access
 */
export async function hasAdminAccess(page: Page): Promise<boolean> {
  const adminLink = page.locator('a[href*="admin"], button:has-text("Admin")');
  return await adminLink.isVisible().catch(() => false);
}

/**
 * Check if user can see organization
 */
export async function canSeeOrganization(page: Page, orgName: string): Promise<boolean> {
  const orgElement = page.locator(`text=${orgName}`);
  return await orgElement.isVisible().catch(() => false);
}

/**
 * Check if user can see protocol
 */
export async function canSeeProtocol(page: Page, protocolName: string): Promise<boolean> {
  const protocolElement = page.locator(`text=${protocolName}`);
  return await protocolElement.isVisible().catch(() => false);
}
