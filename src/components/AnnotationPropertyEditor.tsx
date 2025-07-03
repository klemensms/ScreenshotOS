import React, { useState, useEffect } from 'react';
import { Palette, Type, X, Check } from 'lucide-react';
import { useApp } from '../context/AppContext';

interface AnnotationPropertyEditorProps {
  selectedAnnotations: string[];
  annotations: any[];
  onUpdateAnnotation: (annotationId: string, updates: any) => void;
  onClose: () => void;
}

export function AnnotationPropertyEditor({ 
  selectedAnnotations, 
  annotations, 
  onUpdateAnnotation, 
  onClose 
}: AnnotationPropertyEditorProps) {
  const [selectedColor, setSelectedColor] = useState('#ff0000');
  const [selectedText, setSelectedText] = useState('');
  const [isEditingText, setIsEditingText] = useState(false);

  // Color options for annotations
  const colorOptions = [
    { value: '#ff0000', name: 'Red' },
    { value: '#00ff00', name: 'Green' },
    { value: '#0000ff', name: 'Blue' },
    { value: '#ffff00', name: 'Yellow' },
    { value: '#ff8800', name: 'Orange' },
    { value: '#8800ff', name: 'Purple' },
    { value: '#00ffff', name: 'Cyan' },
    { value: '#ff00ff', name: 'Magenta' },
    { value: '#000000', name: 'Black' },
    { value: '#ffffff', name: 'White' }
  ];

  // Initialize state based on selected annotations
  useEffect(() => {
    if (selectedAnnotations && selectedAnnotations.length === 1) {
      const annotation = annotations.find(a => a.id === selectedAnnotations[0]);
      if (annotation) {
        setSelectedColor(annotation.color || '#ff0000');
        setSelectedText(annotation.text || '');
      }
    } else if (selectedAnnotations && selectedAnnotations.length > 1) {
      // Multiple selection - check if all have same color
      const selectedAnns = annotations.filter(a => selectedAnnotations.includes(a.id));
      const colors = selectedAnns.map(a => a.color);
      const uniqueColors = [...new Set(colors)];
      if (uniqueColors.length === 1) {
        setSelectedColor(uniqueColors[0] || '#ff0000');
      }
      setSelectedText(''); // Clear text for multiple selection
    }
  }, [selectedAnnotations, annotations]);

  const handleColorChange = (color: string) => {
    setSelectedColor(color);
    if (selectedAnnotations) {
      selectedAnnotations.forEach(annotationId => {
        onUpdateAnnotation(annotationId, { color });
      });
    }
  };

  const handleTextChange = (text: string) => {
    setSelectedText(text);
    if (selectedAnnotations && selectedAnnotations.length === 1) {
      onUpdateAnnotation(selectedAnnotations[0], { text });
    }
  };

  const hasTextAnnotations = () => {
    if (!selectedAnnotations) return false;
    const selectedAnns = annotations.filter(a => selectedAnnotations.includes(a.id));
    return selectedAnns.some(a => a.type === 'text');
  };

  if (!selectedAnnotations || selectedAnnotations.length === 0) {
    return null;
  }

  return (
    <div className="absolute top-4 right-4 w-64 bg-white border border-gray-300 rounded-lg shadow-lg p-4 z-50">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-gray-800">
          {selectedAnnotations && selectedAnnotations.length === 1 ? 'Edit Annotation' : `Edit ${selectedAnnotations?.length || 0} Annotations`}
        </h3>
        <button
          onClick={onClose}
          className="p-1 hover:bg-gray-100 rounded"
          title="Close"
        >
          <X className="w-4 h-4 text-gray-500" />
        </button>
      </div>

      {/* Color Picker */}
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-2">
          <Palette className="w-4 h-4 text-gray-600" />
          <span className="text-sm text-gray-700">Color</span>
        </div>
        <div className="grid grid-cols-5 gap-1">
          {colorOptions.map((color) => (
            <button
              key={color.value}
              onClick={() => handleColorChange(color.value)}
              className={`w-8 h-8 rounded border-2 ${
                selectedColor === color.value 
                  ? 'border-gray-800 border-4' 
                  : 'border-gray-300'
              }`}
              style={{ backgroundColor: color.value }}
              title={color.name}
            >
              {selectedColor === color.value && (
                <Check className="w-4 h-4 text-white mx-auto" style={{
                  filter: color.value === '#ffffff' ? 'invert(1)' : 'none'
                }} />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Text Editor (only for text annotations and single selection) */}
      {hasTextAnnotations() && selectedAnnotations && selectedAnnotations.length === 1 && (
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <Type className="w-4 h-4 text-gray-600" />
            <span className="text-sm text-gray-700">Text</span>
          </div>
          {isEditingText ? (
            <div className="space-y-2">
              <textarea
                value={selectedText}
                onChange={(e) => setSelectedText(e.target.value)}
                className="w-full h-20 p-2 text-sm border border-gray-300 rounded resize-none focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="Enter text..."
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    handleTextChange(selectedText);
                    setIsEditingText(false);
                  }}
                  className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Save
                </button>
                <button
                  onClick={() => {
                    setIsEditingText(false);
                    // Revert text to original
                    const annotation = annotations.find(a => a.id === selectedAnnotations[0]);
                    if (annotation) {
                      setSelectedText(annotation.text || '');
                    }
                  }}
                  className="px-3 py-1 text-xs bg-gray-500 text-white rounded hover:bg-gray-600"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div
              onClick={() => setIsEditingText(true)}
              className="p-2 border border-gray-300 rounded bg-gray-50 min-h-[40px] cursor-text hover:bg-gray-100"
            >
              <span className="text-sm text-gray-800">
                {selectedText || 'Click to edit text...'}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Info for multiple selection */}
      {selectedAnnotations && selectedAnnotations.length > 1 && (
        <div className="text-xs text-gray-500 mt-2">
          Color changes will be applied to all selected annotations.
          {hasTextAnnotations() && ' Select a single text annotation to edit text.'}
        </div>
      )}
    </div>
  );
}