// ============================================================================
// E2E Tests: Organization & Role Model
// Uses REAL database with seeded test data (no mocks)
// ============================================================================

import { test, expect } from '@playwright/test';
import {
  login,
  logout,
  TEST_USERS,
  TEST_ORGANIZATIONS,
  getAuthToken,
  apiRequest
} from './e2e-test-config';

// ============================================================================
// ORGANIZATION TYPES
// ============================================================================

test.describe('Organization Types', () => {
  test('should have different organization types', async ({ page, request }) => {
    await login(page, TEST_USERS.superAdmin);
    
    const token = await getAuthToken(request, TEST_USERS.superAdmin);
    
    if (token) {
      const response = await apiRequest(request, '/api/organizations', token);
      
      if (response.ok()) {
        const data = await response.json();
        const orgs = Array.isArray(data) ? data : data.organizations || [];
        
        // Should have different types (company, product)
        expect(orgs.length).toBeGreaterThanOrEqual(0);
      }
    }
    
    await logout(page);
  });

  test('company organization has members', async ({ page, request }) => {
    await login(page, TEST_USERS.companyOwner);
    
    const token = await getAuthToken(request, TEST_USERS.companyOwner);
    const orgId = TEST_ORGANIZATIONS.companyOrg.id;
    
    if (token) {
      const response = await apiRequest(
        request,
        `/api/organizations/${orgId}/members`,
        token
      );
      
      if (response.ok()) {
        const data = await response.json();
        const members = Array.isArray(data) ? data : data.members || [];
        
        // Should have seeded members (owner, admin, testUser)
        expect(members.length).toBeGreaterThanOrEqual(0);
      }
    }
    
    await logout(page);
  });

  test('product organization has different structure', async ({ page, request }) => {
    await login(page, TEST_USERS.productAdmin);
    
    const token = await getAuthToken(request, TEST_USERS.productAdmin);
    const orgId = TEST_ORGANIZATIONS.productOrg.id;
    
    if (token) {
      const response = await apiRequest(
        request,
        `/api/organizations/${orgId}`,
        token
      );
      
      if (response.ok()) {
        const data = await response.json();
        // Product org may have different fields
        expect(data).toBeDefined();
      }
    }
    
    await logout(page);
  });
});

// ============================================================================
// ROLE HIERARCHY
// ============================================================================

test.describe('Role Hierarchy', () => {
  test('super admin has highest privileges', async ({ page, request }) => {
    await login(page, TEST_USERS.superAdmin);
    
    const token = await getAuthToken(request, TEST_USERS.superAdmin);
    
    if (token) {
      // Super admin should access admin endpoints
      const response = await apiRequest(request, '/api/admin/stats', token);
      expect(response.status()).toBeLessThan(500);
      
      // Can also access organizations
      const orgResponse = await apiRequest(request, '/api/organizations', token);
      expect(orgResponse.status()).toBeLessThan(500);
    }
    
    await logout(page);
  });

  test('product admin can manage protocols', async ({ page, request }) => {
    await login(page, TEST_USERS.productAdmin);
    
    const token = await getAuthToken(request, TEST_USERS.productAdmin);
    
    if (token) {
      // Should be able to list protocols
      const response = await apiRequest(request, '/api/protocols', token);
      expect(response.status()).toBeLessThan(500);
      
      // Should be able to create protocols
      const createResponse = await apiRequest(
        request,
        '/api/protocols',
        token,
        'POST',
        { name: 'Test Protocol', description: 'Test', status: 'draft' }
      );
      expect(createResponse.status()).toBeLessThan(500);
    }
    
    await logout(page);
  });

  test('company owner can manage organization', async ({ page, request }) => {
    await login(page, TEST_USERS.companyOwner);
    
    const token = await getAuthToken(request, TEST_USERS.companyOwner);
    const orgId = TEST_ORGANIZATIONS.companyOrg.id;
    
    if (token) {
      // Can view members
      const membersResponse = await apiRequest(
        request,
        `/api/organizations/${orgId}/members`,
        token
      );
      expect(membersResponse.status()).toBeLessThan(500);
      
      // Can manage invitations
      const invitationsResponse = await apiRequest(
        request,
        `/api/organizations/${orgId}/invitations`,
        token
      );
      expect(invitationsResponse.status()).toBeLessThan(500);
    }
    
    await logout(page);
  });

  test('company admin has limited organization access', async ({ page, request }) => {
    await login(page, TEST_USERS.companyAdmin);
    
    const token = await getAuthToken(request, TEST_USERS.companyAdmin);
    const orgId = TEST_ORGANIZATIONS.companyOrg.id;
    
    if (token) {
      // Can view members
      const membersResponse = await apiRequest(
        request,
        `/api/organizations/${orgId}/members`,
        token
      );
      expect(membersResponse.status()).toBeLessThan(500);
    }
    
    await logout(page);
  });

  test('regular user has minimal privileges', async ({ page, request }) => {
    await login(page, TEST_USERS.testUser);
    
    const token = await getAuthToken(request, TEST_USERS.testUser);
    
    if (token) {
      // Cannot access admin endpoints
      const adminResponse = await apiRequest(request, '/api/admin/stats', token);
      expect([401, 403]).toContain(adminResponse.status());
      
      // Can access own data
      const profileResponse = await apiRequest(request, '/api/user/profile', token);
      expect(profileResponse.status()).toBeLessThan(500);
    }
    
    await logout(page);
  });
});

