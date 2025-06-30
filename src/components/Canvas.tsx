import React, { useRef, useEffect, useState } from 'react';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { useApp } from '../context/AppContext';

export function Canvas() {
  const { screenshots, currentScreenshot, setCurrentScreenshot, drawingState, updateDrawingState, addAnnotation } = useApp();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState({ x: 0, y: 0 });
  

  // Setup canvas when component mounts or current screenshot changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Set up canvas properties
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, [currentScreenshot]);


  // Drawing functions
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    setIsDrawing(true);
    setStartPoint({ x, y });
    updateDrawingState({ isDrawing: true });
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const rect = canvas.getBoundingClientRect();
    const currentX = e.clientX - rect.left;
    const currentY = e.clientY - rect.top;
    
    // Clear canvas and redraw
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = drawingState.selectedColor;
    ctx.lineWidth = 2;
    
    switch (drawingState.selectedTool) {
      case 'arrow':
        drawArrow(ctx, startPoint.x, startPoint.y, currentX, currentY);
        break;
      case 'rectangle':
        drawRectangle(ctx, startPoint.x, startPoint.y, currentX, currentY);
        break;
      case 'text':
        // Text tool will be handled differently
        break;
      case 'numbering':
        drawNumbering(ctx, currentX, currentY);
        break;
    }
  };

  const stopDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !canvasRef.current) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const endX = e.clientX - rect.left;
    const endY = e.clientY - rect.top;
    
    // Create annotation
    const annotation = {
      id: `annotation-${Date.now()}`,
      type: drawingState.selectedTool,
      color: drawingState.selectedColor,
      position: {
        x: startPoint.x,
        y: startPoint.y,
        width: endX - startPoint.x,
        height: endY - startPoint.y
      }
    };
    
    addAnnotation(annotation);
    setIsDrawing(false);
    updateDrawingState({ isDrawing: false });
  };

  const drawArrow = (ctx: CanvasRenderingContext2D, startX: number, startY: number, endX: number, endY: number) => {
    const headLength = 10;
    const angle = Math.atan2(endY - startY, endX - startX);
    
    // Draw line
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(endX, endY);
    ctx.stroke();
    
    // Draw arrowhead
    ctx.beginPath();
    ctx.moveTo(endX, endY);
    ctx.lineTo(endX - headLength * Math.cos(angle - Math.PI / 6),
               endY - headLength * Math.sin(angle - Math.PI / 6));
    ctx.moveTo(endX, endY);
    ctx.lineTo(endX - headLength * Math.cos(angle + Math.PI / 6),
               endY - headLength * Math.sin(angle + Math.PI / 6));
    ctx.stroke();
  };

  const drawRectangle = (ctx: CanvasRenderingContext2D, startX: number, startY: number, endX: number, endY: number) => {
    ctx.beginPath();
    ctx.rect(startX, startY, endX - startX, endY - startY);
    ctx.stroke();
  };

  const drawNumbering = (ctx: CanvasRenderingContext2D, x: number, y: number) => {
    const radius = 15;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, 2 * Math.PI);
    ctx.stroke();
    
    ctx.fillStyle = drawingState.selectedColor;
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('1', x, y);
  };

  return (
    <div className="flex-1 bg-gray-300 relative flex flex-col">

      {/* Canvas Content */}
      <div className="flex-1 relative overflow-hidden">
        {/* Empty state when no screenshots */}
        {!currentScreenshot && (
          <div className="h-full flex items-center justify-center p-8">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-700 mb-4">Welcome to ScreenshotOS</h2>
              <p className="text-gray-600 mb-6">Capture and manage your screenshots with powerful annotation tools</p>
              <div className="space-y-2 text-sm text-gray-500">
                <p>• Click "Full Screen" to capture your entire screen</p>
                <p>• Click "Area" to capture a specific region</p>
                <p>• Use the toolbar to annotate your screenshots</p>
                <p>• Organize with tags and notes</p>
              </div>
            </div>
          </div>
        )}

        {/* Display current screenshot */}
        {currentScreenshot && (
          <div className="h-full flex items-center justify-center p-8">
            <div className="bg-white rounded shadow-lg overflow-hidden max-w-4xl max-h-full relative">
              <img
                src={`data:image/png;base64,${currentScreenshot.base64Image}`}
                alt={currentScreenshot.name}
                className="max-w-full max-h-full object-contain"
              />
              {/* Canvas overlay for drawing */}
              <canvas
                ref={canvasRef}
                className="absolute top-0 left-0 cursor-crosshair"
                width={currentScreenshot?.dimensions?.width || 800}
                height={currentScreenshot?.dimensions?.height || 600}
                style={{
                  width: '100%',
                  height: '100%',
                  pointerEvents: drawingState.selectedTool ? 'auto' : 'none'
                }}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
              />
            </div>
          </div>
        )}
      </div>

      {/* Search box in top right */}
      <div className="absolute top-16 right-4">
        <input
          type="text"
          placeholder="Type to search (Ctrl+F)"
          className="px-3 py-1 text-sm border border-gray-400 bg-white rounded w-48"
        />
      </div>
    </div>
  );
}