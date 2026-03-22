/**
 * Isometry v5 — Harness SuperZoom Plugin E2E Suite
 *
 * Verifies toggling the SuperZoom plugin category in HarnessShell sidebar
 * produces expected DOM changes in the pivot grid.
 *
 * Plugins: superzoom.slider (Zoom Slider), superzoom.scale (Cell Scaling)
 *
 * Run: npx playwright test e2e/harness-superzoom.spec.ts
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
// HARNESS SUPERZOOM PLUGIN TESTS
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Harness: SuperZoom Plugins', () => {
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
	// 1. Sidebar renders SuperZoom category with 2 plugins
	// -----------------------------------------------------------------------

	test('1 — sidebar renders SuperZoom category with 2 plugins', async () => {
		const sidebar = page.locator('.hns-sidebar');
		await expect(sidebar).toBeVisible();

		const categoryLabel = sidebar.locator('.hns-category-label:text-is("SuperZoom")');
		await expect(categoryLabel).toBeVisible();

		const pluginNames = ['Zoom Slider', 'Cell Scaling'];
		for (const name of pluginNames) {
			const row = sidebar.locator(`.hns-plugin-name:text-is("${name}")`);
			await expect(row).toBeVisible();
		}

		await screenshot(page, 'superzoom-01-sidebar');
	});

	// -----------------------------------------------------------------------
	// 2. Enabling SuperZoom shows zoom slider in sidebar
	// -----------------------------------------------------------------------

	test('2 — enabling SuperZoom shows zoom slider', async () => {
		await clickCategoryAll(page, 'SuperZoom');

		// Poll for zoom control to appear in sidebar
		await expect.poll(() => page.locator('.hns-zoom-control').count()).toBeGreaterThan(0);

		await expect(page.locator('.hns-zoom-control')).toBeVisible();

		await screenshot(page, 'superzoom-02-slider-visible');
	});

	// -----------------------------------------------------------------------
	// 3. Zoom slider changes value display
	// -----------------------------------------------------------------------

	test('3 — zoom slider changes value display', async () => {
		const slider = page.locator('.hns-zoom-slider');
		await expect(slider).toBeVisible();

		// Fill slider with 2 (within the 0.5-3 range) and dispatch input event
		await slider.fill('2');
		await slider.dispatchEvent('input');

		// Verify the zoom value display updates to show 2.0x
		await expect.poll(async () => {
			const text = await page.locator('.hns-zoom-value').textContent();
			return text ?? '';
		}).toContain('2');

		await screenshot(page, 'superzoom-03-value-display');
	});

	// -----------------------------------------------------------------------
	// 4. Disabling SuperZoom removes slider
	// -----------------------------------------------------------------------

	test('4 — disabling SuperZoom removes slider', async () => {
		await clickCategoryNone(page, 'SuperZoom');

		// Poll for zoom control to disappear
		await expect.poll(() => page.locator('.hns-zoom-control').count()).toBe(0);

		await screenshot(page, 'superzoom-04-slider-removed');
	});
});
