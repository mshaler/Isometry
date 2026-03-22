/**
 * Isometry v5 — Harness SuperCalc Plugin E2E Suite
 *
 * Verifies toggling the SuperCalc plugin category in HarnessShell sidebar
 * produces expected DOM changes in the pivot grid.
 *
 * Plugins: supercalc.footer (Aggregate Footer), supercalc.config (Aggregate Config)
 *
 * Run: npx playwright test e2e/harness-supercalc.spec.ts
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
// HARNESS SUPERCALC PLUGIN TESTS
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Harness: SuperCalc Plugins', () => {
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
	// 1. Sidebar renders SuperCalc category with 2 plugins
	// -----------------------------------------------------------------------

	test('1 — sidebar renders SuperCalc category with 2 plugins', async () => {
		const sidebar = page.locator('.hns-sidebar');
		await expect(sidebar).toBeVisible();

		const categoryLabel = sidebar.locator('.hns-category-label:text-is("SuperCalc")');
		await expect(categoryLabel).toBeVisible();

		const pluginNames = ['Aggregate Footer', 'Aggregate Config'];
		for (const name of pluginNames) {
			const row = sidebar.locator(`.hns-plugin-name:text-is("${name}")`);
			await expect(row).toBeVisible();
		}

		await screenshot(page, 'supercalc-01-sidebar');
	});

	// -----------------------------------------------------------------------
	// 2. Enabling SuperCalc shows footer row
	// -----------------------------------------------------------------------

	test('2 — enabling SuperCalc shows footer row', async () => {
		await clickCategoryAll(page, 'SuperCalc');

		// Poll for calc footer to appear
		await expect.poll(() => page.locator('.pv-calc-footer').count()).toBeGreaterThan(0);

		await expect(page.locator('.pv-calc-footer')).toBeVisible();

		await screenshot(page, 'supercalc-02-footer-visible');
	});

	// -----------------------------------------------------------------------
	// 3. Footer contains aggregate cells
	// -----------------------------------------------------------------------

	test('3 — footer contains aggregate cells', async () => {
		// Verify calc cells exist within footer
		await expect.poll(() => page.locator('.pv-calc-cell').count()).toBeGreaterThan(0);

		await screenshot(page, 'supercalc-03-aggregate-cells');
	});

	// -----------------------------------------------------------------------
	// 4. Disabling SuperCalc removes footer
	// -----------------------------------------------------------------------

	test('4 — disabling SuperCalc removes footer', async () => {
		await clickCategoryNone(page, 'SuperCalc');

		// Poll for calc footer to disappear
		await expect.poll(() => page.locator('.pv-calc-footer').count()).toBe(0);

		await screenshot(page, 'supercalc-04-footer-removed');
	});
});