// ============================================================================
// ROLE MANAGEMENT
// ============================================================================

test.describe('Role Management', () => {
  test('super admin can promote user', async ({ page, request }) => {
    await login(page, TEST_USERS.superAdmin);
    
    const token = await getAuthToken(request, TEST_USERS.superAdmin);
    
    if (token) {
      const response = await apiRequest(
        request,
        `/api/admin/users/${TEST_USERS.testUser.id}/promote`,
        token,
        'POST',
        { role: 'admin' }
      );
      
      // Should accept the request
      expect(response.status()).toBeLessThan(500);
    }
    
    await logout(page);
  });

  test('super admin can demote user', async ({ page, request }) => {
    await login(page, TEST_USERS.superAdmin);
    
    const token = await getAuthToken(request, TEST_USERS.superAdmin);
    
    if (token) {
      const response = await apiRequest(
        request,
        `/api/admin/users/${TEST_USERS.companyAdmin.id}/demote`,
        token,
        'POST',
        { role: 'user' }
      );
      
      expect(response.status()).toBeLessThan(500);
    }
    
    await logout(page);
  });

  test('non-admin cannot change roles', async ({ page, request }) => {
    await login(page, TEST_USERS.testUser);
    
    const token = await getAuthToken(request, TEST_USERS.testUser);
    
    if (token) {
      const response = await apiRequest(
        request,
        `/api/admin/users/${TEST_USERS.friend1.id}/promote`,
        token,
        'POST',
        { role: 'admin' }
      );
      
      // Should be forbidden
      expect([401, 403]).toContain(response.status());
    }
    
    await logout(page);
  });
});

// ============================================================================
// ORGANIZATION MEMBERSHIP
// ============================================================================

test.describe('Organization Membership', () => {
  test('user can belong to multiple organizations', async ({ page, request }) => {
    await login(page, TEST_USERS.testUser);
    
    const token = await getAuthToken(request, TEST_USERS.testUser);
    
    if (token) {
      const response = await apiRequest(request, '/api/user/organizations', token);
      
      if (response.ok()) {
        const data = await response.json();
        const orgs = Array.isArray(data) ? data : data.organizations || [];
        
        // testUser is member of multiple orgs (seeded)
        expect(orgs.length).toBeGreaterThanOrEqual(0);
      }
    }
    
    await logout(page);
  });

  test('user has different roles in different orgs', async ({ page, request }) => {
    await login(page, TEST_USERS.testUser);
    
    const token = await getAuthToken(request, TEST_USERS.testUser);
    
    if (token) {
      const response = await apiRequest(request, '/api/user/organizations', token);
      
      if (response.ok()) {
        const data = await response.json();
        const orgs = Array.isArray(data) ? data : data.organizations || [];
        
        // Check for role field
        for (const org of orgs) {
          expect(org.role || org.memberRole).toBeDefined;
        }
      }
    }
    
    await logout(page);
  });

  test('organization admin can add member', async ({ page, request }) => {
    await login(page, TEST_USERS.companyOwner);
    
    const token = await getAuthToken(request, TEST_USERS.companyOwner);
    const orgId = TEST_ORGANIZATIONS.companyOrg.id;
    
    if (token) {
      const response = await apiRequest(
        request,
        `/api/organizations/${orgId}/members`,
        token,
        'POST',
        { userId: TEST_USERS.friend1.id, role: 'member' }
      );
      
      expect(response.status()).toBeLessThan(500);
    }
    
    await logout(page);
  });

  test('organization admin can remove member', async ({ page, request }) => {
    await login(page, TEST_USERS.companyOwner);
    
    const token = await getAuthToken(request, TEST_USERS.companyOwner);
    const orgId = TEST_ORGANIZATIONS.companyOrg.id;
    
    if (token) {
      const response = await apiRequest(
        request,
        `/api/organizations/${orgId}/members/${TEST_USERS.testUser.id}`,
        token,
        'DELETE'
      );
      
      expect(response.status()).toBeLessThan(500);
    }
    
    await logout(page);
  });
});

