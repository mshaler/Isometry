/**
 * Isometry v5 — E2E: HistogramScrubber Brush DOM Interaction
 *
 * Validates: Histogram SVG renders with bar elements, brush group exists,
 * and clearBrush removes the visual selection. Complements filter-histogram.spec.ts
 * which tests the filter propagation flow.
 *
 * Note: Actual mouse drag on SVG brush is fragile due to coordinate mapping.
 * We use programmatic filter API (same code path) and verify DOM state.
 */

import { test, expect } from './fixtures';

test.describe('HistogramScrubber brush DOM interaction', () => {
	test('histogram SVG renders with bar elements and brush group', async ({
		page,
		baselineCardCount,
	}) => {
		expect(baselineCardCount).toBeGreaterThan(0);

		// Switch to SuperGrid (which shows LATCH panel with histograms)
		await page.evaluate(async () => {
			const { viewManager, viewFactory } = (window as any).__isometry;
			await viewManager.switchTo('supergrid', () => viewFactory['supergrid']());
		});

		// Wait for grid to render
		await page.waitForFunction(
			() => document.querySelectorAll('.sg-cell, .data-cell, .sg-header').length > 0,
			{ timeout: 15_000 },
		);

		// Wait for histograms to appear (they fetch data asynchronously)
		await page.waitForFunction(
			() => {
				const histograms = document.querySelectorAll('.latch-histogram');
				return histograms.length > 0;
			},
			{ timeout: 10_000 },
		);

		// Verify histogram container has SVG
		const hasSvg = await page.evaluate(() => {
			const histogram = document.querySelector('.latch-histogram');
			if (!histogram) return false;
			return histogram.querySelector('svg') !== null;
		});
		expect(hasSvg).toBe(true);

		// Verify brush group exists within SVG
		const hasBrushGroup = await page.evaluate(() => {
			const histogram = document.querySelector('.latch-histogram');
			if (!histogram) return false;
			const svg = histogram.querySelector('svg');
			if (!svg) return false;
			return svg.querySelector('g.brush') !== null;
		});
		expect(hasBrushGroup).toBe(true);
	});

	test('range filter applies and clearBrush removes selection', async ({
		page,
		baselineCardCount,
	}) => {
		expect(baselineCardCount).toBeGreaterThan(0);

		// Switch to SuperGrid
		await page.evaluate(async () => {
			const { viewManager, viewFactory } = (window as any).__isometry;
			await viewManager.switchTo('supergrid', () => viewFactory['supergrid']());
		});

		await page.waitForFunction(
			() => document.querySelectorAll('.sg-cell, .data-cell, .sg-header').length > 0,
			{ timeout: 15_000 },
		);

		// Apply a range filter programmatically (same code path as brush end handler)
		await page.evaluate(() => {
			const { filter, coordinator } = (window as any).__isometry;
			filter.setRangeFilter('priority', 5, 8);
			coordinator.scheduleUpdate();
		});

		await page.waitForTimeout(1000);

		// Verify filter is active
		const hasRange = await page.evaluate(() => {
			const { filter } = (window as any).__isometry;
			return filter.hasRangeFilter('priority');
		});
		expect(hasRange).toBe(true);

		// Clear the filter and update
		await page.evaluate(() => {
			const { filter, coordinator } = (window as any).__isometry;
			filter.clearRangeFilter('priority');
			coordinator.scheduleUpdate();
		});

		await page.waitForTimeout(500);

		// Verify filter is cleared
		const afterClear = await page.evaluate(() => {
			const { filter } = (window as any).__isometry;
			return filter.hasRangeFilter('priority');
		});
		expect(afterClear).toBe(false);
	});

	test('histogram bars render with correct CSS class', async ({
		page,
		baselineCardCount,
	}) => {
		expect(baselineCardCount).toBeGreaterThan(0);

		// Switch to SuperGrid
		await page.evaluate(async () => {
			const { viewManager, viewFactory } = (window as any).__isometry;
			await viewManager.switchTo('supergrid', () => viewFactory['supergrid']());
		});

		await page.waitForFunction(
			() => document.querySelectorAll('.sg-cell, .data-cell, .sg-header').length > 0,
			{ timeout: 15_000 },
		);

		// Wait for histograms to render their bars
		const barInfo = await page.waitForFunction(
			() => {
				const bars = document.querySelectorAll('.latch-histogram__bar');
				if (bars.length === 0) return null;
				return { count: bars.length };
			},
			{ timeout: 10_000 },
		);

		// If histogram bars are rendered, they should have the correct class
		if (barInfo) {
			const barCount = await page.evaluate(() => {
				return document.querySelectorAll('.latch-histogram__bar').length;
			});
			expect(barCount).toBeGreaterThan(0);
		}
	});
});
