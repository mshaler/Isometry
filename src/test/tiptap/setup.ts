/**
 * TipTap/ProseMirror JSDOM Mocks
 *
 * Phase 112-03: Test infrastructure for TipTap extensions
 *
 * ProseMirror relies on browser layout APIs that JSDOM doesn't implement.
 * These mocks provide minimal implementations to allow TipTap tests to run.
 */

// Mock getBoundingClientRect for HTMLElement
// ProseMirror uses this for positioning and coordinate calculations
const mockBoundingClientRect: DOMRect = {
  x: 0,
  y: 0,
  width: 0,
  height: 0,
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
  toJSON: () => ({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  }),
};

// Mock getBoundingClientRect on HTMLElement prototype if not already mocked
const htmlGetBounding = HTMLElement.prototype.getBoundingClientRect;
if (!htmlGetBounding || htmlGetBounding.toString().includes('[native code]')) {
  HTMLElement.prototype.getBoundingClientRect = function () {
    return mockBoundingClientRect;
  };
}

// Mock getClientRects for Range
// ProseMirror uses this for selection rectangles
class FakeDOMRectList extends Array<DOMRect> {
  item(index: number): DOMRect | null {
    return this[index] ?? null;
  }
}

// Safe check for Range.prototype methods (JSDOM may not have them)
const rangeGetClientRects = Range.prototype.getClientRects;
if (!rangeGetClientRects) {
  // No getClientRects at all - add our mock directly
  Range.prototype.getClientRects = function (): DOMRectList {
    const list = new FakeDOMRectList();
    return list as unknown as DOMRectList;
  };
} else if (!rangeGetClientRects.toString().includes('FakeDOMRectList')) {
  // Has native implementation - wrap it
  Range.prototype.getClientRects = function (): DOMRectList {
    try {
      return rangeGetClientRects.call(this);
    } catch {
      // JSDOM doesn't properly implement getClientRects
      const list = new FakeDOMRectList();
      return list as unknown as DOMRectList;
    }
  };
}

// Mock getBoundingClientRect for Range
const rangeGetBounding = Range.prototype.getBoundingClientRect;
if (!rangeGetBounding) {
  // No getBoundingClientRect - add mock directly
  Range.prototype.getBoundingClientRect = function (): DOMRect {
    return mockBoundingClientRect;
  };
} else if (!rangeGetBounding.toString().includes('mockBoundingClientRect')) {
  // Has native implementation - wrap it
  Range.prototype.getBoundingClientRect = function (): DOMRect {
    try {
      return rangeGetBounding.call(this);
    } catch {
      // JSDOM throws on collapsed ranges
      return mockBoundingClientRect;
    }
  };
}

// Mock document.elementFromPoint (already in main setup, ensure for TipTap)
if (!document.elementFromPoint) {
  document.elementFromPoint = (_x: number, _y: number): Element | null => null;
}

// Mock document.caretPositionFromPoint (used by some ProseMirror code paths)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
if (!(document as any).caretPositionFromPoint) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (document as any).caretPositionFromPoint = (_x: number, _y: number) => null;
}

// Mock document.caretRangeFromPoint (WebKit-specific)
if (!document.caretRangeFromPoint) {
  document.caretRangeFromPoint = (_x: number, _y: number) => null;
}

// Mock window.getSelection modifications for ProseMirror
const originalGetSelection = window.getSelection;
if (originalGetSelection) {
  window.getSelection = function (): Selection | null {
    const selection = originalGetSelection.call(window);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (selection && !(selection as any).modify) {
      // Add modify method stub (used by some ProseMirror selection code)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (selection as any).modify = () => {};
    }
    return selection;
  };
}

// Mock scrollIntoView for editor scrolling behavior
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = function () {
    // No-op in JSDOM test environment
  };
}

// Export nothing - this is a side-effect only module
export {};
