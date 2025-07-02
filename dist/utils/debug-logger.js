"use strict";
// Debug logging utility to track app hanging issues
// This will help identify what's executing when the app hangs
Object.defineProperty(exports, "__esModule", { value: true });
exports.debugLogger = void 0;
class DebugLogger {
    constructor() {
        this.entries = [];
        this.maxEntries = 1000; // Keep last 1000 entries
        this.startTime = Date.now();
        this.operationStartTimes = new Map();
        this.isMonitoring = false;
    }
    // Get current memory usage
    getMemoryUsage() {
        const perfMemory = performance.memory;
        if (perfMemory) {
            return Math.round(perfMemory.usedJSHeapSize / 1024 / 1024);
        }
        return undefined;
    }
    // Get relative timestamp since app start
    getRelativeTime() {
        return Date.now() - this.startTime;
    }
    // Log a debug entry
    log(component, operation, details) {
        const entry = {
            timestamp: this.getRelativeTime(),
            component,
            operation,
            details,
            memoryMB: this.getMemoryUsage()
        };
        this.entries.push(entry);
        // Keep only the most recent entries
        if (this.entries.length > this.maxEntries) {
            this.entries = this.entries.slice(-this.maxEntries);
        }
        // Console log with formatted output
        const memStr = entry.memoryMB ? ` [${entry.memoryMB}MB]` : '';
        const timeStr = `[+${Math.round(entry.timestamp / 1000)}s]`;
        console.log(`🔍 ${timeStr}${memStr} [${component}] ${operation}`, details || '');
    }
    // Start timing an operation
    startOperation(component, operation, details) {
        const key = `${component}:${operation}`;
        this.operationStartTimes.set(key, Date.now());
        this.log(component, `START: ${operation}`, details);
    }
    // End timing an operation
    endOperation(component, operation, details) {
        const key = `${component}:${operation}`;
        const startTime = this.operationStartTimes.get(key);
        const duration = startTime ? Date.now() - startTime : undefined;
        if (startTime) {
            this.operationStartTimes.delete(key);
        }
        const entry = {
            timestamp: this.getRelativeTime(),
            component,
            operation: `END: ${operation}`,
            details,
            memoryMB: this.getMemoryUsage(),
            duration
        };
        this.entries.push(entry);
        // Keep only the most recent entries
        if (this.entries.length > this.maxEntries) {
            this.entries = this.entries.slice(-this.maxEntries);
        }
        const memStr = entry.memoryMB ? ` [${entry.memoryMB}MB]` : '';
        const timeStr = `[+${Math.round(entry.timestamp / 1000)}s]`;
        const durStr = duration ? ` (${duration}ms)` : '';
        console.log(`🔍 ${timeStr}${memStr} [${component}] END: ${operation}${durStr}`, details || '');
    }
    // Log a warning about potentially problematic operations
    warn(component, operation, details) {
        this.log(component, `⚠️ WARNING: ${operation}`, details);
    }
    // Log an error
    error(component, operation, error, details) {
        this.log(component, `❌ ERROR: ${operation}`, { error: error.message, details });
    }
    // Get recent entries (for debugging hung state)
    getRecentEntries(count = 50) {
        return this.entries.slice(-count);
    }
    // Get entries for a specific component
    getComponentEntries(component, count = 20) {
        return this.entries
            .filter(entry => entry.component === component)
            .slice(-count);
    }
    // Dump current state (useful for debugging hangs)
    dumpState() {
        console.group('🔍 DEBUG STATE DUMP');
        console.log('Recent entries:', this.getRecentEntries(20));
        console.log('Active operations:', Array.from(this.operationStartTimes.keys()));
        console.log('Memory usage:', this.getMemoryUsage() + 'MB');
        console.log('Uptime:', Math.round(this.getRelativeTime() / 1000) + 's');
        console.groupEnd();
    }
    // Start monitoring for potential hangs (with proper cleanup)
    startHangMonitoring() {
        if (this.isMonitoring) {
            console.warn('Debug hang monitoring already started');
            return;
        }
        this.isMonitoring = true;
        console.log('🔍 Starting debug hang monitoring (with cleanup)');
        // Log heartbeat every 10 seconds - STORE TIMER ID
        this.heartbeatTimer = setInterval(() => {
            this.log('DEBUG', 'Heartbeat', {
                uptime: Math.round(this.getRelativeTime() / 1000) + 's',
                activeOperations: this.operationStartTimes.size
            });
        }, 10000);
        // Dump state every 30 seconds - STORE TIMER ID
        this.dumpStateTimer = setInterval(() => {
            this.dumpState();
        }, 30000);
    }
    // Stop monitoring and cleanup timers
    stopHangMonitoring() {
        if (!this.isMonitoring) {
            return;
        }
        console.log('🔍 Stopping debug hang monitoring and cleaning up timers');
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = undefined;
        }
        if (this.dumpStateTimer) {
            clearInterval(this.dumpStateTimer);
            this.dumpStateTimer = undefined;
        }
        this.isMonitoring = false;
    }
    // Cleanup method to ensure no timers are left running
    cleanup() {
        this.stopHangMonitoring();
        this.entries = [];
        this.operationStartTimes.clear();
    }
}
// Export singleton instance
exports.debugLogger = new DebugLogger();
// Only log initialization, don't auto-start monitoring
exports.debugLogger.log('DEBUG', 'Debug logger initialized (monitoring disabled)');
