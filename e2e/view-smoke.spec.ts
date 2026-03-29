/**
 * Isometry v5 — E2E: View Smoke Test
 *
 * Validates: Every view type renders with visible content (clientHeight > 100)
 * and at least one child element. This catches invisible-render bugs like
 * missing CSS imports (e.g., the pivot.css orphan bug).
 *
 * Does NOT load sample data — uses whatever state the app boots into.
 * Loads sample data first to ensure views have content to render.
 */

import { test, expect } from './fixtures';

const VIEW_TYPES = [
	'list',
	'gallery',
	'kanban',
	'grid',
	'supergrid',
	'timeline',
	'network',
	'tree',
	'calendar',
] as const;

test.describe('View smoke test: all views render visible content', () => {
	for (const viewType of VIEW_TYPES) {
		test(`${viewType} view renders with visible content`, async ({ page, baselineCardCount }) => {
			expect(baselineCardCount).toBeGreaterThan(0);

			// Switch to this view
			await page.evaluate(
				async (vt) => {
					const { viewManager, viewFactory } = (window as any).__isometry;
					await viewManager.switchTo(vt, () => viewFactory[vt]());
				},
				viewType,
			);

			// Wait for render to settle
			await page.waitForTimeout(500);

			// Assert .workbench-view-content has clientHeight > 100
			const height = await page.evaluate(() => {
				const el = document.querySelector('.workbench-view-content');
				return el ? el.clientHeight : 0;
			});
			expect(height, `${viewType} view container should have height > 100`).toBeGreaterThan(100);

			// Assert the view container has at least one child element
			const childCount = await page.evaluate(() => {
				const el = document.querySelector('.workbench-view-content');
				return el ? el.children.length : 0;
			});
			expect(childCount, `${viewType} view should have at least one child element`).toBeGreaterThanOrEqual(1);
		});
	}
});
