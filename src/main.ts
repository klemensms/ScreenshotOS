// filepath: /Users/klemensstelk/Repo/ScreenshotOS/src/main.ts
import { app, BrowserWindow, ipcMain, dialog, clipboard, screen } from 'electron';
import path from 'path';
import screenshot from 'screenshot-desktop';
import fs from 'fs';
import { homedir } from 'os';
import { loadStorageConfig, ensureSaveDirectory, saveStorageConfig } from './config/storage';
import { cropImage } from './utils/jimp-native';
import { logger } from './utils/logger';
import { sidecarManager, SidecarMetadata, SidecarAnnotation } from './utils/sidecar-manager';

// Get screenshot save directory from config
let screenshotSaveDir = loadStorageConfig().saveDirectory;

// Ensure the save directory exists
function ensureSaveDirectoryExists() {
  screenshotSaveDir = ensureSaveDirectory(screenshotSaveDir);
}

// Generate a filename based on timestamp
function generateFilename() {
  const config = loadStorageConfig();
  const date = new Date();
  const timestamp = date.toISOString()
    .replace(/:/g, '-')
    .replace(/\..+/, '')
    .replace('T', '_');
  
  return config.filenameTemplate.replace('%TIMESTAMP%', timestamp) + '.' + config.fileFormat;
}

// Save the screenshot to disk
async function saveScreenshot(imgBuffer: Buffer): Promise<string> {
  ensureSaveDirectoryExists();
  
  const filename = generateFilename();
  const filePath = path.join(screenshotSaveDir, filename);
  
  return new Promise<string>((resolve, reject) => {
    fs.writeFile(filePath, imgBuffer, (err) => {
      if (err) {
        console.error('Error saving screenshot:', err);
        reject(err);
        return;
      }
      
      console.log(`Screenshot saved to: ${filePath}`);
      resolve(filePath);
    });
  });
}

// Copy image to clipboard
function copyToClipboard(imgBuffer: Buffer): boolean {
  try {
    console.time('clipboard-copy');
    
    // Create an image object from the buffer that the clipboard can understand
    const nativeImage = require('electron').nativeImage.createFromBuffer(imgBuffer);
    
    // Copy the image to clipboard
    clipboard.writeImage(nativeImage);
    
    console.timeEnd('clipboard-copy');
    console.log('Screenshot copied to clipboard');
    return true;
  } catch (error) {
    console.error('Failed to copy to clipboard:', error);
    return false;
  }
}

async function createWindow() {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // Load the HTML file with fallback handling
  const indexHtmlPath = path.join(__dirname, 'index.html');
  console.log('Loading HTML from:', indexHtmlPath);

  try {
    await win.loadFile(indexHtmlPath);
    console.log('Successfully loaded index.html');
  } catch (error) {
    console.error('Failed to load index.html:', error);
    // Show error dialog if HTML file cannot be loaded
    dialog.showErrorBox(
      'Application Error',
      'Failed to load the application interface. Please reinstall the application.'
    );
  }

  // Open DevTools only in development
  if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
    win.webContents.openDevTools();
  }
}

// Global error handlers for main process
process.on('uncaughtException', (error) => {
  logger.error('main', 'Uncaught Exception', error);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('main', 'Unhandled Promise Rejection', reason as Error, { promise: promise.toString() });
});

