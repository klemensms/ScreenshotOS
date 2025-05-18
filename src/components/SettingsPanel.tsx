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

  // Load settings when the component mounts
  useEffect(() => {
    if (isVisible) {
      // Load current storage settings
      window.electron.invoke('load-storage-config')
        .then((result) => {
          setSaveDir(result.saveDirectory);
          setFilenameTemplate(result.filenameTemplate);
          setFileFormat(result.fileFormat);
        })
        .catch(err => {
          console.error('Failed to load settings:', err);
          setStatusMessage('Failed to load settings');
        });
    }
  }, [isVisible]);

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
      const success = await window.electron.invoke('save-storage-config', {
        saveDirectory: saveDir,
        filenameTemplate,
        fileFormat
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
