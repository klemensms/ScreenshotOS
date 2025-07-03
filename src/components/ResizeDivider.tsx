import React, { useState, useCallback, useRef } from 'react';

interface ResizeDividerProps {
  onResize: (deltaX: number) => void;
  className?: string;
  ariaLabel: string;
}

export function ResizeDivider({ onResize, className = '', ariaLabel }: ResizeDividerProps) {
  const [isResizing, setIsResizing] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const lastMouseXRef = useRef<number>(0);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    
    // Store the initial mouse position
    lastMouseXRef.current = e.clientX;
    
    const handleMouseMove = (e: MouseEvent) => {
      // Calculate incremental delta from last position
      const deltaX = e.clientX - lastMouseXRef.current;
      
      // Only proceed if there's actual movement
      if (deltaX !== 0) {
        onResize(deltaX);
        // Update last position for next move event
        lastMouseXRef.current = e.clientX;
      }
    };
    
    const handleMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [onResize]);

  return (
    <div
      className={`
        w-2 
        bg-gray-300 
        cursor-col-resize 
        flex 
        items-center 
        justify-center 
        transition-colors 
        duration-150
        relative
        z-40
        select-none
        ${isResizing 
          ? 'bg-blue-500' 
          : isHovering 
          ? 'bg-blue-400' 
          : 'bg-gray-300 hover:bg-gray-400'
        }
        ${className}
      `}
      onMouseDown={handleMouseDown}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      role="separator"
      aria-label={ariaLabel}
      title={ariaLabel}
      style={{ 
        minWidth: '8px',
        pointerEvents: 'auto',
        userSelect: 'none'
      }}
    >
      {/* Visual grip indicator */}
      <div className="flex flex-col gap-1 opacity-60">
        <div 
          className={`w-1 h-1 rounded-full ${
            isResizing || isHovering ? 'bg-white' : 'bg-gray-600'
          }`} 
        />
        <div 
          className={`w-1 h-1 rounded-full ${
            isResizing || isHovering ? 'bg-white' : 'bg-gray-600'
          }`} 
        />
        <div 
          className={`w-1 h-1 rounded-full ${
            isResizing || isHovering ? 'bg-white' : 'bg-gray-600'
          }`} 
        />
      </div>
      
      {/* Active resize indicator */}
      {isResizing && (
        <div className="absolute inset-0 bg-blue-500 bg-opacity-50 animate-pulse" />
      )}
    </div>
  );
}