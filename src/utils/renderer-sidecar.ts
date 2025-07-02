// Renderer-side sidecar utilities
// This file provides a clean API for the renderer to interact with sidecar files

import { rendererLogger } from './renderer-logger';

// Re-export types for renderer use
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
  type: 'arrow' | 'rectangle' | 'text' | 'numbering' | 'blur';
  color: string;
  position: {
    x: number;
    y: number;
    width?: number;
    height?: number;
  };
  text?: string;
  number?: number;
  blurIntensity?: number;
  createdAt: string;
  modifiedAt: string;
  visible: boolean;
  zIndex: number;
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
  editHistory: any[];
  ocrText?: string;
}

class RendererSidecarManager {
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
      if (!window.electron) {
        throw new Error('Electron API not available');
      }

      const result = await window.electron.invoke('sidecar-create', imagePath, metadata, tags, notes, annotations);
      
      if (result.success) {
        rendererLogger.info('Sidecar file created successfully', { imagePath });
        return true;
      } else {
        rendererLogger.error('Failed to create sidecar file', new Error(result.error), { imagePath });
        return false;
      }
    } catch (error) {
      rendererLogger.error('Error creating sidecar file', error as Error, { imagePath });
      return false;
    }
  }

  /**
   * Load sidecar data for a screenshot
   */
  async loadSidecarFile(imagePath: string): Promise<SidecarData | null> {
    try {
      if (!window.electron) {
        throw new Error('Electron API not available');
      }

      const result = await window.electron.invoke('sidecar-load', imagePath);
      
      if (result.success) {
        return result.data;
      } else {
        rendererLogger.warn('Failed to load sidecar file', { imagePath, error: result.error });
        return null;
      }
    } catch (error) {
      rendererLogger.error('Error loading sidecar file', error as Error, { imagePath });
      return null;
    }
  }

  /**
   * Update an existing sidecar file
   */
  async updateSidecarFile(
    imagePath: string,
    updates: Partial<Pick<SidecarData, 'tags' | 'notes' | 'annotations' | 'ocrText'>>
  ): Promise<boolean> {
    try {
      if (!window.electron) {
        throw new Error('Electron API not available');
      }

      const result = await window.electron.invoke('sidecar-update', imagePath, updates);
      
      if (result.success) {
        rendererLogger.info('Sidecar file updated successfully', { imagePath });
        return true;
      } else {
        rendererLogger.error('Failed to update sidecar file', new Error(result.error), { imagePath });
        return false;
      }
    } catch (error) {
      rendererLogger.error('Error updating sidecar file', error as Error, { imagePath });
      return false;
    }
  }

  /**
   * Add an annotation to a sidecar file
   */
  async addAnnotation(imagePath: string, annotation: SidecarAnnotation): Promise<boolean> {
    try {
      if (!window.electron) {
        throw new Error('Electron API not available');
      }

      const result = await window.electron.invoke('sidecar-add-annotation', imagePath, annotation);
      
      if (result.success) {
        rendererLogger.info('Annotation added to sidecar file', { imagePath, annotationId: annotation.id });
        return true;
      } else {
        rendererLogger.error('Failed to add annotation to sidecar file', new Error(result.error), { imagePath });
        return false;
      }
    } catch (error) {
      rendererLogger.error('Error adding annotation to sidecar file', error as Error, { imagePath });
      return false;
    }
  }

  /**
   * Remove an annotation from a sidecar file
   */
  async removeAnnotation(imagePath: string, annotationId: string): Promise<boolean> {
    try {
      if (!window.electron) {
        throw new Error('Electron API not available');
      }

      const result = await window.electron.invoke('sidecar-remove-annotation', imagePath, annotationId);
      
      if (result.success) {
        rendererLogger.info('Annotation removed from sidecar file', { imagePath, annotationId });
        return true;
      } else {
        rendererLogger.error('Failed to remove annotation from sidecar file', new Error(result.error), { imagePath });
        return false;
      }
    } catch (error) {
      rendererLogger.error('Error removing annotation from sidecar file', error as Error, { imagePath });
      return false;
    }
  }

  /**
   * Check if a sidecar file exists for an image
   */
  async sidecarExists(imagePath: string): Promise<boolean> {
    try {
      if (!window.electron) {
        throw new Error('Electron API not available');
      }

      const result = await window.electron.invoke('sidecar-exists', imagePath);
      
      if (result.success) {
        return result.exists;
      } else {
        rendererLogger.error('Failed to check sidecar existence', new Error(result.error), { imagePath });
        return false;
      }
    } catch (error) {
      rendererLogger.error('Error checking sidecar existence', error as Error, { imagePath });
      return false;
    }
  }

  /**
   * Scan a directory for all images and their optional sidecar files
   */
  async scanDirectory(directoryPath: string): Promise<{ success: boolean; imageFiles?: Array<{imagePath: string, sidecarPath: string, hasSidecar: boolean}>; error?: string }> {
    try {
      if (!window.electron) {
        throw new Error('Electron API not available');
      }

      const result = await window.electron.invoke('sidecar-scan-directory', directoryPath);
      
      if (result.success) {
        // Return ALL image files (with or without sidecar files)
        const imageFiles = result.data as Array<{imagePath: string, sidecarPath: string, hasSidecar: boolean}>;
        
        const totalImages = imageFiles.length;
        const imagesWithSidecars = imageFiles.filter(item => item.hasSidecar).length;
        const imagesWithoutSidecars = totalImages - imagesWithSidecars;
        
        rendererLogger.info('Directory scanned successfully', { 
          directoryPath, 
          totalImages, 
          imagesWithSidecars, 
          imagesWithoutSidecars 
        });
        
        return { success: true, imageFiles };
      } else {
        rendererLogger.error('Failed to scan directory', new Error(result.error), { directoryPath });
        return { success: false, error: result.error };
      }
    } catch (error) {
      rendererLogger.error('Error scanning directory', error as Error, { directoryPath });
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Load sidecar data from a sidecar file path (not image path)
   */
  async loadSidecarFileFromPath(sidecarPath: string): Promise<{ success: boolean; data?: SidecarData; error?: string }> {
    try {
      if (!window.electron) {
        throw new Error('Electron API not available');
      }

      // Extract the image path from the sidecar path
      // sidecar path looks like: /path/screenshot_name.png.screenshotos.json
      // we want: /path/screenshot_name.png
      const imagePath = sidecarPath.replace('.screenshotos.json', '');
      const result = await window.electron.invoke('sidecar-load', imagePath);
      
      if (result.success) {
        return { success: true, data: result.data };
      } else {
        rendererLogger.warn('Failed to load sidecar file', { sidecarPath, error: result.error });
        return { success: false, error: result.error };
      }
    } catch (error) {
      rendererLogger.error('Error loading sidecar file', error as Error, { sidecarPath });
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Delete a sidecar file
   */
  async deleteSidecarFile(imagePath: string): Promise<boolean> {
    try {
      if (!window.electron) {
        throw new Error('Electron API not available');
      }

      const result = await window.electron.invoke('sidecar-delete', imagePath);
      
      if (result.success) {
        rendererLogger.info('Sidecar file deleted successfully', { imagePath });
        return true;
      } else {
        rendererLogger.error('Failed to delete sidecar file', new Error(result.error), { imagePath });
        return false;
      }
    } catch (error) {
      rendererLogger.error('Error deleting sidecar file', error as Error, { imagePath });
      return false;
    }
  }

  /**
   * Helper function to create metadata object from screenshot data
   */
  createMetadata(
    captureTimestamp: Date,
    applicationName: string = 'Unknown',
    captureMethod: 'fullscreen' | 'area' | 'window' = 'area',
    dimensions: { width: number; height: number },
    captureArea?: { x: number; y: number; width: number; height: number }
  ): SidecarMetadata {
    return {
      captureTimestamp: captureTimestamp.toISOString(),
      applicationInfo: {
        name: applicationName,
        bundleId: undefined,
        version: undefined,
        windowTitle: undefined
      },
      screenInfo: {
        displayId: undefined,
        resolution: dimensions,
        scaleFactor: window.devicePixelRatio || 1
      },
      deviceInfo: {
        computerName: navigator.platform,
        osVersion: navigator.userAgent,
        username: undefined
      },
      captureMethod,
      captureArea
    };
  }

  /**
   * Helper function to create annotation object
   */
  createAnnotation(
    type: 'arrow' | 'rectangle' | 'text' | 'numbering',
    color: string,
    position: { x: number; y: number; width?: number; height?: number },
    text?: string,
    number?: number
  ): SidecarAnnotation {
    const now = new Date().toISOString();
    return {
      id: `annotation-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      color,
      position,
      text,
      number,
      createdAt: now,
      modifiedAt: now,
      visible: true,
      zIndex: 1
    };
  }
}

export const rendererSidecarManager = new RendererSidecarManager();