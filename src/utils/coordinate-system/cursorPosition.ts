/**
 * Cursor position utilities for text editors and menus
 */

export interface CursorPosition {
  x: number;
  y: number;
  lineHeight: number;
  charWidth: number;
}

export interface CursorBounds {
  top: number;
  left: number;
  width: number;
  height: number;
}

/**
 * Calculate cursor position in pixels relative to the viewport
 */
export function getCursorPosition(
  element: HTMLTextAreaElement | HTMLInputElement,
  cursorIndex: number
): CursorPosition {
  const { left, top, width } = element.getBoundingClientRect();
  const styles = window.getComputedStyle(element);

  // Get font properties
  const fontSize = parseInt(styles.fontSize, 10);
  const fontFamily = styles.fontFamily;
  const lineHeight = parseFloat(styles.lineHeight) || fontSize * 1.2;

  // Create a hidden div to measure text dimensions
  const measuringDiv = document.createElement('div');
  measuringDiv.style.position = 'absolute';
  measuringDiv.style.left = '-9999px';
  measuringDiv.style.top = '-9999px';
  measuringDiv.style.fontSize = styles.fontSize;
  measuringDiv.style.fontFamily = fontFamily;
  measuringDiv.style.lineHeight = styles.lineHeight;
  measuringDiv.style.whiteSpace = 'pre-wrap';
  measuringDiv.style.wordWrap = 'break-word';
  measuringDiv.style.width = width + 'px';
  measuringDiv.style.padding = styles.padding;
  measuringDiv.style.border = styles.border;
  measuringDiv.style.boxSizing = styles.boxSizing;

  document.body.appendChild(measuringDiv);

  try {
    const textBeforeCursor = element.value.substring(0, cursorIndex);
    measuringDiv.textContent = textBeforeCursor;

    // Create a span to measure the exact cursor position
    const cursorSpan = document.createElement('span');
    cursorSpan.textContent = '|';
    cursorSpan.style.color = 'transparent';
    measuringDiv.appendChild(cursorSpan);

    const spanRect = cursorSpan.getBoundingClientRect();
    const divRect = measuringDiv.getBoundingClientRect();

    // Calculate relative position within the element
    const relativeX = spanRect.left - divRect.left;
    const relativeY = spanRect.top - divRect.top;

    // Get char width by measuring a single character
    const charSpan = document.createElement('span');
    charSpan.textContent = 'M';
    measuringDiv.appendChild(charSpan);
    const charRect = charSpan.getBoundingClientRect();
    const charWidth = charRect.width;

    return {
      x: left + relativeX + parseInt(styles.paddingLeft, 10),
      y: top + relativeY + parseInt(styles.paddingTop, 10),
      lineHeight,
      charWidth
    };
  } finally {
    document.body.removeChild(measuringDiv);
  }
}

/**
 * Calculate cursor position using a simpler approach for performance
 */
export function getCursorPositionFast(
  element: HTMLTextAreaElement | HTMLInputElement,
  cursorIndex: number
): CursorPosition {
  const { left, top } = element.getBoundingClientRect();
  const styles = window.getComputedStyle(element);

  // Get basic metrics
  const fontSize = parseInt(styles.fontSize, 10);
  const lineHeight = parseFloat(styles.lineHeight) || fontSize * 1.2;

  // Estimate character width (monospace approximation)
  const charWidth = fontSize * 0.6; // Approximate for most fonts

  // Count lines and characters
  const textBeforeCursor = element.value.substring(0, cursorIndex);
  const lines = textBeforeCursor.split('\n');
  const currentLine = lines[lines.length - 1];

  // Calculate position
  const lineNumber = lines.length - 1;
  const columnNumber = currentLine.length;

  return {
    x: left + (columnNumber * charWidth) + parseInt(styles.paddingLeft, 10),
    y: top + (lineNumber * lineHeight) + parseInt(styles.paddingTop, 10),
    lineHeight,
    charWidth
  };
}

/**
 * Get optimal menu position based on cursor position
 */
export function getMenuPosition(
  cursorPos: CursorPosition,
  menuWidth: number = 300,
  menuHeight: number = 200
): { x: number; y: number; placement: 'below' | 'above' } {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  // Calculate initial position below cursor
  let x = cursorPos.x;
  let y = cursorPos.y + cursorPos.lineHeight + 4; // 4px offset
  let placement: 'below' | 'above' = 'below';

  // Adjust X position if menu would overflow viewport
  if (x + menuWidth > viewportWidth - 20) {
    x = viewportWidth - menuWidth - 20;
  }

  if (x < 20) {
    x = 20;
  }

  // Check if menu would overflow bottom of viewport
  if (y + menuHeight > viewportHeight - 20) {
    // Try placing above cursor instead
    const yAbove = cursorPos.y - menuHeight - 4;
    if (yAbove > 20) {
      y = yAbove;
      placement = 'above';
    } else {
      // If neither position works, use the position with more space
      const spaceBelow = viewportHeight - (cursorPos.y + cursorPos.lineHeight);
      const spaceAbove = cursorPos.y;

      if (spaceAbove > spaceBelow) {
        y = Math.max(20, cursorPos.y - menuHeight);
        placement = 'above';
      } else {
        y = Math.min(viewportHeight - menuHeight - 20, cursorPos.y + cursorPos.lineHeight);
        placement = 'below';
      }
    }
  }

  return { x, y, placement };
}

/**
 * Get cursor bounds for range selection visualization
 */
export function getCursorBounds(
  element: HTMLTextAreaElement | HTMLInputElement,
  startIndex: number,
  endIndex: number
): CursorBounds[] {
  const startPos = getCursorPosition(element, startIndex);
  const endPos = getCursorPosition(element, endIndex);

  if (startPos.y === endPos.y) {
    // Single line selection
    return [{
      top: startPos.y,
      left: startPos.x,
      width: endPos.x - startPos.x,
      height: startPos.lineHeight
    }];
  } else {
    // Multi-line selection
    const bounds: CursorBounds[] = [];
    const { width: elementWidth } = element.getBoundingClientRect();

    // First line
    bounds.push({
      top: startPos.y,
      left: startPos.x,
      width: elementWidth - startPos.x,
      height: startPos.lineHeight
    });

    // Middle lines (if any)
    const lineCount = Math.floor((endPos.y - startPos.y) / startPos.lineHeight);
    for (let i = 1; i < lineCount; i++) {
      bounds.push({
        top: startPos.y + (i * startPos.lineHeight),
        left: startPos.x - (startPos.x % elementWidth), // Start of line
        width: elementWidth,
        height: startPos.lineHeight
      });
    }

    // Last line
    if (lineCount > 0) {
      bounds.push({
        top: endPos.y,
        left: startPos.x - (startPos.x % elementWidth), // Start of line
        width: endPos.x - (startPos.x - (startPos.x % elementWidth)),
        height: endPos.lineHeight
      });
    }

    return bounds;
  }
}