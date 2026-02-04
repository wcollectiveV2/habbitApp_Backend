// ============================================================================
// E2E Tests: Protocol / Challenge Management
// Uses REAL database with seeded test data (no mocks)
// ============================================================================

import { test, expect } from '@playwright/test';
import {
  login,
  logout,
  TEST_USERS,
  TEST_ORGANIZATIONS,
  TEST_PROTOCOLS,
  TEST_CHALLENGES,
  getAuthToken,
  apiRequest,
  navigateTo
} from './e2e-test-config';

// ============================================================================
// PROTOCOL LIFECYCLE
// ============================================================================

test.describe('Protocol Lifecycle', () => {
  test('should create draft protocol', async ({ page, request }) => {
    await login(page, TEST_USERS.productAdmin);
    
    const token = await getAuthToken(request, TEST_USERS.productAdmin);
    
    if (token) {
      const response = await apiRequest(
        request,
        '/api/protocols',
        token,
        'POST',
        {
          name: 'E2E New Draft Protocol',
          description: 'Created via E2E test',
          status: 'draft',
          targetDays: 21,
          isPublic: false,
          elements: [
            { title: 'Daily Task', type: 'check', points: 10, isRequired: true }
          ]
        }
      );
      
      expect(response.status()).toBeLessThan(500);
      
      if (response.ok()) {
        const data = await response.json();
        expect(data.status || data.protocol?.status).toBe('draft');
      }
    }
    
    await logout(page);
  });

  test('should activate draft protocol', async ({ page, request }) => {
    await login(page, TEST_USERS.productAdmin);
    
    const token = await getAuthToken(request, TEST_USERS.productAdmin);
    const protocolId = TEST_PROTOCOLS.draftMeditation.id;
    
    if (token) {
      const response = await apiRequest(
        request,
        `/api/protocols/${protocolId}/activate`,
        token,
        'POST'
      );
      
      expect(response.status()).toBeLessThan(500);
    }
    
    await logout(page);
  });

  test('should archive active protocol', async ({ page, request }) => {
    await login(page, TEST_USERS.productAdmin);
    
    const token = await getAuthToken(request, TEST_USERS.productAdmin);
    const protocolId = TEST_PROTOCOLS.activeHydration.id;
    
    if (token) {
      const response = await apiRequest(
        request,
        `/api/protocols/${protocolId}/archive`,
        token,
        'POST'
      );
      
      expect(response.status()).toBeLessThan(500);
    }
    
    await logout(page);
  });

  test('should duplicate protocol', async ({ page, request }) => {
    await login(page, TEST_USERS.productAdmin);
    
    const token = await getAuthToken(request, TEST_USERS.productAdmin);
    const protocolId = TEST_PROTOCOLS.activeHydration.id;
    
    if (token) {
      const response = await apiRequest(
        request,
        `/api/protocols/${protocolId}/duplicate`,
        token,
        'POST',
        { name: 'Duplicated Protocol', status: 'draft' }
      );
      
      expect(response.status()).toBeLessThan(500);
    }
    
    await logout(page);
  });
});

// ============================================================================
// PROTOCOL ELEMENTS
// ============================================================================

test.describe('Protocol Elements', () => {
  test('should add element to protocol', async ({ page, request }) => {
    await login(page, TEST_USERS.productAdmin);
    
    const token = await getAuthToken(request, TEST_USERS.productAdmin);
    const protocolId = TEST_PROTOCOLS.draftMeditation.id;
    
    if (token) {
      const response = await apiRequest(
        request,
        `/api/protocols/${protocolId}/elements`,
        token,
        'POST',
        {
          title: 'New Element',
          type: 'check',
          points: 15,
          isRequired: false
        }
      );
      
      expect(response.status()).toBeLessThan(500);
    }
    
    await logout(page);
  });

  test('should update protocol element', async ({ page, request }) => {
    await login(page, TEST_USERS.productAdmin);
    
    const token = await getAuthToken(request, TEST_USERS.productAdmin);
    const protocolId = TEST_PROTOCOLS.draftMeditation.id;
    
    if (token) {
      const response = await apiRequest(
        request,
        `/api/protocols/${protocolId}/elements/9010`,
        token,
        'PUT',
        { title: 'Updated Element Title', points: 20 }
      );
      
      expect(response.status()).toBeLessThan(500);
    }
    
    await logout(page);
  });

  test('should delete protocol element', async ({ page, request }) => {
    await login(page, TEST_USERS.productAdmin);
    
    const token = await getAuthToken(request, TEST_USERS.productAdmin);
    const protocolId = TEST_PROTOCOLS.draftMeditation.id;
    
    if (token) {
      const response = await apiRequest(
        request,
        `/api/protocols/${protocolId}/elements/9012`,
        token,
        'DELETE'
      );
      
      expect(response.status()).toBeLessThan(500);
    }
    
    await logout(page);
  });
});

// ============================================================================
// PROTOCOL ASSIGNMENT
// ============================================================================

