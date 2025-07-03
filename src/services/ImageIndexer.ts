import { promises as fs } from 'fs';
import path from 'path';
import { EventEmitter } from 'events';
import { app } from 'electron';

export interface IndexedImage {
  id: string;
  filePath: string;
  fileName: string;
  timestamp: Date;
  fileSize: number;
  dimensions?: { width: number; height: number };
  tags: string[];
  notes?: string;
  ocrText?: string;
  lastModified: Date;
  lastIndexed: Date;
}

export interface ImageIndex {
  version: string;
  lastFullScan: Date;
  images: Map<string, IndexedImage>;
  searchIndex: Map<string, Set<string>>; // word -> set of image IDs
}

export class ImageIndexer extends EventEmitter {
  private index: ImageIndex;
  private isScanning = false;
  private scanAbortController: AbortController | null = null;
  private readonly supportedExtensions = new Set(['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp', '.tiff', '.tif']);
  private readonly indexVersion = '1.0.0';
  private readonly indexFilePath: string;
  private saveTimeout: NodeJS.Timeout | null = null;

  constructor() {
    super();
    this.indexFilePath = path.join(app.getPath('userData'), 'image-index.json');
    this.index = {
      version: this.indexVersion,
      lastFullScan: new Date(0),
      images: new Map(),
      searchIndex: new Map()
    };
    
    // Load existing index from disk
    this.loadIndex().catch((error) => {
      console.warn('Failed to load existing index, starting fresh:', error);
    });
  }

  /**
   * Load index from persistent storage
   */
  private async loadIndex(): Promise<void> {
    try {
      const indexData = await fs.readFile(this.indexFilePath, 'utf-8');
      const parsed = JSON.parse(indexData);
      
      // Validate version compatibility
      if (parsed.version !== this.indexVersion) {
        console.log(`Index version mismatch (${parsed.version} vs ${this.indexVersion}), rebuilding index`);
        return;
      }
      
      // Convert serialized data back to Maps
      this.index = {
        version: parsed.version,
        lastFullScan: new Date(parsed.lastFullScan),
        images: new Map(Object.entries(parsed.images).map(([key, value]: [string, any]) => [
          key,
          {
            ...value,
            timestamp: new Date(value.timestamp),
            lastModified: new Date(value.lastModified),
            lastIndexed: new Date(value.lastIndexed)
          }
        ])),
        searchIndex: new Map(Object.entries(parsed.searchIndex).map(([key, value]) => [
          key,
          new Set(value as string[])
        ]))
      };
      
      console.log(`📁 [INDEXER] Loaded index with ${this.index.images.size} images from disk`);
      this.emit('indexLoaded', { imageCount: this.index.images.size });
    } catch (error) {
      // File doesn't exist or is corrupted, start fresh
      throw error;
    }
  }

  /**
   * Save index to persistent storage (debounced)
   */
  private scheduleSave(): void {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
    
    this.saveTimeout = setTimeout(() => {
      this.saveIndex().catch((error) => {
        console.error('Failed to save index:', error);
      });
    }, 5000); // Save after 5 seconds of inactivity
  }

  /**
   * Immediately save index to persistent storage
   */
  private async saveIndex(): Promise<void> {
    try {
      // Convert Maps to serializable objects
      const serializable = {
        version: this.index.version,
        lastFullScan: this.index.lastFullScan.toISOString(),
        images: Object.fromEntries(
          Array.from(this.index.images.entries()).map(([key, value]) => [
            key,
            {
              ...value,
              timestamp: value.timestamp.toISOString(),
              lastModified: value.lastModified.toISOString(),
              lastIndexed: value.lastIndexed.toISOString()
            }
          ])
        ),
        searchIndex: Object.fromEntries(
          Array.from(this.index.searchIndex.entries()).map(([key, value]) => [
            key,
            Array.from(value)
          ])
        )
      };
      
      await fs.writeFile(this.indexFilePath, JSON.stringify(serializable, null, 2), 'utf-8');
      console.log(`💾 [INDEXER] Saved index with ${this.index.images.size} images to disk`);
    } catch (error) {
      console.error('Failed to save index to disk:', error);
      throw error;
    }
  }

