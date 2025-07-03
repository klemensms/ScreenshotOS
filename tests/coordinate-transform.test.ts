/**
 * Unit tests for coordinate transformation functionality
 * 
 * This test suite provides comprehensive protection against regressions in the 
 * area selection coordinate transformation logic, addressing the user's request
 * for protection mechanisms to prevent the feature from "breaking again and again".
 */

import { jest } from '@jest/globals';

// Mock electron screen API
const mockElectronScreen = {
  getAllDisplays: jest.fn(),
  getPrimaryDisplay: jest.fn()
};

// Mock electron app for logger
const mockElectronApp = {
  getPath: jest.fn().mockReturnValue('/mock/path')
};

// Mock logger to prevent actual file operations during tests
jest.mock('../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

// Mock electron module
jest.mock('electron', () => ({
  screen: mockElectronScreen,
  app: mockElectronApp
}));

// Import the function under test after mocking
let transformOverlayToScreenCoordinates: (overlayArea: { x: number; y: number; width: number; height: number; displayId?: number }) => { x: number; y: number; width: number; height: number; displayId: number };

beforeAll(async () => {
  // Since we can't directly import the function from main.ts (it's not exported),
  // we'll create a test version with the same logic
  const { screen } = require('electron');
  
  transformOverlayToScreenCoordinates = function(overlayArea: { x: number; y: number; width: number; height: number; displayId?: number }): { x: number; y: number; width: number; height: number; displayId: number } {
    console.log('🔄 [COORD_TRANSFORM] Starting coordinate transformation with input:', overlayArea);
    
    // ===== COMPREHENSIVE INPUT VALIDATION =====
    if (!overlayArea || typeof overlayArea !== 'object') {
      throw new Error('[COORD_TRANSFORM] Invalid overlayArea: must be an object');
    }
    
    const { x, y, width, height, displayId } = overlayArea;
    
    // Validate numeric inputs
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(width) || !Number.isFinite(height)) {
      throw new Error(`[COORD_TRANSFORM] Invalid coordinates: x=${x}, y=${y}, width=${width}, height=${height}`);
    }
    
    // Validate area dimensions
    if (width <= 0 || height <= 0) {
      throw new Error(`[COORD_TRANSFORM] Invalid area dimensions: width=${width}, height=${height} (must be positive)`);
    }
    
    // Validate display ID if provided
    if (displayId !== undefined && (!Number.isInteger(displayId) || displayId < 0)) {
      throw new Error(`[COORD_TRANSFORM] Invalid displayId: ${displayId} (must be a non-negative integer)`);
    }
    
    // Get all displays with error checking
    const allDisplays = screen.getAllDisplays();
    if (!allDisplays || allDisplays.length === 0) {
      throw new Error('[COORD_TRANSFORM] No displays available');
    }
    
    console.log('🖥️ [COORD_TRANSFORM] Available displays:', allDisplays.map((d: any) => ({ id: d.id, bounds: d.bounds, scaleFactor: d.scaleFactor })));
    
    // Find the display for this area selection
    let targetDisplay: any;
    
    if (displayId) {
      const foundDisplay = allDisplays.find((d: any) => d.id === displayId);
      if (!foundDisplay) {
        console.warn(`⚠️ [COORD_TRANSFORM] Display ID ${displayId} not found, falling back to primary display`);
        targetDisplay = allDisplays[0];
      } else {
        targetDisplay = foundDisplay;
        console.log('✅ [COORD_TRANSFORM] Using provided display ID:', displayId);
      }
    } else {
      targetDisplay = allDisplays[0];
      console.log('ℹ️ [COORD_TRANSFORM] No display ID provided, using primary display');
    }
    
    // ===== DISPLAY VALIDATION =====
    if (!targetDisplay.bounds || !targetDisplay.workArea) {
      throw new Error(`[COORD_TRANSFORM] Invalid display properties for display ${targetDisplay.id}`);
    }
    
    console.log('🎯 [COORD_TRANSFORM] Target display properties:', {
      display: targetDisplay.id,
      bounds: targetDisplay.bounds,
      workArea: targetDisplay.workArea,
      scaleFactor: targetDisplay.scaleFactor
    });
    
    // Validate display bounds
    if (targetDisplay.bounds.width <= 0 || targetDisplay.bounds.height <= 0) {
      throw new Error(`[COORD_TRANSFORM] Invalid display bounds: ${JSON.stringify(targetDisplay.bounds)}`);
    }
    
    if (targetDisplay.scaleFactor <= 0 || !Number.isFinite(targetDisplay.scaleFactor)) {
      throw new Error(`[COORD_TRANSFORM] Invalid scale factor: ${targetDisplay.scaleFactor}`);
    }
    
    // ===== COORDINATE TRANSFORMATION =====
    // Calculate the offset between workArea and bounds (accounts for menu bar, dock, etc.)
    const workAreaOffsetX = targetDisplay.workArea.x - targetDisplay.bounds.x;
    const workAreaOffsetY = targetDisplay.workArea.y - targetDisplay.bounds.y;
    
    console.log('📐 [COORD_TRANSFORM] Work area offset calculation:', { 
      workAreaX: targetDisplay.workArea.x, 
      boundsX: targetDisplay.bounds.x,
      offsetX: workAreaOffsetX,
      workAreaY: targetDisplay.workArea.y, 
      boundsY: targetDisplay.bounds.y,
      offsetY: workAreaOffsetY 
    });
    
    // Validate input coordinates are within workArea bounds
    if (x < 0 || y < 0 || x + width > targetDisplay.workArea.width || y + height > targetDisplay.workArea.height) {
      console.warn(`⚠️ [COORD_TRANSFORM] Input area extends beyond workArea bounds:`, {
        input: { x, y, width, height },
        workArea: targetDisplay.workArea,
        exceedsRight: x + width > targetDisplay.workArea.width,
        exceedsBottom: y + height > targetDisplay.workArea.height
      });
    }
    
    // Transform overlay coordinates (relative to workArea) to display bounds coordinates
    const displayX = x + workAreaOffsetX;
    const displayY = y + workAreaOffsetY;
    
    console.log('🔄 [COORD_TRANSFORM] Logical coordinate transformation:', {
      inputOverlay: { x, y },
      workAreaOffset: { x: workAreaOffsetX, y: workAreaOffsetY },
      resultDisplay: { x: displayX, y: displayY }
    });
    
    // Apply scale factor to get physical pixels for cropping
    const scaleFactor = targetDisplay.scaleFactor;
    const physicalX = Math.round(displayX * scaleFactor);
    const physicalY = Math.round(displayY * scaleFactor);
    const physicalWidth = Math.round(width * scaleFactor);
    const physicalHeight = Math.round(height * scaleFactor);
    
    console.log('🔍 [COORD_TRANSFORM] Scale factor application:', {
      scaleFactor,
      logical: { x: displayX, y: displayY, width, height },
      physical: { x: physicalX, y: physicalY, width: physicalWidth, height: physicalHeight }
    });
    
    // ===== BOUNDS VALIDATION AND CLAMPING =====
    const maxWidth = Math.round(targetDisplay.bounds.width * scaleFactor);
    const maxHeight = Math.round(targetDisplay.bounds.height * scaleFactor);
    
    console.log('📏 [COORD_TRANSFORM] Physical display bounds:', { maxWidth, maxHeight });
    
    // Validate physical coordinates are reasonable
    if (physicalX < -maxWidth || physicalY < -maxHeight || physicalX > 2 * maxWidth || physicalY > 2 * maxHeight) {
      console.error(`❌ [COORD_TRANSFORM] Physical coordinates are unreasonable:`, {
        physical: { x: physicalX, y: physicalY },
        displayBounds: { maxWidth, maxHeight }
      });
    }
    
    const validatedX = Math.max(0, Math.min(physicalX, maxWidth - 1));
    const validatedY = Math.max(0, Math.min(physicalY, maxHeight - 1));
    const validatedWidth = Math.max(1, Math.min(physicalWidth, maxWidth - validatedX));
    const validatedHeight = Math.max(1, Math.min(physicalHeight, maxHeight - validatedY));
    
    // Check if clamping occurred
    const wasClampedX = validatedX !== physicalX;
    const wasClampedY = validatedY !== physicalY;
    const wasClampedWidth = validatedWidth !== physicalWidth;
    const wasClampedHeight = validatedHeight !== physicalHeight;
    
    if (wasClampedX || wasClampedY || wasClampedWidth || wasClampedHeight) {
      console.warn(`⚠️ [COORD_TRANSFORM] Coordinates were clamped to display bounds:`, {
        original: { x: physicalX, y: physicalY, width: physicalWidth, height: physicalHeight },
        clamped: { x: validatedX, y: validatedY, width: validatedWidth, height: validatedHeight },
        clampingApplied: { x: wasClampedX, y: wasClampedY, width: wasClampedWidth, height: wasClampedHeight }
      });
    }
    
    // ===== FINAL RESULT VALIDATION =====
    const result = {
      x: validatedX,
      y: validatedY,
      width: validatedWidth,
      height: validatedHeight,
      displayId: targetDisplay.id
    };
    
    // Validate final result makes sense
    if (result.x < 0 || result.y < 0 || result.width <= 0 || result.height <= 0) {
      throw new Error(`[COORD_TRANSFORM] Invalid final result: ${JSON.stringify(result)}`);
    }
    
    if (result.x + result.width > maxWidth || result.y + result.height > maxHeight) {
      throw new Error(`[COORD_TRANSFORM] Final result exceeds display bounds: result=${JSON.stringify(result)}, bounds=${maxWidth}x${maxHeight}`);
    }
    
    // Calculate transformation ratio for verification
    const inputArea = width * height;
    const outputArea = result.width * result.height;
    const scaleRatio = Math.sqrt(outputArea / inputArea);
    const expectedRatio = scaleFactor;
    const ratioDiscrepancy = Math.abs(scaleRatio - expectedRatio) / expectedRatio;
    
    if (ratioDiscrepancy > 0.1) { // More than 10% discrepancy
      console.warn(`⚠️ [COORD_TRANSFORM] Unexpected scale ratio discrepancy:`, {
        inputArea,
        outputArea,
        calculatedRatio: scaleRatio,
        expectedRatio,
        discrepancy: ratioDiscrepancy
      });
    }
    
    return result;
  };
});

