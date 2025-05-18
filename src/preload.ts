import { contextBridge, ipcRenderer } from 'electron';

// TypeScript interface for exposed API
interface ElectronAPI {
  invoke: (channel: string, ...args: any[]) => Promise<any>;
}

// Expose protected methods that allow the renderer process to use IPC
contextBridge.exposeInMainWorld('electron', {
  invoke: (channel: string, ...args: any[]) => {
    const validChannels = [
      'capture-fullscreen',
      'save-screenshot',
      'load-storage-config',
      'save-storage-config',
      'select-directory'
    ];
    
    if (validChannels.includes(channel)) {
      return ipcRenderer.invoke(channel, ...args);
    }
    
    throw new Error(`Unauthorized IPC channel: ${channel}`);
  }
} as ElectronAPI);

// Type definitions to be available in renderer
declare global {
  interface Window {
    electron: ElectronAPI;
  }
}
