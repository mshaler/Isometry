/**
 * Isometry v5 — E2E Shared Baseline Fixture
 *
 * Every critical-path E2E test starts from the same baseline state:
 *   - Meryl Streep Career sample dataset loaded (47 films, 35 persons, 21 awards, ~140 edges)
 *   - Timeline view active (dataset's defaultView)
 *   - No filters, no selection, no prior UI state
 *
 * The fixture navigates to the app, loads sample data via the SampleDataManager API
 * (same code path as clicking the "Try: Meryl Streep Career" button), and waits
 * for Timeline to render before yielding to the test body.
 */

import { test as base, expect, type Page } from '@playwright/test';

// ---------------------------------------------------------------------------
// Baseline setup helper
// ---------------------------------------------------------------------------

/**
 * Load the Meryl Streep sample dataset and wait for Timeline to render.
 * Uses the programmatic API (sampleManager.load) which is the same code path
 * as clicking the welcome panel CTA button.
 *
 * @returns The initial card count from the database
 */
export async function loadBaselineDataset(page: Page): Promise<number> {
	await page.goto('/');

	// Wait for app bootstrap to complete (__isometry fully exposed)
	await page.waitForFunction(
		() => {
			const iso = (window as any).__isometry;
			return iso && iso.bridge && iso.viewManager && iso.sampleManager;
		},
		{ timeout: 20_000 },
	);

	// Load sample data via the same pipeline the button calls, but with
	// explicit await so Playwright waits for the full async sequence:
	// sampleManager.load() → coordinator.scheduleUpdate() → viewManager.switchTo()
	await page.evaluate(async () => {
		const { sampleManager, viewManager, viewFactory, coordinator } = (window as any).__isometry;
		await sampleManager.load('meryl-streep');
		coordinator.scheduleUpdate();
		await viewManager.switchTo('timeline', () => viewFactory['timeline']());
	});

	// Wait for Timeline to render — tab bar shows "Timeline" as active
	await page.waitForFunction(
		() => {
			const activeTab = document.querySelector('.view-tab--active');
			return activeTab !== null && activeTab.textContent?.includes('Timeline');
		},
		{ timeout: 30_000 },
	);

	// Wait for spinner to disappear (no stuck-spinner regression)
	await expect(page.locator('.loading-spinner:visible, .view-loading:visible')).toHaveCount(0, { timeout: 5_000 });

	// Read card count from the database (ground truth)
	const cardCount = await page.evaluate(async () => {
		const { bridge } = (window as any).__isometry;
		const result = await bridge.send('db:query', {
			sql: 'SELECT COUNT(*) as cnt FROM cards WHERE deleted_at IS NULL',
			params: [],
		});
		return result.rows[0]?.cnt ?? 0;
	});

	return cardCount as number;
}

// ---------------------------------------------------------------------------
// Extended test fixture
// ---------------------------------------------------------------------------

/**
 * Playwright test fixture that pre-loads the Meryl Streep baseline.
 *
 * Usage:
 * ```ts
 * import { test, expect } from '../e2e/fixtures';
 *
 * test('my test', async ({ page, baselineCardCount }) => {
 *   // page is already on Timeline with data loaded
 *   expect(baselineCardCount).toBeGreaterThan(0);
 * });
 * ```
 */
export const test = base.extend<{ baselineCardCount: number }>({
	baselineCardCount: async ({ page }, use) => {
		const count = await loadBaselineDataset(page);
		await use(count);
	},
});

export { expect } from '@playwright/test';
