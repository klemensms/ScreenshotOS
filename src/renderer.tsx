// filepath: /Users/klemensstelk/Repo/ScreenshotOS/src/renderer.tsx
import * as React from 'react';
import { createRoot } from 'react-dom/client';
import SettingsPanel from './components/SettingsPanel';

// Define types for the window.electron interface
declare global {
  interface Window {
    electron: {
      invoke: (channel: string, ...args: any[]) => Promise<any>;
    }
  }
}

// Add inline styles since the CSS file isn't loading properly
const styles = {
  appContainer: {
    display: 'flex',
    flexDirection: 'column' as const,
    minHeight: '100vh',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Open Sans", "Helvetica Neue", sans-serif'
  },
  appHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 20px',
    backgroundColor: 'white',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
  },
  appLogo: {
    fontWeight: 'bold',
    fontSize: '20px',
    color: '#4CAF50'
  },
  appContent: {
    padding: '20px',
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    maxWidth: '1200px',
    margin: '0 auto'
  },
  captureControls: {
    display: 'flex',
    justifyContent: 'center',
    gap: '12px',
    marginBottom: '20px',
    marginTop: '20px'
  },
  captureButton: {
    backgroundColor: '#4CAF50',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    padding: '10px 16px',
    fontSize: '16px',
    fontWeight: 500,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    transition: 'background-color 0.2s'
  },
  settingsButton: {
    backgroundColor: 'white',
    color: '#333',
    border: '1px solid #e0e0e0',
    borderRadius: '4px',
    padding: '10px 16px',
    fontSize: '16px',
    fontWeight: 500,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  previewContainer: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    marginTop: '20px'
  },
  previewImage: {
    maxWidth: '90%',
    maxHeight: '600px',
    border: '1px solid #e0e0e0',
    borderRadius: '4px',
    boxShadow: '0 2px 10px rgba(0, 0, 0, 0.1)'
  },
  fileInfo: {
    marginTop: '16px',
    padding: '12px 16px',
    backgroundColor: '#f0f0f0',
    borderRadius: '4px',
    fontSize: '14px',
    maxWidth: '90%',
    width: '100%'
  },
  clipboardInfo: {
    marginTop: '8px',
    padding: '8px 12px',
    backgroundColor: '#e8f5e9',
    borderRadius: '4px',
    color: '#4CAF50',
    fontSize: '14px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  overlay: {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000
  },
  settingsPanel: {
    backgroundColor: 'white',
    borderRadius: '4px',
    boxShadow: '0 2px 10px rgba(0, 0, 0, 0.1)',
    padding: '24px',
    width: '500px',
    maxWidth: '90vw',
    maxHeight: '90vh',
    overflow: 'auto' as const
  },
  settingsHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px'
  },
  settingsTitle: {
    margin: 0,
    fontSize: '20px',
    fontWeight: 600
  },
  closeButton: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: '20px',
    color: '#757575'
  },
  settingsGroup: {
    marginBottom: '24px'
  },
  settingsLabel: {
    display: 'block',
    marginBottom: '8px',
    fontWeight: 500
  },
  directorySelector: {
    display: 'flex',
    gap: '8px'
  },
  directoryInput: {
    flex: 1,
    padding: '8px 12px',
    border: '1px solid #e0e0e0',
    borderRadius: '4px',
    fontSize: '14px'
  },
  directoryButton: {
    backgroundColor: '#f0f0f0',
    border: '1px solid #e0e0e0',
    borderRadius: '4px',
    padding: '8px 12px',
    cursor: 'pointer'
  },
  settingsInput: {
    width: '100%',
    padding: '8px 12px',
    border: '1px solid #e0e0e0',
    borderRadius: '4px',
    fontSize: '14px',
    boxSizing: 'border-box' as const
  },
  hint: {
    marginTop: '4px',
    fontSize: '12px',
    color: '#757575'
  },
  statusMessage: {
    padding: '8px 12px',
    marginTop: '16px',
    backgroundColor: '#e8f5e9',
    color: '#4CAF50',
    borderRadius: '4px',
    textAlign: 'center' as const
  },
  buttonGroup: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
    marginTop: '24px'
  },
  button: {
    padding: '8px 16px',
    borderRadius: '4px',
    fontSize: '14px',
    cursor: 'pointer',
    backgroundColor: 'white',
    border: '1px solid #e0e0e0',
    color: '#333'
  },
  primaryButton: {
    backgroundColor: '#4CAF50',
    border: 'none',
    color: 'white',
    padding: '8px 16px',
    borderRadius: '4px',
    fontSize: '14px',
    cursor: 'pointer'
  }
};

function App() {
  const [screenshot, setScreenshot] = React.useState<string | null>(null);
  const [savedFilePath, setSavedFilePath] = React.useState<string | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);
  const [clipboardSuccess, setClipboardSuccess] = React.useState(false);
  const [showSettings, setShowSettings] = React.useState(false);
  
  const handleCapture = async () => {
    // Reset state for new screenshot
    setSavedFilePath(null);
    setClipboardSuccess(false);
    
    const result = await window.electron.invoke('capture-fullscreen');
    if (result) {
      setScreenshot(result.base64Image);
      setSavedFilePath(result.savedFilePath);
      
      // Show clipboard notification if available
      if (result.clipboardCopySuccess) {
        setClipboardSuccess(true);
      }
    } else {
      alert('Failed to capture screenshot.');
    }
  };
  
  const handleSave = async () => {
    if (!screenshot) return;
    
    try {
      setIsSaving(true);
      const result = await window.electron.invoke('save-screenshot', screenshot);
      setIsSaving(false);
      
      if (result.success && result.filePath) {
        setSavedFilePath(result.filePath);
      } else {
        alert(`Failed to save screenshot: ${result.error || 'Unknown error'}`);
      }
    } catch (error) {
      setIsSaving(false);
      alert('An unexpected error occurred while saving the screenshot.');
      console.error(error);
    }
  };

  return (
    <div style={styles.appContainer}>
      <header style={styles.appHeader}>
        <div style={styles.appLogo}>ScreenshotOS</div>
      </header>
      
      <main style={styles.appContent}>
        <div style={styles.captureControls}>
          <button 
            style={styles.captureButton}
            onClick={handleCapture}
          >
            <span>Capture Full Screen</span>
          </button>
          
          <button 
            style={styles.settingsButton}
            onClick={() => setShowSettings(true)}
          >
            <span>Settings</span>
          </button>
        </div>
        
        {screenshot && (
          <div style={styles.previewContainer}>
            <h2>Screenshot Preview</h2>
            <img
              src={`data:image/png;base64,${screenshot}`}
              alt="Screenshot Preview"
              style={styles.previewImage}
            />
            
            {savedFilePath && (
              <div style={styles.fileInfo}>
                <p>✅ Screenshot saved to:</p>
                <code>{savedFilePath}</code>
              </div>
            )}
            
            {clipboardSuccess && (
              <div style={styles.clipboardInfo}>
                <span>✓</span>
                <span>Screenshot copied to clipboard</span>
              </div>
            )}
          </div>
        )}
      </main>
      
      <SettingsPanel 
        isVisible={showSettings}
        onClose={() => setShowSettings(false)}
      />
    </div>
  );
}

const root = createRoot(document.getElementById('root')!);
root.render(<App />);


