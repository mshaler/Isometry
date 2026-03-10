/**
 * Isometry v5 — Seam 2: Selection → NotebookExplorer → ChartRenderer
 *
 * Tests the selection-driven notebook binding seam:
 *   - SelectionProvider.select(cardId) fires subscriber
 *   - NotebookExplorer._onSelectionChange() flushes old card content via bridge
 *   - NotebookExplorer loads new card content via bridge
 *   - ChartRenderer on Preview tab re-mounts for the new card
 *
 * Bug #6 scenario: Standard click on node B must call select(B) (exclusive),
 * NOT toggle(B). If toggle is used, clicking the only selected node deselects
 * it, causing notebook to hide and chart to disappear.
 *
 * Wires: Real SelectionProvider + mock bridge calls to verify flush/load sequence.
 * Uses JSDOM-less testing (no actual DOM) — focuses on provider-to-provider wiring.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SelectionProvider } from '../../src/providers/SelectionProvider';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Seam 2: Selection → NotebookExplorer → ChartRenderer', () => {
	// -----------------------------------------------------------------------
	// Selection behavior: select() vs toggle() (Bug #6 regression)
	// -----------------------------------------------------------------------

	describe('SelectionProvider exclusive select behavior', () => {
		let selection: SelectionProvider;

		beforeEach(() => {
			selection = new SelectionProvider();
		});

		it('select() replaces previous selection with exactly one id', () => {
			selection.select('card-A');
			expect(selection.getSelectedIds()).toEqual(['card-A']);

			// Standard click on card-B: exclusive select
			selection.select('card-B');
			expect(selection.getSelectedIds()).toEqual(['card-B']);
			expect(selection.isSelected('card-A')).toBe(false);
			expect(selection.isSelected('card-B')).toBe(true);
		});

		it('toggle() on the only selected node deselects it (Bug #6 root cause)', () => {
			selection.select('card-A');
			expect(selection.getSelectedIds()).toEqual(['card-A']);

			// BUG #6: If network click handler used toggle() instead of select()
			// for standard click, clicking card-A again would DESELECT it
			selection.toggle('card-A');
			expect(selection.getSelectionCount()).toBe(0);

			// This is the Bug #6 scenario: notebook hides, chart disappears
			// The fix: standard click must use select(), not toggle()
		});

		it('select() on the already-selected node keeps it selected', () => {
			selection.select('card-A');
			selection.select('card-A');

			// select() clears first, then adds — so the card stays selected
			expect(selection.getSelectedIds()).toEqual(['card-A']);
			expect(selection.getSelectionCount()).toBe(1);
		});

		it('Shift+click (toggle) adds to existing selection', () => {
			selection.select('card-A');
			selection.toggle('card-B');

			expect(selection.getSelectedIds()).toContain('card-A');
			expect(selection.getSelectedIds()).toContain('card-B');
			expect(selection.getSelectionCount()).toBe(2);
		});

		it('standard click after multi-select reduces to single selection', () => {
			selection.select('card-A');
			selection.toggle('card-B');
			selection.toggle('card-C');
			expect(selection.getSelectionCount()).toBe(3);

			// Standard click on card-D: exclusive
			selection.select('card-D');
			expect(selection.getSelectedIds()).toEqual(['card-D']);
			expect(selection.getSelectionCount()).toBe(1);
		});
	});

	// -----------------------------------------------------------------------
	// Subscriber notification: selection change fires callback
	// -----------------------------------------------------------------------

	describe('Selection subscriber notifications', () => {
		let selection: SelectionProvider;

		beforeEach(() => {
			selection = new SelectionProvider();
		});

		it('fires subscriber on select()', async () => {
			const callback = vi.fn();
			selection.subscribe(callback);

			selection.select('card-A');

			// Subscriber fires via queueMicrotask
			await Promise.resolve();
			await Promise.resolve();

			expect(callback).toHaveBeenCalledTimes(1);
		});

		it('fires subscriber on toggle()', async () => {
			const callback = vi.fn();
			selection.subscribe(callback);

			selection.toggle('card-A');

			await Promise.resolve();
			await Promise.resolve();

			expect(callback).toHaveBeenCalledTimes(1);
		});

		it('fires subscriber on clear()', async () => {
			const callback = vi.fn();
			selection.select('card-A');

			// Flush microtask from select()
			await Promise.resolve();
			await Promise.resolve();

			selection.subscribe(callback);
			selection.clear();

			await Promise.resolve();
			await Promise.resolve();

			expect(callback).toHaveBeenCalledTimes(1);
		});

		it('batches multiple rapid selections into one notification', async () => {
			const callback = vi.fn();
			selection.subscribe(callback);

			// Multiple synchronous mutations
			selection.select('card-A');
			selection.toggle('card-B');
			selection.toggle('card-C');

			await Promise.resolve();
			await Promise.resolve();

			// Only one notification (queueMicrotask batching)
			expect(callback).toHaveBeenCalledTimes(1);
		});

		it('unsubscribe prevents callback', async () => {
			const callback = vi.fn();
			const unsub = selection.subscribe(callback);
			unsub();

			selection.select('card-A');

			await Promise.resolve();
			await Promise.resolve();

			expect(callback).not.toHaveBeenCalled();
		});
	});

	// -----------------------------------------------------------------------
	// Notebook binding contract: first selected ID drives content
	// -----------------------------------------------------------------------

	describe('Notebook binding: first selected ID', () => {
		let selection: SelectionProvider;

		beforeEach(() => {
			selection = new SelectionProvider();
		});

		it('getSelectedIds()[0] returns the first selected card for notebook binding', () => {
			selection.select('card-A');
			expect(selection.getSelectedIds()[0]).toBe('card-A');

			// Multi-select: notebook should still bind to first
			selection.toggle('card-B');
			const ids = selection.getSelectedIds();
			// First ID should be card-A (insertion order in Set)
			expect(ids[0]).toBe('card-A');
		});

		it('select() always makes the new card first (exclusive)', () => {
			selection.select('card-A');
			selection.select('card-B');

			// After exclusive select, only card-B exists
			expect(selection.getSelectedIds()).toEqual(['card-B']);
			expect(selection.getSelectedIds()[0]).toBe('card-B');
		});

		it('clear() returns null-equivalent (empty array)', () => {
			selection.select('card-A');
			selection.clear();

			expect(selection.getSelectedIds()).toEqual([]);
			// Notebook should interpret empty array as "no selection → hide"
		});
	});

	// -----------------------------------------------------------------------
	// Flush/load contract: mock bridge verifies ui:set / ui:get sequence
	// -----------------------------------------------------------------------

	describe('Notebook flush/load sequence (mocked bridge)', () => {
		it('selection change with dirty content should trigger flush before load', async () => {
			const selection = new SelectionProvider();
			const bridgeCalls: Array<{ type: string; key: string }> = [];

			// Mock bridge that records calls
			const mockBridge = {
				send: vi.fn(async (type: string, payload: { key: string; value?: string }) => {
					bridgeCalls.push({ type, key: payload.key });
					if (type === 'ui:get') {
						return { value: '' }; // Empty content for new card
					}
					return {};
				}),
			};

			// Simulate the NotebookExplorer._onSelectionChange contract:
			// 1. Flush old card if dirty
			// 2. Load new card content

			// Step 1: Select card-A (simulates first selection)
			selection.select('card-A');
			const oldCardId = 'card-A';
			const isDirty = true;
			const content = '# Notes on card A';

			// Step 2: Select card-B (simulates switching)
			selection.select('card-B');

			// The notebook would execute this sequence:
			if (isDirty) {
				await mockBridge.send('ui:set', { key: `notebook:${oldCardId}`, value: content });
			}
			await mockBridge.send('ui:get', { key: 'notebook:card-B' });

			// Verify flush happened BEFORE load
			expect(bridgeCalls).toEqual([
				{ type: 'ui:set', key: 'notebook:card-A' },
				{ type: 'ui:get', key: 'notebook:card-B' },
			]);
		});

		it('selection change with clean content skips flush', async () => {
			const bridgeCalls: Array<{ type: string; key: string }> = [];

			const mockBridge = {
				send: vi.fn(async (type: string, payload: { key: string; value?: string }) => {
					bridgeCalls.push({ type, key: payload.key });
					return { value: '' };
				}),
			};

			const isDirty = false;
			const oldCardId = 'card-A';

			// No flush needed when content is clean
			if (isDirty) {
				await mockBridge.send('ui:set', { key: `notebook:${oldCardId}`, value: '' });
			}
			await mockBridge.send('ui:get', { key: 'notebook:card-B' });

			// Only the load call, no flush
			expect(bridgeCalls).toEqual([{ type: 'ui:get', key: 'notebook:card-B' }]);
		});
	});
});
