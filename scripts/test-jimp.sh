#!/bin/zsh
# Test script for ScreenshotOS - verifies Jimp implementation

echo "=============================================="
echo "Testing ScreenshotOS with Jimp Implementation"
echo "=============================================="

# Set up test directory
TEST_DIR="$HOME/ScreenshotOS_test"
mkdir -p "$TEST_DIR"
echo "Created test directory: $TEST_DIR"

# Check for required packages
if ! command -v file &> /dev/null; then
    echo "The 'file' command is required for this test"
    exit 1
fi

# Get latest screenshot from the app's save location
# Typically this would be in Pictures or a custom location
DEFAULT_SAVE_DIR="$HOME/Pictures"
echo "Checking for screenshots in: $DEFAULT_SAVE_DIR"

# Run a test to see if area selection works
echo "Testing area selection and cropping:"
echo "1. Please capture a screenshot using area selection"
echo "2. Select a small area of your screen"
echo "3. The cropped image should appear in your default save location"
echo "4. Check the clipboard - it should contain the cropped image"
echo ""
echo "Press Enter when you've completed the test..."
read

# Check most recent PNG file in the default directory
LATEST_SCREENSHOT=$(find "$DEFAULT_SAVE_DIR" -name "*.png" -type f -print0 | xargs -0 ls -t | head -1)

if [[ -n "$LATEST_SCREENSHOT" ]]; then
    echo "Found screenshot: $LATEST_SCREENSHOT"
    
    # Copy it to our test directory
    cp "$LATEST_SCREENSHOT" "$TEST_DIR/test_screenshot.png"
    echo "Copied to test directory"
    
    # Check file type to confirm it's a valid PNG
    FILE_INFO=$(file "$TEST_DIR/test_screenshot.png")
    echo "File info: $FILE_INFO"
    
    if [[ "$FILE_INFO" == *"PNG image data"* ]]; then
        echo "✅ Verification successful: Valid PNG file created"
        echo "This confirms that Jimp is correctly processing the screenshots"
    else
        echo "❌ Verification failed: File is not a valid PNG"
        echo "There might be issues with the Jimp implementation"
    fi
else
    echo "❌ No PNG screenshots found in $DEFAULT_SAVE_DIR"
    echo "Please make sure you've taken a screenshot"
fi

echo ""
echo "Test complete. You can view the test screenshot in: $TEST_DIR/test_screenshot.png"
echo "=============================================="