app.whenReady().then(async () => {
  logger.info('main', 'App ready, creating window');
  await createWindow();

  // For macOS, inform about screen recording permission
  if (process.platform === 'darwin') {
    // On macOS, screen recording permission is requested automatically 
    // when the screenshot is first attempted via screenshot-desktop
    console.log('Running on macOS - screen recording permission will be requested when needed');
    logger.info('main', 'Running on macOS - screen recording permission will be requested when needed');
  }

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) await createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// Enhanced screenshot capture with performance optimization and error handling
ipcMain.handle('capture-fullscreen', async () => {
  try {
    console.time('screenshot-capture');
    
    // Use screenshot-desktop which utilizes native macOS Core Graphics APIs
    const imgBuffer = await screenshot({ format: 'png' });
    
    console.timeEnd('screenshot-capture');
    
    // Log image details for debugging
    console.log(`Screenshot captured: ${imgBuffer.length} bytes`);
    
    // Auto-save the screenshot to disk
    const filePath = await saveScreenshot(imgBuffer);
    console.log(`Screenshot automatically saved to: ${filePath}`);
    
    // Copy the screenshot to clipboard
    const clipboardSuccess = copyToClipboard(imgBuffer);
    if (clipboardSuccess) {
      console.log('Screenshot copied to clipboard successfully');
    } else {
      console.warn('Screenshot copied to clipboard failed');
    }
    
    // Convert to base64 for return
    const base64Image = imgBuffer.toString('base64');
    
    // Clear the buffer reference to help with memory management
    imgBuffer.fill(0);
    
    // Return the image as a base64 string to the renderer along with the saved path
    return {
      base64Image,
      savedFilePath: filePath
    };
  } catch (error) {
    logger.error('main', 'Screenshot capture failed', error as Error);
    
    // Show error dialog to user
    dialog.showErrorBox(
      'Screenshot Failed', 
      'Failed to capture screenshot. Please check if screen recording permission is granted.'
    );
    
    return null;
  }
});

// Handle save screenshot request
ipcMain.handle('save-screenshot', async (event, base64Image) => {
  try {
    console.log('Saving screenshot to disk...');
    console.log('Save directory:', screenshotSaveDir);
    console.log('Screenshot data received, length:', base64Image?.length || 0);
    
    if (!base64Image) {
      console.error('No image data received for saving');
      throw new Error('No image data received');
    }
    
    // Convert base64 to buffer
    const imgBuffer = Buffer.from(base64Image, 'base64');
    console.log('Converted to buffer, size:', imgBuffer.length, 'bytes');
    
    // Save the screenshot and get the file path
    const filePath = await saveScreenshot(imgBuffer);
    
    console.log('Screenshot saved successfully to:', filePath);
    
    // Return the file path to the renderer process
    return {
      success: true,
      filePath
    };
  } catch (error: any) {
    logger.error('main', 'Failed to save screenshot', error);
    
    // Show error dialog to user
    dialog.showErrorBox(
      'Save Screenshot Failed', 
      'Failed to save screenshot. Please try again.'
    );
    
    return {
      success: false,
      error: error.message
    };
  }
});

// Handle loading storage config
ipcMain.handle('load-storage-config', async () => {
  try {
    return loadStorageConfig();
  } catch (error) {
    logger.error('main', 'Failed to load storage config', error as Error);
    dialog.showErrorBox('Configuration Error', 'Failed to load application settings. Using defaults.');
    return null;
  }
});

// Handle saving storage config
ipcMain.handle('save-storage-config', async (event, config) => {
  try {
    const success = saveStorageConfig(config);
    // Update the current save directory
    if (success && config.saveDirectory) {
      screenshotSaveDir = config.saveDirectory;
    }
    return success;
  } catch (error) {
    console.error('Failed to save storage config:', error);
    dialog.showErrorBox('Configuration Error', 'Failed to save application settings.');
    return false;
  }
});

// Handle directory selection dialog
ipcMain.handle('select-directory', async () => {
  try {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      title: 'Select Screenshot Save Location'
    });
    return result;
  } catch (error) {
    console.error('Failed to open directory selection dialog:', error);
    return { canceled: true, filePaths: [] };
  }
});

// Overlay windows reference and area selection promise
let overlayWindows: BrowserWindow[] = [];
let areaSelectionResolver: ((area: { x: number; y: number; width: number; height: number; displayId?: number } | null) => void) | null = null;

