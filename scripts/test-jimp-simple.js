/**
 * Simple test for the Jimp implementation
 */
const fs = require('fs');
const path = require('path');

// Import jimp-helper
const jimpHelperPath = path.join(__dirname, '../dist/utils/jimp-helper.js');

console.log('Starting simple Jimp test...');

// Test directory
const testDir = path.join(require('os').homedir(), 'ScreenshotOS_test');
fs.mkdirSync(testDir, { recursive: true });

// First make sure the file exists
if (!fs.existsSync(jimpHelperPath)) {
  console.error(`Error: jimp-helper.js not found at ${jimpHelperPath}`);
  console.error('Make sure you have built the project with "npm run build"');
  process.exit(1);
}

// Read the file content to understand how Jimp is used
const helperContent = fs.readFileSync(jimpHelperPath, 'utf8');
console.log('Jimp helper file content:');
console.log('---------------------------------------------------');
console.log(helperContent.substring(0, 500) + '...');
console.log('---------------------------------------------------');

// Import the helper
let cropImage;
try {
  cropImage = require(jimpHelperPath).cropImage;
  console.log('Successfully imported cropImage function');
} catch (err) {
  console.error(`Failed to import cropImage: ${err.message}`);
  process.exit(1);
}

// Create a test file path
const testFile = path.join(__dirname, '../src/assets/icons/icon.png');
if (!fs.existsSync(testFile)) {
  console.log('No test image found, using a sample image from the project');
  // Find some image in the project
  const files = fs.readdirSync(path.join(__dirname, '../src/assets'));
  console.log('Available files:', files);
}

// Create a sample image if no image is available
const testImagePath = path.join(testDir, 'test_input.png');
const outputPath = path.join(testDir, 'test_output.png');
console.log(`Test input path: ${testImagePath}`);
console.log(`Test output path: ${outputPath}`);

// Run the crop test
async function runTest() {
  try {
    // Create a simple colored square image using node-canvas or direct buffer
    const width = 200, height = 200;
    const buffer = Buffer.alloc(width * height * 4);
    
    // Fill with red color (RGBA)
    for (let i = 0; i < buffer.length; i += 4) {
      buffer[i] = 255;      // R
      buffer[i + 1] = 0;    // G
      buffer[i + 2] = 0;    // B
      buffer[i + 3] = 255;  // A
    }
    
    // Save the test image
    fs.writeFileSync(testImagePath, buffer);
    console.log('Created test image buffer');
    
    // Call the crop function
    console.log('Attempting to crop the image...');
    try {
      const croppedBuffer = await cropImage(buffer, 50, 50, 100, 100);
      console.log(`Cropping successful! Output size: ${croppedBuffer.length} bytes`);
      
      // Save the output
      fs.writeFileSync(outputPath, croppedBuffer);
      console.log('Saved cropped image');
      console.log('✅ Test completed successfully!');
    } catch (err) {
      console.error(`Error during crop operation: ${err.message}`);
      console.error(err.stack);
    }
  } catch (err) {
    console.error(`Error in test: ${err.message}`);
    console.error(err.stack);
  }
}

// Run the test
runTest();
