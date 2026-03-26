// @vitest-environment jsdom
// Seam tests: migrateNotebookContent() — one-shot boot-time migration of
// legacy notebook:{cardId} entries from ui_state to cards.content.
// Phase 91 Plan 02 — EDIT-05
//
// Tests the 5 migration behaviors:
// 1. Migration runs when sentinel is absent — migrates content, sets sentinel, cleans up keys
// 2. Migration is skipped when sentinel already exists
// 3. Card with existing non-null non-empty content is NOT overwritten (cards.content wins)
// 4. After migration, notebook:{cardId} keys are deleted from ui_state
// 5. Empty-string notebook entries are NOT migrated

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { migrateNotebookContent } from '../../../src/ui/NotebookExplorer';

// ---------------------------------------------------------------------------
// Mock WorkerBridge factory
// ---------------------------------------------------------------------------

interface SendCall {
	type: string;
	payload: unknown;
}

function makeMockBridge(options: {
	sentinelValue: string | null;
	uiStateEntries: Array<{ key: string; value: string }>;
}) {
	const calls: SendCall[] = [];

	const bridge = {
		send: vi.fn(async (type: string, payload: unknown) => {
			calls.push({ type, payload });

			if (type === 'ui:get') {
				const { key } = payload as { key: string };
				if (key === 'notebook:migration:v1') {
					return { key, value: options.sentinelValue, updated_at: null };
				}
				return { key, value: null, updated_at: null };
			}

			if (type === 'ui:getAll') {
				return options.uiStateEntries;
			}

			if (type === 'db:exec') {
				return { changes: 1 };
			}

			if (type === 'ui:set') {
				return undefined;
			}

			return undefined;
		}),
		_calls: calls,
	};

	return bridge;
}

// ---------------------------------------------------------------------------
// Helper: collect all db:exec calls
// ---------------------------------------------------------------------------

function getDbExecCalls(bridge: ReturnType<typeof makeMockBridge>): Array<{ sql: string; params: unknown[] }> {
	return bridge._calls.filter((c) => c.type === 'db:exec').map((c) => c.payload as { sql: string; params: unknown[] });
}