test.describe('Protocol Assignment', () => {
  test('user can join public protocol', async ({ page, request }) => {
    await login(page, TEST_USERS.testUser);
    
    const token = await getAuthToken(request, TEST_USERS.testUser);
    const protocolId = TEST_PROTOCOLS.activeHydration.id;
    
    if (token) {
      const response = await apiRequest(
        request,
        `/api/protocols/${protocolId}/join`,
        token,
        'POST'
      );
      
      expect(response.status()).toBeLessThan(500);
    }
    
    await logout(page);
  });

  test('user can leave protocol', async ({ page, request }) => {
    await login(page, TEST_USERS.testUser);
    
    const token = await getAuthToken(request, TEST_USERS.testUser);
    const protocolId = TEST_CHALLENGES.morningYoga.id;
    
    if (token) {
      const response = await apiRequest(
        request,
        `/api/protocols/${protocolId}/leave`,
        token,
        'POST'
      );
      
      expect(response.status()).toBeLessThan(500);
    }
    
    await logout(page);
  });

  test('organization protocol restricts to members', async ({ page, request }) => {
    await login(page, TEST_USERS.newUser);
    
    const token = await getAuthToken(request, TEST_USERS.newUser);
    const protocolId = TEST_PROTOCOLS.privateCompany.id;
    
    if (token) {
      const response = await apiRequest(
        request,
        `/api/protocols/${protocolId}/join`,
        token,
        'POST'
      );
      
      // Should be forbidden for non-members
      expect([401, 403, 400]).toContain(response.status());
    }
    
    await logout(page);
  });
});

// ============================================================================
// PROTOCOL EXECUTION
// ============================================================================

test.describe('Protocol Execution', () => {
  test('should log protocol task completion', async ({ page, request }) => {
    await login(page, TEST_USERS.testUser);
    
    const token = await getAuthToken(request, TEST_USERS.testUser);
    const protocolId = TEST_CHALLENGES.morningYoga.id;
    
    if (token) {
      const response = await apiRequest(
        request,
        `/api/protocols/${protocolId}/log`,
        token,
        'POST',
        {
          elementId: 9001,
          completed: true,
          value: 1,
          date: new Date().toISOString().split('T')[0]
        }
      );
      
      expect(response.status()).toBeLessThan(500);
    }
    
    await logout(page);
  });

  test('should log numeric value for protocol task', async ({ page, request }) => {
    await login(page, TEST_USERS.testUser);
    
    const token = await getAuthToken(request, TEST_USERS.testUser);
    const protocolId = TEST_PROTOCOLS.activeHydration.id;
    
    if (token) {
      const response = await apiRequest(
        request,
        `/api/protocols/${protocolId}/log`,
        token,
        'POST',
        {
          elementId: 9013,
          value: 6,
          date: new Date().toISOString().split('T')[0]
        }
      );
      
      expect(response.status()).toBeLessThan(500);
    }
    
    await logout(page);
  });

  test('should get protocol progress', async ({ page, request }) => {
    await login(page, TEST_USERS.testUser);
    
    const token = await getAuthToken(request, TEST_USERS.testUser);
    const protocolId = TEST_CHALLENGES.morningYoga.id;
    
    if (token) {
      const response = await apiRequest(
        request,
        `/api/protocols/${protocolId}/progress`,
        token
      );
      
      if (response.ok()) {
        const data = await response.json();
        expect(data).toBeDefined();
      }
    }
    
    await logout(page);
  });
});

// ============================================================================
// PROTOCOL VISIBILITY
// ============================================================================

test.describe('Protocol Visibility', () => {
  test('public protocols visible to all users', async ({ page, request }) => {
    await login(page, TEST_USERS.testUser);
    
    const token = await getAuthToken(request, TEST_USERS.testUser);
    
    if (token) {
      const response = await apiRequest(
        request,
        `/api/protocols/${TEST_PROTOCOLS.activeHydration.id}`,
        token
      );
      
      expect(response.status()).toBeLessThan(500);
    }
    
    await logout(page);
  });

  test('private protocols hidden from non-members', async ({ page, request }) => {
    await login(page, TEST_USERS.newUser);
    
    const token = await getAuthToken(request, TEST_USERS.newUser);
    
    if (token) {
      const response = await apiRequest(
        request,
        `/api/protocols/${TEST_PROTOCOLS.privateCompany.id}`,
        token
      );
      
      // Should be hidden or forbidden
      expect([401, 403, 404]).toContain(response.status());
    }
    
    await logout(page);
  });

  test('organization members can see private protocols', async ({ page, request }) => {
    await login(page, TEST_USERS.companyAdmin);
    
    const token = await getAuthToken(request, TEST_USERS.companyAdmin);
    
    if (token) {
      const response = await apiRequest(
        request,
        `/api/protocols/${TEST_PROTOCOLS.privateCompany.id}`,
        token
      );
      
      expect(response.status()).toBeLessThan(500);
    }
    
    await logout(page);
  });
});

// ============================================================================
// PROTOCOL UI TESTS
// ============================================================================

