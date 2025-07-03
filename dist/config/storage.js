"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadStorageConfig = loadStorageConfig;
exports.saveStorageConfig = saveStorageConfig;
exports.updateStorageConfig = updateStorageConfig;
exports.ensureSaveDirectory = ensureSaveDirectory;
exports.ensureArchiveDirectory = ensureArchiveDirectory;
const electron_1 = require("electron");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const os_1 = require("os");
// Config file path
const configDir = path_1.default.join(electron_1.app.getPath('userData'), 'config');
const configFile = path_1.default.join(configDir, 'storage-config.json');
// Default config
const defaultConfig = {
    saveDirectory: path_1.default.join((0, os_1.homedir)(), 'Downloads'),
    archiveDirectory: path_1.default.join((0, os_1.homedir)(), 'Downloads', 'Archive'),
    filenameTemplate: 'screenshot_%TIMESTAMP%',
    fileFormat: 'png',
    deleteConfirmation: true,
    archiveConfirmation: false,
    shortcuts: {
        fullScreen: 'CommandOrControl+Shift+3',
        areaCapture: 'CommandOrControl+Shift+4'
    }
};
/**
 * Ensures the configuration directory exists
 */
function ensureConfigDir() {
    if (!fs_1.default.existsSync(configDir)) {
        fs_1.default.mkdirSync(configDir, { recursive: true });
    }
}
/**
 * Loads the storage configuration from disk
 * Creates default config if none exists
 */
function loadStorageConfig() {
    ensureConfigDir();
    try {
        if (fs_1.default.existsSync(configFile)) {
            const data = fs_1.default.readFileSync(configFile, 'utf8');
            const config = JSON.parse(data);
            return { ...defaultConfig, ...config };
        }
    }
    catch (error) {
        console.error('Error loading storage config:', error);
    }
    // Save default config if none exists
    saveStorageConfig(defaultConfig);
    return defaultConfig;
}
/**
 * Saves the storage configuration to disk
 */
function saveStorageConfig(config) {
    ensureConfigDir();
    try {
        fs_1.default.writeFileSync(configFile, JSON.stringify(config, null, 2));
        return true;
    }
    catch (error) {
        console.error('Error saving storage config:', error);
        return false;
    }
}
/**
 * Updates a specific configuration property
 */
function updateStorageConfig(key, value) {
    const config = loadStorageConfig();
    config[key] = value;
    return saveStorageConfig(config);
}
/**
 * Ensures the save directory exists
 */
function ensureSaveDirectory(directory) {
    const config = loadStorageConfig();
    const saveDir = directory || config.saveDirectory;
    if (!fs_1.default.existsSync(saveDir)) {
        fs_1.default.mkdirSync(saveDir, { recursive: true });
        console.log(`Created screenshot directory: ${saveDir}`);
    }
    return saveDir;
}
/**
 * Ensures the archive directory exists
 */
function ensureArchiveDirectory(directory) {
    const config = loadStorageConfig();
    const archiveDir = directory || config.archiveDirectory;
    if (!fs_1.default.existsSync(archiveDir)) {
        fs_1.default.mkdirSync(archiveDir, { recursive: true });
        console.log(`Created archive directory: ${archiveDir}`);
    }
    return archiveDir;
}
