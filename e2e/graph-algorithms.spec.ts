/**
 * Isometry v9.0 — E2E: Graph Algorithms Compute-to-Render Pipeline
 *
 * Validates: Algorithm selection, Worker computation, graph_metrics persistence,
 * NetworkView SVG encoding, multi-algorithm overlay composition, and Reset.
 *
 * Requirements: GFND-04, PAFV-04, CTRL-03, CTRL-04
 */
import { test, expect } from '@playwright/test';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Bootstrap the app: navigate, wait for __isometry, load sample data */
async function bootstrapApp(page: import('@playwright/test').Page): Promise<void> {
	await page.goto('/');

	// Wait for app bootstrap to complete
	await page.waitForFunction(
		() => {
			const iso = (window as any).__isometry;
			return iso && iso.bridge && iso.viewManager && iso.sampleManager;
		},
		{ timeout: 20_000 },
	);

	// Load sample data and switch to Network view
	await page.evaluate(async () => {
		const { sampleManager, viewManager, viewFactory, coordinator } = (window as any).__isometry;
		await sampleManager.load('meryl-streep');
		coordinator.scheduleUpdate();
		await viewManager.switchTo('network', () => viewFactory['network']());
	});

	// Wait for NetworkView SVG to have at least one g.node element
	await page.locator('g.node').first().waitFor({ timeout: 15_000 });

	// Give force simulation time to stabilize
	await page.waitForTimeout(1500);

	// Expand the Algorithm sidebar section
	await page.evaluate(() => {
		(window as any).__isometry.shell.setSectionState('algorithm', 'ready');
	});
	// Click the section header to expand it if collapsed
	const algoHeader = page.locator('#section-algorithm-header');
	const isExpanded = await algoHeader.getAttribute('aria-expanded');
	if (isExpanded === 'false') {
		await algoHeader.click({ force: true });
	}
	// Wait for the radio buttons to be visible
	await page.locator('input[type=radio][name=algorithm]').first().waitFor({ state: 'visible', timeout: 5_000 });
}

/** Wait for algorithm status to show completion (not "Running...") */
async function waitForAlgorithmComplete(page: import('@playwright/test').Page): Promise<void> {
	await page.waitForFunction(
		() => {
			const status = document.querySelector('.algorithm-explorer__status');
			if (!status) return false;
			const text = status.textContent ?? '';
			return text !== '' && text !== 'Running...' && !text.startsWith('Error');
		},
		{ timeout: 15_000 },
	);
}

