/**
 * fixtures/index.ts
 *
 * Custom Playwright fixtures that extend the base `test` object.
 *
 * Why use fixtures instead of beforeEach helpers?
 *  - Fixtures are composable: a test can declare `{ userPage, loginPage }`
 *    and Playwright wires them up automatically.
 *  - They support scoping (test | worker) so expensive setup runs once.
 *  - They keep test bodies focused on assertions, not boilerplate.
 *
 * Provided fixtures:
 *  Sprint 1
 *  - loginPage           — fresh browser context, opens /login
 *  - registerPage        — fresh browser context, opens /register
 *  - userPage            — authenticated regular-user context (storage state)
 *  - adminPage           — authenticated admin context (storage state)
 *  - dashboardPage       — authenticated + already on /dashboard
 *  - profilePage         — authenticated + already on /profile
 *  - adminUsersPage      — admin-authenticated + already on /admin/users
 *
 *  Sprint 2
 *  - trashPage           — authenticated + already on /trash
 *  - goalsPage           — authenticated + already on /goals
 *  - filesPage           — authenticated + already on /history
 *  - subjectWorkspacePage — authenticated + navigated to first subject workspace
 *
 *  Sprint 3
 *  - plannerPage         — authenticated + already on /planner
 *
 *  Sprint 4
 *  - analyticsSubjectPage — authenticated + navigated to /analytics/subjects/:id
 *  - adminDashboardPage   — admin-authenticated + already on /admin
 *  - adminLogsPage        — admin-authenticated + already on /admin/logs
 */
import { test as base, Page } from '@playwright/test';
import path from 'path';
import { STORAGE_STATE } from '../playwright.config';
import { LoginPage }              from '../pages/login.page';
import { RegisterPage }           from '../pages/register.page';
import { DashboardPage }          from '../pages/dashboard.page';
import { ProfilePage }            from '../pages/profile.page';
import { AdminUsersPage }         from '../pages/admin/admin-users.page';
import { AdminDashboardPage }     from '../pages/admin/admin-dashboard.page';
import { AdminLogsPage }          from '../pages/admin/admin-logs.page';
import { TrashPage }              from '../pages/trash.page';
import { GoalsPage }              from '../pages/goals.page';
import { FilesPage }              from '../pages/files.page';
import { SubjectWorkspacePage }   from '../pages/subjects/subject-workspace.page';
import { PlannerPage }            from '../pages/planner.page';
import { AnalyticsSubjectPage }   from '../pages/analytics.page';

// ── Type declarations for all custom fixtures ──────────────────────────────
type CognifyFixtures = {
  // Sprint 1
  loginPage:             LoginPage;
  registerPage:          RegisterPage;
  userPage:              Page;
  adminPage:             Page;
  dashboardPage:         DashboardPage;
  profilePage:           ProfilePage;
  adminUsersPage:        AdminUsersPage;
  // Sprint 2
  trashPage:             TrashPage;
  goalsPage:             GoalsPage;
  filesPage:             FilesPage;
  subjectWorkspacePage:  SubjectWorkspacePage;
  // Sprint 3
  plannerPage:           PlannerPage;
  // Sprint 4
  analyticsSubjectPage:  AnalyticsSubjectPage;
  adminDashboardPage:    AdminDashboardPage;
  adminLogsPage:         AdminLogsPage;
};

