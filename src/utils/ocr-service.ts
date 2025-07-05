import { createWorker } from 'tesseract.js';
import { sidecarManager } from './sidecar-manager';
import { logger } from './logger';
import { BrowserWindow } from 'electron';
import fs from 'fs';
import path from 'path';

interface OCRResult {
  text: string;
  confidence: number;
}

class OCRService {
  private worker: any = null;
  private isInitialized = false;
  private isProcessing = false;
  private processingQueue: string[] = [];

  /**
   * Initialize the OCR worker
   */
  async initialize(): Promise<void> {
    try {
      logger.info('main', 'Initializing OCR service...');
      this.worker = await createWorker('eng');
      this.isInitialized = true;
      logger.info('main', 'OCR service initialized successfully');
    } catch (error) {
      logger.error('main', 'Failed to initialize OCR service', error as Error);
      throw error;
    }
  }

  /**
   * Process OCR for an image file
   */
  async processImage(imagePath: string): Promise<OCRResult | null> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!fs.existsSync(imagePath)) {
      logger.warn('main', `Image file does not exist: ${imagePath}`);
      return null;
    }

    try {
      logger.info('main', `Processing OCR for image: ${imagePath}`);
      const { data } = await this.worker.recognize(imagePath);
      
      const result: OCRResult = {
        text: data.text.trim(),
        confidence: data.confidence
      };

      logger.info('main', `OCR completed for ${imagePath}. Confidence: ${result.confidence}%, Text length: ${result.text.length} characters`);
      return result;
    } catch (error) {
      logger.error('main', `OCR processing failed for ${imagePath}`, error as Error);
      return null;
    }
  }

  /**
   * Queue an image for OCR processing
   */
  async queueForOCR(imagePath: string): Promise<void> {
    // Check if image already has OCR completed
    const sidecarData = await sidecarManager.loadSidecarFile(imagePath);
    if (sidecarData?.ocrCompleted) {
      logger.info('main', `OCR already completed for ${imagePath}, skipping`);
      return;
    }

    if (!this.processingQueue.includes(imagePath)) {
      this.processingQueue.push(imagePath);
      logger.info('main', `Added ${imagePath} to OCR processing queue`);
    }

    // Process the queue if not already processing
    if (!this.isProcessing) {
      this.processQueue();
    }
  }

  /**
   * Process the OCR queue
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.processingQueue.length === 0) {
      return;
    }

    this.isProcessing = true;
    logger.info('main', `Starting OCR queue processing. ${this.processingQueue.length} items in queue`);

    while (this.processingQueue.length > 0) {
      const imagePath = this.processingQueue.shift();
      if (!imagePath) continue;

      try {
        // Check if file still exists and doesn't have OCR completed
        const sidecarData = await sidecarManager.loadSidecarFile(imagePath);
        if (sidecarData?.ocrCompleted) {
          logger.info('main', `OCR already completed for ${imagePath}, skipping`);
          continue;
        }

        if (!fs.existsSync(imagePath)) {
          logger.warn('main', `Image file no longer exists: ${imagePath}`);
          continue;
        }

        // Process OCR
        const result = await this.processImage(imagePath);
        
        if (result) {
          // Check if sidecar file exists, if not create it
          if (!sidecarManager.sidecarExists(imagePath)) {
            // Create a basic sidecar file first
            const basicMetadata = {
              captureTimestamp: new Date().toISOString(),
              applicationInfo: { name: 'Unknown' },
              screenInfo: { resolution: { width: 0, height: 0 } },
              deviceInfo: {},
              captureMethod: 'fullscreen' as const
            };
            await sidecarManager.createSidecarFile(imagePath, basicMetadata, [], '', []);
          }
          
          // Update sidecar file with OCR results
          const success = await sidecarManager.updateSidecarFile(imagePath, {
            ocrText: result.text,
            ocrCompleted: true
          });

          if (success) {
            logger.info('main', `OCR text saved for ${imagePath}`);
            // Notify all renderer windows about the OCR completion
            this.notifyOCRCompletion(imagePath, result.text, true);
          } else {
            logger.error('main', `Failed to save OCR text for ${imagePath}`, new Error('Update sidecar failed'));
          }
        } else {
          // Check if sidecar file exists, if not create it
          if (!sidecarManager.sidecarExists(imagePath)) {
            // Create a basic sidecar file first
            const basicMetadata = {
              captureTimestamp: new Date().toISOString(),
              applicationInfo: { name: 'Unknown' },
              screenInfo: { resolution: { width: 0, height: 0 } },
              deviceInfo: {},
              captureMethod: 'fullscreen' as const
            };
            await sidecarManager.createSidecarFile(imagePath, basicMetadata, [], '', []);
          }
          
          // Mark as completed even if OCR failed to avoid reprocessing
          await sidecarManager.updateSidecarFile(imagePath, {
            ocrCompleted: true
          });
          
          // Notify renderer windows that OCR completed with no text
          this.notifyOCRCompletion(imagePath, '', true);
        }

        // Small delay to prevent overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        logger.error('main', `Error processing OCR for ${imagePath}`, error as Error);
        // Mark as completed to avoid infinite retries
        try {
          // Check if sidecar file exists, if not create it
          if (!sidecarManager.sidecarExists(imagePath)) {
            const basicMetadata = {
              captureTimestamp: new Date().toISOString(),
              applicationInfo: { name: 'Unknown' },
              screenInfo: { resolution: { width: 0, height: 0 } },
              deviceInfo: {},
              captureMethod: 'fullscreen' as const
            };
            await sidecarManager.createSidecarFile(imagePath, basicMetadata, [], '', []);
          }
          
          await sidecarManager.updateSidecarFile(imagePath, {
            ocrCompleted: true
          });
          
          // Notify renderer windows that OCR completed with error (no text)
          this.notifyOCRCompletion(imagePath, '', true);
        } catch (sidecarError) {
          logger.error('main', `Failed to create sidecar for ${imagePath}`, sidecarError as Error);
        }
      }
    }

    this.isProcessing = false;
    logger.info('main', 'OCR queue processing completed');
  }

  /**
   * Get OCR status for an image
   */
  async getOCRStatus(imagePath: string): Promise<{completed: boolean, text?: string}> {
    const sidecarData = await sidecarManager.loadSidecarFile(imagePath);
    return {
      completed: sidecarData?.ocrCompleted || false,
      text: sidecarData?.ocrText || undefined
    };
  }

  /**
   * Get current queue size
   */
  getQueueSize(): number {
    return this.processingQueue.length;
  }

  /**
   * Check if OCR is currently processing
   */
  isCurrentlyProcessing(): boolean {
    return this.isProcessing;
  }

  /**
   * Notify all renderer windows about OCR completion
   */
  private notifyOCRCompletion(imagePath: string, ocrText: string, ocrCompleted: boolean): void {
    try {
      const allWindows = BrowserWindow.getAllWindows();
      allWindows.forEach(window => {
        if (!window.isDestroyed()) {
          window.webContents.send('ocr-completed', {
            imagePath,
            ocrText,
            ocrCompleted
          });
        }
      });
      logger.info('main', `Notified ${allWindows.length} windows about OCR completion for ${imagePath}`);
    } catch (error) {
      logger.error('main', 'Failed to notify windows about OCR completion', error as Error);
    }
  }

  /**
   * Cleanup OCR worker
   */
  async cleanup(): Promise<void> {
    if (this.worker) {
      try {
        await this.worker.terminate();
        logger.info('main', 'OCR worker terminated');
      } catch (error) {
        logger.error('main', 'Error terminating OCR worker', error as Error);
      }
    }
  }
}

export const ocrService = new OCRService();