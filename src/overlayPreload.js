// Preload script specifically for the area overlay window
const { contextBridge, ipcRenderer } = require('electron');

// Expose API specifically for the area overlay
contextBridge.exposeInMainWorld('electronAPI', {
  sendAreaSelection: (area) => {
    console.log('Sending area selection:', area);
    ipcRenderer.send('area-selection', area);
  }
});
