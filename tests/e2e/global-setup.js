/**
 * Global setup for Playwright tests
 * Prepares the Electron app for testing
 */
const { spawn } = require('child_process');
const path = require('path');

async function globalSetup() {
  console.log('🚀 Setting up ScreenshotOS for testing...');
  
  // Build the app if needed
  const buildProcess = spawn('npm', ['run', 'build'], {
    cwd: path.resolve(__dirname, '../..'),
    stdio: 'inherit'
  });
  
  return new Promise((resolve, reject) => {
    buildProcess.on('close', (code) => {
      if (code === 0) {
        console.log('✅ App built successfully for testing');
        resolve();
      } else {
        reject(new Error(`Build failed with exit code ${code}`));
      }
    });
  });
}

module.exports = globalSetup;