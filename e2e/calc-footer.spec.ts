/**
 * Isometry v5 — E2E: Flow 8 — Calc Aggregation Mode Updates Footer
 *
 * Validates: Changing CalcExplorer aggregation mode (SUM → AVG → OFF) updates
 * SuperGrid footer values. Covers Seam 1 (Filter → Calc → Footer) with a
 * different trigger than filter changes.
 *
 * CalcExplorer renders native <select class="calc-select"> elements.
 * There is no setConfig() API — we manipulate the selects and dispatch 'change'.
 */

import { test, expect } from './fixtures';

test.describe('Flow 8: Calc aggregation mode change updates footer', () => {
	test('changing CalcExplorer from SUM to AVG updates SuperGrid footer values', async ({
		page,
		baselineCardCount,
	}) => {
		expect(baselineCardCount).toBeGreaterThan(0);

		// 1. Switch to SuperGrid
		await page.evaluate(async () => {
			const { viewManager, viewFactory } = (window as any).__isometry;
			await viewManager.switchTo('supergrid', () => viewFactory['supergrid']());
		});

		// Wait for grid headers or cells
		await page.waitForFunction(
			() => {
				const cells = document.querySelectorAll('.sg-cell, .data-cell');
				const headers = document.querySelectorAll('.sg-header, .col-header');
				return cells.length > 0 || headers.length > 0;
			},
			{ timeout: 15_000 },
		);

		// 2. Set priority as the COLUMN axis — footer aggregates the column axis field.
		//    Using priority (numeric) as col axis means SUM/AVG produce different footer values.
		//    CalcExplorer only shows dropdowns for axis-assigned fields.
		await page.evaluate(() => {
			const { pafv, coordinator } = (window as any).__isometry;
			pafv.setColAxes([{ field: 'priority', direction: 'asc' }]);
			pafv.setRowAxes([{ field: 'card_type', direction: 'asc' }]);
			coordinator.scheduleUpdate();
		});

		// Wait for CalcExplorer to re-render with Priority dropdown
		await page.waitForFunction(
			() => document.querySelector('select[aria-label="Aggregate for Priority"]') !== null,
			{ timeout: 10_000 },
		);

		// 3. Set Priority dropdown to SUM via native <select> element.
		//    The change event triggers _onConfigChange → SuperGrid re-renders footer.
		const hasPrioritySelect = await page.evaluate(() => {
			const select = document.querySelector('select[aria-label="Aggregate for Priority"]') as HTMLSelectElement;
			if (select) {
				select.value = 'sum';
				select.dispatchEvent(new Event('change', { bubbles: true }));
				return true;
			}
			return false;
		});
		expect(hasPrioritySelect).toBe(true);

		// Wait for footer to appear with SUM values (poll until at least one has a digit)
		await page.waitForFunction(
			() => {
				const cells = document.querySelectorAll('.sg-footer.sg-cell');
				return Array.from(cells).some((c) => /\d/.test(c.textContent ?? ''));
			},
			{ timeout: 10_000 },
		);

		// 4. Capture footer values with SUM mode
		const sumFooterValues = await page.evaluate(() => {
			const footerCells = document.querySelectorAll('.sg-footer.sg-cell');
			return Array.from(footerCells).map((c) => c.textContent?.trim() ?? '');
		});
		expect(sumFooterValues.length).toBeGreaterThan(0);

		// At least one cell should have a numeric value
		const sumHasNumeric = sumFooterValues.some((v) => /\d/.test(v));
		expect(sumHasNumeric).toBe(true);

		// 5. Change to AVG mode
		await page.evaluate(() => {
			const select = document.querySelector('select[aria-label="Aggregate for Priority"]') as HTMLSelectElement;
			if (select) {
				select.value = 'avg';
				select.dispatchEvent(new Event('change', { bubbles: true }));
			}
		});

		// Poll until footer content changes from SUM state
		const sumSnapshot = sumFooterValues.join('|');
		await page.waitForFunction(
			(snap) => {
				const cells = document.querySelectorAll('.sg-footer.sg-cell');
				const current = Array.from(cells)
					.map((c) => c.textContent?.trim() ?? '')
					.join('|');
				return current !== snap;
			},
			sumSnapshot,
			{ timeout: 10_000 },
		);

		// 6. Capture footer values with AVG mode
		const avgFooterValues = await page.evaluate(() => {
			const footerCells = document.querySelectorAll('.sg-footer.sg-cell');
			return Array.from(footerCells).map((c) => c.textContent?.trim() ?? '');
		});

		// 7. Assert: at least one footer value changed between SUM and AVG
		const footerChanged = sumFooterValues.some((val, i) => val !== avgFooterValues[i]);
		expect(footerChanged).toBe(true);

		// 8. Change to OFF mode
		await page.evaluate(() => {
			const select = document.querySelector('select[aria-label="Aggregate for Priority"]') as HTMLSelectElement;
			if (select) {
				select.value = 'off';
				select.dispatchEvent(new Event('change', { bubbles: true }));
			}
		});

		// Poll until footer changes from AVG state
		const avgSnapshot = avgFooterValues.join('|');
		await page.waitForFunction(
			(snap) => {
				const cells = document.querySelectorAll('.sg-footer.sg-cell');
				const current = Array.from(cells)
					.map((c) => c.textContent?.trim() ?? '')
					.join('|');
				return current !== snap;
			},
			avgSnapshot,
			{ timeout: 10_000 },
		);

		// 9. Capture footer values with OFF mode
		const offFooterValues = await page.evaluate(() => {
			const footerCells = document.querySelectorAll('.sg-footer.sg-cell');
			return Array.from(footerCells).map((c) => c.textContent?.trim() ?? '');
		});

		// 10. Assert: footer has changed from AVG state (OFF shows "—" dashes)
		const offChanged = avgFooterValues.some((val, i) => val !== offFooterValues[i]);
		expect(offChanged).toBe(true);
	});

	test('COUNT aggregation shows integer values for all field types', async ({
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
			() => document.querySelectorAll('.sg-cell, .sg-header').length > 0,
			{ timeout: 15_000 },
		);

		// Set axes that include both text and numeric fields for testing
		await page.evaluate(() => {
			const { pafv, coordinator } = (window as any).__isometry;
			pafv.setColAxes([{ field: 'card_type', direction: 'asc' }]);
			pafv.setRowAxes([{ field: 'folder', direction: 'asc' }]);
			coordinator.scheduleUpdate();
		});

		// Wait for CalcExplorer to re-render with Type dropdown
		await page.waitForFunction(
			() => document.querySelector('select[aria-label="Aggregate for Type"]') !== null,
			{ timeout: 10_000 },
		);

		// Set Type dropdown to COUNT (text fields have COUNT/OFF options).
		await page.evaluate(() => {
			const select = document.querySelector('select[aria-label="Aggregate for Type"]') as HTMLSelectElement;
			if (select) {
				select.value = 'count';
				select.dispatchEvent(new Event('change', { bubbles: true }));
			}
		});

		// Wait for footer to show numeric COUNT values
		await page.waitForFunction(
			() => {
				const cells = document.querySelectorAll('.sg-footer.sg-cell');
				return Array.from(cells).some((c) => /\d/.test(c.textContent ?? ''));
			},
			{ timeout: 10_000 },
		);

		// Verify footer has cells with numeric values
		const footerCells = await page.evaluate(() => {
			const cells = document.querySelectorAll('.sg-footer.sg-cell');
			return Array.from(cells).map((c) => c.textContent?.trim() ?? '');
		});
		expect(footerCells.length).toBeGreaterThan(0);

		// COUNT values should be integers (no decimal points in the numeric part)
		const countValues = footerCells.filter((v) => /\d/.test(v));
		expect(countValues.length).toBeGreaterThan(0);

		for (const val of countValues) {
			// Extract just the numeric part (after label prefix like "COUNT: ")
			const numericPart = val.replace(/[^0-9.]/g, '');
			if (numericPart) {
				expect(numericPart).not.toContain('.');
			}
		}
	});
});