// Listen for area selection from overlay
ipcMain.on('area-selection', (event, area) => {
  console.log('Received area selection event:', area);
  if (areaSelectionResolver) {
    if (area && area.cancel) {
      console.log('User cancelled area selection');
      areaSelectionResolver(null);
    } else if (area) {
      // Transform overlay coordinates to screen coordinates
      const transformedArea = transformOverlayToScreenCoordinates(area);
      console.log('Original overlay area:', area);
      console.log('Transformed screen area:', transformedArea);
      areaSelectionResolver(transformedArea);
    }
    areaSelectionResolver = null;
  } else {
    console.warn('No areaSelectionResolver available');
  }
  
  // Close all overlay windows
  if (overlayWindows.length > 0) {
    console.log('Closing overlay windows');
    overlayWindows.forEach(window => {
      if (!window.isDestroyed()) {
        window.close();
      }
    });
    overlayWindows = [];
  }
});

// Transform overlay coordinates to actual screen coordinates
// Accounts for menu bar height offset on macOS
function transformOverlayToScreenCoordinates(overlayArea: { x: number; y: number; width: number; height: number; displayId?: number }): { x: number; y: number; width: number; height: number; displayId: number } {
  const allDisplays = screen.getAllDisplays();
  
  // Find the display for this area selection
  let targetDisplay: Electron.Display;
  
  if (overlayArea.displayId) {
    // If display ID is provided, use it directly
    targetDisplay = allDisplays.find(d => d.id === overlayArea.displayId) || allDisplays[0];
    console.log('Using provided display ID:', overlayArea.displayId);
  } else {
    // Fallback to primary display if no display ID provided
    targetDisplay = allDisplays[0];
    console.log('No display ID provided, using primary display');
  }
  
  console.log('Target display for area selection:', {
    display: targetDisplay.id,
    bounds: targetDisplay.bounds,
    scaleFactor: targetDisplay.scaleFactor
  });
  
  // Determine if this is the primary display (usually the one with x: 0, y: 0)
  const isPrimaryDisplay = targetDisplay.bounds.x === 0 && targetDisplay.bounds.y === 0;
  console.log('Is primary display:', isPrimaryDisplay);
  
  // Get menu bar height for primary display offset correction
  // Calculate menu bar height from difference between bounds and work area
  const primaryDisplay = screen.getPrimaryDisplay();
  const menuBarHeight = primaryDisplay.workArea.y - primaryDisplay.bounds.y;
  console.log('Menu bar height calculated:', {
    displayBounds: primaryDisplay.bounds,
    workArea: primaryDisplay.workArea,
    menuBarHeight
  });
  
  // Check if target display has any work area offset (similar to menu bar)
  const targetDisplayOffset = targetDisplay.workArea.y - targetDisplay.bounds.y;
  console.log('Target display work area analysis:', {
    displayId: targetDisplay.id,
    bounds: targetDisplay.bounds,
    workArea: targetDisplay.workArea,
    calculatedOffset: targetDisplayOffset,
    isPrimary: isPrimaryDisplay
  });
  
  // Apply coordinate transformation
  const scaleFactor = targetDisplay.scaleFactor;
  
  // Apply coordinate adjustments based on display type
  let adjustedX = overlayArea.x;
  let adjustedY = overlayArea.y;
  
  if (isPrimaryDisplay) {
    // For primary display, add menu bar height offset to Y
    adjustedY = overlayArea.y + menuBarHeight;
    console.log('Applied menu bar offset to primary display:', {
      originalY: overlayArea.y,
      menuBarHeight,
      adjustedY
    });
  } else {
    // For secondary displays, check if there's a work area offset similar to menu bar
    adjustedX = overlayArea.x;
    if (targetDisplayOffset > 0) {
      // Secondary display has a work area offset, apply it like we do for menu bar
      adjustedY = overlayArea.y + targetDisplayOffset;
      console.log('Applied work area offset to secondary display:', {
        originalY: overlayArea.y,
        targetDisplayOffset,
        adjustedY
      });
    } else {
      // No work area offset detected, use coordinates directly
      adjustedY = overlayArea.y;
      console.log('Using overlay coordinates directly for secondary display:', {
        overlayCoords: { x: overlayArea.x, y: overlayArea.y },
        displayBounds: { x: targetDisplay.bounds.x, y: targetDisplay.bounds.y },
        note: 'No work area offset detected'
      });
    }
  }
  
  const physicalX = Math.round(adjustedX * scaleFactor);
  const physicalY = Math.round(adjustedY * scaleFactor);
  const physicalWidth = Math.round(overlayArea.width * scaleFactor);
  const physicalHeight = Math.round(overlayArea.height * scaleFactor);
  
  console.log('Coordinate transformation with display-specific corrections:', {
    overlay: { x: overlayArea.x, y: overlayArea.y, width: overlayArea.width, height: overlayArea.height },
    menuBarHeight,
    isPrimaryDisplay,
    adjusted: { x: adjustedX, y: adjustedY },
    physical: { x: physicalX, y: physicalY, width: physicalWidth, height: physicalHeight },
    scaleFactor,
    displayId: targetDisplay.id
  });
  
  return {
    x: physicalX,
    y: physicalY,
    width: physicalWidth,
    height: physicalHeight,
    displayId: targetDisplay.id
  };
}

