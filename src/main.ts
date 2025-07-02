// filepath: /Users/klemensstelk/Repo/ScreenshotOS/src/main.ts
import { app, BrowserWindow, ipcMain, dialog, clipboard, screen, globalShortcut } from 'electron';
import path from 'path';
import screenshot from 'screenshot-desktop';
import fs from 'fs';
import { homedir } from 'os';
import { loadStorageConfig, ensureSaveDirectory, saveStorageConfig, ShortcutConfig } from './config/storage';
import { cropImage } from './utils/jimp-native';
import { logger } from './utils/logger';
import { sidecarManager, SidecarMetadata, SidecarAnnotation } from './utils/sidecar-manager';

// Get screenshot save directory from config
let screenshotSaveDir = loadStorageConfig().saveDirectory;

// Global shortcuts state
let currentShortcuts: ShortcutConfig | null = null;

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

// Global shortcut management
function registerGlobalShortcuts(shortcuts: ShortcutConfig): boolean {
  try {
    // Unregister existing shortcuts first
    unregisterGlobalShortcuts();
    
    logger.info('main', 'Registering global shortcuts', shortcuts);
    
    // Register full screen capture shortcut
    const fullScreenRegistered = globalShortcut.register(shortcuts.fullScreen, async () => {
      logger.info('main', 'Full screen capture triggered by shortcut');
      await triggerFullScreenCapture();
    });
    
    if (!fullScreenRegistered) {
      logger.error('main', 'Failed to register full screen shortcut', new Error(`Shortcut ${shortcuts.fullScreen} already in use`));
      return false;
    }
    
    // Register area capture shortcut
    const areaRegistered = globalShortcut.register(shortcuts.areaCapture, async () => {
      logger.info('main', 'Area capture triggered by shortcut');
      await triggerAreaCapture();
    });
    
    if (!areaRegistered) {
      logger.error('main', 'Failed to register area capture shortcut', new Error(`Shortcut ${shortcuts.areaCapture} already in use`));
      globalShortcut.unregister(shortcuts.fullScreen); // Clean up
      return false;
    }
    
    currentShortcuts = shortcuts;
    logger.info('main', 'Global shortcuts registered successfully');
    return true;
  } catch (error) {
    logger.error('main', 'Failed to register global shortcuts', error as Error);
    return false;
  }
}

function unregisterGlobalShortcuts(): void {
  if (currentShortcuts) {
    globalShortcut.unregister(currentShortcuts.fullScreen);
    globalShortcut.unregister(currentShortcuts.areaCapture);
    logger.info('main', 'Unregistered global shortcuts');
  }
  currentShortcuts = null;
}

// Trigger functions for shortcuts
async function triggerFullScreenCapture(): Promise<void> {
  try {
    console.time('shortcut-fullscreen-capture');
    
    // Use screenshot-desktop which utilizes native macOS Core Graphics APIs
    const imgBuffer = await screenshot({ format: 'png' });
    
    console.timeEnd('shortcut-fullscreen-capture');
    
    // Auto-save the screenshot to disk
    const filePath = await saveScreenshot(imgBuffer);
    console.log(`Screenshot automatically saved to: ${filePath}`);
    
    // Copy the screenshot to clipboard
    const clipboardSuccess = copyToClipboard(imgBuffer);
    if (clipboardSuccess) {
      console.log('Screenshot copied to clipboard successfully');
    }
    
    // Create sidecar file for the new screenshot
    try {
      const allDisplays = screen.getAllDisplays();
      const primaryDisplay = screen.getPrimaryDisplay();
      
      const metadata: SidecarMetadata = {
        captureTimestamp: new Date().toISOString(),
        captureMethod: 'fullscreen',
        applicationInfo: {
          name: 'System',
          version: '1.0',
          bundleId: 'system'
        },
        screenInfo: {
          displayId: primaryDisplay.id.toString(),
          resolution: {
            width: primaryDisplay.bounds.width,
            height: primaryDisplay.bounds.height
          },
          scaleFactor: primaryDisplay.scaleFactor
        },
        deviceInfo: {
          osVersion: process.getSystemVersion()
        }
      };

      await sidecarManager.createSidecarFile(filePath, metadata, [], '', []);
      console.log('Sidecar file created for fullscreen shortcut capture:', filePath);
      
      // Notify all renderer windows about the new screenshot
      BrowserWindow.getAllWindows().forEach(window => {
        window.webContents.send('new-screenshot-created', {
          filePath,
          metadata,
          method: 'fullscreen'
        });
      });
    } catch (sidecarError) {
      console.error('Failed to create sidecar file for fullscreen shortcut:', sidecarError);
    }
    
    // Clear the buffer reference to help with memory management
    imgBuffer.fill(0);
    
    logger.info('main', 'Global shortcut full screen capture completed', { filePath });
  } catch (error) {
    logger.error('main', 'Global shortcut full screen capture failed', error as Error);
  }
}

