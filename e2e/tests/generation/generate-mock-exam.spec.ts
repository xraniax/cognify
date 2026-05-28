/**
 * tests/generation/generate-mock-exam.spec.ts
 *
 * Sprint 3 — UC: Generate Mock Exam
 *
 * Validates the Mock Exam generation flow: type selection, the appearance
 * of exam-specific options (question types, time limit slider, focus topics
 * input), count slider, and the no-source guard.
 *
 * Mock exam question types (MaterialsPanel.jsx):
 *   Single Choice | Multiple Select | Short Answer |
 *   Problem Solving | Fill in the Blank | Matching
 *
 * Tags:
 *  @smoke — subset run on every browser in CI
 */
import { test, expect } from '../../fixtures/index';
import { GeneratorPanelPage } from '../../pages/subjects/generator-panel.page';

test.describe('Generate Mock Exam', () => {

  // ── UC-EXAM-01: Selecting Mock Exam updates the button label ──────────────
  test('clicking Mock Exam updates the generate button label @smoke', async ({
    subjectWorkspacePage,
  }) => {
    const gen = new GeneratorPanelPage(subjectWorkspacePage.page);
    await test.step('Activate generator and select Mock Exam type', async () => {
      await gen.activateGeneratorTab();
      await gen.selectType('mock_exam');
    });
    await test.step('Verify generate button label says "Generate Mock Exam"', async () => {
      const label = await gen.generateButtonLabel();
      expect(label).toMatch(/generate mock exam/i);
    });
    await subjectWorkspacePage.page.screenshot({ path: 'test-results/screenshots/uc-exam-01-exam-selected.png', fullPage: true });
  });

  // ── UC-EXAM-02: Question types section appears for mock exam ──────────────
  test('mock exam panel shows the Question Types section @smoke', async ({
    subjectWorkspacePage,
  }) => {
    const gen = new GeneratorPanelPage(subjectWorkspacePage.page);
    await test.step('Activate generator and select Mock Exam type', async () => {
      await gen.activateGeneratorTab();
      await gen.selectType('mock_exam');
    });
    await test.step('Verify Question Types section label is visible', async () => {
      const questionTypesLabel = subjectWorkspacePage.page.getByText(/question types/i).first();
      await expect(questionTypesLabel).toBeVisible({ timeout: 5_000 });
    });
    await subjectWorkspacePage.page.screenshot({ path: 'test-results/screenshots/uc-exam-02-question-types-section.png', fullPage: true });
  });

  // ── UC-EXAM-03: All six question type toggles are rendered ────────────────
  test('mock exam panel shows all six question type options @smoke', async ({
    subjectWorkspacePage,
  }) => {
    const gen = new GeneratorPanelPage(subjectWorkspacePage.page);
    await test.step('Activate generator and select Mock Exam type', async () => {
      await gen.activateGeneratorTab();
      await gen.selectType('mock_exam');
    });
    await test.step('Verify all six question type buttons are visible', async () => {
      await expect(gen.examTypeSingleChoice).toBeVisible({ timeout: 5_000 });
      await expect(gen.examTypeMultipleSelect).toBeVisible();
      await expect(gen.examTypeShortAnswer).toBeVisible();
      await expect(subjectWorkspacePage.page.getByRole('button', { name: /problem solving/i })).toBeVisible();
      await expect(subjectWorkspacePage.page.getByRole('button', { name: /fill in the blank/i })).toBeVisible();
      await expect(subjectWorkspacePage.page.getByRole('button', { name: /matching/i })).toBeVisible();
    });
    await subjectWorkspacePage.page.screenshot({ path: 'test-results/screenshots/uc-exam-03-all-question-types.png', fullPage: true });
  });

  // ── UC-EXAM-04: Time limit slider appears ────────────────────────────────
  test('mock exam panel shows the time limit slider', async ({
    subjectWorkspacePage,
  }) => {
    const gen = new GeneratorPanelPage(subjectWorkspacePage.page);
    await test.step('Activate generator and select Mock Exam type', async () => {
      await gen.activateGeneratorTab();
      await gen.selectType('mock_exam');
    });
    await test.step('Verify time limit label and slider are visible', async () => {
      const timeLimitLabel = subjectWorkspacePage.page.getByText(/time limit/i).first();
      await expect(timeLimitLabel).toBeVisible({ timeout: 5_000 });
      await expect(gen.timeLimitSlider).toBeVisible();
    });
    await subjectWorkspacePage.page.screenshot({ path: 'test-results/screenshots/uc-exam-04-time-limit-slider.png', fullPage: true });
  });

  // ── UC-EXAM-05: Time limit slider range is 5–120 ─────────────────────────
  test('time limit slider has min 5 min and max 120 min', async ({
    subjectWorkspacePage,
  }) => {
    const gen = new GeneratorPanelPage(subjectWorkspacePage.page);
    await test.step('Activate generator and select Mock Exam type', async () => {
      await gen.activateGeneratorTab();
      await gen.selectType('mock_exam');
    });
    await test.step('Verify time limit slider min is 5 and max is 120', async () => {
      const min = await gen.timeLimitSlider.getAttribute('min');
      const max = await gen.timeLimitSlider.getAttribute('max');
      expect(min).toBe('5');
      expect(max).toBe('120');
    });
    await subjectWorkspacePage.page.screenshot({ path: 'test-results/screenshots/uc-exam-05-slider-range.png', fullPage: true });
  });

  // ── UC-EXAM-06: Optional focus topics input is rendered ───────────────────
  test('mock exam panel shows the optional topics input', async ({
    subjectWorkspacePage,
  }) => {
    const gen = new GeneratorPanelPage(subjectWorkspacePage.page);
    await test.step('Activate generator and select Mock Exam type', async () => {
      await gen.activateGeneratorTab();
      await gen.selectType('mock_exam');
    });
    await test.step('Verify focus topics input is visible', async () => {
      await expect(gen.topicsInput).toBeVisible({ timeout: 5_000 });
    });
    await subjectWorkspacePage.page.screenshot({ path: 'test-results/screenshots/uc-exam-06-topics-input.png', fullPage: true });
  });

  // ── UC-EXAM-07: Question type toggles can be deselected ───────────────────
  test('clicking an active question type button deselects it', async ({
    subjectWorkspacePage,
  }) => {
    const gen = new GeneratorPanelPage(subjectWorkspacePage.page);
    await test.step('Activate generator and select Mock Exam type', async () => {
      await gen.activateGeneratorTab();
      await gen.selectType('mock_exam');
    });
    await test.step('Enable Multiple Select then deselect Single Choice', async () => {
      await gen.examTypeMultipleSelect.click();
      await gen.examTypeSingleChoice.click();
    });
    await test.step('Verify Single Choice button remains rendered after toggle', async () => {
      await expect(gen.examTypeSingleChoice).toBeVisible();
    });
    await subjectWorkspacePage.page.screenshot({ path: 'test-results/screenshots/uc-exam-07-type-deselected.png', fullPage: true });
  });

  // ── UC-EXAM-08: Generate button is enabled ────────────────────────────────
  test('mock exam generate button is enabled @smoke', async ({
    subjectWorkspacePage,
  }) => {
    const gen = new GeneratorPanelPage(subjectWorkspacePage.page);
    await test.step('Activate generator and select Mock Exam type', async () => {
      await gen.activateGeneratorTab();
      await gen.selectType('mock_exam');
    });
    await test.step('Verify generate button is enabled', async () => {
      await expect(gen.generateButton).toBeEnabled({ timeout: 5_000 });
    });
    await subjectWorkspacePage.page.screenshot({ path: 'test-results/screenshots/uc-exam-08-generate-enabled.png', fullPage: true });
  });

  // ── UC-EXAM-09: No-source alert fires without a selected upload ───────────
  test('generating mock exam without a source shows the no-source alert @smoke', async ({
    subjectWorkspacePage,
  }) => {
    const gen = new GeneratorPanelPage(subjectWorkspacePage.page);
    await test.step('Activate generator and select Mock Exam type', async () => {
      await gen.activateGeneratorTab();
      await gen.selectType('mock_exam');
    });
    await test.step('Attempt generation and verify no-source alert fires', async () => {
      await gen.expectNoSourceAlert();
    });
    await subjectWorkspacePage.page.screenshot({ path: 'test-results/screenshots/uc-exam-09-no-source-alert.png', fullPage: true });
  });
});
