import React from 'react';
import { MenuBar } from './components/MenuBar';
import { Toolbar } from './components/Toolbar';
import { Canvas } from './components/Canvas';
import { QuickTags } from './components/QuickTags';
import { FileMetaData } from './components/FileMetaData';
import { RecentPanel } from './components/RecentPanel';
import { StatusBar } from './components/StatusBar';
import { AppProvider } from './context/AppContext';

export default function App() {
  return (
    <AppProvider>
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
      <MenuBar />

      {/* Toolbar */}
      <Toolbar />

      {/* Main Content Area */}
      <div className="flex-1 flex">
        {/* Center Panel - Canvas */}
        <Canvas />
        
        {/* Quick Tags Vertical Bar */}
        <QuickTags />
        
        {/* File Meta Data Panel */}
        <FileMetaData />
        
        {/* Right Panel - Recent Items */}
        <RecentPanel />
      </div>

      {/* Status Bar */}
      <StatusBar />
      </div>
    </AppProvider>
  );
}