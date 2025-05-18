import { ipcRenderer } from 'electron';

/**
 * Captures the full screen using macOS native Core Graphics APIs (via screenshot-desktop in main process)
 * Optimized for <100ms performance as required
 * @returns Promise<Buffer | null> Buffer containing the PNG image data or null if capture failed
 */
export async function captureFullScreen(): Promise<Buffer | null> {
  try {
    // Request screenshot from main process which uses native macOS APIs
    const startTime = performance.now();
    const base64Image = await ipcRenderer.invoke('capture-fullscreen');
    const endTime = performance.now();

    // Log performance for optimization tracking
    console.log(`Screenshot capture completed in ${endTime - startTime}ms`);

    if (!base64Image) return null;

    // Convert base64 string back to Buffer
    return Buffer.from(base64Image, 'base64');
  } catch (error) {
    console.error('Screenshot capture failed:', error);
    return null;
  }
}

/**
 * Future implementation for area capture
 * Currently a placeholder for upcoming features
 */
export async function captureArea(
  x: number,
  y: number,
  width: number,
  height: number
): Promise<Buffer | null> {
  try {
    // This will be implemented in future tasks
    console.warn('Area capture not yet implemented');
    return null;
  } catch (error) {
    console.error('Area capture failed:', error);
    return null;
  }
}

/**
 * Future implementation for window capture
 * Currently a placeholder for upcoming features
 */
export async function captureWindow(windowId: string): Promise<Buffer | null> {
  try {
    // This will be implemented in future tasks
    console.warn('Window capture not yet implemented');
    return null;
  } catch (error) {
    console.error('Window capture failed:', error);
    return null;
  }
}

// Expose to preload/renderer
(window as any).captureFullScreen = captureFullScreen;