function getUiSetCalls(bridge: ReturnType<typeof makeMockBridge>): Array<{ key: string; value: string }> {
	return bridge._calls.filter((c) => c.type === 'ui:set').map((c) => c.payload as { key: string; value: string });
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('migrateNotebookContent()', () => {
	describe('Test 1: Migration runs when sentinel is absent', () => {
		it('migrates notebook:{cardId} entries to cards.content and sets sentinel', async () => {
			const bridge = makeMockBridge({
				sentinelValue: null, // Not yet migrated
				uiStateEntries: [
					{ key: 'notebook:card-1', value: '# Hello' },
					{ key: 'notebook:card-2', value: 'World' },
				],
			});

			await migrateNotebookContent(bridge as never);

			// Should have called ui:get for sentinel
			const sentinelCheck = bridge._calls.find(
				(c) => c.type === 'ui:get' && (c.payload as { key: string }).key === 'notebook:migration:v1',
			);
			expect(sentinelCheck).toBeDefined();

			// Should have called ui:getAll to enumerate entries
			const getAllCall = bridge._calls.find((c) => c.type === 'ui:getAll');
			expect(getAllCall).toBeDefined();

			const execCalls = getDbExecCalls(bridge);

			// Verify UPDATE calls for each notebook entry
			const updateCalls = execCalls.filter((c) => c.sql.includes('UPDATE cards SET content'));
			expect(updateCalls).toHaveLength(2);

			// Verify SQL contains the cards.content-wins guard
			expect(updateCalls[0]!.sql).toContain("content IS NULL OR content = ''");
			expect(updateCalls[0]!.params).toEqual(['# Hello', 'card-1']);
			expect(updateCalls[1]!.params).toEqual(['World', 'card-2']);

			// Verify DELETE calls to clean up notebook:{cardId} keys
			const deleteCalls = execCalls.filter((c) => c.sql.includes('DELETE FROM ui_state'));
			expect(deleteCalls).toHaveLength(2);
			expect(deleteCalls[0]!.params).toContain('notebook:card-1');
			expect(deleteCalls[1]!.params).toContain('notebook:card-2');

			// Verify sentinel is set last
			const uiSetCalls = getUiSetCalls(bridge);
			expect(uiSetCalls).toHaveLength(1);
			expect(uiSetCalls[0]!.key).toBe('notebook:migration:v1');
			expect(uiSetCalls[0]!.value).toBe('done');

			// Sentinel must be the LAST send call
			const lastCall = bridge._calls[bridge._calls.length - 1]!;
			expect(lastCall.type).toBe('ui:set');
			expect((lastCall.payload as { key: string }).key).toBe('notebook:migration:v1');
		});
	});

	describe('Test 2: Migration is skipped when sentinel already exists', () => {
		it('does nothing when notebook:migration:v1 is already set', async () => {
			const bridge = makeMockBridge({
				sentinelValue: 'done', // Already migrated
				uiStateEntries: [{ key: 'notebook:card-1', value: '# Hello' }],
			});

			await migrateNotebookContent(bridge as never);

			// Only the sentinel check should have been made
			expect(bridge._calls).toHaveLength(1);
			expect(bridge._calls[0]!.type).toBe('ui:get');

			// No db:exec or ui:set calls
			expect(getDbExecCalls(bridge)).toHaveLength(0);
			expect(getUiSetCalls(bridge)).toHaveLength(0);
		});
	});

	describe('Test 3: Existing cards.content is not overwritten', () => {
		it('uses WHERE content IS NULL OR content = "" guard in UPDATE SQL', async () => {
			const bridge = makeMockBridge({
				sentinelValue: null,
				uiStateEntries: [{ key: 'notebook:card-existing', value: '# Legacy content' }],
			});

			await migrateNotebookContent(bridge as never);

			const execCalls = getDbExecCalls(bridge);
			const updateCall = execCalls.find((c) => c.sql.includes('UPDATE cards SET content'));
			expect(updateCall).toBeDefined();
			// SQL must guard against overwriting existing content
			expect(updateCall!.sql).toMatch(/content IS NULL OR content = ''/);
			// Card ID extracted correctly from key
			expect(updateCall!.params[1]).toBe('card-existing');
		});
	});

	describe('Test 4: Migrated keys are deleted from ui_state', () => {
		it('deletes each notebook:{cardId} key from ui_state after migration', async () => {
			const bridge = makeMockBridge({
				sentinelValue: null,
				uiStateEntries: [
					{ key: 'notebook:card-a', value: 'Content A' },
					{ key: 'notebook:card-b', value: 'Content B' },
					{ key: 'notebook:card-c', value: 'Content C' },
				],
			});

			await migrateNotebookContent(bridge as never);

			const execCalls = getDbExecCalls(bridge);
			const deleteCalls = execCalls.filter((c) => c.sql.includes('DELETE FROM ui_state'));
			expect(deleteCalls).toHaveLength(3);

			const deletedKeys = deleteCalls.map((c) => c.params[0]);
			expect(deletedKeys).toContain('notebook:card-a');
			expect(deletedKeys).toContain('notebook:card-b');
			expect(deletedKeys).toContain('notebook:card-c');
		});
	});

	describe('Test 5: Empty-string entries are NOT migrated', () => {
		it('skips notebook entries with empty or whitespace-only values', async () => {
			const bridge = makeMockBridge({
				sentinelValue: null,
				uiStateEntries: [
					{ key: 'notebook:card-empty', value: '' },
					{ key: 'notebook:card-whitespace', value: '   ' },
					{ key: 'notebook:card-real', value: '# Real content' },
				],
			});

			await migrateNotebookContent(bridge as never);

			const execCalls = getDbExecCalls(bridge);
			const updateCalls = execCalls.filter((c) => c.sql.includes('UPDATE cards SET content'));
			// Only the non-empty entry should be migrated
			expect(updateCalls).toHaveLength(1);
			expect(updateCalls[0]!.params[1]).toBe('card-real');

			// Only the non-empty entry's key should be deleted
			const deleteCalls = execCalls.filter((c) => c.sql.includes('DELETE FROM ui_state'));
			expect(deleteCalls).toHaveLength(1);
			expect(deleteCalls[0]!.params[0]).toBe('notebook:card-real');
		});
	});
});
