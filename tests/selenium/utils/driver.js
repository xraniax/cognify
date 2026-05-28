'use strict';

const { Builder } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const chromedriver = require('chromedriver');
const config = require('./config');

async function buildDriver() {
  const options = new chrome.Options();

  if (config.headless) {
    options.addArguments('--headless=new');
  }

  options.addArguments(
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--window-size=1920,1080',
    '--disable-extensions',
    '--disable-infobars',
    '--disable-popup-blocking',
    '--lang=en-US',
  );

  const service = new chrome.ServiceBuilder(
    process.env.CHROMEDRIVER_PATH || chromedriver.path,
  );

  const driver = await new Builder()
    .forBrowser('chrome')
    .setChromeOptions(options)
    .setChromeService(service)
    .build();

  await driver.manage().setTimeouts({
    implicit: config.timeouts.implicit,
    pageLoad: config.timeouts.pageLoad,
  });

  return driver;
}

module.exports = buildDriver;
