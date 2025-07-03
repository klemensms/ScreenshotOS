import { promises as fs } from 'fs';
import path from 'path';
import { EventEmitter } from 'events';
import { Jimp } from 'jimp';
import { app } from 'electron';

export interface ThumbnailOptions {
  width: number;
  height: number;
  quality: number; // 0-100
}

export interface CachedThumbnail {
  filePath: string;
  thumbnailPath: string;
  originalModified: Date;
  thumbnailGenerated: Date;
  size: { width: number; height: number };
}

export class ThumbnailCache extends EventEmitter {
  private cacheDir: string;
  private cache = new Map<string, CachedThumbnail>();
  private processingQueue = new Set<string>();
  private readonly defaultOptions: ThumbnailOptions = {
    width: 200,
    height: 200,
    quality: 80
  };

  constructor() {
    super();
    this.cacheDir = path.join(app.getPath('userData'), 'thumbnails');
    this.ensureCacheDirectory();
  }

  /**
   * Ensure the cache directory exists
   */
  private async ensureCacheDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.cacheDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create thumbnail cache directory:', error);
    }
  }

  /**
   * Generate a cache key for a file path and options
   */
  private generateCacheKey(filePath: string, options: ThumbnailOptions): string {
    const hash = Buffer.from(`${filePath}-${options.width}x${options.height}-${options.quality}`)
      .toString('base64')
      .replace(/[/+=]/g, '');
    return hash;
  }

  /**
   * Get thumbnail path for a given file and options
   */
  private getThumbnailPath(filePath: string, options: ThumbnailOptions): string {
    const cacheKey = this.generateCacheKey(filePath, options);
    return path.join(this.cacheDir, `${cacheKey}.jpg`);
  }

  /**
   * Check if thumbnail exists and is up-to-date
   */
  private async isThumbnailValid(filePath: string, thumbnailPath: string): Promise<boolean> {
    try {
      const [originalStats, thumbnailStats] = await Promise.all([
        fs.stat(filePath),
        fs.stat(thumbnailPath)
      ]);

      // Thumbnail is valid if it exists and is newer than the original file
      return thumbnailStats.mtime >= originalStats.mtime;
    } catch (error) {
      // If either file doesn't exist or can't be accessed, thumbnail is invalid
      return false;
    }
  }

  /**
   * Generate thumbnail for an image file
   */
  private async generateThumbnail(
    filePath: string, 
    thumbnailPath: string, 
    options: ThumbnailOptions
  ): Promise<void> {
    try {
      console.log(`🖼️ [THUMBNAIL] Generating thumbnail for ${filePath}`);
      
      // Read and process image with Jimp
      const image = await Jimp.read(filePath);
      
      // Calculate dimensions maintaining aspect ratio
      const aspectRatio = image.width / image.height;
      let newWidth = options.width;
      let newHeight = options.height;
      
      if (aspectRatio > 1) {
        // Landscape: fit to width
        newHeight = Math.round(options.width / aspectRatio);
      } else {
        // Portrait or square: fit to height
        newWidth = Math.round(options.height * aspectRatio);
      }

      // Resize and save thumbnail
      image.resize({ w: newWidth, h: newHeight });
      
      // Get the buffer and write to file manually
      const buffer = await image.getBuffer('image/jpeg');
      await fs.writeFile(thumbnailPath, buffer);

      console.log(`✅ [THUMBNAIL] Generated ${newWidth}x${newHeight} thumbnail: ${thumbnailPath}`);
    } catch (error) {
      console.error(`❌ [THUMBNAIL] Failed to generate thumbnail for ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Get or generate thumbnail for an image file
   */
  async getThumbnail(
    filePath: string, 
    options: Partial<ThumbnailOptions> = {}
  ): Promise<string | null> {
    const thumbnailOptions = { ...this.defaultOptions, ...options };
    const thumbnailPath = this.getThumbnailPath(filePath, thumbnailOptions);
    const cacheKey = this.generateCacheKey(filePath, thumbnailOptions);

    // Check if we're already processing this thumbnail
    if (this.processingQueue.has(cacheKey)) {
      // Wait for processing to complete
      return new Promise((resolve) => {
        const checkInterval = setInterval(async () => {
          if (!this.processingQueue.has(cacheKey)) {
            clearInterval(checkInterval);
            // Check if thumbnail was successfully created
            try {
              await fs.access(thumbnailPath);
              resolve(thumbnailPath);
            } catch {
              resolve(null);
            }
          }
        }, 100);
      });
    }

    // Check if valid thumbnail already exists
    if (await this.isThumbnailValid(filePath, thumbnailPath)) {
      return thumbnailPath;
    }

    // Generate new thumbnail
    this.processingQueue.add(cacheKey);
    
    try {
      await this.generateThumbnail(filePath, thumbnailPath, thumbnailOptions);
      
      // Cache the thumbnail info
      const originalStats = await fs.stat(filePath);
      const cachedThumbnail: CachedThumbnail = {
        filePath,
        thumbnailPath,
        originalModified: originalStats.mtime,
        thumbnailGenerated: new Date(),
        size: { width: thumbnailOptions.width, height: thumbnailOptions.height }
      };
      
      this.cache.set(cacheKey, cachedThumbnail);
      this.emit('thumbnailGenerated', cachedThumbnail);
      
      return thumbnailPath;
    } catch (error) {
      this.emit('thumbnailError', { filePath, error });
      return null;
    } finally {
      this.processingQueue.delete(cacheKey);
    }
  }

  /**
   * Get thumbnail as base64 data URL
   */
  async getThumbnailBase64(
    filePath: string, 
    options: Partial<ThumbnailOptions> = {}
  ): Promise<string | null> {
    const thumbnailPath = await this.getThumbnail(filePath, options);
    
    if (!thumbnailPath) {
      return null;
    }

    try {
      const thumbnailBuffer = await fs.readFile(thumbnailPath);
      return `data:image/jpeg;base64,${thumbnailBuffer.toString('base64')}`;
    } catch (error) {
      console.error(`Failed to read thumbnail ${thumbnailPath}:`, error);
      return null;
    }
  }

  /**
   * Pregenerate thumbnails for multiple files
   */
  async pregenerateThumbnails(
    filePaths: string[], 
    options: Partial<ThumbnailOptions> = {}
  ): Promise<void> {
    const thumbnailOptions = { ...this.defaultOptions, ...options };
    const batchSize = 5; // Process thumbnails in batches to avoid overwhelming the system

    console.log(`🖼️ [THUMBNAIL] Pregenerating thumbnails for ${filePaths.length} files`);

    for (let i = 0; i < filePaths.length; i += batchSize) {
      const batch = filePaths.slice(i, i + batchSize);
      
      await Promise.all(
        batch.map(async (filePath) => {
          try {
            await this.getThumbnail(filePath, thumbnailOptions);
          } catch (error) {
            console.warn(`Failed to pregenerate thumbnail for ${filePath}:`, error);
          }
        })
      );

      // Emit progress
      this.emit('pregenerateProgress', {
        processed: Math.min(i + batchSize, filePaths.length),
        total: filePaths.length
      });

      // Small delay to prevent overwhelming the system
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    console.log(`✅ [THUMBNAIL] Completed pregenerating thumbnails`);
  }

  /**
   * Clear all cached thumbnails
   */
  async clearCache(): Promise<void> {
    try {
      const files = await fs.readdir(this.cacheDir);
      await Promise.all(
        files.map(file => fs.unlink(path.join(this.cacheDir, file)))
      );
      
      this.cache.clear();
      console.log('🗑️ [THUMBNAIL] Cache cleared');
      this.emit('cacheCleared');
    } catch (error) {
      console.error('Failed to clear thumbnail cache:', error);
    }
  }

  /**
   * Remove specific thumbnail from cache
   */
  async removeThumbnail(filePath: string, options: Partial<ThumbnailOptions> = {}): Promise<void> {
    const thumbnailOptions = { ...this.defaultOptions, ...options };
    const thumbnailPath = this.getThumbnailPath(filePath, thumbnailOptions);
    const cacheKey = this.generateCacheKey(filePath, thumbnailOptions);

    try {
      await fs.unlink(thumbnailPath);
      this.cache.delete(cacheKey);
      this.emit('thumbnailRemoved', { filePath, thumbnailPath });
    } catch (error) {
      // File might not exist, which is fine
    }
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<{
    totalThumbnails: number;
    cacheSize: number;
    cacheDirectory: string;
  }> {
    try {
      const files = await fs.readdir(this.cacheDir);
      const thumbnailFiles = files.filter(file => file.endsWith('.jpg'));
      
      let totalSize = 0;
      for (const file of thumbnailFiles) {
        const stats = await fs.stat(path.join(this.cacheDir, file));
        totalSize += stats.size;
      }

      return {
        totalThumbnails: thumbnailFiles.length,
        cacheSize: totalSize,
        cacheDirectory: this.cacheDir
      };
    } catch (error) {
      return {
        totalThumbnails: 0,
        cacheSize: 0,
        cacheDirectory: this.cacheDir
      };
    }
  }

  /**
   * Cleanup old thumbnails that no longer have corresponding source files
   */
  async cleanupOrphanedThumbnails(): Promise<number> {
    try {
      const files = await fs.readdir(this.cacheDir);
      const thumbnailFiles = files.filter(file => file.endsWith('.jpg'));
      let removedCount = 0;

      for (const file of thumbnailFiles) {
        const thumbnailPath = path.join(this.cacheDir, file);
        
        // Try to find corresponding cached entry
        let hasValidSource = false;
        for (const [, cachedThumbnail] of this.cache) {
          if (path.basename(cachedThumbnail.thumbnailPath) === file) {
            try {
              await fs.access(cachedThumbnail.filePath);
              hasValidSource = true;
              break;
            } catch {
              // Source file no longer exists
            }
          }
        }

        if (!hasValidSource) {
          await fs.unlink(thumbnailPath);
          removedCount++;
        }
      }

      console.log(`🧹 [THUMBNAIL] Cleaned up ${removedCount} orphaned thumbnails`);
      return removedCount;
    } catch (error) {
      console.error('Failed to cleanup orphaned thumbnails:', error);
      return 0;
    }
  }
}