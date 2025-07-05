import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { app } from 'electron';

// Interfaces for sidecar file structure
export interface SidecarMetadata {
  captureTimestamp: string;
  applicationInfo: {
    name: string;
    bundleId?: string;
    version?: string;
    windowTitle?: string;
  };
  screenInfo: {
    displayId?: string;
    resolution: {
      width: number;
      height: number;
    };
    scaleFactor?: number;
  };
  deviceInfo: {
    computerName?: string;
    osVersion?: string;
    username?: string;
  };
  captureMethod: 'fullscreen' | 'area' | 'window';
  captureArea?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface SidecarAnnotation {
  id: string;
  type: 'arrow' | 'rectangle' | 'text' | 'numbering';
  color: string;
  position: {
    x: number;
    y: number;
    width?: number;
    height?: number;
  };
  text?: string;
  number?: number;
  createdAt: string;
  modifiedAt: string;
  visible: boolean;
  zIndex: number;
}

export interface SidecarEditOperation {
  id: string;
  type: 'crop' | 'annotation' | 'blur' | 'adjust';
  operation: 'add' | 'modify' | 'remove';
  timestamp: string;
  parameters: any;
  annotationId?: string; // For annotation-related operations
}

export interface SidecarData {
  version: string;
  originalImagePath: string;
  originalImageChecksum: string;
  createdAt: string;
  modifiedAt: string;
  metadata: SidecarMetadata;
  tags: string[];
  notes: string;
  annotations: SidecarAnnotation[];
  editHistory: SidecarEditOperation[];
  ocrText?: string;
  ocrCompleted?: boolean;
  isArchived?: boolean;
  archivedAt?: string;
  archivedFromPath?: string;
}

class SidecarManager {
  private readonly SIDECAR_VERSION = '1.0.0';
  private readonly SIDECAR_EXTENSION = '.screenshotos.json';

  /**
   * Generate a sidecar file path for a given image path
   */
  getSidecarPath(imagePath: string): string {
    const parsedPath = path.parse(imagePath);
    return path.join(parsedPath.dir, parsedPath.base + this.SIDECAR_EXTENSION);
  }

  /**
   * Calculate SHA-256 checksum of an image file
   */
  async calculateImageChecksum(imagePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      const stream = fs.createReadStream(imagePath);
      
      stream.on('data', chunk => hash.update(chunk));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
  }

  /**
   * Verify that an image file matches its recorded checksum
   */
  async verifyImageIntegrity(imagePath: string, expectedChecksum: string): Promise<boolean> {
    try {
      // First check if the file exists
      if (!fs.existsSync(imagePath)) {
        console.warn(`Image file does not exist: ${imagePath}`);
        return false;
      }
      
      const actualChecksum = await this.calculateImageChecksum(imagePath);
      return actualChecksum === expectedChecksum;
    } catch (error) {
      console.error('Error verifying image integrity:', error);
      return false;
    }
  }

  /**
   * Create a new sidecar file for a screenshot
   */
  async createSidecarFile(
    imagePath: string,
    metadata: SidecarMetadata,
    tags: string[] = [],
    notes: string = '',
    annotations: SidecarAnnotation[] = []
  ): Promise<boolean> {
    try {
      const checksum = await this.calculateImageChecksum(imagePath);
      const now = new Date().toISOString();
      
      const sidecarData: SidecarData = {
        version: this.SIDECAR_VERSION,
        originalImagePath: imagePath,
        originalImageChecksum: checksum,
        createdAt: now,
        modifiedAt: now,
        metadata,
        tags,
        notes,
        annotations,
        editHistory: [],
        ocrText: '',
        ocrCompleted: false
      };

      const sidecarPath = this.getSidecarPath(imagePath);
      await fs.promises.writeFile(sidecarPath, JSON.stringify(sidecarData, null, 2), 'utf8');
      
      console.log(`Created sidecar file: ${sidecarPath}`);
      return true;
    } catch (error) {
      console.error('Error creating sidecar file:', error);
      return false;
    }
  }

  /**
   * Load sidecar data for a screenshot
   */
  async loadSidecarFile(imagePath: string): Promise<SidecarData | null> {
    try {
      const sidecarPath = this.getSidecarPath(imagePath);
      
      if (!fs.existsSync(sidecarPath)) {
        return null;
      }

      const data = await fs.promises.readFile(sidecarPath, 'utf8');
      const sidecarData = JSON.parse(data) as SidecarData;
      
      // Verify version compatibility
      if (!this.isVersionCompatible(sidecarData.version)) {
        console.warn(`Sidecar file version ${sidecarData.version} may be incompatible with current version ${this.SIDECAR_VERSION}`);
      }

      // Verify image integrity only if the image file exists
      if (fs.existsSync(imagePath)) {
        const isValid = await this.verifyImageIntegrity(imagePath, sidecarData.originalImageChecksum);
        if (!isValid) {
          console.warn(`Image integrity check failed for ${imagePath}`);
        }
      } else {
        console.warn(`Original image file not found: ${imagePath}`);
      }

      return sidecarData;
    } catch (error) {
      console.error('Error loading sidecar file:', error);
      return null;
    }
  }

