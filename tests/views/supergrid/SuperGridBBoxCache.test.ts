// @vitest-environment jsdom
// tests/views/supergrid/SuperGridBBoxCache.test.ts
// Unit tests for SuperGridBBoxCache — post-render bounding box cache with hitTest
// Requirements: SLCT-08

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SuperGridBBoxCache, rectsIntersect } from '../../../src/views/supergrid/SuperGridBBoxCache';

// ---------------------------------------------------------------------------
// rectsIntersect — pure function tests
// ---------------------------------------------------------------------------

describe('rectsIntersect', () => {
  it('returns true for two overlapping rects', () => {
    const a = { x: 0, y: 0, w: 10, h: 10 };
    const b = { x: 5, y: 5, width: 10, height: 10 };
    expect(rectsIntersect(a, b)).toBe(true);
  });

  it('returns false for two non-overlapping rects (horizontal gap)', () => {
    const a = { x: 0, y: 0, w: 10, h: 10 };
    const b = { x: 20, y: 0, width: 10, height: 10 };
    expect(rectsIntersect(a, b)).toBe(false);
  });

  it('returns false for two non-overlapping rects (vertical gap)', () => {
    const a = { x: 0, y: 0, w: 10, h: 10 };
    const b = { x: 0, y: 20, width: 10, height: 10 };
    expect(rectsIntersect(a, b)).toBe(false);
  });

  it('returns false for edge-touching rects (exclusive bounds)', () => {
    // a ends at x=10, b starts at x=10 → touching but not overlapping
    const a = { x: 0, y: 0, w: 10, h: 10 };
    const b = { x: 10, y: 0, width: 10, height: 10 };
    expect(rectsIntersect(a, b)).toBe(false);
  });

  it('returns false for edge-touching rects vertically (exclusive bounds)', () => {
    // a ends at y=10, b starts at y=10 → touching but not overlapping
    const a = { x: 0, y: 0, w: 10, h: 10 };
    const b = { x: 0, y: 10, width: 10, height: 10 };
    expect(rectsIntersect(a, b)).toBe(false);
  });

  it('returns true for one rect fully inside another', () => {
    const a = { x: 2, y: 2, w: 6, h: 6 };
    const b = { x: 0, y: 0, width: 10, height: 10 };
    expect(rectsIntersect(a, b)).toBe(true);
  });

  it('returns true for partial overlap (a partially inside b)', () => {
    const a = { x: 8, y: 8, w: 10, h: 10 };
    const b = { x: 0, y: 0, width: 10, height: 10 };
    expect(rectsIntersect(a, b)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// SuperGridBBoxCache — attach/detach lifecycle
// ---------------------------------------------------------------------------

describe('SuperGridBBoxCache attach/detach lifecycle', () => {
  let cache: SuperGridBBoxCache;
  let gridEl: HTMLElement;

  beforeEach(() => {
    vi.useFakeTimers();
    cache = new SuperGridBBoxCache();
    gridEl = document.createElement('div');
    document.body.appendChild(gridEl);
  });

  afterEach(() => {
    document.body.removeChild(gridEl);
    vi.useRealTimers();
  });

  it('hitTest returns empty array when not attached', () => {
    const hits = cache.hitTest({ x: 0, y: 0, w: 1000, h: 1000 });
    expect(hits).toEqual([]);
  });

  it('after detach, cache is cleared and hitTest returns []', () => {
    cache.attach(gridEl);

    // Add a cell with known position
    const cell = document.createElement('div');
    cell.className = 'data-cell';
    cell.dataset['key'] = 'row1:col1';
    vi.spyOn(cell, 'getBoundingClientRect').mockReturnValue(
      new DOMRect(10, 10, 100, 50)
    );
    gridEl.appendChild(cell);

    // Schedule snapshot and flush rAF
    cache.scheduleSnapshot();
    vi.advanceTimersToNextTimer();

    // Verify cache is populated
    expect(cache.hitTest({ x: 0, y: 0, w: 200, h: 200 })).toContain('row1:col1');

    // Detach and verify cache is cleared
    cache.detach();
    expect(cache.hitTest({ x: 0, y: 0, w: 200, h: 200 })).toEqual([]);
  });

  it('after detach, scheduleSnapshot is a no-op', () => {
    cache.attach(gridEl);
    cache.detach();

    const cell = document.createElement('div');
    cell.className = 'data-cell';
    cell.dataset['key'] = 'row1:col1';
    vi.spyOn(cell, 'getBoundingClientRect').mockReturnValue(
      new DOMRect(10, 10, 100, 50)
    );
    gridEl.appendChild(cell);

    // scheduleSnapshot after detach should do nothing
    cache.scheduleSnapshot();
    vi.advanceTimersToNextTimer();

    expect(cache.hitTest({ x: 0, y: 0, w: 200, h: 200 })).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// SuperGridBBoxCache — scheduleSnapshot
// ---------------------------------------------------------------------------

describe('SuperGridBBoxCache scheduleSnapshot', () => {
  let cache: SuperGridBBoxCache;
  let gridEl: HTMLElement;

  beforeEach(() => {
    vi.useFakeTimers();
    cache = new SuperGridBBoxCache();
    gridEl = document.createElement('div');
    document.body.appendChild(gridEl);
    cache.attach(gridEl);
  });

  afterEach(() => {
    document.body.removeChild(gridEl);
    vi.useRealTimers();
  });

  it('populates cache from .data-cell elements with dataset key', () => {
    const cell = document.createElement('div');
    cell.className = 'data-cell';
    cell.dataset['key'] = 'rowA:colB';
    vi.spyOn(cell, 'getBoundingClientRect').mockReturnValue(
      new DOMRect(50, 100, 120, 60)
    );
    gridEl.appendChild(cell);

    cache.scheduleSnapshot();
    vi.advanceTimersToNextTimer();

    const rect = cache.getRect('rowA:colB');
    expect(rect).toBeDefined();
    expect(rect?.x).toBe(50);
    expect(rect?.y).toBe(100);
    expect(rect?.width).toBe(120);
    expect(rect?.height).toBe(60);
  });

  it('populates cache with multiple cells', () => {
    const keys = ['row1:col1', 'row1:col2', 'row2:col1'];
    keys.forEach((key, i) => {
      const cell = document.createElement('div');
      cell.className = 'data-cell';
      cell.dataset['key'] = key;
      vi.spyOn(cell, 'getBoundingClientRect').mockReturnValue(
        new DOMRect(i * 100, 0, 90, 50)
      );
      gridEl.appendChild(cell);
    });

    cache.scheduleSnapshot();
    vi.advanceTimersToNextTimer();

    expect(cache.getRect('row1:col1')).toBeDefined();
    expect(cache.getRect('row1:col2')).toBeDefined();
    expect(cache.getRect('row2:col1')).toBeDefined();
  });

  it('overwrites previous cache entries on second scheduleSnapshot call', () => {
    const cell = document.createElement('div');
    cell.className = 'data-cell';
    cell.dataset['key'] = 'rowA:colB';
    const spy = vi.spyOn(cell, 'getBoundingClientRect').mockReturnValue(
      new DOMRect(10, 10, 80, 40)
    );
    gridEl.appendChild(cell);

    cache.scheduleSnapshot();
    vi.advanceTimersToNextTimer();

    // First snapshot
    expect(cache.getRect('rowA:colB')?.x).toBe(10);

    // Update mock to return different rect
    spy.mockReturnValue(new DOMRect(200, 200, 80, 40));

    cache.scheduleSnapshot();
    vi.advanceTimersToNextTimer();

    // Second snapshot overwrites
    expect(cache.getRect('rowA:colB')?.x).toBe(200);
  });

  it('ignores elements without dataset key', () => {
    const cellNoKey = document.createElement('div');
    cellNoKey.className = 'data-cell';
    // No dataset['key'] set
    vi.spyOn(cellNoKey, 'getBoundingClientRect').mockReturnValue(
      new DOMRect(0, 0, 100, 50)
    );
    gridEl.appendChild(cellNoKey);

    const cellWithKey = document.createElement('div');
    cellWithKey.className = 'data-cell';
    cellWithKey.dataset['key'] = 'validKey';
    vi.spyOn(cellWithKey, 'getBoundingClientRect').mockReturnValue(
      new DOMRect(0, 0, 100, 50)
    );
    gridEl.appendChild(cellWithKey);

    cache.scheduleSnapshot();
    vi.advanceTimersToNextTimer();

    // Only the cell with a key should be cached
    const keys = cache.hitTest({ x: -1000, y: -1000, w: 10000, h: 10000 });
    expect(keys).toEqual(['validKey']);
  });

  it('removes stale keys when cells are removed before second snapshot', () => {
    const cell1 = document.createElement('div');
    cell1.className = 'data-cell';
    cell1.dataset['key'] = 'row1:col1';
    vi.spyOn(cell1, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 100, 50));
    gridEl.appendChild(cell1);

    const cell2 = document.createElement('div');
    cell2.className = 'data-cell';
    cell2.dataset['key'] = 'row2:col1';
    vi.spyOn(cell2, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 60, 100, 50));
    gridEl.appendChild(cell2);

    cache.scheduleSnapshot();
    vi.advanceTimersToNextTimer();

    // Both in cache
    expect(cache.getRect('row1:col1')).toBeDefined();
    expect(cache.getRect('row2:col1')).toBeDefined();

    // Remove cell2 and re-snapshot
    gridEl.removeChild(cell2);
    cache.scheduleSnapshot();
    vi.advanceTimersToNextTimer();

    // cell1 still in cache, cell2 removed
    expect(cache.getRect('row1:col1')).toBeDefined();
    expect(cache.getRect('row2:col1')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// SuperGridBBoxCache — hitTest
// ---------------------------------------------------------------------------

describe('SuperGridBBoxCache hitTest', () => {
  let cache: SuperGridBBoxCache;
  let gridEl: HTMLElement;

  beforeEach(() => {
    vi.useFakeTimers();
    cache = new SuperGridBBoxCache();
    gridEl = document.createElement('div');
    document.body.appendChild(gridEl);
    cache.attach(gridEl);
  });

  afterEach(() => {
    document.body.removeChild(gridEl);
    vi.useRealTimers();
  });

  function addCell(key: string, x: number, y: number, w: number, h: number): void {
    const cell = document.createElement('div');
    cell.className = 'data-cell';
    cell.dataset['key'] = key;
    vi.spyOn(cell, 'getBoundingClientRect').mockReturnValue(new DOMRect(x, y, w, h));
    gridEl.appendChild(cell);
  }

  it('returns empty array when cache is empty', () => {
    expect(cache.hitTest({ x: 0, y: 0, w: 1000, h: 1000 })).toEqual([]);
  });

  it('returns empty array when no cells intersect', () => {
    addCell('row1:col1', 500, 500, 100, 50);
    cache.scheduleSnapshot();
    vi.advanceTimersToNextTimer();

    const hits = cache.hitTest({ x: 0, y: 0, w: 100, h: 100 });
    expect(hits).toEqual([]);
  });

  it('returns matching cell key for intersecting rectangle', () => {
    addCell('row1:col1', 10, 10, 100, 50);
    cache.scheduleSnapshot();
    vi.advanceTimersToNextTimer();

    const hits = cache.hitTest({ x: 0, y: 0, w: 50, h: 50 });
    expect(hits).toContain('row1:col1');
  });

  it('returns all intersecting keys when multiple cells overlap lasso', () => {
    addCell('row1:col1', 0, 0, 100, 50);
    addCell('row1:col2', 110, 0, 100, 50);
    addCell('row2:col1', 0, 60, 100, 50);
    cache.scheduleSnapshot();
    vi.advanceTimersToNextTimer();

    // Lasso covers first two cells but not row2:col1
    const hits = cache.hitTest({ x: 0, y: 0, w: 250, h: 55 });
    expect(hits).toContain('row1:col1');
    expect(hits).toContain('row1:col2');
    expect(hits).not.toContain('row2:col1');
  });

  it('handles partial overlap correctly', () => {
    // Cell at 80,0 size 100x50 — lasso ends at x=100
    addCell('row1:col1', 80, 0, 100, 50);
    cache.scheduleSnapshot();
    vi.advanceTimersToNextTimer();

    // Lasso from 0 to 90 (partial overlap with cell starting at 80)
    const hits = cache.hitTest({ x: 0, y: 0, w: 90, h: 60 });
    expect(hits).toContain('row1:col1');
  });

  it('hitTest never reads from DOM (no getBoundingClientRect calls after snapshot)', () => {
    const cell = document.createElement('div');
    cell.className = 'data-cell';
    cell.dataset['key'] = 'r:c';
    const spy = vi.spyOn(cell, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 100, 50));
    gridEl.appendChild(cell);

    cache.scheduleSnapshot();
    vi.advanceTimersToNextTimer();

    const callCountAfterSnapshot = spy.mock.calls.length;

    // Multiple hitTest calls should NOT call getBoundingClientRect again
    cache.hitTest({ x: 0, y: 0, w: 200, h: 200 });
    cache.hitTest({ x: 50, y: 0, w: 200, h: 200 });
    cache.hitTest({ x: 1000, y: 0, w: 10, h: 10 });

    expect(spy.mock.calls.length).toBe(callCountAfterSnapshot);
  });
});

// ---------------------------------------------------------------------------
// SuperGridBBoxCache — getRect
// ---------------------------------------------------------------------------

describe('SuperGridBBoxCache getRect', () => {
  let cache: SuperGridBBoxCache;
  let gridEl: HTMLElement;

  beforeEach(() => {
    vi.useFakeTimers();
    cache = new SuperGridBBoxCache();
    gridEl = document.createElement('div');
    document.body.appendChild(gridEl);
    cache.attach(gridEl);
  });

  afterEach(() => {
    document.body.removeChild(gridEl);
    vi.useRealTimers();
  });

  it('returns DOMRect for a cached key', () => {
    const cell = document.createElement('div');
    cell.className = 'data-cell';
    cell.dataset['key'] = 'row1:col1';
    vi.spyOn(cell, 'getBoundingClientRect').mockReturnValue(new DOMRect(30, 40, 120, 60));
    gridEl.appendChild(cell);

    cache.scheduleSnapshot();
    vi.advanceTimersToNextTimer();

    const rect = cache.getRect('row1:col1');
    expect(rect).toBeDefined();
    expect(rect?.x).toBe(30);
    expect(rect?.y).toBe(40);
    expect(rect?.width).toBe(120);
    expect(rect?.height).toBe(60);
  });

  it('returns undefined for an unknown key', () => {
    const result = cache.getRect('nonexistent:key');
    expect(result).toBeUndefined();
  });

  it('returns undefined after detach even if key was previously cached', () => {
    const cell = document.createElement('div');
    cell.className = 'data-cell';
    cell.dataset['key'] = 'row1:col1';
    vi.spyOn(cell, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 100, 50));
    gridEl.appendChild(cell);

    cache.scheduleSnapshot();
    vi.advanceTimersToNextTimer();

    expect(cache.getRect('row1:col1')).toBeDefined();

    cache.detach();
    expect(cache.getRect('row1:col1')).toBeUndefined();
  });
});
