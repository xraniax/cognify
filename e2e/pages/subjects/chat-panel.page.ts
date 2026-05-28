/**
 * pages/subjects/chat-panel.page.ts
 *
 * Page object for the AI Tutor chat panel in the Subject workspace
 * (SubjectDetail.jsx → ChatPanel.jsx).
 *
 * The panel is toggled via the "Tutor" button in the workspace header.
 * When expanded it shows:
 *  - Four suggested-prompt buttons
 *  - A textarea (placeholder: "Ask your tutor…")
 *  - A voice-input button
 *  - A Send button (enabled only when input is non-empty)
 */
import { Page, Locator } from '@playwright/test';
import { BasePage } from '../base.page';

export class ChatPanelPage extends BasePage {
  /** "Tutor" toggle button in the workspace header bar */
  readonly tutorToggleButton:   Locator;
  /** The chat textarea */
  readonly chatInput:           Locator;
  /** The Send button (title="Send") */
  readonly sendButton:          Locator;
  /** Voice input button */
  readonly voiceButton:         Locator;
  /** Four suggested-prompt buttons */
  readonly promptSummarize:     Locator;
  readonly promptKeyConcepts:   Locator;
  readonly promptStudyTip:      Locator;
  readonly promptQuizQuestion:  Locator;

  constructor(page: Page) {
    super(page);
    this.tutorToggleButton  = page.getByRole('button', { name: /^tutor$/i });
    this.chatInput          = page.locator('textarea[placeholder*="Ask your tutor"]');
    this.sendButton         = page.locator('button[title="Send"]');
    this.voiceButton        = page.locator('button[title="Voice input"], button[title="Stop listening"]').first();
    this.promptSummarize    = page.getByRole('button', { name: /summarize the main topics/i });
    this.promptKeyConcepts  = page.getByRole('button', { name: /what are the key concepts/i });
    this.promptStudyTip     = page.getByRole('button', { name: /give me a study tip/i });
    this.promptQuizQuestion = page.getByRole('button', { name: /create a quick quiz question/i });
  }

  /** Ensures the Tutor panel is open (expands it if currently collapsed). */
  async ensureTutorOpen(): Promise<void> {
    const visible = await this.chatInput.isVisible().catch(() => false);
    if (!visible) {
      await this.tutorToggleButton.click();
    }
  }

  /** Types `text` into the chat input and clicks Send. */
  async sendMessage(text: string): Promise<void> {
    await this.ensureTutorOpen();
    await this.chatInput.fill(text);
    await this.sendButton.click();
  }
}
