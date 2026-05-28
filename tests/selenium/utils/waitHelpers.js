'use strict';

const { until } = require('selenium-webdriver');
const config = require('./config');

async function waitForElement(driver, locator, timeout) {
  timeout = timeout || config.timeouts.explicit;
  try {
    await driver.wait(until.elementLocated(locator), timeout);
    return await driver.findElement(locator);
  } catch (err) {
    throw new Error(`Element not found [${locator}] within ${timeout}ms — ${err.message}`);
  }
}

async function waitForElementVisible(driver, locator, timeout) {
  timeout = timeout || config.timeouts.explicit;
  const el = await waitForElement(driver, locator, timeout);
  await driver.wait(until.elementIsVisible(el), timeout);
  return el;
}

async function waitForElementClickable(driver, locator, timeout) {
  timeout = timeout || config.timeouts.explicit;
  const el = await waitForElement(driver, locator, timeout);
  await driver.wait(until.elementIsEnabled(el), timeout);
  return el;
}

async function waitForUrl(driver, path, timeout) {
  timeout = timeout || config.timeouts.explicit;
  await driver.wait(
    until.urlContains(path),
    timeout,
    `URL did not contain '${path}' within ${timeout}ms`,
  );
}

async function waitForText(driver, locator, text, timeout) {
  timeout = timeout || config.timeouts.explicit;
  const el = await waitForElement(driver, locator, timeout);
  await driver.wait(until.elementTextContains(el, text), timeout);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {
  waitForElement,
  waitForElementVisible,
  waitForElementClickable,
  waitForUrl,
  waitForText,
  sleep,
};
