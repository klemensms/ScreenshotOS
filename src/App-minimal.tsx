import React from 'react';
import { AppProvider } from './context/AppContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { debugLogger } from './utils/debug-logger';

export default function App() {
  console.log('🔍 App component rendering...');
  debugLogger.log('App', 'component render', 'Starting minimal app render');

  return (
    <ErrorBoundary name="App Root">
      <AppProvider>
        <ErrorBoundary name="Main App Container">
          <div className="h-screen flex flex-col bg-gray-100">
            {/* Window Title Bar */}
            <div className="bg-gray-200 border-b border-gray-400 px-4 py-1 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                  <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                </div>
                <span className="text-sm text-gray-700 ml-2">Bug Shooting (Minimal Mode)</span>
              </div>
            </div>

            {/* Main Content Area - Just a placeholder */}
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center p-8">
                <h1 className="text-2xl font-bold text-gray-700 mb-4">ScreenshotOS - Minimal Mode</h1>
                <p className="text-gray-600 mb-4">Testing basic app structure...</p>
                <div className="text-sm text-gray-500">
                  <p>✅ App component rendered</p>
                  <p>✅ AppProvider loaded</p>
                  <p>✅ Basic UI displaying</p>
                  <p>🔍 Monitoring for hang...</p>
                </div>
              </div>
            </div>
          </div>
        </ErrorBoundary>
      </AppProvider>
    </ErrorBoundary>
  );
}