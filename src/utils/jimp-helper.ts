// Import Jimp using CommonJS require for better compatibility
const Jimp = require('jimp');

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
    console.log('Starting Jimp crop operation...');
    
    // Load image from buffer
    console.log('Loading image buffer...');
    const jimpImage = await Jimp.read(imageBuffer);
    console.log('Image loaded successfully, dimensions:', jimpImage.getWidth(), 'x', jimpImage.getHeight());
    
    // Crop the image
    console.log('Cropping image with coordinates:', { x, y, width, height });
    jimpImage.crop(
      Math.round(x),
      Math.round(y),
      Math.round(width),
      Math.round(height)
    );
    
    // Get the buffer
    console.log('Getting buffer...');
    return await new Promise<Buffer>((resolve, reject) => {
      jimpImage.getBuffer(Jimp.MIME_PNG, (err: Error | null, buffer: Buffer) => {
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