  /**
   * Update an existing sidecar file
   */
  async updateSidecarFile(
    imagePath: string,
    updates: Partial<Pick<SidecarData, 'tags' | 'notes' | 'annotations' | 'ocrText' | 'ocrCompleted' | 'isArchived' | 'archivedAt' | 'archivedFromPath'>>
  ): Promise<boolean> {
    try {
      const sidecarData = await this.loadSidecarFile(imagePath);
      if (!sidecarData) {
        console.error('Cannot update non-existent sidecar file');
        return false;
      }

      // Apply updates
      const updatedData: SidecarData = {
        ...sidecarData,
        ...updates,
        modifiedAt: new Date().toISOString()
      };

      const sidecarPath = this.getSidecarPath(imagePath);
      await fs.promises.writeFile(sidecarPath, JSON.stringify(updatedData, null, 2), 'utf8');
      
      return true;
    } catch (error) {
      console.error('Error updating sidecar file:', error);
      return false;
    }
  }

  /**
   * Add an annotation to a sidecar file
   */
  async addAnnotation(imagePath: string, annotation: SidecarAnnotation): Promise<boolean> {
    try {
      const sidecarData = await this.loadSidecarFile(imagePath);
      if (!sidecarData) {
        console.error('Cannot add annotation to non-existent sidecar file');
        return false;
      }

      // Add annotation and create edit operation
      const updatedAnnotations = [...sidecarData.annotations, annotation];
      const editOperation: SidecarEditOperation = {
        id: `edit-${Date.now()}`,
        type: 'annotation',
        operation: 'add',
        timestamp: new Date().toISOString(),
        parameters: annotation,
        annotationId: annotation.id
      };

      const updatedEditHistory = [...sidecarData.editHistory, editOperation];

      return await this.updateSidecarFile(imagePath, {
        annotations: updatedAnnotations
      });
    } catch (error) {
      console.error('Error adding annotation to sidecar file:', error);
      return false;
    }
  }

  /**
   * Remove an annotation from a sidecar file
   */
  async removeAnnotation(imagePath: string, annotationId: string): Promise<boolean> {
    try {
      const sidecarData = await this.loadSidecarFile(imagePath);
      if (!sidecarData) {
        return false;
      }

      const updatedAnnotations = sidecarData.annotations.filter(a => a.id !== annotationId);
      const editOperation: SidecarEditOperation = {
        id: `edit-${Date.now()}`,
        type: 'annotation',
        operation: 'remove',
        timestamp: new Date().toISOString(),
        parameters: { annotationId },
        annotationId
      };

      const updatedEditHistory = [...sidecarData.editHistory, editOperation];

      return await this.updateSidecarFile(imagePath, {
        annotations: updatedAnnotations
      });
    } catch (error) {
      console.error('Error removing annotation from sidecar file:', error);
      return false;
    }
  }

  /**
   * Check if a sidecar file exists for an image
   */
  sidecarExists(imagePath: string): boolean {
    const sidecarPath = this.getSidecarPath(imagePath);
    return fs.existsSync(sidecarPath);
  }

  /**
   * Delete a sidecar file
   */
  async deleteSidecarFile(imagePath: string): Promise<boolean> {
    try {
      const sidecarPath = this.getSidecarPath(imagePath);
      if (fs.existsSync(sidecarPath)) {
        await fs.promises.unlink(sidecarPath);
        console.log(`Deleted sidecar file: ${sidecarPath}`);
      }
      return true;
    } catch (error) {
      console.error('Error deleting sidecar file:', error);
      return false;
    }
  }

