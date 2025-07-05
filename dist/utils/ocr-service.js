"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ocrService = void 0;
const tesseract_js_1 = require("tesseract.js");
const sidecar_manager_1 = require("./sidecar-manager");
const logger_1 = require("./logger");
const electron_1 = require("electron");
const fs_1 = __importDefault(require("fs"));
class OCRService {
    constructor() {
        this.worker = null;
        this.isInitialized = false;
        this.isProcessing = false;
        this.processingQueue = [];
    }
    /**
     * Initialize the OCR worker
     */
    async initialize() {
        try {
            logger_1.logger.info('main', 'Initializing OCR service...');
            this.worker = await (0, tesseract_js_1.createWorker)('eng');
            this.isInitialized = true;
            logger_1.logger.info('main', 'OCR service initialized successfully');
        }
        catch (error) {
            logger_1.logger.error('main', 'Failed to initialize OCR service', error);
            throw error;
        }
    }
    /**
     * Process OCR for an image file
     */
    async processImage(imagePath) {
        if (!this.isInitialized) {
            await this.initialize();
        }
        if (!fs_1.default.existsSync(imagePath)) {
            logger_1.logger.warn('main', `Image file does not exist: ${imagePath}`);
            return null;
        }
        try {
            logger_1.logger.info('main', `Processing OCR for image: ${imagePath}`);
            const { data } = await this.worker.recognize(imagePath);
            const result = {
                text: data.text.trim(),
                confidence: data.confidence
            };
            logger_1.logger.info('main', `OCR completed for ${imagePath}. Confidence: ${result.confidence}%, Text length: ${result.text.length} characters`);
            return result;
        }
        catch (error) {
            logger_1.logger.error('main', `OCR processing failed for ${imagePath}`, error);
            return null;
        }
    }
    /**
     * Queue an image for OCR processing
     */
    async queueForOCR(imagePath) {
        // Check if image already has OCR completed
        const sidecarData = await sidecar_manager_1.sidecarManager.loadSidecarFile(imagePath);
        if (sidecarData?.ocrCompleted) {
            logger_1.logger.info('main', `OCR already completed for ${imagePath}, skipping`);
            return;
        }
        if (!this.processingQueue.includes(imagePath)) {
            this.processingQueue.push(imagePath);
            logger_1.logger.info('main', `Added ${imagePath} to OCR processing queue`);
        }
        // Process the queue if not already processing
        if (!this.isProcessing) {
            this.processQueue();
        }
    }
    /**
     * Process the OCR queue
     */
    async processQueue() {
        if (this.isProcessing || this.processingQueue.length === 0) {
            return;
        }
        this.isProcessing = true;
        logger_1.logger.info('main', `Starting OCR queue processing. ${this.processingQueue.length} items in queue`);
        while (this.processingQueue.length > 0) {
            const imagePath = this.processingQueue.shift();
            if (!imagePath)
                continue;
            try {
                // Check if file still exists and doesn't have OCR completed
                const sidecarData = await sidecar_manager_1.sidecarManager.loadSidecarFile(imagePath);
                if (sidecarData?.ocrCompleted) {
                    logger_1.logger.info('main', `OCR already completed for ${imagePath}, skipping`);
                    continue;
                }
                if (!fs_1.default.existsSync(imagePath)) {
                    logger_1.logger.warn('main', `Image file no longer exists: ${imagePath}`);
                    continue;
                }
                // Process OCR
                const result = await this.processImage(imagePath);
                if (result) {
                    // Check if sidecar file exists, if not create it
                    if (!sidecar_manager_1.sidecarManager.sidecarExists(imagePath)) {
                        // Create a basic sidecar file first
                        const basicMetadata = {
                            captureTimestamp: new Date().toISOString(),
                            applicationInfo: { name: 'Unknown' },
                            screenInfo: { resolution: { width: 0, height: 0 } },
                            deviceInfo: {},
                            captureMethod: 'fullscreen'
                        };
                        await sidecar_manager_1.sidecarManager.createSidecarFile(imagePath, basicMetadata, [], '', []);
                    }
                    // Update sidecar file with OCR results
                    const success = await sidecar_manager_1.sidecarManager.updateSidecarFile(imagePath, {
                        ocrText: result.text,
                        ocrCompleted: true
                    });
                    if (success) {
                        logger_1.logger.info('main', `OCR text saved for ${imagePath}`);
                        // Notify all renderer windows about the OCR completion
                        this.notifyOCRCompletion(imagePath, result.text, true);
                    }
                    else {
                        logger_1.logger.error('main', `Failed to save OCR text for ${imagePath}`, new Error('Update sidecar failed'));
                    }
                }
                else {
                    // Check if sidecar file exists, if not create it
                    if (!sidecar_manager_1.sidecarManager.sidecarExists(imagePath)) {
                        // Create a basic sidecar file first
                        const basicMetadata = {
                            captureTimestamp: new Date().toISOString(),
                            applicationInfo: { name: 'Unknown' },
                            screenInfo: { resolution: { width: 0, height: 0 } },
                            deviceInfo: {},
                            captureMethod: 'fullscreen'
                        };
                        await sidecar_manager_1.sidecarManager.createSidecarFile(imagePath, basicMetadata, [], '', []);
                    }
                    // Mark as completed even if OCR failed to avoid reprocessing
                    await sidecar_manager_1.sidecarManager.updateSidecarFile(imagePath, {
                        ocrCompleted: true
                    });
                    // Notify renderer windows that OCR completed with no text
                    this.notifyOCRCompletion(imagePath, '', true);
                }
                // Small delay to prevent overwhelming the system
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            catch (error) {
                logger_1.logger.error('main', `Error processing OCR for ${imagePath}`, error);
                // Mark as completed to avoid infinite retries
                try {
                    // Check if sidecar file exists, if not create it
                    if (!sidecar_manager_1.sidecarManager.sidecarExists(imagePath)) {
                        const basicMetadata = {
                            captureTimestamp: new Date().toISOString(),
                            applicationInfo: { name: 'Unknown' },
                            screenInfo: { resolution: { width: 0, height: 0 } },
                            deviceInfo: {},
                            captureMethod: 'fullscreen'
                        };
                        await sidecar_manager_1.sidecarManager.createSidecarFile(imagePath, basicMetadata, [], '', []);
                    }
                    await sidecar_manager_1.sidecarManager.updateSidecarFile(imagePath, {
                        ocrCompleted: true
                    });
                    // Notify renderer windows that OCR completed with error (no text)
                    this.notifyOCRCompletion(imagePath, '', true);
                }
                catch (sidecarError) {
                    logger_1.logger.error('main', `Failed to create sidecar for ${imagePath}`, sidecarError);
                }
            }
        }
        this.isProcessing = false;
        logger_1.logger.info('main', 'OCR queue processing completed');
    }
    /**
     * Get OCR status for an image
     */
    async getOCRStatus(imagePath) {
        const sidecarData = await sidecar_manager_1.sidecarManager.loadSidecarFile(imagePath);
        return {
            completed: sidecarData?.ocrCompleted || false,
            text: sidecarData?.ocrText || undefined
        };
    }
    /**
     * Get current queue size
     */
    getQueueSize() {
        return this.processingQueue.length;
    }
    /**
     * Check if OCR is currently processing
     */
    isCurrentlyProcessing() {
        return this.isProcessing;
    }
    /**
     * Notify all renderer windows about OCR completion
     */
    notifyOCRCompletion(imagePath, ocrText, ocrCompleted) {
        try {
            const allWindows = electron_1.BrowserWindow.getAllWindows();
            allWindows.forEach(window => {
                if (!window.isDestroyed()) {
                    window.webContents.send('ocr-completed', {
                        imagePath,
                        ocrText,
                        ocrCompleted
                    });
                }
            });
            logger_1.logger.info('main', `Notified ${allWindows.length} windows about OCR completion for ${imagePath}`);
        }
        catch (error) {
            logger_1.logger.error('main', 'Failed to notify windows about OCR completion', error);
        }
    }
    /**
     * Cleanup OCR worker
     */
    async cleanup() {
        if (this.worker) {
            try {
                await this.worker.terminate();
                logger_1.logger.info('main', 'OCR worker terminated');
            }
            catch (error) {
                logger_1.logger.error('main', 'Error terminating OCR worker', error);
            }
        }
    }
}
exports.ocrService = new OCRService();
