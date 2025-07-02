import React, { useState } from 'react';
import { Star, Smile, Plus, Heart, ThumbsUp, MessageCircle, AlertTriangle, Zap } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { debugLogger } from '../utils/debug-logger';

export function RecentPanel() {
  const [activeView, setActiveView] = useState('RECENT');
  const { screenshots, currentScreenshot, setCurrentScreenshot, loadMoreScreenshots, isLoadingMore, hasMoreFiles } = useApp();

  // Debug: Log what RecentPanel receives
  React.useEffect(() => {
    debugLogger.log('RecentPanel', 'screenshots updated', `Received ${screenshots.length} screenshots`);
    console.log(`📱 [RECENT_PANEL] Received ${screenshots.length} screenshots from context`);
    if (screenshots.length > 0) {
      console.log(`📱 [RECENT_PANEL] First 3 screenshots:`);
      screenshots.slice(0, 3).forEach((screenshot, idx) => {
        console.log(`  ${idx + 1}. ${screenshot.name} - ${screenshot.filePath.split('/').pop()}`);
      });
    } else {
      console.warn(`📱 [RECENT_PANEL] No screenshots received from context`);
    }
  }, [screenshots]);

  React.useEffect(() => {
    debugLogger.log('RecentPanel', 'activeView changed', activeView);
  }, [activeView]);

  // Removed hardcoded sample data - only show real screenshots

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

  const handleScreenshotSelect = (screenshot: any) => {
    debugLogger.startOperation('RecentPanel', 'handleScreenshotSelect', { screenshotId: screenshot?.id, screenshotName: screenshot?.name });
    // Set the screenshot directly
    console.log('Switching to screenshot:', screenshot);
    setCurrentScreenshot(screenshot);
    debugLogger.endOperation('RecentPanel', 'handleScreenshotSelect');
  };

  // Convert app screenshots to the format expected by the component
  const appScreenshots = screenshots.map((screenshot, index) => ({
    id: screenshot.id,
    title: screenshot.name,
    date: screenshot.timestamp.toLocaleString(),
    size: `${screenshot.dimensions?.width || 'Unknown'} x ${screenshot.dimensions?.height || 'Unknown'}`,
    type: 'screenshot',
    tags: screenshot.tags,
    screenshot: screenshot
  }));

  const items = activeView === 'RECENT' 
    ? appScreenshots
    : appScreenshots.filter(item => item.tags.length > 0);

  // Infinite scroll functionality
  const handleScroll = React.useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const scrollPosition = target.scrollTop + target.clientHeight;
    const scrollHeight = target.scrollHeight;
    
    // Load more when user is within 100px of the bottom
    if (scrollPosition >= scrollHeight - 100 && !isLoadingMore && hasMoreFiles) {
      debugLogger.log('RecentPanel', 'loadMoreScreenshots triggered', { scrollPosition, scrollHeight });
      console.log('📜 [SCROLL] Loading more screenshots...');
      loadMoreScreenshots();
    }
  }, [isLoadingMore, hasMoreFiles, loadMoreScreenshots]);

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
      <div className="flex-1 overflow-auto" onScroll={handleScroll}>
        {items.map((item) => (
          <div
            key={item.id}
            onClick={() => handleScreenshotSelect(item.screenshot)}
            className={`flex items-start gap-3 p-3 border-b border-gray-100 cursor-pointer transition-colors ${
              currentScreenshot?.id === item.screenshot?.id 
                ? 'bg-blue-100 border-l-4 border-l-blue-500' 
                : 'hover:bg-gray-50'
            }`}
          >
            {/* Thumbnail */}
            <div className="w-12 h-12 bg-gray-200 rounded border flex-shrink-0 relative overflow-hidden">
              {item.screenshot?.base64Image ? (
                <img
                  src={`data:image/png;base64,${item.screenshot.base64Image}`}
                  alt={item.title}
                  className="w-12 h-12 object-cover rounded"
                  style={{ maxWidth: '48px', maxHeight: '48px', minWidth: '48px', minHeight: '48px' }}
                  onError={(e) => {
                    // Fallback to placeholder if image fails to load
                    e.currentTarget.style.display = 'none';
                    e.currentTarget.nextElementSibling?.classList.remove('hidden');
                  }}
                />
              ) : null}
              
              {/* Fallback placeholder */}
              <div className={`w-full h-full bg-gray-300 rounded flex items-center justify-center ${item.screenshot?.base64Image ? 'hidden' : ''}`}>
                <span className="text-gray-500 text-xs">IMG</span>
              </div>
              
              {/* Selection indicator */}
              {currentScreenshot?.id === item.screenshot?.id && (
                <div className="absolute inset-0 border-2 border-blue-500 rounded bg-blue-500 bg-opacity-10"></div>
              )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className={`text-sm truncate mb-1 ${
                currentScreenshot?.id === item.screenshot?.id ? 'text-blue-800' : 'text-gray-800'
              }`}>
                {item.title || 'Untitled'}
              </div>
              <div className={`text-xs ${
                currentScreenshot?.id === item.screenshot?.id ? 'text-blue-600' : 'text-gray-500'
              }`}>
                {item.date}
              </div>
              <div className={`text-xs ${
                currentScreenshot?.id === item.screenshot?.id ? 'text-blue-600' : 'text-gray-500'
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
        
        {activeView === 'RECENT' && items.length === 0 && (
          <div className="p-8 text-center text-gray-500">
            <p>No screenshots yet</p>
            <p className="text-sm mt-1">Capture your first screenshot to get started</p>
          </div>
        )}
        
        {activeView === 'LIBRARY' && items.length === 0 && (
          <div className="p-8 text-center text-gray-500">
            <p>No tagged screenshots</p>
            <p className="text-sm mt-1">Use quick tags to organize your screenshots</p>
          </div>
        )}
        
        {/* Loading indicator */}
        {isLoadingMore && (
          <div className="p-4 text-center text-gray-500">
            <div className="flex items-center justify-center gap-2">
              <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin"></div>
              <span className="text-sm">Loading more screenshots...</span>
            </div>
          </div>
        )}
        
        {/* End of list indicator */}
        {!hasMoreFiles && items.length > 0 && (
          <div className="p-4 text-center text-gray-400">
            <span className="text-xs">No more screenshots to load</span>
          </div>
        )}
      </div>
    </div>
  );
}