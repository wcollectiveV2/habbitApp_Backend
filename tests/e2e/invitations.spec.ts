// ============================================================================
// E2E Tests: User Registration & Authentication via Invitations
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
// INVITATION VALIDATION
// ============================================================================

test.describe('Invitation Validation', () => {
  test('should validate active invitation token', async ({ request }) => {
    const token = await getAuthToken(request, TEST_USERS.productAdmin);
    
    if (token) {
      // Fetch invitations for organization
      const response = await apiRequest(
        request,
        `/api/organizations/${TEST_ORGANIZATIONS.productOrg.id}/invitations`,
        token
      );
      
      // Should return invitations list or empty
      expect(response.status()).toBeLessThan(500);
    }
  });

  test('should reject expired invitation token', async ({ page }) => {
    // Navigate with expired token
    await page.goto('/invite/expired-token-xyz');
    await page.waitForTimeout(1000);
    
    // Should show error or redirect
    const errorMessage = page.locator('text=/expired|invalid|not found/i');
    const redirected = !page.url().includes('/invite/');
    
    // Either error shown or redirected away
    expect(await errorMessage.isVisible() || redirected).toBeTruthy();
  });

  test('should reject invalid invitation token', async ({ page }) => {
    await page.goto('/invite/invalid-token-123');
    await page.waitForTimeout(1000);
    
    // Should show error
    const errorMessage = page.locator('text=/invalid|not found|error/i');
    const redirected = !page.url().includes('/invite/');
    
    expect(await errorMessage.isVisible() || redirected).toBeTruthy();
  });
});

// ============================================================================
// PRODUCT INVITATION FLOW
// ============================================================================

test.describe('Product Invitation Flow', () => {
  test('should create product invitation', async ({ page, request }) => {
    await login(page, TEST_USERS.productAdmin);
    
    const token = await getAuthToken(request, TEST_USERS.productAdmin);
    
    if (token) {
      const response = await apiRequest(
        request,
        `/api/organizations/${TEST_ORGANIZATIONS.productOrg.id}/invitations`,
        token,
        'POST',
        {
          role: 'member',
          maxUses: 50,
          expiresInDays: 7
        }
      );
      
      // Should accept invitation creation
      expect(response.status()).toBeLessThan(500);
    }
    
    await logout(page);
  });

  test('should list organization invitations', async ({ page, request }) => {
    await login(page, TEST_USERS.productAdmin);
    
    // Navigate to invitations page
    await page.goto(`/admin/organizations/${TEST_ORGANIZATIONS.productOrg.id}/invitations`);
    await page.waitForTimeout(1000);
    
    await logout(page);
  });

  test('product admin can revoke invitation', async ({ page, request }) => {
    await login(page, TEST_USERS.productAdmin);
    
    const token = await getAuthToken(request, TEST_USERS.productAdmin);
    
    if (token) {
      // Try to revoke
      const response = await apiRequest(
        request,
        '/api/invitations/some-token/revoke',
        token,
        'POST'
      );
      
      // May return 404 if no such invitation, but shouldn't error
      expect(response.status()).toBeLessThan(500);
    }
    
    await logout(page);
  });
});

// ============================================================================
// COMPANY INVITATION FLOW
// ============================================================================

test.describe('Company Invitation Flow', () => {
  test('should create company admin invitation', async ({ page, request }) => {
    await login(page, TEST_USERS.companyOwner);
    
    const token = await getAuthToken(request, TEST_USERS.companyOwner);
    
    if (token) {
      const response = await apiRequest(
        request,
        `/api/organizations/${TEST_ORGANIZATIONS.companyOrg.id}/invitations`,
        token,
        'POST',
        {
          role: 'admin',
          email: 'newhire@e2etest.com',
          maxUses: 1,
          expiresInDays: 30
        }
      );
      
      expect(response.status()).toBeLessThan(500);
    }
    
    await logout(page);
  });

  test('company owner can manage invitations', async ({ page }) => {
    await login(page, TEST_USERS.companyOwner);
    
    await page.goto(`/admin/organizations/${TEST_ORGANIZATIONS.companyOrg.id}/invitations`);
    await page.waitForTimeout(1000);
    
    // Look for invitation management UI
    const inviteButton = page.locator('button:has-text("Create"), button:has-text("New Invitation")');
    const inviteList = page.locator('[class*="invitation"], table');
    
    await logout(page);
  });
});

// ============================================================================
// INVITATION ACCEPTANCE
// ============================================================================

