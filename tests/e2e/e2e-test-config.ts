// e2e-test-config.ts
// E2E Test Configuration - Real Database Testing with Seeds
// ============================================================================

import { Page, expect, APIRequestContext } from '@playwright/test';
import { ADMIN_DASHBOARD_URL } from './constants';

// ============================================================================
// TEST CREDENTIALS (must match seed-e2e-tests.sql)
// Password for all test users: "Test123!" (from the bcrypt hash in seed)
// ============================================================================

export const TEST_USERS = {
  // Primary test user
  testUser: {
    email: 'testuser@e2etest.com',
    password: 'Test123!',
    name: 'E2E Test User',
    id: 'e2e00001-0000-0000-0000-000000000001',
    streak: 7
  },
  // Admin user for admin panel tests
  adminUser: {
    email: 'admin@e2etest.com',
    password: 'Test123!',
    name: 'E2E Admin User',
    id: 'e2e00001-0000-0000-0000-000000000002',
    roles: ['admin']
  },
  // Manager user
  managerUser: {
    email: 'manager@e2etest.com',
    password: 'Test123!',
    name: 'E2E Manager User',
    id: 'e2e00001-0000-0000-0000-000000000003',
    roles: ['manager']
  },
  // Friends for social tests
  friend1: {
    email: 'friend1@e2etest.com',
    password: 'Test123!',
    name: 'Jane Smith',
    id: 'e2e00001-0000-0000-0000-000000000004',
    streak: 21
  },
  friend2: {
    email: 'friend2@e2etest.com',
    password: 'Test123!',
    name: 'Bob Johnson',
    id: 'e2e00001-0000-0000-0000-000000000005',
    streak: 10
  },
  friend3: {
    email: 'friend3@e2etest.com',
    password: 'Test123!',
    name: 'Alice Williams',
    id: 'e2e00001-0000-0000-0000-000000000006',
    streak: 15
  },
  // New user for onboarding
  newUser: {
    email: 'newuser@e2etest.com',
    password: 'Test123!',
    name: 'New User',
    id: 'e2e00001-0000-0000-0000-000000000007',
    streak: 0
  },
  // Advanced users for enterprise/admin tests
  superAdmin: {
    email: 'superadmin@e2etest.com',
    password: 'Test123!',
    name: 'Super Admin',
    id: 'e2e00001-0000-0000-0000-000000000010',
    roles: ['user', 'admin', 'super_admin'],
    streak: 30
  },
  productAdmin: {
    email: 'productadmin@e2etest.com',
    password: 'Test123!',
    name: 'Product Admin',
    id: 'e2e00001-0000-0000-0000-000000000011',
    roles: ['user', 'admin', 'protocol_manager'],
    primaryOrganizationId: 'e2e00002-0000-0000-0000-000000000002',
    streak: 25
  },
  companyOwner: {
    email: 'companyowner@e2etest.com',
    password: 'Test123!',
    name: 'Company Owner',
    id: 'e2e00001-0000-0000-0000-000000000012',
    roles: ['user', 'admin'],
    primaryOrganizationId: 'e2e00002-0000-0000-0000-000000000003',
    streak: 20
  },
  companyAdmin: {
    email: 'companyadmin@e2etest.com',
    password: 'Test123!',
    name: 'Company Admin',
    id: 'e2e00001-0000-0000-0000-000000000013',
    roles: ['user', 'manager'],
    primaryOrganizationId: 'e2e00002-0000-0000-0000-000000000003',
    streak: 18
  },
  anonymousUser: {
    email: 'anonuser@e2etest.com',
    password: 'Test123!',
    name: 'Anonymous User',
    id: 'e2e00001-0000-0000-0000-000000000014',
    roles: ['user'],
    privacyPublicLeaderboard: 'anonymous',
    privacyProtocolLeaderboard: 'anonymous',
    primaryOrganizationId: 'e2e00002-0000-0000-0000-000000000002',
    streak: 12
  },
  hiddenUser: {
    email: 'hiddenuser@e2etest.com',
    password: 'Test123!',
    name: 'Hidden User',
    id: 'e2e00001-0000-0000-0000-000000000015',
    roles: ['user'],
    privacyPublicLeaderboard: 'hidden',
    privacyProtocolLeaderboard: 'hidden',
    primaryOrganizationId: 'e2e00002-0000-0000-0000-000000000002',
    streak: 8
  }
};

