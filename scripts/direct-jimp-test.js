/**
 * Direct test of Jimp library
 */
const Jimp = require('jimp');
const path = require('path');
const fs = require('fs');

// Test directory
const testDir = path.join(require('os').homedir(), 'ScreenshotOS_test');
fs.mkdirSync(testDir, { recursive: true });

async function testJimp() {
  console.log('Testing Jimp directly...');
  
  try {
    // Create a simple test image
    console.log('Creating image...');
    
    // Method 1: Using read to create a new image
    const image = await Jimp.read(256, 256, 0xff0000ff);
    console.log('Image created successfully with Jimp.read()');
    
    // Save the image
    const outputPath = path.join(testDir, 'jimp_direct_test.png');
    await image.writeAsync(outputPath);
    console.log(`Image saved to ${outputPath}`);
    
    // Method 2: Reading an existing image
    if (fs.existsSync(outputPath)) {
      console.log('Reading the saved image...');
      const loadedImage = await Jimp.read(outputPath);
      console.log(`Loaded image dimensions: ${loadedImage.getWidth()}x${loadedImage.getHeight()}`);
      
      // Test crop
      console.log('Cropping image...');
      loadedImage.crop(50, 50, 100, 100);
      
      // Save the cropped image
      const croppedPath = path.join(testDir, 'jimp_direct_cropped.png');
      await loadedImage.writeAsync(croppedPath);
      console.log(`Cropped image saved to ${croppedPath}`);
      
      console.log('✅ All Jimp operations succeeded!');
    }
  } catch (err) {
    console.error('❌ Error testing Jimp:', err);
  }
}

testJimp();
