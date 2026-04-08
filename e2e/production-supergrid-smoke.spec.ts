/**
 * Isometry v5 — E2E: Production SuperGrid Smoke Test (Phase 144, SYNC-02)
 *
 * Validates: ProductionSuperGrid renders correctly in the main app with all 28 plugins
 * active and real bridge data. Uses the Meryl Streep baseline dataset.
 *
 * This spec targets the production path (index.html / main.ts / ProductionSuperGrid)
 * NOT the harness path (harness.html / HarnessShell). window.__harness is NOT available.
 *
 * Intentional differences from HarnessShell (documented in docs/HARNESS-PRODUCTION-DIFF.md):
 *   - Data: BridgeDataAdapter (sql.js) vs MockDataAdapter
 *   - Plugins: all 28 always-on vs toggle-controlled defaults
 *   - Shell: ViewManager-managed IView vs self-contained HarnessShell
 */

import { test, expect } from './fixtures';

test.describe('Production SuperGrid smoke: renders with real data + all 28 plugins', () => {
	test('SuperGrid view renders column headers and data cells', async ({ page, baselineCardCount }) => {
		// Fixture has already loaded Meryl Streep dataset and switched to Timeline.
		// baselineCardCount is the ground truth card count from sql.js.
		expect(baselineCardCount).toBeGreaterThan(0);

		// Switch to SuperGrid via the production ViewManager path.
		// This instantiates ProductionSuperGrid with all 28 plugins enabled via BridgeDataAdapter.
		await page.evaluate(async () => {
			const { viewManager, viewFactory } = (window as any).__isometry;
			await viewManager.switchTo('supergrid', () => viewFactory['supergrid']());
		});

		// Wait for PivotGrid to render leaf column headers.
		// pv-col-span--leaf is set by BaseHeaders plugin on leaf-level column spans.
		// SuperGrid uses PAFV defaults (status × project_id) so at least 1 leaf header is expected.
		await page.waitForFunction(
			() => document.querySelectorAll('.pv-col-span--leaf').length > 0,
			{ timeout: 10_000 },
		);

		// Verify leaf column headers are present.
		const leafHeaderCount = await page.evaluate(
			() => document.querySelectorAll('.pv-col-span--leaf').length,
		);
		expect(leafHeaderCount, 'SuperGrid should render at least 1 leaf column header').toBeGreaterThan(0);

		// Verify data cells are present.
		const dataCellCount = await page.evaluate(
			() => document.querySelectorAll('.pv-data-cell').length,
		);
		expect(dataCellCount, 'SuperGrid should render at least 1 data cell').toBeGreaterThan(0);

		// Alignment check: the number of data cells per row should be consistent with
		// the number of leaf column headers. Data cells are laid out in a CSS grid
		// where each row has exactly leafHeaderCount data cells.
		// Total data cells should be a multiple of leafHeaderCount.
		expect(
			dataCellCount % leafHeaderCount,
			`dataCellCount (${dataCellCount}) should be a multiple of leafHeaderCount (${leafHeaderCount}) — misalignment would indicate a rendering bug`,
		).toBe(0);

		// Verify the view container has visible height (not invisible-render bug).
		const containerHeight = await page.evaluate(() => {
			const el = document.querySelector('.workbench-view-content');
			return el ? el.clientHeight : 0;
		});
		expect(containerHeight, 'SuperGrid view container should have visible height > 100').toBeGreaterThan(100);
	});

	test('SuperGrid view does not expose window.__harness (production path, not harness)', async ({ page, baselineCardCount }) => {
		expect(baselineCardCount).toBeGreaterThan(0);

		// Confirm this is the production path — window.__harness should NOT exist.
		const harnessExists = await page.evaluate(() => !!(window as any).__harness);
		expect(harnessExists, 'window.__harness should not be present in production path').toBe(false);
	});
});