// ============================================================================
// TEST DATA REFERENCES (must match seed-e2e-tests.sql)
// ============================================================================

export const TEST_TASKS = {
  drinkWater: {
    id: 'e2e00004-0000-0000-0000-000000000001',
    title: 'Drink Water',
    status: 'pending',
    type: 'counter',
    goal: 8,
    currentValue: 3
  },
  morningRun: {
    id: 'e2e00004-0000-0000-0000-000000000002',
    title: 'Morning Run',
    status: 'pending',
    type: 'check'
  },
  readBook: {
    id: 'e2e00004-0000-0000-0000-000000000003',
    title: 'Read Book',
    status: 'pending',
    type: 'counter',
    goal: 30,
    currentValue: 15
  },
  meditation: {
    id: 'e2e00004-0000-0000-0000-000000000004',
    title: 'Meditation',
    status: 'completed',
    type: 'check'
  },
  overdueTask: {
    id: 'e2e00004-0000-0000-0000-000000000005',
    title: 'Overdue Task',
    status: 'pending'
  }
};

export const TEST_CHALLENGES = {
  morningYoga: {
    id: 9001,
    title: 'E2E Test Morning Yoga Challenge',
    status: 'active',
    userProgress: 5,
    userParticipating: true
  },
  thirtyDayFitness: {
    id: 9002,
    title: 'E2E Test 30 Day Fitness',
    status: 'active',
    userParticipating: false
  },
  noSugarWeek: {
    id: 9003,
    title: 'E2E Test No Sugar Week',
    status: 'active',
    userProgress: 3,
    userParticipating: true
  },
  hydrationHero: {
    id: 9004,
    title: 'E2E Test Hydration Hero',
    status: 'upcoming',
    userParticipating: false
  },
  readingChallenge: {
    id: 9005,
    title: 'E2E Test Reading Challenge',
    status: 'completed',
    userParticipating: true
  }
};

export const TEST_ORGANIZATION = {
  id: 'e2e00002-0000-0000-0000-000000000001',
  name: 'E2E Test Organization'
};

// Advanced organizations for enterprise tests
export const TEST_ORGANIZATIONS = {
  testOrg: {
    id: 'e2e00002-0000-0000-0000-000000000001',
    name: 'E2E Test Organization',
    type: 'company'
  },
  productOrg: {
    id: 'e2e00002-0000-0000-0000-000000000002',
    name: 'E2E HabitPulse Product',
    type: 'product',
    memberCount: 1000,
    protocolCount: 15
  },
  companyOrg: {
    id: 'e2e00002-0000-0000-0000-000000000003',
    name: 'E2E Test Company Inc',
    type: 'company',
    memberCount: 50,
    protocolCount: 5
  },
  wellnessOrg: {
    id: 'e2e00002-0000-0000-0000-000000000004',
    name: 'E2E Wellness Pro',
    type: 'product',
    memberCount: 200,
    protocolCount: 8
  }
};

// Advanced protocols for protocol tests
export const TEST_PROTOCOLS = {
  draftMeditation: {
    id: 9010,
    name: 'E2E Draft Meditation Challenge',
    status: 'draft',
    isPublic: false,
    organizationId: 'e2e00002-0000-0000-0000-000000000002'
  },
  activeHydration: {
    id: 9011,
    name: 'E2E Active Hydration Challenge',
    status: 'active',
    isPublic: true,
    organizationId: null
  },
  archivedFitness: {
    id: 9012,
    name: 'E2E Archived Fitness Challenge',
    status: 'completed',
    isPublic: true,
    organizationId: 'e2e00002-0000-0000-0000-000000000002'
  },
  privateCompany: {
    id: 9013,
    name: 'E2E Company Wellness Program',
    status: 'active',
    isPublic: false,
    organizationId: 'e2e00002-0000-0000-0000-000000000003'
  }
};

export const TEST_HABITS = {
  drinkWater: {
    id: 'e2e00003-0000-0000-0000-000000000001',
    name: 'Drink Water',
    category: 'Health'
  },
  morningRun: {
    id: 'e2e00003-0000-0000-0000-000000000002',
    name: 'Morning Run',
    category: 'Fitness'
  },
  readBook: {
    id: 'e2e00003-0000-0000-0000-000000000003',
    name: 'Read Book',
    category: 'Learning'
  },
  meditation: {
    id: 'e2e00003-0000-0000-0000-000000000004',
    name: 'Meditation',
    category: 'Wellness'
  }
};

