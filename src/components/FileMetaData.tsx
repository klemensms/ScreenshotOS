import React, { useState, useEffect, useRef } from 'react';
import { Copy, Edit2, Save, X, FileText, Monitor, Calendar, Ruler, Palette, Tag } from 'lucide-react';
import { useApp } from '../context/AppContext';

export function FileMetaData() {
  const { currentScreenshot, updateScreenshotNotes } = useApp();
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [notes, setNotes] = useState('');
  const [isCopyAnimating, setIsCopyAnimating] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync notes with current screenshot
  useEffect(() => {
    if (currentScreenshot) {
      setNotes(currentScreenshot.notes || '');
    } else {
      setNotes('');
    }
  }, [currentScreenshot]);


  // Return early if no screenshot is selected
  if (!currentScreenshot) {
    return (
      <div 
        ref={containerRef}
        className="bg-white border-r border-gray-300 h-full flex flex-col w-full"
      >
        <div className="bg-gray-100 border-b border-gray-300 py-2 px-3">
          <h3 className="text-sm text-gray-700">FILE META DATA</h3>
        </div>
        <div className="flex-1 flex items-center justify-center py-4 px-3">
          <p className="text-gray-500 text-sm text-center break-words">Select a screenshot to view metadata</p>
        </div>
      </div>
    );
  }

  // Generate metadata from current screenshot
  const metadata = {
    fileName: currentScreenshot.name + '.png',
    fileSize: 'Unknown',
    dimensions: `${currentScreenshot.dimensions?.width || 'Unknown'} x ${currentScreenshot.dimensions?.height || 'Unknown'}`,
    createdDate: currentScreenshot.timestamp.toLocaleString(),
    modifiedDate: currentScreenshot.timestamp.toLocaleString(),
    application: currentScreenshot.applicationInfo?.name || 'Unknown',
    windowTitle: currentScreenshot.applicationInfo?.windowTitle || currentScreenshot.name,
    bundleId: currentScreenshot.applicationInfo?.bundleId || 'Unknown',
    format: 'PNG',
    colorDepth: '24-bit',
    dpi: '72 x 72',
    compression: 'None',
    ocrText: currentScreenshot.ocrText || '',
    ocrCompleted: currentScreenshot.ocrCompleted || false,
    appliedTags: currentScreenshot.tags || [],
    captureMethod: currentScreenshot.captureMethod === 'fullscreen' ? 'Full Screen' : 
                  currentScreenshot.captureMethod === 'area' ? 'Area Selection' : 
                  currentScreenshot.captureMethod === 'window' ? 'Window Selection' : 'Unknown',
    screenshotType: 'Screenshot'
  };

  const copyToClipboard = async (text: string) => {
    try {
      await window.electron.invoke('copy-text-to-clipboard', text);
      // Trigger animation feedback
      setIsCopyAnimating(true);
      setTimeout(() => setIsCopyAnimating(false), 200);
    } catch (error) {
      console.error('Failed to copy text to clipboard:', error);
    }
  };

  const handleNotesEdit = () => {
    setIsEditingNotes(true);
  };

  const handleNotesSave = () => {
    if (currentScreenshot) {
      updateScreenshotNotes(currentScreenshot.id, notes);
    }
    setIsEditingNotes(false);
  };

  const handleNotesCancel = () => {
    // Revert notes to original value
    if (currentScreenshot) {
      setNotes(currentScreenshot.notes || '');
    }
    setIsEditingNotes(false);
  };

  return (
    <div 
      ref={containerRef}
      className="bg-white border-r border-gray-300 h-full flex flex-col w-full"
    >
      {/* Header */}
      <div className="bg-gray-100 border-b border-gray-300 py-2 px-3">
        <h3 className="text-sm text-gray-700">FILE META DATA</h3>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-auto py-3 space-y-4 px-3">
        
        {/* File Information */}
        <div className="space-y-2">
          <h4 className="text-xs text-gray-500 uppercase tracking-wide flex items-center gap-1">
            <FileText className="w-3 h-3" />
            File Information
          </h4>
          
          <div className="space-y-1 text-xs">
            <div className="flex justify-between items-start gap-2">
              <span className="text-gray-600 flex-shrink-0">Name:</span>
              <span className="text-gray-800 break-words text-right">{metadata.fileName}</span>
            </div>
            
            <div className="flex justify-between items-start gap-2">
              <span className="text-gray-600 flex-shrink-0">Size:</span>
              <span className="text-gray-800 break-words text-right">{metadata.fileSize}</span>
            </div>
            
            <div className="flex justify-between items-start gap-2">
              <span className="text-gray-600 flex-shrink-0">Dimensions:</span>
              <span className="text-gray-800 break-words text-right">{metadata.dimensions}</span>
            </div>
            
            <div className="flex justify-between items-start gap-2">
              <span className="text-gray-600 flex-shrink-0">Format:</span>
              <span className="text-gray-800 break-words text-right">{metadata.format}</span>
            </div>
            
            <div className="flex justify-between items-start gap-2">
              <span className="text-gray-600 flex-shrink-0">Color Depth:</span>
              <span className="text-gray-800 break-words text-right">{metadata.colorDepth}</span>
            </div>
            
            <div className="flex justify-between items-start gap-2">
              <span className="text-gray-600 flex-shrink-0">DPI:</span>
              <span className="text-gray-800 break-words text-right">{metadata.dpi}</span>
            </div>
          </div>
        </div>

        {/* Capture Information */}
        <div className="space-y-2">
          <h4 className="text-xs text-gray-500 uppercase tracking-wide flex items-center gap-1">
            <Monitor className="w-3 h-3" />
            Capture Information
          </h4>
          
          <div className="space-y-1 text-xs">
            <div className="flex justify-between items-start gap-2">
              <span className="text-gray-600 flex-shrink-0">Application:</span>
              <span className="text-gray-800 text-right">{metadata.application}</span>
            </div>
            
            <div className="flex justify-between items-start gap-2">
              <span className="text-gray-600 flex-shrink-0">Window Title:</span>
              <span className="text-gray-800 break-words text-right">{metadata.windowTitle}</span>
            </div>
            
            <div className="flex justify-between items-start gap-2">
              <span className="text-gray-600 flex-shrink-0">Bundle ID:</span>
              <span className="text-gray-800 break-words text-right">{metadata.bundleId}</span>
            </div>
            
            <div className="flex justify-between items-start gap-2">
              <span className="text-gray-600 flex-shrink-0">Capture Method:</span>
              <span className="text-gray-800 break-words text-right">{metadata.captureMethod}</span>
            </div>
            
            <div className="flex justify-between items-start gap-2">
              <span className="text-gray-600 flex-shrink-0">Type:</span>
              <span className="text-gray-800 break-words text-right">{metadata.screenshotType}</span>
            </div>
          </div>
        </div>

        {/* Date Information */}
        <div className="space-y-2">
          <h4 className="text-xs text-gray-500 uppercase tracking-wide flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            Date Information
          </h4>
          
          <div className="space-y-1 text-xs">
            <div className="flex justify-between items-start gap-2">
              <span className="text-gray-600 flex-shrink-0">Created:</span>
              <span className="text-gray-800 break-words text-right">{metadata.createdDate}</span>
            </div>
            
            <div className="flex justify-between items-start gap-2">
              <span className="text-gray-600 flex-shrink-0">Modified:</span>
              <span className="text-gray-800 break-words text-right">{metadata.modifiedDate}</span>
            </div>
          </div>
        </div>

        {/* Applied Tags */}
        <div className="space-y-2">
          <h4 className="text-xs text-gray-500 uppercase tracking-wide flex items-center gap-1">
            <Tag className="w-3 h-3" />
            Applied Tags
          </h4>
          
          <div className="flex gap-1">
            {metadata.appliedTags.map((tag, index) => (
              <div
                key={index}
                className="w-4 h-4 bg-red-500 rounded-full"
                title={`${tag} tag`}
              />
            ))}
            {metadata.appliedTags.length === 0 && (
              <span className="text-xs text-gray-500 italic">No tags applied</span>
            )}
          </div>
        </div>

        {/* OCR Extracted Text */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs text-gray-500 uppercase tracking-wide flex items-center gap-1">
              <Palette className="w-3 h-3" />
              OCR Extracted Text
              {!metadata.ocrCompleted && (
                <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse ml-1" title="OCR processing..." />
              )}
            </h4>
            {metadata.ocrText && (
              <button
                onClick={() => copyToClipboard(metadata.ocrText)}
                className={`p-1 hover:bg-gray-200 rounded transition-all duration-200 ${
                  isCopyAnimating ? 'bg-green-200 scale-110' : ''
                }`}
                title="Copy OCR text"
              >
                <Copy className={`w-3 h-3 transition-colors duration-200 ${
                  isCopyAnimating ? 'text-green-600' : 'text-gray-500'
                }`} />
              </button>
            )}
          </div>
          
          <div className="bg-gray-50 border border-gray-200 rounded p-2 max-h-40 overflow-auto">
            {metadata.ocrCompleted ? (
              metadata.ocrText ? (
                <pre className="text-xs text-gray-800 whitespace-pre-wrap">{metadata.ocrText}</pre>
              ) : (
                <p className="text-xs text-gray-500 italic">No text detected in image</p>
              )
            ) : (
              <p className="text-xs text-gray-500 italic">OCR processing in progress...</p>
            )}
          </div>
        </div>

        {/* Notes Section */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs text-gray-500 uppercase tracking-wide">Notes</h4>
            {!isEditingNotes ? (
              <button
                onClick={handleNotesEdit}
                className="p-1 hover:bg-gray-200 rounded"
                title="Edit notes"
              >
                <Edit2 className="w-3 h-3 text-gray-500" />
              </button>
            ) : (
              <div className="flex gap-1">
                <button
                  onClick={handleNotesSave}
                  className="p-1 hover:bg-green-200 rounded"
                  title="Save notes"
                >
                  <Save className="w-3 h-3 text-green-600" />
                </button>
                <button
                  onClick={handleNotesCancel}
                  className="p-1 hover:bg-red-200 rounded"
                  title="Cancel editing"
                >
                  <X className="w-3 h-3 text-red-600" />
                </button>
              </div>
            )}
          </div>
          
          {!isEditingNotes ? (
            <div className="bg-gray-50 border border-gray-200 rounded p-2 min-h-16">
              <p className="text-xs text-gray-800 break-words whitespace-pre-wrap">{notes}</p>
            </div>
          ) : (
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full h-20 p-2 text-xs border border-gray-300 rounded resize-none focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Add your notes here..."
            />
          )}
        </div>

        {/* Technical Details */}
        <div className="space-y-2">
          <h4 className="text-xs text-gray-500 uppercase tracking-wide flex items-center gap-1">
            <Ruler className="w-3 h-3" />
            Technical Details
          </h4>
          
          <div className="space-y-1 text-xs">
            <div className="flex justify-between items-start gap-2">
              <span className="text-gray-600 flex-shrink-0">Compression:</span>
              <span className="text-gray-800 break-words text-right">{metadata.compression}</span>
            </div>
            
            <div className="flex justify-between items-start gap-2">
              <span className="text-gray-600 flex-shrink-0">Pixel Ratio:</span>
              <span className="text-gray-800 break-words text-right">1:1</span>
            </div>
            
            <div className="flex justify-between items-start gap-2">
              <span className="text-gray-600 flex-shrink-0">Bit Depth:</span>
              <span className="text-gray-800 break-words text-right">8 bits/channel</span>
            </div>
            
            <div className="flex justify-between items-start gap-2">
              <span className="text-gray-600 flex-shrink-0">Color Space:</span>
              <span className="text-gray-800 break-words text-right">sRGB</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}