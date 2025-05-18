const fs = require('fs');
const path = require('path');

// Path to the built index.html file
const indexPath = path.join(__dirname, '../dist/index.html');
console.log('Fixing paths in file:', indexPath);

try {
  // Check if the file exists
  if (!fs.existsSync(indexPath)) {
    console.error('Error: index.html file not found at', indexPath);
    process.exit(1);
  }

  // Read the contents of the file
  let htmlContent = fs.readFileSync(indexPath, 'utf8');
  console.log('Original content contains src="/renderer.js":', htmlContent.includes('src="/renderer.js"'));
  
  // Replace absolute paths with relative paths
  const updatedContent = htmlContent.replace(/src="\/renderer\.js"/g, 'src="./renderer.js"');
  
  // Write the modified content back to the file
  fs.writeFileSync(indexPath, updatedContent);
  
  console.log('Updated content contains src="./renderer.js":', updatedContent.includes('src="./renderer.js"'));
  console.log('Successfully fixed asset paths in index.html!');
} catch (error) {
  console.error('Error fixing paths:', error);
  process.exit(1);
}
