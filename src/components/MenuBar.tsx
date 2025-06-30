import React, { useState, useEffect } from 'react';
import { Camera, Square, Monitor, Bug } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { DebugPanel } from './DebugPanel';

export function MenuBar() {
  const [activeMenu, setActiveMenu] = useState('CAPTURE');
  const [showDebugPanel, setShowDebugPanel] = useState(false);
  const { captureFullScreen, captureArea, isCapturing } = useApp();

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

  const menuItems = [
    { label: 'FILE', active: activeMenu === 'FILE' },
    { label: 'DRAW', active: activeMenu === 'DRAW' },
    { label: 'IMAGE', active: activeMenu === 'IMAGE' },
    { label: 'CAPTURE', active: activeMenu === 'CAPTURE' }
  ];

  const handleMenuClick = (menuLabel: string) => {
    setActiveMenu(menuLabel);
  };

  return (
    <div className="bg-gray-100 border-b border-gray-300 px-2 py-1">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          {menuItems.map((item, index) => (
            <button
              key={index}
              onClick={() => handleMenuClick(item.label)}
              className={`px-3 py-1 text-sm hover:bg-gray-200 ${
                item.active ? 'bg-blue-100 text-blue-700' : 'text-gray-700'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
        
        {/* Quick Capture Buttons */}
        {activeMenu === 'CAPTURE' && (
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
          </div>
        )}
        
        {/* Debug Button */}
        <button
          onClick={() => setShowDebugPanel(true)}
          className="p-1 hover:bg-gray-200 rounded transition-colors"
          title="Debug Panel (Ctrl+Shift+L)"
        >
          <Bug className="w-4 h-4 text-gray-600" />
        </button>
      </div>
      
      {/* Debug Panel */}
      <DebugPanel 
        isOpen={showDebugPanel} 
        onClose={() => setShowDebugPanel(false)} 
      />
    </div>
  );
}