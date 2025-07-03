import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { FixedSizeList as List } from 'react-window';
import { Star, Smile, Plus, Heart, ThumbsUp, MessageCircle, AlertTriangle, Zap, Trash2, CheckSquare, Square } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { debugLogger } from '../utils/debug-logger';
import { SearchPanel } from './SearchPanel';
import { ContextMenu, useContextMenu, createScreenshotMenuItems } from './ContextMenu';
import { ConfirmationDialog, useConfirmationDialog, createArchiveConfirmation, createDeleteConfirmation, createRestoreConfirmation } from './ConfirmationDialog';

interface ListItem {
  id: string;
  title: string;
  date: string;
  size: string;
  type: string;
  tags: string[];
  screenshot: any;
}

interface ItemRendererProps {
  index: number;
  style: React.CSSProperties;
  data: {
    items: ListItem[];
    currentScreenshot: any;
    onScreenshotSelect: (screenshot: any) => void;
    getTagInfo: (tag: string) => { color: string; icon: any };
    selectedItems: Set<string>;
    onToggleSelection: (id: string) => void;
    onContextMenu: (e: React.MouseEvent, item: ListItem, isArchived: boolean) => void;
    isSelectionMode: boolean;
    activeView: string;
  };
}

const ItemRenderer: React.FC<ItemRendererProps> = ({ index, style, data }) => {
  const { items, currentScreenshot, onScreenshotSelect, getTagInfo, selectedItems, onToggleSelection, onContextMenu, isSelectionMode, activeView } = data;
  const item = items[index];

  if (!item) return null;

  const isSelected = selectedItems.has(item.id);
  const isArchived = activeView === 'ARCHIVED';

  const handleClick = (e: React.MouseEvent) => {
    if (e.ctrlKey || e.metaKey || isSelectionMode) {
      onToggleSelection(item.id);
    } else {
      onScreenshotSelect(item.screenshot);
    }
  };

  const handleRightClick = (e: React.MouseEvent) => {
    e.preventDefault();
    onContextMenu(e, item, isArchived);
  };

  return (
    <div style={style}>
      <div
        onClick={handleClick}
        onContextMenu={handleRightClick}
        className={`flex items-start gap-3 p-3 border-b border-gray-100 cursor-pointer transition-colors relative ${
          isSelected
            ? 'bg-blue-50 border-l-4 border-l-blue-400'
            : currentScreenshot?.id === item.screenshot?.id 
            ? 'bg-blue-100 border-l-4 border-l-blue-500' 
            : 'hover:bg-gray-50'
        }`}
      >
        {/* Selection checkbox */}
        {(isSelectionMode || isSelected) && (
          <div className="flex items-center justify-center w-5 h-5 mt-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleSelection(item.id);
              }}
              className="w-4 h-4 text-blue-600 hover:text-blue-700"
            >
              {isSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
            </button>
          </div>
        )}
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
        <div className="flex-1 min-w-0 overflow-hidden">
          <div className={`text-sm truncate mb-1 ${
            currentScreenshot?.id === item.screenshot?.id ? 'text-blue-800' : 'text-gray-800'
          }`}>
            {item.title || 'Untitled'}
          </div>
          <div className={`text-xs truncate ${
            currentScreenshot?.id === item.screenshot?.id ? 'text-blue-600' : 'text-gray-500'
          }`}>
            {item.date}
          </div>
          <div className={`text-xs truncate ${
            currentScreenshot?.id === item.screenshot?.id ? 'text-blue-600' : 'text-gray-500'
          }`}>
            {item.size}
          </div>
        </div>

        {/* Tag icons on the right - always visible */}
        <div className="flex items-center gap-1 flex-shrink-0 ml-2" style={{ minWidth: item.tags.length > 0 ? `${item.tags.length * 24}px` : '0px' }}>
          {item.tags.map((tag, tagIndex) => {
            const tagInfo = getTagInfo(tag);
            const IconComponent = tagInfo.icon;
            return (
              <div
                key={tagIndex}
                className={`w-5 h-5 rounded-full ${tagInfo.color} flex items-center justify-center flex-shrink-0`}
                title={`${tag} tag`}
              >
                <IconComponent className="w-3 h-3 text-white" />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

interface SearchFilters {
  query: string;
  tags: string[];
  dateRange: {
    start: Date | null;
    end: Date | null;
  };
  sortBy: 'date' | 'relevance';
  sortOrder: 'asc' | 'desc';
}

export function VirtualizedRecentPanel() {
  const [activeView, setActiveView] = useState('RECENT');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [hasActiveSearch, setHasActiveSearch] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [archivedScreenshots, setArchivedScreenshots] = useState<any[]>([]);
  const [isLoadingArchived, setIsLoadingArchived] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const { contextMenu, showContextMenu, hideContextMenu } = useContextMenu();
  const { dialog, showConfirmation, hideConfirmation, confirmAndClose } = useConfirmationDialog();
  
  const { screenshots, currentScreenshot, setCurrentScreenshot, loadMoreScreenshots, isLoadingMore, hasMoreFiles } = useApp();


  // Debug: Log what VirtualizedRecentPanel receives
  React.useEffect(() => {
    debugLogger.log('VirtualizedRecentPanel', 'screenshots updated', `Received ${screenshots.length} screenshots`);
    console.log(`📱 [VIRTUALIZED_RECENT_PANEL] Received ${screenshots.length} screenshots from context`);
    if (screenshots.length > 0) {
      console.log(`📱 [VIRTUALIZED_RECENT_PANEL] First 3 screenshots:`);
      screenshots.slice(0, 3).forEach((screenshot, idx) => {
        console.log(`  ${idx + 1}. ${screenshot.name} - ${screenshot.filePath.split('/').pop()}`);
      });
    } else {
      console.warn(`📱 [VIRTUALIZED_RECENT_PANEL] No screenshots received from context`);
    }
  }, [screenshots]);

  React.useEffect(() => {
    debugLogger.log('VirtualizedRecentPanel', 'activeView changed', activeView);
  }, [activeView]);

  // Load available tags on component mount
  useEffect(() => {
    const loadTags = async () => {
      try {
        const result = await window.electron.invoke('indexer-get-stats');
        if (result.success) {
          setAvailableTags(result.data.allTags || []);
        }
      } catch (error) {
        console.error('Failed to load available tags:', error);
      }
    };

    loadTags();
  }, []);

  // Background loading effect to ensure all screenshots are eventually loaded
  useEffect(() => {
    const startBackgroundLoading = () => {
      if (!isLoadingMore && hasMoreFiles && screenshots.length > 0) {
        // Start background loading after a short delay
        const timeoutId = setTimeout(() => {
          console.log('🔄 [BACKGROUND_LOADING] Auto-loading more screenshots...');
          loadMoreScreenshots();
        }, 2000); // 2 second delay

        return () => clearTimeout(timeoutId);
      }
    };

    return startBackgroundLoading();
  }, [screenshots.length, isLoadingMore, hasMoreFiles, loadMoreScreenshots]);

  // Search function
  const handleSearch = useCallback(async (filters: SearchFilters) => {
    setIsSearching(true);
    setHasActiveSearch(true);

    try {
      let results: any[] = [];

      if (filters.query.trim()) {
        // Text search
        const searchResult = await window.electron.invoke('indexer-search', filters.query, 1000);
        if (searchResult.success) {
          results = searchResult.data;
        }
      } else if (filters.tags.length > 0) {
        // Tag-based search
        const tagResult = await window.electron.invoke('indexer-get-by-tags', filters.tags);
        if (tagResult.success) {
          results = tagResult.data;
        }
      } else if (filters.dateRange.start || filters.dateRange.end) {
        // Date range search
        const start = filters.dateRange.start || new Date(0);
        const end = filters.dateRange.end || new Date();
        const dateResult = await window.electron.invoke('indexer-get-by-date-range', start.toISOString(), end.toISOString());
        if (dateResult.success) {
          results = dateResult.data;
        }
      }

      // Convert search results to the format expected by the list
      const formattedResults = results.map((result) => ({
        id: result.id,
        title: result.fileName,
        date: new Date(result.timestamp).toLocaleString(),
        size: result.dimensions ? `${result.dimensions.width} x ${result.dimensions.height}` : 'Unknown',
        type: 'screenshot',
        tags: result.tags || [],
        screenshot: {
          id: result.id,
          name: result.fileName,
          filePath: result.filePath,
          timestamp: new Date(result.timestamp),
          tags: result.tags || [],
          dimensions: result.dimensions
        }
      }));

      setSearchResults(formattedResults);
    } catch (error) {
      console.error('Search failed:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Clear search function
  const handleClearSearch = useCallback(() => {
    setSearchResults([]);
    setHasActiveSearch(false);
    setIsSearching(false);
  }, []);

  // Load archived screenshots
  const loadArchivedScreenshots = useCallback(async () => {
    setIsLoadingArchived(true);
    try {
      console.log('📁 [ARCHIVE] Loading archived screenshots...');
      const config = await window.electron.invoke('load-storage-config');
      console.log('📁 [ARCHIVE] Config loaded:', config);
      
      if (config.success && config.data.archiveDirectory) {
        const archiveDirectory = config.data.archiveDirectory;
        console.log('📁 [ARCHIVE] Scanning archive directory:', archiveDirectory);
        
        const result = await window.electron.invoke('sidecar-scan-directory', archiveDirectory);
        console.log('📁 [ARCHIVE] Scan result:', result);
        
        if (result.success) {
          const archived = result.data || [];
          console.log(`📁 [ARCHIVE] Found ${archived.length} archived screenshots`);
          setArchivedScreenshots(archived);
        } else {
          console.error('❌ [ARCHIVE] Failed to scan archive directory:', result.error);
        }
      } else {
        console.warn('⚠️ [ARCHIVE] No archive directory configured');
      }
    } catch (error) {
      console.error('❌ [ARCHIVE] Failed to load archived screenshots:', error);
    } finally {
      setIsLoadingArchived(false);
    }
  }, []);

  // Load archived screenshots when Archive tab is activated
  useEffect(() => {
    if (activeView === 'ARCHIVED') {
      loadArchivedScreenshots();
    }
  }, [activeView, loadArchivedScreenshots]);

  // Selection management
  const toggleSelection = useCallback((itemId: string) => {
    setSelectedItems(prev => {
      const newSelection = new Set(prev);
      if (newSelection.has(itemId)) {
        newSelection.delete(itemId);
      } else {
        newSelection.add(itemId);
      }
      return newSelection;
    });
  }, []);

  const selectAll = useCallback(() => {
    const currentItems = getCurrentItems();
    const allIds = new Set(currentItems.map(item => item.id));
    setSelectedItems(allIds);
  }, [screenshots, hasActiveSearch, searchResults, activeView, archivedScreenshots]);

  const clearSelection = useCallback(() => {
    setSelectedItems(new Set());
    setIsSelectionMode(false);
  }, []);

  // Archive operations
  const archiveScreenshot = useCallback(async (filePath: string) => {
    try {
      console.log(`📁 [ARCHIVE] Archiving single screenshot: ${filePath}`);
      const result = await window.electron.invoke('file-archive-screenshot', filePath);
      
      if (result.success) {
        console.log(`✅ [ARCHIVE] Successfully archived: ${filePath}`);
        
        // Refresh archive list if we're in archive view
        if (activeView === 'ARCHIVED') {
          loadArchivedScreenshots();
        }
        
        // Refresh the current view
        window.location.reload();
      } else {
        console.error('❌ [ARCHIVE] Failed to archive screenshot:', result.error);
      }
    } catch (error) {
      console.error('❌ [ARCHIVE] Archive operation failed:', error);
    }
  }, [activeView, loadArchivedScreenshots]);

  const archiveSelectedScreenshots = useCallback(async () => {
    const currentItems = getCurrentItems();
    const selectedPaths = currentItems
      .filter(item => selectedItems.has(item.id))
      .map(item => item.screenshot.filePath);

    if (selectedPaths.length === 0) return;

    try {
      console.log(`📁 [ARCHIVE] Archiving ${selectedPaths.length} screenshots...`);
      const result = await window.electron.invoke('file-archive-screenshots', selectedPaths);
      
      if (result.success.length > 0) {
        console.log(`✅ [ARCHIVE] Successfully archived ${result.success.length} screenshots`);
        clearSelection();
        
        // Refresh archive list if we're in archive view
        if (activeView === 'ARCHIVED') {
          loadArchivedScreenshots();
        }
        
        // Trigger a refresh of the main screenshot list
        window.location.reload();
      }
      
      if (result.failed.length > 0) {
        console.error('❌ [ARCHIVE] Some screenshots failed to archive:', result.failed);
      }
    } catch (error) {
      console.error('❌ [ARCHIVE] Bulk archive operation failed:', error);
    }
  }, [screenshots, hasActiveSearch, searchResults, activeView, archivedScreenshots, selectedItems, clearSelection, loadArchivedScreenshots]);

  // Delete operations
  const deleteScreenshot = useCallback(async (filePath: string, permanent = false) => {
    try {
      const result = await window.electron.invoke('file-delete-screenshot', filePath, permanent);
      if (result.success) {
        window.location.reload(); // Simple refresh for now
      } else {
        console.error('Failed to delete screenshot:', result.error);
      }
    } catch (error) {
      console.error('Delete operation failed:', error);
    }
  }, []);

  const deleteSelectedScreenshots = useCallback(async (permanent = false) => {
    const currentItems = getCurrentItems();
    const selectedPaths = currentItems
      .filter(item => selectedItems.has(item.id))
      .map(item => item.screenshot.filePath);

    if (selectedPaths.length === 0) return;

    try {
      const result = await window.electron.invoke('file-delete-screenshots', selectedPaths, permanent);
      if (result.success.length > 0) {
        clearSelection();
        window.location.reload(); // Simple refresh for now
      }
      
      if (result.failed.length > 0) {
        console.error('Some screenshots failed to delete:', result.failed);
      }
    } catch (error) {
      console.error('Bulk delete operation failed:', error);
    }
  }, [screenshots, hasActiveSearch, searchResults, activeView, archivedScreenshots, selectedItems, clearSelection]);

  // Restore operations (for archived screenshots)
  const restoreScreenshot = useCallback(async (archivedPath: string) => {
    try {
      const result = await window.electron.invoke('file-restore-screenshot', archivedPath);
      if (result.success) {
        loadArchivedScreenshots(); // Refresh archived list
      } else {
        console.error('Failed to restore screenshot:', result.error);
      }
    } catch (error) {
      console.error('Restore operation failed:', error);
    }
  }, [loadArchivedScreenshots]);

  // Copy to clipboard
  const copyToClipboard = useCallback(async (filePath: string) => {
    try {
      const result = await window.electron.invoke('copy-screenshot-to-clipboard', filePath);
      if (!result.success) {
        console.error('Failed to copy to clipboard:', result.error);
      }
    } catch (error) {
      console.error('Copy to clipboard failed:', error);
    }
  }, []);

  // Context menu handler
  const handleContextMenu = useCallback((e: React.MouseEvent, item: ListItem, isArchived: boolean) => {
    const menuItems = createScreenshotMenuItems(
      item.screenshot,
      {
        onArchive: !isArchived ? () => {
          const config = { deleteConfirmation: true }; // Load from settings
          if (config.deleteConfirmation) {
            showConfirmation(createArchiveConfirmation(1, () => archiveScreenshot(item.screenshot.filePath)));
          } else {
            archiveScreenshot(item.screenshot.filePath);
          }
        } : undefined,
        onRestore: isArchived ? () => {
          showConfirmation(createRestoreConfirmation(1, () => restoreScreenshot(item.screenshot.filePath)));
        } : undefined,
        onDelete: () => {
          const config = { deleteConfirmation: true }; // Load from settings
          if (config.deleteConfirmation) {
            showConfirmation(createDeleteConfirmation(1, () => deleteScreenshot(item.screenshot.filePath, isArchived), isArchived));
          } else {
            deleteScreenshot(item.screenshot.filePath, isArchived);
          }
        },
        onCopy: () => copyToClipboard(item.screenshot.filePath),
        onView: () => setCurrentScreenshot(item.screenshot),
        onShowInFinder: () => {
          // TODO: Implement show in finder
          console.log('Show in finder:', item.screenshot.filePath);
        },
      },
      isArchived
    );

    showContextMenu(e, menuItems);
  }, [archiveScreenshot, restoreScreenshot, deleteScreenshot, copyToClipboard, setCurrentScreenshot, showContextMenu, showConfirmation]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle shortcuts when this panel has focus
      if (!document.activeElement?.closest('.VirtualizedRecentPanel')) return;

      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        if (selectedItems.size > 0) {
          const isArchived = activeView === 'ARCHIVED';
          showConfirmation(createDeleteConfirmation(selectedItems.size, () => deleteSelectedScreenshots(isArchived), isArchived));
        }
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'a') {
        e.preventDefault();
        selectAll();
        setIsSelectionMode(true);
      } else if (e.key === 'Escape') {
        clearSelection();
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'Shift' && e.key === 'a') {
        e.preventDefault();
        if (selectedItems.size > 0 && activeView !== 'ARCHIVED') {
          showConfirmation(createArchiveConfirmation(selectedItems.size, () => archiveSelectedScreenshots()));
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedItems, activeView, selectAll, clearSelection, setIsSelectionMode, showConfirmation, deleteSelectedScreenshots, archiveSelectedScreenshots]);

  const getTagInfo = useCallback((tag: string) => {
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
  }, []);

  const handleScreenshotSelect = useCallback((screenshot: any) => {
    debugLogger.startOperation('VirtualizedRecentPanel', 'handleScreenshotSelect', { screenshotId: screenshot?.id, screenshotName: screenshot?.name });
    console.log('Switching to screenshot:', screenshot);
    setCurrentScreenshot(screenshot);
    debugLogger.endOperation('VirtualizedRecentPanel', 'handleScreenshotSelect');
  }, [setCurrentScreenshot]);

  // Helper function to get current items without memoization to avoid circular deps
  const getCurrentItems = () => {
    // Convert app screenshots to the format expected by the component
    const appScreenshotsData = screenshots.map((screenshot, index) => ({
      id: screenshot.id,
      title: screenshot.name,
      date: screenshot.timestamp.toLocaleString(),
      size: `${screenshot.dimensions?.width || 'Unknown'} x ${screenshot.dimensions?.height || 'Unknown'}`,
      type: 'screenshot',
      tags: screenshot.tags,
      screenshot: screenshot
    }));

    // If there's an active search, use search results
    if (hasActiveSearch) {
      return searchResults;
    }
    
    // Switch based on active view
    switch (activeView) {
      case 'RECENT':
        return appScreenshotsData;
      case 'LIBRARY':
        return appScreenshotsData.filter(item => item.tags.length > 0);
      case 'ARCHIVED':
        return archivedScreenshots.map((screenshot) => ({
          id: screenshot.id,
          title: screenshot.name,
          date: new Date(screenshot.timestamp).toLocaleString(),
          size: screenshot.dimensions ? `${screenshot.dimensions.width} x ${screenshot.dimensions.height}` : 'Unknown',
          type: 'screenshot',
          tags: screenshot.tags || [],
          screenshot: screenshot
        }));
      default:
        return appScreenshotsData;
    }
  };

  // Get items for rendering (recalculated each render to avoid circular deps)
  const items = getCurrentItems();

  // Calculate list height dynamically
  const listHeight = useMemo(() => {
    // Use a reasonable fixed height that works well with the layout
    return 600; // Fixed height to prevent scroll bar issues
  }, []);

  // Data object for ItemRenderer - simplified to avoid circular dependencies
  const itemData = {
    items,
    currentScreenshot,
    onScreenshotSelect: handleScreenshotSelect,
    getTagInfo,
    selectedItems,
    onToggleSelection: toggleSelection,
    onContextMenu: handleContextMenu,
    isSelectionMode,
    activeView
  };

  // Handle scroll for infinite loading
  const handleScroll = useCallback(({ scrollOffset, scrollDirection, scrollUpdateWasRequested, clientHeight, scrollHeight }) => {
    // Load more when user is within 100px of the bottom and scrolling down
    const scrollPosition = scrollOffset + clientHeight;
    const threshold = scrollHeight - 100; // Reduced threshold for earlier loading
    
    if (scrollPosition >= threshold && scrollDirection === 'forward' && !isLoadingMore && hasMoreFiles) {
      debugLogger.log('VirtualizedRecentPanel', 'loadMoreScreenshots triggered', { scrollOffset, scrollHeight });
      console.log('📜 [VIRTUAL_SCROLL] Loading more screenshots...');
      loadMoreScreenshots();
    }
  }, [isLoadingMore, hasMoreFiles, loadMoreScreenshots]);

  return (
    <div 
      ref={containerRef}
      className="VirtualizedRecentPanel bg-white border-l border-gray-300 h-full flex flex-col overflow-hidden w-full" 
      tabIndex={0}
    >
      {/* Header */}
      <div className="bg-gray-100 border-b border-gray-300 px-3 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 text-sm">
            <button
              onClick={() => {
                setActiveView('RECENT');
                clearSelection();
              }}
              className={`pb-1 ${
                activeView === 'RECENT' 
                  ? 'text-blue-600 border-b-2 border-blue-600' 
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              RECENT
            </button>
            <button
              onClick={() => {
                setActiveView('LIBRARY');
                clearSelection();
              }}
              className={`pb-1 ${
                activeView === 'LIBRARY' 
                  ? 'text-blue-600 border-b-2 border-blue-600' 
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              LIBRARY
            </button>
            <button
              onClick={() => {
                setActiveView('ARCHIVED');
                clearSelection();
              }}
              className={`pb-1 ${
                activeView === 'ARCHIVED' 
                  ? 'text-blue-600 border-b-2 border-blue-600' 
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              ARCHIVED
            </button>
          </div>
          
          {/* Selection controls */}
          {selectedItems.size > 0 && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-gray-600">{selectedItems.size} selected</span>
              <button
                onClick={clearSelection}
                className="text-gray-500 hover:text-gray-700"
              >
                Clear
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Bulk Actions Toolbar */}
      {selectedItems.size > 0 && (
        <div className="bg-blue-50 border-b border-blue-200 px-3 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={selectAll}
              className="text-xs text-blue-600 hover:text-blue-800"
            >
              Select All ({items.length})
            </button>
          </div>
          
          <div className="flex items-center gap-2">
            {activeView === 'ARCHIVED' ? (
              <>
                <button
                  onClick={() => {
                    showConfirmation(createRestoreConfirmation(selectedItems.size, () => {
                      // TODO: Implement bulk restore
                      console.log('Bulk restore not implemented');
                    }));
                  }}
                  className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Restore ({selectedItems.size})
                </button>
                <button
                  onClick={() => {
                    showConfirmation(createDeleteConfirmation(selectedItems.size, () => deleteSelectedScreenshots(true), true));
                  }}
                  className="px-3 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
                >
                  Delete Permanently ({selectedItems.size})
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => {
                    showConfirmation(createArchiveConfirmation(selectedItems.size, () => archiveSelectedScreenshots()));
                  }}
                  className="px-3 py-1 text-xs bg-orange-600 text-white rounded hover:bg-orange-700"
                >
                  Archive ({selectedItems.size})
                </button>
                <button
                  onClick={() => {
                    showConfirmation(createDeleteConfirmation(selectedItems.size, () => deleteSelectedScreenshots(false), false));
                  }}
                  className="px-3 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
                >
                  Delete ({selectedItems.size})
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Search Panel */}
      <SearchPanel
        onSearch={handleSearch}
        onClear={handleClearSearch}
        availableTags={availableTags}
        isSearching={isSearching}
      />

      {/* Virtual List */}
      <div className="flex-1 relative overflow-hidden">
        {items.length > 0 ? (
          <List
            height={listHeight}
            width="100%"
            itemCount={items.length}
            itemSize={76} // Fixed height per item (48px thumbnail + 28px padding)
            itemData={itemData}
            onScroll={handleScroll}
            overscanCount={5} // Render a few extra items for smooth scrolling
            style={{ overflow: 'hidden' }}
          >
            {ItemRenderer}
          </List>
        ) : (
          <div className="p-8 text-center text-gray-500">
            {hasActiveSearch ? (
              <>
                <p>No results found</p>
                <p className="text-sm mt-1">Try adjusting your search terms or filters</p>
              </>
            ) : activeView === 'RECENT' ? (
              <>
                <p>No screenshots yet</p>
                <p className="text-sm mt-1">Capture your first screenshot to get started</p>
              </>
            ) : (
              <>
                <p>No tagged screenshots</p>
                <p className="text-sm mt-1">Use quick tags to organize your screenshots</p>
              </>
            )}
          </div>
        )}
        
        {/* Loading indicator */}
        {isLoadingMore && (
          <div className="absolute bottom-0 left-0 right-0 p-4 text-center text-gray-500 bg-white border-t border-gray-200">
            <div className="flex items-center justify-center gap-2">
              <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin"></div>
              <span className="text-sm">Loading more screenshots...</span>
            </div>
          </div>
        )}
        
        {/* End of list indicator */}
        {!hasMoreFiles && items.length > 0 && (
          <div className="absolute bottom-0 left-0 right-0 p-4 text-center text-gray-400 bg-white border-t border-gray-100">
            <span className="text-xs">No more screenshots to load</span>
          </div>
        )}
      </div>
      
      {/* Context Menu */}
      <ContextMenu
        x={contextMenu.x}
        y={contextMenu.y}
        items={contextMenu.items}
        onClose={hideContextMenu}
        visible={contextMenu.visible}
      />
      
      {/* Confirmation Dialog */}
      <ConfirmationDialog
        open={dialog.open}
        onClose={hideConfirmation}
        onConfirm={confirmAndClose}
        title={dialog.title}
        message={dialog.message}
        confirmText={dialog.confirmText}
        cancelText={dialog.cancelText}
        type={dialog.type}
        itemCount={dialog.itemCount}
        showCheckbox={dialog.showCheckbox}
        checkboxText={dialog.checkboxText}
        onCheckboxChange={dialog.onCheckboxChange}
      />
    </div>
  );
}