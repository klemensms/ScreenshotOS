/// <reference types="react" />

interface Window {
  screenshotAPI: {
    captureFullScreen: () => Promise<{
      base64Image: string;
      savedFilePath: string;
    } | null>;
    saveScreenshot: (base64Image: string) => Promise<{
      success: boolean;
      filePath?: string;
      error?: string;
    }>;
  };
}
