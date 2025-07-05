let isSelecting = false;
let startX = 0, startY = 0, endX = 0, endY = 0;
const selection = document.getElementById('selection');
const previousSelection = document.getElementById('previousSelection');
let hasPreviousArea = false;
let previousArea = null;

console.log('Area overlay script loaded');

// Check if we have access to electronAPI
console.log('electronAPI available:', !!window.electronAPI);

function updateSelectionRect() {
  const x = Math.min(startX, endX);
  const y = Math.min(startY, endY);
  const width = Math.abs(startX - endX);
  const height = Math.abs(startY - endY);
  selection.style.left = x + 'px';
  selection.style.top = y + 'px';
  selection.style.width = width + 'px';
  selection.style.height = height + 'px';
  selection.style.display = width > 2 && height > 2 ? 'block' : 'none';
}

function showPreviousArea(area) {
  console.log('🔍 [OVERLAY_JS] showPreviousArea called with:', area);
  console.log('🔍 [OVERLAY_JS] previousSelection element:', previousSelection);
  
  if (!area) {
    console.log('🔍 [OVERLAY_JS] No area provided, cannot show previous area');
    return;
  }
  
  if (!previousSelection) {
    console.log('🔍 [OVERLAY_JS] previousSelection element not found!');
    return;
  }
  
  console.log('🔍 [OVERLAY_JS] Setting previous area styles:');
  console.log(`  - left: ${area.x}px`);
  console.log(`  - top: ${area.y}px`);
  console.log(`  - width: ${area.width}px`);
  console.log(`  - height: ${area.height}px`);
  
  previousSelection.style.left = area.x + 'px';
  previousSelection.style.top = area.y + 'px';
  previousSelection.style.width = area.width + 'px';
  previousSelection.style.height = area.height + 'px';
  previousSelection.style.display = 'block';
  
  // Update hint text
  const hint = document.getElementById('hint');
  if (hint) {
    hint.textContent = 'Click previous area or drag to select new area';
  }
  
  console.log('🔍 [OVERLAY_JS] Previous area displayed successfully');
  console.log('🔍 [OVERLAY_JS] Element final styles:', {
    left: previousSelection.style.left,
    top: previousSelection.style.top,
    width: previousSelection.style.width,
    height: previousSelection.style.height,
    display: previousSelection.style.display
  });
}

function hidePreviousArea() {
  if (previousSelection) {
    previousSelection.style.display = 'none';
  }
}

function isClickInsidePreviousArea(x, y) {
  if (!hasPreviousArea || !previousArea) return false;
  
  return x >= previousArea.x && 
         x <= previousArea.x + previousArea.width &&
         y >= previousArea.y && 
         y <= previousArea.y + previousArea.height;
}

// Initialize previous area on load
function initializePreviousArea() {
  console.log('🔍 [OVERLAY_JS] ========== INITIALIZING PREVIOUS AREA ==========');
  console.log('🔍 [OVERLAY_JS] electronAPI available:', !!window.electronAPI);
  console.log('🔍 [OVERLAY_JS] getPreviousArea available:', !!(window.electronAPI && window.electronAPI.getPreviousArea));
  console.log('🔍 [OVERLAY_JS] getDisplayInfo available:', !!(window.electronAPI && window.electronAPI.getDisplayInfo));
  
  if (!window.electronAPI) {
    console.error('🔍 [OVERLAY_JS] electronAPI not available!');
    return;
  }
  
  if (!window.electronAPI.getPreviousArea) {
    console.error('🔍 [OVERLAY_JS] getPreviousArea function not available!');
    return;
  }
  
  try {
    const area = window.electronAPI.getPreviousArea();
    console.log('🔍 [OVERLAY_JS] Got previous area from preload:', area);
    
    const displayInfo = window.electronAPI.getDisplayInfo();
    console.log('🔍 [OVERLAY_JS] Current display info:', displayInfo);
    
    if (!area) {
      console.log('🔍 [OVERLAY_JS] No previous area found - this is normal for first use or different display');
      return;
    }
    
    // The main process already filtered by display, so if we have an area, it's for this display
    console.log('🔍 [OVERLAY_JS] Setting up previous area for display:', displayInfo?.displayId);
    previousArea = area;
    hasPreviousArea = true;
    showPreviousArea(area);
    console.log('🔍 [OVERLAY_JS] Previous area setup complete');
  } catch (error) {
    console.error('🔍 [OVERLAY_JS] Error in initializePreviousArea:', error);
  }
  
  console.log('🔍 [OVERLAY_JS] ========== INITIALIZATION COMPLETE ==========');
}

document.addEventListener('mousedown', (e) => {
  // Check if clicking inside previous area
  if (isClickInsidePreviousArea(e.clientX, e.clientY)) {
    console.log('Clicked inside previous area, taking screenshot');
    // Send the previous area selection for screenshot
    if (window.electronAPI && previousArea) {
      window.electronAPI.sendAreaSelection(previousArea);
    }
    setTimeout(() => { window.close(); }, 100);
    return;
  }
  
  // Hide previous area when starting new selection
  if (hasPreviousArea) {
    hidePreviousArea();
    hasPreviousArea = false;
  }
  
  isSelecting = true;
  startX = endX = e.clientX;
  startY = endY = e.clientY;
  updateSelectionRect();
});

document.addEventListener('mousemove', (e) => {
  if (!isSelecting) return;
  endX = e.clientX;
  endY = e.clientY;
  updateSelectionRect();
});

document.addEventListener('mouseup', (e) => {
  if (!isSelecting) return;
  isSelecting = false;
  endX = e.clientX;
  endY = e.clientY;
  updateSelectionRect();
  const x = Math.min(startX, endX);
  const y = Math.min(startY, endY);
  const width = Math.abs(startX - endX);
  const height = Math.abs(startY - endY);
  if (width > 5 && height > 5) {
    // Send coordinates to main process
    console.log('Selection complete:', { x, y, width, height });
    if (window.electronAPI) {
      console.log('Calling electronAPI.sendAreaSelection()');
      window.electronAPI.sendAreaSelection({ x, y, width, height });
    } else {
      console.error('window.electronAPI is not available!');
    }
  }
  setTimeout(() => { window.close(); }, 100);
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    console.log('Escape key pressed, canceling area selection');
    if (window.electronAPI) {
      window.electronAPI.sendAreaSelection({ cancel: true });
    } else {
      console.error('window.electronAPI not available for cancel');
    }
    setTimeout(() => { window.close(); }, 50);
  }
});

// Initialize previous area when the page loads
window.addEventListener('load', () => {
  setTimeout(initializePreviousArea, 100);
});

// Also try to initialize immediately when script loads
setTimeout(() => {
  console.log('Attempting immediate initialization...');
  initializePreviousArea();
}, 500);
