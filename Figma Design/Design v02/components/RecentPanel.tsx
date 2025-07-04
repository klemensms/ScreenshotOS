import React, { useState } from 'react';
import { Star, Smile, Plus, Heart, ThumbsUp, MessageCircle, AlertTriangle, Zap } from 'lucide-react';

export function RecentPanel() {
  const [activeView, setActiveView] = useState('RECENT');
  const [selectedScreenshot, setSelectedScreenshot] = useState(1);

  const recentItems = [
    {
      id: 1,
      title: 'SQLQuery1.sql - sqls-dev-rpt1-scuk...',
      date: '25-08-2023 03:31:30',
      size: '886 x 275',
      type: 'document',
      tags: ['red']
    },
    {
      id: 2,
      title: 'Untitled',
      date: '25-08-2023 03:30:40',
      size: '404 x 86',
      type: 'screenshot',
      tags: []
    },
    {
      id: 3,
      title: 'Untitled',
      date: '17-08-2023 12:40:18',
      size: '1483 x 856',
      type: 'screenshot',
      tags: ['blue']
    },
    {
      id: 4,
      title: 'RDP',
      date: '30-11-2023 10:35:35',
      size: '2137 x 2007',
      type: 'rdp',
      tags: ['red', 'orange']
    },
    {
      id: 5,
      title: 'Full screen',
      date: '30-11-2023 11:08:18',
      size: '2768 x 1728',
      type: 'fullscreen',
      tags: ['green']
    },
    {
      id: 6,
      title: 'Application - Application_Information...',
      date: '30-11-2023 11:04:35',
      size: '1915 x 1251',
      type: 'application',
      tags: ['blue', 'yellow']
    },
    {
      id: 7,
      title: 'Remove Desktop',
      date: '30-11-2023 11:43:35',
      size: '1737 x 1898',
      type: 'desktop',
      tags: []
    },
    {
      id: 8,
      title: 'Application - Application_Information...',
      date: '30-11-2023 11:41:27',
      size: '2784 x 2008',
      type: 'application',
      tags: ['purple']
    }
  ];

  const getTagInfo = (tag: string) => {
    const tagMap = {
      red: { color: 'bg-red-500', icon: Star },
      blue: { color: 'bg-blue-500', icon: Smile },
      green: { color: 'bg-green-500', icon: Plus },
      pink: { color: 'bg-pink-500', icon: Heart },
      purple: { color: 'bg-purple-500', icon: ThumbsUp },
      yellow: { color: 'bg-yellow-500', icon: MessageCircle },
      orange: { color: 'bg-orange-500', icon: AlertTriangle },
      gray: { color: 'bg-gray-500', icon: Zap }
    };
    return tagMap[tag as keyof typeof tagMap] || { color: 'bg-gray-500', icon: Zap };
  };

  const handleScreenshotSelect = (id: number) => {
    setSelectedScreenshot(id);
  };

  const items = activeView === 'RECENT' 
    ? recentItems 
    : recentItems.filter(item => item.tags.length > 0);

  return (
    <div className="bg-white border-l border-gray-300 w-80 h-full flex flex-col">
      {/* Header */}
      <div className="bg-gray-100 border-b border-gray-300 px-3 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 text-sm">
            <button
              onClick={() => setActiveView('RECENT')}
              className={`pb-1 ${
                activeView === 'RECENT' 
                  ? 'text-blue-600 border-b-2 border-blue-600' 
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              RECENT
            </button>
            <button
              onClick={() => setActiveView('LIBRARY')}
              className={`pb-1 ${
                activeView === 'LIBRARY' 
                  ? 'text-blue-600 border-b-2 border-blue-600' 
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              LIBRARY
            </button>
          </div>
        </div>
      </div>

      {/* Search Box */}
      <div className="p-3 border-b border-gray-200">
        <input
          type="text"
          placeholder="Type to search (Ctrl+F)"
          className="w-full px-3 py-1 text-sm border border-gray-300 rounded"
        />
      </div>

      {/* Items List */}
      <div className="flex-1 overflow-auto">
        {items.map((item) => (
          <div
            key={item.id}
            onClick={() => handleScreenshotSelect(item.id)}
            className={`flex items-start gap-3 p-3 border-b border-gray-100 cursor-pointer transition-colors ${
              selectedScreenshot === item.id 
                ? 'bg-blue-100 border-l-4 border-l-blue-500' 
                : 'hover:bg-gray-50'
            }`}
          >
            {/* Thumbnail */}
            <div className="w-12 h-12 bg-gray-200 rounded border flex-shrink-0 relative">
              {item.type === 'rdp' && (
                <div className="w-full h-full bg-blue-500 rounded flex items-center justify-center">
                  <span className="text-white text-xs">RDP</span>
                </div>
              )}
              {item.type === 'document' && (
                <div className="w-full h-full bg-orange-100 rounded border border-orange-200"></div>
              )}
              {item.type === 'screenshot' && (
                <div className="w-full h-full bg-blue-100 rounded border border-blue-200"></div>
              )}
              {item.type === 'fullscreen' && (
                <div className="w-full h-full bg-green-100 rounded border border-green-200"></div>
              )}
              {item.type === 'application' && (
                <div className="w-full h-full bg-purple-100 rounded border border-purple-200"></div>
              )}
              {item.type === 'desktop' && (
                <div className="w-full h-full bg-gray-100 rounded border border-gray-300"></div>
              )}
              
              {/* Selection indicator */}
              {selectedScreenshot === item.id && (
                <div className="absolute inset-0 border-2 border-blue-500 rounded bg-blue-500 bg-opacity-10"></div>
              )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className={`text-sm truncate mb-1 ${
                selectedScreenshot === item.id ? 'text-blue-800' : 'text-gray-800'
              }`}>
                {item.title || 'Untitled'}
              </div>
              <div className={`text-xs ${
                selectedScreenshot === item.id ? 'text-blue-600' : 'text-gray-500'
              }`}>
                {item.date}
              </div>
              <div className={`text-xs ${
                selectedScreenshot === item.id ? 'text-blue-600' : 'text-gray-500'
              }`}>
                {item.size}
              </div>
            </div>

            {/* Tag icons on the right */}
            <div className="flex items-center gap-1">
              {item.tags.map((tag, index) => {
                const tagInfo = getTagInfo(tag);
                const IconComponent = tagInfo.icon;
                return (
                  <div
                    key={index}
                    className={`w-5 h-5 rounded-full ${tagInfo.color} flex items-center justify-center`}
                    title={`${tag} tag`}
                  >
                    <IconComponent className="w-3 h-3 text-white" />
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        
        {activeView === 'LIBRARY' && items.length === 0 && (
          <div className="p-8 text-center text-gray-500">
            <p>No tagged screenshots</p>
            <p className="text-sm mt-1">Use quick tags to organize your screenshots</p>
          </div>
        )}
      </div>
    </div>
  );
}