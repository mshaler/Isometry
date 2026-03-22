/**
 * Isometry v5 — Harness Multi-Plugin Combination E2E Suite
 *
 * Verifies that enabling multiple plugin categories simultaneously produces
 * additive DOM state with all category markers present concurrently.
 *
 * Combos tested:
 *   1. Sort + Search + Select — triple interaction category combo
 *   2. Sort + Density + Calc  — UI modifier + toolbar + footer combo
 *   3. Stack + Zoom + Size    — visual layout modifier trio
 *   4. Search + Scroll + Density — data windowing with search and density
 *   5. All categories enabled — full matrix stress test (no JS errors, grid stable)
 *
 * Requirements: E2E-02 (additive rendering), E2E-03 (screenshot baselines),
 *               E2E-04 (no waitForTimeout), E2E-05 (CI hard gate)
 *
 * Run: npx playwright test e2e/harness-combos.spec.ts
 */

import { test, expect, type Page } from '@playwright/test';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { waitForHarnessReady, enablePlugin, disablePlugin } from './helpers/harness';

// ---------------------------------------------------------------------------
// Screenshot helper (self-contained — harness doesn't use main app fixtures)
// ---------------------------------------------------------------------------

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SCREENSHOT_DIR = path.resolve(__dirname, 'screenshots');

async function screenshot(page: Page, name: string): Promise<string> {
	const filePath = path.join(SCREENSHOT_DIR, `harness-${name}.png`);
	await page.screenshot({ path: filePath, fullPage: false });
	return filePath;
}

// ---------------------------------------------------------------------------
// All non-base plugin IDs for reset between combo tests
// ---------------------------------------------------------------------------

const NON_BASE_IDS = [
	'superstack.spanning', 'superstack.collapse', 'superstack.aggregate',
	'superzoom.slider', 'superzoom.scale',
	'supersize.col-resize', 'supersize.header-resize', 'supersize.uniform-resize',
	'supersort.header-click', 'supersort.chain',
	'supercalc.footer', 'supercalc.config',
	'superscroll.virtual', 'superscroll.sticky-headers',
	'supersearch.input', 'supersearch.highlight',
	'superselect.click', 'superselect.lasso', 'superselect.keyboard',
	'superdensity.mode-switch', 'superdensity.mini-cards', 'superdensity.count-badge',
	'superaudit.overlay', 'superaudit.source',
];

async function disableAllNonBase(page: Page): Promise<void> {
	for (const id of NON_BASE_IDS) {
		await disablePlugin(page, id);
	}
}

