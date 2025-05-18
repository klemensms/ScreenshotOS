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
            'load-storage-config',
            'save-storage-config',
            'select-directory',
            'trigger-area-overlay'
        ];
        if (validChannels.includes(channel)) {
            return electron_1.ipcRenderer.invoke.apply(electron_1.ipcRenderer, __spreadArray([channel], args, false));
        }
        throw new Error("Unauthorized IPC channel: ".concat(channel));
    },
    sendAreaSelection: function (area) {
        electron_1.ipcRenderer.send('area-selection', area);
    }
});
