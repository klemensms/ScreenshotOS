import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { rendererSidecarManager, SidecarMetadata, SidecarAnnotation, SidecarData } from '../utils/renderer-sidecar';
import { debugLogger } from '../utils/debug-logger';

// Utility function to add timeout protection to IPC calls (optimized to prevent promise accumulation)
const ipcWithTimeout = async (channel: string, args: any, timeout: number = 10000): Promise<any> => {
  debugLogger.startOperation('IPC', `${channel}`, { timeout });
  
  // Use AbortController for cleaner timeout handling
  const controller = new AbortController();
  let timeoutId: NodeJS.Timeout | null = null;
  
  try {
    // Set up timeout that aborts the operation
    timeoutId = setTimeout(() => {
      controller.abort();
    }, timeout);
    
    // Execute IPC call with proper error handling
    const result = await window.electron.invoke(channel, args);
    
    // Clear timeout on success
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    
    debugLogger.endOperation('IPC', `${channel}`, { success: true });
    return result;
  } catch (error) {
    // Clear timeout on error
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    
    // Check if this was a timeout abortion
    if (controller.signal.aborted) {
      const timeoutError = new Error(`IPC timeout: ${channel} after ${timeout}ms`);
      debugLogger.error('IPC', `${channel}`, timeoutError);
      throw timeoutError;
    }
    
    debugLogger.error('IPC', `${channel}`, error);
    throw error;
  }
};

export interface Screenshot {
  id: string;
  name: string;
  base64Image: string;
  filePath: string;
  timestamp: Date;
  dimensions: {
    width: number;
    height: number;
  };
  tags: string[];
  notes?: string;
  ocrText?: string;
  ocrCompleted?: boolean;
  annotations?: Annotation[];
  hasSidecar?: boolean; // Track whether this screenshot has an associated sidecar file
  applicationInfo?: {
    name: string;
    bundleId?: string;
    version?: string;
    windowTitle?: string;
  };
  captureMethod?: 'fullscreen' | 'area' | 'window';
}

export interface Annotation {
  id: string;
  type: 'arrow' | 'rectangle' | 'text' | 'numbering' | 'blur';
  color: string;
  position: {
    x: number;
    y: number;
    width?: number;
    height?: number;
  };
  text?: string;
  number?: number;
  blurIntensity?: number;
}

export interface DrawingState {
  isDrawing: boolean;
  selectedTool: 'select' | 'arrow' | 'rectangle' | 'text' | 'numbering' | 'blur';
  selectedColor: string;
  blurIntensity: number;
  numberingCounter: number;
  currentAnnotation: Annotation | null;
  selectedAnnotations: string[];
  isDragging: boolean;
  dragStartPoint: { x: number; y: number } | null;
  isResizing: boolean;
  resizeHandle: string | null;
}

interface AppContextType {
  screenshots: Screenshot[];
  currentScreenshot: Screenshot | null;
  isCapturing: boolean;
  isLoadingMore: boolean;
  hasMoreFiles: boolean;
  drawingState: DrawingState;
  setCurrentScreenshot: (screenshot: Screenshot | null) => void;
  addScreenshot: (screenshot: Screenshot) => void;
  loadMoreScreenshots: () => Promise<void>;
  captureFullScreen: () => Promise<void>;
  captureArea: () => Promise<void>;
  copyCurrentScreenshot: () => Promise<void>;
  updateDrawingState: (updates: Partial<DrawingState>) => void;
  addAnnotation: (annotation: Annotation) => void;
  updateScreenshotTags: (screenshotId: string, tags: string[]) => void;
  updateScreenshotNotes: (screenshotId: string, notes: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}

interface AppProviderProps {
  children: ReactNode;
}

// Constants for file loading
const MAX_FILE_SIZE_MB = 50; // Maximum file size in MB to load
const IMAGE_LOAD_TIMEOUT_MS = 15000; // Timeout for loading individual images

/**
 * Parse timestamp from screenshot filename patterns
 * Supports formats like: screenshot_2025-06-30-16-04-15.png
 */
function parseTimestampFromFilename(filePath: string): Date | null {
  try {
    const filename = filePath.split('/').pop() || '';
    
    // Match pattern: screenshot_YYYY-MM-DD-HH-MM-SS.png (with dashes between time components)
    const timestampMatch = filename.match(/screenshot_(\d{4})-(\d{2})-(\d{2})-(\d{2})-(\d{2})-(\d{2})/);
    
    if (timestampMatch) {
      const [, year, month, day, hour, minute, second] = timestampMatch;
      // Note: month is 0-indexed in JavaScript Date constructor
      const timestamp = new Date(
        parseInt(year),
        parseInt(month) - 1,
        parseInt(day),
        parseInt(hour),
        parseInt(minute),
        parseInt(second)
      );
      
      // Validate the parsed date
      if (!isNaN(timestamp.getTime())) {
        console.log(`📅 [TIMESTAMP] Parsed from filename ${filename}:`, timestamp.toLocaleString());
        return timestamp;
      }
    }
    
    // Try alternative pattern: screenshot_YYYY-MM-DD_HH-MM-SS.png (underscore between date and time)
    const altMatch1 = filename.match(/screenshot_(\d{4})-(\d{2})-(\d{2})_(\d{2})-(\d{2})-(\d{2})/);
    if (altMatch1) {
      const [, year, month, day, hour, minute, second] = altMatch1;
      const timestamp = new Date(
        parseInt(year),
        parseInt(month) - 1,
        parseInt(day),
        parseInt(hour),
        parseInt(minute),
        parseInt(second)
      );
      
      if (!isNaN(timestamp.getTime())) {
        console.log(`📅 [TIMESTAMP] Parsed from alt pattern 1 ${filename}:`, timestamp.toLocaleString());
        return timestamp;
      }
    }
    
    // Try more alternative patterns if needed (e.g., different separators)
    const altMatch2 = filename.match(/(\d{4})-(\d{2})-(\d{2})[_\s](\d{2})[.-](\d{2})[.-](\d{2})/);
    if (altMatch2) {
      const [, year, month, day, hour, minute, second] = altMatch2;
      const timestamp = new Date(
        parseInt(year),
        parseInt(month) - 1,
        parseInt(day),
        parseInt(hour),
        parseInt(minute),
        parseInt(second)
      );
      
      if (!isNaN(timestamp.getTime())) {
        console.log(`📅 [TIMESTAMP] Parsed from alt pattern 2 ${filename}:`, timestamp.toLocaleString());
        return timestamp;
      }
    }
    
    console.log(`⚠️ [TIMESTAMP] Could not parse timestamp from filename: ${filename}`);
    return null;
  } catch (error) {
    console.error('❌ [TIMESTAMP] Error parsing timestamp from filename:', error);
    return null;
  }
}

/**
 * Create a basic screenshot object for images without sidecar files
 */
function createBasicScreenshot(imagePath: string, base64Image: string, index: number, fileStats?: any, dimensions?: { width: number; height: number }): Screenshot {
  const filename = imagePath.split('/').pop() || 'Unknown';
  
  // Smart timestamp detection - priority order:
  // 1. Parse from filename pattern
  // 2. Use file creation time (birthtime)
  // 3. Use file modification time (mtime)
  // 4. Current time as last resort
  let timestamp = parseTimestampFromFilename(imagePath);
  
  if (!timestamp && fileStats) {
    if (fileStats.created) {
      timestamp = new Date(fileStats.created);
      console.log(`📅 [TIMESTAMP] Using file birthtime for ${filename}:`, timestamp.toLocaleString());
    } else if (fileStats.birthtime) {
      timestamp = new Date(fileStats.birthtime);
      console.log(`📅 [TIMESTAMP] Using file birthtime for ${filename}:`, timestamp.toLocaleString());
    } else if (fileStats.mtime || fileStats.modified) {
      timestamp = new Date(fileStats.mtime || fileStats.modified);
      console.log(`📅 [TIMESTAMP] Using file mtime for ${filename}:`, timestamp.toLocaleString());
    }
  }
  
  if (!timestamp) {
    timestamp = new Date();
    console.log(`⚠️ [TIMESTAMP] Using current time as fallback for ${filename}:`, timestamp.toLocaleString());
  }
  
  return {
    id: `basic-${Date.now()}-${Math.random()}-${index}`,
    name: filename,
    base64Image,
    filePath: imagePath,
    timestamp,
    dimensions: {
      width: dimensions?.width || 1920, // Use actual dimensions if provided, else default
      height: dimensions?.height || 1080
    },
    tags: [],
    notes: '',
    ocrText: '',
    ocrCompleted: false,
    annotations: [],
    hasSidecar: false // No sidecar file initially
  };
}

export function AppProvider({ children }: AppProviderProps) {
  const [screenshots, setScreenshots] = useState<Screenshot[]>([]);
  const [currentScreenshot, setCurrentScreenshot] = useState<Screenshot | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMoreFiles, setHasMoreFiles] = useState(true);
  const [loadedFileOffset, setLoadedFileOffset] = useState(0);
  const [allAvailableFiles, setAllAvailableFiles] = useState<Array<{imagePath: string, sidecarPath: string, hasSidecar: boolean, fileSize: number, fileStats: any}>>([]);
  const [shouldAutoLoadMore, setShouldAutoLoadMore] = useState(false);
  const [drawingState, setDrawingState] = useState<DrawingState>({
    isDrawing: false,
    selectedTool: 'arrow',
    selectedColor: '#dc2626',
    blurIntensity: 10,
    numberingCounter: 1,
    currentAnnotation: null,
    selectedAnnotations: [],
    isDragging: false,
    dragStartPoint: null,
    isResizing: false,
    resizeHandle: null
  });
  
