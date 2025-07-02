import React, { useRef, useEffect, useState } from 'react';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { useApp } from '../context/AppContext';
import { debugLogger } from '../utils/debug-logger';

export function Canvas() {
  const { screenshots, currentScreenshot, setCurrentScreenshot, drawingState, updateDrawingState, addAnnotation } = useApp();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState({ x: 0, y: 0 });
  const [canvasScale, setCanvasScale] = useState(1);
  const [imageOffset, setImageOffset] = useState({ x: 0, y: 0 });
  const [isCanvasReady, setIsCanvasReady] = useState(false);
  const [setupInProgress, setSetupInProgress] = useState(false);
  const [showTextInput, setShowTextInput] = useState(false);
  const [textInputPosition, setTextInputPosition] = useState({ x: 0, y: 0 });
  const [pendingTextCoords, setPendingTextCoords] = useState<{ x: number; y: number } | null>(null);

  // Setup canvas when component mounts or current screenshot changes
  useEffect(() => {
    const canvas = canvasRef.current;
    const image = imageRef.current;
    
    // Reset states only if screenshot actually changed
    setIsCanvasReady(false);
    
    if (!canvas || !image || !currentScreenshot) {
      setSetupInProgress(false);
      return;
    }
    
    // Prevent multiple simultaneous setups
    if (setupInProgress) {
      return;
    }
    
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.error('Failed to get canvas context');
      return;
    }
    
    let timeoutId: NodeJS.Timeout;
    let resizeTimeoutId: NodeJS.Timeout;
    let retryTimeoutId: NodeJS.Timeout;
    let imageLoadRetryTimeoutId: NodeJS.Timeout;
    
    // Setup canvas when image is loaded
    const handleImageLoad = () => {
      // Small delay to ensure DOM is updated
      timeoutId = setTimeout(() => {
        setupCanvas();
      }, 50);
    };
    
    const setupCanvas = () => {
      try {
        setSetupInProgress(true);
        
        // Get canvas context first
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          console.error('Failed to get canvas context');
          setSetupInProgress(false);
          return;
        }
        
        // Wait for image to be loaded and properly displayed
        const imageRect = image.getBoundingClientRect();
        
        if (imageRect.width === 0 || imageRect.height === 0) {
          setSetupInProgress(false);
          // Retry after a short delay - now tracked for cleanup
          retryTimeoutId = setTimeout(() => {
            if (!setupInProgress) {
              setupCanvas();
            }
          }, 100);
          return;
        }
        
        // Get the container rect to calculate image position within it
        const containerRect = image.parentElement!.getBoundingClientRect();
        
        // Calculate the actual image position relative to its container
        const imageOffsetX = imageRect.left - containerRect.left;
        const imageOffsetY = imageRect.top - containerRect.top;
        
        const displayWidth = imageRect.width;
        const displayHeight = imageRect.height;
        
        // Set canvas size to match the displayed image exactly
        canvas.width = Math.floor(displayWidth);
        canvas.height = Math.floor(displayHeight);
        canvas.style.width = `${displayWidth}px`;
        canvas.style.height = `${displayHeight}px`;
        
        // Position canvas to perfectly overlay the image
        canvas.style.left = `${imageOffsetX}px`;
        canvas.style.top = `${imageOffsetY}px`;
        
        // Calculate scale factor for coordinate transformation
        const scaleX = displayWidth / currentScreenshot.dimensions.width;
        const scaleY = displayHeight / currentScreenshot.dimensions.height;
        const scale = Math.min(scaleX, scaleY);
        
        // Set up drawing properties (simplified - no high-DPI scaling)
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.imageSmoothingEnabled = true;
        
        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Update state with canvas positioning
        setCanvasScale(scale);
        setImageOffset({ x: imageOffsetX, y: imageOffsetY }); // Store actual image offset
        setIsCanvasReady(true);
        setSetupInProgress(false);
        
        // Canvas setup complete
      } catch (error) {
        console.error('❌ [CANVAS] Canvas setup failed:', error);
        setSetupInProgress(false);
        setIsCanvasReady(false);
      }
    };
    
    // Multiple strategies to ensure image is ready
    const trySetup = () => {
      if (image.complete && image.naturalWidth > 0) {
        handleImageLoad();
      } else {
        image.addEventListener('load', handleImageLoad);
        // Also try after a short delay in case the image loads quickly - now tracked for cleanup
        imageLoadRetryTimeoutId = setTimeout(() => {
          if (image.complete && image.naturalWidth > 0 && !isCanvasReady) {
            handleImageLoad();
          }
        }, 200);
      }
    };
    
    trySetup();
    
    // Handle resize with debouncing
    const handleResize = () => {
      if (resizeTimeoutId) {
        clearTimeout(resizeTimeoutId);
      }
      resizeTimeoutId = setTimeout(() => {
        // Only re-setup if canvas is currently ready (prevents setup during initial load)
        if (!setupInProgress && isCanvasReady && canvasRef.current && currentScreenshot) {
          setupCanvas();
        }
      }, 250);
    };
    
    window.addEventListener('resize', handleResize);
    
    return () => {
      // Clear all tracked timeouts to prevent leaks
      if (timeoutId) clearTimeout(timeoutId);
      if (resizeTimeoutId) clearTimeout(resizeTimeoutId);
      if (retryTimeoutId) clearTimeout(retryTimeoutId);
      if (imageLoadRetryTimeoutId) clearTimeout(imageLoadRetryTimeoutId);
      
      window.removeEventListener('resize', handleResize);
      if (image) {
        image.removeEventListener('load', handleImageLoad);
      }
      setSetupInProgress(false);
      setIsCanvasReady(false);
      
      console.log('🧹 [CANVAS] Cleaned up all timers and event listeners');
    };
  }, [currentScreenshot?.id]); // Only depend on screenshot ID to prevent loops

  // Render annotations when canvas is ready (debounced to prevent loops)
  useEffect(() => {
    if (!isCanvasReady || !canvasRef.current || !currentScreenshot) return;
    
    // Debounce rendering to prevent rapid re-triggers
    const timeoutId = setTimeout(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      try {
        // Clear and render annotations
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        renderAnnotations(ctx);
      } catch (error) {
        console.error('Error rendering annotations:', error);
      }
    }, 16); // ~60fps debouncing
    
    return () => clearTimeout(timeoutId);
  }, [isCanvasReady, currentScreenshot?.id, currentScreenshot?.annotations, canvasScale]); // Use annotations array reference instead of length

  // Simplified coordinate transformation helper functions
  const canvasToImageCoordinates = (canvasX: number, canvasY: number) => {
    // Convert canvas coordinates to original image coordinates (simplified)
    const imageX = canvasX / canvasScale;
    const imageY = canvasY / canvasScale;
    return { x: imageX, y: imageY };
  };
  
  const imageToCanvasCoordinates = (imageX: number, imageY: number) => {
    // Convert original image coordinates to canvas coordinates (simplified)
    const canvasX = imageX * canvasScale;
    const canvasY = imageY * canvasScale;
    return { x: canvasX, y: canvasY };
  };
  
  const mouseToCanvasCoordinates = (e: React.MouseEvent<HTMLCanvasElement>) => {
    // Convert mouse coordinates to canvas coordinates (now that canvas is positioned over image)
    const canvas = canvasRef.current;
    if (!canvas) {
      return { x: 0, y: 0 };
    }
    
    const rect = canvas.getBoundingClientRect();
    const canvasX = e.clientX - rect.left;
    const canvasY = e.clientY - rect.top;
    return { x: canvasX, y: canvasY };
  };

  // Render existing annotations on canvas
  const renderAnnotations = (ctx: CanvasRenderingContext2D) => {
    if (!currentScreenshot?.annotations) return;
    
    currentScreenshot.annotations.forEach(annotation => {
      ctx.strokeStyle = annotation.color;
      ctx.fillStyle = annotation.color;
      ctx.lineWidth = 2;
      
      // Simplified coordinate transformation for rendering
      const x = annotation.position.x * canvasScale;
      const y = annotation.position.y * canvasScale;
      const width = (annotation.position.width || 0) * canvasScale;
      const height = (annotation.position.height || 0) * canvasScale;
      
      switch (annotation.type) {
        case 'arrow':
          drawArrow(ctx, x, y, x + width, y + height);
          break;
        case 'rectangle':
          drawRectangle(ctx, x, y, x + width, y + height);
          break;
        case 'numbering':
          drawNumberingAnnotation(ctx, x, y, annotation.number || 1);
          break;
        case 'blur':
          drawBlurArea(ctx, x, y, width, height, annotation.blurIntensity || 10);
          break;
        case 'text':
          if (annotation.text) {
            ctx.font = '16px Arial';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';
            ctx.fillText(annotation.text, x, y);
          }
          break;
      }
    });
  };

  // Drawing functions
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || !isCanvasReady || !drawingState.selectedTool) {
      return;
    }
    
    try {
      const canvasCoords = mouseToCanvasCoordinates(e);
      
      // Handle tool-specific start behavior
      if (drawingState.selectedTool === 'numbering') {
        handleNumberingClick(canvasCoords);
        return;
      }
      
      if (drawingState.selectedTool === 'text') {
        handleTextClick(canvasCoords);
        return;
      }
      
      // For drag-based tools (arrow, rectangle, blur)
      setIsDrawing(true);
      setStartPoint(canvasCoords);
      updateDrawingState({ isDrawing: true });
    } catch (error) {
      console.error('Error starting drawing:', error);
    }
  };

  // Tool-specific click handlers
  const handleNumberingClick = (canvasCoords: { x: number; y: number }) => {
    try {
      const imageCoords = canvasToImageCoordinates(canvasCoords.x, canvasCoords.y);
      
      const annotation = {
        id: `annotation-${Date.now()}`,
        type: 'numbering' as const,
        color: drawingState.selectedColor,
        position: {
          x: imageCoords.x,
          y: imageCoords.y,
          width: 0,
          height: 0
        },
        number: drawingState.numberingCounter
      };
      
      addAnnotation(annotation);
      updateDrawingState({ numberingCounter: drawingState.numberingCounter + 1 });
    } catch (error) {
      console.error('Error creating numbering annotation:', error);
    }
  };
  
  const handleTextClick = (canvasCoords: { x: number; y: number }) => {
    try {
      // Store the coordinates for when text is entered
      setPendingTextCoords(canvasCoords);
      
      // Convert canvas coordinates to viewport coordinates for modal positioning
      const canvas = canvasRef.current;
      if (canvas) {
        const canvasRect = canvas.getBoundingClientRect();
        const viewportX = canvasRect.left + canvasCoords.x;
        const viewportY = canvasRect.top + canvasCoords.y;
        
        // Ensure modal doesn't go off-screen
        const modalWidth = 200; // minWidth from CSS
        const modalHeight = 60; // estimated height
        const maxX = window.innerWidth - modalWidth - 10;
        const maxY = window.innerHeight - modalHeight - 10;
        
        const adjustedX = Math.min(Math.max(10, viewportX), maxX);
        const adjustedY = Math.min(Math.max(10, viewportY), maxY);
        
        setTextInputPosition({ x: adjustedX, y: adjustedY });
        setShowTextInput(true);
        
        console.log('📝 [TEXT] Modal positioned at viewport coordinates:', { x: adjustedX, y: adjustedY });
      }
    } catch (error) {
      console.error('Error setting up text input:', error);
    }
  };
  
  const handleTextSubmit = (text: string) => {
    if (!pendingTextCoords || !text.trim()) {
      setShowTextInput(false);
      setPendingTextCoords(null);
      return;
    }
    
    try {
      const imageCoords = canvasToImageCoordinates(pendingTextCoords.x, pendingTextCoords.y);
      
      const annotation = {
        id: `annotation-${Date.now()}`,
        type: 'text' as const,
        color: drawingState.selectedColor,
        position: {
          x: imageCoords.x,
          y: imageCoords.y,
          width: 0,
          height: 0
        },
        text
      };
      
      addAnnotation(annotation);
    } catch (error) {
      console.error('Error creating text annotation:', error);
    } finally {
      setShowTextInput(false);
      setPendingTextCoords(null);
    }
  };
  
  const handleTextCancel = () => {
    setShowTextInput(false);
    setPendingTextCoords(null);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !canvasRef.current || !isCanvasReady) {
      return;
    }
    
    try {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        return;
      }
      
      const currentCoords = mouseToCanvasCoordinates(e);
      const currentX = currentCoords.x;
      const currentY = currentCoords.y;
      
      // Clear canvas and re-render everything
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Render existing annotations first
      renderAnnotations(ctx);
      
      // Draw current tool preview with proper styling
      ctx.save();
      ctx.strokeStyle = drawingState.selectedColor;
      ctx.fillStyle = drawingState.selectedColor;
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      // Only show preview for drag-based tools
      switch (drawingState.selectedTool) {
        case 'arrow':
          drawArrow(ctx, startPoint.x, startPoint.y, currentX, currentY);
          break;
        case 'rectangle':
          drawRectangle(ctx, startPoint.x, startPoint.y, currentX, currentY);
          break;
        case 'blur':
          drawBlurPreview(ctx, startPoint.x, startPoint.y, currentX, currentY);
          break;
      }
      
      ctx.restore();
    } catch (error) {
      console.error('Error during drawing:', error);
    }
  };

  const stopDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !canvasRef.current || !isCanvasReady) {
      return;
    }
    
    try {
      const endCoords = mouseToCanvasCoordinates(e);
      
      // Convert canvas coordinates back to original image coordinates
      const startImageCoords = canvasToImageCoordinates(startPoint.x, startPoint.y);
      const endImageCoords = canvasToImageCoordinates(endCoords.x, endCoords.y);
      
      // Calculate dimensions
      const width = endImageCoords.x - startImageCoords.x;
      const height = endImageCoords.y - startImageCoords.y;
      
      // Only create annotation if there's a meaningful drag
      const minDragDistance = 5;
      const dragDistance = Math.sqrt(Math.pow(endCoords.x - startPoint.x, 2) + Math.pow(endCoords.y - startPoint.y, 2));
      
      if (dragDistance < minDragDistance) {
        return;
      }
      
      // Create annotation for drag-based tools
      const annotation = {
        id: `annotation-${Date.now()}`,
        type: drawingState.selectedTool as 'arrow' | 'rectangle' | 'blur',
        color: drawingState.selectedColor,
        position: {
          x: startImageCoords.x,
          y: startImageCoords.y,
          width,
          height
        },
        ...(drawingState.selectedTool === 'blur' && { blurIntensity: drawingState.blurIntensity })
      };
      
      addAnnotation(annotation);
      
    } catch (error) {
      console.error('Error stopping drawing:', error);
    } finally {
      // Always clean up drawing state
      setIsDrawing(false);
      updateDrawingState({ isDrawing: false });
    }
  };

  const drawArrow = (ctx: CanvasRenderingContext2D, startX: number, startY: number, endX: number, endY: number) => {
    try {
      const headLength = 12;
      const headAngle = Math.PI / 6; // 30 degrees
      const angle = Math.atan2(endY - startY, endX - startX);
      
      // Draw line
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(endX, endY);
      ctx.stroke();
      
      // Draw filled arrowhead
      ctx.beginPath();
      ctx.moveTo(endX, endY);
      ctx.lineTo(
        endX - headLength * Math.cos(angle - headAngle),
        endY - headLength * Math.sin(angle - headAngle)
      );
      ctx.lineTo(
        endX - headLength * Math.cos(angle + headAngle),
        endY - headLength * Math.sin(angle + headAngle)
      );
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } catch (error) {
      console.error('Error drawing arrow:', error);
    }
  };

  const drawRectangle = (ctx: CanvasRenderingContext2D, startX: number, startY: number, endX: number, endY: number) => {
    try {
      ctx.beginPath();
      ctx.rect(startX, startY, endX - startX, endY - startY);
      ctx.stroke();
    } catch (error) {
      console.error('Error drawing rectangle:', error);
    }
  };

  const drawNumbering = (ctx: CanvasRenderingContext2D, x: number, y: number) => {
    try {
      const radius = 15;
      
      // Draw filled circle background
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, 2 * Math.PI);
      ctx.fill();
      
      // Draw circle border
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, 2 * Math.PI);
      ctx.stroke();
      
      // Draw number text in white for contrast
      ctx.save();
      ctx.fillStyle = 'white';
      ctx.font = 'bold 12px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(drawingState.numberingCounter.toString(), x, y);
      ctx.restore();
    } catch (error) {
      console.error('Error drawing numbering:', error);
    }
  };

  const drawNumberingAnnotation = (ctx: CanvasRenderingContext2D, x: number, y: number, number: number) => {
    try {
      const radius = 15;
      
      // Draw filled circle background
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, 2 * Math.PI);
      ctx.fill();
      
      // Draw circle border
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, 2 * Math.PI);
      ctx.stroke();
      
      // Draw number text in white for contrast
      ctx.save();
      ctx.fillStyle = 'white';
      ctx.font = 'bold 12px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(number.toString(), x, y);
      ctx.restore();
    } catch (error) {
      console.error('Error drawing numbering annotation:', error);
    }
  };

  const drawBlurPreview = (ctx: CanvasRenderingContext2D, startX: number, startY: number, endX: number, endY: number) => {
    try {
      const width = endX - startX;
      const height = endY - startY;
      
      // Only show preview if the area is large enough
      if (Math.abs(width) < 10 || Math.abs(height) < 10) {
        ctx.strokeStyle = '#666';
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.rect(startX, startY, width, height);
        ctx.stroke();
        ctx.setLineDash([]);
        return;
      }
      
      // Try to show a quick blur preview if image is available
      const image = imageRef.current;
      if (image && currentScreenshot) {
        try {
          // Create a small temporary canvas for preview
          const tempCanvas = document.createElement('canvas');
          const previewSize = 50; // Small size for performance
          tempCanvas.width = previewSize;
          tempCanvas.height = previewSize;
          const tempCtx = tempCanvas.getContext('2d');
          
          if (tempCtx) {
            // Calculate source coordinates
            const sourceX = Math.max(0, startX / canvasScale);
            const sourceY = Math.max(0, startY / canvasScale);
            const sourceWidth = Math.abs(width / canvasScale);
            const sourceHeight = Math.abs(height / canvasScale);
            
            // Draw a small portion for preview
            tempCtx.drawImage(
              image,
              sourceX, sourceY, sourceWidth, sourceHeight,
              0, 0, previewSize, previewSize
            );
            
            // Apply blur and draw preview
            ctx.save();
            ctx.filter = `blur(${Math.max(1, drawingState.blurIntensity / 2)}px)`;
            ctx.globalAlpha = 0.7;
            ctx.drawImage(tempCanvas, startX, startY, width, height);
            ctx.filter = 'none';
            ctx.globalAlpha = 1;
            ctx.restore();
          }
        } catch (error) {
          // Fallback to simple border on error
          console.warn('Blur preview failed, using simple border:', error);
        }
      }
      
      // Draw border
      ctx.strokeStyle = 'rgba(255, 107, 107, 0.8)';
      ctx.setLineDash([5, 5]);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.rect(startX, startY, width, height);
      ctx.stroke();
      ctx.setLineDash([]);
      
      // Add text label
      ctx.fillStyle = 'rgba(255, 107, 107, 0.9)';
      ctx.font = '12px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const centerX = startX + width / 2;
      const centerY = startY + height / 2;
      ctx.fillText(`Blur ${drawingState.blurIntensity}px`, centerX, centerY);
    } catch (error) {
      console.error('Error drawing blur preview:', error);
    }
  };

  const drawBlurArea = (ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, intensity: number) => {
    try {
      ctx.save();
      
      // Get the image element to draw the original image portion
      const image = imageRef.current;
      if (!image || !currentScreenshot) {
        // Fallback to text indicator if image not available
        ctx.strokeStyle = '#ff6b6b';
        ctx.setLineDash([5, 5]);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.rect(x, y, width, height);
        ctx.stroke();
        ctx.setLineDash([]);
        
        ctx.fillStyle = '#ff6b6b';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const centerX = x + width / 2;
        const centerY = y + height / 2;
        ctx.fillText(`Blur ${intensity}px`, centerX, centerY);
        ctx.restore();
        return;
      }
      
      // Create a temporary canvas for the blur effect
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = Math.abs(width);
      tempCanvas.height = Math.abs(height);
      const tempCtx = tempCanvas.getContext('2d');
      
      if (!tempCtx) {
        ctx.restore();
        return;
      }
      
      // Calculate source coordinates on the original image
      const sourceX = Math.max(0, x / canvasScale);
      const sourceY = Math.max(0, y / canvasScale);
      const sourceWidth = Math.abs(width / canvasScale);
      const sourceHeight = Math.abs(height / canvasScale);
      
      // Draw the portion of the original image to the temporary canvas
      tempCtx.drawImage(
        image,
        sourceX, sourceY, sourceWidth, sourceHeight,
        0, 0, tempCanvas.width, tempCanvas.height
      );
      
      // Apply blur filter and draw the blurred image back to main canvas
      ctx.filter = `blur(${Math.max(1, intensity)}px)`;
      ctx.drawImage(tempCanvas, x, y, width, height);
      ctx.filter = 'none';
      
      // Draw a subtle border to indicate the blur area
      ctx.strokeStyle = 'rgba(255, 107, 107, 0.6)';
      ctx.setLineDash([3, 3]);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.rect(x, y, width, height);
      ctx.stroke();
      ctx.setLineDash([]);
      
      ctx.restore();
    } catch (error) {
      console.error('Error drawing blur area:', error);
      // Fallback to simple border on error
      ctx.save();
      ctx.strokeStyle = '#ff6b6b';
      ctx.setLineDash([5, 5]);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.rect(x, y, width, height);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }
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
          <div ref={containerRef} className="h-full flex items-center justify-center p-8">
            <div className="bg-white rounded shadow-lg overflow-hidden max-w-4xl max-h-full relative">
              {/* Main image display */}
              <img
                ref={imageRef}
                src={`data:image/png;base64,${currentScreenshot.base64Image}`}
                alt={currentScreenshot.name}
                className="max-w-full max-h-full object-contain block"
              />
              {/* Canvas overlay for drawing annotations */}
              <canvas
                ref={canvasRef}
                className="absolute top-0 left-0"
                style={{
                  pointerEvents: drawingState.selectedTool ? 'auto' : 'none',
                  cursor: drawingState.selectedTool ? (
                    drawingState.selectedTool === 'text' ? 'text' :
                    drawingState.selectedTool === 'numbering' ? 'pointer' :
                    'crosshair'
                  ) : 'default'
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
      
      {/* Text Input Modal */}
      {showTextInput && (
        <div 
          className="absolute z-50 bg-white border border-gray-300 rounded shadow-lg p-2"
          style={{
            left: `${textInputPosition.x}px`,
            top: `${textInputPosition.y}px`,
            minWidth: '200px'
          }}
        >
          <input
            type="text"
            placeholder="Enter text..."
            className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:border-blue-500"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleTextSubmit(e.currentTarget.value);
              } else if (e.key === 'Escape') {
                handleTextCancel();
              }
            }}
            onBlur={(e) => {
              // Only submit if there's text, otherwise cancel
              if (e.currentTarget.value.trim()) {
                handleTextSubmit(e.currentTarget.value);
              } else {
                handleTextCancel();
              }
            }}
          />
          <div className="text-xs text-gray-500 mt-1">
            Press Enter to add, Escape to cancel
          </div>
        </div>
      )}
    </div>
  );
}