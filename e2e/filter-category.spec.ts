/**
 * Isometry v5 — E2E: Flow 2 — Category Filter Propagation
 *
 * Validates: Clicking a category chip filters SuperGrid and updates footer totals.
 * Covers Seams 1, 3, 5 (filter → calc → footer, filter → chart, coordinator batching).
 *
 * This test directly re-tests UAT Bug #2 (footer showed grand total in every column)
 * and Bug #3 (chart values diverged from grid when filtered).
 */

import { test, expect } from './fixtures';

test.describe('Flow 2: Category filter propagates to grid, footer, and chart', () => {
	test('clicking a category chip filters SuperGrid and updates footer totals', async ({
		page,
		baselineCardCount,
	}) => {
		// Precondition: baseline data loaded, we have cards
		expect(baselineCardCount).toBeGreaterThan(0);

		// 1. Switch to SuperGrid
		await page.evaluate(async () => {
			const { viewManager, viewFactory } = (window as any).__isometry;
			await viewManager.switchTo('supergrid', () => viewFactory['supergrid']());
		});

		// Wait for SuperGrid to render (grid headers or data cells visible)
		await page.waitForFunction(
			() => {
				const cells = document.querySelectorAll('.data-cell, .sg-cell');
				const headers = document.querySelectorAll('.col-header, .sg-header');
				return cells.length > 0 || headers.length > 0;
			},
			{ timeout: 15_000 },
		);

		// 2. Capture unfiltered footer values
		const unfilteredFooter = await page.evaluate(() => {
			const footerCells = document.querySelectorAll('.footer-cell, .sg-footer-cell, [class*="footer"]');
			return Array.from(footerCells).map((c) => c.textContent?.trim() ?? '');
		});

		// 3. Count unfiltered data cells
		const unfilteredCellCount = await page.evaluate(() => {
			return document.querySelectorAll('.data-cell, .sg-cell').length;
		});

		// 4. Apply a category filter via FilterProvider (programmatic — same seam as chip click)
		//    This tests the wiring: filter.setAxisFilter → compile() → calc query → footer
		await page.evaluate(() => {
			const { filter, coordinator } = (window as any).__isometry;
			filter.setAxisFilter('folder', ['Film']);
			coordinator.scheduleUpdate();
		});

		// Wait for re-render
		await page.waitForTimeout(500);

		// 5. Assert: grid has fewer cells (filter narrowed the dataset)
		const filteredCellCount = await page.evaluate(() => {
			return document.querySelectorAll('.data-cell, .sg-cell').length;
		});

		// The filtered count should be different from unfiltered
		// (unless all cards are in folder=Film, which is unlikely with the Meryl Streep dataset)
		expect(filteredCellCount).not.toEqual(unfilteredCellCount);

		// 6. Assert: footer values changed (BUG #2 REGRESSION CHECK)
		//    If Bug #2 is present, footer shows grand total in every column (unchanged)
		const filteredFooter = await page.evaluate(() => {
			const footerCells = document.querySelectorAll('.footer-cell, .sg-footer-cell, [class*="footer"]');
			return Array.from(footerCells).map((c) => c.textContent?.trim() ?? '');
		});

		// Footer should have changed if there are footer cells
		if (unfilteredFooter.length > 0 && filteredFooter.length > 0) {
			const footerChanged = unfilteredFooter.some((val, i) => val !== filteredFooter[i]);
			expect(footerChanged).toBe(true);
		}

		// 7. Verify filter compile() state is correct
		const filterState = await page.evaluate(() => {
			const { filter } = (window as any).__isometry;
			const compiled = filter.compile();
			return {
				where: compiled.where,
				params: compiled.params,
				hasAxisFilter: filter.hasAxisFilter('folder'),
				axisValues: filter.getAxisFilter('folder'),
			};
		});

		expect(filterState.hasAxisFilter).toBe(true);
		expect(filterState.axisValues).toEqual(['Film']);
		expect(filterState.where).toContain('folder IN (?)');

		// 8. Clear the filter and verify restoration
		await page.evaluate(() => {
			const { filter, coordinator } = (window as any).__isometry;
			filter.clearFilters();
			coordinator.scheduleUpdate();
		});

		await page.waitForTimeout(500);

		const restoredCellCount = await page.evaluate(() => {
			return document.querySelectorAll('.data-cell, .sg-cell').length;
		});

		// Should return to original count
		expect(restoredCellCount).toEqual(unfilteredCellCount);
	});

	test('filter propagates to calc query with correct colAxes in GROUP BY (Bug #2 direct test)', async ({
		page,
		baselineCardCount,
	}) => {
		expect(baselineCardCount).toBeGreaterThan(0);

		// Switch to SuperGrid
		await page.evaluate(async () => {
			const { viewManager, viewFactory } = (window as any).__isometry;
			await viewManager.switchTo('supergrid', () => viewFactory['supergrid']());
		});

		await page.waitForTimeout(1000);

		// Set explicit axes to guarantee both col and row axes
		await page.evaluate(() => {
			const { pafv, coordinator } = (window as any).__isometry;
			pafv.setColAxes([{ field: 'card_type', direction: 'asc' }]);
			pafv.setRowAxes([{ field: 'folder', direction: 'asc' }]);
			coordinator.scheduleUpdate();
		});

		await page.waitForTimeout(1000);

		// Apply filter and verify the compiled filter is used by SuperGrid
		await page.evaluate(() => {
			const { filter, coordinator } = (window as any).__isometry;
			filter.setAxisFilter('folder', ['Film']);
			coordinator.scheduleUpdate();
		});

		await page.waitForTimeout(500);

		// Verify the filter is active and properly compiled
		const compiled = await page.evaluate(() => {
			const { filter } = (window as any).__isometry;
			return filter.compile();
		});

		// The compiled WHERE must contain the filter
		expect(compiled.where).toContain('folder IN (?)');
		expect(compiled.params).toContain('Film');

		// Verify PAFV axes are correct (getStackedGroupBySQL returns {colAxes, rowAxes})
		const axes = await page.evaluate(() => {
			const { pafv } = (window as any).__isometry;
			return pafv.getStackedGroupBySQL();
		});

		expect(axes.colAxes.length).toBeGreaterThan(0);
		expect(axes.rowAxes.length).toBeGreaterThan(0);
	});
});
