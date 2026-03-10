/**
 * Isometry v5 — E2E: Flow 4 — Card Selection Drives Notebook Binding
 *
 * Validates: Selecting a card loads its notebook content, switching cards
 * round-trips content through ui_state, and returning to the first card
 * restores previously typed content.
 *
 * Covers: SelectionProvider -> NotebookExplorer -> ui_state persistence
 * via bridge.send('ui:set'/'ui:get').
 */

import { test, expect } from './fixtures';

test.describe('Flow 4: Card selection drives notebook binding', () => {
	test('selecting a card loads notebook, switching cards round-trips content via ui_state', async ({
		page,
		baselineCardCount,
	}) => {
		expect(baselineCardCount).toBeGreaterThan(0);

		// ---------------------------------------------------------------
		// Step 1: Get two card IDs from database
		// ---------------------------------------------------------------
		const cardIds = await page.evaluate(async () => {
			const { bridge } = (window as any).__isometry;
			const r = await bridge.send('db:query', {
				sql: 'SELECT id FROM cards WHERE deleted_at IS NULL LIMIT 2',
				params: [],
			});
			return r.rows.map((row: any) => row.id);
		});
		expect(cardIds.length).toBeGreaterThanOrEqual(2);

		// ---------------------------------------------------------------
		// Step 2: Select card A -> notebook panel appears
		// ---------------------------------------------------------------
		await page.evaluate((id: string) => {
			const { selection } = (window as any).__isometry;
			selection.select(id);
		}, cardIds[0]);

		await page.waitForFunction(
			() => {
				const nb = document.querySelector('.notebook-explorer');
				return nb !== null;
			},
			{ timeout: 5_000 },
		);

		// ---------------------------------------------------------------
		// Step 3: Ensure Write tab is active and textarea is ready
		// ---------------------------------------------------------------
		await page.evaluate(() => {
			const tabs = document.querySelectorAll(
				'.notebook-segmented-control .notebook-tab',
			);
			if (
				tabs.length >= 2 &&
				!tabs[0]!.classList.contains('notebook-tab--active')
			) {
				(tabs[0] as HTMLElement).click();
			}
		});

		// Wait for textarea to be present and visible
		await page.waitForFunction(
			() => {
				const ta = document.querySelector('.notebook-textarea') as HTMLTextAreaElement;
				return ta !== null && ta.offsetParent !== null;
			},
			{ timeout: 3_000 },
		);

		// ---------------------------------------------------------------
		// Step 4: Type content for card A using Playwright focus + type
		// This ensures the browser fires a real input event.
		// ---------------------------------------------------------------
		const markerA = '# Notes on Card A — E2E test marker';
		const textareaLocator = page.locator('.notebook-textarea');
		await textareaLocator.focus();
		// Select all existing content (if any) and replace with our marker
		await page.keyboard.press('Meta+a');
		await page.keyboard.type(markerA, { delay: 0 });

		// Wait for debounced save to complete: 500ms debounce + worker round-trip
		await page.waitForTimeout(1500);

		// ---------------------------------------------------------------
		// Step 5: Verify content saved to ui_state
		// ---------------------------------------------------------------
		const savedA = await page.evaluate(async (id: string) => {
			const { bridge } = (window as any).__isometry;
			const r = await bridge.send('ui:get', { key: 'notebook:' + id });
			return r?.value ?? null;
		}, cardIds[0]);
		expect(savedA).not.toBeNull();
		expect(savedA).toContain('Card A');

		// ---------------------------------------------------------------
		// Step 6: Switch to card B
		// The selection change handler flushes card A and loads card B.
		// ---------------------------------------------------------------
		await page.evaluate((id: string) => {
			const { selection } = (window as any).__isometry;
			selection.select(id);
		}, cardIds[1]);

		// Wait for flush/load cycle
		await page.waitForTimeout(800);

		// ---------------------------------------------------------------
		// Step 7: Verify textarea changed (card B content, likely empty)
		// ---------------------------------------------------------------
		const cardBContent = await page.evaluate(() => {
			const ta = document.querySelector(
				'.notebook-textarea',
			) as HTMLTextAreaElement;
			return ta?.value ?? '';
		});
		expect(cardBContent).not.toContain('Card A');

		// ---------------------------------------------------------------
		// Step 8: Type content for card B
		// ---------------------------------------------------------------
		const markerB = '# Notes on Card B — E2E test marker';
		await textareaLocator.focus();
		await page.keyboard.press('Meta+a');
		await page.keyboard.type(markerB, { delay: 0 });

		// Wait for debounced save
		await page.waitForTimeout(1500);

		// Verify card B saved
		const savedB = await page.evaluate(async (id: string) => {
			const { bridge } = (window as any).__isometry;
			const r = await bridge.send('ui:get', { key: 'notebook:' + id });
			return r?.value ?? null;
		}, cardIds[1]);
		expect(savedB).toContain('Card B');

		// ---------------------------------------------------------------
		// Step 9: Switch back to card A -> content restored
		// ---------------------------------------------------------------
		await page.evaluate((id: string) => {
			const { selection } = (window as any).__isometry;
			selection.select(id);
		}, cardIds[0]);

		// Wait for the load cycle to complete and textarea to update
		await page.waitForFunction(
			() => {
				const ta = document.querySelector(
					'.notebook-textarea',
				) as HTMLTextAreaElement;
				return ta?.value?.includes('Card A');
			},
			{ timeout: 10_000 },
		);

		const restoredContentA = await page.evaluate(() => {
			const ta = document.querySelector(
				'.notebook-textarea',
			) as HTMLTextAreaElement;
			return ta?.value ?? '';
		});
		expect(restoredContentA).toContain('Card A');

		// ---------------------------------------------------------------
		// Step 10: Switch back to card B -> content restored
		// ---------------------------------------------------------------
		await page.evaluate((id: string) => {
			const { selection } = (window as any).__isometry;
			selection.select(id);
		}, cardIds[1]);

		await page.waitForFunction(
			() => {
				const ta = document.querySelector(
					'.notebook-textarea',
				) as HTMLTextAreaElement;
				return ta?.value?.includes('Card B');
			},
			{ timeout: 10_000 },
		);

		const restoredContentB = await page.evaluate(() => {
			const ta = document.querySelector(
				'.notebook-textarea',
			) as HTMLTextAreaElement;
			return ta?.value ?? '';
		});
		expect(restoredContentB).toContain('Card B');
	});
});