async function selectAreaOnScreen(): Promise<{ x: number; y: number; width: number; height: number; displayId?: number } | null> {
  console.log('Starting area selection process with individual display overlays');
  return new Promise<{ x: number; y: number; width: number; height: number } | null>((resolve) => {
    console.log('Setting up area selection resolver');
    areaSelectionResolver = resolve;
    
    // Get all displays to support multi-monitor setups
    const allDisplays = screen.getAllDisplays();
    console.log('All displays:', allDisplays.map(d => ({ id: d.id, bounds: d.bounds, scaleFactor: d.scaleFactor })));
    
    // Create individual overlay windows for each display
    console.log('Creating individual overlay windows for each display');
    overlayWindows = [];
    
    let readyCount = 0;
    const totalDisplays = allDisplays.length;
    
    allDisplays.forEach((display, index) => {
      console.log(`Creating overlay ${index + 1}/${totalDisplays} for display ${display.id}:`, display.bounds);
      
      const overlayWindow = new BrowserWindow({
        width: display.bounds.width,
        height: display.bounds.height,
        x: display.bounds.x,
        y: display.bounds.y,
        frame: false,
        transparent: true,
        alwaysOnTop: true,
        skipTaskbar: true,
        resizable: false,
        movable: false,
        focusable: true,
        webPreferences: {
          preload: path.join(__dirname, 'overlayPreload.js'),
          nodeIntegration: false,
          contextIsolation: true,
          additionalArguments: [`--display-id=${display.id}`, `--display-bounds=${JSON.stringify(display.bounds)}`]
        },
        hasShadow: false,
        show: false, // Start hidden
      });
      
      overlayWindow.setIgnoreMouseEvents(false);
      overlayWindows.push(overlayWindow);
      
      console.log(`Loading area overlay HTML for display ${display.id}`);
      overlayWindow.loadFile(path.join(__dirname, 'areaOverlay.html'));
      
      overlayWindow.once('ready-to-show', () => {
        readyCount++;
        console.log(`Overlay window ${readyCount}/${totalDisplays} ready for display ${display.id}`);
        
        // Show all overlays when all are ready
        if (readyCount === totalDisplays) {
          console.log('All overlay windows ready, showing all overlays');
          overlayWindows.forEach(window => {
            if (!window.isDestroyed()) {
              window.show();
              window.focus();
            }
          });
        }
      });
      
      overlayWindow.on('closed', () => {
        console.log(`Overlay window closed for display ${display.id}`);
        // Remove from array when closed
        const windowIndex = overlayWindows.indexOf(overlayWindow);
        if (windowIndex > -1) {
          overlayWindows.splice(windowIndex, 1);
        }
      });
    });
  });
}

