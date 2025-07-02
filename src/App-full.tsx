import React from 'react';
import { MenuBar } from './components/MenuBar';
import { Toolbar } from './components/Toolbar';
import { Canvas } from './components/Canvas';
import { QuickTags } from './components/QuickTags';
import { FileMetaData } from './components/FileMetaData';
import { RecentPanel } from './components/RecentPanel';
import { StatusBar } from './components/StatusBar';
import { AppProvider } from './context/AppContext';
import { ErrorBoundary } from './components/ErrorBoundary';

export default function App() {
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
              <span className="text-sm text-gray-700 ml-2">Bug Shooting</span>
            </div>
            <div className="flex items-center gap-1 text-gray-600">
              <button className="hover:bg-gray-300 px-2 py-1 text-sm">−</button>
              <button className="hover:bg-gray-300 px-2 py-1 text-sm">□</button>
              <button className="hover:bg-gray-300 px-2 py-1 text-sm">×</button>
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
          <div className="flex-1 flex">
            {/* Center Panel - Canvas */}
            <ErrorBoundary name="Canvas (Screenshot Display)" fallback={
              <div style={{ flex: 1, padding: '20px', backgroundColor: '#f8f9fa' }}>
                <h3>Canvas temporarily unavailable</h3>
                <p>There was an issue loading the screenshot display.</p>
              </div>
            }>
              <Canvas />
            </ErrorBoundary>
            
            {/* Quick Tags Vertical Bar */}
            <ErrorBoundary name="QuickTags">
              <QuickTags />
            </ErrorBoundary>
            
            {/* File Meta Data Panel */}
            <ErrorBoundary name="FileMetaData">
              <FileMetaData />
            </ErrorBoundary>
            
            {/* Right Panel - Recent Items */}
            <ErrorBoundary name="RecentPanel" fallback={
              <div style={{ width: '250px', padding: '20px', backgroundColor: '#f8f9fa' }}>
                <h3>Recent Panel temporarily unavailable</h3>
                <p>There was an issue loading the screenshot list.</p>
              </div>
            }>
              <RecentPanel />
            </ErrorBoundary>
          </div>

          {/* Status Bar */}
          <ErrorBoundary name="StatusBar">
            <StatusBar />
          </ErrorBoundary>
          </div>
        </ErrorBoundary>
      </AppProvider>
    </ErrorBoundary>
  );
}