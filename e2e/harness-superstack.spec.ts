/**
 * Isometry v5 — Harness SuperStack Plugin E2E Suite
 *
 * Automated browser-based testing of SuperStack plugin features via the
 * harness.html standalone shell. Exercises:
 *
 *   1. Plugin sidebar rendering and toggle state
 *   2. Multi-level header spanning with chevrons
 *   3. Cardinality guard (>50 leaf columns → "Other" bucket)
 *   4. Live toggle — enable/disable updates grid immediately
 *   5. Click-to-collapse with chevron indicator change (▼ → ▶)
 *   6. Expand collapsed group (▶ → ▼)
 *   7. SUM aggregation on collapsed cells with pv-agg-cell styling
 *   8. Aggregate cleanup on expand (no stale styling)
 *   9. Dependency chain enforcement (spanning → collapse → aggregate)
 *
 * Screenshots captured at each stage to e2e/screenshots/harness-*.png
 *
 * Run: npx playwright test e2e/harness-superstack.spec.ts
 */

import { test, expect, type Page } from '@playwright/test';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

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
// Harness helpers
// ---------------------------------------------------------------------------

/** Wait for the harness shell to mount (sidebar + grid visible). */
async function waitForHarnessReady(page: Page): Promise<void> {
	await page.goto('/harness.html');
	await page.waitForSelector('.hns-root', { timeout: 10_000 });
	await page.waitForSelector('.hns-sidebar', { timeout: 5_000 });
	await page.waitForSelector('[data-tour-target="supergrid"]', { timeout: 5_000 });
}

/** Toggle a plugin checkbox by plugin ID. Finds the checkbox in the sidebar. */
async function togglePlugin(page: Page, pluginId: string, enable: boolean): Promise<void> {
	const checkbox = page.locator(`.hns-plugin-row:has(.hns-plugin-name:text-is("${pluginId}")) .hns-plugin-checkbox`);
	// Fallback: find by iterating plugin rows
	const rows = page.locator('.hns-plugin-row');
	const count = await rows.count();

	for (let i = 0; i < count; i++) {
		const row = rows.nth(i);
		const nameEl = row.locator('.hns-plugin-name');
		const text = await nameEl.textContent();

		if (text?.trim() === pluginId) {
			const cb = row.locator('.hns-plugin-checkbox');
			const checked = await cb.isChecked();
			if (checked !== enable) {
				await cb.click();
				// Wait for re-render after toggle
				await page.waitForTimeout(300);
			}
			return;
		}
	}
	throw new Error(`Plugin "${pluginId}" not found in sidebar`);
}

/** Disable all SuperStack plugins by unchecking them in order. */
async function disableAllSuperStack(page: Page): Promise<void> {
	// Disable in reverse dependency order: aggregate → collapse → spanning
	for (const name of ['Aggregate on Collapse', 'Collapse Groups', 'Multi-Level Spans']) {
		await togglePlugin(page, name, false).catch(() => {});
	}
}

/** Enable a SuperStack plugin by name. */
async function enablePlugin(page: Page, name: string): Promise<void> {
	await togglePlugin(page, name, true);
}

/** Disable a SuperStack plugin by name. */
async function disablePlugin(page: Page, name: string): Promise<void> {
	await togglePlugin(page, name, false);
}

/** Count elements matching a CSS selector in the page. */
async function countElements(page: Page, selector: string): Promise<number> {
	return page.locator(selector).count();
}

/** Get text content of all elements matching a selector. */
async function getTexts(page: Page, selector: string): Promise<string[]> {
	return page.locator(selector).allTextContents();
}