// Remove the old 'capture-area' handler and replace it with a trigger from the renderer
ipcMain.handle('trigger-area-overlay', async () => {
  try {
    console.log('Trigger area overlay requested');
    // Show overlay and get area
    const area = await selectAreaOnScreen();
    console.log('Area selection completed with result:', area);
    return area;
  } catch (error) {
    console.error('Area overlay failed:', error);
    return null;
  }
});

// Update the 'capture-area' handler to only crop and save, given area
ipcMain.handle('capture-area', async (event, area, targetDisplayId?: number) => {
  try {
    if (!area || typeof area.x !== 'number' || typeof area.y !== 'number' || typeof area.width !== 'number' || typeof area.height !== 'number') {
      throw new Error('Invalid area coordinates');
    }
    
    console.log('Area capture requested:', area);
    console.log('Target display ID:', targetDisplayId);
    
    // If we have a target display ID, capture only that display
    let imgBuffer: Buffer;
    if (targetDisplayId) {
      const allDisplays = screen.getAllDisplays();
      const targetDisplayIndex = allDisplays.findIndex(d => d.id === targetDisplayId);
      const targetDisplay = allDisplays.find(d => d.id === targetDisplayId);
      
      if (targetDisplay && targetDisplayIndex !== -1) {
        console.log('Capturing specific display:', targetDisplay.id, targetDisplay.bounds);
        console.log('Using screenshot-desktop index:', targetDisplayIndex);
        // Capture the specific display using the index (not the ID)
        try {
          imgBuffer = await screenshot({ 
            format: 'png',
            screen: targetDisplayIndex
          });
        } catch (screenError) {
          console.error('Failed to capture specific display, falling back to full screen:', screenError);
          imgBuffer = await screenshot({ format: 'png' });
        }
      } else {
        console.warn('Target display not found, falling back to full screen');
        imgBuffer = await screenshot({ format: 'png' });
      }
    } else {
      // Fallback to full screen capture
      imgBuffer = await screenshot({ format: 'png' });
    }
    
    console.log('Screenshot captured, size:', imgBuffer.length);
    
    try {
      // Use our helper to crop the image with Jimp
      const croppedBuffer = await cropImage(
        imgBuffer, 
        area.x, 
        area.y, 
        area.width, 
        area.height
      );
      console.log('Image cropped successfully, size:', croppedBuffer.length);
      
      // Save the cropped screenshot
      const filePath = await saveScreenshot(croppedBuffer);
      console.log('Cropped screenshot saved to:', filePath);
      
      // Copy to clipboard
      const clipboardSuccess = copyToClipboard(croppedBuffer);
      console.log('Clipboard copy success:', clipboardSuccess);
      
      // Convert to base64 for return
      const base64Image = croppedBuffer.toString('base64');
      
      // Clear buffer references to help with memory management
      croppedBuffer.fill(0);
      
      // Return base64 image and file path
      return {
        base64Image,
        savedFilePath: filePath,
        clipboardCopySuccess: clipboardSuccess
      };
    } catch (jimpError) {
      console.error('Jimp processing error:', jimpError);
      throw jimpError;
    }
  } catch (error) {
    logger.error('main', 'Area capture failed', error as Error);
    dialog.showErrorBox('Area Capture Failed', 'Failed to capture selected area. Please try again.');
    return null;
  }
});

// IPC handlers for log access
ipcMain.handle('get-recent-logs', async (event, lines = 100) => {
  try {
    return logger.getRecentLogs(lines);
  } catch (error) {
    logger.error('main', 'Failed to get recent logs', error as Error);
    return 'Failed to retrieve logs';
  }
});

ipcMain.handle('get-log-path', async () => {
  try {
    return logger.getLogPath();
  } catch (error) {
    logger.error('main', 'Failed to get log path', error as Error);
    return null;
  }
});

