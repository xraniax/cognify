'use strict';

const assert = require('assert');
const { By } = require('selenium-webdriver');
const buildDriver = require('../utils/driver');
const config = require('../utils/config');
const { logout } = require('../utils/loginHelper');
const { captureScreenshot } = require('../utils/screenshotHelper');

describe('Authentication – Protected Routes', function () {
  this.timeout(60000);
  let driver;

  before(async function () {
    this.timeout(120000); // allow Selenium Manager to download ChromeDriver on first run
    driver = await buildDriver();
  });

  after(async function () {
    if (driver) await driver.quit();
  });

  /**
   * Clears session and asserts that accessing `route` does NOT stay on that route.
   */
  async function assertRedirectsWhenUnauthenticated(route, label) {
    await logout(driver);
    await driver.get(`${config.baseUrl}${route}`);

    await driver.wait(
      async () => {
        const url = await driver.getCurrentUrl();
        return !url.includes(route) || url.includes('/login') || url.includes('/welcome');
      },
      config.timeouts.explicit,
      `Unauthenticated access to ${route} should trigger a redirect`,
    );

    const finalUrl = await driver.getCurrentUrl();
    assert.ok(
      !finalUrl.includes(route) || finalUrl.includes('/login') || finalUrl.includes('/welcome'),
      `${label}: unauthenticated user should not stay on ${route}, got ${finalUrl}`,
    );
    console.log(`  ✓ ${label}: redirected to ${finalUrl}`);
  }

  it('should redirect unauthenticated users away from /dashboard', async function () {
    try {
      await assertRedirectsWhenUnauthenticated('/dashboard', '/dashboard protection');
    } catch (err) {
      await captureScreenshot(driver, 'protected-dashboard');
      throw err;
    }
  });

  it('should redirect unauthenticated users away from /goals', async function () {
    try {
      await assertRedirectsWhenUnauthenticated('/goals', '/goals protection');
    } catch (err) {
      await captureScreenshot(driver, 'protected-goals');
      throw err;
    }
  });

  it('should redirect unauthenticated users away from /analytics', async function () {
    try {
      await assertRedirectsWhenUnauthenticated('/analytics', '/analytics protection');
    } catch (err) {
      await captureScreenshot(driver, 'protected-analytics');
      throw err;
    }
  });

  it('should redirect unauthenticated users away from /upload', async function () {
    try {
      await assertRedirectsWhenUnauthenticated('/upload', '/upload protection');
    } catch (err) {
      await captureScreenshot(driver, 'protected-upload');
      throw err;
    }
  });

  it('should allow unauthenticated access to /login and /register', async function () {
    try {
      await logout(driver);

      await driver.get(`${config.baseUrl}/login`);
      let url = await driver.getCurrentUrl();
      assert.ok(url.includes('/login'), '/login should be publicly accessible');

      await driver.get(`${config.baseUrl}/register`);
      url = await driver.getCurrentUrl();
      assert.ok(url.includes('/register'), '/register should be publicly accessible');

      console.log('  ✓ /login and /register are publicly accessible');
    } catch (err) {
      await captureScreenshot(driver, 'protected-public-routes');
      throw err;
    }
  });
});
