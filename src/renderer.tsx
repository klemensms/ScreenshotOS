// filepath: /Users/klemensstelk/Repo/ScreenshotOS/src/renderer.tsx
import * as React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/globals.css';
import { rendererLogger } from './utils/renderer-logger';

// Define types for the window.electron interface
declare global {
  interface Window {
    electron: {
      invoke: (channel: string, ...args: any[]) => Promise<any>;
    }
  }
}

// Set up global error handlers
rendererLogger.setupGlobalErrorHandlers();
rendererLogger.info('Renderer process starting');

// Get the root element
const container = document.getElementById('root');
if (!container) {
  const error = new Error('Root element not found');
  rendererLogger.error('Failed to find root element', error);
  throw error;
}

// Create React root and render the app
const root = createRoot(container);
try {
  console.log('🔍 About to render <App />...');
  rendererLogger.info('About to render App component');
  
  root.render(<App />);
  
  console.log('🔍 root.render() completed...');
  rendererLogger.info('App rendered successfully');
  
  // Add a timer to check if React actually executed
  setTimeout(() => {
    console.log('🔍 Timer check: Is React execution blocked?');
    rendererLogger.info('Timer check: React execution status');
  }, 1000);
  
} catch (error) {
  console.error('🔍 Error during render:', error);
  rendererLogger.error('Failed to render app', error as Error);
  throw error;
}