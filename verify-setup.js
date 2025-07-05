#!/usr/bin/env node

/**
 * Automated verification of the Playwright/Electron testing setup
 * This script tests the core functionality without user interaction
 */

const { ElectronAppHelper } = require('./tests/e2e/electron-helper.js');

async function verifySetup() {
  console.log('🧪 Verifying ScreenshotOS Testing Setup');
  console.log('=====================================');

  const appHelper = new ElectronAppHelper();
  
  try {
    console.log('1. 🚀 Launching ScreenshotOS app...');
    await appHelper.launch();
    console.log('   ✅ App launched successfully');

    console.log('2. ⏳ Waiting for app UI to load...');
    // Try to wait for the class selector instead of test ID first
    await appHelper.waitForElement('.recent-panel', 15000);
    console.log('   ✅ Recent panel is visible');

    console.log('3. 📸 Taking screenshot...');
    const screenshotPath = await appHelper.takeScreenshot('setup-verification');
    console.log(`   ✅ Screenshot saved: ${screenshotPath}`);

    console.log('4. 🔍 Checking UI elements...');
    const recentPanelVisible = await appHelper.isVisible('.recent-panel');
    const toolbarVisible = await appHelper.isVisible('[data-testid="toolbar"]');
    
    console.log(`   📋 Recent panel visible: ${recentPanelVisible}`);
    console.log(`   🔧 Toolbar visible: ${toolbarVisible}`);

    console.log('5. ⏳ Waiting for screenshots to load...');
    await appHelper.waitForScreenshotsLoaded();
    console.log('   ✅ Screenshots loaded');

    console.log('6. 📊 Getting screenshot information...');
    const screenshots = await appHelper.getScreenshotInfo();
    console.log(`   📈 Found ${screenshots.length} screenshots`);
    
    if (screenshots.length > 0) {
      console.log('   📋 First few screenshots:');
      screenshots.slice(0, 3).forEach((screenshot, index) => {
        console.log(`      ${index + 1}. ${screenshot.title} (${screenshot.date}) ${screenshot.isSelected ? '[SELECTED]' : ''}`);
      });
      
      // Verify issue #6 fix - most recent should be selected
      if (screenshots[0].isSelected) {
        console.log('   ✅ Issue #6 fix verified: Most recent screenshot is selected');
      } else {
        console.log('   ⚠️ Issue #6 may not be fully fixed: Most recent screenshot is not selected');
      }
    } else {
      console.log('   ℹ️ No screenshots found - empty state');
    }

    console.log('7. 📸 Taking final screenshot...');
    await appHelper.takeScreenshot('setup-verification-final');
    console.log('   ✅ Final screenshot taken');

  } catch (error) {
    console.error(`❌ Setup verification failed: ${error.message}`);
    console.error(error.stack);
    return false;
  } finally {
    console.log('8. 🧹 Closing app...');
    await appHelper.close();
    console.log('   ✅ App closed');
  }

  console.log('\n🎉 Setup verification completed successfully!');
  console.log('✅ The Playwright + Electron testing integration is working correctly.');
  console.log('🔧 You can now use the test runner or create custom test scripts.');
  
  return true;
}

// Run verification
verifySetup()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('💥 Unexpected error:', error);
    process.exit(1);
  });