"use strict";
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
var electron_1 = require("electron");
// Expose protected methods that allow the renderer process to use IPC
electron_1.contextBridge.exposeInMainWorld('electron', {
    invoke: function (channel) {
        var args = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            args[_i - 1] = arguments[_i];
        }
        var validChannels = [
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
            'test-shortcuts'
        ];
        if (validChannels.includes(channel)) {
            return electron_1.ipcRenderer.invoke.apply(electron_1.ipcRenderer, __spreadArray([channel], args, false));
        }
        throw new Error("Unauthorized IPC channel: ".concat(channel));
    },
    sendAreaSelection: function (area) {
        electron_1.ipcRenderer.send('area-selection', area);
    },
    getRecentLogs: function (lines) {
        if (lines === void 0) { lines = 100; }
        return electron_1.ipcRenderer.invoke('get-recent-logs', lines);
    },
    getLogPath: function () {
        return electron_1.ipcRenderer.invoke('get-log-path');
    },
    logFromRenderer: function (level, message, error, extra) {
        return electron_1.ipcRenderer.invoke('log-from-renderer', {
            timestamp: new Date().toISOString(),
            level: level,
            message: message,
            stack: error === null || error === void 0 ? void 0 : error.stack,
            extra: extra
        });
    },
    onNewScreenshot: function (callback) {
        electron_1.ipcRenderer.on('new-screenshot-created', function (event, data) { return callback(data); });
    },
    removeNewScreenshotListener: function (callback) {
        electron_1.ipcRenderer.removeListener('new-screenshot-created', callback);
    }
});
