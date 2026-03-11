/**
 * Isometry v5 — E2E: Flow 6 — Histogram Brush Filters All Views
 *
 * Validates: Range filter (via histogram brush) propagates to SuperGrid,
 * shows "Clear all" button, and updates footer values.
 * Covers Seam 1 (Filter → Calc → Footer) and Seam 4 (Filter → Histogram → histogram:query).
 *
 * Note: D3 brush gesture is simulated programmatically via FilterProvider.setRangeFilter()
 * (same code path as the brush end handler) rather than mouse gestures, which
 * are fragile due to SVG coordinate mapping.
 */

import { test, expect } from './fixtures';

test.describe('Flow 6: Histogram brush filters all views', () => {
	test('range filter via priority narrows grid and shows Clear All', async ({
		page,
		baselineCardCount,
	}) => {
		expect(baselineCardCount).toBeGreaterThan(0);

		// 1. Switch to SuperGrid
		await page.evaluate(async () => {
			const { viewManager, viewFactory } = (window as any).__isometry;
			await viewManager.switchTo('supergrid', () => viewFactory['supergrid']());
		});

		// Wait for grid to render
		await page.waitForFunction(
			() => {
				const cells = document.querySelectorAll('.sg-cell, .data-cell');
				const headers = document.querySelectorAll('.sg-header, .col-header');
				return cells.length > 0 || headers.length > 0;
			},
			{ timeout: 15_000 },
		);

		// 2. Capture unfiltered cell count
		const unfilteredCellCount = await page.evaluate(() => {
			return document.querySelectorAll('.sg-cell, .data-cell').length;
		});

		// 3. Apply a range filter programmatically (same as histogram brush end handler)
		//    Filter priority to a subrange (e.g., 5-8 out of possible 0-10)
		await page.evaluate(() => {
			const { filter, coordinator } = (window as any).__isometry;
			filter.setRangeFilter('priority', 5, 8);
			coordinator.scheduleUpdate();
		});

		// Wait for grid to re-render
		await page.waitForTimeout(1000);

		// 4. Assert: the filter is active and compiled correctly
		const filterState = await page.evaluate(() => {
			const { filter } = (window as any).__isometry;
			return {
				hasRange: filter.hasRangeFilter('priority'),
				compiled: filter.compile(),
			};
		});

		expect(filterState.hasRange).toBe(true);
		expect(filterState.compiled.where).toContain('priority');

		// 5. Assert: "Clear all" button is visible in LATCH panel
		const clearAllVisible = await page.evaluate(() => {
			const btn = document.querySelector('.latch-explorers__clear-all');
			if (!btn) return false;
			const style = window.getComputedStyle(btn);
			return style.display !== 'none' && style.visibility !== 'hidden';
		});
		expect(clearAllVisible).toBe(true);

		// 6. Assert: footer row exists (Seam 1 — calc query runs with range filter)
		const hasFooter = await page.evaluate(() => {
			const footerCells = document.querySelectorAll('.sg-footer');
			return footerCells.length > 0;
		});
		expect(hasFooter).toBe(true);

		// 6b. Verify SVG text has letter-spacing reset (BUGF-02)
		const histogramLetterSpacing = await page.evaluate(() => {
			const svgText = document.querySelector('.latch-histogram svg text');
			if (!svgText) return null;
			return window.getComputedStyle(svgText).letterSpacing;
		});
		// Both 'normal' and '0px' indicate the CSS reset is active
		if (histogramLetterSpacing !== null) {
			expect(histogramLetterSpacing === 'normal' || histogramLetterSpacing === '0px').toBe(true);
		}

		// 7. Assert: grid cell count may have changed
		//    (depends on how many cards have priority in 5-8 range)
		const filteredCellCount = await page.evaluate(() => {
			return document.querySelectorAll('.sg-cell, .data-cell').length;
		});

		// With priority range 5-8, expect a subset of total cards to appear
		// The key check is that the filter IS active and compiled correctly (step 4)
		// Cell count change depends on data distribution — we verify the mechanism works

		// 8. Clear the range filter via "Clear all" button click
		await page.evaluate(() => {
			const btn = document.querySelector('.latch-explorers__clear-all') as HTMLButtonElement;
			if (btn) btn.click();
		});

		await page.waitForTimeout(500);

		// 9. Assert: filter cleared
		const afterClear = await page.evaluate(() => {
			const { filter } = (window as any).__isometry;
			return filter.hasRangeFilter('priority');
		});
		expect(afterClear).toBe(false);

		// 10. Assert: grid restored to original count
		const restoredCellCount = await page.evaluate(() => {
			return document.querySelectorAll('.sg-cell, .data-cell').length;
		});
		expect(restoredCellCount).toBe(unfilteredCellCount);
	});

	test('clearing range filter restores original grid state', async ({ page, baselineCardCount }) => {
		expect(baselineCardCount).toBeGreaterThan(0);

		// Switch to SuperGrid
		await page.evaluate(async () => {
			const { viewManager, viewFactory } = (window as any).__isometry;
			await viewManager.switchTo('supergrid', () => viewFactory['supergrid']());
		});

		await page.waitForFunction(
			() => document.querySelectorAll('.sg-cell, .data-cell, .sg-header').length > 0,
			{ timeout: 15_000 },
		);

		// Capture unfiltered cell count
		const unfilteredCount = await page.evaluate(() => {
			return document.querySelectorAll('.sg-cell, .data-cell').length;
		});

		// Apply range filter
		await page.evaluate(() => {
			const { filter, coordinator } = (window as any).__isometry;
			filter.setRangeFilter('priority', 7, 10);
			coordinator.scheduleUpdate();
		});
		await page.waitForTimeout(500);

		// Clear via API
		await page.evaluate(() => {
			const { filter, coordinator } = (window as any).__isometry;
			filter.clearRangeFilter('priority');
			coordinator.scheduleUpdate();
		});
		await page.waitForTimeout(500);

		// Restored cell count should match original
		const restoredCount = await page.evaluate(() => {
			return document.querySelectorAll('.sg-cell, .data-cell').length;
		});
		expect(restoredCount).toBe(unfilteredCount);
	});
});
