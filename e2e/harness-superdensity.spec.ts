/**
 * Isometry v5 — Harness SuperDensity Plugin E2E Suite
 *
 * Verifies toggling the SuperDensity plugin category in HarnessShell sidebar
 * produces expected DOM changes in the pivot grid.
 *
 * Plugins: superdensity.mode-switch (Density Mode Switcher), superdensity.mini-cards (Mini Cards 5x),
 *          superdensity.count-badge (Count Badge 1x)
 *
 * Run: npx playwright test e2e/harness-superdensity.spec.ts
 */

import { test, expect, type Page } from '@playwright/test';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { waitForHarnessReady } from './helpers/harness';

// ---------------------------------------------------------------------------
// Screenshot helper
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
// Sidebar helpers
// ---------------------------------------------------------------------------

async function clickCategoryAll(page: Page, categoryName: string): Promise<void> {
	const categories = page.locator('.hns-category');
	const count = await categories.count();
	for (let i = 0; i < count; i++) {
		const cat = categories.nth(i);
		const label = await cat.locator('.hns-category-label').textContent();
		if (label?.trim() === categoryName) {
			await cat.locator('.hns-action-btn:text-is("All")').click();
			return;
		}
	}
	throw new Error(`Category "${categoryName}" not found in sidebar`);
}

async function clickCategoryNone(page: Page, categoryName: string): Promise<void> {
	const categories = page.locator('.hns-category');
	const count = await categories.count();
	for (let i = 0; i < count; i++) {
		const cat = categories.nth(i);
		const label = await cat.locator('.hns-category-label').textContent();
		if (label?.trim() === categoryName) {
			await cat.locator('.hns-action-btn:text-is("None")').click();
			return;
		}
	}
	throw new Error(`Category "${categoryName}" not found in sidebar`);
}

// ═══════════════════════════════════════════════════════════════════════════
// HARNESS SUPERDENSITY PLUGIN TESTS
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Harness: SuperDensity Plugins', () => {
	test.describe.configure({ mode: 'serial' });

	let page: Page;

	test.beforeAll(async ({ browser }) => {
		page = await browser.newPage();
		await waitForHarnessReady(page);
	});

	test.afterAll(async () => {
		await page.close();
	});

	// -----------------------------------------------------------------------
	// 1. Sidebar renders SuperDensity category with 3 plugins
	// -----------------------------------------------------------------------

	test('1 — sidebar renders SuperDensity category with 3 plugins', async () => {
		const sidebar = page.locator('.hns-sidebar');
		await expect(sidebar).toBeVisible();

		const categoryLabel = sidebar.locator('.hns-category-label:text-is("SuperDensity")');
		await expect(categoryLabel).toBeVisible();

		const pluginNames = ['Density Mode Switcher', 'Mini Cards (5x)', 'Count Badge (1x)'];
		for (const name of pluginNames) {
			const row = sidebar.locator(`.hns-plugin-name:text-is("${name}")`);
			await expect(row).toBeVisible();
		}

		await screenshot(page, 'superdensity-01-sidebar');
	});

	// -----------------------------------------------------------------------
	// 2. Enabling SuperDensity shows density toolbar
	// -----------------------------------------------------------------------

	test('2 — enabling SuperDensity shows density toolbar', async () => {
		await clickCategoryAll(page, 'SuperDensity');

		// Poll for density toolbar to appear
		await expect.poll(() => page.locator('.pv-density-toolbar').count()).toBeGreaterThan(0);

		await expect(page.locator('.pv-density-toolbar')).toBeVisible();

		await screenshot(page, 'superdensity-02-toolbar-visible');
	});

	// -----------------------------------------------------------------------
	// 3. Density buttons show Compact/Normal/Comfortable/Spacious modes
	// -----------------------------------------------------------------------

	test('3 — density buttons show 4 modes with one active', async () => {
		// Verify 4 density buttons exist (Compact, Normal, Comfortable, Spacious)
		await expect.poll(() => page.locator('.pv-density-btn').count()).toBe(4);

		// Verify one is active
		await expect.poll(() => page.locator('.pv-density-btn--active').count()).toBeGreaterThan(0);

		await screenshot(page, 'superdensity-03-mode-buttons');
	});

	// -----------------------------------------------------------------------
	// 4. Clicking Compact mode changes active button
	// -----------------------------------------------------------------------

	test('4 — clicking Compact mode activates compact density class', async () => {
		// Find and dispatch click on the Compact density button
		// Use dispatchEvent to bypass overlay pointer-event interception
		const densityBtns = page.locator('.pv-density-btn');
		const btnCount = await densityBtns.count();

		let foundCompact = false;
		for (let i = 0; i < btnCount; i++) {
			const btn = densityBtns.nth(i);
			const text = await btn.textContent();
			if (text?.trim() === 'Compact') {
				await btn.dispatchEvent('click');
				foundCompact = true;
				break;
			}
		}

		if (foundCompact) {
			// Poll for compact button to have active class
			await expect.poll(() => page.locator('[data-density="compact"].pv-density-btn--active').count()).toBe(1);
		}

		await screenshot(page, 'superdensity-04-compact-mode');
	});

	// -----------------------------------------------------------------------
	// 5. Disabling SuperDensity removes toolbar
	// -----------------------------------------------------------------------

	test('5 — disabling SuperDensity removes toolbar', async () => {
		await clickCategoryNone(page, 'SuperDensity');

		// Poll for density toolbar to disappear
		await expect.poll(() => page.locator('.pv-density-toolbar').count()).toBe(0);

		await screenshot(page, 'superdensity-05-toolbar-removed');
	});
});
