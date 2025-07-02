"use strict";
// Renderer-side sidecar utilities
// This file provides a clean API for the renderer to interact with sidecar files
Object.defineProperty(exports, "__esModule", { value: true });
exports.rendererSidecarManager = void 0;
const renderer_logger_1 = require("./renderer-logger");
class RendererSidecarManager {
    /**
     * Create a new sidecar file for a screenshot
     */
    async createSidecarFile(imagePath, metadata, tags = [], notes = '', annotations = []) {
        try {
            if (!window.electron) {
                throw new Error('Electron API not available');
            }
            const result = await window.electron.invoke('sidecar-create', imagePath, metadata, tags, notes, annotations);
            if (result.success) {
                renderer_logger_1.rendererLogger.info('Sidecar file created successfully', { imagePath });
                return true;
            }
            else {
                renderer_logger_1.rendererLogger.error('Failed to create sidecar file', new Error(result.error), { imagePath });
                return false;
            }
        }
        catch (error) {
            renderer_logger_1.rendererLogger.error('Error creating sidecar file', error, { imagePath });
            return false;
        }
    }
    /**
     * Load sidecar data for a screenshot
     */
    async loadSidecarFile(imagePath) {
        try {
            if (!window.electron) {
                throw new Error('Electron API not available');
            }
            const result = await window.electron.invoke('sidecar-load', imagePath);
            if (result.success) {
                return result.data;
            }
            else {
                renderer_logger_1.rendererLogger.warn('Failed to load sidecar file', { imagePath, error: result.error });
                return null;
            }
        }
        catch (error) {
            renderer_logger_1.rendererLogger.error('Error loading sidecar file', error, { imagePath });
            return null;
        }
    }
    /**
     * Update an existing sidecar file
     */
    async updateSidecarFile(imagePath, updates) {
        try {
            if (!window.electron) {
                throw new Error('Electron API not available');
            }
            const result = await window.electron.invoke('sidecar-update', imagePath, updates);
            if (result.success) {
                renderer_logger_1.rendererLogger.info('Sidecar file updated successfully', { imagePath });
                return true;
            }
            else {
                renderer_logger_1.rendererLogger.error('Failed to update sidecar file', new Error(result.error), { imagePath });
                return false;
            }
        }
        catch (error) {
            renderer_logger_1.rendererLogger.error('Error updating sidecar file', error, { imagePath });
            return false;
        }
    }
    /**
     * Add an annotation to a sidecar file
     */
    async addAnnotation(imagePath, annotation) {
        try {
            if (!window.electron) {
                throw new Error('Electron API not available');
            }
            const result = await window.electron.invoke('sidecar-add-annotation', imagePath, annotation);
            if (result.success) {
                renderer_logger_1.rendererLogger.info('Annotation added to sidecar file', { imagePath, annotationId: annotation.id });
                return true;
            }
            else {
                renderer_logger_1.rendererLogger.error('Failed to add annotation to sidecar file', new Error(result.error), { imagePath });
                return false;
            }
        }
        catch (error) {
            renderer_logger_1.rendererLogger.error('Error adding annotation to sidecar file', error, { imagePath });
            return false;
        }
    }
    /**
     * Remove an annotation from a sidecar file
     */
    async removeAnnotation(imagePath, annotationId) {
        try {
            if (!window.electron) {
                throw new Error('Electron API not available');
            }
            const result = await window.electron.invoke('sidecar-remove-annotation', imagePath, annotationId);
            if (result.success) {
                renderer_logger_1.rendererLogger.info('Annotation removed from sidecar file', { imagePath, annotationId });
                return true;
            }
            else {
                renderer_logger_1.rendererLogger.error('Failed to remove annotation from sidecar file', new Error(result.error), { imagePath });
                return false;
            }
        }
        catch (error) {
            renderer_logger_1.rendererLogger.error('Error removing annotation from sidecar file', error, { imagePath });
            return false;
        }
    }
    /**
     * Check if a sidecar file exists for an image
     */
    async sidecarExists(imagePath) {
        try {
            if (!window.electron) {
                throw new Error('Electron API not available');
            }
            const result = await window.electron.invoke('sidecar-exists', imagePath);
            if (result.success) {
                return result.exists;
            }
            else {
                renderer_logger_1.rendererLogger.error('Failed to check sidecar existence', new Error(result.error), { imagePath });
                return false;
            }
        }
        catch (error) {
            renderer_logger_1.rendererLogger.error('Error checking sidecar existence', error, { imagePath });
            return false;
        }
    }
    /**
     * Scan a directory for all images and their optional sidecar files
     */
    async scanDirectory(directoryPath) {
        try {
            if (!window.electron) {
                throw new Error('Electron API not available');
            }
            const result = await window.electron.invoke('sidecar-scan-directory', directoryPath);
            if (result.success) {
                // Return ALL image files (with or without sidecar files)
                const imageFiles = result.data;
                const totalImages = imageFiles.length;
                const imagesWithSidecars = imageFiles.filter(item => item.hasSidecar).length;
                const imagesWithoutSidecars = totalImages - imagesWithSidecars;
                renderer_logger_1.rendererLogger.info('Directory scanned successfully', {
                    directoryPath,
                    totalImages,
                    imagesWithSidecars,
                    imagesWithoutSidecars
                });
                return { success: true, imageFiles };
            }
            else {
                renderer_logger_1.rendererLogger.error('Failed to scan directory', new Error(result.error), { directoryPath });
                return { success: false, error: result.error };
            }
        }
        catch (error) {
            renderer_logger_1.rendererLogger.error('Error scanning directory', error, { directoryPath });
            return { success: false, error: error.message };
        }
    }
    /**
     * Load sidecar data from a sidecar file path (not image path)
     */
    async loadSidecarFileFromPath(sidecarPath) {
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
            }
            else {
                renderer_logger_1.rendererLogger.warn('Failed to load sidecar file', { sidecarPath, error: result.error });
                return { success: false, error: result.error };
            }
        }
        catch (error) {
            renderer_logger_1.rendererLogger.error('Error loading sidecar file', error, { sidecarPath });
            return { success: false, error: error.message };
        }
    }
    /**
     * Delete a sidecar file
     */
    async deleteSidecarFile(imagePath) {
        try {
            if (!window.electron) {
                throw new Error('Electron API not available');
            }
            const result = await window.electron.invoke('sidecar-delete', imagePath);
            if (result.success) {
                renderer_logger_1.rendererLogger.info('Sidecar file deleted successfully', { imagePath });
                return true;
            }
            else {
                renderer_logger_1.rendererLogger.error('Failed to delete sidecar file', new Error(result.error), { imagePath });
                return false;
            }
        }
        catch (error) {
            renderer_logger_1.rendererLogger.error('Error deleting sidecar file', error, { imagePath });
            return false;
        }
    }
    /**
     * Helper function to create metadata object from screenshot data
     */
    createMetadata(captureTimestamp, applicationName = 'Unknown', captureMethod = 'area', dimensions, captureArea) {
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
    createAnnotation(type, color, position, text, number) {
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
exports.rendererSidecarManager = new RendererSidecarManager();
