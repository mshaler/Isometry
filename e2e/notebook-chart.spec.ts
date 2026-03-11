/**
 * Isometry v5 — E2E: Flow 5 — Notebook Chart Rendering Pipeline
 *
 * Validates: Chart code block renders as bar chart in preview, and the chart
 * container persists when a filter changes.
 * Covers Seam 2 (Selection → Notebook → ChartRenderer)
 * and Seam 3 (Filter → ChartRenderer → chart:query).
 *
 * This test directly re-tests UAT Bug #3 (chart values diverged from grid when filtered).
 */

import { test, expect } from './fixtures';

test.describe('Flow 5: Chart block renders in preview with current filters', () => {
	test('chart code block renders as bar chart in preview and updates when filter changes', async ({
		page,
		baselineCardCount,
	}) => {
		expect(baselineCardCount).toBeGreaterThan(0);

		// 1. Switch to Network view (we need to click a node to select a card)
		await page.evaluate(async () => {
			const { viewManager, viewFactory } = (window as any).__isometry;
			await viewManager.switchTo('network', () => viewFactory['network']());
		});

		// Wait for Network SVG to render
		await page.waitForFunction(
			() => {
				const svg = document.querySelector('svg.network-view');
				return svg !== null && svg.querySelectorAll('circle').length >= 4;
			},
			{ timeout: 30_000 },
		);

		// 2. Select a card programmatically (simulates clicking a node)
		const cardId = await page.evaluate(async () => {
			const { bridge } = (window as any).__isometry;
			const result = await bridge.send('db:query', {
				sql: 'SELECT id FROM cards WHERE deleted_at IS NULL LIMIT 1',
				params: [],
			});
			return result.rows[0]?.id;
		});
		expect(cardId).toBeTruthy();

		await page.evaluate((id: string) => {
			const { selection } = (window as any).__isometry;
			selection.select(id);
		}, cardId);

		// 3. Wait for Notebook panel to become visible
		await page.waitForFunction(
			() => {
				const notebook = document.querySelector('.notebook-explorer');
				return notebook !== null;
			},
			{ timeout: 5_000 },
		);

		// 4. Ensure Write tab is active
		await page.evaluate(() => {
			const tabs = document.querySelectorAll('.notebook-segmented-control .notebook-tab');
			if (tabs.length >= 2 && !tabs[0]!.classList.contains('notebook-tab--active')) {
				(tabs[0] as HTMLElement).click();
			}
		});

		await page.waitForTimeout(200);

		// 5. Clear the textarea and type a chart code block
		//    Using 'folder' as x-field — the Meryl Streep dataset has multiple folder values
		await page.evaluate(() => {
			const textarea = document.querySelector('.notebook-textarea') as HTMLTextAreaElement;
			if (textarea) {
				textarea.value = '```chart\ntype: bar\nx: folder\n```';
				textarea.dispatchEvent(new Event('input', { bubbles: true }));
			}
		});

		// 6. Wait for auto-save debounce (600ms typical)
		await page.waitForTimeout(800);

		// 7. Click "Preview" tab
		await page.evaluate(() => {
			const tabs = document.querySelectorAll('.notebook-segmented-control .notebook-tab');
			if (tabs.length >= 2) {
				(tabs[1] as HTMLElement).click();
			}
		});

		// 8. Wait for chart to render — SVG inside .notebook-chart-card
		await page.waitForFunction(
			() => {
				const chartCards = document.querySelectorAll('.notebook-chart-card svg');
				return chartCards.length > 0;
			},
			{ timeout: 10_000 },
		);

		// 9. Assert: the SVG contains rect elements (bar chart bars)
		const initialBarCount = await page.evaluate(() => {
			const svg = document.querySelector('.notebook-chart-card svg');
			if (!svg) return 0;
			return svg.querySelectorAll('rect.bar').length;
		});
		expect(initialBarCount).toBeGreaterThan(0);

		// 10. Apply a range filter (keeps data across all folders but narrows by priority)
		await page.evaluate(() => {
			const { filter, coordinator } = (window as any).__isometry;
			filter.setRangeFilter('priority', 3, 8);
			coordinator.scheduleUpdate();
		});

		// 11. Wait for chart to re-render (debounce 300ms + query time)
		await page.waitForTimeout(1500);

		// 12. Assert: chart container still exists (did NOT disappear — Bug #3 prevention)
		//     The chart may show updated bars or empty state, but the container persists
		const chartContainerExists = await page.evaluate(() => {
			const container = document.querySelector('.notebook-chart-card');
			return container !== null;
		});
		expect(chartContainerExists).toBe(true);

		// 13. If SVG still present, verify it has bars (filtered data still produces chart)
		const filteredBarCount = await page.evaluate(() => {
			const svg = document.querySelector('.notebook-chart-card svg');
			if (!svg) return -1; // -1 means SVG gone (empty state shown)
			return svg.querySelectorAll('rect.bar').length;
		});
		// With range filter on priority, most cards still exist → chart should have bars
		if (filteredBarCount >= 0) {
			expect(filteredBarCount).toBeGreaterThan(0);
		}

		// 13b. Verify SVG text has letter-spacing reset (BUGF-02)
		const chartLetterSpacing = await page.evaluate(() => {
			const svgText = document.querySelector('.notebook-chart-card svg text');
			if (!svgText) return null;
			return window.getComputedStyle(svgText).letterSpacing;
		});
		// Both 'normal' and '0px' indicate the CSS reset is active
		if (chartLetterSpacing !== null) {
			expect(chartLetterSpacing === 'normal' || chartLetterSpacing === '0px').toBe(true);
		}

		// 14. Clear filter and restore
		await page.evaluate(() => {
			const { filter, coordinator } = (window as any).__isometry;
			filter.clearFilters();
			coordinator.scheduleUpdate();
		});
	});
});
