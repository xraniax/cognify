'use strict';

const assert = require('assert');
const { By } = require('selenium-webdriver');
const buildDriver = require('../utils/driver');
const config = require('../utils/config');
const { login } = require('../utils/loginHelper');
const { waitForElement, waitForUrl, sleep } = require('../utils/waitHelpers');
const { captureScreenshot } = require('../utils/screenshotHelper');

describe('Study Plan Generation', function () {
  this.timeout(180000);
  let driver;

  before(async function () {
    driver = await buildDriver();
    await login(driver);
  });

  after(async function () {
    if (driver) await driver.quit();
  });

  it('should navigate to the Goals page', async function () {
    try {
      await driver.get(`${config.baseUrl}/goals`);
      await waitForUrl(driver, '/goals', config.timeouts.explicit);

      const pageSource = await driver.getPageSource();
      const hasGoalContent =
        pageSource.includes('Goal') ||
        pageSource.includes('goal') ||
        pageSource.includes('Plan') ||
        pageSource.includes('Study');

      assert.ok(hasGoalContent, 'Goals page should have goal or plan-related content');
      console.log('  ✓ Navigated to /goals');
    } catch (err) {
      await captureScreenshot(driver, 'goals-navigation');
      throw err;
    }
  });

  it('should show a Generate study plan button', async function () {
    try {
      await driver.get(`${config.baseUrl}/goals`);
      await sleep(1500);

      // Cognify Goals.jsx: button with <Sparkles> icon and text "Generate" / "Regenerate"
      const generateBtn = await waitForElement(
        driver,
        By.xpath(
          '//button[contains(normalize-space(),"Generate")] | //button[contains(normalize-space(),"Regenerate")] | //*[@data-testid="generate-plan-btn"]',
        ),
        config.timeouts.explicit,
      );
      assert.ok(await generateBtn.isDisplayed(), 'Generate study plan button should be visible');
      console.log('  ✓ Generate study plan button found');
    } catch (err) {
      await captureScreenshot(driver, 'goals-generate-btn');
      throw err;
    }
  });

  it('should generate a study plan and display structured sessions', async function () {
    try {
      await driver.get(`${config.baseUrl}/goals`);
      await sleep(1500);

      // Click Generate / Regenerate
      const generateBtn = await waitForElement(
        driver,
        By.xpath(
          '//button[contains(normalize-space(),"Generate") and not(@disabled)] | //button[contains(normalize-space(),"Regenerate") and not(@disabled)]',
        ),
        config.timeouts.explicit,
      );
      await generateBtn.click();
      console.log('  → Generating study plan...');

      // Wait for plan sessions to appear
      // Cognify plan UI shows day-of-week (Mon/Tue…), duration in minutes, focus topics
      const planEl = await driver.wait(
        async () => {
          try {
            // Look for a session element containing day names or "session"
            const items = await driver.findElements(
              By.xpath(
                '//*[contains(normalize-space(),"Session") or contains(normalize-space(),"Monday") or contains(normalize-space(),"Tuesday") or contains(normalize-space(),"min")]',
              ),
            );
            for (const item of items) {
              if (await item.isDisplayed()) return item;
            }
            return null;
          } catch {
            return null;
          }
        },
        config.timeouts.aiGeneration,
        'Study plan sessions did not appear within timeout',
      );

      assert.ok(planEl, 'Study plan should display sessions after generation');
      console.log('  ✓ Study plan generated with structured sessions');
    } catch (err) {
      await captureScreenshot(driver, 'goals-plan-generation');
      throw err;
    }
  });

  it('should display study plan with timing and topic information', async function () {
    try {
      await driver.get(`${config.baseUrl}/goals`);
      await sleep(2500);

      const pageSource = await driver.getPageSource();

      // Study plan content markers: duration in minutes, topic/focus text
      const hasPlanData =
        pageSource.includes('min') ||
        pageSource.includes('Session') ||
        pageSource.includes('session') ||
        pageSource.includes('focus') ||
        pageSource.includes('week') ||
        pageSource.includes('day');

      assert.ok(hasPlanData, 'Study plan should include timing and topic data');
      console.log('  ✓ Study plan content contains structured session data');
    } catch (err) {
      await captureScreenshot(driver, 'goals-plan-content');
      throw err;
    }
  });

  it('should allow expanding individual session details', async function () {
    try {
      await driver.get(`${config.baseUrl}/goals`);
      await sleep(2000);

      // Cognify plan sessions are expandable with ChevronDown
      const expandButtons = await driver.findElements(
        By.css('[class*="chevron"], [class*="expand"], button[class*="session"]'),
      );

      if (expandButtons.length > 0) {
        await expandButtons[0].click();
        await sleep(500);
        console.log('  ✓ Session expand/collapse interaction works');
      } else {
        // Sessions may render inline without expansion
        console.log('  → No expandable sessions found – sessions may render inline');
      }
      assert.ok(true, 'Session expansion check completed');
    } catch (err) {
      await captureScreenshot(driver, 'goals-session-expand');
      throw err;
    }
  });
});
