import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false, // Run tests sequentially to avoid database conflicts
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Single worker for database consistency
  reporter: 'html',
  
  // Global setup for database seeding
  globalSetup: './tests/e2e/global-setup.ts',
  
  // Increase timeout for real API calls
  timeout: 30000,
  expect: {
    timeout: 10000
  },
  
  use: {
    // Backend API URL
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3001',
    trace: 'on-first-retry',
    // Add extra HTTP headers for API requests
    extraHTTPHeaders: {
      'Accept': 'application/json',
    },
  },
  
  // Define URLs for all services
  // These can be accessed in tests via process.env
  // Frontend: http://localhost:3000
  // Admin Dashboard: http://localhost:3002  
  // Backend API: http://localhost:3001
  
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  
  // Don't start webServer when running with Docker (services already running)
  webServer: process.env.DOCKER ? undefined : {
    command: 'npm run dev:local',
    url: 'http://localhost:3001/health',
    reuseExistingServer: true,
    timeout: 120 * 1000,
  },
});

