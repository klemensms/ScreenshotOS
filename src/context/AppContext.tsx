import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { rendererSidecarManager, SidecarMetadata, SidecarAnnotation, SidecarData } from '../utils/renderer-sidecar';

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
}

export interface Annotation {
  id: string;
  type: 'arrow' | 'rectangle' | 'text' | 'numbering';
  color: string;
  position: {
    x: number;
    y: number;
    width?: number;
    height?: number;
  };
  text?: string;
  number?: number;
}

export interface DrawingState {
  isDrawing: boolean;
  selectedTool: 'arrow' | 'rectangle' | 'text' | 'numbering';
  selectedColor: string;
  currentAnnotation: Annotation | null;
}

interface AppContextType {
  screenshots: Screenshot[];
  currentScreenshot: Screenshot | null;
  isCapturing: boolean;
  drawingState: DrawingState;
  setCurrentScreenshot: (screenshot: Screenshot | null) => void;
  addScreenshot: (screenshot: Screenshot) => void;
  captureFullScreen: () => Promise<void>;
  captureArea: () => Promise<void>;
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
  const [screenshots, setScreenshots] = useState<Screenshot[]>([]);
  const [currentScreenshot, setCurrentScreenshot] = useState<Screenshot | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [drawingState, setDrawingState] = useState<DrawingState>({
    isDrawing: false,
    selectedTool: 'arrow',
    selectedColor: '#dc2626',
    currentAnnotation: null
  });

  // Load existing screenshots on app startup
  useEffect(() => {
    loadExistingScreenshots();
  }, []);

  const loadExistingScreenshots = async () => {
    try {
      console.log('Loading existing screenshots from Downloads directory...');
      const downloadsPath = '/Users/klemensstelk/Downloads';
      const result = await rendererSidecarManager.scanDirectory(downloadsPath);
      
      if (result.success && result.sidecarFiles) {
        const loadedScreenshots: Screenshot[] = [];
        
        for (const sidecarPath of result.sidecarFiles) {
          try {
            const sidecarResult = await rendererSidecarManager.loadSidecarFileFromPath(sidecarPath);
            if (sidecarResult.success && sidecarResult.data) {
              const sidecarData = sidecarResult.data;
              
              // Check if the original image file exists
              const imageExists = await window.electron.invoke('file-exists', sidecarData.originalImagePath);
              if (imageExists) {
                // Load image as base64
                const imageData = await window.electron.invoke('read-image-file', sidecarData.originalImagePath);
                if (imageData && imageData.base64) {
                  const screenshot: Screenshot = {
                    id: `loaded-${Date.now()}-${Math.random()}`,
                    name: `Screenshot ${new Date(sidecarData.createdAt).toLocaleString()}`,
                    base64Image: imageData.base64,
                    filePath: sidecarData.originalImagePath,
                    timestamp: new Date(sidecarData.createdAt),
                    dimensions: {
                      width: sidecarData.metadata.screenInfo?.resolution?.width || 1920,
                      height: sidecarData.metadata.screenInfo?.resolution?.height || 1080
                    },
                    tags: sidecarData.tags || [],
                    notes: sidecarData.notes || '',
                    ocrText: sidecarData.ocrText || '',
                    annotations: sidecarData.annotations?.map(ann => ({
                      id: ann.id,
                      type: ann.type,
                      color: ann.color,
                      position: ann.position,
                      text: ann.text,
                      number: ann.number
                    })) || []
                  };
                  loadedScreenshots.push(screenshot);
                }
              }
            }
          } catch (error) {
            console.error('Failed to load sidecar file:', sidecarPath, error);
          }
        }
        
        // Sort by timestamp (newest first)
        loadedScreenshots.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
        
        setScreenshots(loadedScreenshots);
        if (loadedScreenshots.length > 0) {
          setCurrentScreenshot(loadedScreenshots[0]);
        }
        
        console.log(`Loaded ${loadedScreenshots.length} existing screenshots`);
      }
    } catch (error) {
      console.error('Failed to load existing screenshots:', error);
    }
  };

  const addScreenshot = async (screenshot: Screenshot, captureMethod: 'fullscreen' | 'area' | 'window' = 'area', captureArea?: { x: number; y: number; width: number; height: number }) => {
    setScreenshots(prev => [screenshot, ...prev]);
    setCurrentScreenshot(screenshot);

    // Create sidecar file for the new screenshot
    if (screenshot.filePath) {
      try {
        const metadata = rendererSidecarManager.createMetadata(
          screenshot.timestamp,
          'ScreenshotOS', // TODO: Get actual application name
          captureMethod,
          screenshot.dimensions,
          captureArea
        );

        await rendererSidecarManager.createSidecarFile(
          screenshot.filePath,
          metadata,
          screenshot.tags,
          screenshot.notes,
          [] // No annotations initially
        );
        
        console.log('Sidecar file created for screenshot:', screenshot.filePath);
      } catch (error) {
        console.error('Failed to create sidecar file:', error);
      }
    }
  };

  const captureFullScreen = async () => {
    if (!window.electron) {
      console.error('Electron API not available');
      return;
    }

    setIsCapturing(true);
    try {
      const result = await window.electron.invoke('capture-fullscreen');
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
          annotations: []
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
      // First trigger the area overlay
      const area = await window.electron.invoke('trigger-area-overlay');
      if (area) {
        // Then capture the selected area with display ID
        const result = await window.electron.invoke('capture-area', area, area.displayId);
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
            annotations: []
          };
          await addScreenshot(screenshot, 'area', area);
          console.log('Area screenshot captured successfully');
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

    // Add annotation to sidecar file
    if (currentScreenshot.filePath) {
      try {
        const sidecarAnnotation: SidecarAnnotation = {
          id: annotation.id,
          type: annotation.type,
          color: annotation.color,
          position: annotation.position,
          text: annotation.text,
          number: annotation.number,
          createdAt: new Date().toISOString(),
          modifiedAt: new Date().toISOString(),
          visible: true,
          zIndex: 1
        };

        await rendererSidecarManager.addAnnotation(currentScreenshot.filePath, sidecarAnnotation);
        console.log('Annotation added to sidecar file:', currentScreenshot.filePath);
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

    // Update sidecar file
    const screenshot = screenshots.find(s => s.id === screenshotId);
    if (screenshot?.filePath) {
      try {
        await rendererSidecarManager.updateSidecarFile(screenshot.filePath, { tags });
        console.log('Sidecar file updated with new tags:', screenshot.filePath);
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

    // Update sidecar file
    const screenshot = screenshots.find(s => s.id === screenshotId);
    if (screenshot?.filePath) {
      try {
        await rendererSidecarManager.updateSidecarFile(screenshot.filePath, { notes });
        console.log('Sidecar file updated with new notes:', screenshot.filePath);
      } catch (error) {
        console.error('Failed to update sidecar file with notes:', error);
      }
    }
  };

  const value: AppContextType = {
    screenshots,
    currentScreenshot,
    isCapturing,
    drawingState,
    setCurrentScreenshot,
    addScreenshot,
    captureFullScreen,
    captureArea,
    updateDrawingState,
    addAnnotation,
    updateScreenshotTags,
    updateScreenshotNotes
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}