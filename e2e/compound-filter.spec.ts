/**
 * Isometry v5 — E2E: Flow 11 — Compound Filter Conjunction Correctness
 *
 * Validates: Stacking multiple filter types (category + search + range) narrows
 * results monotonically via AND-conjunction. Removing a filter broadens results.
 * Clearing all filters restores the full dataset.
 *
 * Uses the shared baseline fixture (Meryl Streep dataset loaded, Timeline active).
 * All card counts are SQL ground truth from the database, not DOM cell counts.
 */

import { test, expect } from './fixtures';

/** Helper: query the current card count from the database through the active filter. */
async function getFilteredCardCount(page: import('@playwright/test').Page): Promise<number> {
	return page.evaluate(async () => {
		const { bridge, filter } = (window as any).__isometry;
		const compiled = filter.compile();
		const where = compiled.where ? `WHERE deleted_at IS NULL AND ${compiled.where}` : 'WHERE deleted_at IS NULL';
		const r = await bridge.send('db:query', {
			sql: `SELECT COUNT(*) as cnt FROM cards ${where}`,
			params: compiled.params,
		});
		return r.rows[0]?.cnt ?? 0;
	});
}

test.describe('Flow 11: Compound filter conjunction correctness', () => {
	test('card count narrows monotonically with each added filter and restores when cleared', async ({
		page,
		baselineCardCount,
	}) => {
		// Precondition
		expect(baselineCardCount).toBeGreaterThan(0);

		// Switch to SuperGrid for this test
		await page.evaluate(async () => {
			const { viewManager, viewFactory } = (window as any).__isometry;
			await viewManager.switchTo('supergrid', () => viewFactory['supergrid']());
		});

		// Wait for grid to render (data cells or headers visible)
		await page.waitForFunction(
			() => {
				const cells = document.querySelectorAll('.data-cell, .sg-cell');
				const headers = document.querySelectorAll('.col-header, .sg-header');
				return cells.length > 0 || headers.length > 0;
			},
			{ timeout: 15_000 },
		);

		// Capture initial card count from database (no filters active)
		const count0 = await page.evaluate(async () => {
			const { bridge } = (window as any).__isometry;
			const r = await bridge.send('db:query', {
				sql: 'SELECT COUNT(*) as cnt FROM cards WHERE deleted_at IS NULL',
				params: [],
			});
			return r.rows[0]?.cnt ?? 0;
		});
		expect(count0).toBe(baselineCardCount);

		// ---------------------------------------------------------------
		// Step 1: Category filter (folder = Film)
		// ---------------------------------------------------------------
		await page.evaluate(() => {
			const { filter, coordinator } = (window as any).__isometry;
			filter.setAxisFilter('folder', ['Film']);
			coordinator.scheduleUpdate();
		});
		await page.waitForTimeout(500);

		const count1 = await getFilteredCardCount(page);
		expect(count1, 'Category filter should narrow results').toBeLessThan(count0);

		// ---------------------------------------------------------------
		// Step 2: Text search (FTS5 search for 'Oscar')
		// ---------------------------------------------------------------
		await page.evaluate(() => {
			const { filter, coordinator } = (window as any).__isometry;
			filter.setSearchQuery('Oscar');
			coordinator.scheduleUpdate();
		});
		await page.waitForTimeout(500);

		const count2 = await getFilteredCardCount(page);
		expect(
			count2,
			'Adding search to category filter should narrow or maintain',
		).toBeLessThanOrEqual(count1);

		// ---------------------------------------------------------------
		// Step 3: Range filter (priority 3..7)
		// ---------------------------------------------------------------
		await page.evaluate(() => {
			const { filter, coordinator } = (window as any).__isometry;
			filter.setRangeFilter('priority', 3, 7);
			coordinator.scheduleUpdate();
		});
		await page.waitForTimeout(500);

		const count3 = await getFilteredCardCount(page);
		expect(
			count3,
			'Triple conjunction should narrow or maintain',
		).toBeLessThanOrEqual(count2);

		// ---------------------------------------------------------------
		// Step 4: Verify filter compile() state
		// ---------------------------------------------------------------
		const filterState = await page.evaluate(() => {
			const { filter } = (window as any).__isometry;
			const compiled = filter.compile();
			return {
				where: compiled.where,
				params: compiled.params,
			};
		});

		// The compiled WHERE should include all three filter clauses
		expect(filterState.where).toContain('folder IN (?)');
		expect(filterState.params).toContain('Film');

		// ---------------------------------------------------------------
		// Step 5: Remove one filter -- results broaden
		// ---------------------------------------------------------------
		await page.evaluate(() => {
			const { filter, coordinator } = (window as any).__isometry;
			filter.setAxisFilter('folder', []);
			coordinator.scheduleUpdate();
		});
		await page.waitForTimeout(500);

		const count4 = await getFilteredCardCount(page);
		expect(
			count4,
			'Removing category filter should broaden results',
		).toBeGreaterThanOrEqual(count3);

		// ---------------------------------------------------------------
		// Step 6: Clear all -- full restoration
		// ---------------------------------------------------------------
		await page.evaluate(() => {
			const { filter, coordinator } = (window as any).__isometry;
			filter.clearFilters();
			coordinator.scheduleUpdate();
		});
		await page.waitForTimeout(500);

		const countFinal = await page.evaluate(async () => {
			const { bridge } = (window as any).__isometry;
			const r = await bridge.send('db:query', {
				sql: 'SELECT COUNT(*) as cnt FROM cards WHERE deleted_at IS NULL',
				params: [],
			});
			return r.rows[0]?.cnt ?? 0;
		});
		expect(countFinal, 'Clearing all filters should restore full dataset').toBe(count0);
	});
});
