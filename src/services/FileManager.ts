import { promises as fs } from 'fs';
import path from 'path';
import { shell } from 'electron';
import { EventEmitter } from 'events';
import { loadStorageConfig, ensureArchiveDirectory } from '../config/storage';
import { sidecarManager } from '../utils/sidecar-manager';

export interface FileOperation {
  filePath: string;
  success: boolean;
  error?: string;
}

export interface BulkOperationResult {
  success: FileOperation[];
  failed: FileOperation[];
  totalCount: number;
}

export interface DeletedItem {
  originalPath: string;
  fileName: string;
  deletedAt: Date;
  sidecarData?: any;
  thumbnailPath?: string;
}

export class FileManager extends EventEmitter {
  private deletedItemsCache = new Map<string, DeletedItem>();
  private readonly maxDeletedItemsCache = 100;
  private readonly deletedItemsRetentionDays = 30;

  constructor() {
    super();
    // Clean up expired deleted items on startup
    this.cleanupExpiredDeletedItems();
    
    // Set up periodic cleanup
    setInterval(() => {
      this.cleanupExpiredDeletedItems();
    }, 24 * 60 * 60 * 1000); // Daily cleanup
  }

  /**
   * Archive a single screenshot
   */
  async archiveScreenshot(filePath: string): Promise<FileOperation> {
    try {
      console.log(`📦 [FILE_MANAGER] Archiving screenshot: ${filePath}`);
      
      // Ensure archive directory exists
      const config = loadStorageConfig();
      const archiveDir = ensureArchiveDirectory(config.archiveDirectory);
      
      // Get file name and create archive path
      const fileName = path.basename(filePath);
      const archivePath = path.join(archiveDir, fileName);
      
      // Check if file exists
      try {
        await fs.access(filePath);
      } catch {
        throw new Error(`File does not exist: ${filePath}`);
      }
      
      // Check if archive destination already exists
      try {
        await fs.access(archivePath);
        throw new Error(`Archive destination already exists: ${archivePath}`);
      } catch (error) {
        // File doesn't exist, which is what we want
        if ((error as any).code !== 'ENOENT') {
          throw error;
        }
      }
      
      // Move the main image file
      await fs.rename(filePath, archivePath);
      console.log(`📦 [FILE_MANAGER] Moved ${filePath} to ${archivePath}`);
      
      // Move the sidecar file if it exists
      const sidecarPath = sidecarManager.getSidecarPath(filePath);
      const archiveSidecarPath = sidecarManager.getSidecarPath(archivePath);
      
      try {
        await fs.access(sidecarPath);
        await fs.rename(sidecarPath, archiveSidecarPath);
        console.log(`📦 [FILE_MANAGER] Moved sidecar ${sidecarPath} to ${archiveSidecarPath}`);
      } catch {
        // Sidecar doesn't exist, which is fine
      }
      
      this.emit('fileArchived', { filePath, archivePath });
      
      return {
        filePath,
        success: true
      };
    } catch (error) {
      console.error(`❌ [FILE_MANAGER] Failed to archive ${filePath}:`, error);
      return {
        filePath,
        success: false,
        error: (error as Error).message
      };
    }
  }

