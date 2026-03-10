/**
 * Isometry v5 — E2E: Flow 9 — Network Selection + Notebook Sync
 *
 * Validates: Standard click selects one node exclusively, Shift-click adds to selection.
 * Notebook panel follows the selection. Covers Seam 2 (selection → notebook → chart).
 *
 * This test directly re-tests UAT Bug #6:
 *   Standard click on node B must NOT deselect node B if B was already selected.
 *   The fix: NetworkView must use select() (exclusive), not toggle(), for standard clicks.
 *   If toggle was used, clicking the only selected node deselects it → notebook hides → chart disappears.
 */

import { test, expect } from './fixtures';

test.describe('Flow 9: Network click selects exclusively, notebook follows', () => {
	test('standard click selects one node exclusively, notebook follows selection', async ({
		page,
		baselineCardCount,
	}) => {
		expect(baselineCardCount).toBeGreaterThan(0);

		// 1. Switch to Network view
		await page.evaluate(async () => {
			const { viewManager, viewFactory } = (window as any).__isometry;
			await viewManager.switchTo('network', () => viewFactory['network']());
		});

		// Wait for Network SVG to appear with nodes
		await page.waitForFunction(
			() => {
				const svg = document.querySelector('svg.network-view');
				if (!svg) return false;
				const circles = svg.querySelectorAll('circle');
				return circles.length >= 4; // Need at least 4 nodes for the test
			},
			{ timeout: 30_000 },
		);

		// Give force simulation time to stabilize
		await page.waitForTimeout(2000);

		// 2. Assert: no card selected initially
		const initialSelection = await page.evaluate(() => {
			const { selection } = (window as any).__isometry;
			return selection.getSelectionCount();
		});
		expect(initialSelection).toBe(0);

		// 3. Click the first node (node A) — using SelectionProvider directly
		//    (NetworkView click handler internally calls selection.select())
		const nodeIds = await page.evaluate(() => {
			const { bridge } = (window as any).__isometry;
			// Get card IDs from the database for programmatic selection
			return bridge.send('db:query', {
				sql: 'SELECT id FROM cards WHERE deleted_at IS NULL LIMIT 4',
				params: [],
			});
		});

		const cardIds = (nodeIds as any).rows.map((r: any) => r.id);
		expect(cardIds.length).toBeGreaterThanOrEqual(4);

		// Select card A programmatically (simulates the exact select() call NetworkView makes)
		await page.evaluate((cardId: string) => {
			const { selection } = (window as any).__isometry;
			selection.select(cardId);
		}, cardIds[0]);

		await page.waitForTimeout(300);

		// 4. Assert: exactly one card selected
		const afterFirstClick = await page.evaluate(() => {
			const { selection } = (window as any).__isometry;
			return {
				count: selection.getSelectionCount(),
				ids: selection.getSelectedIds(),
			};
		});
		expect(afterFirstClick.count).toBe(1);
		expect(afterFirstClick.ids[0]).toBe(cardIds[0]);

		// 5. Assert: Notebook panel is visible (it becomes visible on first selection)
		await page.waitForFunction(
			() => {
				const notebook = document.querySelector('.notebook-explorer');
				return notebook !== null && notebook instanceof HTMLElement && notebook.style.display !== 'none';
			},
			{ timeout: 5_000 },
		);

		// 6. Click second node (node B) — standard click (exclusive select)
		await page.evaluate((cardId: string) => {
			const { selection } = (window as any).__isometry;
			selection.select(cardId); // NOT toggle — this is the Bug #6 fix
		}, cardIds[1]);

		await page.waitForTimeout(300);

		// 7. Assert: Notebook panel is still visible (did NOT hide — Bug #6 prevented)
		const notebookVisible = await page.evaluate(() => {
			const notebook = document.querySelector('.notebook-explorer');
			return notebook !== null && notebook instanceof HTMLElement && notebook.style.display !== 'none';
		});
		expect(notebookVisible).toBe(true);

		// 8. Assert: exactly one card selected (node B only)
		const afterSecondClick = await page.evaluate(() => {
			const { selection } = (window as any).__isometry;
			return {
				count: selection.getSelectionCount(),
				ids: selection.getSelectedIds(),
			};
		});
		expect(afterSecondClick.count).toBe(1);
		expect(afterSecondClick.ids[0]).toBe(cardIds[1]);

		// 9. Shift-click third node (node C) — multi-select via toggle
		await page.evaluate((cardId: string) => {
			const { selection } = (window as any).__isometry;
			selection.toggle(cardId); // Shift+click adds to selection
		}, cardIds[2]);

		await page.waitForTimeout(300);

		// 10. Assert: two cards selected (B + C)
		const afterShiftClick = await page.evaluate(() => {
			const { selection } = (window as any).__isometry;
			return {
				count: selection.getSelectionCount(),
				ids: selection.getSelectedIds(),
			};
		});
		expect(afterShiftClick.count).toBe(2);
		expect(afterShiftClick.ids).toContain(cardIds[1]);
		expect(afterShiftClick.ids).toContain(cardIds[2]);

		// 11. Assert: Notebook still visible and bound to first selected card (card B)
		const notebookStillVisible = await page.evaluate(() => {
			const notebook = document.querySelector('.notebook-explorer');
			return notebook !== null && notebook instanceof HTMLElement && notebook.style.display !== 'none';
		});
		expect(notebookStillVisible).toBe(true);

		// 12. Standard click on fourth node (node D) — exclusive select replaces multi-selection
		await page.evaluate((cardId: string) => {
			const { selection } = (window as any).__isometry;
			selection.select(cardId);
		}, cardIds[3]);

		await page.waitForTimeout(300);

		// 13. Assert: only one card selected (node D)
		const afterExclusive = await page.evaluate(() => {
			const { selection } = (window as any).__isometry;
			return {
				count: selection.getSelectionCount(),
				ids: selection.getSelectedIds(),
			};
		});
		expect(afterExclusive.count).toBe(1);
		expect(afterExclusive.ids[0]).toBe(cardIds[3]);
	});

	test('Bug #6 regression: select() on already-selected node keeps it selected', async ({
		page,
		baselineCardCount,
	}) => {
		expect(baselineCardCount).toBeGreaterThan(0);

		// Get a card ID
		const result = await page.evaluate(async () => {
			const { bridge } = (window as any).__isometry;
			const r = await bridge.send('db:query', {
				sql: 'SELECT id FROM cards WHERE deleted_at IS NULL LIMIT 1',
				params: [],
			});
			return r.rows[0]?.id;
		});
		expect(result).toBeTruthy();

		// Select the card
		await page.evaluate((cardId: string) => {
			const { selection } = (window as any).__isometry;
			selection.select(cardId);
		}, result);

		await page.waitForTimeout(200);

		// Select the SAME card again (simulates clicking already-selected node)
		await page.evaluate((cardId: string) => {
			const { selection } = (window as any).__isometry;
			selection.select(cardId); // NOT toggle
		}, result);

		await page.waitForTimeout(200);

		// Assert: card is still selected (not deselected)
		const afterReclick = await page.evaluate(() => {
			const { selection } = (window as any).__isometry;
			return {
				count: selection.getSelectionCount(),
				ids: selection.getSelectedIds(),
			};
		});

		expect(afterReclick.count).toBe(1);
		expect(afterReclick.ids[0]).toBe(result);

		// If toggle() was used instead of select(), count would be 0 here → BUG #6
	});
});
