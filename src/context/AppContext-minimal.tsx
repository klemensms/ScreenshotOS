import React, { createContext, useContext, useState, ReactNode } from 'react';
import { debugLogger } from '../utils/debug-logger';

// Reuse interfaces from original
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
  annotations?: Annotation[];
  hasSidecar?: boolean;
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
  selectedTool: 'arrow' | 'rectangle' | 'text' | 'numbering' | 'blur';
  selectedColor: string;
  blurIntensity: number;
  numberingCounter: number;
  currentAnnotation: Annotation | null;
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

export function AppProvider({ children }: AppProviderProps) {
  console.log('🔍 AppProvider rendering...');
  debugLogger.log('AppProvider', 'component render', 'Starting minimal AppProvider');

  // Basic state without any processing
  const [screenshots, setScreenshots] = useState<Screenshot[]>([]);
  const [currentScreenshot, setCurrentScreenshot] = useState<Screenshot | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMoreFiles, setHasMoreFiles] = useState(false);
  const [drawingState, setDrawingState] = useState<DrawingState>({
    isDrawing: false,
    selectedTool: 'arrow',
    selectedColor: '#dc2626',
    blurIntensity: 10,
    numberingCounter: 1,
    currentAnnotation: null
  });

  console.log('🔍 AppProvider state initialized');
  debugLogger.log('AppProvider', 'state initialized', { screenshotCount: screenshots.length });

  // Minimal implementations - no actual functionality to test basic provider
  const addScreenshot = (screenshot: Screenshot) => {
    debugLogger.log('AppProvider', 'addScreenshot', { id: screenshot.id });
    setScreenshots(prev => [screenshot, ...prev]);
  };

  const loadMoreScreenshots = async () => {
    debugLogger.log('AppProvider', 'loadMoreScreenshots', 'Minimal implementation');
    // Do nothing in minimal version
  };

  const captureFullScreen = async () => {
    debugLogger.log('AppProvider', 'captureFullScreen', 'Minimal implementation');
    // Do nothing in minimal version
  };

  const captureArea = async () => {
    debugLogger.log('AppProvider', 'captureArea', 'Minimal implementation');
    // Do nothing in minimal version
  };

  const copyCurrentScreenshot = async () => {
    debugLogger.log('AppProvider', 'copyCurrentScreenshot', 'Minimal implementation');
    // Do nothing in minimal version
  };

  const updateDrawingState = (updates: Partial<DrawingState>) => {
    debugLogger.log('AppProvider', 'updateDrawingState', updates);
    setDrawingState(prev => ({ ...prev, ...updates }));
  };

  const addAnnotation = (annotation: Annotation) => {
    debugLogger.log('AppProvider', 'addAnnotation', { type: annotation.type });
    // Do nothing in minimal version
  };

  const updateScreenshotTags = (screenshotId: string, tags: string[]) => {
    debugLogger.log('AppProvider', 'updateScreenshotTags', { screenshotId, tagCount: tags.length });
    // Do nothing in minimal version
  };

  const updateScreenshotNotes = (screenshotId: string, notes: string) => {
    debugLogger.log('AppProvider', 'updateScreenshotNotes', { screenshotId });
    // Do nothing in minimal version
  };

  const value = {
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
    updateScreenshotNotes,
  };

  console.log('🔍 AppProvider context value created');
  debugLogger.log('AppProvider', 'context value created', 'Providing context to children');

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
}