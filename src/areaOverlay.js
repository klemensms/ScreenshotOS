let isSelecting = false;
let startX = 0, startY = 0, endX = 0, endY = 0;
const selection = document.getElementById('selection');

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

document.addEventListener('mousedown', (e) => {
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
    if (window.electronAPI) {
      window.electronAPI.sendAreaSelection({ cancel: true });
    }
    setTimeout(() => { window.close(); }, 50);
  }
});
