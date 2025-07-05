/**
 * Global teardown for Playwright tests
 * Cleans up after testing
 */

async function globalTeardown() {
  console.log('🧹 Cleaning up after tests...');
  
  // Kill any remaining Electron processes
  const { spawn } = require('child_process');
  
  if (process.platform === 'darwin') {
    // macOS: Kill any remaining ScreenshotOS processes
    spawn('pkill', ['-f', 'ScreenshotOS'], { stdio: 'ignore' });
    spawn('pkill', ['-f', 'electron.*ScreenshotOS'], { stdio: 'ignore' });
  }
  
  console.log('✅ Cleanup completed');
}

module.exports = globalTeardown;