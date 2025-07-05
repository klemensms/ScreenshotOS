// Preload script specifically for the area overlay window
const { contextBridge, ipcRenderer } = require('electron');

// Extract display information from command line arguments
let displayId = null;
let displayBounds = null;
let previousArea = null;

try {
  const args = process.argv;
  console.log('🔍 [OVERLAY_PRELOAD] All args:', args);
  
  // Find display ID, bounds, and previous area from arguments
  for (const arg of args) {
    console.log('🔍 [OVERLAY_PRELOAD] Processing arg:', arg);
    if (arg.startsWith('--display-id=')) {
      displayId = parseInt(arg.split('=')[1]);
      console.log('🔍 [OVERLAY_PRELOAD] Found display ID:', displayId);
    } else if (arg.startsWith('--display-bounds=')) {
      displayBounds = JSON.parse(arg.split('=')[1]);
      console.log('🔍 [OVERLAY_PRELOAD] Found display bounds:', displayBounds);
    } else if (arg.startsWith('--previous-area=')) {
      const areaJson = arg.split('=')[1];
      console.log('🔍 [OVERLAY_PRELOAD] Found previous area JSON:', areaJson);
      if (areaJson && areaJson !== 'null') {
        try {
          previousArea = JSON.parse(areaJson);
          console.log('🔍 [OVERLAY_PRELOAD] Parsed previous area:', previousArea);
        } catch (parseError) {
          console.error('🔍 [OVERLAY_PRELOAD] Failed to parse previous area JSON:', parseError);
        }
      } else {
        console.log('🔍 [OVERLAY_PRELOAD] Previous area is null or empty');
      }
    }
  }
  
  console.log('🔍 [OVERLAY_PRELOAD] Final parsed values:');
  console.log('  - Display ID:', displayId);
  console.log('  - Display bounds:', displayBounds);
  console.log('  - Previous area:', previousArea);
} catch (error) {
  console.error('🔍 [OVERLAY_PRELOAD] Failed to parse display info from arguments:', error);
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
  },
  
  // Get previous area from preload data (passed via arguments)
  getPreviousArea: () => {
    console.log('🔍 [OVERLAY_PRELOAD] getPreviousArea called');
    console.log('🔍 [OVERLAY_PRELOAD] Returning previous area:', previousArea);
    return previousArea;
  }
});
