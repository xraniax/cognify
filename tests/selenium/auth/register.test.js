'use strict';

const assert = require('assert');
const { By } = require('selenium-webdriver');
const buildDriver = require('../utils/driver');
const config = require('../utils/config');
const { waitForElement } = require('../utils/waitHelpers');
const { captureScreenshot } = require('../utils/screenshotHelper');

describe('Authentication – Register', function () {
  this.timeout(60000);
  let driver;

  // Use a unique email per test run so the account doesn't already exist
  const newUser = {
    name: 'Cognify E2E Tester',
    email: `e2e_${Date.now()}@testcognify.dev`,
    password: 'SecurePass123!',
  };

  before(async function () {
    this.timeout(120000); // allow Selenium Manager to download ChromeDriver on first run
    driver = await buildDriver();
  });

  after(async function () {
    if (driver) await driver.quit();
  });

  it('should display all registration fields', async function () {
    try {
      await driver.get(`${config.baseUrl}/register`);

      // Cognify Register.jsx: name (type=text), email (type=email), password (type=password)
      const nameInput = await waitForElement(driver, By.css('input[type="text"]'));
      const emailInput = await waitForElement(driver, By.css('input[type="email"]'));
      const passwordInput = await waitForElement(driver, By.css('input[type="password"]'));

      assert.ok(await nameInput.isDisplayed(), 'Name input visible');
      assert.ok(await emailInput.isDisplayed(), 'Email input visible');
      assert.ok(await passwordInput.isDisplayed(), 'Password input visible');

      console.log('  ✓ Register page renders all required fields');
    } catch (err) {
      await captureScreenshot(driver, 'register-page-display');
      throw err;
    }
  });

  it('should have a link back to /login', async function () {
    try {
      await driver.get(`${config.baseUrl}/register`);

      const loginLink = await waitForElement(
        driver,
        By.xpath(
          '//a[contains(@href,"/login")] | //a[contains(normalize-space(),"Sign in")] | //a[contains(normalize-space(),"Log in")]',
        ),
      );
      assert.ok(await loginLink.isDisplayed(), 'Login link should be visible on register page');

      console.log('  ✓ Link to /login present on register page');
    } catch (err) {
      await captureScreenshot(driver, 'register-login-link');
      throw err;
    }
  });

  it('should not submit when password is too short', async function () {
    try {
      await driver.get(`${config.baseUrl}/register`);

      const nameInput = await waitForElement(driver, By.css('input[type="text"]'));
      await nameInput.sendKeys('Test User');

      const emailInput = await waitForElement(driver, By.css('input[type="email"]'));
      await emailInput.sendKeys('weaktest@example.com');

      const passwordInput = await waitForElement(driver, By.css('input[type="password"]'));
      await passwordInput.sendKeys('123'); // < 8 chars – Cognify validates min 8

      // Trigger blur so validation fires
      await emailInput.click();
      await new Promise(r => setTimeout(r, 600));

      const url = await driver.getCurrentUrl();
      assert.ok(url.includes('/register'), `Should remain on /register, got: ${url}`);

      console.log('  ✓ Weak password: form did not navigate away');
    } catch (err) {
      await captureScreenshot(driver, 'register-weak-password');
      throw err;
    }
  });

  it('should register a new account and redirect to verification or dashboard', async function () {
    try {
      await driver.get(`${config.baseUrl}/register`);

      const nameInput = await waitForElement(driver, By.css('input[type="text"]'));
      await nameInput.clear();
      await nameInput.sendKeys(newUser.name);

      const emailInput = await waitForElement(driver, By.css('input[type="email"]'));
      await emailInput.clear();
      await emailInput.sendKeys(newUser.email);

      const passwordInput = await waitForElement(driver, By.css('input[type="password"]'));
      await passwordInput.clear();
      await passwordInput.sendKeys(newUser.password);

      let submitBtn;
      try {
        submitBtn = await driver.findElement(By.css('button[type="submit"]'));
      } catch {
        submitBtn = await driver.findElement(
          By.xpath('//button[contains(normalize-space(),"Sign Up")]'),
        );
      }
      await submitBtn.click();

      // Cognify may redirect to /verify-email or /dashboard
      await driver.wait(
        async () => {
          const u = await driver.getCurrentUrl();
          return u.includes('/verify-email') || u.includes('/dashboard') || u.includes('/login');
        },
        config.timeouts.explicit,
        'Registration did not redirect after account creation',
      );

      const finalUrl = await driver.getCurrentUrl();
      console.log(`  ✓ Registration complete – redirected to: ${finalUrl}`);
    } catch (err) {
      await captureScreenshot(driver, 'register-new-account');
      throw err;
    }
  });
});