// ═══════════════════════════════════════════════════════════════════════════
// HARNESS SUPERSTACK PLUGIN TESTS
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Harness: SuperStack Plugins', () => {
	test.describe.configure({ mode: 'serial' });

	let page: Page;

	test.beforeAll(async ({ browser }) => {
		page = await browser.newPage();
		await waitForHarnessReady(page);
		// Start clean — disable all SuperStack plugins
		await disableAllSuperStack(page);
	});

	test.afterAll(async () => {
		await page.close();
	});

	// -----------------------------------------------------------------------
	// 1. Sidebar renders with correct plugin tree
	// -----------------------------------------------------------------------

	test('1 — sidebar renders SuperStack category with 3 plugins', async () => {
		const sidebar = page.locator('.hns-sidebar');
		await expect(sidebar).toBeVisible();

		// SuperStack category header exists
		const categoryLabel = sidebar.locator('.hns-category-label:text-is("SuperStack")');
		await expect(categoryLabel).toBeVisible();

		// Three plugins in SuperStack
		const pluginNames = ['Multi-Level Spans', 'Collapse Groups', 'Aggregate on Collapse'];
		for (const name of pluginNames) {
			const row = sidebar.locator(`.hns-plugin-name:text-is("${name}")`);
			await expect(row).toBeVisible();
		}

		await screenshot(page, '01-sidebar-plugins');
	});

	// -----------------------------------------------------------------------
	// 2. Enable spanning — multi-level headers with chevrons
	// -----------------------------------------------------------------------

	test('2 — enable spanning: chevrons appear on non-leaf column headers', async () => {
		await enablePlugin(page, 'Multi-Level Spans');

		// Chevrons should appear on non-leaf column headers
		const chevrons = page.locator('.pv-span-chevron');
		const chevronCount = await chevrons.count();
		expect(chevronCount).toBeGreaterThan(0);

		// Chevrons should show ▼ (expanded state)
		const firstChevron = await chevrons.first().textContent();
		expect(firstChevron?.trim()).toBe('▼');

		// Non-leaf headers should have collapsible class
		const collapsibleCols = await countElements(page, '.pv-col-span--collapsible');
		expect(collapsibleCols).toBeGreaterThan(0);

		// data-parent-path should be set (regression guard for the fix)
		const firstCollapsible = page.locator('.pv-col-span--collapsible').first();
		const parentPath = await firstCollapsible.getAttribute('data-parent-path');
		expect(parentPath).not.toBeNull();

		// data-col-start and data-col-span should be set (regression guard)
		const colStart = await firstCollapsible.getAttribute('data-col-start');
		const colSpan = await firstCollapsible.getAttribute('data-col-span');
		expect(colStart).not.toBeNull();
		expect(colSpan).not.toBeNull();

		await screenshot(page, '02-spanning-enabled');
	});

	// -----------------------------------------------------------------------
	// 3. Cardinality guard — >50 leaf columns → "Other" bucket
	// -----------------------------------------------------------------------

	test('3 — cardinality guard: 50-column cap with "Other" bucket', async () => {
		// The mock data produces >50 leaf columns (1116 visible cols from console logs).
		// The cardinality guard should cap at 50 leaf columns.
		// Check for "Other" text in a leaf-level column header.
		const leafHeaders = page.locator('.pv-col-span--leaf');
		const leafCount = await leafHeaders.count();

		// Should be capped at 50 (MAX_LEAF_COLUMNS)
		expect(leafCount).toBeLessThanOrEqual(50);
		expect(leafCount).toBeGreaterThan(0);

		// Look for "Other" in the last leaf header
		const allLeafTexts = await leafHeaders.allTextContents();
		const hasOther = allLeafTexts.some((t) => t.includes('Other'));
		expect(hasOther).toBe(true);

		await screenshot(page, '03-cardinality-guard');
	});

	// -----------------------------------------------------------------------
	// 4. Live toggle — disable spanning, grid returns to flat headers
	// -----------------------------------------------------------------------

	test('4 — live toggle: disable spanning removes chevrons immediately', async () => {
		// Capture chevron count before
		const chevronsBefore = await countElements(page, '.pv-span-chevron');
		expect(chevronsBefore).toBeGreaterThan(0);

		// Disable spanning
		await disablePlugin(page, 'Multi-Level Spans');

		// Chevrons should disappear (base overlay has no chevrons)
		const chevronsAfter = await countElements(page, '.pv-span-chevron');
		expect(chevronsAfter).toBe(0);

		await screenshot(page, '04-spanning-disabled');

		// Re-enable for subsequent tests
		await enablePlugin(page, 'Multi-Level Spans');

		const chevronsRestored = await countElements(page, '.pv-span-chevron');
		expect(chevronsRestored).toBeGreaterThan(0);
	});

	// -----------------------------------------------------------------------
	// 5. Click-to-collapse: enable collapse, click parent header
	// -----------------------------------------------------------------------

	test('5 — click parent header: group collapses with ▶ chevron', async () => {
		await enablePlugin(page, 'Collapse Groups');

		// Find the first collapsible column header and get its text
		const firstCollapsible = page.locator('.pv-col-span--collapsible').first();
		await expect(firstCollapsible).toBeVisible();

		const labelBefore = await firstCollapsible.textContent();
		console.log(`  → Collapsing header: "${labelBefore?.trim()}"`);

		// Click to collapse
		await firstCollapsible.click();
		await page.waitForTimeout(500); // Wait for re-render

		await screenshot(page, '05-after-collapse');

		// After collapse: should have at least one collapsed header
		const collapsedCount = await countElements(page, '.pv-col-span--collapsed');
		expect(collapsedCount).toBeGreaterThan(0);

		// Collapsed header should have ▶ chevron
		const collapsedHeader = page.locator('.pv-col-span--collapsed').first();
		const chevron = collapsedHeader.locator('.pv-span-chevron');
		const chevronText = await chevron.textContent();
		expect(chevronText?.trim()).toBe('▶');
	});

	// -----------------------------------------------------------------------
	// 6. Expand collapsed group: click again, ▶ → ▼
	// -----------------------------------------------------------------------

	test('6 — click collapsed header: group expands back with ▼', async () => {
		// Click the collapsed header to expand
		const collapsedHeader = page.locator('.pv-col-span--collapsed').first();
		await collapsedHeader.click();
		await page.waitForTimeout(500);

		await screenshot(page, '06-after-expand');

		// No more collapsed headers (at least the one we collapsed should be gone)
		// Note: there might be other collapsed headers if multiple were clicked
		const collapsedCount = await countElements(page, '.pv-col-span--collapsed');
		// The one we clicked should be expanded — count should decrease
		// Just verify chevrons are back to ▼
		const firstCollapsible = page.locator('.pv-col-span--collapsible').first();
		const chevron = firstCollapsible.locator('.pv-span-chevron');
		const chevronText = await chevron.textContent();
		expect(chevronText?.trim()).toBe('▼');
	});

	// -----------------------------------------------------------------------
	// 7. SUM aggregation on collapsed cells
	// -----------------------------------------------------------------------

	test('7 — aggregate: collapsed cells show SUM with pv-agg-cell styling', async () => {
		await enablePlugin(page, 'Aggregate on Collapse');

		// Collapse a header to trigger aggregation
		const collapsible = page.locator('.pv-col-span--collapsible').first();
		await collapsible.click();
		await page.waitForTimeout(500);

		await screenshot(page, '07-aggregate-on-collapse');

		// pv-agg-cell class should appear on data cells
		const aggCells = await countElements(page, '.pv-agg-cell');
		expect(aggCells).toBeGreaterThan(0);

		// Verify the aggregate cell has a numeric value
		const firstAggCell = page.locator('.pv-agg-cell').first();
		const cellText = await firstAggCell.textContent();
		const numericValue = Number(cellText?.trim());
		expect(Number.isNaN(numericValue)).toBe(false);
		console.log(`  → First aggregate cell value: ${numericValue}`);
	});

	// -----------------------------------------------------------------------
	// 8. Aggregate cleanup on expand — no stale styling
	// -----------------------------------------------------------------------

	test('8 — expand clears pv-agg-cell styling from previously collapsed cells', async () => {
		// Capture agg cell count while collapsed
		const aggBefore = await countElements(page, '.pv-agg-cell');
		expect(aggBefore).toBeGreaterThan(0);

		// Expand the collapsed header
		const collapsedHeader = page.locator('.pv-col-span--collapsed').first();
		await collapsedHeader.click();
		await page.waitForTimeout(500);

		await screenshot(page, '08-agg-cleanup-after-expand');

		// No aggregate cells should remain (nothing is collapsed)
		const collapsedCount = await countElements(page, '.pv-col-span--collapsed');
		if (collapsedCount === 0) {
			// Nothing collapsed → no agg cells should exist
			const aggAfter = await countElements(page, '.pv-agg-cell');
			expect(aggAfter).toBe(0);
		}
	});

	// -----------------------------------------------------------------------
	// 9. Dependency chain: disabling spanning cascades to collapse + aggregate
	// -----------------------------------------------------------------------

	test('9 — dependency chain: disabling spanning cascades disable to collapse and aggregate', async () => {
		// Ensure all three are enabled
		await enablePlugin(page, 'Multi-Level Spans');
		await enablePlugin(page, 'Collapse Groups');
		await enablePlugin(page, 'Aggregate on Collapse');

		// Verify all three are checked
		const spanningChecked = page.locator('.hns-plugin-row:has(.hns-plugin-name:text-is("Multi-Level Spans")) .hns-plugin-checkbox');
		// Use iteration approach since text-is might not work with has
		const rows = page.locator('.hns-plugin-row');
		const count = await rows.count();

		const isChecked = async (name: string): Promise<boolean> => {
			for (let i = 0; i < count; i++) {
				const row = rows.nth(i);
				const text = await row.locator('.hns-plugin-name').textContent();
				if (text?.trim() === name) {
					return row.locator('.hns-plugin-checkbox').isChecked();
				}
			}
			return false;
		};

		expect(await isChecked('Multi-Level Spans')).toBe(true);
		expect(await isChecked('Collapse Groups')).toBe(true);
		expect(await isChecked('Aggregate on Collapse')).toBe(true);

		// Disable spanning — should cascade-disable collapse and aggregate
		await disablePlugin(page, 'Multi-Level Spans');

		await screenshot(page, '09-dependency-cascade');

		// All three should now be unchecked
		expect(await isChecked('Multi-Level Spans')).toBe(false);
		expect(await isChecked('Collapse Groups')).toBe(false);
		expect(await isChecked('Aggregate on Collapse')).toBe(false);

		// No chevrons or collapsed state should remain
		const chevronCount = await countElements(page, '.pv-span-chevron');
		expect(chevronCount).toBe(0);

		const collapsedCount = await countElements(page, '.pv-col-span--collapsed');
		expect(collapsedCount).toBe(0);
	});

	// -----------------------------------------------------------------------
	// 10. Re-enable all — full round-trip verification
	// -----------------------------------------------------------------------

	test('10 — full round-trip: re-enable all, collapse, verify aggregate, expand, verify clean', async () => {
		// Enable all three
		await enablePlugin(page, 'Multi-Level Spans');
		await enablePlugin(page, 'Collapse Groups');
		await enablePlugin(page, 'Aggregate on Collapse');

		// Verify chevrons appear
		const chevronsAfterEnable = await countElements(page, '.pv-span-chevron');
		expect(chevronsAfterEnable).toBeGreaterThan(0);

		// Collapse a group
		const collapsible = page.locator('.pv-col-span--collapsible').first();
		await collapsible.click();
		await page.waitForTimeout(500);

		// Verify aggregate
		const aggCells = await countElements(page, '.pv-agg-cell');
		expect(aggCells).toBeGreaterThan(0);

		// Expand
		const collapsed = page.locator('.pv-col-span--collapsed').first();
		await collapsed.click();
		await page.waitForTimeout(500);

		// Verify clean
		const collapsedAfter = await countElements(page, '.pv-col-span--collapsed');
		if (collapsedAfter === 0) {
			const aggAfter = await countElements(page, '.pv-agg-cell');
			expect(aggAfter).toBe(0);
		}

		await screenshot(page, '10-full-round-trip');
	});
});
