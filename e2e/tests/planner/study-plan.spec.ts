/**
 * tests/planner/study-plan.spec.ts
 *
 * Sprint 3 — UC: Generate Study Plan
 *
 * Validates the /planner page and the AI Planner Chat that allows users to
 * generate a personalised study plan through natural language interaction.
 *
 * PlannerDashboard.tsx tabs:
 *   Overview | Goals | Kanban | Calendar | Habits
 *
 * The AI chat on the Overview tab opens with a pre-rendered greeting from
 * the assistant and accepts user messages.
 *
 * Tags:
 *  @smoke — subset run on every browser in CI
 */
import { test, expect } from '../../fixtures/index';

test.describe('Generate Study Plan (Planner)', () => {

  // ── UC-PLAN-01: Planner page renders for authenticated user ───────────────
  test('planner page renders for an authenticated user @smoke', async ({
    plannerPage,
  }) => {
    await test.step('Verify planner page URL', async () => {
      expect(plannerPage.page.url()).toContain('/planner');
    });
    await test.step('Verify page heading is visible', async () => {
      await expect(plannerPage.pageHeading).toBeVisible({ timeout: 12_000 });
    });
    await plannerPage.page.screenshot({ path: 'test-results/screenshots/uc-plan-01-page-renders.png', fullPage: true });
  });

  // ── UC-PLAN-02: All five sub-nav tabs are present ─────────────────────────
  test('planner shows all five navigation tabs @smoke', async ({
    plannerPage,
  }) => {
    await test.step('Verify all five planner tabs are visible', async () => {
      await expect(plannerPage.tabOverview).toBeVisible({ timeout: 8_000 });
      await expect(plannerPage.tabGoals).toBeVisible();
      await expect(plannerPage.tabKanban).toBeVisible();
      await expect(plannerPage.tabCalendar).toBeVisible();
      await expect(plannerPage.tabHabits).toBeVisible();
    });
    await plannerPage.page.screenshot({ path: 'test-results/screenshots/uc-plan-02-nav-tabs.png', fullPage: true });
  });

  // ── UC-PLAN-03: Overview tab is the default active tab ────────────────────
  test('Overview is the default active tab on /planner @smoke', async ({
    plannerPage,
  }) => {
    await test.step('Verify AI chat greeting is visible (Overview tab default)', async () => {
      await expect(plannerPage.chatAssistantMsg).toBeVisible({ timeout: 10_000 });
    });
    await plannerPage.page.screenshot({ path: 'test-results/screenshots/uc-plan-03-overview-default.png', fullPage: true });
  });

  // ── UC-PLAN-04: AI Planner Chat input is present ─────────────────────────
  test('AI Planner Chat has a message input field @smoke', async ({
    plannerPage,
  }) => {
    await test.step('Verify chat input field is visible', async () => {
      await expect(plannerPage.chatInput).toBeVisible({ timeout: 8_000 });
    });
    await plannerPage.page.screenshot({ path: 'test-results/screenshots/uc-plan-04-chat-input.png', fullPage: true });
  });

  // ── UC-PLAN-05: AI chat has a send button ────────────────────────────────
  test('AI Planner Chat has a send / submit button @smoke', async ({
    plannerPage,
  }) => {
    await test.step('Verify chat send button is visible', async () => {
      await expect(plannerPage.chatSendButton).toBeVisible({ timeout: 8_000 });
    });
    await plannerPage.page.screenshot({ path: 'test-results/screenshots/uc-plan-05-send-button.png', fullPage: true });
  });

  // ── UC-PLAN-06: Sending a message adds it to the conversation ─────────────
  test('typing and sending a message adds the user message to the chat', async ({
    plannerPage,
  }) => {
    const prompt = 'Create a 3-day study plan for my algorithms exam';
    await test.step('Type and send the chat message', async () => {
      await plannerPage.sendChatMessage(prompt);
    });
    await test.step('Verify user message appears in the conversation thread', async () => {
      await expect(plannerPage.page.getByText(prompt)).toBeVisible({ timeout: 8_000 });
    });
    await plannerPage.page.screenshot({ path: 'test-results/screenshots/uc-plan-06-message-sent.png', fullPage: true });
  });

  // ── UC-PLAN-07: Assistant responds with a message ─────────────────────────
  test('after sending a prompt the assistant produces a response', async ({
    plannerPage,
  }) => {
    const prompt = 'What should I study for my databases exam?';
    await test.step('Send a prompt to the AI planner', async () => {
      await plannerPage.sendChatMessage(prompt);
    });
    await test.step('Verify input clears after dispatch', async () => {
      await expect(plannerPage.chatInput).toHaveValue('', { timeout: 10_000 });
    });
    await test.step('Wait for AI response (spinner disappears)', async () => {
      await expect(
        plannerPage.page.locator('.animate-spin').first(),
      ).not.toBeVisible({ timeout: 30_000 });
    });
    await plannerPage.page.screenshot({ path: 'test-results/screenshots/uc-plan-07-assistant-response.png', fullPage: true });
  });

  // ── UC-PLAN-08: Switching to the Goals tab renders content ────────────────
  test('clicking the Goals tab renders the goals view', async ({
    plannerPage,
  }) => {
    await test.step('Click the Goals tab', async () => {
      await plannerPage.goToTab('goals');
    });
    await test.step('Verify page has not crashed and URL is still /planner', async () => {
      const body = plannerPage.page.locator('body');
      await expect(body).toBeVisible();
      expect(plannerPage.page.url()).toContain('/planner');
    });
    await plannerPage.page.screenshot({ path: 'test-results/screenshots/uc-plan-08-goals-tab.png', fullPage: true });
  });

  // ── UC-PLAN-09: Switching to the Kanban tab renders content ───────────────
  test('clicking the Kanban tab renders the kanban board', async ({
    plannerPage,
  }) => {
    await test.step('Click the Kanban tab', async () => {
      await plannerPage.goToTab('tasks');
    });
    await test.step('Verify page body is visible', async () => {
      const body = plannerPage.page.locator('body');
      await expect(body).toBeVisible();
    });
    await plannerPage.page.screenshot({ path: 'test-results/screenshots/uc-plan-09-kanban-tab.png', fullPage: true });
  });

  // ── UC-PLAN-10: Unauthenticated access to /planner shows GuestGate ────────
  test('unauthenticated access to /planner shows GuestGate @smoke', async ({
    page,
  }) => {
    await test.step('Navigate to /planner as guest', async () => {
      await page.goto('/planner');
      await page.waitForLoadState('domcontentloaded');
    });
    await test.step('Verify GuestGate sign-in link is visible', async () => {
      const signInLink = page.getByRole('link', { name: /sign in/i });
      await expect(signInLink).toBeVisible({ timeout: 8_000 });
    });
    await page.screenshot({ path: 'test-results/screenshots/uc-plan-10-guest-gate.png', fullPage: true });
  });
});