export const test = base.extend<CognifyFixtures>({

  // ── Unauthenticated page fixtures ──────────────────────────────────────────

  loginPage: async ({ page }, use) => {
    const loginPage = new LoginPage(page);
    await loginPage.open();
    await use(loginPage);
  },

  registerPage: async ({ page }, use) => {
    const registerPage = new RegisterPage(page);
    await registerPage.open();
    await use(registerPage);
  },

  // ── Authenticated page fixtures ────────────────────────────────────────────
  // These fixtures load the storage state saved by global-setup, so no
  // login UI interaction is needed — tests start in an already-authenticated
  // state, making them ~3× faster.

  userPage: async ({ browser }, use) => {
    const ctx  = await browser.newContext({ storageState: STORAGE_STATE.user });
    const page = await ctx.newPage();
    await use(page);
    await ctx.close();
  },

  adminPage: async ({ browser }, use) => {
    const ctx  = await browser.newContext({ storageState: STORAGE_STATE.admin });
    const page = await ctx.newPage();
    await use(page);
    await ctx.close();
  },

  // ── Compound fixtures (auth + navigation) — Sprint 1 ──────────────────────

  dashboardPage: async ({ browser }, use) => {
    const ctx  = await browser.newContext({ storageState: STORAGE_STATE.user });
    const page = await ctx.newPage();
    const dash = new DashboardPage(page);
    await dash.open();
    await use(dash);
    await ctx.close();
  },

  profilePage: async ({ browser }, use) => {
    const ctx     = await browser.newContext({ storageState: STORAGE_STATE.user });
    const page    = await ctx.newPage();
    const profile = new ProfilePage(page);
    await profile.open();
    await use(profile);
    await ctx.close();
  },

  adminUsersPage: async ({ browser }, use) => {
    const ctx    = await browser.newContext({ storageState: STORAGE_STATE.admin });
    const page   = await ctx.newPage();
    const adminP = new AdminUsersPage(page);
    await adminP.open();
    await use(adminP);
    await ctx.close();
  },

  // ── Compound fixtures — Sprint 2 ──────────────────────────────────────────

  trashPage: async ({ browser }, use) => {
    const ctx  = await browser.newContext({ storageState: STORAGE_STATE.user });
    const page = await ctx.newPage();
    const tp   = new TrashPage(page);
    await tp.open();
    await use(tp);
    await ctx.close();
  },

  goalsPage: async ({ browser }, use) => {
    const ctx  = await browser.newContext({ storageState: STORAGE_STATE.user });
    const page = await ctx.newPage();
    const gp   = new GoalsPage(page);
    await gp.open();
    await use(gp);
    await ctx.close();
  },

  filesPage: async ({ browser }, use) => {
    const ctx  = await browser.newContext({ storageState: STORAGE_STATE.user });
    const page = await ctx.newPage();
    const fp   = new FilesPage(page);
    await fp.open();
    await use(fp);
    await ctx.close();
  },

  subjectWorkspacePage: async ({ browser }, use) => {
    const ctx  = await browser.newContext({ storageState: STORAGE_STATE.user });
    const page = await ctx.newPage();
    const ws   = new SubjectWorkspacePage(page);
    await ws.openFromDashboard();
    await use(ws);
    await ctx.close();
  },

  plannerPage: async ({ browser }, use) => {
    const ctx  = await browser.newContext({ storageState: STORAGE_STATE.user });
    const page = await ctx.newPage();
    const pp   = new PlannerPage(page);
    await pp.open();
    await use(pp);
    await ctx.close();
  },

  // ── Compound fixtures — Sprint 4 ──────────────────────────────────────────

  analyticsSubjectPage: async ({ browser }, use) => {
    const ctx  = await browser.newContext({ storageState: STORAGE_STATE.user });
    const page = await ctx.newPage();
    // Derive a real subjectId from the dashboard subject list
    await page.goto('/dashboard');
    await page.waitForLoadState('domcontentloaded');
    const link  = page.locator('a[href*="/subjects/"]').first();
    const href  = await link.getAttribute('href').catch(() => null);
    const match = href?.match(/\/subjects\/([^/?#]+)/);
    const subjectId = match?.[1] ?? '';
    const ap    = new AnalyticsSubjectPage(page);
    if (subjectId) await ap.open(subjectId);
    await use(ap);
    await ctx.close();
  },

  adminDashboardPage: async ({ browser }, use) => {
    const ctx    = await browser.newContext({ storageState: STORAGE_STATE.admin });
    const page   = await ctx.newPage();
    const dashP  = new AdminDashboardPage(page);
    await dashP.open();
    await use(dashP);
    await ctx.close();
  },

  adminLogsPage: async ({ browser }, use) => {
    const ctx   = await browser.newContext({ storageState: STORAGE_STATE.admin });
    const page  = await ctx.newPage();
    const logsP = new AdminLogsPage(page);
    await logsP.open();
    await use(logsP);
    await ctx.close();
  },
});

// Re-export expect so tests only need to import from fixtures/index
export { expect } from '@playwright/test';