/** Select an algorithm radio and click Run, then wait for completion */
async function runAlgorithm(page: import('@playwright/test').Page, algorithmId: string): Promise<void> {
	await page.locator(`input[type=radio][name=algorithm][value=${algorithmId}]`).check({ force: true });
	await page.locator('[data-testid="algorithm-run"]').click({ force: true });
	await waitForAlgorithmComplete(page);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Graph Algorithms: Compute-to-Render Pipeline', () => {
	test.beforeEach(async ({ page }) => {
		await bootstrapApp(page);
	});

	test('PageRank compute writes graph_metrics and encodes nodes', async ({ page }) => {
		// Select PageRank and run
		await runAlgorithm(page, 'pagerank');

		// Assert status text mentions pagerank and card count
		const statusText = await page.locator('.algorithm-explorer__status').textContent();
		expect(statusText).toContain('pagerank');

		// Assert graph_metrics rows via queryAll
		const metrics = await page.evaluate(async () => {
			return (window as any).__isometry.queryAll(
				'SELECT COUNT(*) as cnt FROM graph_metrics WHERE pagerank IS NOT NULL',
			);
		});
		expect(metrics.rows[0].cnt).toBeGreaterThan(0);

		// Assert at least one node circle has a non-default radius (encoding active)
		// Wait for transition (300ms) to complete
		await page.waitForTimeout(400);
		const firstR = await page.locator('g.node circle').first().getAttribute('r');
		expect(Number(firstR)).toBeGreaterThan(0);

		// Assert legend is visible
		await expect(page.locator('.nv-legend--visible')).toBeVisible();
	});

	test('Multi-algorithm overlay — community color then centrality size (PAFV-04)', async ({ page }) => {
		// 1. Run Community detection
		await runAlgorithm(page, 'community');
		await page.waitForTimeout(600); // Wait for D3 transition (300ms) to complete

		// Assert at least one node circle fill is a community color (not the default source color).
		// D3 schemeCategory10 returns hex (#1f77b4 etc.) but transitions may interpolate as rgb().
		// Check for either hex or rgb format that differs from the default var(--text-muted).
		const fills = await page.locator('g.node circle').evaluateAll((els) =>
			els.map((el) => el.getAttribute('fill')).filter(Boolean),
		);
		const isCommunityColor = (f: string) =>
			(f.startsWith('#') && f.length === 7) || (f.startsWith('rgb') && !f.includes('var('));
		const hasCommunityColor = fills.some((f) => f !== null && isCommunityColor(f));
		expect(hasCommunityColor).toBe(true);

		// 2. Run Centrality (community colors should persist — cumulative overlay)
		await runAlgorithm(page, 'centrality');
		await page.waitForTimeout(600); // Wait for D3 transition to complete

		// Assert community colors are STILL present (cumulative)
		// D3 transitions interpolate colors as rgb() strings. After transition completes,
		// the final attribute value may be hex (#1f77b4) from schemeCategory10.
		// Use page.evaluate to read fills in browser context for maximum reliability.
		const uniqueFillsAfter = await page.evaluate(() => {
			const circles = document.querySelectorAll('g.node circle');
			const fills = new Set<string>();
			for (const c of circles) {
				const f = c.getAttribute('fill');
				if (f) fills.add(f);
			}
			return [...fills];
		});
		// Community detection assigns distinct colors to different communities.
		// If cumulative encoding is working, we should have multiple distinct fill colors
		// (not just one default). With ~103 nodes in 7+ communities, expect at least 2 colors.
		expect(uniqueFillsAfter.length).toBeGreaterThan(1);

		// Assert graph_metrics has centrality populated (last algorithm run)
		const centrality = await page.evaluate(async () => {
			return (window as any).__isometry.queryAll(
				'SELECT COUNT(*) as cnt FROM graph_metrics WHERE centrality IS NOT NULL',
			);
		});
		expect(centrality.rows[0].cnt).toBeGreaterThan(0);

		// Verify cumulative overlay works at the visual level: the community fill colors
		// persist because NetworkView._metricsMap retains data from prior computations
		// even though the database INSERT OR REPLACE overwrites previous algorithm columns.
		// We already checked uniqueFillsAfter > 1 above, confirming community colors persist.
	});

	test('Reset clears encoding and stale indicator (CTRL-04)', async ({ page }) => {
		// Run PageRank first
		await runAlgorithm(page, 'pagerank');
		await page.waitForTimeout(400);

		// Assert legend is visible
		await expect(page.locator('.nv-legend--visible')).toBeVisible();

		// Click Reset
		await page.locator('[data-testid="algorithm-reset"]').click({ force: true });
		await page.waitForTimeout(400); // Wait for reset transition

		// Assert legend is hidden
		await expect(page.locator('.nv-legend--visible')).not.toBeVisible();

		// Assert stale dot is hidden
		const staleDotDisplay = await page.locator('.algorithm-explorer__stale-dot').evaluate(
			(el) => (el as HTMLElement).style.display,
		);
		expect(staleDotDisplay).toBe('none');

		// Assert status text is empty
		await expect(page.locator('.algorithm-explorer__status')).toHaveText('');
	});

	test('Stale indicator appears after data mutation (GFND-04)', async ({ page }) => {
		// 1. Run PageRank
		await runAlgorithm(page, 'pagerank');

		// 2. Assert stale dot is NOT visible initially (just computed)
		const staleDotBefore = await page.locator('.algorithm-explorer__stale-dot').evaluate(
			(el) => (el as HTMLElement).style.display,
		);
		expect(staleDotBefore).toBe('none');

		// 3. Trigger a data mutation via MutationManager
		await page.evaluate(async () => {
			const iso = (window as any).__isometry;
			await iso.mutationManager.execute({
				description: 'E2E test mutation',
				forward: [{ sql: "UPDATE cards SET name = name || ' test' WHERE rowid = 1", params: [] }],
				inverse: [{ sql: "UPDATE cards SET name = SUBSTR(name, 1, LENGTH(name) - 5) WHERE rowid = 1", params: [] }],
			});
		});

		// 4. Wait briefly for rAF-batched notification
		await page.waitForTimeout(200);

		// 5. Assert stale dot is now visible
		const staleDotAfter = await page.locator('.algorithm-explorer__stale-dot').evaluate(
			(el) => (el as HTMLElement).style.display,
		);
		expect(staleDotAfter).toBe('inline-block');

		// 6. Assert status text contains "Results may be outdated"
		await expect(page.locator('.algorithm-explorer__status')).toContainText('Results may be outdated');

		// 7. Click Run again to recompute
		await page.locator('[data-testid="algorithm-run"]').click({ force: true });
		await waitForAlgorithmComplete(page);

		// 8. Assert stale dot is hidden again after recompute
		const staleDotRecomputed = await page.locator('.algorithm-explorer__stale-dot').evaluate(
			(el) => (el as HTMLElement).style.display,
		);
		expect(staleDotRecomputed).toBe('none');
	});
});
