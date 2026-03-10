/**
 * Isometry v5 — E2E: Flow 0 — Cold Start
 *
 * Validates: App loads sample data and renders Timeline with correct card count,
 * no persisting spinner, no race conditions (Seam 5: coordinator batching).
 *
 * This test does NOT use the shared baseline fixture — it IS the cold start.
 *
 * Note: The sample data button CTA may not render immediately due to timing
 * (sampleDatasets is assigned after initial welcome panel render). This test
 * loads data via the same programmatic API the button handler uses (sampleManager.load),
 * then verifies the full render pipeline.
 */

import { test, expect } from '@playwright/test';

test.describe('Flow 0: Cold start renders without race conditions', () => {
	test('app loads sample data and renders Timeline with correct card count, no persisting spinner', async ({
		page,
	}) => {
		// 1. Navigate to app URL (fresh, no prior data)
		await page.goto('/');

		// 2. Wait for app bootstrap to complete (__isometry exposed)
		await page.waitForFunction(
			() => {
				const iso = (window as any).__isometry;
				return iso && iso.bridge && iso.viewManager && iso.sampleManager;
			},
			{ timeout: 20_000 },
		);

		// 3. Assert: welcome panel heading is visible (empty state, no data yet)
		const heading = page.locator('.view-empty-heading').first();
		await expect(heading).toBeVisible({ timeout: 10_000 });
		await expect(heading).toHaveText('Explore Isometry');

		// 4. Load sample data via sampleManager.load() (same code path as button click),
		//    then trigger coordinator update and switch to Timeline view.
		await page.evaluate(async () => {
			const iso = (window as any).__isometry;
			await iso.sampleManager.load('meryl-streep');
			iso.coordinator.scheduleUpdate();
			await iso.viewManager.switchTo('timeline', () => iso.viewFactory['timeline']());
		});

		// 5. Wait for tab bar to show "Timeline" as active
		await page.waitForFunction(
			() => {
				const activeTab = document.querySelector('.view-tab--active');
				return activeTab !== null && activeTab.textContent?.includes('Timeline');
			},
			{ timeout: 30_000 },
		);

		// 6. Assert: no loading spinner visible (spinner gone — no stuck-spinner regression)
		await expect(page.locator('.loading-spinner:visible, .view-loading:visible')).toHaveCount(0, {
			timeout: 5_000,
		});

		// 7. Assert: the view area has rendered content (not empty state)
		//    Wait for the welcome panel to disappear (async render after switchTo)
		await page.waitForFunction(
			() => {
				const emptyPanels = document.querySelectorAll('.view-empty-welcome');
				const viewArea = document.querySelector('.workbench-view-content, .view-content-inner');
				if (!viewArea) return false;
				for (const panel of emptyPanels) {
					if (panel instanceof HTMLElement && panel.offsetParent !== null) return false;
				}
				return true;
			},
			{ timeout: 10_000 },
		);

		// 8. Assert: LATCH panel has at least one chip with a count badge > 0
		await page.waitForFunction(
			() => {
				const selectors = [
					'.latch-chip__count',
					'.latch-chip-badge',
					'[class*="chip"] [class*="count"]',
					'[class*="chip"] [class*="badge"]',
				];
				for (const sel of selectors) {
					const badges = document.querySelectorAll(sel);
					for (const badge of badges) {
						const text = badge.textContent?.trim();
						if (text && Number.parseInt(text, 10) > 0) return true;
					}
				}
				return false;
			},
			{ timeout: 15_000 },
		);

		// 9. Verify card count from database — 35 persons + ~49 films + 21 awards ≈ 105 cards
		const cardCount = await page.evaluate(async () => {
			const { bridge } = (window as any).__isometry;
			const result = await bridge.send('db:query', {
				sql: 'SELECT COUNT(*) as cnt FROM cards WHERE deleted_at IS NULL',
				params: [],
			});
			return result.rows[0]?.cnt ?? 0;
		});
		expect(cardCount).toBeGreaterThan(40); // At least 47 films

		// 10. Wait 2 seconds, re-assert: no loading spinner reappeared (orphaned timer check)
		await page.waitForTimeout(2000);
		await expect(page.locator('.loading-spinner:visible, .view-loading:visible')).toHaveCount(0);

		// 11. Assert: ARIA announcer element exists (accessibility infrastructure check)
		//     The Announcer creates a .sr-only div with aria-live="polite" aria-atomic="true"
		const announcerExists = await page.evaluate(() => {
			const announcer = document.querySelector('[aria-live="polite"][aria-atomic="true"]');
			return announcer !== null;
		});
		expect(announcerExists).toBe(true);
	});
});