async function triggerAreaCapture(): Promise<void> {
  try {
    console.time('shortcut-area-capture');
    
    // Show overlay and get area
    const area = await selectAreaOnScreen();
    if (area) {
      // For shortcuts, the overlay coordinates are already correctly positioned
      // We need to apply scale factor but NOT the coordinate transformation again
      const allDisplays = screen.getAllDisplays();
      const targetDisplay = allDisplays.find(d => d.id === area.displayId) || allDisplays[0];
      const scaleFactor = targetDisplay.scaleFactor;
      
      // Apply only scale factor transformation (overlay coordinates are already correct)
      const physicalX = Math.round(area.x * scaleFactor);
      const physicalY = Math.round(area.y * scaleFactor);
      const physicalWidth = Math.round(area.width * scaleFactor);
      const physicalHeight = Math.round(area.height * scaleFactor);
      
      console.log('Direct scale factor transformation for shortcut:', {
        overlay: { x: area.x, y: area.y, width: area.width, height: area.height },
        physical: { x: physicalX, y: physicalY, width: physicalWidth, height: physicalHeight },
        scaleFactor,
        displayId: area.displayId
      });
      
      // Capture the specific display if displayId is provided
      let imgBuffer: Buffer;
      if (area.displayId) {
        const targetDisplayIndex = allDisplays.findIndex(d => d.id === area.displayId);
        
        if (targetDisplayIndex !== -1) {
          console.log('Capturing specific display for shortcut:', area.displayId);
          imgBuffer = await screenshot({ 
            format: 'png',
            screen: targetDisplayIndex
          });
        } else {
          console.log('Display not found, using full screen');
          imgBuffer = await screenshot({ format: 'png' });
        }
      } else {
        imgBuffer = await screenshot({ format: 'png' });
      }
      
      // Use our helper to crop the image with Jimp using direct coordinates
      const croppedBuffer = await cropImage(
        imgBuffer, 
        physicalX, 
        physicalY, 
        physicalWidth, 
        physicalHeight
      );
      
      // Save the cropped screenshot
      const filePath = await saveScreenshot(croppedBuffer);
      console.log('Cropped screenshot saved to:', filePath);
      
      // Copy to clipboard
      const clipboardSuccess = copyToClipboard(croppedBuffer);
      console.log('Clipboard copy success:', clipboardSuccess);
      
      // Create sidecar file for the new screenshot
      try {
        const allDisplays = screen.getAllDisplays();
        const targetDisplay = allDisplays.find(d => d.id === area.displayId) || screen.getPrimaryDisplay();
        
        const metadata: SidecarMetadata = {
          captureTimestamp: new Date().toISOString(),
          captureMethod: 'area',
          applicationInfo: {
            name: 'System',
            version: '1.0',
            bundleId: 'system'
          },
          screenInfo: {
            displayId: targetDisplay.id.toString(),
            resolution: {
              width: targetDisplay.bounds.width,
              height: targetDisplay.bounds.height
            },
            scaleFactor: targetDisplay.scaleFactor
          },
          deviceInfo: {
            osVersion: process.getSystemVersion()
          },
          captureArea: {
            x: area.x,
            y: area.y,
            width: area.width,
            height: area.height
          }
        };

        await sidecarManager.createSidecarFile(filePath, metadata, [], '', []);
        console.log('Sidecar file created for area shortcut capture:', filePath);
        
        // Notify all renderer windows about the new screenshot
        BrowserWindow.getAllWindows().forEach(window => {
          window.webContents.send('new-screenshot-created', {
            filePath,
            metadata,
            method: 'area',
            area: {
              x: area.x,
              y: area.y,
              width: area.width,
              height: area.height
            }
          });
        });
      } catch (sidecarError) {
        console.error('Failed to create sidecar file for area shortcut:', sidecarError);
      }
      
      // Clear buffer references
      croppedBuffer.fill(0);
      imgBuffer.fill(0);
      
      console.timeEnd('shortcut-area-capture');
      logger.info('main', 'Global shortcut area capture completed', { filePath, area: { x: physicalX, y: physicalY, width: physicalWidth, height: physicalHeight } });
    } else {
      console.log('Area capture cancelled by user');
      logger.info('main', 'Global shortcut area capture cancelled by user');
    }
  } catch (error) {
    logger.error('main', 'Global shortcut area capture failed', error as Error);
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

  // Register global shortcuts from config
  const config = loadStorageConfig();
  const shortcutsRegistered = registerGlobalShortcuts(config.shortcuts);
  if (!shortcutsRegistered) {
    logger.warn('main', 'Failed to register some global shortcuts - they may be in use by another application');
  }

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

app.on('will-quit', () => {
  // Unregister all global shortcuts before quitting
  unregisterGlobalShortcuts();
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
    // Re-register shortcuts if they changed
    if (success && config.shortcuts) {
      const shortcutsRegistered = registerGlobalShortcuts(config.shortcuts);
      if (!shortcutsRegistered) {
        logger.warn('main', 'Failed to register updated global shortcuts');
      }
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

// Handle shortcut validation
ipcMain.handle('validate-shortcut', async (event, shortcut) => {
  try {
    // Don't validate empty or very short strings
    if (!shortcut || shortcut.length < 3) {
      return { valid: true }; // Allow partial input while typing
    }
    
    // Don't validate incomplete shortcuts (those ending with +)
    if (shortcut.endsWith('+') || shortcut.includes('++')) {
      return { valid: true }; // Allow partial input while typing
    }
    
    // Check if shortcut is already registered by this app
    if (currentShortcuts) {
      if (currentShortcuts.fullScreen === shortcut || currentShortcuts.areaCapture === shortcut) {
        return { valid: false, reason: 'Shortcut already in use by this application' };
      }
    }
    
    // Try to register temporarily to check availability
    const tempRegistered = globalShortcut.register(shortcut, () => {});
    if (tempRegistered) {
      globalShortcut.unregister(shortcut);
      return { valid: true };
    } else {
      return { valid: false, reason: 'Shortcut already in use by another application' };
    }
  } catch (error) {
    // Don't log errors for incomplete shortcuts
    if (shortcut && (shortcut.endsWith('+') || shortcut.length < 5)) {
      return { valid: true }; // Allow partial input while typing
    }
    logger.error('main', 'Failed to validate shortcut', error as Error);
    return { valid: false, reason: 'Invalid shortcut format' };
  }
});

// Handle shortcut registration test
ipcMain.handle('test-shortcuts', async (event, shortcuts: ShortcutConfig) => {
  try {
    // Test registration without actually keeping them
    const fullScreenTest = globalShortcut.register(shortcuts.fullScreen, () => {});
    const areaTest = globalShortcut.register(shortcuts.areaCapture, () => {});
    
    // Clean up test registrations
    if (fullScreenTest) globalShortcut.unregister(shortcuts.fullScreen);
    if (areaTest) globalShortcut.unregister(shortcuts.areaCapture);
    
    return {
      fullScreen: { available: fullScreenTest },
      areaCapture: { available: areaTest }
    };
  } catch (error) {
    logger.error('main', 'Failed to test shortcuts', error as Error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      fullScreen: { available: false, error: errorMessage },
      areaCapture: { available: false, error: errorMessage }
    };
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

// Transform overlay coordinates to actual screen coordinates for cropping
// The overlay coordinates are relative to the workArea, but we need them relative to the full display bounds for screenshot cropping
function transformOverlayToScreenCoordinates(overlayArea: { x: number; y: number; width: number; height: number; displayId?: number }): { x: number; y: number; width: number; height: number; displayId: number } {
  const allDisplays = screen.getAllDisplays();
  
  // Find the display for this area selection
  let targetDisplay: Electron.Display;
  
  if (overlayArea.displayId) {
    targetDisplay = allDisplays.find(d => d.id === overlayArea.displayId) || allDisplays[0];
    console.log('Using provided display ID:', overlayArea.displayId);
  } else {
    targetDisplay = allDisplays[0];
    console.log('No display ID provided, using primary display');
  }
  
  console.log('Target display for coordinate transformation:', {
    display: targetDisplay.id,
    bounds: targetDisplay.bounds,
    workArea: targetDisplay.workArea,
    scaleFactor: targetDisplay.scaleFactor
  });
  
  // Calculate the offset between workArea and bounds (accounts for menu bar, dock, etc.)
  const workAreaOffsetX = targetDisplay.workArea.x - targetDisplay.bounds.x;
  const workAreaOffsetY = targetDisplay.workArea.y - targetDisplay.bounds.y;
  
  console.log('Work area offset from bounds:', { offsetX: workAreaOffsetX, offsetY: workAreaOffsetY });
  
  // Transform overlay coordinates (relative to workArea) to display bounds coordinates
  const displayX = overlayArea.x + workAreaOffsetX;
  const displayY = overlayArea.y + workAreaOffsetY;
  
  // Apply scale factor to get physical pixels for cropping
  const scaleFactor = targetDisplay.scaleFactor;
  const physicalX = Math.round(displayX * scaleFactor);
  const physicalY = Math.round(displayY * scaleFactor);
  const physicalWidth = Math.round(overlayArea.width * scaleFactor);
  const physicalHeight = Math.round(overlayArea.height * scaleFactor);
  
  // Add coordinate validation
  const maxWidth = Math.round(targetDisplay.bounds.width * scaleFactor);
  const maxHeight = Math.round(targetDisplay.bounds.height * scaleFactor);
  
  const validatedX = Math.max(0, Math.min(physicalX, maxWidth - 1));
  const validatedY = Math.max(0, Math.min(physicalY, maxHeight - 1));
  const validatedWidth = Math.max(1, Math.min(physicalWidth, maxWidth - validatedX));
  const validatedHeight = Math.max(1, Math.min(physicalHeight, maxHeight - validatedY));
  
  console.log('Coordinate transformation with workArea offset:', {
    overlay: { x: overlayArea.x, y: overlayArea.y, width: overlayArea.width, height: overlayArea.height },
    displayLogical: { x: displayX, y: displayY },
    physicalRaw: { x: physicalX, y: physicalY, width: physicalWidth, height: physicalHeight },
    physicalValidated: { x: validatedX, y: validatedY, width: validatedWidth, height: validatedHeight },
    scaleFactor,
    workAreaOffset: { x: workAreaOffsetX, y: workAreaOffsetY },
    displayBounds: { width: maxWidth, height: maxHeight },
    displayId: targetDisplay.id
  });
  
  return {
    x: validatedX,
    y: validatedY,
    width: validatedWidth,
    height: validatedHeight,
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
      console.log(`Creating overlay ${index + 1}/${totalDisplays} for display ${display.id}:`, display.bounds, 'workArea:', display.workArea);
      
      const overlayWindow = new BrowserWindow({
        width: display.workArea.width,
        height: display.workArea.height,
        x: display.workArea.x,
        y: display.workArea.y,
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
ipcMain.handle('capture-area', async (event, params) => {
  try {
    const { area, displayId: targetDisplayId } = params;
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
    console.log(`🔍 [IPC] Checking file existence: ${filePath}`);
    
    if (!filePath || typeof filePath !== 'string') {
      console.error(`❌ [IPC] Invalid file path provided: ${filePath}`);
      return false;
    }
    
    const exists = fs.existsSync(filePath);
    console.log(`✅ [IPC] File exists check result for ${filePath}: ${exists}`);
    return exists;
  } catch (error) {
    console.error(`❌ [IPC] Failed to check file existence for ${filePath}:`, error);
    logger.error('main', 'Failed to check file existence', error as Error);
    return false;
  }
});

// Handle getting file statistics (size, etc.)
ipcMain.handle('file-stats', async (event, filePath: string) => {
  try {
    console.log(`📊 [IPC] Getting file stats for: ${filePath}`);
    
    if (!filePath || typeof filePath !== 'string') {
      console.error(`❌ [IPC] Invalid file path provided: ${filePath}`);
      return { success: false, error: 'Invalid file path' };
    }
    
    if (!fs.existsSync(filePath)) {
      console.warn(`⚠️ [IPC] File does not exist: ${filePath}`);
      return { success: false, error: 'File does not exist' };
    }
    
    const stats = fs.statSync(filePath);
    const result = {
      success: true,
      size: stats.size,
      created: stats.birthtime,
      modified: stats.mtime,
      isFile: stats.isFile(),
      isDirectory: stats.isDirectory()
    };
    
    console.log(`✅ [IPC] File stats retrieved for ${filePath}: ${Math.round(stats.size / 1024 / 1024 * 10) / 10}MB`);
    return result;
  } catch (error) {
    console.error(`❌ [IPC] Failed to get file stats for ${filePath}:`, error);
    logger.error('main', 'Failed to get file stats', error as Error);
    return { success: false, error: (error as Error).message };
  }
});

// Handle reading image files as base64
ipcMain.handle('read-image-file', async (event, filePath: string) => {
  try {
    console.log(`📖 [IPC] Starting to read image file: ${filePath}`);
    logger.info('main', `Reading image file: ${filePath}`);
    
    if (!filePath || typeof filePath !== 'string') {
      const errorMsg = `Invalid file path provided: ${filePath}`;
      console.error(`❌ [IPC] ${errorMsg}`);
      return { success: false, error: errorMsg };
    }
    
    // Check if file exists before trying to read (async)
    try {
      await fs.promises.access(filePath, fs.constants.F_OK);
    } catch {
      const errorMsg = `File does not exist: ${filePath}`;
      console.error(`❌ [IPC] ${errorMsg}`);
      return { success: false, error: errorMsg };
    }
    
    // Get file stats for logging (async)
    const stats = await fs.promises.stat(filePath);
    const fileSizeMB = Math.round(stats.size / 1024 / 1024 * 100) / 100;
    console.log(`📖 [IPC] File size: ${fileSizeMB}MB`);
    
    // File size limit (10MB)
    if (stats.size > 10 * 1024 * 1024) {
      const errorMsg = `File too large: ${fileSizeMB}MB (max 10MB)`;
      console.error(`❌ [IPC] ${errorMsg}`);
      return { success: false, error: errorMsg };
    }
    
    console.log(`📖 [IPC] Reading file buffer...`);
    const buffer = await fs.promises.readFile(filePath);
    
    console.log(`📖 [IPC] Converting buffer to base64...`);
    const base64 = buffer.toString('base64');
    const base64SizeKB = Math.round(base64.length / 1024);
    
    console.log(`✅ [IPC] Successfully read image file: ${filePath} (${base64SizeKB}KB base64)`);
    return { success: true, base64 };
  } catch (error) {
    const errorMsg = `Failed to read image file: ${(error as Error).message}`;
    console.error(`❌ [IPC] ${errorMsg} for file: ${filePath}`, error);
    logger.error('main', 'Failed to read image file', error as Error);
    return { success: false, error: errorMsg };
  }
});

// Handle copying screenshot to clipboard
ipcMain.handle('copy-screenshot-to-clipboard', async (event, data: { base64Image: string; filePath?: string }) => {
  try {
    console.log('🔄 [IPC] Copying screenshot to clipboard');
    
    if (!data || !data.base64Image) {
      const errorMsg = 'Invalid screenshot data provided';
      console.error(`❌ [IPC] ${errorMsg}`);
      return { success: false, error: errorMsg };
    }

    // Convert base64 to buffer
    const buffer = Buffer.from(data.base64Image, 'base64');
    
    // Use existing copyToClipboard function
    const success = copyToClipboard(buffer);
    
    if (success) {
      console.log('✅ [IPC] Screenshot copied to clipboard successfully');
      return { success: true };
    } else {
      const errorMsg = 'Failed to copy screenshot to clipboard';
      console.error(`❌ [IPC] ${errorMsg}`);
      return { success: false, error: errorMsg };
    }
  } catch (error) {
    const errorMsg = `Error copying screenshot to clipboard: ${(error as Error).message}`;
    console.error(`❌ [IPC] ${errorMsg}`, error);
    return { success: false, error: errorMsg };
  }
});
