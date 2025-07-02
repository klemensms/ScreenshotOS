import { app } from 'electron';
import fs from 'fs';
import path from 'path';
import { homedir } from 'os';

// Config file path
const configDir = path.join(app.getPath('userData'), 'config');
const configFile = path.join(configDir, 'storage-config.json');

// Default config
const defaultConfig = {
  saveDirectory: path.join(homedir(), 'Downloads'),
  filenameTemplate: 'screenshot_%TIMESTAMP%',
  fileFormat: 'png',
  shortcuts: {
    fullScreen: 'CommandOrControl+Shift+3',
    areaCapture: 'CommandOrControl+Shift+4'
  }
};

// Type definitions
export interface ShortcutConfig {
  fullScreen: string;
  areaCapture: string;
}

export interface StorageConfig {
  saveDirectory: string;
  filenameTemplate: string;
  fileFormat: string;
  shortcuts: ShortcutConfig;
}

/**
 * Ensures the configuration directory exists
 */
function ensureConfigDir() {
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }
}

/**
 * Loads the storage configuration from disk
 * Creates default config if none exists
 */
export function loadStorageConfig(): StorageConfig {
  ensureConfigDir();
  
  try {
    if (fs.existsSync(configFile)) {
      const data = fs.readFileSync(configFile, 'utf8');
      const config = JSON.parse(data) as StorageConfig;
      return { ...defaultConfig, ...config };
    }
  } catch (error) {
    console.error('Error loading storage config:', error);
  }
  
  // Save default config if none exists
  saveStorageConfig(defaultConfig);
  return defaultConfig;
}

/**
 * Saves the storage configuration to disk
 */
export function saveStorageConfig(config: StorageConfig): boolean {
  ensureConfigDir();
  
  try {
    fs.writeFileSync(configFile, JSON.stringify(config, null, 2));
    return true;
  } catch (error) {
    console.error('Error saving storage config:', error);
    return false;
  }
}

/**
 * Updates a specific configuration property
 */
export function updateStorageConfig(key: keyof StorageConfig, value: any): boolean {
  const config = loadStorageConfig();
  (config as any)[key] = value;
  return saveStorageConfig(config);
}

/**
 * Ensures the save directory exists
 */
export function ensureSaveDirectory(directory?: string): string {
  const config = loadStorageConfig();
  const saveDir = directory || config.saveDirectory;
  
  if (!fs.existsSync(saveDir)) {
    fs.mkdirSync(saveDir, { recursive: true });
    console.log(`Created screenshot directory: ${saveDir}`);
  }
  
  return saveDir;
}
