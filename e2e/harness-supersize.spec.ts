/**
 * Isometry v5 — Harness SuperSize Plugin E2E Suite
 *
 * Verifies toggling the SuperSize plugin category in HarnessShell sidebar
 * produces expected DOM changes in the pivot grid.
 *
 * Plugins: supersize.col-resize (Column Resize), supersize.header-resize (Header Resize),
 *          supersize.uniform-resize (Uniform Cell Resize)
 *
 * Run: npx playwright test e2e/harness-supersize.spec.ts
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
// HARNESS SUPERSIZE PLUGIN TESTS
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Harness: SuperSize Plugins', () => {
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
	// 1. Sidebar renders SuperSize category with 3 plugins
	// -----------------------------------------------------------------------

	test('1 — sidebar renders SuperSize category with 3 plugins', async () => {
		const sidebar = page.locator('.hns-sidebar');
		await expect(sidebar).toBeVisible();

		const categoryLabel = sidebar.locator('.hns-category-label:text-is("SuperSize")');
		await expect(categoryLabel).toBeVisible();

		const pluginNames = ['Column Resize', 'Header Resize', 'Uniform Cell Resize'];
		for (const name of pluginNames) {
			const row = sidebar.locator(`.hns-plugin-name:text-is("${name}")`);
			await expect(row).toBeVisible();
		}

		await screenshot(page, 'supersize-01-sidebar');
	});

	// -----------------------------------------------------------------------
	// 2. Enabling SuperSize shows resize handles
	// -----------------------------------------------------------------------

	test('2 — enabling SuperSize shows resize handles', async () => {
		await clickCategoryAll(page, 'SuperSize');

		// Poll for resize handles to appear
		await expect.poll(() => page.locator('.pv-resize-handle').count()).toBeGreaterThan(0);

		await screenshot(page, 'supersize-02-handles-visible');
	});

	// -----------------------------------------------------------------------
	// 3. Column resize handles present
	// -----------------------------------------------------------------------

	test('3 — column resize handles present', async () => {
		// Verify width-specific resize handles exist
		await expect.poll(() => page.locator('.pv-resize-handle--width').count()).toBeGreaterThan(0);

		await screenshot(page, 'supersize-03-col-handles');
	});

	// -----------------------------------------------------------------------
	// 4. Disabling SuperSize removes per-column resize handles
	// -----------------------------------------------------------------------

	test('4 — disabling SuperSize removes per-column resize handles', async () => {
		// Count handles before disabling (includes both SuperSize handles and built-in corner handles)
		const countBefore = await page.locator('.pv-resize-handle').count();

		await clickCategoryNone(page, 'SuperSize');

		// PivotGrid has 3 built-in resize handles (header-width, header-height, cell-all corner handles).
		// SuperSize col-resize adds per-leaf handles. After disabling, count should be <= 3 (built-ins only).
		// Poll for the count to stabilize after re-render
		await expect.poll(() => page.locator('.pv-resize-handle').count()).toBeLessThanOrEqual(3);

		// SuperSize-specific handles (--width on leaf headers) should be gone
		await expect.poll(() => page.locator('.pv-resize-handle--width').count()).toBeLessThanOrEqual(1);

		// Ensure we actually removed handles (count should be less than before)
		const countAfter = await page.locator('.pv-resize-handle').count();
		expect(countAfter).toBeLessThan(countBefore);

		await screenshot(page, 'supersize-04-handles-removed');
	});
});
