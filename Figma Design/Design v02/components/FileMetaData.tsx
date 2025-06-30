import React, { useState } from 'react';
import { Copy, Edit2, Save, X, FileText, Monitor, Calendar, Ruler, Palette, Tag } from 'lucide-react';

export function FileMetaData() {
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [notes, setNotes] = useState('Initial bug report for login form validation issues.');

  // Sample metadata for the selected screenshot
  const metadata = {
    fileName: 'SQLQuery1.sql - sqls-dev-rpt1-scuk.png',
    fileSize: '1.2 MB',
    dimensions: '886 x 275',
    createdDate: '25-08-2023 03:31:30',
    modifiedDate: '25-08-2023 03:31:45',
    application: 'SQL Server Management Studio',
    windowTitle: 'SQLQuery1.sql - sqls-dev-rpt1-scuk (DESKTOP-ABC123\\user)',
    format: 'PNG',
    colorDepth: '24-bit',
    dpi: '96 x 96',
    compression: 'None',
    ocrText: `SELECT TOP 1000 [Id]
      ,[FirstName]
      ,[LastName]  
      ,[Email]
      ,[CreatedDate]
      ,[IsActive]
  FROM [TestDB].[dbo].[Users]
  WHERE [IsActive] = 1
  ORDER BY [CreatedDate] DESC

-- Query results: 847 rows affected
-- Execution time: 0.023 seconds`,
    appliedTags: ['red'],
    captureMethod: 'Active Window',
    screenshotType: 'Application Window'
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    // Could add a toast notification here
  };

  const handleNotesEdit = () => {
    setIsEditingNotes(true);
  };

  const handleNotesSave = () => {
    setIsEditingNotes(false);
    // Save notes logic would go here
  };

  const handleNotesCancel = () => {
    setIsEditingNotes(false);
    // Revert notes to original value
  };

  return (
    <div className="bg-white border-l border-r border-gray-300 w-72 h-full flex flex-col">
      {/* Header */}
      <div className="bg-gray-100 border-b border-gray-300 px-3 py-2">
        <h3 className="text-sm text-gray-700">FILE META DATA</h3>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-auto p-3 space-y-4">
        
        {/* File Information */}
        <div className="space-y-2">
          <h4 className="text-xs text-gray-500 uppercase tracking-wide flex items-center gap-1">
            <FileText className="w-3 h-3" />
            File Information
          </h4>
          
          <div className="space-y-1 text-xs">
            <div>
              <span className="text-gray-600">Name:</span>
              <div className="text-gray-800 break-all mt-1">{metadata.fileName}</div>
            </div>
            
            <div className="flex justify-between">
              <span className="text-gray-600">Size:</span>
              <span className="text-gray-800">{metadata.fileSize}</span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-gray-600">Dimensions:</span>
              <span className="text-gray-800">{metadata.dimensions}</span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-gray-600">Format:</span>
              <span className="text-gray-800">{metadata.format}</span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-gray-600">Color Depth:</span>
              <span className="text-gray-800">{metadata.colorDepth}</span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-gray-600">DPI:</span>
              <span className="text-gray-800">{metadata.dpi}</span>
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
            <div>
              <span className="text-gray-600">Application:</span>
              <div className="text-gray-800 mt-1">{metadata.application}</div>
            </div>
            
            <div>
              <span className="text-gray-600">Window Title:</span>
              <div className="text-gray-800 break-all mt-1">{metadata.windowTitle}</div>
            </div>
            
            <div className="flex justify-between">
              <span className="text-gray-600">Capture Method:</span>
              <span className="text-gray-800">{metadata.captureMethod}</span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-gray-600">Type:</span>
              <span className="text-gray-800">{metadata.screenshotType}</span>
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
            <div>
              <span className="text-gray-600">Created:</span>
              <div className="text-gray-800 mt-1">{metadata.createdDate}</div>
            </div>
            
            <div>
              <span className="text-gray-600">Modified:</span>
              <div className="text-gray-800 mt-1">{metadata.modifiedDate}</div>
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
            </h4>
            <button
              onClick={() => copyToClipboard(metadata.ocrText)}
              className="p-1 hover:bg-gray-200 rounded"
              title="Copy OCR text"
            >
              <Copy className="w-3 h-3 text-gray-500" />
            </button>
          </div>
          
          <div className="bg-gray-50 border border-gray-200 rounded p-2 max-h-40 overflow-auto">
            <pre className="text-xs text-gray-800 whitespace-pre-wrap">{metadata.ocrText}</pre>
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
              <p className="text-xs text-gray-800">{notes}</p>
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
            <div className="flex justify-between">
              <span className="text-gray-600">Compression:</span>
              <span className="text-gray-800">{metadata.compression}</span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-gray-600">Pixel Ratio:</span>
              <span className="text-gray-800">1:1</span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-gray-600">Bit Depth:</span>
              <span className="text-gray-800">8 bits/channel</span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-gray-600">Color Space:</span>
              <span className="text-gray-800">sRGB</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}