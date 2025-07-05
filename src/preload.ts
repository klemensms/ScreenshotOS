import { contextBridge, ipcRenderer } from 'electron';

// TypeScript interface for exposed API
interface ElectronAPI {
  invoke: (channel: string, ...args: any[]) => Promise<any>;
  sendAreaSelection: (area: { x: number; y: number; width: number; height: number }) => void;
  getRecentLogs: (lines?: number) => Promise<string>;
  getLogPath: () => Promise<string>;
  logFromRenderer: (level: string, message: string, error?: any, extra?: any) => Promise<void>;
  onNewScreenshot: (callback: (data: any) => void) => void;
  removeNewScreenshotListener: (callback: (data: any) => void) => void;
  onOCRCompleted: (callback: (data: { imagePath: string; ocrText: string; ocrCompleted: boolean }) => void) => void;
  removeOCRCompletedListener: (callback: (data: any) => void) => void;
}

// Expose protected methods that allow the renderer process to use IPC
contextBridge.exposeInMainWorld('electron', {
  invoke: (channel: string, ...args: any[]) => {
    const validChannels = [
      'capture-fullscreen',
      'capture-area',
      'save-screenshot',
      'copy-screenshot-to-clipboard',
      'load-storage-config',
      'save-storage-config',
      'select-directory',
      'trigger-area-overlay',
      'get-recent-logs',
      'get-log-path',
      'log-from-renderer',
      'sidecar-create',
      'sidecar-load',
      'sidecar-update',
      'sidecar-add-annotation',
      'sidecar-remove-annotation',
      'sidecar-exists',
      'sidecar-scan-directory',
      'sidecar-delete',
      'file-exists',
      'file-stats',
      'read-image-file',
      'validate-shortcut',
      'test-shortcuts',
      'indexer-search',
      'indexer-get-stats',
      'indexer-get-by-tags',
      'indexer-get-by-date-range',
      'indexer-rescan',
      'thumbnail-get',
      'thumbnail-get-base64',
      'thumbnail-pregenerate',
      'thumbnail-cache-stats',
      'thumbnail-clear-cache',
      'file-archive-screenshot',
      'file-archive-screenshots',
      'file-delete-screenshot',
      'file-delete-screenshots',
      'file-restore-screenshot',
      'file-get-recently-deleted',
      'file-cleanup-orphaned-sidecars',
      'file-get-statistics',
      'ocr-get-status',
      'ocr-queue-for-processing',
      'ocr-get-queue-size',
      'ocr-is-processing'
    ];
    
    if (validChannels.includes(channel)) {
      return ipcRenderer.invoke(channel, ...args);
    }
    
    throw new Error(`Unauthorized IPC channel: ${channel}`);
  },
  sendAreaSelection: (area: { x: number; y: number; width: number; height: number }) => {
    ipcRenderer.send('area-selection', area);
  },
  getRecentLogs: (lines = 100) => {
    return ipcRenderer.invoke('get-recent-logs', lines);
  },
  getLogPath: () => {
    return ipcRenderer.invoke('get-log-path');
  },
  logFromRenderer: (level: string, message: string, error?: any, extra?: any) => {
    return ipcRenderer.invoke('log-from-renderer', {
      timestamp: new Date().toISOString(),
      level,
      message,
      stack: error?.stack,
      extra
    });
  },
  onNewScreenshot: (callback: (data: any) => void) => {
    ipcRenderer.on('new-screenshot-created', (event, data) => callback(data));
  },
  removeNewScreenshotListener: (callback: (data: any) => void) => {
    ipcRenderer.removeListener('new-screenshot-created', callback);
  },
  onOCRCompleted: (callback: (data: { imagePath: string; ocrText: string; ocrCompleted: boolean }) => void) => {
    ipcRenderer.on('ocr-completed', (event, data) => callback(data));
  },
  removeOCRCompletedListener: (callback: (data: any) => void) => {
    ipcRenderer.removeListener('ocr-completed', callback);
  }
} as ElectronAPI);

// Type definitions to be available in renderer
declare global {
  interface Window {
    electron: ElectronAPI;
  }
}
