'use strict';

const assert = require('assert');
const { By } = require('selenium-webdriver');
const buildDriver = require('../utils/driver');
const config = require('../utils/config');
const { login } = require('../utils/loginHelper');
const { waitForElement, waitForUrl } = require('../utils/waitHelpers');
const { captureScreenshot } = require('../utils/screenshotHelper');

describe('Authentication – Login', function () {
  this.timeout(60000);
  let driver;

  before(async function () {
    this.timeout(120000); // allow Selenium Manager to download ChromeDriver on first run
    driver = await buildDriver();
  });

  after(async function () {
    if (driver) await driver.quit();
  });

  it('should display the login page with all required fields', async function () {
    try {
      await driver.get(`${config.baseUrl}/login`);

      const emailInput = await waitForElement(driver, By.css('input[type="email"]'));
      const passwordInput = await waitForElement(driver, By.css('input[type="password"]'));

      assert.ok(await emailInput.isDisplayed(), 'Email input should be visible');
      assert.ok(await passwordInput.isDisplayed(), 'Password input should be visible');

      // Verify placeholder text matches Cognify's Login.jsx
      const emailPlaceholder = await emailInput.getAttribute('placeholder');
      assert.ok(emailPlaceholder, 'Email input should have placeholder text');

      console.log(`  ✓ Login page renders with email and password fields`);
    } catch (err) {
      await captureScreenshot(driver, 'login-page-display');
      throw err;
    }
  });

  it('should show Sign In button and social login options', async function () {
    try {
      await driver.get(`${config.baseUrl}/login`);

      // Primary submit button – Cognify renders "Sign In" text
      let signInBtn;
      try {
        signInBtn = await driver.findElement(By.css('button[type="submit"]'));
      } catch {
        signInBtn = await driver.findElement(
          By.xpath('//button[contains(normalize-space(), "Sign In")]'),
        );
      }
      assert.ok(await signInBtn.isDisplayed(), 'Sign In button should be visible');

      // Social login buttons (Google / GitHub)
      const pageSource = await driver.getPageSource();
      assert.ok(
        pageSource.includes('Google') || pageSource.includes('GitHub'),
        'Social login options should be present',
      );

      console.log('  ✓ Sign In button and social login options found');
    } catch (err) {
      await captureScreenshot(driver, 'login-buttons');
      throw err;
    }
  });

  it('should reject invalid credentials and stay on /login', async function () {
    try {
      await driver.get(`${config.baseUrl}/login`);

      const emailInput = await waitForElement(driver, By.css('input[type="email"]'));
      await emailInput.sendKeys('nobody@invalid.test');

      const passwordInput = await waitForElement(driver, By.css('input[type="password"]'));
      await passwordInput.sendKeys('wrongpassword99!');

      let submitBtn;
      try {
        submitBtn = await driver.findElement(By.css('button[type="submit"]'));
      } catch {
        submitBtn = await driver.findElement(
          By.xpath('//button[contains(normalize-space(), "Sign In")]'),
        );
      }
      await submitBtn.click();

      // Wait briefly then assert we did NOT navigate to /dashboard
      await new Promise(r => setTimeout(r, 2500));
      const url = await driver.getCurrentUrl();
      assert.ok(url.includes('/login'), `Should remain on /login after bad credentials, got: ${url}`);

      console.log('  ✓ Invalid credentials rejected – URL still /login');
    } catch (err) {
      await captureScreenshot(driver, 'login-invalid-credentials');
      throw err;
    }
  });

  it('should login with valid credentials and redirect to /dashboard', async function () {
    try {
      await login(driver);

      const url = await driver.getCurrentUrl();
      assert.ok(url.includes('/dashboard'), `Expected /dashboard, got: ${url}`);

      // Confirm dashboard landmark – search input is the first interactive element
      const searchInput = await waitForElement(
        driver,
        By.css('input[placeholder*="Search subjects"]'),
        config.timeouts.explicit,
      );
      assert.ok(await searchInput.isDisplayed(), 'Dashboard search input should be visible after login');

      console.log('  ✓ Valid credentials accepted – redirected to /dashboard');
    } catch (err) {
      await captureScreenshot(driver, 'login-valid-credentials');
      throw err;
    }
  });

  it('should persist session on page refresh', async function () {
    try {
      // Continue from previous test – driver should already be on /dashboard
      await driver.navigate().refresh();
      await waitForUrl(driver, '/dashboard', config.timeouts.explicit);

      console.log('  ✓ Session persisted after page refresh');
    } catch (err) {
      await captureScreenshot(driver, 'login-session-persist');
      throw err;
    }
  });
});