// ═══════════════════════════════════════════════════════════════════════════
// HARNESS MULTI-PLUGIN COMBO TESTS
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Harness: Multi-Plugin Combos', () => {
	test.describe.configure({ mode: 'serial' });

	let page: Page;

	test.beforeAll(async ({ browser }) => {
		page = await browser.newPage();
		await waitForHarnessReady(page);
		// Start with all non-base plugins disabled
		await disableAllNonBase(page);
	});

	test.afterAll(async () => {
		await page.close();
	});

	// -----------------------------------------------------------------------
	// Combo 1: Sort + Search + Select — triple interaction combo
	// -----------------------------------------------------------------------

	test('combo-1 — Sort + Search + Select: all three category markers coexist', async () => {
		// Reset to clean state
		await disableAllNonBase(page);

		// Enable Sort category
		await enablePlugin(page, 'supersort.header-click');
		await enablePlugin(page, 'supersort.chain');

		// Enable Search category
		await enablePlugin(page, 'supersearch.input');
		await enablePlugin(page, 'supersearch.highlight');

		// Enable Select category
		await enablePlugin(page, 'superselect.click');
		await enablePlugin(page, 'superselect.lasso');
		await enablePlugin(page, 'superselect.keyboard');

		// Assert Search toolbar present
		await expect.poll(
			() => page.locator('.pv-search-toolbar').count(),
			{ timeout: 10_000 },
		).toBeGreaterThan(0);

		// Trigger sort by dispatching synthetic PointerEvent on a leaf header
		await page.evaluate(() => {
			const overlay = document.querySelector('.pv-overlay') as HTMLElement | null;
			const leaf = overlay?.querySelector('.pv-col-span--leaf') as HTMLElement | null;
			if (!leaf || !overlay) return;
			const rect = leaf.getBoundingClientRect();
			const evt = new PointerEvent('pointerdown', {
				bubbles: true,
				cancelable: true,
				pointerId: 1,
				pointerType: 'mouse',
				clientX: rect.x + 5,
				clientY: rect.y + 5,
			});
			leaf.dispatchEvent(evt);
		});

		// Assert sort arrows present
		await expect.poll(
			() => page.locator('.pv-sort-arrow').count(),
			{ timeout: 10_000 },
		).toBeGreaterThan(0);

		// Assert all three category markers present simultaneously
		await expect.poll(
			() => page.locator('.pv-search-toolbar').count(),
			{ timeout: 5_000 },
		).toBeGreaterThan(0);

		await expect.poll(
			() => page.locator('.pv-sort-arrow').count(),
			{ timeout: 5_000 },
		).toBeGreaterThan(0);

		// SuperSelect: verify plugin is enabled (selection DOM artifacts only appear during active drag)
		const selectEnabled = await page.evaluate(() => (window as any).__harness.isEnabled('superselect.click'));
		expect(selectEnabled).toBe(true);

		await screenshot(page, 'combo-sort-search-select');
	});

	// -----------------------------------------------------------------------
	// Combo 2: Sort + Density + Calc — UI modifier + toolbar + footer combo
	// -----------------------------------------------------------------------

	test('combo-2 — Sort + Density + Calc: all three category DOM markers coexist', async () => {
		// Reset to clean state
		await disableAllNonBase(page);

		// Enable Sort category
		await enablePlugin(page, 'supersort.header-click');
		await enablePlugin(page, 'supersort.chain');

		// Enable Density category
		await enablePlugin(page, 'superdensity.mode-switch');
		await enablePlugin(page, 'superdensity.mini-cards');
		await enablePlugin(page, 'superdensity.count-badge');

		// Enable Calc category
		await enablePlugin(page, 'supercalc.footer');
		await enablePlugin(page, 'supercalc.config');

		// Assert Density toolbar present
		await expect.poll(
			() => page.locator('.pv-density-toolbar').count(),
			{ timeout: 10_000 },
		).toBeGreaterThan(0);

		// Assert Calc footer present
		await expect.poll(
			() => page.locator('.pv-calc-footer').count(),
			{ timeout: 10_000 },
		).toBeGreaterThan(0);

		// Trigger sort via synthetic PointerEvent
		await page.evaluate(() => {
			const overlay = document.querySelector('.pv-overlay') as HTMLElement | null;
			const leaf = overlay?.querySelector('.pv-col-span--leaf') as HTMLElement | null;
			if (!leaf || !overlay) return;
			const rect = leaf.getBoundingClientRect();
			const evt = new PointerEvent('pointerdown', {
				bubbles: true,
				cancelable: true,
				pointerId: 1,
				pointerType: 'mouse',
				clientX: rect.x + 5,
				clientY: rect.y + 5,
			});
			leaf.dispatchEvent(evt);
		});

		// Assert sort arrows present
		await expect.poll(
			() => page.locator('.pv-sort-arrow').count(),
			{ timeout: 10_000 },
		).toBeGreaterThan(0);

		// All three category markers coexist
		await expect.poll(
			() => page.locator('.pv-density-toolbar').count(),
			{ timeout: 5_000 },
		).toBeGreaterThan(0);

		await expect.poll(
			() => page.locator('.pv-calc-footer').count(),
			{ timeout: 5_000 },
		).toBeGreaterThan(0);

		await screenshot(page, 'combo-sort-density-calc');
		await screenshot(page, 'combo-calc-footer');
	});

	// -----------------------------------------------------------------------
	// Combo 3: Stack + Zoom + Size — visual layout modifiers together
	// -----------------------------------------------------------------------

	test('combo-3 — Stack + Zoom + Size: visual layout DOM markers coexist', async () => {
		// Reset to clean state
		await disableAllNonBase(page);

		// Enable Stack category
		await enablePlugin(page, 'superstack.spanning');
		await enablePlugin(page, 'superstack.collapse');
		await enablePlugin(page, 'superstack.aggregate');

		// Enable Zoom category
		await enablePlugin(page, 'superzoom.slider');
		await enablePlugin(page, 'superzoom.scale');

		// Enable Size category
		await enablePlugin(page, 'supersize.col-resize');
		await enablePlugin(page, 'supersize.header-resize');
		await enablePlugin(page, 'supersize.uniform-resize');

		// Assert Stack chevrons present
		await expect.poll(
			() => page.locator('.pv-span-chevron').count(),
			{ timeout: 10_000 },
		).toBeGreaterThan(0);

		// Assert Zoom control visible
		await expect.poll(
			() => page.locator('.hns-zoom-control').count(),
			{ timeout: 10_000 },
		).toBeGreaterThan(0);

		// Assert Size resize handles present
		await expect.poll(
			() => page.locator('.pv-resize-handle').count(),
			{ timeout: 10_000 },
		).toBeGreaterThan(0);

		await screenshot(page, 'combo-stack-zoom-size');

		// Capture collapsed state baseline — collapse first group via programmatic dispatch
		// (pv-grid-wrapper intercepts pointer events, so .click() doesn't work — use evaluate)
		const collapsibleCount = await page.locator('.pv-col-span--collapsible').count();
		if (collapsibleCount > 0) {
			await page.evaluate(() => {
				const overlay = document.querySelector('.pv-overlay') as HTMLElement | null;
				const collapsible = overlay?.querySelector('.pv-col-span--collapsible') as HTMLElement | null;
				if (!collapsible || !overlay) return;
				const rect = collapsible.getBoundingClientRect();
				const evt = new PointerEvent('pointerdown', {
					bubbles: true,
					cancelable: true,
					pointerId: 1,
					pointerType: 'mouse',
					clientX: rect.x + 5,
					clientY: rect.y + 5,
				});
				collapsible.dispatchEvent(evt);
			});
			// Wait for collapsed state via poll
			await expect.poll(
				() => page.locator('.pv-col-span--collapsed').count(),
				{ timeout: 10_000 },
			).toBeGreaterThan(0);
			await screenshot(page, 'combo-stack-collapsed');
		}
	});

	// -----------------------------------------------------------------------
	// Combo 4: Search + Scroll + Density — data windowing with search
	// -----------------------------------------------------------------------

	test('combo-4 — Search + Scroll + Density: toolbars coexist, no JS errors', async () => {
		// Reset to clean state
		await disableAllNonBase(page);

		// Collect JS errors during this test
		const jsErrors: string[] = [];
		const onPageError = (err: Error): void => {
			jsErrors.push(err.message);
		};
		page.on('pageerror', onPageError);

		// Enable Search category
		await enablePlugin(page, 'supersearch.input');
		await enablePlugin(page, 'supersearch.highlight');

		// Enable Scroll category
		await enablePlugin(page, 'superscroll.virtual');
		await enablePlugin(page, 'superscroll.sticky-headers');

		// Enable Density category
		await enablePlugin(page, 'superdensity.mode-switch');
		await enablePlugin(page, 'superdensity.mini-cards');
		await enablePlugin(page, 'superdensity.count-badge');

		// Assert Search toolbar present
		await expect.poll(
			() => page.locator('.pv-search-toolbar').count(),
			{ timeout: 10_000 },
		).toBeGreaterThan(0);

		// Assert Density toolbar present
		await expect.poll(
			() => page.locator('.pv-density-toolbar').count(),
			{ timeout: 10_000 },
		).toBeGreaterThan(0);

		// Scroll sentinels: may or may not appear depending on mock data row count
		// (VIRTUALIZATION_THRESHOLD is 100 rows) — assert no-error regardless
		const searchToolbarCount = await page.locator('.pv-search-toolbar').count();
		expect(searchToolbarCount).toBeGreaterThan(0);

		const densityToolbarCount = await page.locator('.pv-density-toolbar').count();
		expect(densityToolbarCount).toBeGreaterThan(0);

		await screenshot(page, 'combo-search-scroll-density');

		// Remove error listener
		page.off('pageerror', onPageError);

		// No JS errors should have occurred
		expect(jsErrors).toHaveLength(0);
	});

	// -----------------------------------------------------------------------
	// Combo 5: All categories enabled — full matrix stress test
	// -----------------------------------------------------------------------

	test('combo-5 — All plugins enabled: grid stable, no JS errors, multiple markers present', async () => {
		// Reset to clean state
		await disableAllNonBase(page);

		// Collect JS errors
		const jsErrors: string[] = [];
		const onPageError = (err: Error): void => {
			jsErrors.push(err.message);
		};
		page.on('pageerror', onPageError);

		// Enable ALL non-base plugins
		for (const id of NON_BASE_IDS) {
			await enablePlugin(page, id);
		}

		// Assert .pv-root still visible (grid didn't crash)
		await expect(page.locator('.pv-root')).toBeVisible();

		// Assert at least 3 category markers present simultaneously
		await expect.poll(
			() => page.locator('.pv-search-toolbar').count(),
			{ timeout: 10_000 },
		).toBeGreaterThan(0);

		await expect.poll(
			() => page.locator('.pv-density-toolbar').count(),
			{ timeout: 10_000 },
		).toBeGreaterThan(0);

		await expect.poll(
			() => page.locator('.pv-calc-footer').count(),
			{ timeout: 10_000 },
		).toBeGreaterThan(0);

		await screenshot(page, 'combo-all-plugins');

		// Remove error listener
		page.off('pageerror', onPageError);

		// No JS errors should have occurred during full-matrix enable
		expect(jsErrors).toHaveLength(0);
	});
});
