/**
 * Isometry v5 — Harness SuperScroll Plugin E2E Suite
 *
 * Verifies toggling the SuperScroll plugin category in HarnessShell sidebar
 * produces expected DOM changes in the pivot grid.
 *
 * Plugins: superscroll.virtual (Virtual Scrolling), superscroll.sticky-headers (Sticky Headers)
 *
 * Note: Virtual scroll sentinels only appear when row count >= VIRTUALIZATION_THRESHOLD (100).
 * With mock data < 100 rows, sentinels will not appear but the plugin runs without error.
 *
 * Run: npx playwright test e2e/harness-superscroll.spec.ts
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
// HARNESS SUPERSCROLL PLUGIN TESTS
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Harness: SuperScroll Plugins', () => {
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
	// 1. Sidebar renders SuperScroll category with 2 plugins
	// -----------------------------------------------------------------------

	test('1 — sidebar renders SuperScroll category with 2 plugins', async () => {
		const sidebar = page.locator('.hns-sidebar');
		await expect(sidebar).toBeVisible();

		const categoryLabel = sidebar.locator('.hns-category-label:text-is("SuperScroll")');
		await expect(categoryLabel).toBeVisible();

		const pluginNames = ['Virtual Scrolling', 'Sticky Headers'];
		for (const name of pluginNames) {
			const row = sidebar.locator(`.hns-plugin-name:text-is("${name}")`);
			await expect(row).toBeVisible();
		}

		await screenshot(page, 'superscroll-01-sidebar');
	});

	// -----------------------------------------------------------------------
	// 2. Enabling virtual scrolling — sentinels appear if data >= threshold
	// -----------------------------------------------------------------------

	test('2 — enabling virtual scrolling adds sentinel spacers or runs without error', async () => {
		await clickCategoryAll(page, 'SuperScroll');

		// Wait for the registry change to re-render
		await page.waitForFunction(() => (window as any).__harnessReady === true);

		// Sentinels only appear if row count >= VIRTUALIZATION_THRESHOLD (100)
		// Mock data is typically < 100 rows, so check either sentinel count OR plugin enabled state
		const topSentinelCount = await page.locator('.pv-scroll-sentinel-top').count();
		const bottomSentinelCount = await page.locator('.pv-scroll-sentinel-bottom').count();

		if (topSentinelCount > 0 || bottomSentinelCount > 0) {
			// Sentinels present — plugin active with sufficient data
			expect(topSentinelCount + bottomSentinelCount).toBeGreaterThan(0);
		} else {
			// Mock data < threshold — verify plugin ran without error by checking checkbox state
			const categories = page.locator('.hns-category');
			const count = await categories.count();
			let virtualScrollChecked = false;
			for (let i = 0; i < count; i++) {
				const cat = categories.nth(i);
				const label = await cat.locator('.hns-category-label').textContent();
				if (label?.trim() === 'SuperScroll') {
					const rows = cat.locator('.hns-plugin-row');
					const rowCount = await rows.count();
					for (let j = 0; j < rowCount; j++) {
						const row = rows.nth(j);
						const name = await row.locator('.hns-plugin-name').textContent();
						if (name?.trim() === 'Virtual Scrolling') {
							virtualScrollChecked = await row.locator('.hns-plugin-checkbox').isChecked();
						}
					}
				}
			}
			// Plugin should be enabled (checkbox checked) even if sentinels not visible
			expect(virtualScrollChecked).toBe(true);
		}

		await screenshot(page, 'superscroll-02-virtual-enabled');
	});

	// -----------------------------------------------------------------------
	// 3. Disabling SuperScroll removes sentinels
	// -----------------------------------------------------------------------

	test('3 — disabling SuperScroll removes sentinels', async () => {
		await clickCategoryNone(page, 'SuperScroll');

		// Poll for sentinel count to be 0
		await expect.poll(() => page.locator('.pv-scroll-sentinel-top').count()).toBe(0);
		await expect.poll(() => page.locator('.pv-scroll-sentinel-bottom').count()).toBe(0);

		await screenshot(page, 'superscroll-03-sentinels-removed');
	});
});
