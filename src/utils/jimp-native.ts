/**
 * Fixed Jimp implementation for image cropping using nativeImage
 */

// Import the Jimp module and electron modules
import { nativeImage } from 'electron';
const JimpModule = require('jimp');

/**
 * Helper function to crop an image buffer using Jimp
 * @param imageBuffer Original image buffer
 * @param x X coordinate of the crop area
 * @param y Y coordinate of the crop area
 * @param width Width of the crop area
 * @param height Height of the crop area
 * @returns Promise resolving to the cropped image buffer
 */
export async function cropImage(imageBuffer: Buffer, x: number, y: number, width: number, height: number): Promise<Buffer> {
  try {
    console.log('Starting Jimp crop operation with nativeImage approach...');
    
    // Convert buffer to PNG first for reliable processing
    console.log('Converting buffer to PNG format via nativeImage...');
    const nImage = nativeImage.createFromBuffer(imageBuffer);
    
    // Convert to PNG format which Jimp can reliably read
    const pngBuffer = nImage.toPNG();
    console.log('Converted to PNG, size:', pngBuffer.length);
    
    // Now load the PNG with Jimp
    console.log('Loading PNG buffer with Jimp...');
    const image = await JimpModule.Jimp.read(pngBuffer);
    console.log('Image loaded successfully, dimensions:', image.getWidth(), 'x', image.getHeight());
    
    // Crop the image with rounded coordinates
    console.log('Cropping image with coordinates:', { x, y, width, height });
    image.crop(
      Math.round(x),
      Math.round(y), 
      Math.round(width), 
      Math.round(height)
    );
    
    // Get the buffer using MIME_PNG constant from the module
    console.log('Getting buffer...');
    return await new Promise<Buffer>((resolve, reject) => {
      image.getBuffer(JimpModule.Jimp.MIME_PNG, (err: Error | null, buffer: Buffer) => {
        if (err) {
          console.error('Error getting buffer:', err);
          reject(err);
        } else {
          console.log('Buffer created successfully, size:', buffer.length);
          resolve(buffer);
        }
      });
    });
  } catch (error) {
    console.error('Error cropping image with Jimp:', error);
    throw error;
  }
}
