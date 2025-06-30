import React, { useState } from "react";
import {
  MousePointer,
  Square,
  Type,
  Hash,
  Palette,
} from "lucide-react";
import { useApp } from '../context/AppContext';

export function Toolbar() {
  const { drawingState, updateDrawingState } = useApp();
  const [showColorPicker, setShowColorPicker] = useState(false);

  const tools = [
    { id: "arrow", icon: MousePointer, label: "Arrow" },
    { id: "rectangle", icon: Square, label: "Rectangle" },
    { id: "text", icon: Type, label: "Text" },
    { id: "numbering", icon: Hash, label: "Numbering" },
  ] as const;

  const colors = [
    { id: "red", hex: "#dc2626", name: "Red" },
    { id: "blue", hex: "#2563eb", name: "Blue" },
    { id: "green", hex: "#16a34a", name: "Green" },
    { id: "yellow", hex: "#ca8a04", name: "Yellow" },
    { id: "purple", hex: "#9333ea", name: "Purple" },
    { id: "orange", hex: "#ea580c", name: "Orange" },
    { id: "pink", hex: "#db2777", name: "Pink" },
    { id: "black", hex: "#000000", name: "Black" },
  ];

  const handleToolSelect = (toolId: 'arrow' | 'rectangle' | 'text' | 'numbering') => {
    updateDrawingState({ selectedTool: toolId });
  };

  const handleColorSelect = (colorHex: string) => {
    updateDrawingState({ selectedColor: colorHex });
    setShowColorPicker(false);
  };

  const renderToolPreview = () => {
    switch (drawingState.selectedTool) {
      case "arrow":
        return (
          <div className="w-16 h-12 bg-gray-50 border border-gray-200 rounded flex items-center justify-center">
            <svg
              width="32"
              height="20"
              viewBox="0 0 32 20"
              className="stroke-current"
              style={{ color: drawingState.selectedColor }}
            >
              <defs>
                <marker
                  id="arrowhead"
                  markerWidth="6"
                  markerHeight="4"
                  refX="6"
                  refY="2"
                  orient="auto"
                  fill={drawingState.selectedColor}
                >
                  <polygon points="0 0, 6 2, 0 4" />
                </marker>
              </defs>
              <line
                x1="4"
                y1="10"
                x2="26"
                y2="10"
                strokeWidth="2"
                markerEnd="url(#arrowhead)"
              />
            </svg>
          </div>
        );
      case "rectangle":
        return (
          <div className="w-16 h-12 bg-gray-50 border border-gray-200 rounded flex items-center justify-center">
            <div
              className="w-10 h-6 border-2 rounded"
              style={{ borderColor: drawingState.selectedColor }}
            ></div>
          </div>
        );
      case "text":
        return (
          <div className="w-16 h-12 bg-gray-50 border border-gray-200 rounded flex items-center justify-center">
            <span
              className="text-sm font-medium"
              style={{ color: drawingState.selectedColor }}
            >
              Abc
            </span>
          </div>
        );
      case "numbering":
        return (
          <div className="w-16 h-12 bg-gray-50 border border-gray-200 rounded flex items-center justify-center">
            <div
              className="w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs"
              style={{
                borderColor: drawingState.selectedColor,
                color: drawingState.selectedColor,
              }}
            >
              1
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="bg-gray-100 border-b border-gray-300 px-4 py-2">
      <div className="flex items-center gap-4">
        {/* Main Tools */}
        <div className="flex items-center gap-2">
          {tools.map((tool) => {
            const IconComponent = tool.icon;
            const isSelected = drawingState.selectedTool === tool.id;

            return (
              <button
                key={tool.id}
                onClick={() => handleToolSelect(tool.id)}
                className={`p-2 rounded border transition-colors ${
                  isSelected
                    ? "bg-blue-100 border-blue-400 text-blue-700"
                    : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
                }`}
                title={tool.label}
              >
                <IconComponent className="w-5 h-5" />
              </button>
            );
          })}
        </div>

        {/* Separator */}
        <div className="w-px h-8 bg-gray-300"></div>

        {/* Color Picker */}
        <div className="relative">
          <button
            onClick={() => setShowColorPicker(!showColorPicker)}
            className="flex items-center gap-2 p-2 bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors"
            title="Color Picker"
          >
            <div
              className="w-5 h-5 rounded border border-gray-400"
              style={{ backgroundColor: drawingState.selectedColor }}
            ></div>
            <Palette className="w-4 h-4 text-gray-700" />
          </button>

          {/* Color Picker Dropdown */}
          {showColorPicker && (
            <div className="absolute top-full left-0 mt-1 p-2 bg-white border border-gray-300 rounded shadow-lg z-10">
              <div className="grid grid-cols-4 gap-1">
                {colors.map((color) => (
                  <button
                    key={color.id}
                    onClick={() => handleColorSelect(color.hex)}
                    className={`w-6 h-6 rounded border-2 transition-all hover:scale-110 ${
                      drawingState.selectedColor === color.hex
                        ? "border-gray-800 ring-2 ring-gray-300"
                        : "border-gray-300"
                    }`}
                    style={{ backgroundColor: color.hex }}
                    title={color.name}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Separator */}
        <div className="w-px h-8 bg-gray-300"></div>

        {/* Tool Preview */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">
            Preview:
          </span>
          {renderToolPreview()}
        </div>

        {/* Spacer */}
        <div className="flex-1"></div>

        {/* Tool Properties */}
        <div className="flex items-center gap-4 text-sm text-gray-600">
          <div className="flex items-center gap-2">
            <span>Tool:</span>
            <span className="font-medium capitalize">
              {drawingState.selectedTool}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span>Color:</span>
            <span className="font-medium">{drawingState.selectedColor}</span>
          </div>
        </div>
      </div>
    </div>
  );
}