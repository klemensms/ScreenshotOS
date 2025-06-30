"use strict";
// Renderer-side logging utility that sends logs to main process
Object.defineProperty(exports, "__esModule", { value: true });
exports.rendererLogger = void 0;
class RendererLogger {
    logToMain(level, message, error, extra) {
        if (window.electron?.logFromRenderer) {
            window.electron.logFromRenderer(level, message, error, extra).catch(console.error);
        }
        else {
            // Fallback to console if electron API not available
            console[level](`[renderer] ${message}`, error || '', extra || '');
        }
    }
    error(message, error, extra) {
        this.logToMain('error', message, error, extra);
    }
    warn(message, extra) {
        this.logToMain('warn', message, undefined, extra);
    }
    info(message, extra) {
        this.logToMain('info', message, undefined, extra);
    }
    debug(message, extra) {
        this.logToMain('debug', message, undefined, extra);
    }
    // Get recent logs from main process
    async getRecentLogs(lines = 100) {
        try {
            if (window.electron?.getRecentLogs) {
                return await window.electron.getRecentLogs(lines);
            }
            return 'Logs not available - electron API not loaded';
        }
        catch (error) {
            this.error('Failed to get recent logs', error);
            return 'Failed to retrieve logs';
        }
    }
    // Get log file path
    async getLogPath() {
        try {
            if (window.electron?.getLogPath) {
                return await window.electron.getLogPath();
            }
            return 'Log path not available - electron API not loaded';
        }
        catch (error) {
            this.error('Failed to get log path', error);
            return 'Failed to get log path';
        }
    }
    // Set up global error handlers for the renderer process
    setupGlobalErrorHandlers() {
        // Catch unhandled errors
        window.addEventListener('error', (event) => {
            this.error('Uncaught Error', event.error, {
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno,
                message: event.message
            });
        });
        // Catch unhandled promise rejections
        window.addEventListener('unhandledrejection', (event) => {
            this.error('Unhandled Promise Rejection', event.reason, {
                promise: event.promise
            });
        });
        // Override console.error to also log to file
        const originalConsoleError = console.error;
        console.error = (...args) => {
            originalConsoleError.apply(console, args);
            const message = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' ');
            this.error('Console Error', undefined, { args });
        };
        // Override console.warn to also log to file
        const originalConsoleWarn = console.warn;
        console.warn = (...args) => {
            originalConsoleWarn.apply(console, args);
            const message = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' ');
            this.warn('Console Warning', { args });
        };
        this.info('Global error handlers set up for renderer process');
    }
}
exports.rendererLogger = new RendererLogger();
