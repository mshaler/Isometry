/**
 * Isometry v5 — Harness Base Plugin E2E Suite
 *
 * Verifies toggling the Base plugin category in HarnessShell sidebar
 * produces expected DOM changes in the pivot grid.
 *
 * Plugins: base.grid (Data Grid), base.headers (Grouped Headers), base.config (Config Panel)
 *
 * Run: npx playwright test e2e/harness-base.spec.ts
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
// HARNESS BASE PLUGIN TESTS
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Harness: Base Plugins', () => {
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
	// 1. Sidebar renders Base category with 3 plugins
	// -----------------------------------------------------------------------

	test('1 — sidebar renders Base category with 3 plugins', async () => {
		const sidebar = page.locator('.hns-sidebar');
		await expect(sidebar).toBeVisible();

		// Base category header exists
		const categoryLabel = sidebar.locator('.hns-category-label:text-is("Base")');
		await expect(categoryLabel).toBeVisible();

		// Three plugins in Base
		const pluginNames = ['Data Grid', 'Grouped Headers', 'Config Panel'];
		for (const name of pluginNames) {
			const row = sidebar.locator(`.hns-plugin-name:text-is("${name}")`);
			await expect(row).toBeVisible();
		}

		await screenshot(page, 'base-01-sidebar-plugins');
	});

	// -----------------------------------------------------------------------
	// 2. Base plugins render grid with headers (defaultEnabled)
	// -----------------------------------------------------------------------

	test('2 — base plugins render grid with headers', async () => {
		// Base is defaultEnabled — grid should be present on load
		await expect(page.locator('[data-tour-target="supergrid"]')).toBeVisible();

		// At least 1 leaf column header should be present
		await expect.poll(() => page.locator('.pv-col-span--leaf').count()).toBeGreaterThan(0);

		await screenshot(page, 'base-02-grid-with-headers');
	});

	// -----------------------------------------------------------------------
	// 3. Toggling base category updates enabled state
	// -----------------------------------------------------------------------

	test('3 — toggling base category updates plugin enabled state', async () => {
		// Verify base.grid is enabled initially
		const initiallyEnabled = await page.evaluate(() =>
			(window as any).__harness.isEnabled('base.grid'),
		);
		expect(initiallyEnabled).toBe(true);

		// Disable Base category — all Base plugins should become disabled
		await clickCategoryNone(page, 'Base');

		// Poll for base.grid to be disabled in the registry
		await expect.poll(async () =>
			page.evaluate(() => (window as any).__harness.isEnabled('base.grid')),
		).toBe(false);

		await screenshot(page, 'base-03-grid-disabled');

		// Re-enable all Base plugins
		await clickCategoryAll(page, 'Base');

		// Poll for base.grid to be re-enabled
		await expect.poll(async () =>
			page.evaluate(() => (window as any).__harness.isEnabled('base.grid')),
		).toBe(true);

		// Verify grid is still rendered (base.grid is a delegation plugin — grid persists)
		await expect(page.locator('[data-tour-target="supergrid"]')).toBeVisible();

		await screenshot(page, 'base-03-grid-restored');
	});
});
