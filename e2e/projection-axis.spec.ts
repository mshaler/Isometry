/**
 * Isometry v5 — E2E: Flow 3 — Projection Explorer Axis Reconfiguration
 *
 * Validates: Adding/removing axis fields via PAFV produces multi-level
 * SuperGrid headers without data loss. The axis change -> grid restructure
 * pipeline is tested programmatically (not via drag-and-drop).
 *
 * Covers: PAFV setColAxes/setRowAxes -> coordinator.scheduleUpdate() ->
 * SuperGrid re-render with updated header structure.
 */

import { test, expect } from './fixtures';

test.describe('Flow 3: Projection Explorer axis reconfiguration', () => {
	test('adding an axis field produces multi-level headers with no data loss', async ({
		page,
		baselineCardCount,
	}) => {
		expect(baselineCardCount).toBeGreaterThan(0);

		// Switch to SuperGrid view
		await page.evaluate(async () => {
			const { viewManager, viewFactory } = (window as any).__isometry;
			await viewManager.switchTo('supergrid', () => viewFactory['supergrid']());
		});

		// Wait for grid to render (col-header elements visible)
		await page.waitForFunction(
			() => {
				const headers = document.querySelectorAll('.col-header');
				return headers.length > 0;
			},
			{ timeout: 15_000 },
		);

		// ---------------------------------------------------------------
		// Step 1: Set single-axis baseline
		// ---------------------------------------------------------------
		await page.evaluate(() => {
			const { pafv, coordinator } = (window as any).__isometry;
			pafv.setColAxes([{ field: 'card_type', direction: 'asc' }]);
			pafv.setRowAxes([{ field: 'folder', direction: 'asc' }]);
			coordinator.scheduleUpdate();
		});

		// Wait for re-render to complete with single-axis headers
		await page.waitForFunction(
			() => {
				const headers = document.querySelectorAll('.col-header');
				if (headers.length === 0) return false;
				// All headers should be at level 0 (single axis)
				const levels = new Set<string>();
				headers.forEach((h) => levels.add(h.getAttribute('data-level') ?? '0'));
				return levels.size === 1;
			},
			{ timeout: 10_000 },
		);

		// Count baseline: only col-header elements (not corner/gutter/row/footer)
		const baselineColHeaderCount = await page.evaluate(
			() => document.querySelectorAll('.col-header').length,
		);
		// Count distinct header levels in single-axis mode
		const baselineLevelCount = await page.evaluate(() => {
			const headers = document.querySelectorAll('.col-header');
			const levels = new Set<string>();
			headers.forEach((h) => levels.add(h.getAttribute('data-level') ?? '0'));
			return levels.size;
		});
		expect(baselineLevelCount).toBe(1);

		// Verify card count unchanged after axis change
		const countAfterSingleAxis = await page.evaluate(async () => {
			const { bridge } = (window as any).__isometry;
			const result = await bridge.send('db:query', {
				sql: 'SELECT COUNT(*) as cnt FROM cards WHERE deleted_at IS NULL',
				params: [],
			});
			return result.rows[0]?.cnt ?? 0;
		});
		expect(countAfterSingleAxis).toBe(baselineCardCount);

		// ---------------------------------------------------------------
		// Step 2: Add second axis (multi-level headers)
		// ---------------------------------------------------------------
		await page.evaluate(() => {
			const { pafv, coordinator } = (window as any).__isometry;
			pafv.setColAxes([
				{ field: 'card_type', direction: 'asc' },
				{ field: 'status', direction: 'asc' },
			]);
			coordinator.scheduleUpdate();
		});

		// Wait for multi-level headers: headers at level 1 should appear
		await page.waitForFunction(
			() => {
				const level1Headers = document.querySelectorAll('.col-header[data-level="1"]');
				return level1Headers.length > 0;
			},
			{ timeout: 10_000 },
		);

		// Count header levels — should now be 2
		const multiLevelCount = await page.evaluate(() => {
			const headers = document.querySelectorAll('.col-header');
			const levels = new Set<string>();
			headers.forEach((h) => levels.add(h.getAttribute('data-level') ?? '0'));
			return levels.size;
		});
		expect(multiLevelCount).toBe(2);

		// Total col-header count should be >= baseline (level 0 headers + level 1 headers)
		const multiColHeaderCount = await page.evaluate(
			() => document.querySelectorAll('.col-header').length,
		);
		expect(multiColHeaderCount).toBeGreaterThanOrEqual(baselineColHeaderCount);

		// Verify card count unchanged
		const countAfterMultiAxis = await page.evaluate(async () => {
			const { bridge } = (window as any).__isometry;
			const result = await bridge.send('db:query', {
				sql: 'SELECT COUNT(*) as cnt FROM cards WHERE deleted_at IS NULL',
				params: [],
			});
			return result.rows[0]?.cnt ?? 0;
		});
		expect(countAfterMultiAxis).toBe(baselineCardCount);

		// Verify PAFV state reflects 2 colAxes
		const pafvState = await page.evaluate(() => {
			const { pafv } = (window as any).__isometry;
			return pafv.getStackedGroupBySQL();
		});
		expect(pafvState.colAxes.length).toBe(2);

		// ---------------------------------------------------------------
		// Step 3: Remove axis (restore single-level)
		// ---------------------------------------------------------------
		await page.evaluate(() => {
			const { pafv, coordinator } = (window as any).__isometry;
			pafv.setColAxes([{ field: 'status', direction: 'asc' }]);
			coordinator.scheduleUpdate();
		});

		// Wait for single-level restore: no more level 1 headers
		await page.waitForFunction(
			() => {
				const level1Headers = document.querySelectorAll('.col-header[data-level="1"]');
				return level1Headers.length === 0;
			},
			{ timeout: 10_000 },
		);

		const restoredLevelCount = await page.evaluate(() => {
			const headers = document.querySelectorAll('.col-header');
			const levels = new Set<string>();
			headers.forEach((h) => levels.add(h.getAttribute('data-level') ?? '0'));
			return levels.size;
		});
		expect(restoredLevelCount).toBe(1);

		// Fewer col-headers than multi-level (level 1 headers are gone)
		const restoredColHeaderCount = await page.evaluate(
			() => document.querySelectorAll('.col-header').length,
		);
		expect(restoredColHeaderCount).toBeLessThan(multiColHeaderCount);

		// Verify card count still equals baseline
		const countAfterRestore = await page.evaluate(async () => {
			const { bridge } = (window as any).__isometry;
			const result = await bridge.send('db:query', {
				sql: 'SELECT COUNT(*) as cnt FROM cards WHERE deleted_at IS NULL',
				params: [],
			});
			return result.rows[0]?.cnt ?? 0;
		});
		expect(countAfterRestore).toBe(baselineCardCount);
	});
});
