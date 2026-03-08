// Isometry v5 -- Phase 52 SampleDataManager Unit Tests
// TDD RED: Write tests first, then implement to make them pass.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { WorkerBridgeLike } from '../../src/views/types';
import type { SampleDataset } from '../../src/sample/types';
import { SampleDataManager } from '../../src/sample/SampleDataManager';

// ---------------------------------------------------------------------------
// Test Fixtures
// ---------------------------------------------------------------------------

function makeMockBridge(): WorkerBridgeLike & { calls: Array<{ type: string; payload: unknown }> } {
	const calls: Array<{ type: string; payload: unknown }> = [];
	return {
		calls,
		send: vi.fn(async (type: string, payload: unknown) => {
			calls.push({ type, payload });
			// Default responses by type
			if (type === 'db:exec') return { changes: 1 };
			if (type === 'db:query') return { columns: ['count'], rows: [{ count: 0 }] };
			return undefined;
		}),
	};
}

function makeTestDataset(id = 'test-dataset'): SampleDataset {
	return {
		id,
		name: 'Test Dataset',
		defaultView: 'list',
		cards: [
			{
				id: 'sample-test-001',
				card_type: 'note',
				name: 'Test Card 1',
				content: 'Test content 1',
				summary: null,
				latitude: 37.33,
				longitude: -122.01,
				location_name: 'Cupertino, CA',
				created_at: '2024-01-01T00:00:00Z',
				modified_at: '2024-01-01T00:00:00Z',
				due_at: null,
				completed_at: null,
				event_start: '2024-01-01T00:00:00Z',
				event_end: null,
				folder: 'Test',
				tags: ['tag1', 'tag2'],
				status: 'active',
				priority: 5,
				sort_order: 0,
				url: null,
				mime_type: null,
				is_collective: false,
				source: 'sample',
				source_id: 'test-dataset:card-1',
				source_url: null,
				deleted_at: null,
			},
			{
				id: 'sample-test-002',
				card_type: 'event',
				name: 'Test Card 2',
				content: null,
				summary: 'A summary',
				latitude: null,
				longitude: null,
				location_name: null,
				created_at: '2024-06-15T00:00:00Z',
				modified_at: '2024-06-15T00:00:00Z',
				due_at: '2024-07-01T00:00:00Z',
				completed_at: null,
				event_start: '2024-06-15T00:00:00Z',
				event_end: '2024-06-16T00:00:00Z',
				folder: 'Events',
				tags: [],
				status: null,
				priority: 3,
				sort_order: 1,
				url: 'https://example.com',
				mime_type: null,
				is_collective: true,
				source: 'sample',
				source_id: 'test-dataset:card-2',
				source_url: null,
				deleted_at: null,
			},
		],
		connections: [
			{
				id: 'sample-conn-test-001',
				source_id: 'sample-test-001',
				target_id: 'sample-test-002',
				via_card_id: null,
				label: 'related_to',
				weight: 0.5,
				created_at: '2024-01-01T00:00:00Z',
			},
		],
	};
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SampleDataManager', () => {
	let bridge: ReturnType<typeof makeMockBridge>;
	let dataset: SampleDataset;
	let manager: SampleDataManager;

	beforeEach(() => {
		bridge = makeMockBridge();
		dataset = makeTestDataset();
		manager = new SampleDataManager(bridge, [dataset]);
	});

	// -----------------------------------------------------------------------
	// getDatasets / getDefaultDataset
	// -----------------------------------------------------------------------

	describe('getDatasets()', () => {
		it('returns the injected datasets', () => {
			const result = manager.getDatasets();
			expect(result).toHaveLength(1);
			expect(result[0].id).toBe('test-dataset');
		});
	});

	describe('getDefaultDataset()', () => {
		it('returns a dataset (not undefined)', () => {
			const result = manager.getDefaultDataset();
			expect(result).toBeDefined();
			expect(result.id).toBe('test-dataset');
		});

		it('rotates across multiple datasets based on day-of-year', () => {
			const ds2 = makeTestDataset('test-dataset-2');
			const ds3 = makeTestDataset('test-dataset-3');
			const multiManager = new SampleDataManager(bridge, [dataset, ds2, ds3]);
			const result = multiManager.getDefaultDataset();
			// Should always return one of the three
			expect(['test-dataset', 'test-dataset-2', 'test-dataset-3']).toContain(result.id);
		});
	});

	// -----------------------------------------------------------------------
	// load()
	// -----------------------------------------------------------------------

	describe('load()', () => {
		it('throws on unknown dataset ID', async () => {
			await expect(manager.load('nonexistent')).rejects.toThrow('Unknown dataset: nonexistent');
		});

		it('calls clear() before inserting (first call is DELETE)', async () => {
			await manager.load('test-dataset');
			// First call should be the clear (DELETE)
			expect(bridge.calls[0].type).toBe('db:exec');
			const firstPayload = bridge.calls[0].payload as { sql: string };
			expect(firstPayload.sql).toContain("DELETE FROM cards WHERE source = 'sample'");
		});

		it('inserts all cards via db:exec', async () => {
			await manager.load('test-dataset');
			// After the clear call, there should be card INSERT calls
			const cardInserts = bridge.calls.filter(
				(c) => c.type === 'db:exec' && (c.payload as { sql: string }).sql.includes('INSERT OR REPLACE INTO cards'),
			);
			expect(cardInserts).toHaveLength(2); // 2 cards in test dataset
		});

		it('inserts connections via db:exec with INSERT OR IGNORE', async () => {
			await manager.load('test-dataset');
			const connInserts = bridge.calls.filter(
				(c) =>
					c.type === 'db:exec' && (c.payload as { sql: string }).sql.includes('INSERT OR IGNORE INTO connections'),
			);
			expect(connInserts).toHaveLength(1); // 1 connection in test dataset
		});

		it('uses INSERT OR REPLACE for cards (idempotent)', async () => {
			await manager.load('test-dataset');
			const cardInserts = bridge.calls.filter(
				(c) => c.type === 'db:exec' && (c.payload as { sql: string }).sql.includes('INSERT OR REPLACE INTO cards'),
			);
			expect(cardInserts.length).toBeGreaterThan(0);
			for (const insert of cardInserts) {
				expect((insert.payload as { sql: string }).sql).toContain('INSERT OR REPLACE');
			}
		});

		it('JSON.stringifies tags array in INSERT params', async () => {
			await manager.load('test-dataset');
			// Find the first card INSERT (after the DELETE call)
			const firstCardInsert = bridge.calls.find(
				(c) => c.type === 'db:exec' && (c.payload as { sql: string }).sql.includes('INSERT OR REPLACE INTO cards'),
			);
			expect(firstCardInsert).toBeDefined();
			const params = (firstCardInsert!.payload as { params: unknown[] }).params;
			// tags should be JSON stringified -- find the element that matches
			const tagsParam = params.find((p) => typeof p === 'string' && p.startsWith('['));
			expect(tagsParam).toBe('["tag1","tag2"]');
		});

		it('converts is_collective boolean to 0/1 integer', async () => {
			await manager.load('test-dataset');
			// First card: is_collective = false -> 0
			const firstCardInsert = bridge.calls.find(
				(c) => c.type === 'db:exec' && (c.payload as { sql: string }).sql.includes('INSERT OR REPLACE INTO cards'),
			);
			const params1 = (firstCardInsert!.payload as { params: unknown[] }).params;
			// is_collective is at a specific index in the 25-column INSERT
			// Checking that params contain 0 for false
			expect(params1).toContain(0);

			// Second card: is_collective = true -> 1
			const allCardInserts = bridge.calls.filter(
				(c) => c.type === 'db:exec' && (c.payload as { sql: string }).sql.includes('INSERT OR REPLACE INTO cards'),
			);
			const params2 = (allCardInserts[1].payload as { params: unknown[] }).params;
			// Should contain 1 for true
			expect(params2).toContain(1);
		});

		it('includes all 25 card columns in the INSERT', async () => {
			await manager.load('test-dataset');
			const firstCardInsert = bridge.calls.find(
				(c) => c.type === 'db:exec' && (c.payload as { sql: string }).sql.includes('INSERT OR REPLACE INTO cards'),
			);
			const params = (firstCardInsert!.payload as { params: unknown[] }).params;
			// 25 columns = 25 params
			expect(params).toHaveLength(25);
		});

		it('includes all 7 connection columns in the INSERT', async () => {
			await manager.load('test-dataset');
			const connInsert = bridge.calls.find(
				(c) =>
					c.type === 'db:exec' && (c.payload as { sql: string }).sql.includes('INSERT OR IGNORE INTO connections'),
			);
			const params = (connInsert!.payload as { params: unknown[] }).params;
			// 7 columns = 7 params
			expect(params).toHaveLength(7);
		});
	});

	// -----------------------------------------------------------------------
	// clear()
	// -----------------------------------------------------------------------

	describe('clear()', () => {
		it("sends DELETE FROM cards WHERE source = 'sample'", async () => {
			await manager.clear();
			expect(bridge.send).toHaveBeenCalledWith('db:exec', {
				sql: "DELETE FROM cards WHERE source = 'sample'",
				params: [],
			});
		});

		it('does not send a separate DELETE for connections (FK cascade)', async () => {
			await manager.clear();
			const deleteCalls = bridge.calls.filter(
				(c) => c.type === 'db:exec' && (c.payload as { sql: string }).sql.includes('DELETE'),
			);
			// Should only be one DELETE (cards), not two (connections handled by CASCADE)
			expect(deleteCalls).toHaveLength(1);
		});
	});

	// -----------------------------------------------------------------------
	// hasSampleData()
	// -----------------------------------------------------------------------

	describe('hasSampleData()', () => {
		it('returns true when count > 0', async () => {
			bridge.send = vi.fn(async () => ({
				columns: ['count'],
				rows: [{ count: 5 }],
			}));
			const result = await manager.hasSampleData();
			expect(result).toBe(true);
		});

		it('returns false when count = 0', async () => {
			bridge.send = vi.fn(async () => ({
				columns: ['count'],
				rows: [{ count: 0 }],
			}));
			const result = await manager.hasSampleData();
			expect(result).toBe(false);
		});

		it('queries with SELECT COUNT(*) and source = sample', async () => {
			await manager.hasSampleData();
			expect(bridge.send).toHaveBeenCalledWith('db:query', {
				sql: "SELECT COUNT(*) as count FROM cards WHERE source = 'sample'",
				params: [],
			});
		});
	});
});
