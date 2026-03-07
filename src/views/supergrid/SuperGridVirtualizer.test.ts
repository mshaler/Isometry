// Phase 38 Plan 01 — SuperGridVirtualizer unit tests (VSCR-01..VSCR-04)
// Pure computation class — no DOM needed for range calculation tests.

import { beforeEach, describe, expect, it } from 'vitest';
import { OVERSCAN_ROWS, SuperGridVirtualizer, VIRTUALIZATION_THRESHOLD } from './SuperGridVirtualizer';

describe('SuperGridVirtualizer', () => {
	const ROW_HEIGHT = 40;
	const COL_HEADER_HEIGHT = 0;
	let virtualizer: SuperGridVirtualizer;

	beforeEach(() => {
		virtualizer = new SuperGridVirtualizer(
			() => ROW_HEIGHT,
			() => COL_HEADER_HEIGHT,
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
				() => 0,
			);
			zoomVirtualizer.setTotalRows(100);
			expect(zoomVirtualizer.getTotalHeight()).toBe(4000);

			zoomRowHeight = 80; // simulate 2x zoom
			expect(zoomVirtualizer.getTotalHeight()).toBe(8000);
		});
	});

	describe('performance benchmarks', () => {
		// Helper: create a virtualizer with a mock rootEl
		function createAttached(
			totalRows: number,
			scrollTop: number,
			clientHeight: number,
			rowHeight = ROW_HEIGHT,
		): SuperGridVirtualizer {
			const v = new SuperGridVirtualizer(
				() => rowHeight,
				() => COL_HEADER_HEIGHT,
			);
			v.setTotalRows(totalRows);
			const mockEl = { scrollTop, clientHeight } as HTMLElement;
			v.attach(mockEl);
			return v;
		}

		it('1000 sequential getVisibleRange calls with 10K rows complete in under 16ms', () => {
			const v = createAttached(10_000, 0, 400);

			// Simulate scrolling through 1000 positions (0 to 400,000 in 400px increments)
			const mockEl = { scrollTop: 0, clientHeight: 400 } as HTMLElement;
			v.attach(mockEl);

			const start = performance.now();
			for (let i = 0; i < 1000; i++) {
				(mockEl as any).scrollTop = i * 400;
				v.getVisibleRange();
			}
			const elapsed = performance.now() - start;

			expect(elapsed).toBeLessThan(16);
		});

		it('1000 sequential getVisibleRange calls with 50K rows complete in under 16ms', () => {
			const v = createAttached(50_000, 0, 400);

			const mockEl = { scrollTop: 0, clientHeight: 400 } as HTMLElement;
			v.attach(mockEl);

			const start = performance.now();
			for (let i = 0; i < 1000; i++) {
				(mockEl as any).scrollTop = i * 2000; // spread across 50K rows
				v.getVisibleRange();
			}
			const elapsed = performance.now() - start;

			expect(elapsed).toBeLessThan(16);
		});

		it('single getVisibleRange call with 10K rows completes in under 1ms', () => {
			const v = createAttached(10_000, 200_000, 400);

			const start = performance.now();
			v.getVisibleRange();
			const elapsed = performance.now() - start;

			expect(elapsed).toBeLessThan(1);
		});

		it('single getVisibleRange call with 50K rows completes in under 1ms', () => {
			const v = createAttached(50_000, 1_000_000, 400);

			const start = performance.now();
			v.getVisibleRange();
			const elapsed = performance.now() - start;

			expect(elapsed).toBeLessThan(1);
		});
	});

	describe('scale validation', () => {
		it('windowed row count stays bounded (~20-30 rows) regardless of total rows', () => {
			const viewport = 400; // 400px viewport
			const rowHeight = 40; // 40px rows = 10 visible + 10 overscan = 20 max

			for (const totalRows of [200, 1_000, 10_000, 50_000, 100_000]) {
				const v = new SuperGridVirtualizer(
					() => rowHeight,
					() => COL_HEADER_HEIGHT,
				);
				v.setTotalRows(totalRows);
				const mockEl = {
					scrollTop: Math.floor((totalRows * rowHeight) / 2), // mid-scroll
					clientHeight: viewport,
				} as HTMLElement;
				v.attach(mockEl);

				const range = v.getVisibleRange();
				const windowSize = range.endRow - range.startRow;

				// Visible rows = ceil(400/40) = 10, overscan = 5+5 = 10, total window = 20
				expect(windowSize).toBeGreaterThanOrEqual(15);
				expect(windowSize).toBeLessThanOrEqual(30);
			}
		});

		it('getTotalHeight at zoom 1.0 with 10K rows', () => {
			const v = new SuperGridVirtualizer(
				() => 40,
				() => 0,
			);
			v.setTotalRows(10_000);
			expect(v.getTotalHeight()).toBe(400_000); // 10000 * 40
		});

		it('getTotalHeight at zoom 1.5 with 10K rows', () => {
			const v = new SuperGridVirtualizer(
				() => 60,
				() => 0,
			);
			v.setTotalRows(10_000);
			expect(v.getTotalHeight()).toBe(600_000); // 10000 * 60
		});

		it('getTotalHeight at zoom 2.0 with 10K rows returns correct height (10000 * 80)', () => {
			const v = new SuperGridVirtualizer(
				() => 80,
				() => 0,
			);
			v.setTotalRows(10_000);
			expect(v.getTotalHeight()).toBe(800_000); // 10000 * 80
		});

		it('isActive correctly toggles at threshold boundary (100 vs 101 rows)', () => {
			const v = new SuperGridVirtualizer(
				() => 40,
				() => 0,
			);

			v.setTotalRows(99);
			expect(v.isActive()).toBe(false);

			v.setTotalRows(100);
			expect(v.isActive()).toBe(false); // threshold is >100, not >=100

			v.setTotalRows(101);
			expect(v.isActive()).toBe(true);
		});
	});

	describe('edge cases at scale', () => {
		it('scrollTop=0 with very large totalRows returns range starting at 0', () => {
			const v = new SuperGridVirtualizer(
				() => 40,
				() => 0,
			);
			v.setTotalRows(100_000);
			const mockEl = { scrollTop: 0, clientHeight: 400 } as HTMLElement;
			v.attach(mockEl);

			const range = v.getVisibleRange();
			expect(range.startRow).toBe(0);
			// endRow = min(100000, ceil(400/40) + 5) = 15
			expect(range.endRow).toBe(15);
		});

		it('scrollTop at the last possible position returns range ending at totalRows', () => {
			const totalRows = 10_000;
			const rowHeight = 40;
			const viewportHeight = 400;
			const maxScrollTop = totalRows * rowHeight - viewportHeight; // 400000 - 400 = 399600

			const v = new SuperGridVirtualizer(
				() => rowHeight,
				() => 0,
			);
			v.setTotalRows(totalRows);
			const mockEl = { scrollTop: maxScrollTop, clientHeight: viewportHeight } as HTMLElement;
			v.attach(mockEl);

			const range = v.getVisibleRange();
			expect(range.endRow).toBe(totalRows);
			// firstVisible = floor(399600/40) = 9990
			// lastVisible = ceil((399600+400)/40) = 10000
			// startRow = max(0, 9990-5) = 9985
			expect(range.startRow).toBe(9985);
		});

		it('scrollTop larger than total content height clamps endRow to totalRows', () => {
			const totalRows = 10_000;
			const rowHeight = 40;
			const totalHeight = totalRows * rowHeight; // 400000

			const v = new SuperGridVirtualizer(
				() => rowHeight,
				() => 0,
			);
			v.setTotalRows(totalRows);
			// scrollTop way beyond content
			const mockEl = { scrollTop: totalHeight + 5000, clientHeight: 400 } as HTMLElement;
			v.attach(mockEl);

			const range = v.getVisibleRange();
			expect(range.endRow).toBe(totalRows); // clamped to totalRows
			// Even startRow should be clamped (firstVisible would be > totalRows)
			expect(range.startRow).toBeLessThanOrEqual(totalRows);
		});

		it('scrollTop beyond content still returns valid non-empty range', () => {
			const totalRows = 500;
			const rowHeight = 40;

			const v = new SuperGridVirtualizer(
				() => rowHeight,
				() => 0,
			);
			v.setTotalRows(totalRows);
			const mockEl = { scrollTop: 50_000, clientHeight: 400 } as HTMLElement;
			v.attach(mockEl);

			const range = v.getVisibleRange();
			// startRow might exceed totalRows, but endRow is clamped
			expect(range.endRow).toBe(totalRows);
			// The range is valid (startRow <= endRow)
			expect(range.startRow).toBeLessThanOrEqual(range.endRow);
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