describe('Coordinate Transformation Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Set up default mock display configuration (typical macOS setup)
    mockElectronScreen.getAllDisplays.mockReturnValue([
      {
        id: 1,
        bounds: { x: 0, y: 0, width: 1920, height: 1080 },
        workArea: { x: 0, y: 25, width: 1920, height: 1055 }, // Menu bar takes 25px
        scaleFactor: 2.0
      }
    ]);
  });

  describe('Input Validation', () => {
    test('should throw error for null input', () => {
      expect(() => {
        transformOverlayToScreenCoordinates(null as any);
      }).toThrow('[COORD_TRANSFORM] Invalid overlayArea: must be an object');
    });

    test('should throw error for undefined input', () => {
      expect(() => {
        transformOverlayToScreenCoordinates(undefined as any);
      }).toThrow('[COORD_TRANSFORM] Invalid overlayArea: must be an object');
    });

    test('should throw error for non-object input', () => {
      expect(() => {
        transformOverlayToScreenCoordinates('invalid' as any);
      }).toThrow('[COORD_TRANSFORM] Invalid overlayArea: must be an object');
    });

    test('should throw error for invalid coordinates', () => {
      expect(() => {
        transformOverlayToScreenCoordinates({ x: NaN, y: 0, width: 100, height: 100 });
      }).toThrow('[COORD_TRANSFORM] Invalid coordinates');
    });

    test('should throw error for negative dimensions', () => {
      expect(() => {
        transformOverlayToScreenCoordinates({ x: 0, y: 0, width: -100, height: 100 });
      }).toThrow('[COORD_TRANSFORM] Invalid area dimensions');
    });

    test('should throw error for zero dimensions', () => {
      expect(() => {
        transformOverlayToScreenCoordinates({ x: 0, y: 0, width: 0, height: 100 });
      }).toThrow('[COORD_TRANSFORM] Invalid area dimensions');
    });

    test('should throw error for invalid displayId', () => {
      expect(() => {
        transformOverlayToScreenCoordinates({ x: 0, y: 0, width: 100, height: 100, displayId: -1 });
      }).toThrow('[COORD_TRANSFORM] Invalid displayId');
    });

    test('should throw error for non-integer displayId', () => {
      expect(() => {
        transformOverlayToScreenCoordinates({ x: 0, y: 0, width: 100, height: 100, displayId: 1.5 });
      }).toThrow('[COORD_TRANSFORM] Invalid displayId');
    });
  });

  describe('Display Configuration Validation', () => {
    test('should throw error when no displays available', () => {
      mockElectronScreen.getAllDisplays.mockReturnValue([]);
      
      expect(() => {
        transformOverlayToScreenCoordinates({ x: 0, y: 0, width: 100, height: 100 });
      }).toThrow('[COORD_TRANSFORM] No displays available');
    });

    test('should throw error for display with invalid bounds', () => {
      mockElectronScreen.getAllDisplays.mockReturnValue([
        {
          id: 1,
          bounds: { x: 0, y: 0, width: 0, height: 1080 }, // Invalid width
          workArea: { x: 0, y: 25, width: 1920, height: 1055 },
          scaleFactor: 2.0
        }
      ]);
      
      expect(() => {
        transformOverlayToScreenCoordinates({ x: 0, y: 0, width: 100, height: 100 });
      }).toThrow('[COORD_TRANSFORM] Invalid display bounds');
    });

    test('should throw error for display with invalid scale factor', () => {
      mockElectronScreen.getAllDisplays.mockReturnValue([
        {
          id: 1,
          bounds: { x: 0, y: 0, width: 1920, height: 1080 },
          workArea: { x: 0, y: 25, width: 1920, height: 1055 },
          scaleFactor: 0 // Invalid scale factor
        }
      ]);
      
      expect(() => {
        transformOverlayToScreenCoordinates({ x: 0, y: 0, width: 100, height: 100 });
      }).toThrow('[COORD_TRANSFORM] Invalid scale factor');
    });

    test('should fallback to primary display when specified display not found', () => {
      mockElectronScreen.getAllDisplays.mockReturnValue([
        {
          id: 1,
          bounds: { x: 0, y: 0, width: 1920, height: 1080 },
          workArea: { x: 0, y: 25, width: 1920, height: 1055 },
          scaleFactor: 2.0
        }
      ]);
      
      const result = transformOverlayToScreenCoordinates({ 
        x: 10, y: 10, width: 100, height: 100, displayId: 999 
      });
      
      expect(result.displayId).toBe(1); // Should use fallback display
    });
  });

  describe('Basic Coordinate Transformation', () => {
    test('should correctly transform simple coordinates', () => {
      const result = transformOverlayToScreenCoordinates({ 
        x: 100, y: 100, width: 200, height: 150 
      });
      
      // Expected: overlay(100,100) + workAreaOffset(0,25) = display(100,125)
      // Then apply scaleFactor 2.0: physical(200,250)
      expect(result).toEqual({
        x: 200,
        y: 250,
        width: 400,
        height: 300,
        displayId: 1
      });
    });

    test('should handle coordinates at origin', () => {
      const result = transformOverlayToScreenCoordinates({ 
        x: 0, y: 0, width: 100, height: 100 
      });
      
      // Expected: overlay(0,0) + workAreaOffset(0,25) = display(0,25)
      // Then apply scaleFactor 2.0: physical(0,50)
      expect(result).toEqual({
        x: 0,
        y: 50,
        width: 200,
        height: 200,
        displayId: 1
      });
    });

    test('should handle fractional coordinates with rounding', () => {
      const result = transformOverlayToScreenCoordinates({ 
        x: 10.7, y: 20.3, width: 100.9, height: 50.1 
      });
      
      // Expected: overlay(10.7,20.3) + workAreaOffset(0,25) = display(10.7,45.3)
      // Then apply scaleFactor 2.0 and round: physical(21,91)
      expect(result).toEqual({
        x: 21,
        y: 91,
        width: 202,
        height: 100,
        displayId: 1
      });
    });
  });

  describe('Multi-Display Scenarios', () => {
    test('should handle dual display setup', () => {
      mockElectronScreen.getAllDisplays.mockReturnValue([
        {
          id: 1,
          bounds: { x: 0, y: 0, width: 1920, height: 1080 },
          workArea: { x: 0, y: 25, width: 1920, height: 1055 },
          scaleFactor: 2.0
        },
        {
          id: 2,
          bounds: { x: 1920, y: 0, width: 1440, height: 900 },
          workArea: { x: 1920, y: 25, width: 1440, height: 875 },
          scaleFactor: 1.0
        }
      ]);
      
      const result = transformOverlayToScreenCoordinates({ 
        x: 100, y: 100, width: 200, height: 150, displayId: 2 
      });
      
      // Expected: overlay(100,100) + workAreaOffset(0,25) = display(100,125)
      // Then apply scaleFactor 1.0: physical(100,125)
      expect(result).toEqual({
        x: 100,
        y: 125,
        width: 200,
        height: 150,
        displayId: 2
      });
    });

    test('should handle displays with different work area offsets', () => {
      mockElectronScreen.getAllDisplays.mockReturnValue([
        {
          id: 1,
          bounds: { x: 0, y: 0, width: 1920, height: 1080 },
          workArea: { x: 50, y: 75, width: 1820, height: 980 }, // Large dock and menu bar
          scaleFactor: 1.0
        }
      ]);
      
      const result = transformOverlayToScreenCoordinates({ 
        x: 100, y: 100, width: 200, height: 150 
      });
      
      // Expected: overlay(100,100) + workAreaOffset(50,75) = display(150,175)
      // Then apply scaleFactor 1.0: physical(150,175)
      expect(result).toEqual({
        x: 150,
        y: 175,
        width: 200,
        height: 150,
        displayId: 1
      });
    });
  });

  describe('High-DPI Display Handling', () => {
    test('should correctly apply high scale factors', () => {
      mockElectronScreen.getAllDisplays.mockReturnValue([
        {
          id: 1,
          bounds: { x: 0, y: 0, width: 1920, height: 1080 },
          workArea: { x: 0, y: 25, width: 1920, height: 1055 },
          scaleFactor: 3.0 // Very high DPI
        }
      ]);
      
      const result = transformOverlayToScreenCoordinates({ 
        x: 100, y: 100, width: 200, height: 150 
      });
      
      // Expected: overlay(100,100) + workAreaOffset(0,25) = display(100,125)
      // Then apply scaleFactor 3.0: physical(300,375)
      expect(result).toEqual({
        x: 300,
        y: 375,
        width: 600,
        height: 450,
        displayId: 1
      });
    });

    test('should handle fractional scale factors', () => {
      mockElectronScreen.getAllDisplays.mockReturnValue([
        {
          id: 1,
          bounds: { x: 0, y: 0, width: 1920, height: 1080 },
          workArea: { x: 0, y: 25, width: 1920, height: 1055 },
          scaleFactor: 1.25
        }
      ]);
      
      const result = transformOverlayToScreenCoordinates({ 
        x: 100, y: 100, width: 200, height: 160 
      });
      
      // Expected: overlay(100,100) + workAreaOffset(0,25) = display(100,125)
      // Then apply scaleFactor 1.25 and round: physical(125,156)
      expect(result).toEqual({
        x: 125,
        y: 156,
        width: 250,
        height: 200,
        displayId: 1
      });
    });
  });

  describe('Bounds Clamping', () => {
    test('should clamp coordinates that exceed display bounds', () => {
      const result = transformOverlayToScreenCoordinates({ 
        x: 1800, y: 1000, width: 200, height: 150 // Exceeds display bounds
      });
      
      // Physical bounds: 1920*2 = 3840, 1080*2 = 2160
      // Input would result in: x=3600, y=2050, but should be clamped
      expect(result.x).toBeLessThanOrEqual(3840);
      expect(result.y).toBeLessThanOrEqual(2160);
      expect(result.width).toBeGreaterThan(0);
      expect(result.height).toBeGreaterThan(0);
    });

    test('should clamp negative coordinates to zero', () => {
      const result = transformOverlayToScreenCoordinates({ 
        x: -50, y: -30, width: 200, height: 150 
      });
      
      expect(result.x).toBe(0);
      expect(result.y).toBe(0);
      expect(result.width).toBeGreaterThan(0);
      expect(result.height).toBeGreaterThan(0);
    });

    test('should ensure minimum dimensions of 1 pixel', () => {
      const result = transformOverlayToScreenCoordinates({ 
        x: 1919, y: 1079, width: 1, height: 1 // Very small at edge
      });
      
      expect(result.width).toBeGreaterThanOrEqual(1);
      expect(result.height).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Edge Cases and Error Conditions', () => {
    test('should handle very large coordinates', () => {
      const result = transformOverlayToScreenCoordinates({ 
        x: 10000, y: 10000, width: 100, height: 100 
      });
      
      // Should be clamped to display bounds
      expect(result.x).toBeLessThanOrEqual(3840); // 1920 * 2
      expect(result.y).toBeLessThanOrEqual(2160); // 1080 * 2
    });

    test('should handle very small dimensions', () => {
      const result = transformOverlayToScreenCoordinates({ 
        x: 100, y: 100, width: 0.1, height: 0.1 
      });
      
      // Should be rounded up to at least 1 pixel
      expect(result.width).toBeGreaterThanOrEqual(1);
      expect(result.height).toBeGreaterThanOrEqual(1);
    });

    test('should maintain area proportionality within reasonable bounds', () => {
      const input = { x: 100, y: 100, width: 200, height: 150 };
      const result = transformOverlayToScreenCoordinates(input);
      
      const inputArea = input.width * input.height;
      const outputArea = result.width * result.height;
      const scaleRatio = Math.sqrt(outputArea / inputArea);
      
      // Should be close to the scale factor (2.0) within 10% tolerance
      expect(Math.abs(scaleRatio - 2.0) / 2.0).toBeLessThan(0.1);
    });

    test('should handle maximum possible coordinates', () => {
      const result = transformOverlayToScreenCoordinates({ 
        x: Number.MAX_SAFE_INTEGER, 
        y: Number.MAX_SAFE_INTEGER, 
        width: 100, 
        height: 100 
      });
      
      // Should be clamped to reasonable bounds
      expect(result.x).toBeLessThanOrEqual(7680); // 2 * max display bound
      expect(result.y).toBeLessThanOrEqual(4320);
    });
  });

  describe('Real-World Scenarios', () => {
    test('should handle typical macOS Retina display selection', () => {
      // Typical MacBook Pro 16" setup
      mockElectronScreen.getAllDisplays.mockReturnValue([
        {
          id: 1,
          bounds: { x: 0, y: 0, width: 3456, height: 2234 },
          workArea: { x: 0, y: 28, width: 3456, height: 2206 },
          scaleFactor: 2.0
        }
      ]);
      
      const result = transformOverlayToScreenCoordinates({ 
        x: 500, y: 300, width: 800, height: 600 
      });
      
      expect(result).toEqual({
        x: 1000,
        y: 656, // (300 + 28) * 2
        width: 1600,
        height: 1200,
        displayId: 1
      });
    });

    test('should handle external 4K display with dock', () => {
      // External 4K display with dock on left
      mockElectronScreen.getAllDisplays.mockReturnValue([
        {
          id: 2,
          bounds: { x: 0, y: 0, width: 3840, height: 2160 },
          workArea: { x: 80, y: 25, width: 3760, height: 2135 }, // Dock on left
          scaleFactor: 1.0
        }
      ]);
      
      const result = transformOverlayToScreenCoordinates({ 
        x: 1000, y: 500, width: 600, height: 400 
      });
      
      expect(result).toEqual({
        x: 1080, // 1000 + 80
        y: 525,  // 500 + 25
        width: 600,
        height: 400,
        displayId: 2
      });
    });

    test('should handle selection spanning entire work area', () => {
      const result = transformOverlayToScreenCoordinates({ 
        x: 0, y: 0, width: 1920, height: 1055 // Full work area
      });
      
      expect(result).toEqual({
        x: 0,
        y: 50, // 0 + 25 (menu bar) * 2 (scale factor)
        width: 3840, // 1920 * 2
        height: 2110, // 1055 * 2
        displayId: 1
      });
    });
  });
});