  /**
   * Archive multiple screenshots
   */
  async archiveScreenshots(filePaths: string[]): Promise<BulkOperationResult> {
    console.log(`📦 [FILE_MANAGER] Archiving ${filePaths.length} screenshots`);
    
    const results: BulkOperationResult = {
      success: [],
      failed: [],
      totalCount: filePaths.length
    };
    
    // Process files in batches to avoid overwhelming the system
    const batchSize = 5;
    for (let i = 0; i < filePaths.length; i += batchSize) {
      const batch = filePaths.slice(i, i + batchSize);
      
      const batchResults = await Promise.all(
        batch.map(filePath => this.archiveScreenshot(filePath))
      );
      
      batchResults.forEach(result => {
        if (result.success) {
          results.success.push(result);
        } else {
          results.failed.push(result);
        }
      });
      
      // Emit progress
      this.emit('bulkArchiveProgress', {
        processed: Math.min(i + batchSize, filePaths.length),
        total: filePaths.length
      });
      
      // Small delay to prevent overwhelming the file system
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    
    console.log(`📦 [FILE_MANAGER] Archived ${results.success.length}/${filePaths.length} screenshots`);
    this.emit('bulkArchiveCompleted', results);
    
    return results;
  }

  /**
   * Restore a screenshot from archive
   */
  async restoreScreenshot(archivedPath: string): Promise<FileOperation> {
    try {
      console.log(`📤 [FILE_MANAGER] Restoring screenshot: ${archivedPath}`);
      
      // Get the original directory from config
      const config = loadStorageConfig();
      const saveDir = config.saveDirectory;
      
      // Get file name and create restore path
      const fileName = path.basename(archivedPath);
      const restorePath = path.join(saveDir, fileName);
      
      // Check if archived file exists
      try {
        await fs.access(archivedPath);
      } catch {
        throw new Error(`Archived file does not exist: ${archivedPath}`);
      }
      
      // Check if restore destination already exists
      try {
        await fs.access(restorePath);
        throw new Error(`Restore destination already exists: ${restorePath}`);
      } catch (error) {
        // File doesn't exist, which is what we want
        if ((error as any).code !== 'ENOENT') {
          throw error;
        }
      }
      
      // Move the main image file back
      await fs.rename(archivedPath, restorePath);
      console.log(`📤 [FILE_MANAGER] Restored ${archivedPath} to ${restorePath}`);
      
      // Move the sidecar file if it exists
      const archivedSidecarPath = sidecarManager.getSidecarPath(archivedPath);
      const restoredSidecarPath = sidecarManager.getSidecarPath(restorePath);
      
      try {
        await fs.access(archivedSidecarPath);
        await fs.rename(archivedSidecarPath, restoredSidecarPath);
        console.log(`📤 [FILE_MANAGER] Restored sidecar ${archivedSidecarPath} to ${restoredSidecarPath}`);
      } catch {
        // Sidecar doesn't exist, which is fine
      }
      
      this.emit('fileRestored', { archivedPath, restorePath });
      
      return {
        filePath: restorePath,
        success: true
      };
    } catch (error) {
      console.error(`❌ [FILE_MANAGER] Failed to restore ${archivedPath}:`, error);
      return {
        filePath: archivedPath,
        success: false,
        error: (error as Error).message
      };
    }
  }

  /**
   * Delete a screenshot (with option for permanent deletion)
   */
  async deleteScreenshot(filePath: string, permanent = false): Promise<FileOperation> {
    try {
      console.log(`🗑️ [FILE_MANAGER] Deleting screenshot: ${filePath} (permanent: ${permanent})`);
      
      // Check if file exists
      try {
        await fs.access(filePath);
      } catch {
        throw new Error(`File does not exist: ${filePath}`);
      }
      
      // Load sidecar data before deletion (for potential recovery)
      let sidecarData: any = null;
      const sidecarPath = sidecarManager.getSidecarPath(filePath);
      try {
        sidecarData = await sidecarManager.loadSidecarFile(filePath);
      } catch {
        // Sidecar doesn't exist or can't be loaded
      }
      
      if (permanent) {
        // Permanent deletion
        await fs.unlink(filePath);
        console.log(`🗑️ [FILE_MANAGER] Permanently deleted ${filePath}`);
        
        // Delete sidecar file if it exists
        try {
          await fs.unlink(sidecarPath);
          console.log(`🗑️ [FILE_MANAGER] Deleted sidecar ${sidecarPath}`);
        } catch {
          // Sidecar doesn't exist, which is fine
        }
      } else {
        // Move to system trash
        await shell.trashItem(filePath);
        console.log(`🗑️ [FILE_MANAGER] Moved ${filePath} to trash`);
        
        // Move sidecar to trash if it exists
        try {
          await fs.access(sidecarPath);
          await shell.trashItem(sidecarPath);
          console.log(`🗑️ [FILE_MANAGER] Moved sidecar ${sidecarPath} to trash`);
        } catch {
          // Sidecar doesn't exist, which is fine
        }
        
        // Add to deleted items cache for potential recovery
        this.addToDeletedItemsCache(filePath, sidecarData);
      }
      
      this.emit('fileDeleted', { filePath, permanent });
      
      return {
        filePath,
        success: true
      };
    } catch (error) {
      console.error(`❌ [FILE_MANAGER] Failed to delete ${filePath}:`, error);
      return {
        filePath,
        success: false,
        error: (error as Error).message
      };
    }
  }

  /**
   * Delete multiple screenshots
   */
  async deleteScreenshots(filePaths: string[], permanent = false): Promise<BulkOperationResult> {
    console.log(`🗑️ [FILE_MANAGER] Deleting ${filePaths.length} screenshots (permanent: ${permanent})`);
    
    const results: BulkOperationResult = {
      success: [],
      failed: [],
      totalCount: filePaths.length
    };
    
    // Process files in batches
    const batchSize = 5;
    for (let i = 0; i < filePaths.length; i += batchSize) {
      const batch = filePaths.slice(i, i + batchSize);
      
      const batchResults = await Promise.all(
        batch.map(filePath => this.deleteScreenshot(filePath, permanent))
      );
      
      batchResults.forEach(result => {
        if (result.success) {
          results.success.push(result);
        } else {
          results.failed.push(result);
        }
      });
      
      // Emit progress
      this.emit('bulkDeleteProgress', {
        processed: Math.min(i + batchSize, filePaths.length),
        total: filePaths.length
      });
      
      // Small delay to prevent overwhelming the file system
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    
    console.log(`🗑️ [FILE_MANAGER] Deleted ${results.success.length}/${filePaths.length} screenshots`);
    this.emit('bulkDeleteCompleted', results);
    
    return results;
  }

  /**
   * Add a deleted item to the cache for potential recovery
   */
  private addToDeletedItemsCache(filePath: string, sidecarData?: any): void {
    const fileName = path.basename(filePath);
    const deletedItem: DeletedItem = {
      originalPath: filePath,
      fileName,
      deletedAt: new Date(),
      sidecarData
    };
    
    this.deletedItemsCache.set(filePath, deletedItem);
    
    // Trim cache if it gets too large
    if (this.deletedItemsCache.size > this.maxDeletedItemsCache) {
      const oldestKey = this.deletedItemsCache.keys().next().value;
      if (oldestKey) {
        this.deletedItemsCache.delete(oldestKey);
      }
    }
  }

  /**
   * Get recently deleted items for recovery
   */
  getRecentlyDeletedItems(): DeletedItem[] {
    return Array.from(this.deletedItemsCache.values())
      .sort((a, b) => b.deletedAt.getTime() - a.deletedAt.getTime());
  }

  /**
   * Clean up expired deleted items from cache
   */
  private cleanupExpiredDeletedItems(): void {
    const now = new Date();
    const expiredKeys: string[] = [];
    
    for (const [key, item] of this.deletedItemsCache) {
      const daysSinceDeleted = (now.getTime() - item.deletedAt.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceDeleted > this.deletedItemsRetentionDays) {
        expiredKeys.push(key);
      }
    }
    
    expiredKeys.forEach(key => this.deletedItemsCache.delete(key));
    
    if (expiredKeys.length > 0) {
      console.log(`🧹 [FILE_MANAGER] Cleaned up ${expiredKeys.length} expired deleted items`);
    }
  }

  /**
   * Clean up orphaned sidecar files
   */
  async cleanupOrphanedSidecars(directory: string): Promise<number> {
    try {
      console.log(`🧹 [FILE_MANAGER] Cleaning up orphaned sidecars in ${directory}`);
      
      const files = await fs.readdir(directory);
      const sidecarFiles = files.filter(file => file.endsWith('.screenshotos.json'));
      let removedCount = 0;
      
      for (const sidecarFile of sidecarFiles) {
        const sidecarPath = path.join(directory, sidecarFile);
        const imagePath = sidecarPath.replace('.screenshotos.json', '');
        
        try {
          await fs.access(imagePath);
          // Image exists, sidecar is not orphaned
        } catch {
          // Image doesn't exist, remove orphaned sidecar
          await fs.unlink(sidecarPath);
          removedCount++;
          console.log(`🧹 [FILE_MANAGER] Removed orphaned sidecar: ${sidecarPath}`);
        }
      }
      
      return removedCount;
    } catch (error) {
      console.error(`❌ [FILE_MANAGER] Failed to cleanup orphaned sidecars:`, error);
      return 0;
    }
  }

  /**
   * Get file operation statistics
   */
  getStatistics() {
    return {
      recentlyDeletedCount: this.deletedItemsCache.size,
      cacheRetentionDays: this.deletedItemsRetentionDays
    };
  }
}

// Export singleton instance
export const fileManager = new FileManager();