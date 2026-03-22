/**
 * Isometry v5 — Harness SuperSearch Plugin E2E Suite
 *
 * Verifies toggling the SuperSearch plugin category in HarnessShell sidebar
 * produces expected DOM changes in the pivot grid.
 *
 * Plugins: supersearch.input (Search Input), supersearch.highlight (Cell Highlighting)
 *
 * Run: npx playwright test e2e/harness-supersearch.spec.ts
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
// HARNESS SUPERSEARCH PLUGIN TESTS
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Harness: SuperSearch Plugins', () => {
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
	// 1. Sidebar renders SuperSearch category with 2 plugins
	// -----------------------------------------------------------------------

	test('1 — sidebar renders SuperSearch category with 2 plugins', async () => {
		const sidebar = page.locator('.hns-sidebar');
		await expect(sidebar).toBeVisible();

		const categoryLabel = sidebar.locator('.hns-category-label:text-is("SuperSearch")');
		await expect(categoryLabel).toBeVisible();

		const pluginNames = ['Search Input', 'Cell Highlighting'];
		for (const name of pluginNames) {
			const row = sidebar.locator(`.hns-plugin-name:text-is("${name}")`);
			await expect(row).toBeVisible();
		}

		await screenshot(page, 'supersearch-01-sidebar');
	});

	// -----------------------------------------------------------------------
	// 2. Enabling SuperSearch shows search toolbar
	// -----------------------------------------------------------------------

	test('2 — enabling SuperSearch shows search toolbar', async () => {
		await clickCategoryAll(page, 'SuperSearch');

		// Poll for search toolbar to appear
		await expect.poll(() => page.locator('.pv-search-toolbar').count()).toBeGreaterThan(0);

		await expect(page.locator('.pv-search-toolbar')).toBeVisible();

		await screenshot(page, 'supersearch-02-toolbar-visible');
	});

	// -----------------------------------------------------------------------
	// 3. Search input accepts text
	// -----------------------------------------------------------------------

	test('3 — search input accepts text', async () => {
		const searchInput = page.locator('.pv-search-input');
		await expect(searchInput).toBeVisible();

		await searchInput.fill('test');

		// Verify the input value is set
		await expect.poll(async () => {
			return searchInput.inputValue();
		}).toBe('test');

		await screenshot(page, 'supersearch-03-input-filled');
	});

	// -----------------------------------------------------------------------
	// 4. Disabling SuperSearch removes toolbar
	// -----------------------------------------------------------------------

	test('4 — disabling SuperSearch removes toolbar', async () => {
		await clickCategoryNone(page, 'SuperSearch');

		// Poll for search toolbar to disappear
		await expect.poll(() => page.locator('.pv-search-toolbar').count()).toBe(0);

		await screenshot(page, 'supersearch-04-toolbar-removed');
	});
});
