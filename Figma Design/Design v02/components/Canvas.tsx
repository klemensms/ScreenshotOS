import React, { useState } from 'react';
import { X } from 'lucide-react';
import { ImageWithFallback } from './figma/ImageWithFallback';
import exampleImage from 'figma:asset/2697b4307f7ef2f5d37144937d39e89a58e57868.png';

export function Canvas() {
  const [activeTab, setActiveTab] = useState(0);
  
  const tabs = [
    { id: 0, name: 'SQLQuery1.sql - sqls-dev-rpt...', hasChanges: false },
    { id: 1, name: 'Screenshot 1', hasChanges: true },
    { id: 2, name: 'Bug Report', hasChanges: false }
  ];

  const closeTab = (tabId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    // Tab closing logic would go here
    console.log('Closing tab:', tabId);
  };

  return (
    <div className="flex-1 bg-gray-300 relative flex flex-col">
      {/* Tab Bar */}
      <div className="bg-gray-200 border-b border-gray-400 flex items-center">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 border-r border-gray-400 cursor-pointer hover:bg-gray-100 ${
              activeTab === tab.id ? 'bg-white border-b-2 border-blue-500' : ''
            }`}
          >
            <span className="text-sm">{tab.name}</span>
            {tab.hasChanges && (
              <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
            )}
            <button
              onClick={(e) => closeTab(tab.id, e)}
              className="hover:bg-gray-300 rounded p-0.5"
            >
              <X className="w-3 h-3 text-gray-600" />
            </button>
          </div>
        ))}
        <button className="px-3 py-2 hover:bg-gray-100 text-gray-600">
          +
        </button>
      </div>

      {/* Canvas Content */}
      <div className="flex-1 relative overflow-hidden">
        {activeTab === 0 && (
          <div className="h-full flex items-center justify-center p-8">
            <div className="bg-white rounded shadow-lg overflow-hidden max-w-4xl max-h-full">
              <ImageWithFallback
                src="https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&h=600&fit=crop"
                alt="SQL Query Screenshot"
                className="max-w-full max-h-full object-contain"
              />
            </div>
          </div>
        )}
        
        {activeTab === 1 && (
          <div className="h-full flex items-center justify-center p-8">
            <div className="bg-white rounded shadow-lg overflow-hidden max-w-4xl max-h-full">
              <img
                src={exampleImage}
                alt="Screenshot"
                className="max-w-full max-h-full object-contain"
              />
            </div>
          </div>
        )}

        {activeTab === 2 && (
          <div className="h-full flex items-center justify-center p-8">
            <div className="bg-white rounded shadow-lg overflow-hidden max-w-4xl max-h-full">
              <ImageWithFallback
                src="https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&h=600&fit=crop"
                alt="Bug Report Screenshot"
                className="max-w-full max-h-full object-contain"
              />
            </div>
          </div>
        )}
      </div>

      {/* Search box in top right */}
      <div className="absolute top-16 right-4">
        <input
          type="text"
          placeholder="Type to search (Ctrl+F)"
          className="px-3 py-1 text-sm border border-gray-400 bg-white rounded w-48"
        />
      </div>
    </div>
  );
}