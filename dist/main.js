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
const ImageIndexer_1 = require("./services/ImageIndexer");
const ThumbnailCache_1 = require("./services/ThumbnailCache");
const FileManager_1 = require("./services/FileManager");
const ocr_service_1 = require("./utils/ocr-service");
const active_win_1 = __importDefault(require("active-win"));
// Get screenshot save directory from config
let screenshotSaveDir = (0, storage_1.loadStorageConfig)().saveDirectory;
// Global shortcuts state
let currentShortcuts = null;
// Image indexer instance
let imageIndexer = null;
// Thumbnail cache instance
let thumbnailCache = null;
// Ensure the save directory exists
function ensureSaveDirectoryExists() {
    screenshotSaveDir = (0, storage_1.ensureSaveDirectory)(screenshotSaveDir);
}
// Get current application information for metadata
async function getCurrentApplicationInfo() {
    try {
        console.log('🔍 [APP_INFO] Getting current application info...');
        const info = await (0, active_win_1.default)({
            screenRecordingPermission: true,
            accessibilityPermission: false
        });
        console.log('🔍 [APP_INFO] ActiveWin result:', {
            hasInfo: !!info,
            hasOwner: info?.owner ? true : false,
            ownerName: info?.owner?.name,
            bundleId: info?.owner && 'bundleId' in info.owner ? info.owner.bundleId : undefined,
            windowTitle: info?.title
        });
        if (info && info.owner) {
            const result = {
                name: info.owner.name,
                bundleId: 'bundleId' in info.owner ? info.owner.bundleId : undefined,
                version: undefined, // not available from active-win
                windowTitle: info.title
            };
            // Check if we detected the Electron app itself
            if (result.bundleId === 'com.github.Electron' || result.name === 'Electron') {
                console.warn('⚠️ [APP_INFO] Detected Electron app - this may be incorrect timing');
                console.warn('⚠️ [APP_INFO] Full info:', result);
            }
            console.log('✅ [APP_INFO] Successfully detected application:', result);
            return result;
        }
    }
    catch (error) {
        console.warn('❌ [APP_INFO] Failed to get active application info:', error);
    }
    // Fallback to system info
    const fallback = {
        name: 'System',
        bundleId: 'system',
        version: '1.0',
        windowTitle: undefined
    };
    console.log('🔄 [APP_INFO] Using fallback application info:', fallback);
    return fallback;
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
            // Add to image index if available
            if (imageIndexer) {
                imageIndexer.addImage(filePath).catch((error) => {
                    logger_1.logger.warn('main', 'Failed to add image to index', error);
                });
            }
            // Queue for OCR processing
            ocr_service_1.ocrService.queueForOCR(filePath).catch((error) => {
                logger_1.logger.warn('main', 'Failed to queue image for OCR', error);
            });
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
        // IMPORTANT: Capture application info FIRST, before any screenshot operations
        // This ensures we get the actual target app instead of the Electron app
        const applicationInfo = await getCurrentApplicationInfo();
        console.log('🎯 [FULLSCREEN] Captured application info before screenshot:', applicationInfo);
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
                applicationInfo,
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
        // IMPORTANT: Capture application info FIRST, before showing any overlay
        // This ensures we get the actual target app instead of the Electron app
        const applicationInfo = await getCurrentApplicationInfo();
        console.log('🎯 [AREA] Captured application info before overlay:', applicationInfo);
        // Show overlay and get area
        const area = await selectAreaOnScreen();
        if (area) {
            // ===== UNIFIED COORDINATE TRANSFORMATION =====
            // Use the same transformation logic as the IPC path for consistency
            const areaWithDisplayId = { ...area, displayId: area.displayId };
            const transformedArea = transformOverlayToScreenCoordinates(areaWithDisplayId);
            console.log('🔄 [SHORTCUT_CAPTURE] Using unified coordinate transformation:', {
                originalOverlay: area,
                transformedPhysical: transformedArea,
                method: 'unified_transformation'
            });
            // Capture the specific display if displayId is provided
            let imgBuffer;
            if (area.displayId) {
                const allDisplays = electron_1.screen.getAllDisplays();
                const targetDisplayIndex = allDisplays.findIndex((d) => d.id === area.displayId);
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
            // Use our helper to crop the image with Jimp using transformed coordinates
            console.log('🔪 [SHORTCUT_CAPTURE] Cropping image with transformed coordinates:', {
                x: transformedArea.x,
                y: transformedArea.y,
                width: transformedArea.width,
                height: transformedArea.height
            });
            const croppedBuffer = await (0, jimp_native_1.cropImage)(imgBuffer, transformedArea.x, transformedArea.y, transformedArea.width, transformedArea.height);
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
                    applicationInfo,
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
            logger_1.logger.info('main', 'Global shortcut area capture completed', { filePath, area: transformedArea });
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
    // Initialize services
    const config = (0, storage_1.loadStorageConfig)();
    // Initialize ImageIndexer for background scanning
    imageIndexer = new ImageIndexer_1.ImageIndexer();
    thumbnailCache = new ThumbnailCache_1.ThumbnailCache();
    // Start background indexing of screenshot directory
    imageIndexer.startIndexing(config.saveDirectory).catch((error) => {
        logger_1.logger.error('main', 'Failed to start image indexing', error);
    });
    // Register global shortcuts from config
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
electron_1.app.on('will-quit', async (event) => {
    // Prevent immediate quit to allow cleanup
    event.preventDefault();
    try {
        // Unregister all global shortcuts before quitting
        unregisterGlobalShortcuts();
        // Cleanup services
        if (imageIndexer) {
            await imageIndexer.shutdown();
        }
        // Cleanup OCR service
        await ocr_service_1.ocrService.cleanup();
        // Thumbnail cache doesn't need special cleanup, but we could add it here
        console.log('🏁 [MAIN] Cleanup completed, quitting app');
    }
    catch (error) {
        console.error('Error during cleanup:', error);
    }
    finally {
        // Actually quit the app
        electron_1.app.quit();
    }
});
// Enhanced screenshot capture with performance optimization and error handling
electron_1.ipcMain.handle('capture-fullscreen', async () => {
    try {
        console.time('screenshot-capture');
        // IMPORTANT: Capture application info FIRST, before any screenshot operations
        // This ensures we get the actual target app instead of the Electron app
        const applicationInfo = await getCurrentApplicationInfo();
        console.log('🎯 [IPC_FULLSCREEN] Captured application info before screenshot:', applicationInfo);
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
        // Create sidecar file for the new fullscreen screenshot
        try {
            const allDisplays = electron_1.screen.getAllDisplays();
            const primaryDisplay = electron_1.screen.getPrimaryDisplay();
            const metadata = {
                captureTimestamp: new Date().toISOString(),
                captureMethod: 'fullscreen',
                applicationInfo,
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
            console.log('Sidecar file created for IPC fullscreen capture:', filePath);
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
            console.error('Failed to create sidecar file for IPC fullscreen capture:', sidecarError);
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
            // Pass through raw overlay coordinates - transformation will happen in capture functions
            console.log('Passing raw overlay area to capture function:', area);
            areaSelectionResolver(area);
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
    console.log('🔄 [COORD_TRANSFORM] Starting coordinate transformation with input:', overlayArea);
    // ===== COMPREHENSIVE INPUT VALIDATION =====
    if (!overlayArea || typeof overlayArea !== 'object') {
        throw new Error('[COORD_TRANSFORM] Invalid overlayArea: must be an object');
    }
    const { x, y, width, height, displayId } = overlayArea;
    // Validate numeric inputs
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(width) || !Number.isFinite(height)) {
        throw new Error(`[COORD_TRANSFORM] Invalid coordinates: x=${x}, y=${y}, width=${width}, height=${height}`);
    }
    // Validate area dimensions
    if (width <= 0 || height <= 0) {
        throw new Error(`[COORD_TRANSFORM] Invalid area dimensions: width=${width}, height=${height} (must be positive)`);
    }
    // Validate display ID if provided
    if (displayId !== undefined && (!Number.isInteger(displayId) || displayId < 0)) {
        throw new Error(`[COORD_TRANSFORM] Invalid displayId: ${displayId} (must be a non-negative integer)`);
    }
    // Get all displays with error checking
    const allDisplays = electron_1.screen.getAllDisplays();
    if (!allDisplays || allDisplays.length === 0) {
        throw new Error('[COORD_TRANSFORM] No displays available');
    }
    console.log('🖥️ [COORD_TRANSFORM] Available displays:', allDisplays.map(d => ({ id: d.id, bounds: d.bounds, scaleFactor: d.scaleFactor })));
    // Find the display for this area selection
    let targetDisplay;
    if (displayId) {
        const foundDisplay = allDisplays.find(d => d.id === displayId);
        if (!foundDisplay) {
            console.warn(`⚠️ [COORD_TRANSFORM] Display ID ${displayId} not found, falling back to primary display`);
            targetDisplay = allDisplays[0];
        }
        else {
            targetDisplay = foundDisplay;
            console.log('✅ [COORD_TRANSFORM] Using provided display ID:', displayId);
        }
    }
    else {
        targetDisplay = allDisplays[0];
        console.log('ℹ️ [COORD_TRANSFORM] No display ID provided, using primary display');
    }
    // ===== DISPLAY VALIDATION =====
    if (!targetDisplay.bounds || !targetDisplay.workArea) {
        throw new Error(`[COORD_TRANSFORM] Invalid display properties for display ${targetDisplay.id}`);
    }
    console.log('🎯 [COORD_TRANSFORM] Target display properties:', {
        display: targetDisplay.id,
        bounds: targetDisplay.bounds,
        workArea: targetDisplay.workArea,
        scaleFactor: targetDisplay.scaleFactor
    });
    // Validate display bounds
    if (targetDisplay.bounds.width <= 0 || targetDisplay.bounds.height <= 0) {
        throw new Error(`[COORD_TRANSFORM] Invalid display bounds: ${JSON.stringify(targetDisplay.bounds)}`);
    }
    if (targetDisplay.scaleFactor <= 0 || !Number.isFinite(targetDisplay.scaleFactor)) {
        throw new Error(`[COORD_TRANSFORM] Invalid scale factor: ${targetDisplay.scaleFactor}`);
    }
    // ===== COORDINATE TRANSFORMATION =====
    // Calculate the offset between workArea and bounds (accounts for menu bar, dock, etc.)
    const workAreaOffsetX = targetDisplay.workArea.x - targetDisplay.bounds.x;
    const workAreaOffsetY = targetDisplay.workArea.y - targetDisplay.bounds.y;
    console.log('📐 [COORD_TRANSFORM] Work area offset calculation:', {
        workAreaX: targetDisplay.workArea.x,
        boundsX: targetDisplay.bounds.x,
        offsetX: workAreaOffsetX,
        workAreaY: targetDisplay.workArea.y,
        boundsY: targetDisplay.bounds.y,
        offsetY: workAreaOffsetY
    });
    // Validate input coordinates are within workArea bounds
    if (x < 0 || y < 0 || x + width > targetDisplay.workArea.width || y + height > targetDisplay.workArea.height) {
        console.warn(`⚠️ [COORD_TRANSFORM] Input area extends beyond workArea bounds:`, {
            input: { x, y, width, height },
            workArea: targetDisplay.workArea,
            exceedsRight: x + width > targetDisplay.workArea.width,
            exceedsBottom: y + height > targetDisplay.workArea.height
        });
    }
    // Transform overlay coordinates (relative to workArea) to display bounds coordinates
    const displayX = x + workAreaOffsetX;
    const displayY = y + workAreaOffsetY;
    console.log('🔄 [COORD_TRANSFORM] Logical coordinate transformation:', {
        inputOverlay: { x, y },
        workAreaOffset: { x: workAreaOffsetX, y: workAreaOffsetY },
        resultDisplay: { x: displayX, y: displayY }
    });
    // Apply scale factor to get physical pixels for cropping
    const scaleFactor = targetDisplay.scaleFactor;
    const physicalX = Math.round(displayX * scaleFactor);
    const physicalY = Math.round(displayY * scaleFactor);
    const physicalWidth = Math.round(width * scaleFactor);
    const physicalHeight = Math.round(height * scaleFactor);
    console.log('🔍 [COORD_TRANSFORM] Scale factor application:', {
        scaleFactor,
        logical: { x: displayX, y: displayY, width, height },
        physical: { x: physicalX, y: physicalY, width: physicalWidth, height: physicalHeight }
    });
    // ===== BOUNDS VALIDATION AND CLAMPING =====
    const maxWidth = Math.round(targetDisplay.bounds.width * scaleFactor);
    const maxHeight = Math.round(targetDisplay.bounds.height * scaleFactor);
    console.log('📏 [COORD_TRANSFORM] Physical display bounds:', { maxWidth, maxHeight });
    // Validate physical coordinates are reasonable
    if (physicalX < -maxWidth || physicalY < -maxHeight || physicalX > 2 * maxWidth || physicalY > 2 * maxHeight) {
        console.error(`❌ [COORD_TRANSFORM] Physical coordinates are unreasonable:`, {
            physical: { x: physicalX, y: physicalY },
            displayBounds: { maxWidth, maxHeight }
        });
    }
    const validatedX = Math.max(0, Math.min(physicalX, maxWidth - 1));
    const validatedY = Math.max(0, Math.min(physicalY, maxHeight - 1));
    const validatedWidth = Math.max(1, Math.min(physicalWidth, maxWidth - validatedX));
    const validatedHeight = Math.max(1, Math.min(physicalHeight, maxHeight - validatedY));
    // Check if clamping occurred
    const wasClampedX = validatedX !== physicalX;
    const wasClampedY = validatedY !== physicalY;
    const wasClampedWidth = validatedWidth !== physicalWidth;
    const wasClampedHeight = validatedHeight !== physicalHeight;
    if (wasClampedX || wasClampedY || wasClampedWidth || wasClampedHeight) {
        console.warn(`⚠️ [COORD_TRANSFORM] Coordinates were clamped to display bounds:`, {
            original: { x: physicalX, y: physicalY, width: physicalWidth, height: physicalHeight },
            clamped: { x: validatedX, y: validatedY, width: validatedWidth, height: validatedHeight },
            clampingApplied: { x: wasClampedX, y: wasClampedY, width: wasClampedWidth, height: wasClampedHeight }
        });
    }
    // ===== FINAL RESULT VALIDATION =====
    const result = {
        x: validatedX,
        y: validatedY,
        width: validatedWidth,
        height: validatedHeight,
        displayId: targetDisplay.id
    };
    // Validate final result makes sense
    if (result.x < 0 || result.y < 0 || result.width <= 0 || result.height <= 0) {
        throw new Error(`[COORD_TRANSFORM] Invalid final result: ${JSON.stringify(result)}`);
    }
    if (result.x + result.width > maxWidth || result.y + result.height > maxHeight) {
        throw new Error(`[COORD_TRANSFORM] Final result exceeds display bounds: result=${JSON.stringify(result)}, bounds=${maxWidth}x${maxHeight}`);
    }
    // Calculate transformation ratio for verification
    const inputArea = width * height;
    const outputArea = result.width * result.height;
    const scaleRatio = Math.sqrt(outputArea / inputArea);
    const expectedRatio = scaleFactor;
    const ratioDiscrepancy = Math.abs(scaleRatio - expectedRatio) / expectedRatio;
    if (ratioDiscrepancy > 0.1) { // More than 10% discrepancy
        console.warn(`⚠️ [COORD_TRANSFORM] Unexpected scale ratio discrepancy:`, {
            inputArea,
            outputArea,
            calculatedRatio: scaleRatio,
            expectedRatio,
            discrepancy: ratioDiscrepancy
        });
    }
    // ===== COMPREHENSIVE TRANSFORMATION SUMMARY =====
    console.log('✅ [COORD_TRANSFORM] Coordinate transformation completed successfully:', {
        summary: {
            input: { x, y, width, height, displayId },
            output: result,
            transformationSteps: {
                '1_workAreaOffset': { x: workAreaOffsetX, y: workAreaOffsetY },
                '2_displayLogical': { x: displayX, y: displayY },
                '3_scaleApplication': { factor: scaleFactor },
                '4_physicalResult': { x: physicalX, y: physicalY, width: physicalWidth, height: physicalHeight },
                '5_boundsValidation': { maxWidth, maxHeight },
                '6_finalClamping': { applied: wasClampedX || wasClampedY || wasClampedWidth || wasClampedHeight }
            }
        },
        validation: {
            inputValid: true,
            boundsRespected: true,
            scaleFactorApplied: true,
            resultWithinBounds: true,
            areaRatio: scaleRatio,
            areaDiscrepancy: ratioDiscrepancy
        },
        displayInfo: {
            id: targetDisplay.id,
            bounds: targetDisplay.bounds,
            workArea: targetDisplay.workArea,
            scaleFactor: targetDisplay.scaleFactor
        }
    });
    return result;
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
        // IMPORTANT: Capture application info BEFORE showing overlay (while target app is still active)
        const applicationInfo = await getCurrentApplicationInfo();
        console.log('🎯 [OVERLAY] Captured application info before overlay:', applicationInfo);
        // Show overlay and get area
        const area = await selectAreaOnScreen();
        console.log('Area selection completed with result:', area);
        if (area) {
            // Return both area and application info together
            return {
                ...area,
                applicationInfo
            };
        }
        return null;
    }
    catch (error) {
        console.error('Area overlay failed:', error);
        return null;
    }
});
// Update the 'capture-area' handler to only crop and save, given area
electron_1.ipcMain.handle('capture-area', async (event, params) => {
    try {
        const { area, displayId: targetDisplayId, applicationInfo } = params;
        if (!area || typeof area.x !== 'number' || typeof area.y !== 'number' || typeof area.width !== 'number' || typeof area.height !== 'number') {
            throw new Error('Invalid area coordinates');
        }
        console.log('🎯 [IPC_CAPTURE] Area capture requested:', area);
        console.log('🎯 [IPC_CAPTURE] Target display ID:', targetDisplayId);
        // ===== UNIFIED COORDINATE TRANSFORMATION =====
        // Apply the same transformation logic as the shortcut path
        // The area coordinates from selectAreaOnScreen() are overlay coordinates and need transformation
        const areaWithDisplayId = { ...area, displayId: targetDisplayId };
        const transformedArea = transformOverlayToScreenCoordinates(areaWithDisplayId);
        console.log('🔄 [IPC_CAPTURE] Coordinates transformed for consistency with shortcut path:', {
            originalOverlay: area,
            transformedPhysical: transformedArea
        });
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
            // Use our helper to crop the image with Jimp - now using transformed coordinates
            console.log('🔪 [IPC_CAPTURE] Cropping image with transformed coordinates:', {
                x: transformedArea.x,
                y: transformedArea.y,
                width: transformedArea.width,
                height: transformedArea.height
            });
            const croppedBuffer = await (0, jimp_native_1.cropImage)(imgBuffer, transformedArea.x, transformedArea.y, transformedArea.width, transformedArea.height);
            console.log('Image cropped successfully, size:', croppedBuffer.length);
            // Save the cropped screenshot
            const filePath = await saveScreenshot(croppedBuffer);
            console.log('Cropped screenshot saved to:', filePath);
            // Copy to clipboard
            const clipboardSuccess = copyToClipboard(croppedBuffer);
            console.log('Clipboard copy success:', clipboardSuccess);
            // Create sidecar file for the new area screenshot
            try {
                const allDisplays = electron_1.screen.getAllDisplays();
                const targetDisplay = allDisplays.find(d => d.id === targetDisplayId) || electron_1.screen.getPrimaryDisplay();
                const metadata = {
                    captureTimestamp: new Date().toISOString(),
                    captureMethod: 'area',
                    applicationInfo: applicationInfo || {
                        name: 'Unknown',
                        version: '1.0',
                        bundleId: 'unknown'
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
                console.log('Sidecar file created for area capture via UI:', filePath);
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
                console.error('Failed to create sidecar file for area capture via UI:', sidecarError);
            }
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
// ImageIndexer IPC handlers
electron_1.ipcMain.handle('indexer-search', async (event, query, limit) => {
    try {
        if (!imageIndexer) {
            return { success: false, error: 'Image indexer not initialized' };
        }
        const results = imageIndexer.search(query, limit);
        return { success: true, data: results };
    }
    catch (error) {
        logger_1.logger.error('main', 'Failed to search images', error);
        return { success: false, error: error.message };
    }
});
electron_1.ipcMain.handle('indexer-get-stats', async (event) => {
    try {
        if (!imageIndexer) {
            return { success: false, error: 'Image indexer not initialized' };
        }
        return {
            success: true,
            data: {
                imageCount: imageIndexer.getImageCount(),
                lastScanDate: imageIndexer.getLastScanDate(),
                isScanning: imageIndexer.isCurrentlyScanning(),
                allTags: imageIndexer.getAllTags()
            }
        };
    }
    catch (error) {
        logger_1.logger.error('main', 'Failed to get indexer stats', error);
        return { success: false, error: error.message };
    }
});
electron_1.ipcMain.handle('indexer-get-by-tags', async (event, tags) => {
    try {
        if (!imageIndexer) {
            return { success: false, error: 'Image indexer not initialized' };
        }
        const results = imageIndexer.getImagesByTags(tags);
        return { success: true, data: results };
    }
    catch (error) {
        logger_1.logger.error('main', 'Failed to get images by tags', error);
        return { success: false, error: error.message };
    }
});
electron_1.ipcMain.handle('indexer-get-by-date-range', async (event, startDate, endDate) => {
    try {
        if (!imageIndexer) {
            return { success: false, error: 'Image indexer not initialized' };
        }
        const start = new Date(startDate);
        const end = new Date(endDate);
        const results = imageIndexer.getImagesByDateRange(start, end);
        return { success: true, data: results };
    }
    catch (error) {
        logger_1.logger.error('main', 'Failed to get images by date range', error);
        return { success: false, error: error.message };
    }
});
electron_1.ipcMain.handle('indexer-rescan', async (event) => {
    try {
        if (!imageIndexer) {
            return { success: false, error: 'Image indexer not initialized' };
        }
        const config = (0, storage_1.loadStorageConfig)();
        await imageIndexer.startIndexing(config.saveDirectory);
        return { success: true };
    }
    catch (error) {
        logger_1.logger.error('main', 'Failed to rescan images', error);
        return { success: false, error: error.message };
    }
});
// ThumbnailCache IPC handlers
electron_1.ipcMain.handle('thumbnail-get', async (event, filePath, options) => {
    try {
        if (!thumbnailCache) {
            return { success: false, error: 'Thumbnail cache not initialized' };
        }
        const thumbnailPath = await thumbnailCache.getThumbnail(filePath, options);
        return { success: true, data: thumbnailPath };
    }
    catch (error) {
        logger_1.logger.error('main', 'Failed to get thumbnail', error);
        return { success: false, error: error.message };
    }
});
electron_1.ipcMain.handle('thumbnail-get-base64', async (event, filePath, options) => {
    try {
        if (!thumbnailCache) {
            return { success: false, error: 'Thumbnail cache not initialized' };
        }
        const base64Data = await thumbnailCache.getThumbnailBase64(filePath, options);
        return { success: true, data: base64Data };
    }
    catch (error) {
        logger_1.logger.error('main', 'Failed to get thumbnail base64', error);
        return { success: false, error: error.message };
    }
});
electron_1.ipcMain.handle('thumbnail-pregenerate', async (event, filePaths, options) => {
    try {
        if (!thumbnailCache) {
            return { success: false, error: 'Thumbnail cache not initialized' };
        }
        await thumbnailCache.pregenerateThumbnails(filePaths, options);
        return { success: true };
    }
    catch (error) {
        logger_1.logger.error('main', 'Failed to pregenerate thumbnails', error);
        return { success: false, error: error.message };
    }
});
electron_1.ipcMain.handle('thumbnail-cache-stats', async (event) => {
    try {
        if (!thumbnailCache) {
            return { success: false, error: 'Thumbnail cache not initialized' };
        }
        const stats = await thumbnailCache.getCacheStats();
        return { success: true, data: stats };
    }
    catch (error) {
        logger_1.logger.error('main', 'Failed to get cache stats', error);
        return { success: false, error: error.message };
    }
});
electron_1.ipcMain.handle('thumbnail-clear-cache', async (event) => {
    try {
        if (!thumbnailCache) {
            return { success: false, error: 'Thumbnail cache not initialized' };
        }
        await thumbnailCache.clearCache();
        return { success: true };
    }
    catch (error) {
        logger_1.logger.error('main', 'Failed to clear thumbnail cache', error);
        return { success: false, error: error.message };
    }
});
// FileManager IPC handlers
electron_1.ipcMain.handle('file-archive-screenshot', async (event, filePath) => {
    try {
        const result = await FileManager_1.fileManager.archiveScreenshot(filePath);
        if (result.success) {
            // Update sidecar to mark as archived
            await sidecar_manager_1.sidecarManager.markAsArchived(result.filePath);
            // Remove from image indexer (or update to mark as archived)
            if (imageIndexer) {
                imageIndexer.removeImage(filePath);
            }
            // Clean up thumbnail
            if (thumbnailCache) {
                await thumbnailCache.removeThumbnail(filePath);
            }
        }
        return result;
    }
    catch (error) {
        logger_1.logger.error('main', 'Failed to archive screenshot', error);
        return { success: false, error: error.message, filePath };
    }
});
electron_1.ipcMain.handle('file-archive-screenshots', async (event, filePaths) => {
    try {
        const result = await FileManager_1.fileManager.archiveScreenshots(filePaths);
        // Update sidecars and indexes for successful operations
        for (const operation of result.success) {
            await sidecar_manager_1.sidecarManager.markAsArchived(operation.filePath);
            if (imageIndexer) {
                imageIndexer.removeImage(operation.filePath);
            }
            if (thumbnailCache) {
                await thumbnailCache.removeThumbnail(operation.filePath);
            }
        }
        return result;
    }
    catch (error) {
        logger_1.logger.error('main', 'Failed to archive screenshots', error);
        return { success: [], failed: filePaths.map(fp => ({ filePath: fp, success: false, error: error.message })), totalCount: filePaths.length };
    }
});
electron_1.ipcMain.handle('file-delete-screenshot', async (event, filePath, permanent) => {
    try {
        const result = await FileManager_1.fileManager.deleteScreenshot(filePath, permanent);
        if (result.success) {
            // Remove from image indexer
            if (imageIndexer) {
                imageIndexer.removeImage(filePath);
            }
            // Clean up thumbnail
            if (thumbnailCache) {
                await thumbnailCache.removeThumbnail(filePath);
            }
        }
        return result;
    }
    catch (error) {
        logger_1.logger.error('main', 'Failed to delete screenshot', error);
        return { success: false, error: error.message, filePath };
    }
});
electron_1.ipcMain.handle('file-delete-screenshots', async (event, filePaths, permanent) => {
    try {
        const result = await FileManager_1.fileManager.deleteScreenshots(filePaths, permanent);
        // Clean up indexes and thumbnails for successful operations
        for (const operation of result.success) {
            if (imageIndexer) {
                imageIndexer.removeImage(operation.filePath);
            }
            if (thumbnailCache) {
                await thumbnailCache.removeThumbnail(operation.filePath);
            }
        }
        return result;
    }
    catch (error) {
        logger_1.logger.error('main', 'Failed to delete screenshots', error);
        return { success: [], failed: filePaths.map(fp => ({ filePath: fp, success: false, error: error.message })), totalCount: filePaths.length };
    }
});
electron_1.ipcMain.handle('file-restore-screenshot', async (event, archivedPath) => {
    try {
        const result = await FileManager_1.fileManager.restoreScreenshot(archivedPath);
        if (result.success) {
            // Update sidecar to mark as unarchived
            await sidecar_manager_1.sidecarManager.markAsUnarchived(result.filePath);
            // Add back to image indexer
            if (imageIndexer) {
                await imageIndexer.addImage(result.filePath);
            }
        }
        return result;
    }
    catch (error) {
        logger_1.logger.error('main', 'Failed to restore screenshot', error);
        return { success: false, error: error.message, filePath: archivedPath };
    }
});
electron_1.ipcMain.handle('file-get-recently-deleted', async (event) => {
    try {
        const deletedItems = FileManager_1.fileManager.getRecentlyDeletedItems();
        return { success: true, data: deletedItems };
    }
    catch (error) {
        logger_1.logger.error('main', 'Failed to get recently deleted items', error);
        return { success: false, error: error.message };
    }
});
electron_1.ipcMain.handle('file-cleanup-orphaned-sidecars', async (event, directory) => {
    try {
        const removedCount = await FileManager_1.fileManager.cleanupOrphanedSidecars(directory);
        return { success: true, data: { removedCount } };
    }
    catch (error) {
        logger_1.logger.error('main', 'Failed to cleanup orphaned sidecars', error);
        return { success: false, error: error.message };
    }
});
electron_1.ipcMain.handle('file-get-statistics', async (event) => {
    try {
        const stats = FileManager_1.fileManager.getStatistics();
        return { success: true, data: stats };
    }
    catch (error) {
        logger_1.logger.error('main', 'Failed to get file statistics', error);
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
            birthtime: stats.birthtime, // Include both for compatibility
            modified: stats.mtime,
            mtime: stats.mtime, // Include both for compatibility
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
        // Get actual image dimensions using Electron's nativeImage
        let dimensions = { width: 1920, height: 1080 }; // Default fallback
        try {
            const { nativeImage } = require('electron');
            const image = nativeImage.createFromBuffer(buffer);
            const size = image.getSize();
            dimensions = { width: size.width, height: size.height };
            console.log(`📐 [IPC] Image dimensions: ${dimensions.width}x${dimensions.height}`);
        }
        catch (dimError) {
            console.warn(`⚠️ [IPC] Could not get image dimensions: ${dimError.message}`);
        }
        console.log(`✅ [IPC] Successfully read image file: ${filePath} (${base64SizeKB}KB base64)`);
        return { success: true, base64, dimensions };
    }
    catch (error) {
        const errorMsg = `Failed to read image file: ${error.message}`;
        console.error(`❌ [IPC] ${errorMsg} for file: ${filePath}`, error);
        logger_1.logger.error('main', 'Failed to read image file', error);
        return { success: false, error: errorMsg };
    }
});
// OCR IPC handlers
electron_1.ipcMain.handle('ocr-get-status', async (event, imagePath) => {
    try {
        const status = await ocr_service_1.ocrService.getOCRStatus(imagePath);
        return { success: true, data: status };
    }
    catch (error) {
        logger_1.logger.error('main', 'Failed to get OCR status', error);
        return { success: false, error: error.message };
    }
});
electron_1.ipcMain.handle('ocr-queue-for-processing', async (event, imagePath) => {
    try {
        await ocr_service_1.ocrService.queueForOCR(imagePath);
        return { success: true };
    }
    catch (error) {
        logger_1.logger.error('main', 'Failed to queue for OCR', error);
        return { success: false, error: error.message };
    }
});
electron_1.ipcMain.handle('ocr-get-queue-size', async (event) => {
    try {
        const queueSize = ocr_service_1.ocrService.getQueueSize();
        return { success: true, data: queueSize };
    }
    catch (error) {
        logger_1.logger.error('main', 'Failed to get OCR queue size', error);
        return { success: false, error: error.message };
    }
});
electron_1.ipcMain.handle('ocr-is-processing', async (event) => {
    try {
        const isProcessing = ocr_service_1.ocrService.isCurrentlyProcessing();
        return { success: true, data: isProcessing };
    }
    catch (error) {
        logger_1.logger.error('main', 'Failed to check OCR processing status', error);
        return { success: false, error: error.message };
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
