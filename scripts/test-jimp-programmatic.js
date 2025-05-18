/**
 * Programmatic test for Jimp implementation in ScreenshotOS
 * This script tests the jimp-helper.ts functionality directly
 */

const fs = require('fs');
const path = require('path');
const Jimp = require('jimp');
const { exec } = require('child_process');

// Path to the compiled jimp-helper.js
const helperPath = path.join(__dirname, '../dist/utils/jimp-helper.js');
let cropImage;

// Test directory
const TEST_DIR = path.join(require('os').homedir(), 'ScreenshotOS_test');
fs.mkdirSync(TEST_DIR, { recursive: true });

// Log function
function log(message) {
  console.log(`[TEST] ${message}`);
}

// Test function
async function runTests() {
  log('Starting Jimp implementation tests');
  
  // First, check if jimp-helper.js exists
  if (!fs.existsSync(helperPath)) {
    log('ERROR: jimp-helper.js not found, make sure you run npm build first');
    process.exit(1);
  }
  
  try {
    // Import the cropImage function
    cropImage = require(helperPath).cropImage;
    log('Successfully imported cropImage function');
  } catch (err) {
    log(`ERROR: Failed to import cropImage function: ${err.message}`);
    process.exit(1);
  }
  
  // Create a test image using Jimp directly
  log('Creating test image...');
  
  try {
    // Create a new image (500x300 red rectangle)
    const testImage = new Jimp(500, 300, 0xff0000ff);
    
    // Draw some shapes to make it more interesting (green rectangle in the middle)
    testImage.scan(100, 100, 300, 100, function(x, y, idx) {
      this.bitmap.data[idx + 0] = 0;     // R
      this.bitmap.data[idx + 1] = 255;   // G
      this.bitmap.data[idx + 2] = 0;     // B
    });
    
    // Save the test image
    const testImagePath = path.join(TEST_DIR, 'test_source.png');
    await testImage.writeAsync(testImagePath);
    log(`Created test image at: ${testImagePath}`);
    
    // Get the buffer of the test image
    const sourceBuffer = await fs.promises.readFile(testImagePath);
    
    // Test the cropImage function
    log('Testing cropImage function with crop coordinates: x=100, y=100, width=200, height=100');
    try {
      const croppedBuffer = await cropImage(sourceBuffer, 100, 100, 200, 100);
      
      // Save the cropped image
      const croppedPath = path.join(TEST_DIR, 'test_cropped.png');
      await fs.promises.writeFile(croppedPath, croppedBuffer);
      log(`Saved cropped image to: ${croppedPath}`);
      
      // Verify the cropped image dimensions
      const croppedJimp = await Jimp.read(croppedPath);
      
      if (croppedJimp.getWidth() === 200 && croppedJimp.getHeight() === 100) {
        log('✅ SUCCESS: Cropped image has the correct dimensions');
      } else {
        log(`❌ ERROR: Unexpected cropped image dimensions: ${croppedJimp.getWidth()}x${croppedJimp.getHeight()}`);
      }
      
      // Open the images for visual inspection (macOS specific)
      if (process.platform === 'darwin') {
        log('Opening images for visual inspection...');
        exec(`open "${testImagePath}" "${croppedPath}"`);
      }
      
      log('Test completed successfully!');
      
    } catch (err) {
      log(`❌ ERROR: cropImage function failed: ${err.message}`);
      process.exit(1);
    }
  } catch (err) {
    log(`❌ ERROR: Failed to create test image: ${err.message}`);
    process.exit(1);
  }
}

// Run the tests
runTests().catch(err => {
  log(`Unexpected error: ${err.message}`);
  process.exit(1);
});
