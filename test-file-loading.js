#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const os = require('os');

// Configuration (matching the app's defaults)
const CONFIG = {
  MAX_FILE_SIZE_MB: 50,
  MAX_FILES_TO_LOAD: 20,
  IMAGE_EXTENSIONS: ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp', '.tiff', '.tif'],
  SIDECAR_EXTENSION: '.screenshotos.json'
};

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function formatBytes(bytes) {
  const sizes = ['B', 'KB', 'MB', 'GB'];
  if (bytes === 0) return '0 B';
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
}

function formatDate(date) {
  return date.toLocaleString();
}

async function analyzeDirectory(directoryPath) {
  console.log(`${colors.bright}${colors.blue}=== Screenshot Directory Analysis ===${colors.reset}\n`);
  console.log(`Directory: ${colors.cyan}${directoryPath}${colors.reset}`);
  console.log(`Timestamp: ${new Date().toLocaleString()}\n`);

  try {
    // Check if directory exists
    if (!fs.existsSync(directoryPath)) {
      console.error(`${colors.red}Error: Directory does not exist!${colors.reset}`);
      return;
    }

    // Read all files
    const files = await fs.promises.readdir(directoryPath, { withFileTypes: true });
    
    // Filter image files
    const imageFiles = [];
    for (const dirent of files) {
      if (dirent.isFile()) {
        const ext = path.extname(dirent.name).toLowerCase();
        if (CONFIG.IMAGE_EXTENSIONS.includes(ext)) {
          const filePath = path.join(directoryPath, dirent.name);
          try {
            const stat = await fs.promises.stat(filePath);
            imageFiles.push({
              name: dirent.name,
              path: filePath,
              size: stat.size,
              sizeMB: stat.size / (1024 * 1024),
              created: stat.birthtime || stat.ctime,
              modified: stat.mtime,
              hasSidecar: fs.existsSync(filePath + CONFIG.SIDECAR_EXTENSION)
            });
          } catch (error) {
            console.warn(`${colors.yellow}Warning: Cannot stat file ${dirent.name}: ${error.message}${colors.reset}`);
          }
        }
      }
    }

    // Sort by creation time (newest first) - matching app logic
    imageFiles.sort((a, b) => b.created.getTime() - a.created.getTime());

    console.log(`${colors.bright}Total image files found: ${colors.green}${imageFiles.length}${colors.reset}\n`);

    // Categorize files
    const oversizedFiles = imageFiles.filter(f => f.sizeMB > CONFIG.MAX_FILE_SIZE_MB);
    const validFiles = imageFiles.filter(f => f.sizeMB <= CONFIG.MAX_FILE_SIZE_MB);
    const filesWithSidecar = imageFiles.filter(f => f.hasSidecar);
    const filesWithoutSidecar = imageFiles.filter(f => !f.hasSidecar);

    // Display statistics
    console.log(`${colors.bright}File Statistics:${colors.reset}`);
    console.log(`  Valid files (≤${CONFIG.MAX_FILE_SIZE_MB}MB): ${colors.green}${validFiles.length}${colors.reset}`);
    console.log(`  Oversized files (>${CONFIG.MAX_FILE_SIZE_MB}MB): ${colors.red}${oversizedFiles.length}${colors.reset}`);
    console.log(`  Files with sidecar data: ${colors.blue}${filesWithSidecar.length}${colors.reset}`);
    console.log(`  Files without sidecar data: ${colors.yellow}${filesWithoutSidecar.length}${colors.reset}\n`);

    // Simulate app loading behavior
    console.log(`${colors.bright}${colors.magenta}=== Simulating App Loading Behavior ===${colors.reset}\n`);
    
    const filesToLoad = validFiles.slice(0, CONFIG.MAX_FILES_TO_LOAD);
    console.log(`Initial load would include: ${colors.green}${filesToLoad.length}${colors.reset} files`);
    
    if (validFiles.length > CONFIG.MAX_FILES_TO_LOAD) {
      console.log(`Files available for infinite scroll: ${colors.cyan}${validFiles.length - CONFIG.MAX_FILES_TO_LOAD}${colors.reset}`);
    } else {
      console.log(`${colors.yellow}No additional files for infinite scroll${colors.reset}`);
    }

    // Show what would be loaded
    console.log(`\n${colors.bright}Files that would be loaded initially:${colors.reset}`);
    filesToLoad.forEach((file, index) => {
      console.log(`  ${index + 1}. ${file.name}`);
      console.log(`     Size: ${formatBytes(file.size)} | Created: ${formatDate(file.created)}${file.hasSidecar ? ' | Has sidecar' : ''}`);
    });

    // Show oversized files
    if (oversizedFiles.length > 0) {
      console.log(`\n${colors.bright}${colors.red}Oversized files (would be filtered out):${colors.reset}`);
      oversizedFiles.slice(0, 10).forEach((file, index) => {
        console.log(`  ${index + 1}. ${file.name}`);
        console.log(`     Size: ${colors.red}${formatBytes(file.size)}${colors.reset} (${file.sizeMB.toFixed(1)}MB)`);
      });
      if (oversizedFiles.length > 10) {
        console.log(`  ... and ${oversizedFiles.length - 10} more oversized files`);
      }
    }

    // Test pagination
    console.log(`\n${colors.bright}${colors.cyan}=== Pagination Test ===${colors.reset}`);
    const batchSize = 20;
    let offset = 0;
    let batchCount = 0;
    
    while (offset < validFiles.length) {
      const batch = validFiles.slice(offset, offset + batchSize);
      batchCount++;
      console.log(`  Batch ${batchCount}: Files ${offset + 1}-${offset + batch.length} (${batch.length} files)`);
      offset += batchSize;
    }

    // Summary and recommendations
    console.log(`\n${colors.bright}${colors.yellow}=== Summary & Recommendations ===${colors.reset}`);
    
    if (filesToLoad.length < CONFIG.MAX_FILES_TO_LOAD && validFiles.length >= CONFIG.MAX_FILES_TO_LOAD) {
      console.log(`${colors.yellow}⚠️  Only ${filesToLoad.length} files would load initially, but ${CONFIG.MAX_FILES_TO_LOAD} were expected.${colors.reset}`);
      console.log(`   This suggests some files might be failing to load due to timeouts or errors.`);
    }

    if (oversizedFiles.length > 0) {
      console.log(`${colors.yellow}⚠️  ${oversizedFiles.length} files exceed the ${CONFIG.MAX_FILE_SIZE_MB}MB limit and won't be loaded.${colors.reset}`);
      console.log(`   Consider compressing these files or increasing the size limit.`);
    }

    const avgFileSize = validFiles.reduce((sum, f) => sum + f.sizeMB, 0) / validFiles.length || 0;
    console.log(`\n📊 Average file size (valid files): ${avgFileSize.toFixed(2)}MB`);

    // Performance estimation
    const estimatedLoadTime = filesToLoad.length * 0.5; // Assume 0.5s per file
    console.log(`⏱️  Estimated initial load time: ~${estimatedLoadTime.toFixed(1)} seconds`);

  } catch (error) {
    console.error(`${colors.red}Error analyzing directory: ${error.message}${colors.reset}`);
    console.error(error.stack);
  }
}

// Load configuration to get the actual save directory
async function getConfiguredDirectory() {
  try {
    // Try to read the app's config file
    const userDataPath = process.env.APPDATA || 
                        (process.platform === 'darwin' ? 
                          path.join(os.homedir(), 'Library', 'Application Support') : 
                          path.join(os.homedir(), '.config'));
    const configPath = path.join(userDataPath, 'ScreenshotOS', 'config', 'storage-config.json');
    
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      return config.saveDirectory;
    }
  } catch (error) {
    console.warn(`${colors.yellow}Could not read app config, using default directory${colors.reset}`);
  }
  
  // Default to Downloads directory
  return path.join(os.homedir(), 'Downloads');
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  let directoryPath;

  if (args.length > 0) {
    directoryPath = args[0];
  } else {
    directoryPath = await getConfiguredDirectory();
  }

  await analyzeDirectory(directoryPath);
}

// Run the test
main().catch(error => {
  console.error(`${colors.red}Fatal error: ${error.message}${colors.reset}`);
  process.exit(1);
});