import React, { useState, useEffect } from 'react';
import { rendererLogger } from '../utils/renderer-logger';
import { Bug, RefreshCw, Download, X } from 'lucide-react';

interface DebugPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function DebugPanel({ isOpen, onClose }: DebugPanelProps) {
  const [logs, setLogs] = useState<string>('Loading logs...');
  const [logPath, setLogPath] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  const loadLogs = async () => {
    setIsLoading(true);
    try {
      const [recentLogs, path] = await Promise.all([
        rendererLogger.getRecentLogs(200),
        rendererLogger.getLogPath()
      ]);
      setLogs(recentLogs);
      setLogPath(path);
    } catch (error) {
      setLogs('Failed to load logs: ' + error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadLogs();
    }
  }, [isOpen]);

  const testErrorLogging = () => {
    // Test different types of errors
    rendererLogger.info('Debug panel: Testing error logging system');
    rendererLogger.warn('Debug panel: This is a test warning');
    rendererLogger.error('Debug panel: This is a test error', new Error('Test error message'));
    
    // Test console errors (should be captured)
    console.error('Test console error from debug panel');
    console.warn('Test console warning from debug panel');
    
    // Refresh logs after a short delay
    setTimeout(loadLogs, 500);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-xl w-4/5 h-4/5 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Bug className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold">Debug Panel - Error Logs</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={testErrorLogging}
              className="px-3 py-1 bg-yellow-500 text-white rounded text-sm hover:bg-yellow-600 transition-colors"
            >
              Test Logging
            </button>
            <button
              onClick={loadLogs}
              disabled={isLoading}
              className="p-2 hover:bg-gray-100 rounded transition-colors disabled:opacity-50"
              title="Refresh logs"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Log Path Info */}
        <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
          <p className="text-sm text-gray-600">
            <strong>Log file:</strong> {logPath || 'Loading...'}
          </p>
          <p className="text-sm text-gray-500 mt-1">
            Showing last 200 lines. Logs are automatically rotated when they exceed 10MB.
          </p>
        </div>

        {/* Logs Content */}
        <div className="flex-1 overflow-auto">
          <pre className="p-4 text-xs font-mono whitespace-pre-wrap bg-gray-900 text-green-400 h-full">
            {logs}
          </pre>
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-gray-200 bg-gray-50">
          <p className="text-xs text-gray-500">
            This panel captures all errors from both the main process and renderer process. 
            Logs are saved to disk and rotated automatically. Press F12 to open browser DevTools for live console.
          </p>
        </div>
      </div>
    </div>
  );
}