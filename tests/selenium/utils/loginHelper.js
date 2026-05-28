'use strict';

const { By } = require('selenium-webdriver');
const config = require('./config');
const { waitForElement, waitForUrl } = require('./waitHelpers');

/**
 * Logs in via the /login page and waits for the /dashboard redirect.
 * @param {import('selenium-webdriver').WebDriver} driver
 * @param {string} [email]
 * @param {string} [password]
 */
async function login(driver, email, password) {
  email = email || config.credentials.email;
  password = password || config.credentials.password;

  console.log(`  → Navigating to /login`);
  await driver.get(`${config.baseUrl}/login`);

  const emailInput = await waitForElement(driver, By.css('input[type="email"]'));
  await emailInput.clear();
  await emailInput.sendKeys(email);

  const passwordInput = await waitForElement(driver, By.css('input[type="password"]'));
  await passwordInput.clear();
  await passwordInput.sendKeys(password);

  // Try type="submit" first; fall back to button text "Sign In"
  let submitBtn;
  try {
    submitBtn = await driver.findElement(By.css('button[type="submit"]'));
  } catch {
    submitBtn = await driver.findElement(
      By.xpath('//button[normalize-space()="Sign In"]'),
    );
  }
  await submitBtn.click();

  await waitForUrl(driver, '/dashboard', config.timeouts.explicit);
  console.log(`  ✓ Logged in as ${email}`);
}

/**
 * Clears all auth state so the browser is unauthenticated.
 * @param {import('selenium-webdriver').WebDriver} driver
 */
async function logout(driver) {
  await driver.get(`${config.baseUrl}/login`);
  await driver.manage().deleteAllCookies();
  await driver.executeScript('try { localStorage.clear(); sessionStorage.clear(); } catch(e) {}');
  console.log('  ✓ Auth state cleared');
}

module.exports = { login, logout };
