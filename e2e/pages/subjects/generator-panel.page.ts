/**
 * pages/subjects/generator-panel.page.ts
 *
 * Page Object for the Study Generator panel (MaterialsPanel.jsx) inside the
 * subject workspace.
 *
 * The generator tab is always pinned (title: "Study Intelligence").
 * It is the default active tab when a user first enters the workspace.
 *
 * Panel header text: "Study Generator"
 * Material types:    Flashcards | Summary | Quiz | Mock Exam
 * Difficulty:        Adaptive | Beginner | Intermediate | Advanced
 * Summary modes:     Key Concepts | Concise Summary | Detailed Explanation |
 *                    Exam Ready Notes | Teach Me Mode
 */
import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from '../base.page';

export class GeneratorPanelPage extends BasePage {

  // ── Tab bar ───────────────────────────────────────────────────────────────
  // The pinned "Study Intelligence" tab in the WorkspaceTabs bar
  readonly generatorTab: Locator;

  // ── Panel header ─────────────────────────────────────────────────────────
  readonly panelHeading: Locator;

  // ── Material type selector (4 buttons) ───────────────────────────────────
  readonly typeFlashcards: Locator;
  readonly typeSummary:    Locator;
  readonly typeQuiz:       Locator;
  readonly typeMockExam:   Locator;

  // ── Difficulty buttons (shown for flashcards / quiz / mock_exam) ──────────
  readonly diffAdaptive:     Locator;
  readonly diffBeginner:     Locator;
  readonly diffIntermediate: Locator;
  readonly diffAdvanced:     Locator;

  // ── Summary mode buttons (shown only when Summary is selected) ────────────
  readonly modeKeyConcepts:        Locator;
  readonly modeConciseSummary:     Locator;
  readonly modeDetailedExplanation: Locator;
  readonly modeExamReadyNotes:     Locator;
  readonly modeTeachMe:            Locator;

  // ── Count slider (hidden for Summary and Adaptive quiz) ───────────────────
  // First range input in the panel
  readonly countSlider: Locator;

  // ── Mock exam extras ──────────────────────────────────────────────────────
  readonly examTypeSingleChoice:   Locator;
  readonly examTypeMultipleSelect: Locator;
  readonly examTypeShortAnswer:    Locator;
  readonly timeLimitSlider:        Locator;
  readonly topicsInput:            Locator;

  // ── Generate button ───────────────────────────────────────────────────────
  // Text: "Generate Flashcards" / "Generate Summary" / "Generate Quiz" /
  //       "Generate Mock Exam" / "Start Adaptive Session"
  readonly generateButton: Locator;

  // ── No-source alert (shown when Generate is clicked with no file selected) ─
  readonly noSourceAlert: Locator;

  // ── Loading spinner inside generate button ────────────────────────────────
  readonly generatingSpinner: Locator;

  constructor(page: Page) {
    super(page);

    this.generatorTab = page.locator('span').filter({ hasText: /study intelligence/i }).first();
    this.panelHeading = page.locator('span').filter({ hasText: /study generator/i }).first();

    // Type selector buttons — match by their label text
    this.typeFlashcards = page.getByRole('button', { name: /^flashcards/i }).first();
    this.typeSummary    = page.getByRole('button', { name: /^summary/i }).first();
    this.typeQuiz       = page.getByRole('button', { name: /^quiz/i }).first();
    this.typeMockExam   = page.getByRole('button', { name: /^mock exam/i }).first();

    // Difficulty selector buttons
    this.diffAdaptive     = page.getByRole('button', { name: /adaptive/i }).first();
    this.diffBeginner     = page.getByRole('button', { name: /beginner/i }).first();
    this.diffIntermediate = page.getByRole('button', { name: /intermediate/i }).first();
    this.diffAdvanced     = page.getByRole('button', { name: /advanced/i }).first();

    // Summary modes — these are also buttons
    this.modeKeyConcepts         = page.getByRole('button', { name: /key concepts/i }).first();
    this.modeConciseSummary      = page.getByRole('button', { name: /concise summary/i }).first();
    this.modeDetailedExplanation = page.getByRole('button', { name: /detailed explanation/i }).first();
    this.modeExamReadyNotes      = page.getByRole('button', { name: /exam ready notes/i }).first();
    this.modeTeachMe             = page.getByRole('button', { name: /teach me/i }).first();

    // Count slider: first <input type="range"> inside the panel
    this.countSlider = page.locator('input[type="range"]').first();

    // Mock exam extras
    this.examTypeSingleChoice   = page.getByRole('button', { name: /single choice/i });
    this.examTypeMultipleSelect = page.getByRole('button', { name: /multiple select/i });
    this.examTypeShortAnswer    = page.getByRole('button', { name: /short answer/i });
    this.timeLimitSlider        = page.locator('input[type="range"]').nth(1);
    this.topicsInput            = page.locator('input[placeholder*="Networks" i]');

    // Generate button — matches any of the possible texts
    this.generateButton = page.getByRole('button', {
      name: /generate (flashcards|summary|quiz|mock exam)|start adaptive session/i,
    }).first();

    // No-source alert: the warning text that appears when Generate is clicked
    // without any file selected
    this.noSourceAlert = page.getByText(/pick at least one file from the sources panel/i);

    // Spinner inside the button while generating
    this.generatingSpinner = page.locator('button').filter({
      has: page.locator('.animate-spin'),
    }).first();
  }

  /**
   * Click the "Study Intelligence" tab to ensure the generator panel is active.
   * (Idempotent — safe to call when it's already active.)
   */
  async activateGeneratorTab(): Promise<void> {
    await this.generatorTab.click();
    await expect(this.panelHeading).toBeVisible({ timeout: 6_000 });
  }

  /** Select a material type. */
  async selectType(type: 'flashcards' | 'summary' | 'quiz' | 'mock_exam'): Promise<void> {
    const btn = {
      flashcards: this.typeFlashcards,
      summary:    this.typeSummary,
      quiz:       this.typeQuiz,
      mock_exam:  this.typeMockExam,
    }[type];
    await btn.click();
  }

  /** Click Generate and return immediately (does not wait for output). */
  async clickGenerate(): Promise<void> {
    await this.generateButton.click();
  }

  /** Click Generate and assert that the no-source alert appears. */
  async expectNoSourceAlert(): Promise<void> {
    await this.clickGenerate();
    await expect(this.noSourceAlert).toBeVisible({ timeout: 5_000 });
  }

  /** Returns the current label of the generate button. */
  async generateButtonLabel(): Promise<string> {
    return (await this.generateButton.textContent())?.trim() ?? '';
  }
}