  /**
   * Scan a directory for screenshots and their sidecar files
   */
  async scanDirectory(directoryPath: string): Promise<Array<{imagePath: string, sidecarPath: string, hasSidecar: boolean}>> {
    try {
      const files = await fs.promises.readdir(directoryPath, { withFileTypes: true });
      const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp', '.tiff', '.tif'];
      const imageFiles: Array<{fileName: string, filePath: string, stat: fs.Stats}> = [];

      // First pass: collect all image files with their stats
      for (const dirent of files) {
        if (dirent.isFile()) {
          const ext = path.extname(dirent.name).toLowerCase();
          if (imageExtensions.includes(ext)) {
            const filePath = path.join(directoryPath, dirent.name);
            try {
              const stat = await fs.promises.stat(filePath);
              imageFiles.push({
                fileName: dirent.name,
                filePath,
                stat
              });
            } catch (error) {
              // Skip files that can't be stat'd
              console.warn(`Cannot stat file: ${filePath}`, error);
            }
          }
        }
      }

      // Sort by creation time (newest first) and limit to reasonable number
      const MAX_FILES_TO_SCAN = 500; // Increased limit to support better pagination
      const sortedFiles = imageFiles
        .sort((a, b) => {
          // Use birthtime (creation time) instead of mtime to maintain chronological order
          const timeA = a.stat.birthtime ? a.stat.birthtime.getTime() : a.stat.mtime.getTime();
          const timeB = b.stat.birthtime ? b.stat.birthtime.getTime() : b.stat.mtime.getTime();
          return timeB - timeA; // Newest first
        })
        .slice(0, MAX_FILES_TO_SCAN);

      console.log(`📁 [SCAN] Found ${imageFiles.length} total images, processing ${sortedFiles.length} most recent files`);

      const results: Array<{imagePath: string, sidecarPath: string, hasSidecar: boolean}> = [];

      // Second pass: process only the most recent files
      for (const imageFile of sortedFiles) {
        const sidecarPath = this.getSidecarPath(imageFile.filePath);
        let hasSidecar = fs.existsSync(sidecarPath);
        
        // Check for legacy sidecar files (without .png extension) and migrate them
        if (!hasSidecar) {
          const legacySidecarPath = this.getLegacySidecarPath(imageFile.filePath);
          if (fs.existsSync(legacySidecarPath)) {
            console.log(`Migrating legacy sidecar file: ${legacySidecarPath} -> ${sidecarPath}`);
            try {
              await fs.promises.rename(legacySidecarPath, sidecarPath);
              hasSidecar = true;
            } catch (error) {
              console.error('Failed to migrate legacy sidecar file:', error);
            }
          }
        }
        
        results.push({
          imagePath: imageFile.filePath,
          sidecarPath,
          hasSidecar
        });
      }

      console.log(`📁 [SCAN] Returning ${results.length} image files for processing`);
      return results;
    } catch (error) {
      console.error('Error scanning directory:', error);
      return [];
    }
  }

  /**
   * Get legacy sidecar path (without .png extension) for migration
   */
  private getLegacySidecarPath(imagePath: string): string {
    const parsedPath = path.parse(imagePath);
    return path.join(parsedPath.dir, parsedPath.name + this.SIDECAR_EXTENSION);
  }

  /**
   * Mark a screenshot as archived in its sidecar file
   */
  async markAsArchived(imagePath: string, archivedFromPath?: string): Promise<boolean> {
    try {
      let sidecarData = await this.loadSidecarFile(imagePath);
      
      // Create sidecar if it doesn't exist
      if (!sidecarData) {
        const createResult = await this.createSidecarFile(imagePath, {
          captureTimestamp: new Date().toISOString(),
          applicationInfo: { name: 'ScreenshotOS' },
          screenInfo: { resolution: { width: 0, height: 0 } },
          deviceInfo: {},
          captureMethod: 'fullscreen'
        });
        
        if (!createResult) {
          return false;
        }
        
        sidecarData = await this.loadSidecarFile(imagePath);
        if (!sidecarData) {
          return false;
        }
      }
      
      // Update archive status
      const updatedData: SidecarData = {
        ...sidecarData,
        isArchived: true,
        archivedAt: new Date().toISOString(),
        archivedFromPath: archivedFromPath || imagePath,
        modifiedAt: new Date().toISOString()
      };
      
      const sidecarPath = this.getSidecarPath(imagePath);
      await fs.promises.writeFile(sidecarPath, JSON.stringify(updatedData, null, 2), 'utf8');
      
      return true;
    } catch (error) {
      console.error('Error marking screenshot as archived:', error);
      return false;
    }
  }

  /**
   * Remove archive status from a screenshot's sidecar file
   */
  async markAsUnarchived(imagePath: string): Promise<boolean> {
    try {
      const sidecarData = await this.loadSidecarFile(imagePath);
      if (!sidecarData) {
        return true; // No sidecar means not archived
      }
      
      // Remove archive status
      const updatedData: SidecarData = {
        ...sidecarData,
        isArchived: false,
        archivedAt: undefined,
        archivedFromPath: undefined,
        modifiedAt: new Date().toISOString()
      };
      
      const sidecarPath = this.getSidecarPath(imagePath);
      await fs.promises.writeFile(sidecarPath, JSON.stringify(updatedData, null, 2), 'utf8');
      
      return true;
    } catch (error) {
      console.error('Error marking screenshot as unarchived:', error);
      return false;
    }
  }

  /**
   * Check if a screenshot is marked as archived
   */
  async isArchived(imagePath: string): Promise<boolean> {
    try {
      const sidecarData = await this.loadSidecarFile(imagePath);
      return sidecarData?.isArchived === true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if sidecar version is compatible
   */
  private isVersionCompatible(version: string): boolean {
    // Simple version check - in the future, implement proper semver comparison
    const [major] = version.split('.');
    const [currentMajor] = this.SIDECAR_VERSION.split('.');
    return major === currentMajor;
  }

  /**
   * Migrate old sidecar format to new version if needed
   */
  async migrateSidecarFile(imagePath: string): Promise<boolean> {
    // Placeholder for future version migrations
    return true;
  }
}

export const sidecarManager = new SidecarManager();