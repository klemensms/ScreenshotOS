"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// filepath: /Users/klemensstelk/Repo/ScreenshotOS/src/main.ts
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
const screenshot_desktop_1 = __importDefault(require("screenshot-desktop"));
const fs_1 = __importDefault(require("fs"));
const storage_1 = require("./config/storage");
const jimp_native_1 = require("./utils/jimp-native");
const logger_1 = require("./utils/logger");
const sidecar_manager_1 = require("./utils/sidecar-manager");
// Get screenshot save directory from config
let screenshotSaveDir = (0, storage_1.loadStorageConfig)().saveDirectory;
// Global shortcuts state
let currentShortcuts = null;
// Ensure the save directory exists
function ensureSaveDirectoryExists() {
    screenshotSaveDir = (0, storage_1.ensureSaveDirectory)(screenshotSaveDir);
}
// Generate a filename based on timestamp
function generateFilename() {
    const config = (0, storage_1.loadStorageConfig)();
    const date = new Date();
    const timestamp = date.toISOString()
        .replace(/:/g, '-')
        .replace(/\..+/, '')
        .replace('T', '_');
    return config.filenameTemplate.replace('%TIMESTAMP%', timestamp) + '.' + config.fileFormat;
}
// Save the screenshot to disk
async function saveScreenshot(imgBuffer) {
    ensureSaveDirectoryExists();
    const filename = generateFilename();
    const filePath = path_1.default.join(screenshotSaveDir, filename);
    return new Promise((resolve, reject) => {
        fs_1.default.writeFile(filePath, imgBuffer, (err) => {
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
function copyToClipboard(imgBuffer) {
    try {
        console.time('clipboard-copy');
        // Create an image object from the buffer that the clipboard can understand
        const nativeImage = require('electron').nativeImage.createFromBuffer(imgBuffer);
        // Copy the image to clipboard
        electron_1.clipboard.writeImage(nativeImage);
        console.timeEnd('clipboard-copy');
        console.log('Screenshot copied to clipboard');
        return true;
    }
    catch (error) {
        console.error('Failed to copy to clipboard:', error);
        return false;
    }
}
// Global shortcut management
function registerGlobalShortcuts(shortcuts) {
    try {
        // Unregister existing shortcuts first
        unregisterGlobalShortcuts();
        logger_1.logger.info('main', 'Registering global shortcuts', shortcuts);
        // Register full screen capture shortcut
        const fullScreenRegistered = electron_1.globalShortcut.register(shortcuts.fullScreen, async () => {
            logger_1.logger.info('main', 'Full screen capture triggered by shortcut');
            await triggerFullScreenCapture();
        });
        if (!fullScreenRegistered) {
            logger_1.logger.error('main', 'Failed to register full screen shortcut', new Error(`Shortcut ${shortcuts.fullScreen} already in use`));
            return false;
        }
        // Register area capture shortcut
        const areaRegistered = electron_1.globalShortcut.register(shortcuts.areaCapture, async () => {
            logger_1.logger.info('main', 'Area capture triggered by shortcut');
            await triggerAreaCapture();
        });
        if (!areaRegistered) {
            logger_1.logger.error('main', 'Failed to register area capture shortcut', new Error(`Shortcut ${shortcuts.areaCapture} already in use`));
            electron_1.globalShortcut.unregister(shortcuts.fullScreen); // Clean up
            return false;
        }
        currentShortcuts = shortcuts;
        logger_1.logger.info('main', 'Global shortcuts registered successfully');
        return true;
    }
    catch (error) {
        logger_1.logger.error('main', 'Failed to register global shortcuts', error);
        return false;
    }
}
function unregisterGlobalShortcuts() {
    if (currentShortcuts) {
        electron_1.globalShortcut.unregister(currentShortcuts.fullScreen);
        electron_1.globalShortcut.unregister(currentShortcuts.areaCapture);
        logger_1.logger.info('main', 'Unregistered global shortcuts');
    }
    currentShortcuts = null;
}
// Trigger functions for shortcuts
async function triggerFullScreenCapture() {
    try {
        console.time('shortcut-fullscreen-capture');
        // Use screenshot-desktop which utilizes native macOS Core Graphics APIs
        const imgBuffer = await (0, screenshot_desktop_1.default)({ format: 'png' });
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
            const allDisplays = electron_1.screen.getAllDisplays();
            const primaryDisplay = electron_1.screen.getPrimaryDisplay();
            const metadata = {
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
            await sidecar_manager_1.sidecarManager.createSidecarFile(filePath, metadata, [], '', []);
            console.log('Sidecar file created for fullscreen shortcut capture:', filePath);
            // Notify all renderer windows about the new screenshot
            electron_1.BrowserWindow.getAllWindows().forEach(window => {
                window.webContents.send('new-screenshot-created', {
                    filePath,
                    metadata,
                    method: 'fullscreen'
                });
            });
        }
        catch (sidecarError) {
            console.error('Failed to create sidecar file for fullscreen shortcut:', sidecarError);
        }
        // Clear the buffer reference to help with memory management
        imgBuffer.fill(0);
        logger_1.logger.info('main', 'Global shortcut full screen capture completed', { filePath });
    }
    catch (error) {
        logger_1.logger.error('main', 'Global shortcut full screen capture failed', error);
    }
}
async function triggerAreaCapture() {
    try {
        console.time('shortcut-area-capture');
        // Show overlay and get area
        const area = await selectAreaOnScreen();
        if (area) {
            // For shortcuts, the overlay coordinates are already correctly positioned
            // We need to apply scale factor but NOT the coordinate transformation again
            const allDisplays = electron_1.screen.getAllDisplays();
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
            let imgBuffer;
            if (area.displayId) {
                const targetDisplayIndex = allDisplays.findIndex(d => d.id === area.displayId);
                if (targetDisplayIndex !== -1) {
                    console.log('Capturing specific display for shortcut:', area.displayId);
                    imgBuffer = await (0, screenshot_desktop_1.default)({
                        format: 'png',
                        screen: targetDisplayIndex
                    });
                }
                else {
                    console.log('Display not found, using full screen');
                    imgBuffer = await (0, screenshot_desktop_1.default)({ format: 'png' });
                }
            }
            else {
                imgBuffer = await (0, screenshot_desktop_1.default)({ format: 'png' });
            }
            // Use our helper to crop the image with Jimp using direct coordinates
            const croppedBuffer = await (0, jimp_native_1.cropImage)(imgBuffer, physicalX, physicalY, physicalWidth, physicalHeight);
            // Save the cropped screenshot
            const filePath = await saveScreenshot(croppedBuffer);
            console.log('Cropped screenshot saved to:', filePath);
            // Copy to clipboard
            const clipboardSuccess = copyToClipboard(croppedBuffer);
            console.log('Clipboard copy success:', clipboardSuccess);
            // Create sidecar file for the new screenshot
            try {
                const allDisplays = electron_1.screen.getAllDisplays();
                const targetDisplay = allDisplays.find(d => d.id === area.displayId) || electron_1.screen.getPrimaryDisplay();
                const metadata = {
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
                await sidecar_manager_1.sidecarManager.createSidecarFile(filePath, metadata, [], '', []);
                console.log('Sidecar file created for area shortcut capture:', filePath);
                // Notify all renderer windows about the new screenshot
                electron_1.BrowserWindow.getAllWindows().forEach(window => {
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
            }
            catch (sidecarError) {
                console.error('Failed to create sidecar file for area shortcut:', sidecarError);
            }
            // Clear buffer references
            croppedBuffer.fill(0);
            imgBuffer.fill(0);
            console.timeEnd('shortcut-area-capture');
            logger_1.logger.info('main', 'Global shortcut area capture completed', { filePath, area: { x: physicalX, y: physicalY, width: physicalWidth, height: physicalHeight } });
        }
        else {
            console.log('Area capture cancelled by user');
            logger_1.logger.info('main', 'Global shortcut area capture cancelled by user');
        }
    }
    catch (error) {
        logger_1.logger.error('main', 'Global shortcut area capture failed', error);
    }
}
async function createWindow() {
    const win = new electron_1.BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            preload: path_1.default.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
        },
    });
    // Load the HTML file with fallback handling
    const indexHtmlPath = path_1.default.join(__dirname, 'index.html');
    console.log('Loading HTML from:', indexHtmlPath);
    try {
        await win.loadFile(indexHtmlPath);
        console.log('Successfully loaded index.html');
    }
    catch (error) {
        console.error('Failed to load index.html:', error);
        // Show error dialog if HTML file cannot be loaded
        electron_1.dialog.showErrorBox('Application Error', 'Failed to load the application interface. Please reinstall the application.');
    }
    // Open DevTools only in development
    if (process.env.NODE_ENV === 'development' || !electron_1.app.isPackaged) {
        win.webContents.openDevTools();
    }
}
// Global error handlers for main process
process.on('uncaughtException', (error) => {
    logger_1.logger.error('main', 'Uncaught Exception', error);
});
process.on('unhandledRejection', (reason, promise) => {
    logger_1.logger.error('main', 'Unhandled Promise Rejection', reason, { promise: promise.toString() });
});
electron_1.app.whenReady().then(async () => {
    logger_1.logger.info('main', 'App ready, creating window');
    await createWindow();
    // Register global shortcuts from config
    const config = (0, storage_1.loadStorageConfig)();
    const shortcutsRegistered = registerGlobalShortcuts(config.shortcuts);
    if (!shortcutsRegistered) {
        logger_1.logger.warn('main', 'Failed to register some global shortcuts - they may be in use by another application');
    }
    // For macOS, inform about screen recording permission
    if (process.platform === 'darwin') {
        // On macOS, screen recording permission is requested automatically 
        // when the screenshot is first attempted via screenshot-desktop
        console.log('Running on macOS - screen recording permission will be requested when needed');
        logger_1.logger.info('main', 'Running on macOS - screen recording permission will be requested when needed');
    }
    electron_1.app.on('activate', async () => {
        if (electron_1.BrowserWindow.getAllWindows().length === 0)
            await createWindow();
    });
});
electron_1.app.on('window-all-closed', () => {
    if (process.platform !== 'darwin')
        electron_1.app.quit();
});
electron_1.app.on('will-quit', () => {
    // Unregister all global shortcuts before quitting
    unregisterGlobalShortcuts();
});
// Enhanced screenshot capture with performance optimization and error handling
electron_1.ipcMain.handle('capture-fullscreen', async () => {
    try {
        console.time('screenshot-capture');
        // Use screenshot-desktop which utilizes native macOS Core Graphics APIs
        const imgBuffer = await (0, screenshot_desktop_1.default)({ format: 'png' });
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
        }
        else {
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
    }
    catch (error) {
        logger_1.logger.error('main', 'Screenshot capture failed', error);
        // Show error dialog to user
        electron_1.dialog.showErrorBox('Screenshot Failed', 'Failed to capture screenshot. Please check if screen recording permission is granted.');
        return null;
    }
});
// Handle save screenshot request
electron_1.ipcMain.handle('save-screenshot', async (event, base64Image) => {
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
    }
    catch (error) {
        logger_1.logger.error('main', 'Failed to save screenshot', error);
        // Show error dialog to user
        electron_1.dialog.showErrorBox('Save Screenshot Failed', 'Failed to save screenshot. Please try again.');
        return {
            success: false,
            error: error.message
        };
    }
});
// Handle loading storage config
electron_1.ipcMain.handle('load-storage-config', async () => {
    try {
        return (0, storage_1.loadStorageConfig)();
    }
    catch (error) {
        logger_1.logger.error('main', 'Failed to load storage config', error);
        electron_1.dialog.showErrorBox('Configuration Error', 'Failed to load application settings. Using defaults.');
        return null;
    }
});
// Handle saving storage config
electron_1.ipcMain.handle('save-storage-config', async (event, config) => {
    try {
        const success = (0, storage_1.saveStorageConfig)(config);
        // Update the current save directory
        if (success && config.saveDirectory) {
            screenshotSaveDir = config.saveDirectory;
        }
        // Re-register shortcuts if they changed
        if (success && config.shortcuts) {
            const shortcutsRegistered = registerGlobalShortcuts(config.shortcuts);
            if (!shortcutsRegistered) {
                logger_1.logger.warn('main', 'Failed to register updated global shortcuts');
            }
        }
        return success;
    }
    catch (error) {
        console.error('Failed to save storage config:', error);
        electron_1.dialog.showErrorBox('Configuration Error', 'Failed to save application settings.');
        return false;
    }
});
// Handle directory selection dialog
electron_1.ipcMain.handle('select-directory', async () => {
    try {
        const result = await electron_1.dialog.showOpenDialog({
            properties: ['openDirectory'],
            title: 'Select Screenshot Save Location'
        });
        return result;
    }
    catch (error) {
        console.error('Failed to open directory selection dialog:', error);
        return { canceled: true, filePaths: [] };
    }
});
// Handle shortcut validation
electron_1.ipcMain.handle('validate-shortcut', async (event, shortcut) => {
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
        const tempRegistered = electron_1.globalShortcut.register(shortcut, () => { });
        if (tempRegistered) {
            electron_1.globalShortcut.unregister(shortcut);
            return { valid: true };
        }
        else {
            return { valid: false, reason: 'Shortcut already in use by another application' };
        }
    }
    catch (error) {
        // Don't log errors for incomplete shortcuts
        if (shortcut && (shortcut.endsWith('+') || shortcut.length < 5)) {
            return { valid: true }; // Allow partial input while typing
        }
        logger_1.logger.error('main', 'Failed to validate shortcut', error);
        return { valid: false, reason: 'Invalid shortcut format' };
    }
});
// Handle shortcut registration test
electron_1.ipcMain.handle('test-shortcuts', async (event, shortcuts) => {
    try {
        // Test registration without actually keeping them
        const fullScreenTest = electron_1.globalShortcut.register(shortcuts.fullScreen, () => { });
        const areaTest = electron_1.globalShortcut.register(shortcuts.areaCapture, () => { });
        // Clean up test registrations
        if (fullScreenTest)
            electron_1.globalShortcut.unregister(shortcuts.fullScreen);
        if (areaTest)
            electron_1.globalShortcut.unregister(shortcuts.areaCapture);
        return {
            fullScreen: { available: fullScreenTest },
            areaCapture: { available: areaTest }
        };
    }
    catch (error) {
        logger_1.logger.error('main', 'Failed to test shortcuts', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return {
            fullScreen: { available: false, error: errorMessage },
            areaCapture: { available: false, error: errorMessage }
        };
    }
});
// Overlay windows reference and area selection promise
let overlayWindows = [];
let areaSelectionResolver = null;
// Listen for area selection from overlay
electron_1.ipcMain.on('area-selection', (event, area) => {
    console.log('Received area selection event:', area);
    if (areaSelectionResolver) {
        if (area && area.cancel) {
            console.log('User cancelled area selection');
            areaSelectionResolver(null);
        }
        else if (area) {
            // Transform overlay coordinates to screen coordinates
            const transformedArea = transformOverlayToScreenCoordinates(area);
            console.log('Original overlay area:', area);
            console.log('Transformed screen area:', transformedArea);
            areaSelectionResolver(transformedArea);
        }
        areaSelectionResolver = null;
    }
    else {
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
function transformOverlayToScreenCoordinates(overlayArea) {
    const allDisplays = electron_1.screen.getAllDisplays();
    // Find the display for this area selection
    let targetDisplay;
    if (overlayArea.displayId) {
        targetDisplay = allDisplays.find(d => d.id === overlayArea.displayId) || allDisplays[0];
        console.log('Using provided display ID:', overlayArea.displayId);
    }
    else {
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
async function selectAreaOnScreen() {
    console.log('Starting area selection process with individual display overlays');
    return new Promise((resolve) => {
        console.log('Setting up area selection resolver');
        areaSelectionResolver = resolve;
        // Get all displays to support multi-monitor setups
        const allDisplays = electron_1.screen.getAllDisplays();
        console.log('All displays:', allDisplays.map(d => ({ id: d.id, bounds: d.bounds, scaleFactor: d.scaleFactor })));
        // Create individual overlay windows for each display
        console.log('Creating individual overlay windows for each display');
        overlayWindows = [];
        let readyCount = 0;
        const totalDisplays = allDisplays.length;
        allDisplays.forEach((display, index) => {
            console.log(`Creating overlay ${index + 1}/${totalDisplays} for display ${display.id}:`, display.bounds, 'workArea:', display.workArea);
            const overlayWindow = new electron_1.BrowserWindow({
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
                    preload: path_1.default.join(__dirname, 'overlayPreload.js'),
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
            overlayWindow.loadFile(path_1.default.join(__dirname, 'areaOverlay.html'));
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
electron_1.ipcMain.handle('trigger-area-overlay', async () => {
    try {
        console.log('Trigger area overlay requested');
        // Show overlay and get area
        const area = await selectAreaOnScreen();
        console.log('Area selection completed with result:', area);
        return area;
    }
    catch (error) {
        console.error('Area overlay failed:', error);
        return null;
    }
});
// Update the 'capture-area' handler to only crop and save, given area
electron_1.ipcMain.handle('capture-area', async (event, params) => {
    try {
        const { area, displayId: targetDisplayId } = params;
        if (!area || typeof area.x !== 'number' || typeof area.y !== 'number' || typeof area.width !== 'number' || typeof area.height !== 'number') {
            throw new Error('Invalid area coordinates');
        }
        console.log('Area capture requested:', area);
        console.log('Target display ID:', targetDisplayId);
        // If we have a target display ID, capture only that display
        let imgBuffer;
        if (targetDisplayId) {
            const allDisplays = electron_1.screen.getAllDisplays();
            const targetDisplayIndex = allDisplays.findIndex(d => d.id === targetDisplayId);
            const targetDisplay = allDisplays.find(d => d.id === targetDisplayId);
            if (targetDisplay && targetDisplayIndex !== -1) {
                console.log('Capturing specific display:', targetDisplay.id, targetDisplay.bounds);
                console.log('Using screenshot-desktop index:', targetDisplayIndex);
                // Capture the specific display using the index (not the ID)
                try {
                    imgBuffer = await (0, screenshot_desktop_1.default)({
                        format: 'png',
                        screen: targetDisplayIndex
                    });
                }
                catch (screenError) {
                    console.error('Failed to capture specific display, falling back to full screen:', screenError);
                    imgBuffer = await (0, screenshot_desktop_1.default)({ format: 'png' });
                }
            }
            else {
                console.warn('Target display not found, falling back to full screen');
                imgBuffer = await (0, screenshot_desktop_1.default)({ format: 'png' });
            }
        }
        else {
            // Fallback to full screen capture
            imgBuffer = await (0, screenshot_desktop_1.default)({ format: 'png' });
        }
        console.log('Screenshot captured, size:', imgBuffer.length);
        try {
            // Use our helper to crop the image with Jimp
            const croppedBuffer = await (0, jimp_native_1.cropImage)(imgBuffer, area.x, area.y, area.width, area.height);
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
        }
        catch (jimpError) {
            console.error('Jimp processing error:', jimpError);
            throw jimpError;
        }
    }
    catch (error) {
        logger_1.logger.error('main', 'Area capture failed', error);
        electron_1.dialog.showErrorBox('Area Capture Failed', 'Failed to capture selected area. Please try again.');
        return null;
    }
});
// IPC handlers for log access
electron_1.ipcMain.handle('get-recent-logs', async (event, lines = 100) => {
    try {
        return logger_1.logger.getRecentLogs(lines);
    }
    catch (error) {
        logger_1.logger.error('main', 'Failed to get recent logs', error);
        return 'Failed to retrieve logs';
    }
});
electron_1.ipcMain.handle('get-log-path', async () => {
    try {
        return logger_1.logger.getLogPath();
    }
    catch (error) {
        logger_1.logger.error('main', 'Failed to get log path', error);
        return null;
    }
});
// IPC handler for renderer to send logs
electron_1.ipcMain.handle('log-from-renderer', async (event, logEntry) => {
    try {
        logger_1.logger.log({
            ...logEntry,
            source: 'renderer'
        });
    }
    catch (error) {
        console.error('Failed to log from renderer:', error);
    }
});
// Sidecar file IPC handlers
electron_1.ipcMain.handle('sidecar-create', async (event, imagePath, metadata, tags = [], notes = '', annotations = []) => {
    try {
        logger_1.logger.info('main', `Creating sidecar file for ${imagePath}`);
        const result = await sidecar_manager_1.sidecarManager.createSidecarFile(imagePath, metadata, tags, notes, annotations);
        return { success: result };
    }
    catch (error) {
        logger_1.logger.error('main', 'Failed to create sidecar file', error);
        return { success: false, error: error.message };
    }
});
electron_1.ipcMain.handle('sidecar-load', async (event, imagePath) => {
    try {
        const sidecarData = await sidecar_manager_1.sidecarManager.loadSidecarFile(imagePath);
        return { success: true, data: sidecarData };
    }
    catch (error) {
        logger_1.logger.error('main', 'Failed to load sidecar file', error);
        return { success: false, error: error.message };
    }
});
electron_1.ipcMain.handle('sidecar-update', async (event, imagePath, updates) => {
    try {
        logger_1.logger.info('main', `Updating sidecar file for ${imagePath}`);
        const result = await sidecar_manager_1.sidecarManager.updateSidecarFile(imagePath, updates);
        return { success: result };
    }
    catch (error) {
        logger_1.logger.error('main', 'Failed to update sidecar file', error);
        return { success: false, error: error.message };
    }
});
electron_1.ipcMain.handle('sidecar-add-annotation', async (event, imagePath, annotation) => {
    try {
        logger_1.logger.info('main', `Adding annotation to sidecar file for ${imagePath}`);
        const result = await sidecar_manager_1.sidecarManager.addAnnotation(imagePath, annotation);
        return { success: result };
    }
    catch (error) {
        logger_1.logger.error('main', 'Failed to add annotation to sidecar file', error);
        return { success: false, error: error.message };
    }
});
electron_1.ipcMain.handle('sidecar-remove-annotation', async (event, imagePath, annotationId) => {
    try {
        logger_1.logger.info('main', `Removing annotation from sidecar file for ${imagePath}`);
        const result = await sidecar_manager_1.sidecarManager.removeAnnotation(imagePath, annotationId);
        return { success: result };
    }
    catch (error) {
        logger_1.logger.error('main', 'Failed to remove annotation from sidecar file', error);
        return { success: false, error: error.message };
    }
});
electron_1.ipcMain.handle('sidecar-exists', async (event, imagePath) => {
    try {
        const exists = sidecar_manager_1.sidecarManager.sidecarExists(imagePath);
        return { success: true, exists };
    }
    catch (error) {
        logger_1.logger.error('main', 'Failed to check sidecar existence', error);
        return { success: false, error: error.message };
    }
});
electron_1.ipcMain.handle('sidecar-scan-directory', async (event, directoryPath) => {
    try {
        logger_1.logger.info('main', `Scanning directory for screenshots: ${directoryPath}`);
        const results = await sidecar_manager_1.sidecarManager.scanDirectory(directoryPath);
        return { success: true, data: results };
    }
    catch (error) {
        logger_1.logger.error('main', 'Failed to scan directory for screenshots', error);
        return { success: false, error: error.message };
    }
});
electron_1.ipcMain.handle('sidecar-delete', async (event, imagePath) => {
    try {
        logger_1.logger.info('main', `Deleting sidecar file for ${imagePath}`);
        const result = await sidecar_manager_1.sidecarManager.deleteSidecarFile(imagePath);
        return { success: result };
    }
    catch (error) {
        logger_1.logger.error('main', 'Failed to delete sidecar file', error);
        return { success: false, error: error.message };
    }
});
// Handle file existence checks
electron_1.ipcMain.handle('file-exists', async (event, filePath) => {
    try {
        console.log(`🔍 [IPC] Checking file existence: ${filePath}`);
        if (!filePath || typeof filePath !== 'string') {
            console.error(`❌ [IPC] Invalid file path provided: ${filePath}`);
            return false;
        }
        const exists = fs_1.default.existsSync(filePath);
        console.log(`✅ [IPC] File exists check result for ${filePath}: ${exists}`);
        return exists;
    }
    catch (error) {
        console.error(`❌ [IPC] Failed to check file existence for ${filePath}:`, error);
        logger_1.logger.error('main', 'Failed to check file existence', error);
        return false;
    }
});
// Handle getting file statistics (size, etc.)
electron_1.ipcMain.handle('file-stats', async (event, filePath) => {
    try {
        console.log(`📊 [IPC] Getting file stats for: ${filePath}`);
        if (!filePath || typeof filePath !== 'string') {
            console.error(`❌ [IPC] Invalid file path provided: ${filePath}`);
            return { success: false, error: 'Invalid file path' };
        }
        if (!fs_1.default.existsSync(filePath)) {
            console.warn(`⚠️ [IPC] File does not exist: ${filePath}`);
            return { success: false, error: 'File does not exist' };
        }
        const stats = fs_1.default.statSync(filePath);
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
    }
    catch (error) {
        console.error(`❌ [IPC] Failed to get file stats for ${filePath}:`, error);
        logger_1.logger.error('main', 'Failed to get file stats', error);
        return { success: false, error: error.message };
    }
});
// Handle reading image files as base64
electron_1.ipcMain.handle('read-image-file', async (event, filePath) => {
    try {
        console.log(`📖 [IPC] Starting to read image file: ${filePath}`);
        logger_1.logger.info('main', `Reading image file: ${filePath}`);
        if (!filePath || typeof filePath !== 'string') {
            const errorMsg = `Invalid file path provided: ${filePath}`;
            console.error(`❌ [IPC] ${errorMsg}`);
            return { success: false, error: errorMsg };
        }
        // Check if file exists before trying to read (async)
        try {
            await fs_1.default.promises.access(filePath, fs_1.default.constants.F_OK);
        }
        catch {
            const errorMsg = `File does not exist: ${filePath}`;
            console.error(`❌ [IPC] ${errorMsg}`);
            return { success: false, error: errorMsg };
        }
        // Get file stats for logging (async)
        const stats = await fs_1.default.promises.stat(filePath);
        const fileSizeMB = Math.round(stats.size / 1024 / 1024 * 100) / 100;
        console.log(`📖 [IPC] File size: ${fileSizeMB}MB`);
        // File size limit (10MB)
        if (stats.size > 10 * 1024 * 1024) {
            const errorMsg = `File too large: ${fileSizeMB}MB (max 10MB)`;
            console.error(`❌ [IPC] ${errorMsg}`);
            return { success: false, error: errorMsg };
        }
        console.log(`📖 [IPC] Reading file buffer...`);
        const buffer = await fs_1.default.promises.readFile(filePath);
        console.log(`📖 [IPC] Converting buffer to base64...`);
        const base64 = buffer.toString('base64');
        const base64SizeKB = Math.round(base64.length / 1024);
        console.log(`✅ [IPC] Successfully read image file: ${filePath} (${base64SizeKB}KB base64)`);
        return { success: true, base64 };
    }
    catch (error) {
        const errorMsg = `Failed to read image file: ${error.message}`;
        console.error(`❌ [IPC] ${errorMsg} for file: ${filePath}`, error);
        logger_1.logger.error('main', 'Failed to read image file', error);
        return { success: false, error: errorMsg };
    }
});
// Handle copying screenshot to clipboard
electron_1.ipcMain.handle('copy-screenshot-to-clipboard', async (event, data) => {
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
        }
        else {
            const errorMsg = 'Failed to copy screenshot to clipboard';
            console.error(`❌ [IPC] ${errorMsg}`);
            return { success: false, error: errorMsg };
        }
    }
    catch (error) {
        const errorMsg = `Error copying screenshot to clipboard: ${error.message}`;
        console.error(`❌ [IPC] ${errorMsg}`, error);
        return { success: false, error: errorMsg };
    }
});
