/**
 * Playwright configuration for testing ScreenshotOS Electron app
 * This config is designed to work with the Playwright MCP server
 */
const { defineConfig } = require('@playwright/test');
const path = require('path');

module.exports = defineConfig({
  testDir: './tests/e2e',
  timeout: 30000,
  expect: {
    timeout: 5000,
  },
  use: {
    // Launch Electron app instead of browser
    // The MCP server will handle this automatically when targeting Electron
    actionTimeout: 0,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'electron',
      use: {
        // Electron-specific configuration
        // The app will be launched via the helper script
        channel: 'chrome', // Fallback for MCP server
      },
    },
  ],
  // Output directories
  outputDir: 'test-results/',
  // Global setup and teardown
  globalSetup: require.resolve('./tests/e2e/global-setup.js'),
  globalTeardown: require.resolve('./tests/e2e/global-teardown.js'),
});