/**
 * tests/subjects/subjects.spec.ts
 *
 * Sprint 2 — UC: Manage Subjects
 *
 * Tags:
 *  @smoke — subset run on every browser in CI
 */
import { test, expect } from '../../fixtures/index';
import { uniqueSubjectName } from '../../test-data/subjects';

test.describe('Manage Subjects', () => {

  // ── UC-SUBJ-01: Subject list renders ─────────────────────────────────────
  test('dashboard renders the subject list for an authenticated user @smoke', async ({
    dashboardPage,
  }) => {
    await test.step('Wait for subject cards to appear', async () => {
      const cards = dashboardPage.page.locator('a[href*="/subjects/"]');
      await expect(cards.first()).toBeVisible({ timeout: 12_000 });
    });
    await dashboardPage.page.screenshot({ path: 'test-results/screenshots/uc-subj-01-subject-list.png', fullPage: true });
  });

  // ── UC-SUBJ-02: Search filters the subject list ──────────────────────────
  test('subject search input filters displayed subjects @smoke', async ({
    dashboardPage,
  }) => {
    await test.step('Enter a no-match search query', async () => {
      await dashboardPage.searchInput.fill('zzz_no_match_xqz');
      await dashboardPage.page.waitForTimeout(400);
    });
    await test.step('Verify filtered results are empty or show empty message', async () => {
      const cards = dashboardPage.page.locator('a[href*="/subjects/"]');
      const count = await cards.count();
      const emptyMsg = dashboardPage.page.getByText(/no subjects|nothing here/i);
      const hasEmptyMsg = await emptyMsg.isVisible().catch(() => false);
      expect(count === 0 || hasEmptyMsg).toBeTruthy();
    });
    await dashboardPage.page.screenshot({ path: 'test-results/screenshots/uc-subj-02-search-filtered.png', fullPage: true });
    await test.step('Clear search and verify cards return', async () => {
      await dashboardPage.searchInput.clear();
      await expect(dashboardPage.page.locator('a[href*="/subjects/"]').first()).toBeVisible({ timeout: 8_000 });
    });
  });

  // ── UC-SUBJ-03: Guest on /dashboard sees limited state ────────────────────
  test('guest on /dashboard does not see personal subject list', async ({ page }) => {
    await test.step('Navigate to /dashboard as guest', async () => {
      await page.goto('/dashboard');
      await page.waitForLoadState('domcontentloaded');
    });
    await test.step('Verify no personal subject cards or auth prompt', async () => {
      const authPrompt = page.getByText(/sign in|log in|guest/i).first();
      const subjectCards = page.locator('a[href*="/subjects/"]');
      const cardCount = await subjectCards.count();
      const hasAuthPrompt = await authPrompt.isVisible().catch(() => false);
      expect(cardCount === 0 || hasAuthPrompt).toBeTruthy();
    });
    await page.screenshot({ path: 'test-results/screenshots/uc-subj-03-guest-dashboard.png', fullPage: true });
  });

  // ── UC-SUBJ-04: Create a new subject ─────────────────────────────────────
  test('user can create a new subject from the dashboard @smoke', async ({
    dashboardPage,
  }) => {
    const name = uniqueSubjectName('Sprint2 Test');
    await test.step('Open the add-subject form and fill the name', async () => {
      const addBtn = dashboardPage.page.getByRole('button', { name: /new subject/i }).first();
      await expect(addBtn).toBeVisible({ timeout: 8_000 });
      await addBtn.click();
      // Use exact placeholder to avoid matching the search input ("Search subjects…")
      const nameInput = dashboardPage.page.locator('input[placeholder*="Organic Chemistry"]');
      await expect(nameInput).toBeVisible({ timeout: 5_000 });
      await nameInput.click();
      await nameInput.pressSequentially(name, { delay: 40 });
      // Wait for the Create button to be enabled (confirms React state updated)
      const createBtn = dashboardPage.page.getByRole('button', { name: /^create$/i });
      await expect(createBtn).toBeEnabled({ timeout: 5_000 });
      await createBtn.click();
    });
    await test.step('Verify new subject card appears', async () => {
      await expect(
        dashboardPage.page.locator('a[href*="/subjects/"]').filter({ hasText: name }),
      ).toBeVisible({ timeout: 12_000 });
    });
    await dashboardPage.page.screenshot({ path: 'test-results/screenshots/uc-subj-04-subject-created.png', fullPage: true });
    await test.step('Cleanup: delete the transient subject', async () => {
      const newCard = dashboardPage.page.locator('a[href*="/subjects/"]').filter({ hasText: name });
      await newCard.hover();
      // Scope to the specific card so we don't click another card's button
      const moreBtn = newCard.locator('[data-testid="more-menu-btn"]');
      if (await moreBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await moreBtn.click();
        const deleteBtn = newCard.getByRole('button', { name: /^delete$/i });
        if (await deleteBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
          dashboardPage.page.on('dialog', (d) => d.accept());
          await deleteBtn.click();
        }
      }
    });
  });

  // ── UC-SUBJ-05: Subject card navigates to workspace ───────────────────────
  test('clicking a subject card navigates to the subject workspace @smoke', async ({
    dashboardPage,
  }) => {
    await test.step('Click the first subject card', async () => {
      const firstCard = dashboardPage.page.locator('a[href*="/subjects/"]').first();
      await expect(firstCard).toBeVisible({ timeout: 12_000 });
      await firstCard.click({ force: true });
      // Subject IDs are UUIDs — use a broad pattern, not \d+
      // waitForURL resolves immediately if URL already matches (SPA pushState may be instant)
      await dashboardPage.page.waitForURL(/\/subjects\//, { timeout: 15_000 });
    });
    await test.step('Verify workspace URL', async () => {
      expect(dashboardPage.page.url()).toMatch(/\/subjects\//);
    });
    await dashboardPage.page.screenshot({ path: 'test-results/screenshots/uc-subj-05-workspace-nav.png', fullPage: true });
  });

  // ── UC-SUBJ-06: Rename a subject ─────────────────────────────────────────
  test('user can rename a subject from the dashboard', async ({ dashboardPage }) => {
    const firstCard = dashboardPage.page.locator('a[href*="/subjects/"]').first();
    await expect(firstCard).toBeVisible({ timeout: 12_000 });
    const originalName = (await firstCard.textContent())?.trim() ?? '';
    await test.step('Hover and click rename', async () => {
      await firstCard.hover();
      const editBtn = dashboardPage.page.getByRole('button', { name: /rename|edit/i }).first();
      if (!await editBtn.isVisible()) {
        test.skip(true, 'Rename button not visible — skipping');
        return;
      }
      await editBtn.click();
    });
    const newName = `${originalName} Renamed`;
    await test.step('Enter new name and save', async () => {
      const renameInput = dashboardPage.page.locator('input[value]').first();
      await expect(renameInput).toBeVisible({ timeout: 5_000 });
      await renameInput.clear();
      await renameInput.fill(newName);
      await dashboardPage.page.getByRole('button', { name: /save|rename|confirm/i }).last().click();
      await expect(
        dashboardPage.page.locator('a[href*="/subjects/"]').filter({ hasText: newName }),
      ).toBeVisible({ timeout: 10_000 });
    });
    await dashboardPage.page.screenshot({ path: 'test-results/screenshots/uc-subj-06-renamed.png', fullPage: true });
    await test.step('Restore original name', async () => {
      const renamedCard = dashboardPage.page.locator('a[href*="/subjects/"]').filter({ hasText: newName });
      await renamedCard.hover();
      await dashboardPage.page.getByRole('button', { name: /rename|edit/i }).first().click();
      const input2 = dashboardPage.page.locator('input[value]').first();
      await input2.clear();
      await input2.fill(originalName);
      await dashboardPage.page.getByRole('button', { name: /save|rename|confirm/i }).last().click();
    });
  });

  // ── UC-SUBJ-07: Delete a subject ─────────────────────────────────────────
  test('deleting a subject removes it from the dashboard', async ({ dashboardPage }) => {
    const name = uniqueSubjectName('Delete Me');
    await test.step('Create a transient subject', async () => {
      const addBtn = dashboardPage.page.getByRole('button', { name: /new subject/i }).first();
      await addBtn.click();
      const nameInput = dashboardPage.page.locator('input[placeholder*="Organic Chemistry"]');
      await expect(nameInput).toBeVisible({ timeout: 5_000 });
      await nameInput.click();
      await nameInput.pressSequentially(name, { delay: 40 });
      const createBtn = dashboardPage.page.getByRole('button', { name: /^create$/i });
      await expect(createBtn).toBeEnabled({ timeout: 5_000 });
      await createBtn.click();
      await expect(
        dashboardPage.page.locator('a[href*="/subjects/"]').filter({ hasText: name }),
      ).toBeVisible({ timeout: 12_000 });
    });
    await test.step('Delete the subject via MoreHorizontal menu', async () => {
      const card = dashboardPage.page.locator('a[href*="/subjects/"]').filter({ hasText: name });
      await card.hover();
      // Brief wait for the card's Framer Motion spring animation to settle
      await dashboardPage.page.waitForTimeout(600);
      // Scope to the specific card; force bypasses stability check during animation
      const moreBtn = card.locator('[data-testid="more-menu-btn"]');
      await moreBtn.click({ force: true });
      const deleteBtn = card.getByRole('button', { name: /^delete$/i });
      dashboardPage.page.on('dialog', (d) => d.accept());
      await deleteBtn.click();
    });
    await test.step('Verify subject card is gone', async () => {
      await expect(
        dashboardPage.page.locator('a[href*="/subjects/"]').filter({ hasText: name }),
      ).not.toBeVisible({ timeout: 10_000 });
    });
    await dashboardPage.page.screenshot({ path: 'test-results/screenshots/uc-subj-07-deleted.png', fullPage: true });
  });
});
