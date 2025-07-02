# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ScreenshotOS is a high-performance screenshot tool for macOS built with Electron, React, and TypeScript. The application focuses on fast capture (<100ms), automatic saving, and clipboard integration.

## Development Commands

### Essential Commands
- `npm install` - Install dependencies
- `npm start` - Build and start the application
- `npm run build` - Build all components (renderer, main, preload)
- `npm run dist` - Package for macOS distribution
- `npm run pack` - Package without creating distributable

### Component Building
- `npm run build:renderer` - Build React frontend (Vite)
- `npm run build:main` - Build Electron main process (TypeScript)
- `npm run build:preload` - Build preload script
- `npm run dev:renderer` - Start Vite dev server for renderer

### Linting and Formatting
- ESLint configuration: `eslint.config.mjs`
- Prettier configuration available
- No test framework currently configured

## Architecture

### Main Process (`src/main.ts`)
- Electron main process handling window management
- Screenshot capture using `screenshot-desktop` library
- Image processing with Jimp (migrated from Sharp)
- Configuration management through `src/config/storage.ts`
- Area selection overlay window creation

### Renderer Process (`src/renderer.tsx`)
- React application for the main UI
- Settings panel component
- Uses inline styles due to CSS loading issues
- IPC communication with main process

### Preload Script (`src/preload.ts`)
- Secure bridge between main and renderer processes
- Exposes IPC APIs to renderer

### Key Utilities
- `src/utils/jimp-native.ts` - Image processing with native bridge
- `src/utils/capture.ts` - Screenshot capture logic
- `src/utils/logger.ts` - Logging utilities for main process
- `src/utils/renderer-logger.ts` - Logging utilities for renderer process
- `src/utils/sidecar-manager.ts` - Metadata and annotation management
- `src/config/storage.ts` - Application configuration management

### Area Selection
- `src/areaOverlay.html` - Overlay for area selection
- `src/areaOverlay.js` - Area selection interaction logic
- `src/overlayPreload.js` - Preload for overlay window

## Build Configuration

### TypeScript
- Target: ES2020
- Outputs to `dist/` directory
- Main and preload scripts compiled separately from renderer
- Renderer (`src/renderer.tsx`) excluded from main TypeScript compilation

### Electron Builder
- macOS-focused with DMG and ZIP distribution
- App ID: `com.screenshotos.app`
- Hardened runtime enabled
- Build output: `dist-electron/`

## Image Processing

The application recently migrated from Sharp to Jimp for image processing:
- Jimp used for cross-platform compatibility
- Native image bridge for performance optimization
- Area cropping functionality for selection capture
- Multiple Jimp utility files for different processing approaches

## File Structure

```
src/
├── main.ts              # Electron main process
├── renderer.tsx         # React frontend
├── preload.ts          # Main preload script
├── areaOverlay.html    # Area selection overlay
├── areaOverlay.js      # Overlay interaction
├── overlayPreload.js   # Overlay preload
├── components/         # React components
├── config/            # Configuration management
├── utils/             # Utilities (capture, image processing)
└── assets/            # Static assets
```

## Development Notes

- The application uses CommonJS modules (`"type": "commonjs"`)
- React 19 with TypeScript
- Vite for frontend bundling
- ESLint configured for code quality
- No current test framework (placeholder in package.json)
- Recent git history shows focus on Jimp migration and area selection features

## Testing Instructions

**IMPORTANT**: After implementing any plan or making significant changes, always:

1. **Build the application**: `npm run build`
2. **Install and test**: `npm start` 
3. **Verify core functionality**:
   - Screenshot capture (Full Screen and Area Selection)
   - UI responsiveness and layout
   - New features work as expected
   - No console errors or crashes

This ensures changes work correctly before marking tasks as completed.

# Further instructions
after completing any changes, always build and run the app. 