'use strict';

module.exports = {
  baseUrl: process.env.BASE_URL || 'http://localhost:3000',

  credentials: {
    email: process.env.TEST_EMAIL || 'test@cognify.app',
    password: process.env.TEST_PASSWORD || 'TestPass123!',
    name: 'Test User',
  },

  timeouts: {
    implicit: 0,
    explicit: 15000,
    pageLoad: 30000,
    aiGeneration: 90000,
  },

  screenshotsDir: './reports/screenshots',

  headless: process.env.HEADLESS !== 'false',
};
