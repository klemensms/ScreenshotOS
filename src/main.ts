// filepath: /Users/klemensstelk/Repo/ScreenshotOS/src/main.ts
import { app, BrowserWindow, ipcMain, dialog, clipboard } from 'electron';
import path from 'path';
import screenshot from 'screenshot-desktop';
import fs from 'fs';
import { homedir } from 'os';
import { loadStorageConfig, ensureSaveDirectory, saveStorageConfig } from './config/storage';

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

function createWindow() {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // Get the absolute path to the HTML file
  const indexHtmlPath = path.join(__dirname, 'index.html');
  console.log('Loading HTML from:', indexHtmlPath);

  // Check if the file exists
  if (fs.existsSync(indexHtmlPath)) {
    console.log('index.html exists at the path');
    win.loadFile(indexHtmlPath);
  } else {
    console.error('index.html not found at path:', indexHtmlPath);
  }

  // Open DevTools for debugging
  win.webContents.openDevTools();
}

app.whenReady().then(() => {
  createWindow();

  // For macOS, inform about screen recording permission
  if (process.platform === 'darwin') {
    // On macOS, screen recording permission is requested automatically 
    // when the screenshot is first attempted via screenshot-desktop
    console.log('Running on macOS - screen recording permission will be requested when needed');
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
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
    
    // Return the image as a base64 string to the renderer along with the saved path
    return {
      base64Image: imgBuffer.toString('base64'),
      savedFilePath: filePath
    };
  } catch (error) {
    console.error('Screenshot capture failed:', error);
    
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
    console.error('Failed to save screenshot:', error);
    
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
    console.error('Failed to load storage config:', error);
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
    return false;
  }
});

// Handle directory selection dialog
ipcMain.handle('select-directory', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory'],
    title: 'Select Screenshot Save Location'
  });
  return result;
});
