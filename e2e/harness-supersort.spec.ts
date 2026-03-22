/**
 * Isometry v5 — Harness SuperSort Plugin E2E Suite
 *
 * Verifies toggling the SuperSort plugin category in HarnessShell sidebar
 * produces expected DOM changes in the pivot grid.
 *
 * Plugins: supersort.header-click (Header Sort), supersort.chain (Sort Chain)
 *
 * Run: npx playwright test e2e/harness-supersort.spec.ts
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
// HARNESS SUPERSORT PLUGIN TESTS
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Harness: SuperSort Plugins', () => {
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
	// 1. Sidebar renders SuperSort category with 2 plugins
	// -----------------------------------------------------------------------

	test('1 — sidebar renders SuperSort category with 2 plugins', async () => {
		const sidebar = page.locator('.hns-sidebar');
		await expect(sidebar).toBeVisible();

		const categoryLabel = sidebar.locator('.hns-category-label:text-is("SuperSort")');
		await expect(categoryLabel).toBeVisible();

		const pluginNames = ['Header Sort', 'Sort Chain'];
		for (const name of pluginNames) {
			const row = sidebar.locator(`.hns-plugin-name:text-is("${name}")`);
			await expect(row).toBeVisible();
		}

		await screenshot(page, 'supersort-01-sidebar');
	});

	// -----------------------------------------------------------------------
	// 2. Enabling SuperSort allows header click sorting
	// -----------------------------------------------------------------------

	test('2 — enabling SuperSort activates header sort plugin', async () => {
		await clickCategoryAll(page, 'SuperSort');

		// Verify both SuperSort plugins are enabled
		const headerSortEnabled = await page.evaluate(() => (window as any).__harness.isEnabled('supersort.header-click'));
		const chainEnabled = await page.evaluate(() => (window as any).__harness.isEnabled('supersort.chain'));
		expect(headerSortEnabled).toBe(true);
		expect(chainEnabled).toBe(true);

		// Verify leaf headers exist (the sort plugin injects arrows into them)
		const firstLeaf = page.locator('.pv-col-span--leaf').first();
		await expect(firstLeaf).toBeVisible();

		// Confirm leaf headers have data-col-start (required for sort to work)
		const colStart = await firstLeaf.getAttribute('data-col-start');
		expect(colStart).not.toBeNull();

		// Trigger sort by dispatching a pointerdown synthetic event on the overlay element.
		// The overlay's JS listener routes events to the plugin registry.
		await page.evaluate(() => {
			const overlay = document.querySelector('.pv-overlay') as HTMLElement | null;
			const leaf = overlay?.querySelector('.pv-col-span--leaf') as HTMLElement | null;
			if (!leaf || !overlay) return;
			// Create a PointerEvent and dispatch on the leaf — bubbles up to overlay's listener
			const evt = new PointerEvent('pointerdown', {
				bubbles: true,
				cancelable: true,
				pointerId: 1,
				pointerType: 'mouse',
				clientX: leaf.getBoundingClientRect().x + 5,
				clientY: leaf.getBoundingClientRect().y + 5,
			});
			leaf.dispatchEvent(evt);
		});

		// Sort plugin's onSort triggers notifyChange → re-render with sort arrows
		await expect.poll(() => page.locator('.pv-sort-arrow').count(), { timeout: 10_000 }).toBeGreaterThan(0);

		await screenshot(page, 'supersort-02-sort-triggered');
	});

	// -----------------------------------------------------------------------
	// 3. Sort arrow shows direction indicator
	// -----------------------------------------------------------------------

	test('3 — sort arrow shows direction indicator', async () => {
		const firstArrow = page.locator('.pv-sort-arrow').first();
		await expect(firstArrow).toBeVisible();

		const arrowText = await firstArrow.textContent();
		// SuperSort uses ↑/↓ (arrows) not ▲/▼ (triangles)
		const isValidArrow = arrowText?.trim() === '↑' || arrowText?.trim() === '↓' ||
			arrowText?.trim() === '▲' || arrowText?.trim() === '▼';
		expect(isValidArrow).toBe(true);

		await screenshot(page, 'supersort-03-sort-arrow');
	});

	// -----------------------------------------------------------------------
	// 4. Disabling SuperSort removes sort indicators
	// -----------------------------------------------------------------------

	test('4 — disabling SuperSort removes sort indicators', async () => {
		await clickCategoryNone(page, 'SuperSort');

		// Poll for sort arrows to disappear
		await expect.poll(() => page.locator('.pv-sort-arrow').count()).toBe(0);

		await screenshot(page, 'supersort-04-sort-removed');
	});
});
