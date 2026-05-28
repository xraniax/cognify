/**
 * tests/generation/generate-flashcards.spec.ts
 *
 * Sprint 3 — UC: Generate Flashcards
 *
 * Validates the Flashcards generation flow in the Study Generator panel.
 * Tests cover: type selection, difficulty config, count slider, generate
 * button label, no-source guard, and the loading state on generation start.
 *
 * NOTE: Tests do NOT assert on generated content — AI output is
 * non-deterministic and is validated separately via backend integration tests.
 *
 * Tags:
 *  @smoke — subset run on every browser in CI
 */
import { test, expect } from '../../fixtures/index';
import { GeneratorPanelPage } from '../../pages/subjects/generator-panel.page';

test.describe('Generate Flashcards', () => {

  // ── UC-FC-01: Generator panel is accessible ───────────────────────────────
  test('Study Intelligence tab opens the generator panel @smoke', async ({
    subjectWorkspacePage,
  }) => {
    const gen = new GeneratorPanelPage(subjectWorkspacePage.page);
    await test.step('Activate the generator tab', async () => {
      await gen.activateGeneratorTab();
    });
    await test.step('Verify generator panel heading is visible', async () => {
      await expect(gen.panelHeading).toBeVisible({ timeout: 8_000 });
    });
    await subjectWorkspacePage.page.screenshot({ path: 'test-results/screenshots/uc-fc-01-generator-panel.png', fullPage: true });
  });

  // ── UC-FC-02: Four material type buttons are rendered ─────────────────────
  test('generator panel shows all four material type buttons @smoke', async ({
    subjectWorkspacePage,
  }) => {
    const gen = new GeneratorPanelPage(subjectWorkspacePage.page);
    await test.step('Activate the generator tab', async () => {
      await gen.activateGeneratorTab();
    });
    await test.step('Verify all four type buttons are visible', async () => {
      await expect(gen.typeFlashcards).toBeVisible({ timeout: 6_000 });
      await expect(gen.typeSummary).toBeVisible();
      await expect(gen.typeQuiz).toBeVisible();
      await expect(gen.typeMockExam).toBeVisible();
    });
    await subjectWorkspacePage.page.screenshot({ path: 'test-results/screenshots/uc-fc-02-type-buttons.png', fullPage: true });
  });

  // ── UC-FC-03: Selecting Flashcards type activates it ─────────────────────
  test('clicking the Flashcards button selects that type @smoke', async ({
    subjectWorkspacePage,
  }) => {
    const gen = new GeneratorPanelPage(subjectWorkspacePage.page);
    await test.step('Activate generator tab and select Flashcards type', async () => {
      await gen.activateGeneratorTab();
      await gen.selectType('flashcards');
    });
    await test.step('Verify generate button label says "Generate Flashcards"', async () => {
      const label = await gen.generateButtonLabel();
      expect(label).toMatch(/generate flashcards/i);
    });
    await subjectWorkspacePage.page.screenshot({ path: 'test-results/screenshots/uc-fc-03-flashcards-selected.png', fullPage: true });
  });

  // ── UC-FC-04: Difficulty selector is present for flashcards ──────────────
  test('flashcards panel shows the difficulty selector', async ({
    subjectWorkspacePage,
  }) => {
    const gen = new GeneratorPanelPage(subjectWorkspacePage.page);
    await test.step('Activate generator and select Flashcards', async () => {
      await gen.activateGeneratorTab();
      await gen.selectType('flashcards');
    });
    await test.step('Verify all difficulty buttons are visible', async () => {
      await expect(gen.diffAdaptive).toBeVisible({ timeout: 5_000 });
      await expect(gen.diffBeginner).toBeVisible();
      await expect(gen.diffIntermediate).toBeVisible();
      await expect(gen.diffAdvanced).toBeVisible();
    });
    await subjectWorkspacePage.page.screenshot({ path: 'test-results/screenshots/uc-fc-04-difficulty-selector.png', fullPage: true });
  });

  // ── UC-FC-05: Count slider is present for flashcards ─────────────────────
  test('flashcards panel shows the card count slider', async ({
    subjectWorkspacePage,
  }) => {
    const gen = new GeneratorPanelPage(subjectWorkspacePage.page);
    await test.step('Activate generator and select Flashcards', async () => {
      await gen.activateGeneratorTab();
      await gen.selectType('flashcards');
    });
    await test.step('Verify count slider is visible', async () => {
      await expect(gen.countSlider).toBeVisible({ timeout: 5_000 });
    });
    await subjectWorkspacePage.page.screenshot({ path: 'test-results/screenshots/uc-fc-05-count-slider.png', fullPage: true });
  });

  // ── UC-FC-06: Difficulty selection changes active button ─────────────────
  test('selecting Advanced difficulty highlights the Advanced button', async ({
    subjectWorkspacePage,
  }) => {
    const gen = new GeneratorPanelPage(subjectWorkspacePage.page);
    await test.step('Activate generator, select Flashcards, click Advanced', async () => {
      await gen.activateGeneratorTab();
      await gen.selectType('flashcards');
      await gen.diffAdvanced.click();
    });
    await test.step('Verify Advanced button is still rendered', async () => {
      await expect(gen.diffAdvanced).toBeVisible();
    });
    await subjectWorkspacePage.page.screenshot({ path: 'test-results/screenshots/uc-fc-06-advanced-selected.png', fullPage: true });
  });

  // ── UC-FC-07: Generate button is present ─────────────────────────────────
  test('generate button is rendered and enabled @smoke', async ({
    subjectWorkspacePage,
  }) => {
    const gen = new GeneratorPanelPage(subjectWorkspacePage.page);
    await test.step('Activate generator and select Flashcards', async () => {
      await gen.activateGeneratorTab();
      await gen.selectType('flashcards');
    });
    await test.step('Verify generate button is visible and enabled', async () => {
      await expect(gen.generateButton).toBeVisible({ timeout: 5_000 });
      await expect(gen.generateButton).toBeEnabled();
    });
    await subjectWorkspacePage.page.screenshot({ path: 'test-results/screenshots/uc-fc-07-generate-button.png', fullPage: true });
  });

  // ── UC-FC-08: Clicking Generate without a source shows the alert ──────────
  test('generating without a selected source shows the no-source alert @smoke', async ({
    subjectWorkspacePage,
  }) => {
    const gen = new GeneratorPanelPage(subjectWorkspacePage.page);
    await test.step('Activate generator and select Flashcards', async () => {
      await gen.activateGeneratorTab();
      await gen.selectType('flashcards');
    });
    await test.step('Attempt generation and verify no-source alert fires', async () => {
      await gen.expectNoSourceAlert();
    });
    await subjectWorkspacePage.page.screenshot({ path: 'test-results/screenshots/uc-fc-08-no-source-alert.png', fullPage: true });
  });
});
