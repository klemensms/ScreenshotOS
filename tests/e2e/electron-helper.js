/**
 * Electron app launcher and helper utilities for testing
 * This script helps the Playwright MCP server interact with the ScreenshotOS Electron app
 */
const { _electron: electron } = require('playwright');
const path = require('path');

class ElectronAppHelper {
  constructor() {
    this.app = null;
    this.mainWindow = null;
  }

  /**
   * Launch the ScreenshotOS Electron app
   */
  async launch(options = {}) {
    const appPath = path.resolve(__dirname, '../../dist/main.js');
    
    console.log('🚀 Launching ScreenshotOS Electron app...');
    console.log('📍 App path:', appPath);
    
    this.app = await electron.launch({
      args: [appPath],
      executablePath: undefined, // Use the Electron from node_modules
      env: {
        ...process.env,
        NODE_ENV: 'test',
        ELECTRON_IS_DEV: '0',
        // Disable screenshot directory scanning for faster startup in tests
        SCREENSHOT_TEST_MODE: '1'
      },
      ...options
    });

    // Wait for the main window to be created
    this.mainWindow = await this.app.firstWindow();
    
    // Wait for the app to fully load
    await this.mainWindow.waitForLoadState('domcontentloaded');
    
    // Wait for React to initialize by waiting for the recent panel or error boundary
    await this.mainWindow.waitForFunction(() => {
      // Wait for either the recent panel to appear or any React content
      return document.querySelector('.recent-panel') || 
             document.querySelector('[data-testid="recent-panel"]') ||
             document.querySelectorAll('.flex').length > 5; // Multiple flex elements indicate React is loaded
    }, { timeout: 15000 });
    
    console.log('✅ ScreenshotOS app launched successfully');
    return this.app;
  }

  /**
   * Get the main window of the app
   */
  async getMainWindow() {
    if (!this.mainWindow) {
      throw new Error('App not launched. Call launch() first.');
    }
    return this.mainWindow;
  }

  /**
   * Take a screenshot of the app
   */
  async takeScreenshot(filename) {
    const window = await this.getMainWindow();
    const screenshotPath = path.resolve(__dirname, '../../test-results', `${filename}.png`);
    
    await window.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`📸 Screenshot saved: ${screenshotPath}`);
    return screenshotPath;
  }

  /**
   * Wait for an element to be visible
   */
  async waitForElement(selector, timeout = 5000) {
    const window = await this.getMainWindow();
    return await window.waitForSelector(selector, { timeout });
  }

  /**
   * Click an element
   */
  async click(selector) {
    const window = await this.getMainWindow();
    await window.click(selector);
  }

  /**
   * Get text content of an element
   */
  async getText(selector) {
    const window = await this.getMainWindow();
    return await window.textContent(selector);
  }

  /**
   * Check if an element is visible
   */
  async isVisible(selector) {
    const window = await this.getMainWindow();
    return await window.isVisible(selector);
  }

  /**
   * Wait for the app to finish loading screenshots
   */
  async waitForScreenshotsLoaded() {
    const window = await this.getMainWindow();
    
    // Wait for the recent panel to be visible
    await window.waitForSelector('.recent-panel', { timeout: 10000 });
    
    // Wait for either screenshots to load or "no screenshots" message
    await window.waitForFunction(() => {
      const recentPanel = document.querySelector('.recent-panel');
      if (!recentPanel) return false;
      
      // Check if there are screenshot items or a "no screenshots" message
      const hasScreenshots = recentPanel.querySelectorAll('[data-testid="screenshot-item"]').length > 0;
      const hasNoScreenshotsMessage = recentPanel.textContent.includes('No screenshots');
      
      return hasScreenshots || hasNoScreenshotsMessage;
    }, { timeout: 15000 });
    
    console.log('✅ Screenshots loaded (or confirmed empty)');
  }

  /**
   * Get information about loaded screenshots
   */
  async getScreenshotInfo() {
    const window = await this.getMainWindow();
    
    return await window.evaluate(() => {
      const items = document.querySelectorAll('[data-testid="screenshot-item"]');
      return Array.from(items).map(item => ({
        title: item.querySelector('.text-sm')?.textContent?.trim(),
        date: item.querySelector('.text-xs')?.textContent?.trim(),
        isSelected: item.classList.contains('bg-blue-100')
      }));
    });
  }

  /**
   * Close the app
   */
  async close() {
    if (this.app) {
      await this.app.close();
      this.app = null;
      this.mainWindow = null;
      console.log('✅ ScreenshotOS app closed');
    }
  }
}

// Export for use in tests or MCP server
module.exports = { ElectronAppHelper };

// If run directly, launch the app for manual testing
if (require.main === module) {
  (async () => {
    const helper = new ElectronAppHelper();
    try {
      await helper.launch();
      console.log('App launched for manual testing. Press Ctrl+C to exit.');
      
      // Keep the process alive
      process.on('SIGINT', async () => {
        await helper.close();
        process.exit(0);
      });
      
    } catch (error) {
      console.error('Failed to launch app:', error);
      process.exit(1);
    }
  })();
}