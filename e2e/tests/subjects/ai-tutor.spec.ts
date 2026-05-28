/**
 * tests/subjects/ai-tutor.spec.ts
 *
 * Sprint 4 — UC: Interact with AI Tutor
 *
 * Validates the AI Tutor chat panel (ChatPanel.jsx) embedded in the Subject
 * workspace (SubjectDetail.jsx).
 *
 * The panel is toggled via the "Tutor" button in the workspace header. When
 * open it shows:
 *  - Four suggested-prompt buttons (Summarize / Key Concepts / Study Tip / Quiz)
 *  - A textarea (placeholder: "Ask your tutor…")
 *  - A voice-input button
 *  - A Send button (disabled when input is empty)
 *
 * Tags:
 *  @smoke — subset run on every browser in CI
 */
import { test, expect } from '../../fixtures/index';
import { ChatPanelPage } from '../../pages/subjects/chat-panel.page';

test.describe('Interact with AI Tutor', () => {

  // ── UC-TUTOR-01: Tutor toggle button is visible in workspace header ───────
  test('subject workspace shows the Tutor toggle button @smoke', async ({
    subjectWorkspacePage,
  }) => {
    const chat = new ChatPanelPage(subjectWorkspacePage.page);
    await test.step('Verify Tutor toggle button is visible in workspace header', async () => {
      await expect(chat.tutorToggleButton).toBeVisible({ timeout: 8_000 });
    });
    await subjectWorkspacePage.page.screenshot({ path: 'test-results/screenshots/uc-tutor-01-toggle-button.png', fullPage: true });
  });

  // ── UC-TUTOR-02: Opening the panel exposes the chat input ─────────────────
  test('clicking Tutor button reveals the chat textarea @smoke', async ({
    subjectWorkspacePage,
  }) => {
    const chat = new ChatPanelPage(subjectWorkspacePage.page);
    await test.step('Open the tutor panel', async () => {
      await chat.ensureTutorOpen();
    });
    await test.step('Verify chat textarea is visible', async () => {
      await expect(chat.chatInput).toBeVisible({ timeout: 8_000 });
    });
    await subjectWorkspacePage.page.screenshot({ path: 'test-results/screenshots/uc-tutor-02-chat-input-visible.png', fullPage: true });
  });

  // ── UC-TUTOR-03: Chat input has the expected placeholder ─────────────────
  test('chat textarea has placeholder "Ask your tutor…"', async ({
    subjectWorkspacePage,
  }) => {
    const chat = new ChatPanelPage(subjectWorkspacePage.page);
    await test.step('Open the tutor panel', async () => {
      await chat.ensureTutorOpen();
      await expect(chat.chatInput).toBeVisible({ timeout: 8_000 });
    });
    await test.step('Verify placeholder text matches "Ask your tutor"', async () => {
      const placeholder = await chat.chatInput.getAttribute('placeholder');
      expect(placeholder).toMatch(/ask your tutor/i);
    });
    await subjectWorkspacePage.page.screenshot({ path: 'test-results/screenshots/uc-tutor-03-placeholder.png', fullPage: true });
  });

  // ── UC-TUTOR-04: Send button is disabled when input is empty ─────────────
  test('Send button is disabled when the chat input is empty @smoke', async ({
    subjectWorkspacePage,
  }) => {
    const chat = new ChatPanelPage(subjectWorkspacePage.page);
    await test.step('Open tutor panel and clear input', async () => {
      await chat.ensureTutorOpen();
      await chat.chatInput.clear();
    });
    await test.step('Verify Send button is visible and disabled', async () => {
      await expect(chat.sendButton).toBeVisible({ timeout: 8_000 });
      await expect(chat.sendButton).toBeDisabled();
    });
    await subjectWorkspacePage.page.screenshot({ path: 'test-results/screenshots/uc-tutor-04-send-disabled.png', fullPage: true });
  });

  // ── UC-TUTOR-05: Typing in the input enables the Send button ─────────────
  test('typing text in the chat input enables the Send button @smoke', async ({
    subjectWorkspacePage,
  }) => {
    const chat = new ChatPanelPage(subjectWorkspacePage.page);
    await test.step('Open tutor panel and type a message', async () => {
      await chat.ensureTutorOpen();
      await chat.chatInput.fill('What is this subject about?');
    });
    await test.step('Verify Send button becomes enabled', async () => {
      await expect(chat.sendButton).toBeEnabled({ timeout: 5_000 });
    });
    await subjectWorkspacePage.page.screenshot({ path: 'test-results/screenshots/uc-tutor-05-send-enabled.png', fullPage: true });
    await test.step('Clear input to restore state', async () => {
      await chat.chatInput.clear();
    });
  });

  // ── UC-TUTOR-06: Voice input button is present ────────────────────────────
  test('voice input button is rendered in the chat panel', async ({
    subjectWorkspacePage,
  }) => {
    const chat = new ChatPanelPage(subjectWorkspacePage.page);
    await test.step('Open the tutor panel', async () => {
      await chat.ensureTutorOpen();
    });
    await test.step('Verify voice input button is visible', async () => {
      await expect(chat.voiceButton).toBeVisible({ timeout: 8_000 });
    });
    await subjectWorkspacePage.page.screenshot({ path: 'test-results/screenshots/uc-tutor-06-voice-button.png', fullPage: true });
  });

  // ── UC-TUTOR-07: Suggested prompt "Summarize the main topics" is visible ──
  test('suggested prompt "Summarize the main topics" is present @smoke', async ({
    subjectWorkspacePage,
  }) => {
    const chat = new ChatPanelPage(subjectWorkspacePage.page);
    await test.step('Open the tutor panel', async () => {
      await chat.ensureTutorOpen();
    });
    await test.step('Verify Summarize prompt button is visible', async () => {
      await expect(chat.promptSummarize).toBeVisible({ timeout: 8_000 });
    });
    await subjectWorkspacePage.page.screenshot({ path: 'test-results/screenshots/uc-tutor-07-summarize-prompt.png', fullPage: true });
  });

  // ── UC-TUTOR-08: All four suggested prompts are visible ───────────────────
  test('all four suggested prompts are displayed in the chat panel @smoke', async ({
    subjectWorkspacePage,
  }) => {
    const chat = new ChatPanelPage(subjectWorkspacePage.page);
    await test.step('Open the tutor panel', async () => {
      await chat.ensureTutorOpen();
    });
    await test.step('Verify all four suggested prompt buttons are visible', async () => {
      await expect(chat.promptSummarize).toBeVisible({ timeout: 8_000 });
      await expect(chat.promptKeyConcepts).toBeVisible();
      await expect(chat.promptStudyTip).toBeVisible();
      await expect(chat.promptQuizQuestion).toBeVisible();
    });
    await subjectWorkspacePage.page.screenshot({ path: 'test-results/screenshots/uc-tutor-08-all-prompts.png', fullPage: true });
  });

  // ── UC-TUTOR-09: Clicking a suggested prompt fills the input ─────────────
  test('clicking a suggested prompt populates the chat input', async ({
    subjectWorkspacePage,
  }) => {
    const chat = new ChatPanelPage(subjectWorkspacePage.page);
    await test.step('Open the tutor panel', async () => {
      await chat.ensureTutorOpen();
    });
    await test.step('Click the Summarize prompt button', async () => {
      await chat.promptSummarize.dispatchEvent('click');
    });
    await test.step('Verify input is populated with prompt text', async () => {
      // React state update is async; use toHaveValue for auto-retry
      await expect(chat.chatInput).toHaveValue(/summarize/i, { timeout: 5_000 });
    });
    await subjectWorkspacePage.page.screenshot({ path: 'test-results/screenshots/uc-tutor-09-prompt-fills-input.png', fullPage: true });
    await test.step('Clear input to restore state', async () => {
      await chat.chatInput.clear();
    });
  });

  // ── UC-TUTOR-10: Sending a message clears the input ──────────────────────
  test('sending a chat message clears the input field', async ({
    subjectWorkspacePage,
  }) => {
    const chat = new ChatPanelPage(subjectWorkspacePage.page);
    await test.step('Open tutor panel and type a message', async () => {
      await chat.ensureTutorOpen();
      await chat.chatInput.dispatchEvent('click');
      await chat.chatInput.pressSequentially('Give me a quick overview');
    });
    await test.step('Send the message', async () => {
      await chat.chatInput.press('Enter');
    });
    await test.step('Verify input field clears after dispatch', async () => {
      await expect(chat.chatInput).toHaveValue('', { timeout: 10_000 });
    });
    await subjectWorkspacePage.page.screenshot({ path: 'test-results/screenshots/uc-tutor-10-input-cleared.png', fullPage: true });
  });
});
