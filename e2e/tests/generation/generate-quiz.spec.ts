/**
 * tests/generation/generate-quiz.spec.ts
 *
 * Sprint 3 — UC: Generate Quiz
 *
 * Validates the Quiz generation flow: type selection, difficulty options,
 * count slider visibility, Adaptive mode behaviour ("Start Adaptive Session"
 * label and hidden count slider), and the no-source guard.
 *
 * Tags:
 *  @smoke — subset run on every browser in CI
 */
import { test, expect } from '../../fixtures/index';
import { GeneratorPanelPage } from '../../pages/subjects/generator-panel.page';

test.describe('Generate Quiz', () => {

  // ── UC-QUIZ-01: Selecting Quiz type activates the panel ───────────────────
  test('clicking the Quiz type button selects it @smoke', async ({
    subjectWorkspacePage,
  }) => {
    const gen = new GeneratorPanelPage(subjectWorkspacePage.page);
    await test.step('Activate generator and select Quiz type', async () => {
      await gen.activateGeneratorTab();
      await gen.selectType('quiz');
    });
    await test.step('Verify generate button label reflects Quiz selection', async () => {
      const label = await gen.generateButtonLabel();
      // Adaptive is the default difficulty for quiz → button says "Start Adaptive Session"
      // Non-adaptive → "Generate Quiz"; both indicate the Quiz type is selected
      expect(label).toMatch(/generate quiz|start adaptive session/i);
    });
    await subjectWorkspacePage.page.screenshot({ path: 'test-results/screenshots/uc-quiz-01-quiz-selected.png', fullPage: true });
  });

  // ── UC-QUIZ-02: Difficulty selector is present for quiz ───────────────────
  test('quiz panel shows difficulty selector with Adaptive option @smoke', async ({
    subjectWorkspacePage,
  }) => {
    const gen = new GeneratorPanelPage(subjectWorkspacePage.page);
    await test.step('Activate generator and select Quiz type', async () => {
      await gen.activateGeneratorTab();
      await gen.selectType('quiz');
    });
    await test.step('Verify all difficulty buttons including Adaptive', async () => {
      await expect(gen.diffAdaptive).toBeVisible({ timeout: 5_000 });
      await expect(gen.diffBeginner).toBeVisible();
      await expect(gen.diffIntermediate).toBeVisible();
      await expect(gen.diffAdvanced).toBeVisible();
    });
    await subjectWorkspacePage.page.screenshot({ path: 'test-results/screenshots/uc-quiz-02-difficulty-selector.png', fullPage: true });
  });

  // ── UC-QUIZ-03: Count slider is visible for non-adaptive quiz ────────────
  test('count slider is visible when a non-adaptive difficulty is selected', async ({
    subjectWorkspacePage,
  }) => {
    const gen = new GeneratorPanelPage(subjectWorkspacePage.page);
    await test.step('Activate generator, select Quiz, click Beginner', async () => {
      await gen.activateGeneratorTab();
      await gen.selectType('quiz');
      await gen.diffBeginner.click();
    });
    await test.step('Verify count slider is visible for non-adaptive mode', async () => {
      await expect(gen.countSlider).toBeVisible({ timeout: 5_000 });
    });
    await subjectWorkspacePage.page.screenshot({ path: 'test-results/screenshots/uc-quiz-03-count-slider.png', fullPage: true });
  });

  // ── UC-QUIZ-04: Adaptive mode hides count and changes button label ─────────
  test('selecting Adaptive difficulty changes button to "Start Adaptive Session" @smoke', async ({
    subjectWorkspacePage,
  }) => {
    const gen = new GeneratorPanelPage(subjectWorkspacePage.page);
    await test.step('Activate generator, select Quiz, click Adaptive', async () => {
      await gen.activateGeneratorTab();
      await gen.selectType('quiz');
      await gen.diffAdaptive.click();
    });
    await test.step('Verify button label changes to "Start Adaptive Session"', async () => {
      const label = await gen.generateButtonLabel();
      expect(label).toMatch(/start adaptive session/i);
    });
    await test.step('Verify count slider is hidden in adaptive mode', async () => {
      await expect(gen.countSlider).not.toBeVisible({ timeout: 3_000 });
    });
    await subjectWorkspacePage.page.screenshot({ path: 'test-results/screenshots/uc-quiz-04-adaptive-mode.png', fullPage: true });
  });

  // ── UC-QUIZ-05: Generate button is enabled ────────────────────────────────
  test('quiz generate button is enabled @smoke', async ({
    subjectWorkspacePage,
  }) => {
    const gen = new GeneratorPanelPage(subjectWorkspacePage.page);
    await test.step('Activate generator and select Quiz type', async () => {
      await gen.activateGeneratorTab();
      await gen.selectType('quiz');
    });
    await test.step('Verify generate button is enabled', async () => {
      await expect(gen.generateButton).toBeEnabled({ timeout: 5_000 });
    });
    await subjectWorkspacePage.page.screenshot({ path: 'test-results/screenshots/uc-quiz-05-generate-enabled.png', fullPage: true });
  });

  // ── UC-QUIZ-06: No-source alert fires without a selected upload ───────────
  test('generating quiz without a source shows the no-source alert @smoke', async ({
    subjectWorkspacePage,
  }) => {
    const gen = new GeneratorPanelPage(subjectWorkspacePage.page);
    await test.step('Activate generator, select Quiz, set Beginner difficulty', async () => {
      await gen.activateGeneratorTab();
      await gen.selectType('quiz');
      await gen.diffBeginner.click();
    });
    await test.step('Attempt generation and verify no-source alert fires', async () => {
      await gen.expectNoSourceAlert();
    });
    await subjectWorkspacePage.page.screenshot({ path: 'test-results/screenshots/uc-quiz-06-no-source-alert.png', fullPage: true });
  });

  // ── UC-QUIZ-07: Count slider range is 3–30 ────────────────────────────────
  test('quiz count slider has min 3 and max 30', async ({
    subjectWorkspacePage,
  }) => {
    const gen = new GeneratorPanelPage(subjectWorkspacePage.page);
    await test.step('Activate generator, select Quiz, set Beginner difficulty', async () => {
      await gen.activateGeneratorTab();
      await gen.selectType('quiz');
      await gen.diffBeginner.click();
    });
    await test.step('Verify slider min is 3 and max is 30', async () => {
      const min = await gen.countSlider.getAttribute('min');
      const max = await gen.countSlider.getAttribute('max');
      expect(min).toBe('3');
      expect(max).toBe('30');
    });
    await subjectWorkspacePage.page.screenshot({ path: 'test-results/screenshots/uc-quiz-07-slider-range.png', fullPage: true });
  });
});
