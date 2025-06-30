import { app } from 'electron';
import fs from 'fs';
import path from 'path';

export interface LogEntry {
  timestamp: string;
  level: 'error' | 'warn' | 'info' | 'debug';
  source: 'main' | 'renderer' | 'preload';
  message: string;
  stack?: string;
  extra?: any;
}

class Logger {
  private logDir: string;
  private logFile: string;
  private maxLogSize = 10 * 1024 * 1024; // 10MB
  private maxLogFiles = 5;

  constructor() {
    // Use app data directory for logs
    this.logDir = app ? path.join(app.getPath('userData'), 'logs') : './logs';
    this.logFile = path.join(this.logDir, 'screenshotos.log');
    this.ensureLogDirectory();
  }

  private ensureLogDirectory() {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  private formatLogEntry(entry: LogEntry): string {
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

  private rotateLogsIfNeeded() {
    try {
      if (!fs.existsSync(this.logFile)) return;
      
      const stats = fs.statSync(this.logFile);
      if (stats.size > this.maxLogSize) {
        // Rotate logs
        for (let i = this.maxLogFiles - 1; i >= 1; i--) {
          const oldFile = `${this.logFile}.${i}`;
          const newFile = `${this.logFile}.${i + 1}`;
          
          if (fs.existsSync(oldFile)) {
            if (i === this.maxLogFiles - 1) {
              fs.unlinkSync(oldFile); // Delete oldest
            } else {
              fs.renameSync(oldFile, newFile);
            }
          }
        }
        
        // Move current log to .1
        fs.renameSync(this.logFile, `${this.logFile}.1`);
      }
    } catch (error) {
      console.error('Failed to rotate logs:', error);
    }
  }

  public log(entry: LogEntry) {
    try {
      this.rotateLogsIfNeeded();
      const formatted = this.formatLogEntry(entry);
      fs.appendFileSync(this.logFile, formatted);
      
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
    } catch (error) {
      console.error('Failed to write log:', error);
    }
  }

  public error(source: LogEntry['source'], message: string, error?: Error, extra?: any) {
    this.log({
      timestamp: new Date().toISOString(),
      level: 'error',
      source,
      message,
      stack: error?.stack,
      extra
    });
  }

  public warn(source: LogEntry['source'], message: string, extra?: any) {
    this.log({
      timestamp: new Date().toISOString(),
      level: 'warn',
      source,
      message,
      extra
    });
  }

  public info(source: LogEntry['source'], message: string, extra?: any) {
    this.log({
      timestamp: new Date().toISOString(),
      level: 'info',
      source,
      message,
      extra
    });
  }

  public debug(source: LogEntry['source'], message: string, extra?: any) {
    this.log({
      timestamp: new Date().toISOString(),
      level: 'debug',
      source,
      message,
      extra
    });
  }

  public getLogPath(): string {
    return this.logFile;
  }

  public getRecentLogs(lines: number = 100): string {
    try {
      if (!fs.existsSync(this.logFile)) {
        return 'No log file found';
      }
      
      const content = fs.readFileSync(this.logFile, 'utf-8');
      const allLines = content.split('\n');
      const recentLines = allLines.slice(-lines).join('\n');
      return recentLines;
    } catch (error) {
      return `Failed to read logs: ${error}`;
    }
  }
}

export const logger = new Logger();