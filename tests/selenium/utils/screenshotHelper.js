'use strict';

const fs = require('fs');
const path = require('path');
const config = require('./config');

/**
 * Captures a PNG screenshot and saves it under reports/screenshots/.
 * Returns the absolute file path, or null on failure.
 *
 * @param {import('selenium-webdriver').WebDriver} driver
 * @param {string} name  – slug used in the filename
 */
async function captureScreenshot(driver, name) {
  try {
    const dir = path.resolve(__dirname, '..', config.screenshotsDir);
    fs.mkdirSync(dir, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${name}_${timestamp}.png`;
    const filepath = path.join(dir, filename);

    const data = await driver.takeScreenshot();
    fs.writeFileSync(filepath, data, 'base64');
    console.log(`  📸 Screenshot saved: ${filepath}`);
    return filepath;
  } catch (err) {
    console.warn(`  ⚠ Screenshot capture failed: ${err.message}`);
    return null;
  }
}

module.exports = { captureScreenshot };
