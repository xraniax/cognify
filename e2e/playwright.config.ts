import { defineConfig, devices } from '@playwright/test';
import path from 'path';
import dotenv from 'dotenv';

// Load test-specific environment variables before anything else
dotenv.config({ path: path.resolve(__dirname, '.env.test') });

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';

// Storage-state files written by global-setup.ts and reused by fixtures
export const STORAGE_STATE = {
  user:  path.resolve(__dirname, '.auth/user.json'),
  admin: path.resolve(__dirname, '.auth/admin.json'),
} as const;

export default defineConfig({
  // ── Test discovery ────────────────────────────────────────────────────────
  testDir:   './tests',
  testMatch: '**/*.spec.ts',

  // ── Execution settings ────────────────────────────────────────────────────
  fullyParallel: false, // auth state is shared; serialise to avoid conflicts
  workers:       1,     // single worker keeps the HTML report clean & readable
  retries:       process.env.CI ? 2 : 0,
  timeout:       45_000,       // per-test timeout
  expect: {
    timeout: 10_000,           // assertion timeout
  },

  // ── Global setup: seed auth storage state once before the suite ───────────
  globalSetup:    require.resolve('./global-setup'),
  globalTeardown: require.resolve('./global-teardown'),

  // ── Reporters ─────────────────────────────────────────────────────────────
  reporter: [
    // Beautiful interactive HTML report — open with `npm run report`
    ['html', {
      outputFolder: 'playwright-report',
      open: 'never',        // don't auto-open after run; use `npm run report`
    }],
    // Compact console output while tests are running
    ['list'],
    // JUnit XML for CI artefact ingestion
    ['junit', { outputFile: 'test-results/junit.xml' }],
  ],

  // ── Shared settings applied to all tests ─────────────────────────────────
  use: {
    baseURL: BASE_URL,

    // Capture a screenshot at the end of every test — success or failure
    screenshot: 'on',

    // Record a full video for every test so any run can be replayed
    video: 'on',

    // Capture a complete Playwright trace (DOM snapshots + network + steps)
    // Open with: npx playwright show-trace test-results/<trace>.zip
    trace: 'on',

    // Provide a realistic viewport matching most laptop screens
    viewport: { width: 1280, height: 800 },

    // Give each action a generous timeout before it fails
    actionTimeout: 15_000,

    // Inject a custom User-Agent so test traffic is identifiable in server logs
    userAgent: 'Playwright/Cognify-E2E',

    // Locale for date/number formatting in forms
    locale: 'en-US',

    // Ignore HTTPS certificate errors in local/staging environments
    ignoreHTTPSErrors: true,
  },

  // ── Output artefacts folder ───────────────────────────────────────────────
  outputDir: 'test-results',

  // ── Browser projects ──────────────────────────────────────────────────────
  projects: [
    // Primary browser — used for all tests
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Use Playwright's own bundled Chromium (not the snap-managed one)
        channel: undefined,
      },
    },

    // Cross-browser smoke suite — run only @smoke-tagged tests on Firefox/WebKit
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
      grep: /@smoke/,
    },
    // WebKit requires: sudo npx playwright install-deps (libevent-2.1-7t64, libavif16)
    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    //   grep: /@smoke/,
    // },

    // Mobile viewport — useful for responsive layout checks
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
      grep: /@mobile/,
    },
  ],
});
