"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
const electron_1 = require("electron");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
class Logger {
    constructor() {
        this.maxLogSize = 10 * 1024 * 1024; // 10MB
        this.maxLogFiles = 5;
        // Use app data directory for logs
        this.logDir = electron_1.app ? path_1.default.join(electron_1.app.getPath('userData'), 'logs') : './logs';
        this.logFile = path_1.default.join(this.logDir, 'screenshotos.log');
        this.ensureLogDirectory();
    }
    ensureLogDirectory() {
        if (!fs_1.default.existsSync(this.logDir)) {
            fs_1.default.mkdirSync(this.logDir, { recursive: true });
        }
    }
    formatLogEntry(entry) {
        const { timestamp, level, source, message, stack, extra } = entry;
        let formatted = `[${timestamp}] [${level.toUpperCase()}] [${source}] ${message}`;
        if (stack) {
            formatted += `\nStack: ${stack}`;
        }
        if (extra) {
            formatted += `\nExtra: ${JSON.stringify(extra, null, 2)}`;
        }
        return formatted + '\n';
    }
    rotateLogsIfNeeded() {
        try {
            if (!fs_1.default.existsSync(this.logFile))
                return;
            const stats = fs_1.default.statSync(this.logFile);
            if (stats.size > this.maxLogSize) {
                // Rotate logs
                for (let i = this.maxLogFiles - 1; i >= 1; i--) {
                    const oldFile = `${this.logFile}.${i}`;
                    const newFile = `${this.logFile}.${i + 1}`;
                    if (fs_1.default.existsSync(oldFile)) {
                        if (i === this.maxLogFiles - 1) {
                            fs_1.default.unlinkSync(oldFile); // Delete oldest
                        }
                        else {
                            fs_1.default.renameSync(oldFile, newFile);
                        }
                    }
                }
                // Move current log to .1
                fs_1.default.renameSync(this.logFile, `${this.logFile}.1`);
            }
        }
        catch (error) {
            console.error('Failed to rotate logs:', error);
        }
    }
    log(entry) {
        try {
            this.rotateLogsIfNeeded();
            const formatted = this.formatLogEntry(entry);
            fs_1.default.appendFileSync(this.logFile, formatted);
            // Also log to console for development
            const consoleMessage = `[${entry.source}] ${entry.message}`;
            switch (entry.level) {
                case 'error':
                    console.error(consoleMessage, entry.stack || '');
                    break;
                case 'warn':
                    console.warn(consoleMessage);
                    break;
                case 'info':
                    console.info(consoleMessage);
                    break;
                case 'debug':
                    console.debug(consoleMessage);
                    break;
            }
        }
        catch (error) {
            console.error('Failed to write log:', error);
        }
    }
    error(source, message, error, extra) {
        this.log({
            timestamp: new Date().toISOString(),
            level: 'error',
            source,
            message,
            stack: error?.stack,
            extra
        });
    }
    warn(source, message, extra) {
        this.log({
            timestamp: new Date().toISOString(),
            level: 'warn',
            source,
            message,
            extra
        });
    }
    info(source, message, extra) {
        this.log({
            timestamp: new Date().toISOString(),
            level: 'info',
            source,
            message,
            extra
        });
    }
    debug(source, message, extra) {
        this.log({
            timestamp: new Date().toISOString(),
            level: 'debug',
            source,
            message,
            extra
        });
    }
    getLogPath() {
        return this.logFile;
    }
    getRecentLogs(lines = 100) {
        try {
            if (!fs_1.default.existsSync(this.logFile)) {
                return 'No log file found';
            }
            const content = fs_1.default.readFileSync(this.logFile, 'utf-8');
            const allLines = content.split('\n');
            const recentLines = allLines.slice(-lines).join('\n');
            return recentLines;
        }
        catch (error) {
            return `Failed to read logs: ${error}`;
        }
    }
}
exports.logger = new Logger();
