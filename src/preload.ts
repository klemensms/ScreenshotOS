import { contextBridge, ipcRenderer } from 'electron';

// TypeScript interface for exposed API
interface ElectronAPI {
  invoke: (channel: string, ...args: any[]) => Promise<any>;
  sendAreaSelection: (area: { x: number; y: number; width: number; height: number }) => void;
}

// Expose protected methods that allow the renderer process to use IPC
contextBridge.exposeInMainWorld('electron', {
  invoke: (channel: string, ...args: any[]) => {
    const validChannels = [
      'capture-fullscreen',
      'capture-area',
      'save-screenshot',
      'load-storage-config',
      'save-storage-config',
      'select-directory',
      'trigger-area-overlay'
    ];
    
    if (validChannels.includes(channel)) {
      return ipcRenderer.invoke(channel, ...args);
    }
    
    throw new Error(`Unauthorized IPC channel: ${channel}`);
  },
  sendAreaSelection: (area: { x: number; y: number; width: number; height: number }) => {
    ipcRenderer.send('area-selection', area);
  }
} as ElectronAPI);

// Type definitions to be available in renderer
declare global {
  interface Window {
    electron: ElectronAPI;
  }
}
