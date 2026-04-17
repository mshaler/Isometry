/**
 * Isometry v11.1 — E2E: Inline Embedding Flows
 *
 * Smoke spec for Phase 154 regression guard: verifies that dock nav buttons
 * correctly show/hide top-slot and bottom-slot inline explorer containers.
 *
 * Tests:
 *   1. Data dock button (integrate:catalog) shows top-slot with data-explorer
 *   2. Data dock button again hides top-slot
 *   3. SuperGrid view (visualize:supergrid) shows projection-explorer in top-slot
 *   4. Timeline view (visualize:timeline) hides projection-explorer
 *   5. Filter dock button (analyze:filter) shows bottom-slot with latch-filters
 *   6. View switch while filters on — latch-filters remains visible
 *
 * Requirements: REGR-01
 */

import { test, expect } from './fixtures';

test.describe('Inline embedding flows', () => {
	test('Test 1: integrate:catalog shows top-slot with data-explorer', async ({ page }) => {
		await page.locator('button.dock-nav__item[data-section-key="integrate"][data-item-key="catalog"]').click();

		// Top slot becomes visible
		await expect(page.locator('.workbench-slot-top')).toBeVisible();

		// Data explorer child is visible inside top slot
		await expect(page.locator('.slot-top__data-explorer')).toBeVisible();
	});

	test('Test 2: integrate:catalog again hides top-slot', async ({ page }) => {
		const catalogBtn = page.locator('button.dock-nav__item[data-section-key="integrate"][data-item-key="catalog"]');

		// Open
		await catalogBtn.click();
		await expect(page.locator('.workbench-slot-top')).toBeVisible();

		// Toggle off
		await catalogBtn.click();
		await expect(page.locator('.workbench-slot-top')).toBeHidden();
	});

	test('Test 3: visualize:supergrid shows projection-explorer in top-slot', async ({ page }) => {
		await page.locator('button.dock-nav__item[data-section-key="visualize"][data-item-key="supergrid"]').click();

		// Top slot visible with projection-explorer child
		await expect(page.locator('.workbench-slot-top')).toBeVisible();
		await expect(page.locator('.slot-top__projection-explorer')).toBeVisible();
	});

	test('Test 4: visualize:timeline hides projection-explorer', async ({ page }) => {
		// First go to supergrid to show projection-explorer
		await page.locator('button.dock-nav__item[data-section-key="visualize"][data-item-key="supergrid"]').click();
		await expect(page.locator('.slot-top__projection-explorer')).toBeVisible();

		// Switch to timeline — projection-explorer should hide
		await page.locator('button.dock-nav__item[data-section-key="visualize"][data-item-key="timeline"]').click();
		await expect(page.locator('.slot-top__projection-explorer')).toBeHidden();
	});

	test('Test 5: analyze:filter shows bottom-slot with latch-filters', async ({ page }) => {
		await page.locator('button.dock-nav__item[data-section-key="analyze"][data-item-key="filter"]').click();

		// Bottom slot becomes visible
		await expect(page.locator('.workbench-slot-bottom')).toBeVisible();

		// LATCH filters child is visible inside bottom slot
		await expect(page.locator('.slot-bottom__latch-filters')).toBeVisible();
	});

	test('Test 6: latch-filters remains visible after view switch', async ({ page }) => {
		// Open filters
		await page.locator('button.dock-nav__item[data-section-key="analyze"][data-item-key="filter"]').click();
		await expect(page.locator('.slot-bottom__latch-filters')).toBeVisible();

		// Switch to timeline view
		await page.locator('button.dock-nav__item[data-section-key="visualize"][data-item-key="timeline"]').click();

		// Latch filters should still be visible (bottom slot is outside view-content)
		await expect(page.locator('.slot-bottom__latch-filters')).toBeVisible();
	});
});
