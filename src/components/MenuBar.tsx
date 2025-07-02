import React, { useState, useEffect } from 'react';
import { Copy, Square, Monitor, Bug, Settings } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { DebugPanel } from './DebugPanel';
import SettingsPanel from './SettingsPanel';

export function MenuBar() {
  const [showDebugPanel, setShowDebugPanel] = useState(false);
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);
  const { captureFullScreen, captureArea, copyCurrentScreenshot, isCapturing, currentScreenshot } = useApp();

  // Keyboard shortcut for debug panel
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ctrl+Shift+L (or Cmd+Shift+L on Mac) to toggle debug panel
      if (event.ctrlKey && event.shiftKey && event.key === 'L') {
        event.preventDefault();
        setShowDebugPanel(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);


  return (
    <div className="bg-gray-100 border-b border-gray-300 px-2 py-1">
      <div className="flex items-center justify-between">
        {/* Left side - App title */}
        <div className="flex items-center">
          <span className="text-sm font-medium text-gray-700">ScreenshotOS</span>
        </div>
        
        {/* Center - Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={captureFullScreen}
            disabled={isCapturing}
            className="flex items-center gap-1 px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Monitor className="w-4 h-4" />
            Full Screen
          </button>
          <button
            onClick={captureArea}
            disabled={isCapturing}
            className="flex items-center gap-1 px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Square className="w-4 h-4" />
            Area
          </button>
          <button
            onClick={copyCurrentScreenshot}
            disabled={!currentScreenshot}
            className="flex items-center gap-1 px-3 py-1 text-sm bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Copy className="w-4 h-4" />
            Copy
          </button>
        </div>

        {/* Right side - Settings and Debug */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSettingsPanel(true)}
            className="flex items-center gap-1 px-3 py-1 text-sm bg-gray-600 text-white rounded hover:bg-gray-700"
          >
            <Settings className="w-4 h-4" />
            Settings
          </button>
          <button
            onClick={() => setShowDebugPanel(true)}
            className="p-1 hover:bg-gray-200 rounded transition-colors"
            title="Debug Panel (Ctrl+Shift+L)"
          >
            <Bug className="w-4 h-4 text-gray-600" />
          </button>
        </div>
      </div>
      
      {/* Debug Panel */}
      <DebugPanel 
        isOpen={showDebugPanel} 
        onClose={() => setShowDebugPanel(false)} 
      />
      
      {/* Settings Panel */}
      <SettingsPanel 
        isVisible={showSettingsPanel} 
        onClose={() => setShowSettingsPanel(false)} 
      />
    </div>
  );
}