"use strict";
/**
 * Fixed Jimp implementation for image cropping using nativeImage
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.cropImage = cropImage;
// Import the Jimp module and electron modules
const electron_1 = require("electron");
/**
 * Helper function to crop an image buffer using Jimp
 * @param imageBuffer Original image buffer
 * @param x X coordinate of the crop area
 * @param y Y coordinate of the crop area
 * @param width Width of the crop area
 * @param height Height of the crop area
 * @param outputFormat Output format (default: 'png')
 * @returns Promise resolving to the cropped image buffer
 */
async function cropImage(imageBuffer, x, y, width, height, outputFormat = 'png') {
    try {
        console.log('Starting Jimp crop operation with nativeImage approach...');
        // Convert buffer to PNG first for reliable processing
        console.log('Converting buffer to PNG format via nativeImage...');
        const nImage = electron_1.nativeImage.createFromBuffer(imageBuffer);
        // Get original image dimensions
        const imgSize = nImage.getSize();
        console.log('Original image dimensions:', imgSize.width, 'x', imgSize.height);
        // Validate crop parameters
        const validX = Math.max(0, Math.min(Math.round(x), imgSize.width - 1));
        const validY = Math.max(0, Math.min(Math.round(y), imgSize.height - 1));
        const validWidth = Math.min(Math.round(width), imgSize.width - validX);
        const validHeight = Math.min(Math.round(height), imgSize.height - validY);
        // Log if adjustments were made
        if (validX !== Math.round(x) || validY !== Math.round(y) ||
            validWidth !== Math.round(width) || validHeight !== Math.round(height)) {
            console.warn('Crop area adjusted to fit within image boundaries:', { original: { x, y, width, height }, adjusted: { x: validX, y: validY, width: validWidth, height: validHeight } });
        }
        // Use nativeImage's crop directly for performance
        console.log('Using nativeImage crop for better performance...');
        try {
            const croppedNative = nImage.crop({ x: validX, y: validY, width: validWidth, height: validHeight });
            // Convert to the specified output format
            const croppedBuffer = outputFormat === 'jpeg' ? croppedNative.toJPEG(90) : croppedNative.toPNG();
            console.log('Successfully used nativeImage crop, size:', croppedBuffer.length);
            return croppedBuffer;
        }
        catch (nativeError) {
            console.error('nativeImage crop failed:', nativeError);
            throw new Error(`nativeImage crop failed: ${nativeError instanceof Error ? nativeError.message : String(nativeError)}`);
        }
    }
    catch (error) {
        console.error('Error cropping image with Jimp:', error);
        // More descriptive error
        throw new Error(`Image cropping failed: ${error instanceof Error ? error.message : String(error)}`);
    }
}
