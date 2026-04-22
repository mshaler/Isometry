/**
 * 3-Canvas E2E Gate — Phase 173
 *
 * Playwright WebKit CI hard gate covering:
 *   INTG-01: Full 6-direction canvas transition matrix
 *   INTG-02: 9-view cycle DOM leak detection (exactly 1 child per transition)
 *   INTG-04: Rapid 3-transition burst — destroy-before-mount ordering under synchronous re-entry
 *
 * CANV-06 (INTG-03) is covered by tests/superwidget/registry.test.ts (unit test, per D-03/D-04).
 *
 * Uses canvas-e2e-gate-harness.html which registers all 3 canvas IDs via stubs.
 * Retries disabled — this is a hard gate (D-01).
 */
import { test, expect } from '@playwright/test';

test.describe.configure({ retries: 0 });

const HARNESS_URL = '/e2e/fixtures/canvas-e2e-gate-harness.html';

// Projection shapes for all 3 canvas types (matching superwidget-smoke.spec.ts)
const explorerProjection = {
	canvasType: 'Explorer',
	canvasBinding: 'Unbound',
	zoneRole: 'primary',
	canvasId: 'explorer-1',
	activeTabId: 'tab-1',
	enabledTabIds: ['tab-1'],
};

const viewBoundProjection = {
	canvasType: 'View',
	canvasBinding: 'Bound',
	zoneRole: 'secondary',
	canvasId: 'view-1',
	activeTabId: 'tab-1',
	enabledTabIds: ['tab-1'],
};

const editorProjection = {
	canvasType: 'Editor',
	canvasBinding: 'Unbound',
	zoneRole: 'tertiary',
	canvasId: 'editor-1',
	activeTabId: 'tab-1',
	enabledTabIds: ['tab-1'],
};

const ALL_VIEWS = [
	'list',
	'grid',
	'kanban',
	'calendar',
	'timeline',
	'gallery',
	'network',
	'tree',
	'supergrid',
] as const;

/**
 * Commit a projection and assert:
 * 1. The expected canvas type is visible
 * 2. The canvas slot has exactly 1 child (no leaks)
 */
async function commitAndAssert(
	page: import('@playwright/test').Page,
	projection: Record<string, unknown>,
	expectedType: string,
): Promise<void> {
	await page.evaluate((proj) => {
		(window as any).__sw.commitProjection(proj);
	}, projection);
	await expect(page.locator(`[data-canvas-type="${expectedType}"]`)).toBeVisible({ timeout: 5_000 });
	await expect(page.locator('[data-slot="canvas"] > *')).toHaveCount(1);
}

test.describe('3-Canvas E2E Gate', () => {
	test('INTG-01: 6-direction canvas transition matrix', async ({ page }) => {
		await page.goto(HARNESS_URL);
		await page.waitForFunction(() => !!(window as any).__sw, { timeout: 10_000 });

		// 1. Explorer -> View
		await commitAndAssert(page, viewBoundProjection, 'View');
		await expect(page.locator('[data-canvas-type="Explorer"]')).toHaveCount(0);

		// 2. View -> Explorer
		await commitAndAssert(page, explorerProjection, 'Explorer');
		await expect(page.locator('[data-canvas-type="View"]')).toHaveCount(0);

		// 3. Explorer -> Editor
		await commitAndAssert(page, editorProjection, 'Editor');
		await expect(page.locator('[data-canvas-type="Explorer"]')).toHaveCount(0);

		// 4. Editor -> Explorer
		await commitAndAssert(page, explorerProjection, 'Explorer');
		await expect(page.locator('[data-canvas-type="Editor"]')).toHaveCount(0);

		// 5. Editor -> View: navigate to Editor first, then View
		await commitAndAssert(page, editorProjection, 'Editor');
		await expect(page.locator('[data-canvas-type="Explorer"]')).toHaveCount(0);
		await commitAndAssert(page, viewBoundProjection, 'View');
		await expect(page.locator('[data-canvas-type="Editor"]')).toHaveCount(0);

		// 6. View -> Editor
		await commitAndAssert(page, editorProjection, 'Editor');
		await expect(page.locator('[data-canvas-type="View"]')).toHaveCount(0);
	});

	test('INTG-02: 9-view cycle DOM leak detection', async ({ page }) => {
		await page.goto(HARNESS_URL);
		await page.waitForFunction(() => !!(window as any).__sw, { timeout: 10_000 });

		// Start in View canvas
		await commitAndAssert(page, viewBoundProjection, 'View');

		// Cycle through all 9 views — canvas slot must have exactly 1 child each time
		for (const view of ALL_VIEWS) {
			await page.evaluate((v) => {
				const sw = (window as any).__sw;
				sw.commitProjection({
					canvasType: 'View',
					canvasBinding: 'Bound',
					zoneRole: 'secondary',
					canvasId: 'view-1',
					activeTabId: v,
					enabledTabIds: [v],
				});
			}, view);

			// Network view needs extra settle time
			await page.waitForTimeout(view === 'network' ? 2000 : 500);

			// Canvas slot must have exactly 1 child — no orphaned containers
			await expect(page.locator('[data-slot="canvas"] > *')).toHaveCount(1);
			await expect(page.locator('[data-canvas-type="View"]')).toBeVisible();
		}
	});

	test('INTG-04: Rapid 3-transition burst — destroy-before-mount ordering', async ({ page }) => {
		await page.goto(HARNESS_URL);
		await page.waitForFunction(() => !!(window as any).__sw, { timeout: 10_000 });

		// Collect console errors before the burst
		const consoleErrors: string[] = [];
		page.on('console', (msg) => {
			if (msg.type() === 'error') {
				consoleErrors.push(msg.text());
			}
		});

		// Fire 3 commitProjection calls synchronously — no awaits between them
		await page.evaluate((projs) => {
			const sw = (window as any).__sw;
			sw.commitProjection(projs[0]); // Explorer
			sw.commitProjection(projs[1]); // View
			sw.commitProjection(projs[2]); // Editor
		}, [explorerProjection, viewBoundProjection, editorProjection]);

		// Wait for the last committed projection (Editor) to settle
		await page.waitForFunction(
			() => document.querySelector('[data-canvas-type="Editor"]') !== null,
			{ timeout: 5_000 },
		);

		// Exactly 1 child — no orphaned DOM from rapid switching
		await expect(page.locator('[data-slot="canvas"] > *')).toHaveCount(1);

		// Last committed projection wins
		await expect(page.locator('[data-canvas-type="Editor"]')).toBeVisible();

		// No console errors during burst
		expect(consoleErrors).toEqual([]);
	});
});
