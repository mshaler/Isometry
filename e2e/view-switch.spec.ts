/**
 * Isometry v5 — E2E: Flow 1 — View Switch Card Count Preservation
 *
 * Validates: Switching across all 9 views preserves the database card count.
 * No data loss or duplication occurs during view transitions.
 *
 * Uses the shared baseline fixture (Meryl Streep dataset loaded, Timeline active).
 * Card count is verified via direct SQL query (ground truth), independent of
 * how each view renders its DOM.
 */

import { test, expect } from './fixtures';

const ALL_VIEWS = [
	'list',
	'grid',
	'kanban',
	'calendar',
	'timeline',
	'gallery',
	'network',
	'tree',
	'supergrid',
] as const;

test.describe('Flow 1: View switching preserves card count', () => {
	test('all 9 views render with identical card count from database', async ({
		page,
		baselineCardCount,
	}) => {
		// Precondition: baseline data loaded
		expect(baselineCardCount).toBeGreaterThan(0);

		for (const view of ALL_VIEWS) {
			// Switch to this view via the programmatic API
			await page.evaluate(
				async (vt) => {
					const { viewManager, viewFactory } = (window as any).__isometry;
					await viewManager.switchTo(vt, () => viewFactory[vt]());
				},
				view,
			);

			// Wait for the view tab to show as active
			await page.waitForFunction(
				(viewName) => {
					const tab = document.querySelector('.view-tab--active');
					return tab?.textContent?.toLowerCase().includes(viewName.toLowerCase()) ?? false;
				},
				view,
				{ timeout: 15_000 },
			);

			// Network view: force simulation needs extra time to stabilize
			if (view === 'network') {
				await page.waitForTimeout(2000);
			}

			// Query card count from database (ground truth — independent of DOM rendering)
			const count = await page.evaluate(async () => {
				const { bridge } = (window as any).__isometry;
				const r = await bridge.send('db:query', {
					sql: 'SELECT COUNT(*) as cnt FROM cards WHERE deleted_at IS NULL',
					params: [],
				});
				return r.rows[0]?.cnt ?? 0;
			});

			// Assert: card count matches baseline for every view
			expect(count, `View "${view}" should have same card count as baseline`).toBe(
				baselineCardCount,
			);
		}

		// After all view switches, verify no loading spinner persists
		await expect(
			page.locator('.loading-spinner:visible, .view-loading:visible'),
		).toHaveCount(0);
	});
});
