import React, { useState, useEffect } from 'react';
import { MenuBar } from './components/MenuBar';
import { Toolbar } from './components/Toolbar';
import { Canvas } from './components/Canvas';
import { QuickTags } from './components/QuickTags';
import { FileMetaData } from './components/FileMetaData';
import { VirtualizedRecentPanel } from './components/VirtualizedRecentPanel';
import { StatusBar } from './components/StatusBar';
import { AppProvider } from './context/AppContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ResizeDivider } from './components/ResizeDivider';

export default function App() {
  // State for resizable panel widths
  const [fileMetaDataWidth, setFileMetaDataWidth] = useState(() => {
    const saved = localStorage.getItem('fileMetaDataWidth');
    return saved ? parseInt(saved, 10) : 288; // Default 288px (w-72)
  });
  
  const [recentPanelWidth, setRecentPanelWidth] = useState(() => {
    const saved = localStorage.getItem('recentPanelWidth');
    return saved ? parseInt(saved, 10) : 384; // Default 384px (w-96)
  });

  // Save widths to localStorage when they change
  useEffect(() => {
    localStorage.setItem('fileMetaDataWidth', fileMetaDataWidth.toString());
  }, [fileMetaDataWidth]);

  useEffect(() => {
    localStorage.setItem('recentPanelWidth', recentPanelWidth.toString());
  }, [recentPanelWidth]);

  // Resize handlers with smooth incremental updates
  const handleFileMetaDataResize = (deltaX: number) => {
    setFileMetaDataWidth(prev => {
      const newWidth = prev + deltaX; // Incremental change
      return Math.max(200, Math.min(600, newWidth));
    });
  };

  const handleRecentPanelResize = (deltaX: number) => {
    // This divider controls metadata width directly for intuitive behavior
    // Dragging right = metadata larger (and recent smaller)
    // Dragging left = metadata smaller (and recent larger)
    
    setFileMetaDataWidth(prev => {
      const newMetaWidth = prev + deltaX;
      const clampedMetaWidth = Math.max(200, Math.min(600, newMetaWidth));
      
      // Adjust recent panel width inversely
      setRecentPanelWidth(prevRecent => {
        const deltaChange = clampedMetaWidth - prev; // Actual change applied to metadata
        const newRecentWidth = prevRecent - deltaChange;
        return Math.max(250, Math.min(800, newRecentWidth));
      });
      
      return clampedMetaWidth;
    });
  };

  // Calculate Canvas width dynamically  
  const quickTagsWidth = 56; // Approximate width of QuickTags component
  const dividerWidth = 16; // 2 dividers × 8px each (updated width)
  const canvasWidth = `calc(100% - ${fileMetaDataWidth + recentPanelWidth + quickTagsWidth + dividerWidth}px)`;

  return (
    <ErrorBoundary name="App Root">
      <AppProvider>
        <ErrorBoundary name="Main App Container">
          <div className="h-full flex flex-col bg-gray-100 overflow-hidden">
          {/* Window Title Bar */}
          <div className="bg-gray-200 border-b border-gray-400 px-4 py-1 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex gap-1">
                <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              </div>
            </div>
          </div>

          {/* Menu Bar */}
          <ErrorBoundary name="MenuBar">
            <MenuBar />
          </ErrorBoundary>

          {/* Toolbar */}
          <ErrorBoundary name="Toolbar">
            <Toolbar />
          </ErrorBoundary>

          {/* Main Content Area */}
          <div className="flex-1 flex overflow-hidden">
            {/* Canvas Panel */}
            <ErrorBoundary name="Canvas (Screenshot Display)" fallback={
              <div style={{ width: canvasWidth, padding: '20px', backgroundColor: '#f8f9fa' }}>
                <h3>Canvas temporarily unavailable</h3>
                <p>There was an issue loading the screenshot display.</p>
              </div>
            }>
              <div style={{ width: canvasWidth }}>
                <Canvas />
              </div>
            </ErrorBoundary>
            
            {/* Quick Tags Vertical Bar */}
            <ErrorBoundary name="QuickTags">
              <QuickTags />
            </ErrorBoundary>
            
            {/* Resize Divider 1 - Between QuickTags and FileMetaData */}
            <ResizeDivider 
              onResize={handleFileMetaDataResize}
              ariaLabel="Resize metadata panel"
            />
            
            {/* File Meta Data Panel */}
            <ErrorBoundary name="FileMetaData">
              <div style={{ width: `${fileMetaDataWidth}px` }}>
                <FileMetaData />
              </div>
            </ErrorBoundary>
            
            {/* Resize Divider 2 - Between FileMetaData and Recent Panel */}
            <ResizeDivider 
              onResize={handleRecentPanelResize}
              ariaLabel="Resize metadata panel (right edge)"
            />
            
            {/* Right Panel - Recent Items */}
            <ErrorBoundary name="RecentPanel" fallback={
              <div style={{ width: `${recentPanelWidth}px`, padding: '20px', backgroundColor: '#f8f9fa' }}>
                <h3>Recent Panel temporarily unavailable</h3>
                <p>There was an issue loading the screenshot list.</p>
              </div>
            }>
              <div style={{ width: `${recentPanelWidth}px` }}>
                <VirtualizedRecentPanel />
              </div>
            </ErrorBoundary>
          </div>

          </div>
        </ErrorBoundary>
      </AppProvider>
    </ErrorBoundary>
  );
}