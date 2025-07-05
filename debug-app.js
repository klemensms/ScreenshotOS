#!/usr/bin/env node

/**
 * Debug script to see what's in the app DOM
 */

const { ElectronAppHelper } = require('./tests/e2e/electron-helper.js');

async function debugApp() {
  const appHelper = new ElectronAppHelper();
  
  try {
    console.log('🚀 Launching app...');
    await appHelper.launch();

    console.log('📸 Taking initial screenshot...');
    await appHelper.takeScreenshot('debug-initial');

    const window = await appHelper.getMainWindow();
    
    console.log('🔍 Getting page content...');
    const pageContent = await window.evaluate(() => {
      return {
        title: document.title,
        bodyExists: !!document.body,
        hasRecentPanel: !!document.querySelector('.recent-panel'),
        hasTestId: !!document.querySelector('[data-testid="recent-panel"]'),
        bodyClasses: document.body?.className || 'no body',
        htmlContent: document.documentElement.outerHTML.substring(0, 1000)
      };
    });

    console.log('📊 Page analysis:');
    console.log('  Title:', pageContent.title);
    console.log('  Body exists:', pageContent.bodyExists);
    console.log('  Has .recent-panel:', pageContent.hasRecentPanel);
    console.log('  Has test ID:', pageContent.hasTestId);
    console.log('  Body classes:', pageContent.bodyClasses);
    console.log('  HTML preview:', pageContent.htmlContent);

    console.log('🔍 Waiting a bit for content to load...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    console.log('📸 Taking after-wait screenshot...');
    await appHelper.takeScreenshot('debug-after-wait');

    const pageContentAfter = await window.evaluate(() => {
      return {
        hasRecentPanel: !!document.querySelector('.recent-panel'),
        hasTestId: !!document.querySelector('[data-testid="recent-panel"]'),
        allTestIds: Array.from(document.querySelectorAll('[data-testid]')).map(el => el.getAttribute('data-testid')),
        allElements: Array.from(document.querySelectorAll('*')).slice(0, 20).map(el => el.tagName + (el.className ? '.' + el.className : ''))
      };
    });

    console.log('📊 Page analysis after wait:');
    console.log('  Has .recent-panel:', pageContentAfter.hasRecentPanel);
    console.log('  Has test ID:', pageContentAfter.hasTestId);
    console.log('  All test IDs:', pageContentAfter.allTestIds);
    console.log('  First 20 elements:', pageContentAfter.allElements);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await appHelper.close();
  }
}

debugApp().catch(console.error);