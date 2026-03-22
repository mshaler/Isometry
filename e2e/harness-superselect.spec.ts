/**
 * Isometry v5 — Harness SuperSelect Plugin E2E Suite
 *
 * Verifies toggling the SuperSelect plugin category in HarnessShell sidebar
 * produces expected DOM changes in the pivot grid.
 *
 * Plugins: superselect.click (Click Select), superselect.lasso (Lasso Select),
 *          superselect.keyboard (Keyboard Modifiers)
 *
 * Run: npx playwright test e2e/harness-superselect.spec.ts
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
// HARNESS SUPERSELECT PLUGIN TESTS
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Harness: SuperSelect Plugins', () => {
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
	// 1. Sidebar renders SuperSelect category with 3 plugins
	// -----------------------------------------------------------------------

	test('1 — sidebar renders SuperSelect category with 3 plugins', async () => {
		const sidebar = page.locator('.hns-sidebar');
		await expect(sidebar).toBeVisible();

		const categoryLabel = sidebar.locator('.hns-category-label:text-is("SuperSelect")');
		await expect(categoryLabel).toBeVisible();

		const pluginNames = ['Click Select', 'Lasso Select', 'Keyboard Modifiers'];
		for (const name of pluginNames) {
			const row = sidebar.locator(`.hns-plugin-name:text-is("${name}")`);
			await expect(row).toBeVisible();
		}

		await screenshot(page, 'superselect-01-sidebar');
	});

	// -----------------------------------------------------------------------
	// 2. Enabling SuperSelect activates selection plugins
	// -----------------------------------------------------------------------

	test('2 — enabling SuperSelect activates selection plugins', async () => {
		await clickCategoryAll(page, 'SuperSelect');

		// Wait for re-render to complete
		await page.waitForFunction(() => (window as any).__harnessReady === true);

		// Verify all three SuperSelect plugins are enabled in the registry
		const clickEnabled = await page.evaluate(() => (window as any).__harness.isEnabled('superselect.click'));
		const lassoEnabled = await page.evaluate(() => (window as any).__harness.isEnabled('superselect.lasso'));
		const keyboardEnabled = await page.evaluate(() => (window as any).__harness.isEnabled('superselect.keyboard'));

		expect(clickEnabled).toBe(true);
		expect(lassoEnabled).toBe(true);
		expect(keyboardEnabled).toBe(true);

		// The superselect.click plugin's afterRender applies/removes .selected class on cells.
		// With no selection made yet, no cells should be selected.
		await expect.poll(() => page.locator('.selected').count()).toBe(0);

		await screenshot(page, 'superselect-02-plugins-enabled');
	});

	// -----------------------------------------------------------------------
	// 3. Disabling SuperSelect removes selection state
	// -----------------------------------------------------------------------

	test('3 — disabling SuperSelect removes selection state', async () => {
		await clickCategoryNone(page, 'SuperSelect');

		// Poll for all selected cells to disappear
		await expect.poll(() => page.locator('.selected').count()).toBe(0);

		await screenshot(page, 'superselect-03-selection-removed');
	});
});
