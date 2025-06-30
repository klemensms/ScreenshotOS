// Preload script specifically for the area overlay window
const { contextBridge, ipcRenderer } = require('electron');

// Extract display information from command line arguments
let displayId = null;
let displayBounds = null;

try {
  const args = process.argv;
  console.log('Overlay preload args:', args);
  
  // Find display ID and bounds from arguments
  for (const arg of args) {
    if (arg.startsWith('--display-id=')) {
      displayId = parseInt(arg.split('=')[1]);
    } else if (arg.startsWith('--display-bounds=')) {
      displayBounds = JSON.parse(arg.split('=')[1]);
    }
  }
  
  console.log('Overlay display info:', { displayId, displayBounds });
} catch (error) {
  console.error('Failed to parse display info from arguments:', error);
}

// Expose API specifically for the area overlay
contextBridge.exposeInMainWorld('electronAPI', {
  sendAreaSelection: (area) => {
    // Include display ID in the area selection
    const areaWithDisplay = {
      ...area,
      displayId: displayId
    };
    console.log('Sending area selection with display ID:', areaWithDisplay);
    ipcRenderer.send('area-selection', areaWithDisplay);
  },
  
  // Expose display info to the overlay script
  getDisplayInfo: () => {
    return { displayId, displayBounds };
  }
});
