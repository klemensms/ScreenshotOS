#!/usr/bin/env node

/**
 * Simple test runner for ScreenshotOS
 * This allows immediate testing and interaction with the app
 */

const { ElectronAppHelper } = require('./tests/e2e/electron-helper.js');
const readline = require('readline');

class TestRunner {
  constructor() {
    this.appHelper = null;
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
  }

  async start() {
    console.log('🧪 ScreenshotOS Test Runner');
    console.log('==========================');
    console.log('Available commands:');
    console.log('  launch     - Launch the app');
    console.log('  screenshot - Take a screenshot');
    console.log('  wait       - Wait for screenshots to load');
    console.log('  info       - Get screenshot info');
    console.log('  visible    - Check if element is visible');
    console.log('  click      - Click an element');
    console.log('  close      - Close the app');
    console.log('  exit       - Exit test runner');
    console.log('');

    this.promptCommand();
  }

  promptCommand() {
    this.rl.question('> ', async (command) => {
      await this.executeCommand(command.trim());
      this.promptCommand();
    });
  }

  async executeCommand(command) {
    const parts = command.split(' ');
    const cmd = parts[0];
    const args = parts.slice(1);

    try {
      switch (cmd) {
        case 'launch':
          if (this.appHelper) {
            console.log('⚠️ App already running, closing first...');
            await this.appHelper.close();
          }
          this.appHelper = new ElectronAppHelper();
          await this.appHelper.launch();
          console.log('✅ App launched successfully');
          break;

        case 'screenshot':
          if (!this.appHelper) {
            console.log('❌ App not running. Use "launch" first.');
            return;
          }
          const filename = args[0] || `test-${Date.now()}`;
          const path = await this.appHelper.takeScreenshot(filename);
          console.log(`📸 Screenshot saved: ${path}`);
          break;

        case 'wait':
          if (!this.appHelper) {
            console.log('❌ App not running. Use "launch" first.');
            return;
          }
          console.log('⏳ Waiting for screenshots to load...');
          await this.appHelper.waitForScreenshotsLoaded();
          console.log('✅ Screenshots loaded');
          break;

        case 'info':
          if (!this.appHelper) {
            console.log('❌ App not running. Use "launch" first.');
            return;
          }
          const screenshots = await this.appHelper.getScreenshotInfo();
          console.log(`📊 Found ${screenshots.length} screenshots:`);
          screenshots.slice(0, 10).forEach((s, i) => {
            console.log(`  ${i + 1}. ${s.title} (${s.date}) ${s.isSelected ? '[SELECTED]' : ''}`);
          });
          if (screenshots.length > 10) {
            console.log(`  ... and ${screenshots.length - 10} more`);
          }
          break;

        case 'visible':
          if (!this.appHelper) {
            console.log('❌ App not running. Use "launch" first.');
            return;
          }
          const selector = args[0];
          if (!selector) {
            console.log('❌ Usage: visible <selector>');
            return;
          }
          const visible = await this.appHelper.isVisible(selector);
          console.log(`🔍 Element "${selector}" is ${visible ? 'visible' : 'not visible'}`);
          break;

        case 'click':
          if (!this.appHelper) {
            console.log('❌ App not running. Use "launch" first.');
            return;
          }
          const clickSelector = args[0];
          if (!clickSelector) {
            console.log('❌ Usage: click <selector>');
            return;
          }
          await this.appHelper.click(clickSelector);
          console.log(`✅ Clicked element: ${clickSelector}`);
          break;

        case 'close':
          if (this.appHelper) {
            await this.appHelper.close();
            this.appHelper = null;
            console.log('✅ App closed');
          } else {
            console.log('ℹ️ App not running');
          }
          break;

        case 'exit':
          if (this.appHelper) {
            console.log('🧹 Closing app...');
            await this.appHelper.close();
          }
          console.log('👋 Goodbye!');
          this.rl.close();
          process.exit(0);
          break;

        case '':
          // Empty command, do nothing
          break;

        default:
          console.log(`❌ Unknown command: ${cmd}`);
          console.log('Available commands: launch, screenshot, wait, info, visible, click, close, exit');
          break;
      }
    } catch (error) {
      console.error(`❌ Error: ${error.message}`);
    }
  }
}

// Handle Ctrl+C gracefully
process.on('SIGINT', async () => {
  console.log('\n🧹 Cleaning up...');
  process.exit(0);
});

// Start the test runner
const runner = new TestRunner();
runner.start().catch(console.error);