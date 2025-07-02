import React, { useState, useEffect } from 'react';

// Define global window electron interface
declare global {
  interface Window {
    electron: {
      invoke: (channel: string, ...args: any[]) => Promise<any>;
    }
  }
}

// Define the props interface
interface SettingsPanelProps {
  isVisible: boolean;
  onClose: () => void;
}

// Define the component
const SettingsPanel: React.FC<SettingsPanelProps> = ({ isVisible, onClose }) => {
  const [saveDir, setSaveDir] = useState('');
  const [filenameTemplate, setFilenameTemplate] = useState('');
  const [fileFormat, setFileFormat] = useState('png');
  const [statusMessage, setStatusMessage] = useState('');
  const [fullScreenShortcut, setFullScreenShortcut] = useState('');
  const [areaCaptureShortcut, setAreaCaptureShortcut] = useState('');
  const [shortcutValidation, setShortcutValidation] = useState<{[key: string]: string}>({});

  // Load settings when the component mounts
  useEffect(() => {
    if (isVisible) {
      // Load current storage settings
      window.electron.invoke('load-storage-config')
        .then((result) => {
          setSaveDir(result.saveDirectory);
          setFilenameTemplate(result.filenameTemplate);
          setFileFormat(result.fileFormat);
          setFullScreenShortcut(result.shortcuts?.fullScreen || 'CommandOrControl+Shift+3');
          setAreaCaptureShortcut(result.shortcuts?.areaCapture || 'CommandOrControl+Shift+4');
        })
        .catch(err => {
          console.error('Failed to load settings:', err);
          setStatusMessage('Failed to load settings');
        });
    }
  }, [isVisible]);

  // Validate shortcut function
  const validateShortcut = async (shortcut: string, field: string) => {
    if (!shortcut) {
      setShortcutValidation(prev => ({ ...prev, [field]: '' }));
      return;
    }

    try {
      const result = await window.electron.invoke('validate-shortcut', shortcut);
      if (result.valid) {
        setShortcutValidation(prev => ({ ...prev, [field]: '' }));
      } else {
        setShortcutValidation(prev => ({ ...prev, [field]: result.reason }));
      }
    } catch (error) {
      setShortcutValidation(prev => ({ ...prev, [field]: 'Invalid shortcut format' }));
    }
  };

  // Handle shortcut input changes with validation
  const handleShortcutChange = (value: string, field: string, setter: (val: string) => void) => {
    setter(value);
    // Debounce validation to avoid too many calls
    setTimeout(() => validateShortcut(value, field), 500);
  };

  // Handle save directory selection
  const handleSelectDirectory = async () => {
    const result = await window.electron.invoke('select-directory');
    if (result && !result.canceled && result.filePaths.length > 0) {
      setSaveDir(result.filePaths[0]);
    }
  };

  // Handle save button click
  const handleSave = async () => {
    try {
      // Check if shortcuts have validation errors
      const hasErrors = Object.values(shortcutValidation).some(error => error !== '');
      if (hasErrors) {
        setStatusMessage('Please fix shortcut errors before saving.');
        return;
      }

      const success = await window.electron.invoke('save-storage-config', {
        saveDirectory: saveDir,
        filenameTemplate,
        fileFormat,
        shortcuts: {
          fullScreen: fullScreenShortcut,
          areaCapture: areaCaptureShortcut
        }
      });
      
      if (success) {
        setStatusMessage('Settings saved successfully!');
        setTimeout(() => {
          setStatusMessage('');
          onClose();
        }, 1500);
      } else {
        setStatusMessage('Failed to save settings.');
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      setStatusMessage('Error saving settings.');
    }
  };

  if (!isVisible) return null;

  return (
    <div className="overlay" onClick={(e) => {
      // Close when clicking outside the panel
      if (e.target === e.currentTarget) onClose();
    }}>
      <div className="settings-panel" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <h2 className="settings-title">Screenshot Settings</h2>
          <button className="close-button" onClick={onClose}>×</button>
        </div>
        
        <div className="settings-group">
          <label>Save Location:</label>
          <div className="directory-selector">
            <input 
              type="text" 
              value={saveDir} 
              onChange={(e) => setSaveDir(e.target.value)}
              readOnly
            />
            <button onClick={handleSelectDirectory}>Browse...</button>
          </div>
        </div>
        
        <div className="settings-group">
          <label>Filename Template:</label>
          <input 
            type="text" 
            value={filenameTemplate}
            onChange={(e) => setFilenameTemplate(e.target.value)}
            placeholder="screenshot_%TIMESTAMP%"
          />
          <p className="hint">Use %TIMESTAMP% as placeholder for date/time</p>
        </div>
        
        <div className="settings-group">
          <label>File Format:</label>
          <select 
            value={fileFormat}
            onChange={(e) => setFileFormat(e.target.value)}
          >
            <option value="png">PNG</option>
            <option value="jpg">JPG</option>
          </select>
        </div>
        
        <div className="settings-group">
          <label>Full Screen Capture Shortcut:</label>
          <input 
            type="text" 
            value={fullScreenShortcut}
            onChange={(e) => handleShortcutChange(e.target.value, 'fullScreen', setFullScreenShortcut)}
            placeholder="CommandOrControl+Shift+3"
            style={{ borderColor: shortcutValidation.fullScreen ? '#F44336' : undefined }}
          />
          {shortcutValidation.fullScreen && (
            <p className="hint" style={{ color: '#F44336' }}>{shortcutValidation.fullScreen}</p>
          )}
          <p className="hint">Examples: CommandOrControl+Shift+3, Alt+F1, F12</p>
        </div>
        
        <div className="settings-group">
          <label>Area Capture Shortcut:</label>
          <input 
            type="text" 
            value={areaCaptureShortcut}
            onChange={(e) => handleShortcutChange(e.target.value, 'areaCapture', setAreaCaptureShortcut)}
            placeholder="CommandOrControl+Shift+4"
            style={{ borderColor: shortcutValidation.areaCapture ? '#F44336' : undefined }}
          />
          {shortcutValidation.areaCapture && (
            <p className="hint" style={{ color: '#F44336' }}>{shortcutValidation.areaCapture}</p>
          )}
          <p className="hint">Examples: CommandOrControl+Shift+4, Alt+F2, F11</p>
        </div>
        
        {statusMessage && (
          <div className="status-message">{statusMessage}</div>
        )}
        
        <div className="button-group">
          <button onClick={onClose}>Cancel</button>
          <button onClick={handleSave} className="primary">Save</button>
        </div>
      </div>
    </div>
  );
};




export default SettingsPanel;