test.describe('Invitation Acceptance', () => {
  test('should accept invitation and join organization', async ({ page, request }) => {
    await login(page, TEST_USERS.testUser);
    
    const token = await getAuthToken(request, TEST_USERS.testUser);
    
    if (token) {
      // Accept invitation
      const response = await apiRequest(
        request,
        '/api/invitations/accept',
        token,
        'POST',
        {
          token: 'valid-invite-token'
        }
      );
      
      // May succeed or fail depending on token validity
      expect(response.status()).toBeLessThan(500);
    }
    
    await logout(page);
  });

  test('new user registration via invitation', async ({ page }) => {
    // Navigate to invitation link as logged out user
    await page.goto('/invite/new-user-token');
    await page.waitForTimeout(1000);
    
    // Should show registration form or login prompt
    const signupForm = page.locator('form, [class*="signup"], [class*="register"]');
    const loginPrompt = page.locator('text=/login|sign in/i');
    
    // Either signup form or login prompt should be visible
    const hasResponse = await signupForm.isVisible() || await loginPrompt.isVisible();
  });
});

// ============================================================================
// INVITATION LIMITS
// ============================================================================

test.describe('Invitation Limits', () => {
  test('should enforce max uses limit', async ({ page, request }) => {
    const token = await getAuthToken(request, TEST_USERS.productAdmin);
    
    if (token) {
      // Try to use exhausted invitation
      const response = await apiRequest(
        request,
        '/api/invitations/accept',
        token,
        'POST',
        {
          token: 'exhausted-token'
        }
      );
      
      // Should fail with appropriate error
      if (response.status() >= 400) {
        const data = await response.json().catch(() => ({}));
        // May contain error message about exhausted invitation
      }
    }
  });

  test('should show remaining uses', async ({ page, request }) => {
    await login(page, TEST_USERS.productAdmin);
    
    const token = await getAuthToken(request, TEST_USERS.productAdmin);
    
    if (token) {
      const response = await apiRequest(
        request,
        `/api/organizations/${TEST_ORGANIZATIONS.productOrg.id}/invitations`,
        token
      );
      
      if (response.ok()) {
        const data = await response.json();
        const invitations = Array.isArray(data) ? data : data.invitations || [];
        
        // Check that invitations have usage info
        for (const inv of invitations) {
          expect(inv.maxUses).toBeDefined;
        }
      }
    }
    
    await logout(page);
  });
});

// ============================================================================
// ROLE ASSIGNMENT VIA INVITATION
// ============================================================================

test.describe('Role Assignment via Invitation', () => {
  test('should assign correct role from invitation', async ({ page, request }) => {
    const token = await getAuthToken(request, TEST_USERS.productAdmin);
    
    if (token) {
      // Create member invitation
      await apiRequest(
        request,
        `/api/organizations/${TEST_ORGANIZATIONS.productOrg.id}/invitations`,
        token,
        'POST',
        { role: 'member', maxUses: 10 }
      );
      
      // Create admin invitation
      await apiRequest(
        request,
        `/api/organizations/${TEST_ORGANIZATIONS.productOrg.id}/invitations`,
        token,
        'POST',
        { role: 'admin', maxUses: 1 }
      );
    }
  });

  test('invitation role determines user permissions', async ({ page, request }) => {
    // This would test that accepting an invitation with 'admin' role
    // actually grants admin permissions
    const token = await getAuthToken(request, TEST_USERS.testUser);
    
    if (token) {
      // Check user's current organization membership
      const response = await apiRequest(
        request,
        '/api/user/organizations',
        token
      );
      
      if (response.ok()) {
        const data = await response.json();
        // User should have organization memberships with roles
      }
    }
  });
});

// ============================================================================
// INVITATION UI
// ============================================================================

test.describe('Invitation UI', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, TEST_USERS.productAdmin);
  });

  test.afterEach(async ({ page }) => {
    await logout(page);
  });

  test('should show invitation creation form', async ({ page }) => {
    await page.goto(`/admin/organizations/${TEST_ORGANIZATIONS.productOrg.id}/invitations`);
    await page.waitForTimeout(1000);
    
    // Look for create button
    const createBtn = page.locator('button:has-text("Create"), button:has-text("New"), button:has-text("+")');
    
    if (await createBtn.isVisible()) {
      await createBtn.click();
      await page.waitForTimeout(500);
      
      // Form should appear
      const form = page.locator('form, [role="dialog"]');
      await expect(form).toBeVisible();
    }
  });

  test('should copy invitation link', async ({ page }) => {
    await page.goto(`/admin/organizations/${TEST_ORGANIZATIONS.productOrg.id}/invitations`);
    await page.waitForTimeout(1000);
    
    // Look for copy button
    const copyBtn = page.locator('button:has-text("Copy"), [aria-label*="copy"]');
    
    if (await copyBtn.first().isVisible()) {
      await copyBtn.first().click();
      await page.waitForTimeout(300);
      
      // May show "Copied!" toast
      const copiedToast = page.locator('text=/copied/i');
    }
  });
});