// ============================================================================
// AUTHENTICATION HELPERS
// ============================================================================

/**
 * Login with given credentials and wait for dashboard
 */
export async function login(
  page: Page, 
  user: { email: string; password: string } = TEST_USERS.testUser
) {
  await page.goto('/');
  
  // Wait for login form
  await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 5000 });
  
  // Fill login form
  await page.fill('input[type="email"]', user.email);
  await page.fill('input[type="password"]', user.password);
  await page.click('button[type="submit"]');
  
  // Wait for dashboard to load (real API response)
  await expect(
    page.locator('text=Stay focused on your goals today!')
      .or(page.locator('text=Streak'))
      .or(page.locator('text=Points'))
  ).toBeVisible({ timeout: 15000 });
}

/**
 * Login as admin user and verify admin dashboard
 */
export async function loginAsAdmin(page: Page) {
  await loginToAdminDashboard(page);
}

/**
 * Login specifically to the Admin Dashboard application (port 3002)
 */
export async function loginToAdminDashboard(
  page: Page, 
  user: { email: string; password: string } = TEST_USERS.adminUser
) {
  // Debug logs
  page.on('console', msg => console.log(`BROWSER: ${msg.text()}`));
  page.on('pageerror', err => console.log(`BROWSER ERROR: ${err.message}`));
  // page.on('requestfailed', request => console.log(`REQUEST FAILED: ${request.url()} ${request.failure()?.errorText}`));

  // Navigate to Admin URL
  await page.goto(ADMIN_DASHBOARD_URL);
  
  // Wait for login form
  await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 5000 });

  
  // Fill login form
  await page.fill('input[type="email"]', user.email);
  await page.fill('input[type="password"]', user.password);
  await page.click('button[type="submit"]');
  
  // Wait for dashboard to load
  await expect(
    page.locator('text=Total Users')
      .or(page.locator('text=Stats Overview'))
  ).toBeVisible({ timeout: 15000 });
}

/**
 * Logout the current user
 */
export async function logout(page: Page) {
  // Go to profile
  const meTab = page.locator('button:has-text("Me")');
  if (await meTab.isVisible()) {
    await meTab.click();
    await page.waitForTimeout(500);
  }
  
  // Click logout
  const logoutButton = page.locator('button:has-text("Logout")').or(page.locator('text=Logout'));
  await logoutButton.click();
  
  // Verify on login page
  await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 5000 });
}

// ============================================================================
// NAVIGATION HELPERS
// ============================================================================

export async function navigateTo(page: Page, tab: 'Home' | 'Discover' | 'Social' | 'Me') {
  await page.click(`button:has-text("${tab}")`);
  await page.waitForTimeout(500);
}

export async function openFabMenu(page: Page) {
  const fabButton = page.locator('button[aria-label="Create new task"], button:has(.material-symbols-outlined:has-text("add"))').first();
  await fabButton.click();
  await page.waitForTimeout(300);
}

export async function openAICoach(page: Page) {
  await openFabMenu(page);
  await page.click('text=AI Coach');
  await expect(page.locator('text=Coach').or(page.locator('text=Pulse'))).toBeVisible({ timeout: 5000 });
}

// ============================================================================
// TASK HELPERS
// ============================================================================

export async function toggleTask(page: Page, taskTitle: string) {
  const taskCard = page.locator(`div:has-text("${taskTitle}")`).first();
  const toggleButton = taskCard.locator('button').first();
  await toggleButton.click();
  await page.waitForTimeout(1000); // Wait for API response
}

export async function waitForTasks(page: Page) {
  await expect(
    page.locator(`text=${TEST_TASKS.drinkWater.title}`)
      .or(page.locator(`text=${TEST_TASKS.morningRun.title}`))
      .or(page.locator('text=No tasks'))
  ).toBeVisible({ timeout: 10000 });
}

// ============================================================================
// CHALLENGE HELPERS
// ============================================================================

export async function goToDiscover(page: Page) {
  await navigateTo(page, 'Discover');
  await expect(
    page.locator('text=Discover')
      .or(page.locator('[placeholder*="earch"]'))
  ).toBeVisible({ timeout: 5000 });
}