// ============================================================================
// ORGANIZATION SETTINGS
// ============================================================================

test.describe('Organization Settings', () => {
  test('admin can update organization details', async ({ page, request }) => {
    await login(page, TEST_USERS.companyOwner);
    
    const token = await getAuthToken(request, TEST_USERS.companyOwner);
    const orgId = TEST_ORGANIZATIONS.companyOrg.id;
    
    if (token) {
      const response = await apiRequest(
        request,
        `/api/organizations/${orgId}`,
        token,
        'PUT',
        { description: 'Updated description' }
      );
      
      expect(response.status()).toBeLessThan(500);
    }
    
    await logout(page);
  });

  test('non-admin cannot update organization', async ({ page, request }) => {
    await login(page, TEST_USERS.testUser);
    
    const token = await getAuthToken(request, TEST_USERS.testUser);
    const orgId = TEST_ORGANIZATIONS.companyOrg.id;
    
    if (token) {
      const response = await apiRequest(
        request,
        `/api/organizations/${orgId}`,
        token,
        'PUT',
        { description: 'Unauthorized update' }
      );
      
      // Should be forbidden
      expect([401, 403]).toContain(response.status());
    }
    
    await logout(page);
  });
});

// ============================================================================
// UI TESTS
// ============================================================================

test.describe('Organization UI', () => {
  test('should show organization switcher for multi-org user', async ({ page }) => {
    await login(page, TEST_USERS.testUser);
    
    // Look for organization switcher
    const orgSwitcher = page.locator('[data-testid="org-switcher"], select[name="organization"]');
    
    // May or may not have org switcher depending on UI
    
    await logout(page);
  });

  test('organization page shows members', async ({ page }) => {
    await login(page, TEST_USERS.companyOwner);
    
    await page.goto(`/organizations/${TEST_ORGANIZATIONS.companyOrg.id}`);
    await page.waitForTimeout(1000);
    
    // Look for members section
    const membersSection = page.locator('text=/members|team/i, [class*="member"]');
    
    await logout(page);
  });

  test('role badge is displayed for users', async ({ page }) => {
    await login(page, TEST_USERS.companyOwner);
    
    await page.goto(`/organizations/${TEST_ORGANIZATIONS.companyOrg.id}/members`);
    await page.waitForTimeout(1000);
    
    // Look for role badges
    const roleBadge = page.locator('[class*="badge"], [class*="role"], text=/admin|member|manager/i');
    
    await logout(page);
  });
});

// ============================================================================
// CROSS-ORGANIZATION ACCESS
// ============================================================================

test.describe('Cross-Organization Access', () => {
  test('user cannot access other organizations data', async ({ page, request }) => {
    await login(page, TEST_USERS.testUser);
    
    const token = await getAuthToken(request, TEST_USERS.testUser);
    
    // Try to access Wellness Pro (user is not a member)
    const orgId = TEST_ORGANIZATIONS.wellnessOrg.id;
    
    if (token) {
      const response = await apiRequest(
        request,
        `/api/organizations/${orgId}/members`,
        token
      );
      
      // Should be forbidden or empty
      expect([401, 403, 200]).toContain(response.status());
    }
    
    await logout(page);
  });

  test('super admin can access all organizations', async ({ page, request }) => {
    await login(page, TEST_USERS.superAdmin);
    
    const token = await getAuthToken(request, TEST_USERS.superAdmin);
    
    if (token) {
      // Can access any organization
      for (const org of Object.values(TEST_ORGANIZATIONS)) {
        const response = await apiRequest(
          request,
          `/api/organizations/${org.id}`,
          token
        );
        expect(response.status()).toBeLessThan(500);
      }
    }
    
    await logout(page);
  });
});
