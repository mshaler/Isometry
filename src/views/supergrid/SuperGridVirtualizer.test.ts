// Phase 38 Plan 01 — SuperGridVirtualizer unit tests (VSCR-01..VSCR-04)
// Pure computation class — no DOM needed for range calculation tests.

import { describe, it, expect, beforeEach } from 'vitest';
import {
  SuperGridVirtualizer,
  VIRTUALIZATION_THRESHOLD,
  OVERSCAN_ROWS,
} from './SuperGridVirtualizer';

describe('SuperGridVirtualizer', () => {
  const ROW_HEIGHT = 40;
  const COL_HEADER_HEIGHT = 0;
  let virtualizer: SuperGridVirtualizer;

  beforeEach(() => {
    virtualizer = new SuperGridVirtualizer(
      () => ROW_HEIGHT,
      () => COL_HEADER_HEIGHT
    );
  });

  describe('constants', () => {
    it('exports VIRTUALIZATION_THRESHOLD as 100', () => {
      expect(VIRTUALIZATION_THRESHOLD).toBe(100);
    });

    it('exports OVERSCAN_ROWS as 5', () => {
      expect(OVERSCAN_ROWS).toBe(5);
    });
  });

  describe('isActive', () => {
    it('returns false when totalRows <= 100', () => {
      virtualizer.setTotalRows(100);
      expect(virtualizer.isActive()).toBe(false);
    });

    it('returns true when totalRows > 100', () => {
      virtualizer.setTotalRows(101);
      expect(virtualizer.isActive()).toBe(true);
    });

    it('returns false when totalRows is 0', () => {
      expect(virtualizer.isActive()).toBe(false);
    });
  });

  describe('getVisibleRange — inactive', () => {
    it('returns {0, totalRows} when inactive (<=100 rows)', () => {
      virtualizer.setTotalRows(50);
      const range = virtualizer.getVisibleRange();
      expect(range).toEqual({ startRow: 0, endRow: 50 });
    });

    it('returns {0, 0} when no rows set', () => {
      const range = virtualizer.getVisibleRange();
      expect(range).toEqual({ startRow: 0, endRow: 0 });
    });
  });

  describe('getVisibleRange — active (with mock rootEl)', () => {
    // Create a minimal mock of the root element for scroll/viewport calculations
    function attachMockRoot(scrollTop: number, clientHeight: number) {
      const mockEl = {
        scrollTop,
        clientHeight,
      } as HTMLElement;
      virtualizer.attach(mockEl);
    }

    it('returns correct range for scrollTop=0, viewport=400px, rowHeight=40px', () => {
      virtualizer.setTotalRows(500);
      attachMockRoot(0, 400);

      const range = virtualizer.getVisibleRange();
      // First visible = floor(0 / 40) = 0
      // Last visible = ceil((0 + 400) / 40) = 10
      // With overscan: startRow = max(0, 0-5) = 0, endRow = min(500, 10+5) = 15
      expect(range.startRow).toBe(0);
      expect(range.endRow).toBe(15);
    });

    it('clamps startRow to 0 when overscan would go negative', () => {
      virtualizer.setTotalRows(500);
      attachMockRoot(80, 400); // scrollTop=80 → firstVisible=2, 2-5=-3 → clamped to 0

      const range = virtualizer.getVisibleRange();
      expect(range.startRow).toBe(0);
    });

    it('clamps endRow to totalRows when overscan would exceed', () => {
      virtualizer.setTotalRows(200);
      attachMockRoot(7600, 400);
      // scrollTop=7600, viewport=400, rowHeight=40
      // firstVisible = floor(7600/40) = 190
      // lastVisible = ceil((7600+400)/40) = 200
      // endRow = min(200, 200+5) = 200

      const range = virtualizer.getVisibleRange();
      expect(range.endRow).toBe(200);
    });

    it('returns correct mid-scroll range (scrollTop=2000, viewport=400, rowHeight=40)', () => {
      virtualizer.setTotalRows(500);
      attachMockRoot(2000, 400);

      const range = virtualizer.getVisibleRange();
      // firstVisible = floor(2000/40) = 50
      // lastVisible = ceil((2000+400)/40) = 60
      // startRow = max(0, 50-5) = 45
      // endRow = min(500, 60+5) = 65
      expect(range.startRow).toBe(45);
      expect(range.endRow).toBe(65);
    });
  });

  describe('setTotalRows', () => {
    it('updates state and isActive reflects new count', () => {
      virtualizer.setTotalRows(50);
      expect(virtualizer.isActive()).toBe(false);

      virtualizer.setTotalRows(200);
      expect(virtualizer.isActive()).toBe(true);

      virtualizer.setTotalRows(100);
      expect(virtualizer.isActive()).toBe(false);
    });
  });

  describe('getTotalHeight', () => {
    it('returns totalRows * rowHeight', () => {
      virtualizer.setTotalRows(250);
      expect(virtualizer.getTotalHeight()).toBe(250 * 40);
    });

    it('returns 0 when no rows', () => {
      expect(virtualizer.getTotalHeight()).toBe(0);
    });

    it('is zoom-aware (uses getRowHeight callback)', () => {
      let zoomRowHeight = 40;
      const zoomVirtualizer = new SuperGridVirtualizer(
        () => zoomRowHeight,
        () => 0
      );
      zoomVirtualizer.setTotalRows(100);
      expect(zoomVirtualizer.getTotalHeight()).toBe(4000);

      zoomRowHeight = 80; // simulate 2x zoom
      expect(zoomVirtualizer.getTotalHeight()).toBe(8000);
    });
  });

  describe('detach', () => {
    it('after detach(), getVisibleRange returns full range (0..totalRows) regardless of totalRows', () => {
      virtualizer.setTotalRows(500);
      const mockEl = { scrollTop: 2000, clientHeight: 400 } as HTMLElement;
      virtualizer.attach(mockEl);

      // Before detach: should return windowed range
      const rangeBefore = virtualizer.getVisibleRange();
      expect(rangeBefore.startRow).toBeGreaterThan(0);

      // After detach: should return full range because rootEl is null
      virtualizer.detach();
      const rangeAfter = virtualizer.getVisibleRange();
      expect(rangeAfter).toEqual({ startRow: 0, endRow: 0 });
      // totalRows was reset to 0 by detach
    });

    it('resets totalRows to 0', () => {
      virtualizer.setTotalRows(500);
      expect(virtualizer.isActive()).toBe(true);

      virtualizer.detach();
      expect(virtualizer.isActive()).toBe(false);
    });
  });
});
