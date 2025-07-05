/**
 * Basic app functionality test
 * This test verifies the app launches and basic UI elements are present
 */
const { test, expect } = require('@playwright/test');
const { ElectronAppHelper } = require('./electron-helper');

test.describe('ScreenshotOS Basic Functionality', () => {
  let appHelper;

  test.beforeEach(async () => {
    appHelper = new ElectronAppHelper();
    await appHelper.launch();
  });

  test.afterEach(async () => {
    if (appHelper) {
      await appHelper.close();
    }
  });

  test('app should launch and show main UI elements', async () => {
    // Wait for app to load
    await appHelper.waitForElement('.recent-panel');
    
    // Take a screenshot for verification
    await appHelper.takeScreenshot('app-startup');
    
    // Verify main UI elements are present
    expect(await appHelper.isVisible('.recent-panel')).toBe(true);
    expect(await appHelper.isVisible('.toolbar')).toBe(true);
    
    console.log('✅ App launched successfully with main UI elements visible');
  });

  test('recent panel should load screenshots or show empty state', async () => {
    // Wait for screenshots to load
    await appHelper.waitForScreenshotsLoaded();
    
    // Take screenshot of the loaded state
    await appHelper.takeScreenshot('recent-panel-loaded');
    
    // Get information about screenshots
    const screenshots = await appHelper.getScreenshotInfo();
    console.log(`📊 Found ${screenshots.length} screenshots in recent panel`);
    
    if (screenshots.length > 0) {
      console.log('📋 First few screenshots:');
      screenshots.slice(0, 3).forEach((screenshot, index) => {
        console.log(`  ${index + 1}. ${screenshot.title} (${screenshot.date}) ${screenshot.isSelected ? '[SELECTED]' : ''}`);
      });
      
      // Verify the first screenshot is selected (testing issue #6 fix)
      expect(screenshots[0].isSelected).toBe(true);
      console.log('✅ Most recent screenshot is selected (issue #6 fix verified)');
    } else {
      console.log('ℹ️ No screenshots found - app shows empty state');
    }
  });
});