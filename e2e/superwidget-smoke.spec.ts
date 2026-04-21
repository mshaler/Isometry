/**
 * SuperWidget WebKit smoke test — INTG-07
 *
 * Exercises the Explorer -> View/Bound -> Editor transition matrix in a real
 * browser (WebKit). Proves CSS Grid layout, slot structure, and canvas
 * lifecycle work in an actual rendering engine.
 *
 * This is the capstone v13.0 quality gate (CI hard gate, no continue-on-error).
 */
import { test, expect } from '@playwright/test';

test.describe.configure({ retries: 0 });

test.describe('SuperWidget WebKit smoke', () => {
	const HARNESS_URL = '/e2e/fixtures/superwidget-harness.html';

	// Base projection for Explorer (Step 1)
	const explorerProjection = {
		canvasType: 'Explorer',
		canvasBinding: 'Unbound',
		zoneRole: 'primary',
		canvasId: 'explorer-1',
		activeTabId: 'tab-1',
		enabledTabIds: ['tab-1'],
	};

	// View/Bound projection (Step 2)
	const viewBoundProjection = {
		canvasType: 'View',
		canvasBinding: 'Bound',
		zoneRole: 'secondary',
		canvasId: 'view-1',
		activeTabId: 'tab-1',
		enabledTabIds: ['tab-1'],
	};

	// Editor projection (Step 3)
	const editorProjection = {
		canvasType: 'Editor',
		canvasBinding: 'Unbound',
		zoneRole: 'tertiary',
		canvasId: 'editor-1',
		activeTabId: 'tab-1',
		enabledTabIds: ['tab-1'],
	};

	test('transition matrix: Explorer -> View/Bound -> Editor', async ({ page }) => {
		await page.goto(HARNESS_URL);

		// Wait for harness to mount — __sw exposed means SuperWidget is ready
		await page.waitForFunction(() => !!(window as any).__sw, { timeout: 10_000 });

		// -----------------------------------------------------------------------
		// Step 1: Commit Explorer projection
		// -----------------------------------------------------------------------
		await page.evaluate((proj) => {
			(window as any).__sw.commitProjection(proj);
		}, explorerProjection);

		// Explorer canvas visible, no sidecar
		await expect(page.locator('[data-canvas-type="Explorer"]')).toBeVisible();
		await expect(page.locator('[data-sidecar]')).toHaveCount(0);

		// Header shows zone label for primary
		await expect(page.locator('[data-slot="header"]')).toContainText('Primary');

		// -----------------------------------------------------------------------
		// Step 2: Commit View/Bound projection
		// -----------------------------------------------------------------------
		await page.evaluate((proj) => {
			(window as any).__sw.commitProjection(proj);
		}, viewBoundProjection);

		// View canvas visible with sidecar (Bound binding)
		await expect(page.locator('[data-canvas-type="View"]')).toBeVisible();
		await expect(page.locator('[data-sidecar]')).toHaveCount(1);

		// Explorer canvas gone
		await expect(page.locator('[data-canvas-type="Explorer"]')).toHaveCount(0);

		// Zone label updated to secondary
		await expect(page.locator('[data-slot="header"]')).toContainText('Secondary');

		// -----------------------------------------------------------------------
		// Step 3: Commit Editor projection
		// -----------------------------------------------------------------------
		await page.evaluate((proj) => {
			(window as any).__sw.commitProjection(proj);
		}, editorProjection);

		// Editor canvas visible, View canvas gone, no sidecar
		await expect(page.locator('[data-canvas-type="Editor"]')).toBeVisible();
		await expect(page.locator('[data-canvas-type="View"]')).toHaveCount(0);
		await expect(page.locator('[data-sidecar]')).toHaveCount(0);

		// Zone label updated to tertiary
		await expect(page.locator('[data-slot="header"]')).toContainText('Tertiary');
	});
});