  // Refs to track timeouts for proper cleanup
  const loadingTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = React.useRef<AbortController | null>(null);

  // Debug: Monitor state changes
  React.useEffect(() => {
    debugLogger.log('AppContext', 'state: screenshots', `Updated: ${screenshots.length} items`);
    console.log(`📊 [STATE_MONITOR] Screenshots array updated: ${screenshots.length} items`);
  }, [screenshots]);

  React.useEffect(() => {
    debugLogger.log('AppContext', 'state: currentScreenshot', currentScreenshot ? currentScreenshot.name : 'null');
    console.log(`📊 [STATE_MONITOR] Current screenshot updated:`, currentScreenshot ? currentScreenshot.name : 'null');
  }, [currentScreenshot]);

  React.useEffect(() => {
    debugLogger.log('AppContext', 'state: drawingState', drawingState);
  }, [drawingState]);

  // Cleanup effect to prevent timer leaks on unmount
  useEffect(() => {
    return () => {
      // Clear any pending timeouts
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
        loadingTimeoutRef.current = null;
      }
      
      // Abort any ongoing operations
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      
      console.log('🧹 [APP_CONTEXT] Cleanup: cleared all timeouts and aborted operations');
    };
  }, []);

  // Handle auto-loading more screenshots when needed
  useEffect(() => {
    if (shouldAutoLoadMore && !isLoadingMore && hasMoreFiles) {
      console.log('🔄 [AUTO_LOAD] Auto-loading more screenshots due to newer files detected...');
      setShouldAutoLoadMore(false); // Reset flag
      loadMoreScreenshots();
    }
  }, [shouldAutoLoadMore, isLoadingMore, hasMoreFiles]);

  // Load existing screenshots on app startup
  useEffect(() => {
    debugLogger.log('AppContext', 'useEffect: startup', 'Starting loadExistingScreenshots');
    console.log('🚀 [APP_CONTEXT] useEffect triggered - starting loadExistingScreenshots');
    loadExistingScreenshots();
    
    // Listen for new screenshots created by shortcuts
    const handleNewScreenshot = async (data: any) => {
      debugLogger.startOperation('AppContext', 'handleNewScreenshot', data);
      try {
        console.log('📨 [IPC] New screenshot created via shortcut:', data);
        
        if (!data || !data.filePath) {
          console.error('❌ [IPC] Invalid screenshot data received:', data);
          return;
        }
        
        // Load the image data with enhanced error handling
        console.log('📨 [IPC] Loading image data for new screenshot:', data.filePath);
        const imageData = await ipcWithTimeout('read-image-file', data.filePath, 8000);
        
        if (imageData && imageData.success && imageData.base64) {
          console.log('✅ [IPC] Image data loaded successfully for shortcut screenshot');
          const newScreenshot: Screenshot = {
            id: `shortcut-${Date.now()}-${Math.random()}`,
            name: `Screenshot ${new Date().toLocaleString()}`,
            base64Image: imageData.base64,
            filePath: data.filePath,
            timestamp: new Date(),
            dimensions: {
              width: data.area?.width || data.metadata.screenInfo?.resolution?.width || 1920,
              height: data.area?.height || data.metadata.screenInfo?.resolution?.height || 1080
            },
            tags: [],
            notes: '',
            ocrText: '',
            annotations: [],
            applicationInfo: data.metadata?.applicationInfo,
            captureMethod: data.metadata?.captureMethod
          };
          
          // Add to screenshots list and set as current
          console.log('🔄 [IPC] Adding new screenshot to state:', newScreenshot.name);
          setScreenshots(prev => {
            const updated = [newScreenshot, ...prev];
            // Sort by timestamp (newest first) to maintain chronological order
            updated.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
            console.log('🔄 [IPC] Screenshots after adding new one (newest first):', updated.slice(0, 3).map(s => s.name));
            return updated;
          });
          setCurrentScreenshot(newScreenshot);
          
          console.log('✅ [IPC] New screenshot added to UI successfully:', newScreenshot.name);
        } else {
          console.error('❌ [IPC] Failed to load image data for shortcut screenshot:', imageData);
        }
      } catch (error) {
        console.error('❌ [IPC] Critical error handling new screenshot:', error);
        console.error('❌ [IPC] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      }
    };
    
    // Set up listener for new screenshots
    debugLogger.log('AppContext', 'addEventListener', 'onNewScreenshot');
    window.electron.onNewScreenshot(handleNewScreenshot);
    
    // Set up listener for OCR completion events
    const handleOCRCompleted = async (data: { imagePath: string; ocrText: string; ocrCompleted: boolean }) => {
      try {
        console.log('📨 [OCR] OCR completed event received:', data);
        
        // Update screenshots array with new OCR data
        setScreenshots(prev => {
          return prev.map(screenshot => {
            if (screenshot.filePath === data.imagePath) {
              console.log(`🔄 [OCR] Updating screenshot with OCR text: ${data.imagePath}`);
              return {
                ...screenshot,
                ocrText: data.ocrText,
                ocrCompleted: data.ocrCompleted
              };
            }
            return screenshot;
          });
        });
        
        // Update current screenshot if it matches
        setCurrentScreenshot(prev => {
          if (prev && prev.filePath === data.imagePath) {
            console.log(`🔄 [OCR] Updating current screenshot with OCR text: ${data.imagePath}`);
            return {
              ...prev,
              ocrText: data.ocrText,
              ocrCompleted: data.ocrCompleted
            };
          }
          return prev;
        });
        
        console.log('✅ [OCR] Screenshot updated with OCR data successfully');
      } catch (error) {
        console.error('❌ [OCR] Error handling OCR completion event:', error);
      }
    };
    
    debugLogger.log('AppContext', 'addEventListener', 'onOCRCompleted');
    window.electron.onOCRCompleted(handleOCRCompleted);
    
    // Cleanup listeners on unmount
    return () => {
      debugLogger.log('AppContext', 'removeEventListener', 'cleanup listeners');
      window.electron.removeNewScreenshotListener(handleNewScreenshot);
      window.electron.removeOCRCompletedListener(handleOCRCompleted);
      console.log('🧹 [APP_CONTEXT] Cleaning up useEffect - removed all listeners');
    };
  }, []);

  const loadExistingScreenshots = async () => {
    try {
      console.log('🔄 [LOADING] Starting screenshot loading process...');
      console.log('🔄 [LOADING] Memory usage at start:', 
        performance.memory ? `${Math.round(performance.memory.usedJSHeapSize / 1024 / 1024)}MB` : 'N/A');
      
      const startTime = performance.now();
      
      // Load the current save directory from storage config - no hardcoded fallback
      const config = await ipcWithTimeout('load-storage-config', undefined, 5000);
      
      if (!config?.saveDirectory) {
        console.error('❌ [LOADING] No save directory configured in storage config');
        throw new Error('Save directory not configured. Please set a save directory in settings.');
      }
      
      const saveDirectory = config.saveDirectory;
      
      // Add timeout to entire loading process to prevent hanging (stored in ref for cleanup)
      loadingTimeoutRef.current = setTimeout(() => {
        console.warn('⚠️ [LOADING] Loading process is taking longer than expected (30s)');
      }, 30000);
      
      console.log('🔄 [LOADING] Scanning directory from config:', saveDirectory);
      const result = await rendererSidecarManager.scanDirectory(saveDirectory);
      
      if (result.success && result.imageFiles) {
        // Pre-filter files by size to prevent memory overload
        const MAX_FILES_TO_LOAD = 50; // Initial load of 50 files to ensure we get the most recent ones
        
        const loadedScreenshots: Screenshot[] = [];
        
        console.log(`🔄 [LOADING] Found ${result.imageFiles.length} total images, checking file sizes...`);
        
        // Check file sizes before attempting to load
        const validFiles: Array<{imagePath: string, sidecarPath: string, hasSidecar: boolean, fileSize: number, fileStats: any}> = [];
        const rejectedFiles: Array<{imagePath: string, fileSize: number, reason: string}> = [];
        
        for (const imageFile of result.imageFiles) {
          try {
            // Get file size and metadata before attempting to load
            const fileStat = await ipcWithTimeout('file-stats', imageFile.imagePath, 3000);
            if (fileStat && fileStat.success) {
              const fileSizeMB = fileStat.size / (1024 * 1024);
              
              if (fileSizeMB <= MAX_FILE_SIZE_MB) {
                validFiles.push({
                  ...imageFile,
                  fileSize: fileSizeMB,
                  fileStats: fileStat // Store full file stats for timestamp extraction
                });
                console.log(`✅ [FILTER] File accepted: ${imageFile.imagePath.split('/').pop()} (${fileSizeMB.toFixed(1)}MB)`);
              } else {
                rejectedFiles.push({
                  imagePath: imageFile.imagePath,
                  fileSize: fileSizeMB,
                  reason: 'File too large'
                });
                console.warn(`🚫 [FILTER] File rejected: ${imageFile.imagePath.split('/').pop()} (${fileSizeMB.toFixed(1)}MB > ${MAX_FILE_SIZE_MB}MB)`);
              }
            } else {
              rejectedFiles.push({
                imagePath: imageFile.imagePath,
                fileSize: 0,
                reason: 'Cannot get file stats'
              });
              console.warn(`🚫 [FILTER] File rejected: ${imageFile.imagePath.split('/').pop()} (cannot get file stats)`);
            }
          } catch (error) {
            rejectedFiles.push({
              imagePath: imageFile.imagePath,
              fileSize: 0,
              reason: 'Error checking file'
            });
            console.error(`❌ [FILTER] Error checking file: ${imageFile.imagePath}`, error);
          }
        }
        
        // Sort valid files by file creation time (newest first) to load recent files first
        validFiles.sort((a, b) => {
          // Use birthtime/created time from fileStats if available
          const timeA = a.fileStats?.birthtime ? new Date(a.fileStats.birthtime).getTime() : 
                        a.fileStats?.created ? new Date(a.fileStats.created).getTime() : 0;
          const timeB = b.fileStats?.birthtime ? new Date(b.fileStats.birthtime).getTime() : 
                        b.fileStats?.created ? new Date(b.fileStats.created).getTime() : 0;
          return timeB - timeA; // Newest first
        });
        
        // Limit to maximum number of files
        const filesToLoad = validFiles.slice(0, MAX_FILES_TO_LOAD);
        const deferredFiles = validFiles.slice(MAX_FILES_TO_LOAD);
        
        const totalImagesWithSidecars = filesToLoad.filter(item => item.hasSidecar).length;
        const totalImagesWithoutSidecars = filesToLoad.length - totalImagesWithSidecars;
        
        console.log(`🔄 [LOADING] File filtering results:`);
        console.log(`    - ${result.imageFiles.length} total image files found`);
        console.log(`    - ${validFiles.length} files passed size filter (≤${MAX_FILE_SIZE_MB}MB)`);
        console.log(`    - ${rejectedFiles.length} files rejected (too large or errors)`);
        console.log(`    - ${filesToLoad.length} files loading immediately (smallest files first)`);
        console.log(`    - ${deferredFiles.length} files deferred for infinite scroll`);
        console.log(`    - ${totalImagesWithSidecars} with sidecar files`);
        console.log(`    - ${totalImagesWithoutSidecars} without sidecar files`);
        
        // Log details of rejected files for debugging
        if (rejectedFiles.length > 0) {
          console.warn(`⚠️ [LOADING] ${rejectedFiles.length} files were rejected:`);
          rejectedFiles.slice(0, 10).forEach((rejected, idx) => {
            const filename = rejected.imagePath.split('/').pop();
            console.warn(`    ${idx + 1}. ${filename}: ${rejected.reason} (${rejected.fileSize.toFixed(1)}MB)`);
          });
          if (rejectedFiles.length > 10) {
            console.warn(`    ... and ${rejectedFiles.length - 10} more files`);
          }
        }
        
        // Process files with async batching to prevent blocking
        const processImage = async (imageFileInfo: any, index: number, abortSignal: AbortSignal, retryCount = 0): Promise<Screenshot | null> => {
          if (abortSignal.aborted) {
            throw new Error('Processing aborted');
          }
          
          const MAX_RETRIES = 2;
          const filename = imageFileInfo.imagePath.split('/').pop();
          
          try {
            console.log(`🔄 [LOADING] Processing image ${index + 1}/${filesToLoad.length}: ${filename} (${imageFileInfo.fileSize.toFixed(1)}MB)${retryCount > 0 ? ` - Retry ${retryCount}/${MAX_RETRIES}` : ''}`);
            
            // Load image data with timeout and retry logic
            let imageData;
            try {
              // Reduce timeout for smaller files, increase for larger
              const timeoutMs = Math.min(IMAGE_LOAD_TIMEOUT_MS, Math.max(5000, imageFileInfo.fileSize * 1000)); // 1s per MB, min 5s, max 15s
              
              imageData = await Promise.race([
                window.electron.invoke('read-image-file', imageFileInfo.imagePath),
                new Promise((_, reject) => 
                  setTimeout(() => reject(new Error(`Image loading timeout (${timeoutMs / 1000}s)`)), timeoutMs)
                )
              ]);
            } catch (timeoutError) {
              console.error(`⏱️ [LOADING] Timeout loading: ${filename} (${imageFileInfo.fileSize.toFixed(1)}MB) - ${timeoutError.message}`);
              
              // Retry logic
              if (retryCount < MAX_RETRIES) {
                console.log(`🔄 [LOADING] Retrying ${filename}...`);
                await new Promise(resolve => setTimeout(resolve, 500)); // Brief pause before retry
                return processImage(imageFileInfo, index, abortSignal, retryCount + 1);
              }
              
              console.error(`❌ [LOADING] Failed after ${MAX_RETRIES} retries: ${filename}`);
              return null;
            }
            
            if (!imageData?.success || !imageData.base64) {
              console.warn(`⚠️ [LOADING] Invalid image data for:`, imageFileInfo.imagePath);
              return null;
            }
            
            const base64SizeKB = Math.round(imageData.base64.length / 1024);
            console.log(`✅ [LOADING] Image data loaded, base64 size: ${base64SizeKB}KB`);
            
            let screenshot: Screenshot;
            
            if (imageFileInfo.hasSidecar) {
              // Load sidecar data
              const sidecarResult = await rendererSidecarManager.loadSidecarFileFromPath(imageFileInfo.sidecarPath);
              
              if (sidecarResult.success && sidecarResult.data) {
                const sidecarData = sidecarResult.data;
                screenshot = {
                  id: `loaded-${Date.now()}-${Math.random()}-${index}`,
                  name: `Screenshot ${new Date(sidecarData.createdAt).toLocaleString()}`,
                  base64Image: imageData.base64,
                  filePath: imageFileInfo.imagePath,
                  timestamp: new Date(sidecarData.createdAt),
                  dimensions: {
                    width: sidecarData.metadata.screenInfo?.resolution?.width || 1920,
                    height: sidecarData.metadata.screenInfo?.resolution?.height || 1080
                  },
                  tags: sidecarData.tags || [],
                  notes: sidecarData.notes || '',
                  ocrText: sidecarData.ocrText || '',
                  ocrCompleted: sidecarData.ocrCompleted || false,
                  annotations: sidecarData.annotations?.map(ann => ({
                    id: ann.id,
                    type: ann.type,
                    color: ann.color,
                    position: ann.position,
                    text: ann.text,
                    number: ann.number,
                    blurIntensity: ann.blurIntensity
                  })) || [],
                  hasSidecar: true,
                  applicationInfo: sidecarData.metadata.applicationInfo,
                  captureMethod: sidecarData.metadata.captureMethod
                };
              } else {
                screenshot = createBasicScreenshot(imageFileInfo.imagePath, imageData.base64, index, imageFileInfo.fileStats, imageData.dimensions);
              }
            } else {
              screenshot = createBasicScreenshot(imageFileInfo.imagePath, imageData.base64, index, imageFileInfo.fileStats, imageData.dimensions);
            }
            
            console.log(`✅ [LOADING] Successfully created screenshot object ${index + 1}:`, screenshot.name);
            return screenshot;
            
          } catch (error) {
            console.error(`❌ [LOADING] Error processing file ${index + 1}:`, imageFileInfo.imagePath, error);
            return null;
          }
        };
        
        // Process files in batches of 1 for more reliable loading
        const BATCH_SIZE = 1; // Reduced from 2 to prevent timeouts
        const abortController = new AbortController();
        
        // Simple memory check before starting
        if (performance.memory) {
          const memoryMB = Math.round(performance.memory.usedJSHeapSize / 1024 / 1024);
          console.log(`🔄 [LOADING] Initial memory usage: ${memoryMB}MB`);
          if (memoryMB > 200) {
            console.warn(`⚠️ [LOADING] High memory usage detected (${memoryMB}MB), reducing batch size`);
          }
        }
        
        try {
          for (let i = 0; i < filesToLoad.length; i += BATCH_SIZE) {
            const batch = filesToLoad.slice(i, i + BATCH_SIZE);
            const batchPromises = batch.map((imageFileInfo, batchIndex) => 
              processImage(imageFileInfo, i + batchIndex, abortController.signal, 0)
            );
            
            const batchResults = await Promise.allSettled(batchPromises);
            
            // Collect successful results
            for (const result of batchResults) {
              if (result.status === 'fulfilled' && result.value) {
                loadedScreenshots.push(result.value);
              }
            }
            
            // Brief pause between batches to allow UI updates
            if (i + BATCH_SIZE < filesToLoad.length) {
              await new Promise(resolve => setTimeout(resolve, 50));
            }
          }
        } catch (error) {
          console.error(`❌ [LOADING] Batch processing error:`, error);
          abortController.abort();
        }
        
        // Summary of loading results
        const failedToLoad = filesToLoad.length - loadedScreenshots.length;
        console.log(`🔄 [LOADING] Loading results summary:`);
        console.log(`    - ${loadedScreenshots.length}/${filesToLoad.length} files loaded successfully`);
        if (failedToLoad > 0) {
          console.warn(`    - ${failedToLoad} files failed to load (timeouts, read errors, or invalid data)`);
          console.warn(`    - Consider checking file permissions, disk space, or reducing file sizes`);
        }
        
        // Log specific details about loaded files
        if (loadedScreenshots.length > 0) {
          console.log(`✅ [LOADING] Successfully loaded files:`);
          loadedScreenshots.slice(0, 5).forEach((screenshot, idx) => {
            console.log(`    ${idx + 1}. ${screenshot.name} - ${screenshot.filePath.split('/').pop()}`);
          });
          if (loadedScreenshots.length > 5) {
            console.log(`    ... and ${loadedScreenshots.length - 5} more files`);
          }
        }
        
        // Final memory check
        if (performance.memory) {
          const finalMemory = Math.round(performance.memory.usedJSHeapSize / 1024 / 1024);
          console.log(`    - Final memory usage: ${finalMemory}MB`);
        }
        
        // Sort by timestamp (newest first) - ensure consistent ordering
        loadedScreenshots.sort((a, b) => {
          // For consistent ordering, use timestamp which comes from filename or file creation time
          return b.timestamp.getTime() - a.timestamp.getTime();
        });
        
        // Debug: Log the first few screenshots after sorting to verify order
        if (loadedScreenshots.length > 0) {
          console.log(`🔄 [LOADING] Screenshots after sorting (newest first):`);
          loadedScreenshots.slice(0, 5).forEach((screenshot, idx) => {
            console.log(`    ${idx + 1}. ${screenshot.name} - ${screenshot.timestamp.toLocaleString()} - ${screenshot.filePath.split('/').pop()}`);
          });
        }
        
        console.log(`🔄 [LOADING] Setting ${loadedScreenshots.length} screenshots in state...`);
        
        // Store valid files for infinite scroll and set up offset tracking
        setAllAvailableFiles(validFiles); // Store filtered valid files, not raw files
        const actualFilesToLoad = Math.min(filesToLoad.length, MAX_FILES_TO_LOAD);
        const hasMore = validFiles.length > actualFilesToLoad;
        setHasMoreFiles(hasMore);
        setLoadedFileOffset(actualFilesToLoad); // Track how many files we've actually loaded
        
        console.log(`🔄 [LOADING] Infinite scroll setup:`);
        console.log(`    - Total valid files: ${validFiles.length}`);
        console.log(`    - Files loaded this batch: ${actualFilesToLoad}`);
        console.log(`    - Has more files for infinite scroll: ${hasMore}`);
        
        setScreenshots(loadedScreenshots);
        
        if (loadedScreenshots.length > 0) {
          console.log(`🔄 [LOADING] Setting current screenshot to most recent:`, loadedScreenshots[0].name, loadedScreenshots[0].timestamp.toLocaleString());
          setCurrentScreenshot(loadedScreenshots[0]);
          
          // If there are more files available and we might have newer ones, trigger immediate load
          if (hasMore && validFiles.length > actualFilesToLoad) {
            console.log(`🔄 [LOADING] More files available, checking if we need to load newer screenshots...`);
            // Check if the deferred files might contain newer screenshots
            const oldestLoadedTime = loadedScreenshots[loadedScreenshots.length - 1].timestamp.getTime();
            const hasNewerDeferred = deferredFiles.some(file => {
              const fileTime = file.fileStats?.birthtime ? new Date(file.fileStats.birthtime).getTime() : 
                             file.fileStats?.created ? new Date(file.fileStats.created).getTime() : 0;
              return fileTime > oldestLoadedTime;
            });
            
            if (hasNewerDeferred) {
              console.log(`🔄 [LOADING] Detected potentially newer screenshots in deferred files, will load them...`);
              // Set flag to auto-load more files after initial render
              setShouldAutoLoadMore(true);
            }
          }
        } else {
          console.warn(`⚠️ [LOADING] No screenshots loaded - array is empty`);
        }
        
        const endTime = performance.now();
        const loadTime = Math.round(endTime - startTime);
        
        // Clear the loading timeout since we completed successfully
        if (loadingTimeoutRef.current) {
          clearTimeout(loadingTimeoutRef.current);
          loadingTimeoutRef.current = null;
        }
        
        console.log(`✅ [LOADING] Successfully loaded ${loadedScreenshots.length} screenshots in ${loadTime}ms`);
        console.log('✅ [LOADING] Final memory usage:', 
          performance.memory ? `${Math.round(performance.memory.usedJSHeapSize / 1024 / 1024)}MB` : 'N/A');
        
        // Additional summary if there were issues
        if (rejectedFiles.length > 0 || failedToLoad > 0) {
          const totalSkipped = rejectedFiles.length + failedToLoad;
          console.warn(`📊 [LOADING] Summary: ${totalSkipped} total files skipped (${rejectedFiles.length} rejected by filter, ${failedToLoad} failed to load)`);
        }
      } else {
        console.log('ℹ️ [LOADING] No images found or scan failed');
        // Clear timeout even if no images found
        if (loadingTimeoutRef.current) {
          clearTimeout(loadingTimeoutRef.current);
          loadingTimeoutRef.current = null;
        }
      }
    } catch (error) {
      // Clear timeout in error cases to prevent memory leaks
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
        loadingTimeoutRef.current = null;
      }
      console.error('❌ [LOADING] Critical error in loadExistingScreenshots:', error);
      console.error('❌ [LOADING] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    }
  };

  const loadMoreScreenshots = async () => {
    console.log(`📜 [LOAD_MORE] loadMoreScreenshots called - isLoadingMore: ${isLoadingMore}, hasMoreFiles: ${hasMoreFiles}, offset: ${loadedFileOffset}`);
    
    if (isLoadingMore || !hasMoreFiles) {
      console.log(`⚠️ [LOAD_MORE] Skipping - already loading: ${isLoadingMore}, no more files: ${!hasMoreFiles}`);
      return; // Prevent multiple simultaneous loads or loading when no more files
    }

    setIsLoadingMore(true);
    
    try {
      console.log(`🔄 [LOAD_MORE] Loading more screenshots starting from offset ${loadedFileOffset}`);
      console.log(`🔄 [LOAD_MORE] Total available files: ${allAvailableFiles.length}`);
      
      const BATCH_SIZE = 30; // Load 30 at a time for faster loading
      
      // Get the next batch of files (already filtered from initial load)
      const nextBatch = allAvailableFiles.slice(loadedFileOffset, loadedFileOffset + BATCH_SIZE);
      
      console.log(`🔄 [LOAD_MORE] Getting files from offset ${loadedFileOffset}, batch size ${BATCH_SIZE}`);
      console.log(`🔄 [LOAD_MORE] Next batch contains ${nextBatch.length} files`);
      
      if (nextBatch.length === 0) {
        console.log(`ℹ️ [LOAD_MORE] No more files to load - reached end of list`);
        setHasMoreFiles(false);
        setIsLoadingMore(false);
        return;
      }
      
      // Load the files (no need to re-filter, they're already validated)
      const newScreenshots: Screenshot[] = [];
      
      // Process each file with retry logic
      for (let index = 0; index < nextBatch.length; index++) {
        const imageFileInfo = nextBatch[index];
        const MAX_RETRIES = 2;
        let success = false;
        
        for (let retryCount = 0; retryCount <= MAX_RETRIES && !success; retryCount++) {
          const filename = imageFileInfo.imagePath.split('/').pop();
          
          try {
            console.log(`🔄 [LOAD_MORE] Processing image ${index + 1}/${nextBatch.length}: ${filename}${retryCount > 0 ? ` - Retry ${retryCount}/${MAX_RETRIES}` : ''}`);
            
            // Load image data with dynamic timeout based on file size
            const timeoutMs = Math.min(IMAGE_LOAD_TIMEOUT_MS, Math.max(5000, imageFileInfo.fileSize * 1000));
            const imageData = await ipcWithTimeout('read-image-file', imageFileInfo.imagePath, timeoutMs);
            
            if (!imageData || !imageData.success || !imageData.base64) {
              console.warn(`⚠️ [LOAD_MORE] Invalid image data for: ${filename}`);
              if (retryCount < MAX_RETRIES) {
                await new Promise(resolve => setTimeout(resolve, 500)); // Brief pause before retry
                continue;
              }
              break;
            }
            
            let screenshot: Screenshot;
            
            if (imageFileInfo.hasSidecar) {
              // Load sidecar data
              const sidecarResult = await rendererSidecarManager.loadSidecarFileFromPath(imageFileInfo.sidecarPath);
              
              if (sidecarResult.success && sidecarResult.data) {
                const sidecarData = sidecarResult.data;
                screenshot = {
                  id: `loaded-more-${Date.now()}-${Math.random()}-${index}`,
                  name: `Screenshot ${new Date(sidecarData.createdAt).toLocaleString()}`,
                  base64Image: imageData.base64,
                  filePath: imageFileInfo.imagePath,
                  timestamp: new Date(sidecarData.createdAt),
                  dimensions: {
                    width: sidecarData.metadata.screenInfo?.resolution?.width || 1920,
                    height: sidecarData.metadata.screenInfo?.resolution?.height || 1080
                  },
                  tags: sidecarData.tags || [],
                  notes: sidecarData.notes || '',
                  ocrText: sidecarData.ocrText || '',
                  ocrCompleted: sidecarData.ocrCompleted || false,
                  annotations: sidecarData.annotations?.map(ann => ({
                    id: ann.id,
                    type: ann.type,
                    color: ann.color,
                    position: ann.position,
                    text: ann.text,
                    number: ann.number,
                    blurIntensity: ann.blurIntensity
                  })) || [],
                  hasSidecar: true,
                  applicationInfo: sidecarData.metadata.applicationInfo,
                  captureMethod: sidecarData.metadata.captureMethod
                };
              } else {
                screenshot = createBasicScreenshot(imageFileInfo.imagePath, imageData.base64, index, imageFileInfo.fileStats, imageData.dimensions);
              }
            } else {
              screenshot = createBasicScreenshot(imageFileInfo.imagePath, imageData.base64, index, imageFileInfo.fileStats, imageData.dimensions);
            }
            
            newScreenshots.push(screenshot);
            success = true;
          } catch (error) {
            console.error(`❌ [LOAD_MORE] Error processing file ${filename}:`, error);
            if (retryCount < MAX_RETRIES) {
              console.log(`🔄 [LOAD_MORE] Will retry ${filename}...`);
              await new Promise(resolve => setTimeout(resolve, 500));
            }
          }
        }
        
        if (!success) {
          console.error(`❌ [LOAD_MORE] Failed to load file after ${MAX_RETRIES} retries: ${imageFileInfo.imagePath.split('/').pop()}`);
        }
      }
      
      if (newScreenshots.length > 0) {
        // Merge new screenshots with existing ones and maintain sort order (newest first)
        setScreenshots(prev => {
          const combined = [...prev, ...newScreenshots];
          // Sort by timestamp (newest first) to maintain chronological order
          combined.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
          console.log(`📜 [LOAD_MORE] After merging and sorting, newest screenshots:`, combined.slice(0, 3).map(s => `${s.name} - ${s.timestamp.toLocaleString()}`));
          
          // Check if we need to update the current screenshot to the newest one
          if (combined.length > 0) {
            const newestScreenshot = combined[0];
            setCurrentScreenshot(current => {
              if (!current || newestScreenshot.timestamp.getTime() > current.timestamp.getTime()) {
                console.log(`📜 [LOAD_MORE] Updating current screenshot to newer one:`, newestScreenshot.name, newestScreenshot.timestamp.toLocaleString());
                return newestScreenshot;
              }
              return current;
            });
          }
          
          return combined;
        });
        setLoadedFileOffset(prev => prev + nextBatch.length);
        
        console.log(`✅ [LOAD_MORE] Loaded ${newScreenshots.length} additional screenshots`);
      }
      
      // Log summary of what was loaded
      const failedToLoad = nextBatch.length - newScreenshots.length;
      if (failedToLoad > 0) {
        console.warn(`⚠️ [LOAD_MORE] ${failedToLoad} files failed to load from batch`);
      }
      
      // Check if there are more files to load
      if (loadedFileOffset + nextBatch.length >= allAvailableFiles.length) {
        setHasMoreFiles(false);
        console.log(`ℹ️ [LOAD_MORE] No more files to load`);
      } else {
        // Check if we should continue auto-loading for even newer files
        const remainingFiles = allAvailableFiles.slice(loadedFileOffset + nextBatch.length);
        const hasEvenNewer = remainingFiles.some(file => {
          const fileTime = file.fileStats?.birthtime ? new Date(file.fileStats.birthtime).getTime() : 
                         file.fileStats?.created ? new Date(file.fileStats.created).getTime() : 0;
          // Check against the oldest loaded time to see if any remaining are newer
          const oldestLoadedTime = newScreenshots.length > 0 ? 
            Math.min(...newScreenshots.map(s => s.timestamp.getTime())) : 0;
          return fileTime > oldestLoadedTime;
        });
        
        if (hasEvenNewer) {
          console.log(`📜 [LOAD_MORE] Even newer files detected, will continue auto-loading...`);
          setShouldAutoLoadMore(true);
        }
      }
      
    } catch (error) {
      console.error('❌ [LOAD_MORE] Error loading more screenshots:', error);
    } finally {
      setIsLoadingMore(false);
    }
  };

  const addScreenshot = async (screenshot: Screenshot, captureMethod: 'fullscreen' | 'area' | 'window' = 'area', captureArea?: { x: number; y: number; width: number; height: number }) => {
    setScreenshots(prev => {
      const updated = [screenshot, ...prev];
      // Sort by timestamp (newest first) to maintain chronological order
      updated.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      return updated;
    });
    setCurrentScreenshot(screenshot);
    
    console.log('Screenshot added to UI (sidecar creation deferred):', screenshot.filePath);
    // Note: Sidecar file will be created lazily when needed (annotations, tags, notes, or OCR)
  };

  /**
   * Ensure a sidecar file exists for an image, creating it lazily if needed
   */
  const ensureSidecarExists = async (
    screenshot: Screenshot, 
    captureMethod: 'fullscreen' | 'area' | 'window' = 'area', 
    captureArea?: { x: number; y: number; width: number; height: number }
  ): Promise<boolean> => {
    if (!screenshot.filePath) {
      console.warn('Cannot create sidecar file: screenshot has no file path');
      return false;
    }

    try {
      // Check if sidecar file already exists
      const sidecarExists = await rendererSidecarManager.sidecarExists(screenshot.filePath);
      
      if (sidecarExists) {
        console.log('Sidecar file already exists:', screenshot.filePath);
        return true;
      }

      // Create sidecar file with current screenshot data
      console.log('Creating sidecar file lazily for:', screenshot.filePath);
      const metadata = rendererSidecarManager.createMetadata(
        screenshot.timestamp,
        'ScreenshotOS',
        captureMethod,
        screenshot.dimensions,
        captureArea
      );

      const success = await rendererSidecarManager.createSidecarFile(
        screenshot.filePath,
        metadata,
        screenshot.tags,
        screenshot.notes,
        screenshot.annotations?.map(ann => ({
          id: ann.id,
          type: ann.type,
          color: ann.color,
          position: ann.position,
          text: ann.text,
          number: ann.number,
          blurIntensity: ann.blurIntensity,
          createdAt: new Date().toISOString(),
          modifiedAt: new Date().toISOString(),
          visible: true,
          zIndex: 1
        })) || []
      );

      if (success) {
        console.log('✅ Sidecar file created successfully:', screenshot.filePath);
      } else {
        console.error('❌ Failed to create sidecar file:', screenshot.filePath);
      }

      return success;
    } catch (error) {
      console.error('Error ensuring sidecar exists:', error);
      return false;
    }
  };

  const captureFullScreen = async () => {
    if (!window.electron) {
      console.error('Electron API not available');
      return;
    }

    setIsCapturing(true);
    try {
      const result = await ipcWithTimeout('capture-fullscreen', undefined, 15000);
      if (result) {
        // Create an image to get dimensions
        const img = new Image();
        const screenshot: Screenshot = {
          id: `screenshot-${Date.now()}`,
          name: `Screenshot ${new Date().toLocaleString()}`,
          base64Image: result.base64Image,
          filePath: result.savedFilePath,
          timestamp: new Date(),
          dimensions: {
            width: 1920, // Default fallback, will be updated when image loads
            height: 1080
          },
          tags: [],
          notes: '',
          ocrText: '',
          annotations: [],
          hasSidecar: false // No sidecar created yet (lazy creation)
        };
        
        // Load image to get actual dimensions
        img.onload = () => {
          screenshot.dimensions.width = img.width;
          screenshot.dimensions.height = img.height;
          // Update the screenshot in state
          setScreenshots(prev => 
            prev.map(s => s.id === screenshot.id 
              ? { ...s, dimensions: { width: img.width, height: img.height } }
              : s
            )
          );
          setCurrentScreenshot(prev => 
            prev?.id === screenshot.id 
              ? { ...prev, dimensions: { width: img.width, height: img.height } }
              : prev
          );
        };
        img.src = `data:image/png;base64,${result.base64Image}`;
        await addScreenshot(screenshot, 'fullscreen');
        console.log('Screenshot captured successfully');
      }
    } catch (error) {
      console.error('Failed to capture screenshot:', error);
    } finally {
      setIsCapturing(false);
    }
  };

  const captureArea = async () => {
    if (!window.electron) {
      console.error('Electron API not available');
      return;
    }

    setIsCapturing(true);
    try {
      // First trigger the area overlay (this now returns both area and applicationInfo)
      const overlayResult = await ipcWithTimeout('trigger-area-overlay', undefined, 30000);
      if (overlayResult) {
        const { applicationInfo, ...area } = overlayResult;
        console.log('🎯 [AREA_CAPTURE] Received application info:', applicationInfo);
        
        // Then capture the selected area with display ID and application info
        const result = await ipcWithTimeout('capture-area', { 
          area, 
          displayId: area.displayId,
          applicationInfo 
        }, 15000);
        if (result) {
          const screenshot: Screenshot = {
            id: `screenshot-${Date.now()}`,
            name: `Area Screenshot ${new Date().toLocaleString()}`,
            base64Image: result.base64Image,
            filePath: result.savedFilePath,
            timestamp: new Date(),
            dimensions: {
              width: area.width,
              height: area.height
            },
            tags: [],
            notes: '',
            ocrText: '',
            annotations: [],
            hasSidecar: true, // Sidecar is now created by the backend
            applicationInfo,
            captureMethod: 'area'
          };
          await addScreenshot(screenshot, 'area', area);
          console.log('Area screenshot captured successfully with application info:', applicationInfo);
        }
      }
    } catch (error) {
      console.error('Failed to capture area screenshot:', error);
    } finally {
      setIsCapturing(false);
    }
  };

  const updateDrawingState = (updates: Partial<DrawingState>) => {
    setDrawingState(prev => ({ ...prev, ...updates }));
  };

  const addAnnotation = async (annotation: Annotation) => {
    if (!currentScreenshot) return;
    
    const updatedScreenshot = {
      ...currentScreenshot,
      annotations: [...(currentScreenshot.annotations || []), annotation]
    };
    
    setCurrentScreenshot(updatedScreenshot);
    setScreenshots(prev => 
      prev.map(s => s.id === currentScreenshot.id ? updatedScreenshot : s)
    );

    // Ensure sidecar file exists (create lazily if needed), then add annotation
    if (currentScreenshot.filePath) {
      try {
        // Ensure sidecar exists before adding annotation
        const sidecarCreated = await ensureSidecarExists(currentScreenshot);
        
        if (sidecarCreated) {
          const sidecarAnnotation: SidecarAnnotation = {
            id: annotation.id,
            type: annotation.type,
            color: annotation.color,
            position: annotation.position,
            text: annotation.text,
            number: annotation.number,
            blurIntensity: annotation.blurIntensity,
            createdAt: new Date().toISOString(),
            modifiedAt: new Date().toISOString(),
            visible: true,
            zIndex: 1
          };

          await rendererSidecarManager.addAnnotation(currentScreenshot.filePath, sidecarAnnotation);
          console.log('Annotation added to sidecar file:', currentScreenshot.filePath);
        } else {
          console.error('Failed to ensure sidecar file exists for annotation');
        }
      } catch (error) {
        console.error('Failed to add annotation to sidecar file:', error);
      }
    }
  };

  const updateScreenshotTags = async (screenshotId: string, tags: string[]) => {
    setScreenshots(prev => 
      prev.map(s => s.id === screenshotId ? { ...s, tags } : s)
    );
    
    if (currentScreenshot?.id === screenshotId) {
      setCurrentScreenshot(prev => prev ? { ...prev, tags } : null);
    }

    // Ensure sidecar file exists, then update tags
    const screenshot = screenshots.find(s => s.id === screenshotId);
    if (screenshot?.filePath) {
      try {
        // Ensure sidecar exists before updating tags
        const sidecarCreated = await ensureSidecarExists(screenshot);
        
        if (sidecarCreated) {
          await rendererSidecarManager.updateSidecarFile(screenshot.filePath, { tags });
          console.log('Sidecar file updated with new tags:', screenshot.filePath);
        } else {
          console.error('Failed to ensure sidecar file exists for tags update');
        }
      } catch (error) {
        console.error('Failed to update sidecar file with tags:', error);
      }
    }
  };

  const updateScreenshotNotes = async (screenshotId: string, notes: string) => {
    setScreenshots(prev => 
      prev.map(s => s.id === screenshotId ? { ...s, notes } : s)
    );
    
    if (currentScreenshot?.id === screenshotId) {
      setCurrentScreenshot(prev => prev ? { ...prev, notes } : null);
    }

    // Ensure sidecar file exists, then update notes
    const screenshot = screenshots.find(s => s.id === screenshotId);
    if (screenshot?.filePath) {
      try {
        // Ensure sidecar exists before updating notes
        const sidecarCreated = await ensureSidecarExists(screenshot);
        
        if (sidecarCreated) {
          await rendererSidecarManager.updateSidecarFile(screenshot.filePath, { notes });
          console.log('Sidecar file updated with new notes:', screenshot.filePath);
        } else {
          console.error('Failed to ensure sidecar file exists for notes update');
        }
      } catch (error) {
        console.error('Failed to update sidecar file with notes:', error);
      }
    }
  };

  const copyCurrentScreenshot = async () => {
    if (!currentScreenshot) {
      console.warn('No screenshot selected to copy');
      return;
    }

    if (!window.electron) {
      console.error('Electron API not available');
      return;
    }

    try {
      console.log('Copying screenshot to clipboard:', currentScreenshot.name);
      const result = await ipcWithTimeout('copy-screenshot-to-clipboard', {
        base64Image: currentScreenshot.base64Image,
        filePath: currentScreenshot.filePath
      }, 5000);
      
      if (result.success) {
        console.log('Screenshot copied to clipboard successfully');
      } else {
        console.error('Failed to copy screenshot to clipboard:', result.error);
      }
    } catch (error) {
      console.error('Error copying screenshot to clipboard:', error);
    }
  };

  const value: AppContextType = {
    screenshots,
    currentScreenshot,
    isCapturing,
    isLoadingMore,
    hasMoreFiles,
    drawingState,
    setCurrentScreenshot,
    addScreenshot,
    loadMoreScreenshots,
    captureFullScreen,
    captureArea,
    copyCurrentScreenshot,
    updateDrawingState,
    addAnnotation,
    updateScreenshotTags,
    updateScreenshotNotes
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}