import React, { useRef, useEffect, useState } from 'react';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { useApp } from '../context/AppContext';
import { debugLogger } from '../utils/debug-logger';
import { AnnotationPropertyEditor } from './AnnotationPropertyEditor';

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
  const [cursorStyle, setCursorStyle] = useState('default');

  // Keyboard event handler for delete functionality
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle delete when in select mode and annotations are selected
      if (drawingState.selectedTool === 'select' && drawingState.selectedAnnotations.length > 0) {
        if (e.key === 'Delete' || e.key === 'Backspace') {
          e.preventDefault();
          handleDeleteSelectedAnnotations();
        }
      }
    };

    // Add event listener to window to capture keyboard events
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [drawingState.selectedTool, drawingState.selectedAnnotations]);

  // Delete selected annotations
  const handleDeleteSelectedAnnotations = async () => {
    if (!currentScreenshot?.annotations || drawingState.selectedAnnotations.length === 0) {
      return;
    }

    try {
      // Filter out selected annotations
      const updatedAnnotations = currentScreenshot.annotations.filter(
        annotation => !drawingState.selectedAnnotations.includes(annotation.id)
      );

      // Update the screenshot data
      const updatedScreenshot = {
        ...currentScreenshot,
        annotations: updatedAnnotations
      };

      setCurrentScreenshot(updatedScreenshot);

      // Save to sidecar file
      try {
        await window.electron.invoke('sidecar-update', currentScreenshot.filePath, {
          annotations: updatedAnnotations
        });
        console.log('✅ [ANNOTATIONS] Successfully deleted annotations from sidecar file');
      } catch (error) {
        console.error('❌ [ANNOTATIONS] Failed to delete annotations from sidecar file:', error);
      }

      // Clear selection
      updateDrawingState({
        selectedAnnotations: [],
        isDragging: false,
        dragStartPoint: null
      });

      console.log(`🗑️ [ANNOTATIONS] Deleted ${drawingState.selectedAnnotations.length} annotation(s)`);
    } catch (error) {
      console.error('Error deleting annotations:', error);
    }
  };

  // Update annotation properties
  const handleUpdateAnnotation = async (annotationId: string, updates: any) => {
    if (!currentScreenshot?.annotations) {
      return;
    }

    try {
      // Update the annotation with new properties
      const updatedAnnotations = currentScreenshot.annotations.map(annotation => {
        if (annotation.id === annotationId) {
          return {
            ...annotation,
            ...updates
          };
        }
        return annotation;
      });

      // Update the screenshot data
      const updatedScreenshot = {
        ...currentScreenshot,
        annotations: updatedAnnotations
      };

      setCurrentScreenshot(updatedScreenshot);

      // Save to sidecar file
      try {
        await window.electron.invoke('sidecar-update', currentScreenshot.filePath, {
          annotations: updatedAnnotations
        });
        console.log('✅ [ANNOTATIONS] Successfully updated annotation properties in sidecar file');
      } catch (error) {
        console.error('❌ [ANNOTATIONS] Failed to save annotation properties to sidecar file:', error);
      }

      console.log(`🎨 [ANNOTATIONS] Updated annotation ${annotationId} with properties:`, updates);
    } catch (error) {
      console.error('Error updating annotation:', error);
    }
  };

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
  }, [isCanvasReady, currentScreenshot?.id, currentScreenshot?.annotations, canvasScale, drawingState.selectedAnnotations]); // Include selectedAnnotations for selection highlighting

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

  // Hit-testing function to check if a point is inside an annotation
  const hitTestAnnotation = (annotation: any, canvasX: number, canvasY: number): boolean => {
    const imageCoords = canvasToImageCoordinates(canvasX, canvasY);
    const x = imageCoords.x;
    const y = imageCoords.y;

    switch (annotation.type) {
      case 'rectangle':
      case 'blur':
        const left = Math.min(annotation.position.x, annotation.position.x + (annotation.position.width || 0));
        const right = Math.max(annotation.position.x, annotation.position.x + (annotation.position.width || 0));
        const top = Math.min(annotation.position.y, annotation.position.y + (annotation.position.height || 0));
        const bottom = Math.max(annotation.position.y, annotation.position.y + (annotation.position.height || 0));
        return x >= left && x <= right && y >= top && y <= bottom;
      
      case 'arrow':
        // For arrows, check if point is near the line (within 10px tolerance)
        const tolerance = 10 / canvasScale;
        const startX = annotation.position.x;
        const startY = annotation.position.y;
        const endX = annotation.position.x + (annotation.position.width || 0);
        const endY = annotation.position.y + (annotation.position.height || 0);
        
        // Distance from point to line segment
        const A = x - startX;
        const B = y - startY;
        const C = endX - startX;
        const D = endY - startY;
        
        const dot = A * C + B * D;
        const lenSq = C * C + D * D;
        let param = -1;
        if (lenSq !== 0) param = dot / lenSq;
        
        let xx, yy;
        if (param < 0) {
          xx = startX;
          yy = startY;
        } else if (param > 1) {
          xx = endX;
          yy = endY;
        } else {
          xx = startX + param * C;
          yy = startY + param * D;
        }
        
        const dx = x - xx;
        const dy = y - yy;
        const distance = Math.sqrt(dx * dx + dy * dy);
        return distance <= tolerance;
      
      case 'text':
      case 'numbering':
        // For text and numbering, check if point is within a small radius
        const radius = 20 / canvasScale;
        const textDx = x - annotation.position.x;
        const textDy = y - annotation.position.y;
        return Math.sqrt(textDx * textDx + textDy * textDy) <= radius;
      
      default:
        return false;
    }
  };

  // Find the topmost annotation at a given point
  const findAnnotationAtPoint = (canvasX: number, canvasY: number): any | null => {
    if (!currentScreenshot?.annotations) return null;
    
    // Check annotations in reverse order (topmost first)
    for (let i = currentScreenshot.annotations.length - 1; i >= 0; i--) {
      const annotation = currentScreenshot.annotations[i];
      if (hitTestAnnotation(annotation, canvasX, canvasY)) {
        return annotation;
      }
    }
    return null;
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
    if (!currentScreenshot?.annotations) {
      console.log('🎨 [RENDER] No annotations to render for current screenshot');
      return;
    }
    
    console.log(`🎨 [RENDER] Rendering ${currentScreenshot.annotations.length} annotations for screenshot: ${currentScreenshot.name}`);
    
    currentScreenshot.annotations.forEach(annotation => {
      const isSelected = drawingState.selectedAnnotations.includes(annotation.id);
      
      ctx.strokeStyle = annotation.color;
      ctx.fillStyle = annotation.color;
      ctx.lineWidth = 2;
      
      // Simplified coordinate transformation for rendering
      const x = annotation.position.x * canvasScale;
      const y = annotation.position.y * canvasScale;
      const width = (annotation.position.width || 0) * canvasScale;
      const height = (annotation.position.height || 0) * canvasScale;
      
      // Render the annotation
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
      
      // Render selection indicators
      if (isSelected) {
        renderSelectionIndicators(ctx, annotation, x, y, width, height);
      }
    });
  };

  // Render selection indicators (border and resize handles)
  const renderSelectionIndicators = (ctx: CanvasRenderingContext2D, annotation: any, x: number, y: number, width: number, height: number) => {
    ctx.save();
    
    // Selection border
    ctx.strokeStyle = '#2563eb'; // Blue color
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 2;
    
    let bounds = { left: x, top: y, right: x + width, bottom: y + height };
    
    // Calculate bounds based on annotation type
    switch (annotation.type) {
      case 'rectangle':
      case 'blur':
        bounds = {
          left: Math.min(x, x + width),
          right: Math.max(x, x + width),
          top: Math.min(y, y + height),
          bottom: Math.max(y, y + height)
        };
        break;
      case 'arrow':
        const padding = 10;
        bounds = {
          left: Math.min(x, x + width) - padding,
          right: Math.max(x, x + width) + padding,
          top: Math.min(y, y + height) - padding,
          bottom: Math.max(y, y + height) + padding
        };
        break;
      case 'text':
      case 'numbering':
        const radius = 25;
        bounds = {
          left: x - radius,
          right: x + radius,
          top: y - radius,
          bottom: y + radius
        };
        break;
    }
    
    // Draw selection border
    ctx.beginPath();
    ctx.rect(bounds.left, bounds.top, bounds.right - bounds.left, bounds.bottom - bounds.top);
    ctx.stroke();
    
    // Draw resize handles for rectangle and blur annotations
    if (annotation.type === 'rectangle' || annotation.type === 'blur') {
      const handleSize = 8;
      ctx.fillStyle = '#2563eb';
      ctx.setLineDash([]);
      
      // Corner handles
      const handles = [
        { x: bounds.left, y: bounds.top }, // Top-left
        { x: bounds.right, y: bounds.top }, // Top-right
        { x: bounds.left, y: bounds.bottom }, // Bottom-left
        { x: bounds.right, y: bounds.bottom }, // Bottom-right
        { x: (bounds.left + bounds.right) / 2, y: bounds.top }, // Top-center
        { x: (bounds.left + bounds.right) / 2, y: bounds.bottom }, // Bottom-center
        { x: bounds.left, y: (bounds.top + bounds.bottom) / 2 }, // Left-center
        { x: bounds.right, y: (bounds.top + bounds.bottom) / 2 }, // Right-center
      ];
      
      handles.forEach(handle => {
        ctx.fillRect(handle.x - handleSize/2, handle.y - handleSize/2, handleSize, handleSize);
        ctx.strokeRect(handle.x - handleSize/2, handle.y - handleSize/2, handleSize, handleSize);
      });
    }
    
    ctx.restore();
  };

  // Drawing functions
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || !isCanvasReady || !drawingState.selectedTool) {
      return;
    }
    
    try {
      const canvasCoords = mouseToCanvasCoordinates(e);
      
      // Handle selection tool
      if (drawingState.selectedTool === 'select') {
        handleSelectionClick(canvasCoords, e);
        return;
      }
      
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

  // Check if click is on a resize handle
  const getResizeHandle = (annotation: any, canvasX: number, canvasY: number): string | null => {
    if (annotation.type !== 'rectangle' && annotation.type !== 'blur') {
      return null;
    }
    
    const imageCoords = canvasToImageCoordinates(canvasX, canvasY);
    const canvasPos = imageToCanvasCoordinates(annotation.position.x, annotation.position.y);
    const width = (annotation.position.width || 0) * canvasScale;
    const height = (annotation.position.height || 0) * canvasScale;
    
    const bounds = {
      left: Math.min(canvasPos.x, canvasPos.x + width),
      right: Math.max(canvasPos.x, canvasPos.x + width),
      top: Math.min(canvasPos.y, canvasPos.y + height),
      bottom: Math.max(canvasPos.y, canvasPos.y + height)
    };
    
    const handleSize = 8;
    const tolerance = handleSize / 2 + 2; // A bit of extra tolerance for easier clicking
    
    // Check each resize handle
    const handles = [
      { x: bounds.left, y: bounds.top, type: 'nw' }, // Top-left
      { x: bounds.right, y: bounds.top, type: 'ne' }, // Top-right
      { x: bounds.left, y: bounds.bottom, type: 'sw' }, // Bottom-left
      { x: bounds.right, y: bounds.bottom, type: 'se' }, // Bottom-right
      { x: (bounds.left + bounds.right) / 2, y: bounds.top, type: 'n' }, // Top-center
      { x: (bounds.left + bounds.right) / 2, y: bounds.bottom, type: 's' }, // Bottom-center
      { x: bounds.left, y: (bounds.top + bounds.bottom) / 2, type: 'w' }, // Left-center
      { x: bounds.right, y: (bounds.top + bounds.bottom) / 2, type: 'e' }, // Right-center
    ];
    
    for (const handle of handles) {
      const distance = Math.sqrt(Math.pow(canvasX - handle.x, 2) + Math.pow(canvasY - handle.y, 2));
      if (distance <= tolerance) {
        return handle.type;
      }
    }
    
    return null;
  };

  // Get cursor style for resize handles
  const getResizeCursor = (handleType: string): string => {
    switch (handleType) {
      case 'nw':
      case 'se':
        return 'nw-resize';
      case 'ne':
      case 'sw':
        return 'ne-resize';
      case 'n':
      case 's':
        return 'ns-resize';
      case 'w':
      case 'e':
        return 'ew-resize';
      default:
        return 'default';
    }
  };

  // Handle mouse move for cursor feedback
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || !isCanvasReady) {
      return;
    }

    // Handle drawing first
    draw(e);

    // Update cursor based on context
    if (drawingState.selectedTool === 'select' && drawingState.selectedAnnotations.length > 0) {
      const canvasCoords = mouseToCanvasCoordinates(e);
      
      // Check if hovering over a resize handle
      for (const annotationId of drawingState.selectedAnnotations) {
        const annotation = currentScreenshot?.annotations?.find(a => a.id === annotationId);
        if (annotation) {
          const resizeHandle = getResizeHandle(annotation, canvasCoords.x, canvasCoords.y);
          if (resizeHandle) {
            setCursorStyle(getResizeCursor(resizeHandle));
            return;
          }
        }
      }
      
      // Check if hovering over selected annotation (for dragging)
      const hoveredAnnotation = findAnnotationAtPoint(canvasCoords.x, canvasCoords.y);
      if (hoveredAnnotation && drawingState.selectedAnnotations.includes(hoveredAnnotation.id)) {
        setCursorStyle('move');
        return;
      }
    }

    // Default cursor
    if (drawingState.selectedTool === 'select') {
      setCursorStyle('default');
    } else if (drawingState.selectedTool === 'text') {
      setCursorStyle('text');
    } else if (drawingState.selectedTool === 'numbering') {
      setCursorStyle('pointer');
    } else {
      setCursorStyle('crosshair');
    }
  };

  // Selection click handler
  const handleSelectionClick = (canvasCoords: { x: number; y: number }, e: React.MouseEvent<HTMLCanvasElement>) => {
    try {
      const clickedAnnotation = findAnnotationAtPoint(canvasCoords.x, canvasCoords.y);
      const isMultiSelect = e.ctrlKey || e.metaKey; // Ctrl on Windows/Linux, Cmd on Mac
      
      if (clickedAnnotation) {
        // Check if we're clicking on a resize handle of a selected annotation
        if (drawingState.selectedAnnotations.includes(clickedAnnotation.id)) {
          const resizeHandle = getResizeHandle(clickedAnnotation, canvasCoords.x, canvasCoords.y);
          if (resizeHandle) {
            // Start resizing
            updateDrawingState({
              isResizing: true,
              resizeHandle: resizeHandle,
              dragStartPoint: canvasCoords
            });
            setIsDrawing(false);
            setStartPoint(canvasCoords);
            return;
          }
        }
        
        let newSelection: string[];
        
        if (isMultiSelect) {
          // Multi-select: toggle the clicked annotation
          if (drawingState.selectedAnnotations.includes(clickedAnnotation.id)) {
            newSelection = drawingState.selectedAnnotations.filter(id => id !== clickedAnnotation.id);
          } else {
            newSelection = [...drawingState.selectedAnnotations, clickedAnnotation.id];
          }
        } else {
          // Single select: select only the clicked annotation
          newSelection = [clickedAnnotation.id];
        }
        
        updateDrawingState({
          selectedAnnotations: newSelection,
          isDragging: false, // Don't start dragging on click, only on mouse move
          dragStartPoint: canvasCoords,
          isResizing: false,
          resizeHandle: null
        });
        
        console.log(`🖱️ [SELECTION] Selected annotation(s):`, newSelection);
        
        setIsDrawing(true); // Set to true so we can detect drag start
        setStartPoint(canvasCoords);
      } else {
        // Clicked on empty area - clear selection unless multi-selecting
        if (!isMultiSelect) {
          updateDrawingState({
            selectedAnnotations: [],
            isDragging: false,
            dragStartPoint: null,
            isResizing: false,
            resizeHandle: null
          });
        }
      }
    } catch (error) {
      console.error('Error handling selection click:', error);
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
    if (!canvasRef.current || !isCanvasReady) {
      return;
    }

    // Handle dragging or resizing selected annotations in select mode
    if (drawingState.selectedTool === 'select' && (drawingState.isDragging || drawingState.isResizing) && drawingState.dragStartPoint) {
      handleAnnotationDrag(e);
      return;
    }
    
    // Check if we should start dragging selected annotations
    if (drawingState.selectedTool === 'select' && 
        drawingState.selectedAnnotations.length > 0 && 
        drawingState.dragStartPoint && 
        !drawingState.isDragging && 
        !drawingState.isResizing && 
        isDrawing) {
      
      const currentCoords = mouseToCanvasCoordinates(e);
      const deltaX = Math.abs(currentCoords.x - drawingState.dragStartPoint.x);
      const deltaY = Math.abs(currentCoords.y - drawingState.dragStartPoint.y);
      
      // Start dragging if mouse moved more than 3 pixels
      if (deltaX > 3 || deltaY > 3) {
        const hoveredAnnotation = findAnnotationAtPoint(drawingState.dragStartPoint.x, drawingState.dragStartPoint.y);
        if (hoveredAnnotation && drawingState.selectedAnnotations.includes(hoveredAnnotation.id)) {
          // Check if we're starting a resize operation
          const resizeHandle = getResizeHandle(hoveredAnnotation, drawingState.dragStartPoint.x, drawingState.dragStartPoint.y);
          if (resizeHandle) {
            updateDrawingState({
              isResizing: true,
              resizeHandle: resizeHandle,
              isDragging: false
            });
            console.log(`🔄 [RESIZE] Starting resize operation with handle: ${resizeHandle}`);
          } else {
            updateDrawingState({
              isDragging: true,
              isResizing: false,
              resizeHandle: null
            });
            console.log(`🖱️ [DRAG] Starting drag operation for ${drawingState.selectedAnnotations.length} annotation(s)`);
          }
          return;
        }
      }
    }
    
    if (!isDrawing) {
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

  // Handle dragging selected annotations
  const handleAnnotationDrag = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!drawingState.dragStartPoint || !currentScreenshot?.annotations) return;

    try {
      const currentCoords = mouseToCanvasCoordinates(e);
      const deltaX = currentCoords.x - drawingState.dragStartPoint.x;
      const deltaY = currentCoords.y - drawingState.dragStartPoint.y;
      
      // Convert delta to image coordinates
      const imageDeltaX = deltaX / canvasScale;
      const imageDeltaY = deltaY / canvasScale;
      
      // Create updated annotations
      const updatedAnnotations = currentScreenshot.annotations.map(annotation => {
        if (drawingState.selectedAnnotations.includes(annotation.id)) {
          if (drawingState.isResizing && drawingState.resizeHandle) {
            // Handle resizing
            return handleAnnotationResize(annotation, imageDeltaX, imageDeltaY, drawingState.resizeHandle);
          } else if (drawingState.isDragging) {
            // Handle dragging (moving)
            return {
              ...annotation,
              position: {
                ...annotation.position,
                x: annotation.position.x + imageDeltaX,
                y: annotation.position.y + imageDeltaY
              }
            };
          }
        }
        return annotation;
      });
      
      // Update the screenshot with new annotation positions (temporary preview)
      const updatedScreenshot = {
        ...currentScreenshot,
        annotations: updatedAnnotations
      };
      
      // Clear and re-render with updated positions
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (canvas && ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Temporarily update currentScreenshot for rendering
        const originalAnnotations = currentScreenshot.annotations;
        (currentScreenshot as any).annotations = updatedAnnotations;
        renderAnnotations(ctx);
        // Restore original annotations
        (currentScreenshot as any).annotations = originalAnnotations;
      }
      
      // Update drag start point for next move
      updateDrawingState({
        dragStartPoint: currentCoords
      });
      
    } catch (error) {
      console.error('Error during annotation drag:', error);
    }
  };

  // Handle resizing of annotations
  const handleAnnotationResize = (annotation: any, deltaX: number, deltaY: number, resizeHandle: string) => {
    if (annotation.type !== 'rectangle' && annotation.type !== 'blur') {
      return annotation;
    }

    const position = { ...annotation.position };
    
    switch (resizeHandle) {
      case 'nw': // Top-left
        position.x += deltaX;
        position.y += deltaY;
        position.width -= deltaX;
        position.height -= deltaY;
        break;
      case 'ne': // Top-right
        position.y += deltaY;
        position.width += deltaX;
        position.height -= deltaY;
        break;
      case 'sw': // Bottom-left
        position.x += deltaX;
        position.width -= deltaX;
        position.height += deltaY;
        break;
      case 'se': // Bottom-right
        position.width += deltaX;
        position.height += deltaY;
        break;
      case 'n': // Top
        position.y += deltaY;
        position.height -= deltaY;
        break;
      case 's': // Bottom
        position.height += deltaY;
        break;
      case 'w': // Left
        position.x += deltaX;
        position.width -= deltaX;
        break;
      case 'e': // Right
        position.width += deltaX;
        break;
    }
    
    // Ensure minimum size
    const minSize = 10;
    if (Math.abs(position.width) < minSize) {
      if (position.width < 0) {
        position.width = -minSize;
      } else {
        position.width = minSize;
      }
    }
    if (Math.abs(position.height) < minSize) {
      if (position.height < 0) {
        position.height = -minSize;
      } else {
        position.height = minSize;
      }
    }
    
    return {
      ...annotation,
      position
    };
  };

  // Handle ending drag/resize operation and save new positions
  const handleAnnotationDragEnd = async (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!drawingState.dragStartPoint || !currentScreenshot?.annotations) return;

    try {
      const currentCoords = mouseToCanvasCoordinates(e);
      const deltaX = currentCoords.x - drawingState.dragStartPoint.x;
      const deltaY = currentCoords.y - drawingState.dragStartPoint.y;
      
      // Only update if there was actual movement
      if (Math.abs(deltaX) < 2 && Math.abs(deltaY) < 2) {
        updateDrawingState({
          isDragging: false,
          dragStartPoint: null,
          isResizing: false,
          resizeHandle: null
        });
        return;
      }
      
      // Convert delta to image coordinates
      const imageDeltaX = deltaX / canvasScale;
      const imageDeltaY = deltaY / canvasScale;
      
      // Create updated annotations with final positions
      const updatedAnnotations = currentScreenshot.annotations.map(annotation => {
        if (drawingState.selectedAnnotations.includes(annotation.id)) {
          if (drawingState.isResizing && drawingState.resizeHandle) {
            // Handle resizing
            return handleAnnotationResize(annotation, imageDeltaX, imageDeltaY, drawingState.resizeHandle);
          } else if (drawingState.isDragging) {
            // Handle dragging (moving)
            return {
              ...annotation,
              position: {
                ...annotation.position,
                x: annotation.position.x + imageDeltaX,
                y: annotation.position.y + imageDeltaY
              }
            };
          }
        }
        return annotation;
      });
      
      // Update the screenshot data
      const updatedScreenshot = {
        ...currentScreenshot,
        annotations: updatedAnnotations
      };
      
      setCurrentScreenshot(updatedScreenshot);
      
      // Save to sidecar file
      try {
        await window.electron.invoke('sidecar-update', currentScreenshot.filePath, {
          annotations: updatedAnnotations
        });
        console.log('✅ [ANNOTATIONS] Successfully updated annotation positions in sidecar file');
      } catch (error) {
        console.error('❌ [ANNOTATIONS] Failed to save annotation positions to sidecar file:', error);
      }
      
      // Reset drag/resize state
      updateDrawingState({
        isDragging: false,
        dragStartPoint: null,
        isResizing: false,
        resizeHandle: null
      });
      
    } catch (error) {
      console.error('Error ending annotation drag/resize:', error);
      // Reset drag/resize state on error
      updateDrawingState({
        isDragging: false,
        dragStartPoint: null,
        isResizing: false,
        resizeHandle: null
      });
    }
  };

  const stopDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    // Handle ending drag or resize operation for selected annotations
    if (drawingState.selectedTool === 'select' && (drawingState.isDragging || drawingState.isResizing)) {
      handleAnnotationDragEnd(e);
      return;
    }
    
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
    <div className="w-full h-full bg-gray-300 relative flex flex-col">

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
                  cursor: cursorStyle
                }}
                onMouseDown={startDrawing}
                onMouseMove={handleMouseMove}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
              />
            </div>
          </div>
        )}
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

      {/* Annotation Property Editor */}
      {drawingState.selectedAnnotations && drawingState.selectedAnnotations.length > 0 && currentScreenshot?.annotations && (
        <AnnotationPropertyEditor
          selectedAnnotations={drawingState.selectedAnnotations}
          annotations={currentScreenshot.annotations}
          onUpdateAnnotation={handleUpdateAnnotation}
          onClose={() => updateDrawingState({ selectedAnnotations: [] })}
        />
      )}
    </div>
  );
}