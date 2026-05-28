/**
 * pages/analytics.page.ts
 *
 * Page object for the Subject Analytics page (/analytics/subjects/:subjectId).
 * Covers dimension cards (Understanding, Retention, Mastery), concept mastery
 * table with filter tabs, Refresh button, and the back button to /analytics.
 */
import { Page, Locator } from '@playwright/test';
import { BasePage } from './base.page';

export class AnalyticsSubjectPage extends BasePage {
  readonly backButton:             Locator;
  readonly refreshButton:          Locator;
  readonly cardUnderstanding:      Locator;
  readonly cardRetention:          Locator;
  readonly cardMastery:            Locator;
  readonly conceptMasteryLabel:    Locator;
  readonly conceptFilterAll:       Locator;
  readonly conceptFilterCritical:  Locator;
  readonly conceptFilterWeak:      Locator;
  readonly conceptFilterDeveloping: Locator;
  readonly conceptFilterMastered:  Locator;

  constructor(page: Page) {
    super(page);
    // "Overview" back-nav button (navigates to /analytics)
    this.backButton             = page.getByRole('button', { name: /overview/i });
    // "Refresh" button in top-right
    this.refreshButton          = page.getByRole('button', { name: /refresh/i });
    // Dimension cards — label text inside DimCard components
    this.cardUnderstanding      = page.getByText('Understanding').first();
    this.cardRetention          = page.getByText('Retention').first();
    this.cardMastery            = page.getByText('Mastery').first();
    // Concept mastery table header
    this.conceptMasteryLabel    = page.getByText(/concept mastery/i).first();
    // Concept state filter buttons inside the mastery table header
    this.conceptFilterAll       = page.getByRole('button', { name: /^all$/i }).last();
    this.conceptFilterCritical  = page.getByRole('button', { name: /^critical/i }).last();
    this.conceptFilterWeak      = page.getByRole('button', { name: /^weak/i }).last();
    this.conceptFilterDeveloping = page.getByRole('button', { name: /^developing/i }).last();
    this.conceptFilterMastered  = page.getByRole('button', { name: /^mastered/i }).last();
  }

  async open(subjectId: string): Promise<void> {
    await this.page.goto(`/analytics/subjects/${subjectId}`);
    await this.waitForPageReady();
  }

  /** Returns true if the page is currently on an analytics/subjects URL. */
  isOnAnalyticsPage(): boolean {
    return this.page.url().includes('/analytics/subjects/');
  }
}
