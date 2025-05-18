# ScreenshotOS

A high-performance screenshot tool for macOS with instant capture, automatic saving, and clipboard integration.

## Features

- **Fast Capture**: Take full screen screenshots with near-instant response time (<100ms)
- **Automatic Saving**: Screenshots are automatically saved to your configured location
- **Clipboard Integration**: Every screenshot is automatically copied to your clipboard
- **Configurable Settings**: Customize save locations and file naming
- **Clean UI**: Simple, intuitive interface for capturing and viewing screenshots

## Installation

### Download

Download the latest version from the [Releases](https://github.com/yourusername/screenshotos/releases) page.

### Installation Options

1. **DMG Installation**:
   - Open the downloaded `.dmg` file
   - Drag ScreenshotOS into your Applications folder
   - Open from your Applications folder

2. **ZIP Installation**:
   - Extract the ZIP file
   - Move ScreenshotOS.app to your Applications folder
   - Open from your Applications folder

## Usage

1. **Taking Screenshots**:
   - Click the "Capture Full Screen" button to take a screenshot
   - The screenshot will be automatically saved and copied to your clipboard

2. **Configuring Settings**:
   - Click the "Settings" button
   - Configure your preferred save location and file format

## Development

### Prerequisites

- Node.js (v18 or later)
- npm (v9 or later)

### Setup

```bash
# Clone the repository
git clone https://github.com/yourusername/screenshotos.git
cd screenshotos

# Install dependencies
npm install

# Start the application in development mode
npm start
```

### Building

```bash
# Build for production
npm run build

# Package for macOS
npm run dist
```

## License

ISC

## Acknowledgements

- Built with Electron, React, and TypeScript
- Uses screenshot-desktop for efficient screen captures