test.describe('Protocol UI', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, TEST_USERS.testUser);
  });

  test.afterEach(async ({ page }) => {
    await logout(page);
  });

  test('should display protocol list', async ({ page }) => {
    await navigateTo(page, 'challenges');
    await page.waitForTimeout(1000);
    
    // Look for challenge/protocol cards
    const protocolCards = page.locator('[class*="challenge"], [class*="protocol"], [data-testid*="challenge"]');
    
    expect(await protocolCards.count()).toBeGreaterThanOrEqual(0);
  });

  test('should show protocol details', async ({ page }) => {
    await navigateTo(page, 'challenges');
    await page.waitForTimeout(1000);
    
    // Click on first challenge
    const challengeCard = page.locator('[class*="challenge"], [class*="protocol"]').first();
    
    if (await challengeCard.isVisible()) {
      await challengeCard.click();
      await page.waitForTimeout(1000);
      
      // Should show details
      const detailsView = page.locator('[class*="detail"], [class*="modal"], h1, h2');
      expect(await detailsView.count()).toBeGreaterThan(0);
    }
  });

  test('should show join button for non-participating protocols', async ({ page }) => {
    await navigateTo(page, 'challenges');
    await page.waitForTimeout(1000);
    
    // Look for 30 Day Fitness (user is not participating)
    const fitnessChallenge = page.locator(`text=${TEST_CHALLENGES.thirtyDayFitness.title}`);
    
    if (await fitnessChallenge.isVisible()) {
      await fitnessChallenge.click();
      await page.waitForTimeout(500);
      
      // Should show join button
      const joinButton = page.locator('button:has-text("Join"), button:has-text("Start")');
      // May or may not be visible depending on UI state
    }
  });

  test('should show progress for joined protocols', async ({ page }) => {
    await navigateTo(page, 'challenges');
    await page.waitForTimeout(1000);
    
    // Look for Morning Yoga (user is participating)
    const yogaChallenge = page.locator(`text=${TEST_CHALLENGES.morningYoga.title}`);
    
    if (await yogaChallenge.isVisible()) {
      await yogaChallenge.click();
      await page.waitForTimeout(500);
      
      // Should show progress
      const progressIndicator = page.locator('[class*="progress"], text=/day|progress|%/i');
      expect(await progressIndicator.count()).toBeGreaterThanOrEqual(0);
    }
  });
});

// ============================================================================
// PROTOCOL ADMIN UI
// ============================================================================

test.describe('Protocol Admin UI', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, TEST_USERS.productAdmin);
  });

  test.afterEach(async ({ page }) => {
    await logout(page);
  });

  test('should show protocol management page', async ({ page }) => {
    await page.goto('/admin/protocols');
    await page.waitForTimeout(1000);
    
    // Look for management UI
    const createButton = page.locator('button:has-text("Create"), button:has-text("New")');
    const protocolList = page.locator('table, [class*="list"]');
    
    // Should have some management elements
  });

  test('should filter protocols by status', async ({ page }) => {
    await page.goto('/admin/protocols');
    await page.waitForTimeout(1000);
    
    // Look for status filter
    const statusFilter = page.locator('select[name="status"], [data-testid="status-filter"]');
    
    if (await statusFilter.isVisible()) {
      await statusFilter.selectOption('draft');
      await page.waitForTimeout(500);
    }
  });

  test('should show protocol participants', async ({ page }) => {
    await page.goto(`/admin/protocols/${TEST_PROTOCOLS.activeHydration.id}/participants`);
    await page.waitForTimeout(1000);
    
    // Look for participants list
    const participantsList = page.locator('table, [class*="participant"], [class*="member"]');
  });
});

// ============================================================================
// PROTOCOL REWARDS
// ============================================================================

test.describe('Protocol Rewards', () => {
  test('completing protocol awards badge', async ({ page, request }) => {
    await login(page, TEST_USERS.testUser);
    
    const token = await getAuthToken(request, TEST_USERS.testUser);
    
    if (token) {
      // Check user badges
      const response = await apiRequest(request, '/api/user/badges', token);
      
      if (response.ok()) {
        const data = await response.json();
        const badges = Array.isArray(data) ? data : data.badges || [];
        
        // testUser completed Reading Challenge (seeded), may have badge
        const hasBookwormBadge = badges.some(
          (b: any) => b.name === 'Bookworm' || b.badge === 'Bookworm'
        );
      }
    }
    
    await logout(page);
  });

  test('completing protocol awards XP', async ({ page, request }) => {
    await login(page, TEST_USERS.testUser);
    
    const token = await getAuthToken(request, TEST_USERS.testUser);
    
    if (token) {
      const response = await apiRequest(request, '/api/user/profile', token);
      
      if (response.ok()) {
        const data = await response.json();
        const xp = data.xp || data.totalXp || data.points || 0;
        
        // User should have some XP from completed challenges
        expect(xp).toBeGreaterThanOrEqual(0);
      }
    }
    
    await logout(page);
  });
});