  /**
   * Start background indexing of a directory
   */
  async startIndexing(directoryPath: string): Promise<void> {
    if (this.isScanning) {
      console.log('📁 [INDEXER] Already scanning, skipping...');
      return;
    }

    this.isScanning = true;
    this.scanAbortController = new AbortController();

    try {
      console.log(`📁 [INDEXER] Starting background scan of ${directoryPath}`);
      this.emit('scanStarted', { directoryPath });

      await this.scanDirectory(directoryPath);

      console.log(`📁 [INDEXER] Completed scan. Found ${this.index.images.size} images.`);
      this.emit('scanCompleted', { 
        directoryPath, 
        imageCount: this.index.images.size 
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('📁 [INDEXER] Scan aborted');
        this.emit('scanAborted');
      } else {
        console.error('📁 [INDEXER] Scan failed:', error);
        this.emit('scanError', error);
      }
    } finally {
      this.isScanning = false;
      this.scanAbortController = null;
    }
  }

  /**
   * Stop the current scanning operation
   */
  stopIndexing(): void {
    if (this.scanAbortController) {
      this.scanAbortController.abort();
    }
  }

  /**
   * Scan directory for images and update index
   */
  private async scanDirectory(directoryPath: string): Promise<void> {
    try {
      const files = await fs.readdir(directoryPath, { withFileTypes: true });
      const batchSize = 10; // Process files in batches to avoid blocking
      
      for (let i = 0; i < files.length; i += batchSize) {
        if (this.scanAbortController?.signal.aborted) {
          throw new Error('Scan aborted');
        }

        const batch = files.slice(i, i + batchSize);
        await Promise.all(batch.map(file => this.processFile(directoryPath, file)));

        // Emit progress update
        this.emit('scanProgress', {
          processed: Math.min(i + batchSize, files.length),
          total: files.length,
          currentFile: batch[batch.length - 1]?.name
        });

        // Small delay to prevent blocking the main thread
        await new Promise(resolve => setTimeout(resolve, 1));
      }

      this.index.lastFullScan = new Date();
      
      // Save the updated index
      await this.saveIndex();
    } catch (error) {
      throw error;
    }
  }

  /**
   * Process a single file
   */
  private async processFile(directoryPath: string, file: any): Promise<void> {
    if (!file.isFile()) return;

    const ext = path.extname(file.name).toLowerCase();
    if (!this.supportedExtensions.has(ext)) return;

    const filePath = path.join(directoryPath, file.name);
    
    try {
      const stats = await fs.stat(filePath);
      const fileId = this.generateFileId(filePath);
      
      // Check if file already exists in index and hasn't changed
      const existingImage = this.index.images.get(fileId);
      if (existingImage && existingImage.lastModified.getTime() === stats.mtime.getTime()) {
        return; // Skip if unchanged
      }

      // Create indexed image entry
      const indexedImage: IndexedImage = {
        id: fileId,
        filePath,
        fileName: file.name,
        timestamp: stats.birthtime || stats.mtime,
        fileSize: stats.size,
        tags: [],
        lastModified: stats.mtime,
        lastIndexed: new Date()
      };

      // Try to load sidecar file for additional metadata
      await this.loadSidecarData(indexedImage);

      // Add to index
      this.index.images.set(fileId, indexedImage);
      this.updateSearchIndex(indexedImage);

      this.emit('imageIndexed', indexedImage);
      
      // Schedule save to persistent storage
      this.scheduleSave();
    } catch (error) {
      console.warn(`📁 [INDEXER] Failed to process file ${filePath}:`, error);
    }
  }

  /**
   * Load sidecar file data (tags, notes, OCR text)
   */
  private async loadSidecarData(image: IndexedImage): Promise<void> {
    const sidecarPath = `${image.filePath}.screenshotos.json`;
    
    try {
      const sidecarData = await fs.readFile(sidecarPath, 'utf-8');
      const metadata = JSON.parse(sidecarData);
      
      image.tags = metadata.tags || [];
      image.notes = metadata.notes;
      image.ocrText = metadata.ocrText;
      image.dimensions = metadata.dimensions;
    } catch (error) {
      // Sidecar file doesn't exist or is invalid, which is fine
    }
  }

  /**
   * Update search index for an image
   */
  private updateSearchIndex(image: IndexedImage): void {
    // Remove old search entries for this image
    this.removeFromSearchIndex(image.id);

    // Add new search terms
    const searchTerms = new Set<string>();
    
    // Add filename terms
    this.extractSearchTerms(image.fileName).forEach(term => searchTerms.add(term));
    
    // Add tag terms
    image.tags.forEach(tag => searchTerms.add(tag.toLowerCase()));
    
    // Add notes terms
    if (image.notes) {
      this.extractSearchTerms(image.notes).forEach(term => searchTerms.add(term));
    }
    
    // Add OCR text terms
    if (image.ocrText) {
      this.extractSearchTerms(image.ocrText).forEach(term => searchTerms.add(term));
    }

    // Add to search index
    searchTerms.forEach(term => {
      if (!this.index.searchIndex.has(term)) {
        this.index.searchIndex.set(term, new Set());
      }
      this.index.searchIndex.get(term)!.add(image.id);
    });
  }

  /**
   * Remove an image from search index
   */
  private removeFromSearchIndex(imageId: string): void {
    for (const [term, imageIds] of this.index.searchIndex.entries()) {
      imageIds.delete(imageId);
      if (imageIds.size === 0) {
        this.index.searchIndex.delete(term);
      }
    }
  }

  /**
   * Extract search terms from text
   */
  private extractSearchTerms(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ') // Replace non-word chars with spaces
      .split(/\s+/)
      .filter(term => term.length >= 2) // Only terms with 2+ characters
      .filter(term => !this.isStopWord(term));
  }

  /**
   * Check if a word is a common stop word
   */
  private isStopWord(word: string): boolean {
    const stopWords = new Set(['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those']);
    return stopWords.has(word);
  }

  /**
   * Generate a unique ID for a file
   */
  private generateFileId(filePath: string): string {
    return Buffer.from(filePath).toString('base64').replace(/[/+=]/g, '');
  }

  /**
   * Search for images by query
   */
  search(query: string, limit = 100): IndexedImage[] {
    if (!query.trim()) {
      // Return all images sorted by timestamp if no query
      return Array.from(this.index.images.values())
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
        .slice(0, limit);
    }

    const searchTerms = this.extractSearchTerms(query);
    const imageScores = new Map<string, number>();

    // Score images based on search term matches
    searchTerms.forEach(term => {
      const matchingImages = this.index.searchIndex.get(term);
      if (matchingImages) {
        matchingImages.forEach(imageId => {
          imageScores.set(imageId, (imageScores.get(imageId) || 0) + 1);
        });
      }
    });

    // Sort by score (descending) then by timestamp (newest first)
    return Array.from(imageScores.entries())
      .sort((a, b) => {
        const scoreDiff = b[1] - a[1];
        if (scoreDiff !== 0) return scoreDiff;
        
        const imageA = this.index.images.get(a[0])!;
        const imageB = this.index.images.get(b[0])!;
        return imageB.timestamp.getTime() - imageA.timestamp.getTime();
      })
      .slice(0, limit)
      .map(([imageId]) => this.index.images.get(imageId)!)
      .filter(Boolean);
  }

  /**
   * Get images by date range
   */
  getImagesByDateRange(startDate: Date, endDate: Date): IndexedImage[] {
    return Array.from(this.index.images.values())
      .filter(image => image.timestamp >= startDate && image.timestamp <= endDate)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Get images by tags
   */
  getImagesByTags(tags: string[]): IndexedImage[] {
    return Array.from(this.index.images.values())
      .filter(image => tags.some(tag => image.tags.includes(tag)))
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Get all unique tags
   */
  getAllTags(): string[] {
    const tags = new Set<string>();
    this.index.images.forEach(image => {
      image.tags.forEach(tag => tags.add(tag));
    });
    return Array.from(tags).sort();
  }

  /**
   * Get total number of indexed images
   */
  getImageCount(): number {
    return this.index.images.size;
  }

  /**
   * Check if currently scanning
   */
  isCurrentlyScanning(): boolean {
    return this.isScanning;
  }

  /**
   * Get last scan date
   */
  getLastScanDate(): Date {
    return this.index.lastFullScan;
  }

  /**
   * Add a new image to the index manually
   */
  async addImage(filePath: string): Promise<void> {
    const directoryPath = path.dirname(filePath);
    const fileName = path.basename(filePath);
    
    await this.processFile(directoryPath, { 
      name: fileName, 
      isFile: () => true 
    });
    
    // Save will be triggered by processFile's scheduleSave call
  }

  /**
   * Remove an image from the index
   */
  removeImage(filePath: string): void {
    const fileId = this.generateFileId(filePath);
    const image = this.index.images.get(fileId);
    
    if (image) {
      this.removeFromSearchIndex(fileId);
      this.index.images.delete(fileId);
      this.emit('imageRemoved', image);
      this.scheduleSave();
    }
  }

  /**
   * Update an image's metadata in the index
   */
  updateImageMetadata(filePath: string, metadata: Partial<IndexedImage>): void {
    const fileId = this.generateFileId(filePath);
    const image = this.index.images.get(fileId);
    
    if (image) {
      Object.assign(image, metadata);
      image.lastIndexed = new Date();
      this.updateSearchIndex(image);
      this.emit('imageUpdated', image);
      this.scheduleSave();
    }
  }

  /**
   * Force immediate save to disk
   */
  async forceSave(): Promise<void> {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
      this.saveTimeout = null;
    }
    await this.saveIndex();
  }

  /**
   * Cleanup resources and save before shutdown
   */
  async shutdown(): Promise<void> {
    // Stop any ongoing scan
    this.stopIndexing();
    
    // Force save any pending changes
    await this.forceSave();
    
    console.log('📁 [INDEXER] Shut down gracefully');
  }
}