export async function joinChallenge(page: Page, challengeTitle: string) {
  const challengeCard = page.locator(`text=${challengeTitle}`).first();
  await challengeCard.click();
  await page.waitForTimeout(500);
  
  const joinButton = page.locator('button:has-text("Join")');
  if (await joinButton.isVisible()) {
    await joinButton.click();
    await page.waitForTimeout(1000);
  }
}

// ============================================================================
// SOCIAL HELPERS
// ============================================================================

export async function goToSocial(page: Page) {
  await navigateTo(page, 'Social');
  await expect(page.locator('text=Leaderboard')).toBeVisible({ timeout: 5000 });
}

export async function switchToFriendsLeaderboard(page: Page) {
  const friendsTab = page.locator('button:has-text("Friends")').or(page.locator('text=Friends'));
  await friendsTab.first().click();
  await page.waitForTimeout(500);
}

// ============================================================================
// PROFILE HELPERS
// ============================================================================

export async function goToProfile(page: Page) {
  await navigateTo(page, 'Me');
  await expect(
    page.locator(`text=${TEST_USERS.testUser.name}`)
      .or(page.locator('text=Edit Profile'))
  ).toBeVisible({ timeout: 5000 });
}

export async function openEditProfile(page: Page) {
  await goToProfile(page);
  await page.click('text=Edit Profile');
  await expect(page.locator('input').first()).toBeVisible({ timeout: 3000 });
}

// ============================================================================
// API HELPERS
// ============================================================================

export async function getAuthToken(
  context: Page | APIRequestContext, 
  user: { email: string; password: string } = TEST_USERS.testUser
): Promise<string> {
  const request = 'request' in context ? context.request : context;
  const backendUrl = process.env.VITE_API_URL || 'http://localhost:3001';
  
  const response = await request.post(`${backendUrl}/api/auth/login`, {
    data: {
      email: user.email,
      password: user.password
    }
  });
  
  if (!response.ok()) {
    console.error(`Auth failed: ${response.status()} ${response.statusText()}`);
    console.error(await response.text());
    throw new Error(`Authentication failed for ${user.email}`);
  }
  
  const data = await response.json();
  return data.token || data.accessToken;
}

export async function apiRequest(
  context: Page | APIRequestContext,
  endpoint: string,
  token: string,
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' = 'GET',
  data?: any
) {
  const request = 'request' in context ? context.request : context;
  const backendUrl = process.env.VITE_API_URL || 'http://localhost:3001';
  const fullUrl = endpoint.startsWith('http') ? endpoint : `${backendUrl}${endpoint}`;
  
  const options: any = {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  };
  
  if (data) {
    options.data = data;
  }
  
  // console.log(`API Request: ${method} ${fullUrl}`);
  
  switch (method) {
    case 'GET':
      return await request.get(fullUrl, options);
    case 'POST':
      return await request.post(fullUrl, options);
    case 'PUT':
      return await request.put(fullUrl, options);
    case 'PATCH':
      return await request.patch(fullUrl, options);
    case 'DELETE':
      return await request.delete(fullUrl, options);
    default:
      console.error(`Unknown method: ${method}`);
      throw new Error(`Unknown method: ${method}`);
  }
}

// ============================================================================
// WAIT HELPERS
// ============================================================================

export async function waitForLoading(page: Page) {
  const spinner = page.locator('[class*="spinner"]').or(page.locator('[class*="loading"]'));
  await spinner.waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {});
}

export async function waitForNetworkIdle(page: Page, timeout = 5000) {
  await page.waitForLoadState('networkidle', { timeout });
}

// ============================================================================
// ASSERTION HELPERS
// ============================================================================

export async function assertOnLoginPage(page: Page) {
  await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 5000 });
  await expect(page.locator('input[type="password"]')).toBeVisible();
}

export async function assertOnDashboard(page: Page) {
  await expect(
    page.locator('text=Current Progress')
      .or(page.locator('button:has-text("Home")'))
  ).toBeVisible({ timeout: 5000 });
}

export async function assertToast(page: Page, message: string) {
  await expect(
    page.locator(`text=${message}`)
      .or(page.locator(`[class*="toast"]:has-text("${message}")`))
  ).toBeVisible({ timeout: 5000 });
}
