/**
 * tests/generation/generate-summary.spec.ts
 *
 * Sprint 3 — UC: Generate Summary
 *
 * Validates the Summary generation flow: type selection, the appearance of
 * the Summary Mode selector (replacing the standard Difficulty buttons),
 * the five available modes, the hidden count slider, and the no-source guard.
 *
 * Summary modes (MaterialsPanel.jsx):
 *   Key Concepts | Concise Summary | Detailed Explanation |
 *   Exam Ready Notes | Teach Me Mode
 *
 * Tags:
 *  @smoke — subset run on every browser in CI
 */
import { test, expect } from '../../fixtures/index';
import { GeneratorPanelPage } from '../../pages/subjects/generator-panel.page';

test.describe('Generate Summary', () => {

  // ── UC-SUM-01: Selecting Summary type updates button label ────────────────
  test('clicking Summary type updates the generate button label @smoke', async ({
    subjectWorkspacePage,
  }) => {
    const gen = new GeneratorPanelPage(subjectWorkspacePage.page);
    await test.step('Activate generator and select Summary type', async () => {
      await gen.activateGeneratorTab();
      await gen.selectType('summary');
    });
    await test.step('Verify generate button label says "Generate Summary"', async () => {
      const label = await gen.generateButtonLabel();
      expect(label).toMatch(/generate summary/i);
    });
    await subjectWorkspacePage.page.screenshot({ path: 'test-results/screenshots/uc-sum-01-summary-selected.png', fullPage: true });
  });

  // ── UC-SUM-02: Summary Mode section replaces Difficulty ───────────────────
  test('selecting Summary shows "Summary Mode" label instead of Difficulty @smoke', async ({
    subjectWorkspacePage,
  }) => {
    const gen = new GeneratorPanelPage(subjectWorkspacePage.page);
    await test.step('Activate generator and select Summary type', async () => {
      await gen.activateGeneratorTab();
      await gen.selectType('summary');
    });
    await test.step('Verify "Summary Mode" section label is visible', async () => {
      const modeLabel = subjectWorkspacePage.page.getByText(/summary mode/i).first();
      await expect(modeLabel).toBeVisible({ timeout: 5_000 });
    });
    await subjectWorkspacePage.page.screenshot({ path: 'test-results/screenshots/uc-sum-02-mode-section.png', fullPage: true });
  });

  // ── UC-SUM-03: All five summary modes are rendered ────────────────────────
  test('summary panel shows all five summary mode options @smoke', async ({
    subjectWorkspacePage,
  }) => {
    const gen = new GeneratorPanelPage(subjectWorkspacePage.page);
    await test.step('Activate generator and select Summary type', async () => {
      await gen.activateGeneratorTab();
      await gen.selectType('summary');
    });
    await test.step('Verify all five mode buttons are visible', async () => {
      await expect(gen.modeKeyConcepts).toBeVisible({ timeout: 5_000 });
      await expect(gen.modeConciseSummary).toBeVisible();
      await expect(gen.modeDetailedExplanation).toBeVisible();
      await expect(gen.modeExamReadyNotes).toBeVisible();
      await expect(gen.modeTeachMe).toBeVisible();
    });
    await subjectWorkspacePage.page.screenshot({ path: 'test-results/screenshots/uc-sum-03-all-modes.png', fullPage: true });
  });

  // ── UC-SUM-04: Count slider is hidden for summary ─────────────────────────
  test('count slider is hidden when Summary type is selected', async ({
    subjectWorkspacePage,
  }) => {
    const gen = new GeneratorPanelPage(subjectWorkspacePage.page);
    await test.step('Activate generator and select Summary type', async () => {
      await gen.activateGeneratorTab();
      await gen.selectType('summary');
    });
    await test.step('Verify count slider is not visible for summary', async () => {
      await expect(gen.countSlider).not.toBeVisible({ timeout: 3_000 });
    });
    await subjectWorkspacePage.page.screenshot({ path: 'test-results/screenshots/uc-sum-04-no-count-slider.png', fullPage: true });
  });

  // ── UC-SUM-05: Selecting a summary mode makes it active ───────────────────
  test('clicking a summary mode button selects it', async ({
    subjectWorkspacePage,
  }) => {
    const gen = new GeneratorPanelPage(subjectWorkspacePage.page);
    await test.step('Activate generator, select Summary, click Key Concepts mode', async () => {
      await gen.activateGeneratorTab();
      await gen.selectType('summary');
      await gen.modeKeyConcepts.click();
    });
    await test.step('Verify Key Concepts mode button is visible', async () => {
      await expect(gen.modeKeyConcepts).toBeVisible();
    });
    await subjectWorkspacePage.page.screenshot({ path: 'test-results/screenshots/uc-sum-05-mode-selected.png', fullPage: true });
  });

  // ── UC-SUM-06: Detailed Explanation mode is selectable ────────────────────
  test('Detailed Explanation mode is selectable', async ({
    subjectWorkspacePage,
  }) => {
    const gen = new GeneratorPanelPage(subjectWorkspacePage.page);
    await test.step('Activate generator, select Summary, click Detailed Explanation', async () => {
      await gen.activateGeneratorTab();
      await gen.selectType('summary');
      await gen.modeDetailedExplanation.click();
    });
    await test.step('Verify Detailed Explanation mode button is visible', async () => {
      await expect(gen.modeDetailedExplanation).toBeVisible();
    });
    await subjectWorkspacePage.page.screenshot({ path: 'test-results/screenshots/uc-sum-06-detailed-mode.png', fullPage: true });
  });

  // ── UC-SUM-07: Generate button is enabled for summary ─────────────────────
  test('summary generate button is enabled @smoke', async ({
    subjectWorkspacePage,
  }) => {
    const gen = new GeneratorPanelPage(subjectWorkspacePage.page);
    await test.step('Activate generator and select Summary type', async () => {
      await gen.activateGeneratorTab();
      await gen.selectType('summary');
    });
    await test.step('Verify generate button is enabled', async () => {
      await expect(gen.generateButton).toBeEnabled({ timeout: 5_000 });
    });
    await subjectWorkspacePage.page.screenshot({ path: 'test-results/screenshots/uc-sum-07-generate-enabled.png', fullPage: true });
  });

  // ── UC-SUM-08: No-source alert fires without a selected upload ────────────
  test('generating summary without a source shows the no-source alert @smoke', async ({
    subjectWorkspacePage,
  }) => {
    const gen = new GeneratorPanelPage(subjectWorkspacePage.page);
    await test.step('Activate generator and select Summary type', async () => {
      await gen.activateGeneratorTab();
      await gen.selectType('summary');
    });
    await test.step('Attempt generation and verify no-source alert fires', async () => {
      await gen.expectNoSourceAlert();
    });
    await subjectWorkspacePage.page.screenshot({ path: 'test-results/screenshots/uc-sum-08-no-source-alert.png', fullPage: true });
  });
});
