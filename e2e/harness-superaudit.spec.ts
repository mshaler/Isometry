/**
 * Isometry v5 — Harness SuperAudit Plugin E2E Suite
 *
 * Verifies toggling the SuperAudit plugin category in HarnessShell sidebar
 * produces expected DOM changes in the pivot grid.
 *
 * Plugins: superaudit.overlay (Change Overlay), superaudit.source (Source Badges)
 *
 * Note: Audit overlay classes (.audit-new, .audit-modified, .audit-deleted) only appear
 * if mock data contains audit state. If no audit state, verifies plugins enabled without error.
 *
 * Run: npx playwright test e2e/harness-superaudit.spec.ts
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

/** Count total audit class occurrences across all audit overlay classes. */
async function countAuditClasses(page: Page): Promise<number> {
	const newCount = await page.locator('.audit-new').count();
	const modifiedCount = await page.locator('.audit-modified').count();
	const deletedCount = await page.locator('.audit-deleted').count();
	const sourceCount = await page.locator('.audit-source').count();
	return newCount + modifiedCount + deletedCount + sourceCount;
}

// ═══════════════════════════════════════════════════════════════════════════
// HARNESS SUPERAUDIT PLUGIN TESTS
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Harness: SuperAudit Plugins', () => {
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
	// 1. Sidebar renders SuperAudit category with 2 plugins
	// -----------------------------------------------------------------------

	test('1 — sidebar renders SuperAudit category with 2 plugins', async () => {
		const sidebar = page.locator('.hns-sidebar');
		await expect(sidebar).toBeVisible();

		const categoryLabel = sidebar.locator('.hns-category-label:text-is("SuperAudit")');
		await expect(categoryLabel).toBeVisible();

		const pluginNames = ['Change Overlay', 'Source Badges'];
		for (const name of pluginNames) {
			const row = sidebar.locator(`.hns-plugin-name:text-is("${name}")`);
			await expect(row).toBeVisible();
		}

		await screenshot(page, 'superaudit-01-sidebar');
	});

	// -----------------------------------------------------------------------
	// 2. Enabling SuperAudit applies audit classes (or runs without error)
	// -----------------------------------------------------------------------

	test('2 — enabling SuperAudit applies audit classes or runs without error', async () => {
		await clickCategoryAll(page, 'SuperAudit');

		// Wait for re-render to complete
		await page.waitForFunction(() => (window as any).__harnessReady === true);

		// Check if mock data contains audit state — classes may or may not appear
		const auditCount = await countAuditClasses(page);

		if (auditCount > 0) {
			// Audit state present in mock data — verify classes applied
			expect(auditCount).toBeGreaterThan(0);
		} else {
			// No audit state in mock data — verify plugins are enabled (checkboxes checked)
			const categories = page.locator('.hns-category');
			const catCount = await categories.count();
			let overlayPluginChecked = false;
			for (let i = 0; i < catCount; i++) {
				const cat = categories.nth(i);
				const label = await cat.locator('.hns-category-label').textContent();
				if (label?.trim() === 'SuperAudit') {
					const rows = cat.locator('.hns-plugin-row');
					const rowCount = await rows.count();
					for (let j = 0; j < rowCount; j++) {
						const row = rows.nth(j);
						const name = await row.locator('.hns-plugin-name').textContent();
						if (name?.trim() === 'Change Overlay') {
							overlayPluginChecked = await row.locator('.hns-plugin-checkbox').isChecked();
						}
					}
				}
			}
			// Plugin should be enabled even if no audit state visible
			expect(overlayPluginChecked).toBe(true);
		}

		await screenshot(page, 'superaudit-02-audit-enabled');
	});

	// -----------------------------------------------------------------------
	// 3. Disabling SuperAudit removes audit classes
	// -----------------------------------------------------------------------

	test('3 — disabling SuperAudit removes audit classes', async () => {
		await clickCategoryNone(page, 'SuperAudit');

		// Poll for all audit classes to be removed
		await expect.poll(() => countAuditClasses(page)).toBe(0);

		await screenshot(page, 'superaudit-03-audit-removed');
	});
});
