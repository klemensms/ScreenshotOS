"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sidecarManager = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const crypto_1 = __importDefault(require("crypto"));
class SidecarManager {
    constructor() {
        this.SIDECAR_VERSION = '1.0.0';
        this.SIDECAR_EXTENSION = '.screenshotos.json';
    }
    /**
     * Generate a sidecar file path for a given image path
     */
    getSidecarPath(imagePath) {
        const parsedPath = path_1.default.parse(imagePath);
        return path_1.default.join(parsedPath.dir, parsedPath.base + this.SIDECAR_EXTENSION);
    }
    /**
     * Calculate SHA-256 checksum of an image file
     */
    async calculateImageChecksum(imagePath) {
        return new Promise((resolve, reject) => {
            const hash = crypto_1.default.createHash('sha256');
            const stream = fs_1.default.createReadStream(imagePath);
            stream.on('data', chunk => hash.update(chunk));
            stream.on('end', () => resolve(hash.digest('hex')));
            stream.on('error', reject);
        });
    }
    /**
     * Verify that an image file matches its recorded checksum
     */
    async verifyImageIntegrity(imagePath, expectedChecksum) {
        try {
            // First check if the file exists
            if (!fs_1.default.existsSync(imagePath)) {
                console.warn(`Image file does not exist: ${imagePath}`);
                return false;
            }
            const actualChecksum = await this.calculateImageChecksum(imagePath);
            return actualChecksum === expectedChecksum;
        }
        catch (error) {
            console.error('Error verifying image integrity:', error);
            return false;
        }
    }
    /**
     * Create a new sidecar file for a screenshot
     */
    async createSidecarFile(imagePath, metadata, tags = [], notes = '', annotations = []) {
        try {
            const checksum = await this.calculateImageChecksum(imagePath);
            const now = new Date().toISOString();
            const sidecarData = {
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
            await fs_1.default.promises.writeFile(sidecarPath, JSON.stringify(sidecarData, null, 2), 'utf8');
            console.log(`Created sidecar file: ${sidecarPath}`);
            return true;
        }
        catch (error) {
            console.error('Error creating sidecar file:', error);
            return false;
        }
    }
    /**
     * Load sidecar data for a screenshot
     */
    async loadSidecarFile(imagePath) {
        try {
            const sidecarPath = this.getSidecarPath(imagePath);
            if (!fs_1.default.existsSync(sidecarPath)) {
                return null;
            }
            const data = await fs_1.default.promises.readFile(sidecarPath, 'utf8');
            const sidecarData = JSON.parse(data);
            // Verify version compatibility
            if (!this.isVersionCompatible(sidecarData.version)) {
                console.warn(`Sidecar file version ${sidecarData.version} may be incompatible with current version ${this.SIDECAR_VERSION}`);
            }
            // Verify image integrity only if the image file exists
            if (fs_1.default.existsSync(imagePath)) {
                const isValid = await this.verifyImageIntegrity(imagePath, sidecarData.originalImageChecksum);
                if (!isValid) {
                    console.warn(`Image integrity check failed for ${imagePath}`);
                }
            }
            else {
                console.warn(`Original image file not found: ${imagePath}`);
            }
            return sidecarData;
        }
        catch (error) {
            console.error('Error loading sidecar file:', error);
            return null;
        }
    }
    /**
     * Update an existing sidecar file
     */
    async updateSidecarFile(imagePath, updates) {
        try {
            const sidecarData = await this.loadSidecarFile(imagePath);
            if (!sidecarData) {
                console.error('Cannot update non-existent sidecar file');
                return false;
            }
            // Apply updates
            const updatedData = {
                ...sidecarData,
                ...updates,
                modifiedAt: new Date().toISOString()
            };
            const sidecarPath = this.getSidecarPath(imagePath);
            await fs_1.default.promises.writeFile(sidecarPath, JSON.stringify(updatedData, null, 2), 'utf8');
            return true;
        }
        catch (error) {
            console.error('Error updating sidecar file:', error);
            return false;
        }
    }
    /**
     * Add an annotation to a sidecar file
     */
    async addAnnotation(imagePath, annotation) {
        try {
            const sidecarData = await this.loadSidecarFile(imagePath);
            if (!sidecarData) {
                console.error('Cannot add annotation to non-existent sidecar file');
                return false;
            }
            // Add annotation and create edit operation
            const updatedAnnotations = [...sidecarData.annotations, annotation];
            const editOperation = {
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
        }
        catch (error) {
            console.error('Error adding annotation to sidecar file:', error);
            return false;
        }
    }
    /**
     * Remove an annotation from a sidecar file
     */
    async removeAnnotation(imagePath, annotationId) {
        try {
            const sidecarData = await this.loadSidecarFile(imagePath);
            if (!sidecarData) {
                return false;
            }
            const updatedAnnotations = sidecarData.annotations.filter(a => a.id !== annotationId);
            const editOperation = {
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
        }
        catch (error) {
            console.error('Error removing annotation from sidecar file:', error);
            return false;
        }
    }
    /**
     * Check if a sidecar file exists for an image
     */
    sidecarExists(imagePath) {
        const sidecarPath = this.getSidecarPath(imagePath);
        return fs_1.default.existsSync(sidecarPath);
    }
    /**
     * Delete a sidecar file
     */
    async deleteSidecarFile(imagePath) {
        try {
            const sidecarPath = this.getSidecarPath(imagePath);
            if (fs_1.default.existsSync(sidecarPath)) {
                await fs_1.default.promises.unlink(sidecarPath);
                console.log(`Deleted sidecar file: ${sidecarPath}`);
            }
            return true;
        }
        catch (error) {
            console.error('Error deleting sidecar file:', error);
            return false;
        }
    }
    /**
     * Scan a directory for screenshots and their sidecar files
     */
    async scanDirectory(directoryPath) {
        try {
            const files = await fs_1.default.promises.readdir(directoryPath, { withFileTypes: true });
            const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp', '.tiff', '.tif'];
            const imageFiles = [];
            // First pass: collect all image files with their stats
            for (const dirent of files) {
                if (dirent.isFile()) {
                    const ext = path_1.default.extname(dirent.name).toLowerCase();
                    if (imageExtensions.includes(ext)) {
                        const filePath = path_1.default.join(directoryPath, dirent.name);
                        try {
                            const stat = await fs_1.default.promises.stat(filePath);
                            imageFiles.push({
                                fileName: dirent.name,
                                filePath,
                                stat
                            });
                        }
                        catch (error) {
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
            const results = [];
            // Second pass: process only the most recent files
            for (const imageFile of sortedFiles) {
                const sidecarPath = this.getSidecarPath(imageFile.filePath);
                let hasSidecar = fs_1.default.existsSync(sidecarPath);
                // Check for legacy sidecar files (without .png extension) and migrate them
                if (!hasSidecar) {
                    const legacySidecarPath = this.getLegacySidecarPath(imageFile.filePath);
                    if (fs_1.default.existsSync(legacySidecarPath)) {
                        console.log(`Migrating legacy sidecar file: ${legacySidecarPath} -> ${sidecarPath}`);
                        try {
                            await fs_1.default.promises.rename(legacySidecarPath, sidecarPath);
                            hasSidecar = true;
                        }
                        catch (error) {
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
        }
        catch (error) {
            console.error('Error scanning directory:', error);
            return [];
        }
    }
    /**
     * Get legacy sidecar path (without .png extension) for migration
     */
    getLegacySidecarPath(imagePath) {
        const parsedPath = path_1.default.parse(imagePath);
        return path_1.default.join(parsedPath.dir, parsedPath.name + this.SIDECAR_EXTENSION);
    }
    /**
     * Mark a screenshot as archived in its sidecar file
     */
    async markAsArchived(imagePath, archivedFromPath) {
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
            const updatedData = {
                ...sidecarData,
                isArchived: true,
                archivedAt: new Date().toISOString(),
                archivedFromPath: archivedFromPath || imagePath,
                modifiedAt: new Date().toISOString()
            };
            const sidecarPath = this.getSidecarPath(imagePath);
            await fs_1.default.promises.writeFile(sidecarPath, JSON.stringify(updatedData, null, 2), 'utf8');
            return true;
        }
        catch (error) {
            console.error('Error marking screenshot as archived:', error);
            return false;
        }
    }
    /**
     * Remove archive status from a screenshot's sidecar file
     */
    async markAsUnarchived(imagePath) {
        try {
            const sidecarData = await this.loadSidecarFile(imagePath);
            if (!sidecarData) {
                return true; // No sidecar means not archived
            }
            // Remove archive status
            const updatedData = {
                ...sidecarData,
                isArchived: false,
                archivedAt: undefined,
                archivedFromPath: undefined,
                modifiedAt: new Date().toISOString()
            };
            const sidecarPath = this.getSidecarPath(imagePath);
            await fs_1.default.promises.writeFile(sidecarPath, JSON.stringify(updatedData, null, 2), 'utf8');
            return true;
        }
        catch (error) {
            console.error('Error marking screenshot as unarchived:', error);
            return false;
        }
    }
    /**
     * Check if a screenshot is marked as archived
     */
    async isArchived(imagePath) {
        try {
            const sidecarData = await this.loadSidecarFile(imagePath);
            return sidecarData?.isArchived === true;
        }
        catch (error) {
            return false;
        }
    }
    /**
     * Check if sidecar version is compatible
     */
    isVersionCompatible(version) {
        // Simple version check - in the future, implement proper semver comparison
        const [major] = version.split('.');
        const [currentMajor] = this.SIDECAR_VERSION.split('.');
        return major === currentMajor;
    }
    /**
     * Migrate old sidecar format to new version if needed
     */
    async migrateSidecarFile(imagePath) {
        // Placeholder for future version migrations
        return true;
    }
}
exports.sidecarManager = new SidecarManager();