// IPC handler for renderer to send logs
ipcMain.handle('log-from-renderer', async (event, logEntry) => {
  try {
    logger.log({
      ...logEntry,
      source: 'renderer'
    });
  } catch (error) {
    console.error('Failed to log from renderer:', error);
  }
});

// Sidecar file IPC handlers
ipcMain.handle('sidecar-create', async (event, imagePath: string, metadata: SidecarMetadata, tags: string[] = [], notes: string = '', annotations: SidecarAnnotation[] = []) => {
  try {
    logger.info('main', `Creating sidecar file for ${imagePath}`);
    const result = await sidecarManager.createSidecarFile(imagePath, metadata, tags, notes, annotations);
    return { success: result };
  } catch (error) {
    logger.error('main', 'Failed to create sidecar file', error as Error);
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle('sidecar-load', async (event, imagePath: string) => {
  try {
    const sidecarData = await sidecarManager.loadSidecarFile(imagePath);
    return { success: true, data: sidecarData };
  } catch (error) {
    logger.error('main', 'Failed to load sidecar file', error as Error);
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle('sidecar-update', async (event, imagePath: string, updates: any) => {
  try {
    logger.info('main', `Updating sidecar file for ${imagePath}`);
    const result = await sidecarManager.updateSidecarFile(imagePath, updates);
    return { success: result };
  } catch (error) {
    logger.error('main', 'Failed to update sidecar file', error as Error);
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle('sidecar-add-annotation', async (event, imagePath: string, annotation: SidecarAnnotation) => {
  try {
    logger.info('main', `Adding annotation to sidecar file for ${imagePath}`);
    const result = await sidecarManager.addAnnotation(imagePath, annotation);
    return { success: result };
  } catch (error) {
    logger.error('main', 'Failed to add annotation to sidecar file', error as Error);
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle('sidecar-remove-annotation', async (event, imagePath: string, annotationId: string) => {
  try {
    logger.info('main', `Removing annotation from sidecar file for ${imagePath}`);
    const result = await sidecarManager.removeAnnotation(imagePath, annotationId);
    return { success: result };
  } catch (error) {
    logger.error('main', 'Failed to remove annotation from sidecar file', error as Error);
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle('sidecar-exists', async (event, imagePath: string) => {
  try {
    const exists = sidecarManager.sidecarExists(imagePath);
    return { success: true, exists };
  } catch (error) {
    logger.error('main', 'Failed to check sidecar existence', error as Error);
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle('sidecar-scan-directory', async (event, directoryPath: string) => {
  try {
    logger.info('main', `Scanning directory for screenshots: ${directoryPath}`);
    const results = await sidecarManager.scanDirectory(directoryPath);
    return { success: true, data: results };
  } catch (error) {
    logger.error('main', 'Failed to scan directory for screenshots', error as Error);
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle('sidecar-delete', async (event, imagePath: string) => {
  try {
    logger.info('main', `Deleting sidecar file for ${imagePath}`);
    const result = await sidecarManager.deleteSidecarFile(imagePath);
    return { success: result };
  } catch (error) {
    logger.error('main', 'Failed to delete sidecar file', error as Error);
    return { success: false, error: (error as Error).message };
  }
});

// Handle file existence checks
ipcMain.handle('file-exists', async (event, filePath: string) => {
  try {
    const exists = fs.existsSync(filePath);
    return exists;
  } catch (error) {
    logger.error('main', 'Failed to check file existence', error as Error);
    return false;
  }
});

// Handle reading image files as base64
ipcMain.handle('read-image-file', async (event, filePath: string) => {
  try {
    logger.info('main', `Reading image file: ${filePath}`);
    const buffer = fs.readFileSync(filePath);
    const base64 = buffer.toString('base64');
    return { success: true, base64 };
  } catch (error) {
    logger.error('main', 'Failed to read image file', error as Error);
    return { success: false, error: (error as Error).message };
  }
});
