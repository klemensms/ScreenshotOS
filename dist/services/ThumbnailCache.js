"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ThumbnailCache = void 0;
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const events_1 = require("events");
const jimp_1 = require("jimp");
const electron_1 = require("electron");
class ThumbnailCache extends events_1.EventEmitter {
    constructor() {
        super();
        this.cache = new Map();
        this.processingQueue = new Set();
        this.defaultOptions = {
            width: 200,
            height: 200,
            quality: 80
        };
        this.cacheDir = path_1.default.join(electron_1.app.getPath('userData'), 'thumbnails');
        this.ensureCacheDirectory();
    }
    /**
     * Ensure the cache directory exists
     */
    async ensureCacheDirectory() {
        try {
            await fs_1.promises.mkdir(this.cacheDir, { recursive: true });
        }
        catch (error) {
            console.error('Failed to create thumbnail cache directory:', error);
        }
    }
    /**
     * Generate a cache key for a file path and options
     */
    generateCacheKey(filePath, options) {
        const hash = Buffer.from(`${filePath}-${options.width}x${options.height}-${options.quality}`)
            .toString('base64')
            .replace(/[/+=]/g, '');
        return hash;
    }
    /**
     * Get thumbnail path for a given file and options
     */
    getThumbnailPath(filePath, options) {
        const cacheKey = this.generateCacheKey(filePath, options);
        return path_1.default.join(this.cacheDir, `${cacheKey}.jpg`);
    }
    /**
     * Check if thumbnail exists and is up-to-date
     */
    async isThumbnailValid(filePath, thumbnailPath) {
        try {
            const [originalStats, thumbnailStats] = await Promise.all([
                fs_1.promises.stat(filePath),
                fs_1.promises.stat(thumbnailPath)
            ]);
            // Thumbnail is valid if it exists and is newer than the original file
            return thumbnailStats.mtime >= originalStats.mtime;
        }
        catch (error) {
            // If either file doesn't exist or can't be accessed, thumbnail is invalid
            return false;
        }
    }
    /**
     * Generate thumbnail for an image file
     */
    async generateThumbnail(filePath, thumbnailPath, options) {
        try {
            console.log(`🖼️ [THUMBNAIL] Generating thumbnail for ${filePath}`);
            // Read and process image with Jimp
            const image = await jimp_1.Jimp.read(filePath);
            // Calculate dimensions maintaining aspect ratio
            const aspectRatio = image.width / image.height;
            let newWidth = options.width;
            let newHeight = options.height;
            if (aspectRatio > 1) {
                // Landscape: fit to width
                newHeight = Math.round(options.width / aspectRatio);
            }
            else {
                // Portrait or square: fit to height
                newWidth = Math.round(options.height * aspectRatio);
            }
            // Resize and save thumbnail
            image.resize({ w: newWidth, h: newHeight });
            // Get the buffer and write to file manually
            const buffer = await image.getBuffer('image/jpeg');
            await fs_1.promises.writeFile(thumbnailPath, buffer);
            console.log(`✅ [THUMBNAIL] Generated ${newWidth}x${newHeight} thumbnail: ${thumbnailPath}`);
        }
        catch (error) {
            console.error(`❌ [THUMBNAIL] Failed to generate thumbnail for ${filePath}:`, error);
            throw error;
        }
    }
    /**
     * Get or generate thumbnail for an image file
     */
    async getThumbnail(filePath, options = {}) {
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
                            await fs_1.promises.access(thumbnailPath);
                            resolve(thumbnailPath);
                        }
                        catch {
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
            const originalStats = await fs_1.promises.stat(filePath);
            const cachedThumbnail = {
                filePath,
                thumbnailPath,
                originalModified: originalStats.mtime,
                thumbnailGenerated: new Date(),
                size: { width: thumbnailOptions.width, height: thumbnailOptions.height }
            };
            this.cache.set(cacheKey, cachedThumbnail);
            this.emit('thumbnailGenerated', cachedThumbnail);
            return thumbnailPath;
        }
        catch (error) {
            this.emit('thumbnailError', { filePath, error });
            return null;
        }
        finally {
            this.processingQueue.delete(cacheKey);
        }
    }
    /**
     * Get thumbnail as base64 data URL
     */
    async getThumbnailBase64(filePath, options = {}) {
        const thumbnailPath = await this.getThumbnail(filePath, options);
        if (!thumbnailPath) {
            return null;
        }
        try {
            const thumbnailBuffer = await fs_1.promises.readFile(thumbnailPath);
            return `data:image/jpeg;base64,${thumbnailBuffer.toString('base64')}`;
        }
        catch (error) {
            console.error(`Failed to read thumbnail ${thumbnailPath}:`, error);
            return null;
        }
    }
    /**
     * Pregenerate thumbnails for multiple files
     */
    async pregenerateThumbnails(filePaths, options = {}) {
        const thumbnailOptions = { ...this.defaultOptions, ...options };
        const batchSize = 5; // Process thumbnails in batches to avoid overwhelming the system
        console.log(`🖼️ [THUMBNAIL] Pregenerating thumbnails for ${filePaths.length} files`);
        for (let i = 0; i < filePaths.length; i += batchSize) {
            const batch = filePaths.slice(i, i + batchSize);
            await Promise.all(batch.map(async (filePath) => {
                try {
                    await this.getThumbnail(filePath, thumbnailOptions);
                }
                catch (error) {
                    console.warn(`Failed to pregenerate thumbnail for ${filePath}:`, error);
                }
            }));
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
    async clearCache() {
        try {
            const files = await fs_1.promises.readdir(this.cacheDir);
            await Promise.all(files.map(file => fs_1.promises.unlink(path_1.default.join(this.cacheDir, file))));
            this.cache.clear();
            console.log('🗑️ [THUMBNAIL] Cache cleared');
            this.emit('cacheCleared');
        }
        catch (error) {
            console.error('Failed to clear thumbnail cache:', error);
        }
    }
    /**
     * Remove specific thumbnail from cache
     */
    async removeThumbnail(filePath, options = {}) {
        const thumbnailOptions = { ...this.defaultOptions, ...options };
        const thumbnailPath = this.getThumbnailPath(filePath, thumbnailOptions);
        const cacheKey = this.generateCacheKey(filePath, thumbnailOptions);
        try {
            await fs_1.promises.unlink(thumbnailPath);
            this.cache.delete(cacheKey);
            this.emit('thumbnailRemoved', { filePath, thumbnailPath });
        }
        catch (error) {
            // File might not exist, which is fine
        }
    }
    /**
     * Get cache statistics
     */
    async getCacheStats() {
        try {
            const files = await fs_1.promises.readdir(this.cacheDir);
            const thumbnailFiles = files.filter(file => file.endsWith('.jpg'));
            let totalSize = 0;
            for (const file of thumbnailFiles) {
                const stats = await fs_1.promises.stat(path_1.default.join(this.cacheDir, file));
                totalSize += stats.size;
            }
            return {
                totalThumbnails: thumbnailFiles.length,
                cacheSize: totalSize,
                cacheDirectory: this.cacheDir
            };
        }
        catch (error) {
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
    async cleanupOrphanedThumbnails() {
        try {
            const files = await fs_1.promises.readdir(this.cacheDir);
            const thumbnailFiles = files.filter(file => file.endsWith('.jpg'));
            let removedCount = 0;
            for (const file of thumbnailFiles) {
                const thumbnailPath = path_1.default.join(this.cacheDir, file);
                // Try to find corresponding cached entry
                let hasValidSource = false;
                for (const [, cachedThumbnail] of this.cache) {
                    if (path_1.default.basename(cachedThumbnail.thumbnailPath) === file) {
                        try {
                            await fs_1.promises.access(cachedThumbnail.filePath);
                            hasValidSource = true;
                            break;
                        }
                        catch {
                            // Source file no longer exists
                        }
                    }
                }
                if (!hasValidSource) {
                    await fs_1.promises.unlink(thumbnailPath);
                    removedCount++;
                }
            }
            console.log(`🧹 [THUMBNAIL] Cleaned up ${removedCount} orphaned thumbnails`);
            return removedCount;
        }
        catch (error) {
            console.error('Failed to cleanup orphaned thumbnails:', error);
            return 0;
        }
    }
}
exports.ThumbnailCache = ThumbnailCache;
