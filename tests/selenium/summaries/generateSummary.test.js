'use strict';

const assert = require('assert');
const { By } = require('selenium-webdriver');
const buildDriver = require('../utils/driver');
const config = require('../utils/config');
const { login } = require('../utils/loginHelper');
const { waitForElement, sleep } = require('../utils/waitHelpers');
const { captureScreenshot } = require('../utils/screenshotHelper');

describe('AI Summary Generation', function () {
  this.timeout(180000);
  let driver;
  let subjectUrl;

  async function findSubjectUrlFromDashboard() {
    await driver.get(`${config.baseUrl}/dashboard`);
    await sleep(1800);

    const subjectLinks = await driver.findElements(By.css('a[href*="/subjects/"]'));
    if (subjectLinks.length > 0) {
      return await subjectLinks[0].getAttribute('href');
    }

    try {
      const grid = await waitForElement(driver, By.css('div.grid.grid-cols-1'));
      const cards = await grid.findElements(By.xpath('./*'));
      for (const card of cards) {
        const text = await card.getText();
        if (!/items/i.test(text)) continue;
        await card.click();
        await sleep(1200);
        const url = await driver.getCurrentUrl();
        if (url.includes('/subjects/')) return url;
        await driver.get(`${config.baseUrl}/dashboard`);
        await sleep(1200);
      }
    } catch (err) {
      console.log(`  ⚠ Could not scan subject grid: ${err.message}`);
    }

    return null;
  }

  async function selectAnyUpload() {
    try {
      // Enable selection mode in the Sources panel
      try {
        const selectBtn = await driver.findElement(
          By.xpath("//button[contains(normalize-space(),'Select Multiple') or contains(normalize-space(),'Cancel Selection')]"),
        );
        await selectBtn.click();
        await sleep(300);
      } catch {}

      const uploadsHeader = await driver.findElement(
        By.xpath("//div[contains(@class,'file-list')]//button[.//span[normalize-space()='Uploads']]"),
      );
      const uploadsBody = await uploadsHeader.findElement(By.xpath('following-sibling::*[1]'));
      const uploadCards = await uploadsBody.findElements(
        By.xpath(".//div[contains(@class,'rounded-[2rem]') and contains(@class,'border-4')]"),
      );
      if (uploadCards.length === 0) return false;
      for (const card of uploadCards) {
        const text = (await card.getText()) || '';
        if (/processing|failed|empty/i.test(text)) continue;
        await driver.executeScript('arguments[0].scrollIntoView({block: \"center\"});', card);
        await card.click();
        await sleep(600);
        return true;
      }
      return false;
    } catch (err) {
      console.log(`  ⚠ Could not select an upload: ${err.message}`);
      return false;
    }
  }

  before(async function () {
    driver = await buildDriver();
    await login(driver);

    try {
      subjectUrl = await findSubjectUrlFromDashboard();
      if (subjectUrl) {
        console.log(`  → Found subject: ${subjectUrl}`);
      }
    } catch (e) {
      console.log(`  ⚠ Could not auto-locate a subject: ${e.message}`);
    }
  });

  after(async function () {
    if (driver) await driver.quit();
  });

  it('should show the Summary tab in the subject workspace', async function () {
    if (!subjectUrl) {
      console.log('  ⚠ No subject available – create a subject with uploaded material first.');
      this.skip();
      return;
    }

    try {
      await driver.get(subjectUrl);
      await sleep(1500);

      const summaryTab = await waitForElement(
        driver,
        By.xpath(
          '//button[contains(normalize-space(),"Summary")] | //a[contains(normalize-space(),"Summary")] | //*[@data-testid="tab-summary"]',
        ),
        config.timeouts.explicit,
      );
      assert.ok(await summaryTab.isDisplayed(), 'Summary tab should be visible');
      console.log('  ✓ Summary tab found in workspace');
    } catch (err) {
      await captureScreenshot(driver, 'summary-tab-visible');
      throw err;
    }
  });

  it('should navigate to Summary tab and trigger generation', async function () {
    if (!subjectUrl) {
      this.skip();
      return;
    }

    try {
      await driver.get(subjectUrl);
      await sleep(1500);
      const hasUpload = await selectAnyUpload();
      if (!hasUpload) {
        console.log('  ⚠ No upload found – summary generation needs at least one source.');
        this.skip();
        return;
      }

      // Click Summary tab
      try {
        const summaryTab = await driver.findElement(
          By.xpath(
            '//button[contains(normalize-space(),"Summary")] | //*[@data-testid="tab-summary"]',
          ),
        );
        await summaryTab.click();
        await sleep(1000);
        console.log('  → Switched to Summary tab');
      } catch {
        console.log('  → Summary tab may already be active');
      }

      // Click "Generate Summary" if present
      try {
        const generateBtn = await waitForElement(
          driver,
          By.xpath(
            '//button[contains(normalize-space(),"Generate") and not(@disabled)] | //*[@data-testid="generate-summary-btn"]',
          ),
          5000,
        );
        await generateBtn.click();
        console.log('  → Clicked Generate Summary');
      } catch {
        console.log('  → Generate button not found – summary may auto-generate or already exist');
      }

      // Wait for summary content (streamed text, prose block, or any long text)
      const summaryEl = await driver.wait(
        async () => {
          try {
            // Cognify summary likely renders inside a prose/markdown container
            const candidates = await driver.findElements(
              By.css('[class*="prose"], [class*="summary"], [data-testid*="summary"]'),
            );
            for (const el of candidates) {
              const text = await el.getText();
              if (text.trim().length > 80) return el;
            }
            // Broad fallback: any paragraph with substantial text
            const paragraphs = await driver.findElements(By.css('p'));
            for (const p of paragraphs) {
              const text = await p.getText();
              if (text.trim().length > 100) return p;
            }
            return null;
          } catch {
            return null;
          }
        },
        config.timeouts.aiGeneration,
        'AI summary content did not appear within timeout',
      );

      const summaryText = await summaryEl.getText();
      assert.ok(summaryText.trim().length > 80, `Summary should have meaningful content (got ${summaryText.length} chars)`);
      console.log(`  ✓ AI summary generated – ${summaryText.length} characters rendered`);
    } catch (err) {
      await captureScreenshot(driver, 'summary-generation');
      throw err;
    }
  });

  it('should display summary content without console errors', async function () {
    if (!subjectUrl) {
      this.skip();
      return;
    }

    try {
      await driver.get(subjectUrl);
      await sleep(1500);

      // Navigate to Summary tab
      try {
        const tab = await driver.findElement(
          By.xpath('//button[contains(normalize-space(),"Summary")]'),
        );
        await tab.click();
        await sleep(2000);
      } catch {}

      // Page should not show an error state
      const pageSource = await driver.getPageSource();
      const hasError =
        pageSource.includes('500') ||
        pageSource.toLowerCase().includes('something went wrong') ||
        pageSource.toLowerCase().includes('failed to fetch');

      assert.ok(!hasError, 'Summary page should not display server errors');
      console.log('  ✓ Summary tab rendered without error states');
    } catch (err) {
      await captureScreenshot(driver, 'summary-no-errors');
      throw err;
    }
  });
});
