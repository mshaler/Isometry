// Isometry v5 -- Phase 52 SampleDataManager Unit Tests (SQL seed edition)
// Tests the temp-table staging pipeline and SQL statement splitter.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SampleDataManager, splitSQLStatements } from '../../src/sample/SampleDataManager';
import type { SampleDataset } from '../../src/sample/types';
import type { WorkerBridgeLike } from '../../src/views/types';

// ---------------------------------------------------------------------------
// Test Fixtures
// ---------------------------------------------------------------------------

function makeMockBridge(): WorkerBridgeLike & { calls: Array<{ type: string; payload: unknown }> } {
	const calls: Array<{ type: string; payload: unknown }> = [];
	return {
		calls,
		send: vi.fn(async (type: string, payload: unknown) => {
			calls.push({ type, payload });
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
		description: 'A test dataset',
		defaultView: 'list',
		sql: [
			"INSERT INTO nodes (id, node_type, name, folder, tags) VALUES ('n1', 'person', 'Alice', 'People', 'dev');",
			"INSERT INTO nodes (id, node_type, name, folder, tags) VALUES ('n2', 'film', 'Movie X', 'Films', 'drama');",
			"INSERT INTO edges (id, edge_type, source_id, target_id, weight, label) VALUES ('e1', 'APPEARED_IN', 'n1', 'n2', 1.0, 'APPEARED_IN');",
		].join('\n'),
	};
}

// ---------------------------------------------------------------------------
// splitSQLStatements
// ---------------------------------------------------------------------------

describe('splitSQLStatements', () => {
	it('splits simple semicolon-delimited statements', () => {
		const result = splitSQLStatements('SELECT 1; SELECT 2;');
		expect(result).toEqual(['SELECT 1', 'SELECT 2']);
	});

	it('does not split on semicolons inside single-quoted strings', () => {
		const result = splitSQLStatements("INSERT INTO t (v) VALUES ('a;b;c');");
		expect(result).toHaveLength(1);
		expect(result[0]).toContain("'a;b;c'");
	});

	it('handles multi-row INSERT with values containing semicolons', () => {
		const sql = "INSERT INTO nodes (id, name) VALUES ('n1', 'foo;bar'), ('n2', 'baz;qux');";
		const result = splitSQLStatements(sql);
		expect(result).toHaveLength(1);
	});

	it('filters out comment-only statements', () => {
		const sql = '-- This is a comment\nSELECT 1;';
		const result = splitSQLStatements(sql);
		expect(result).toHaveLength(1);
		expect(result[0]).toContain('SELECT 1');
	});

	it('handles escaped single quotes (double-single-quote SQL convention)', () => {
		const sql = "INSERT INTO t (v) VALUES ('it''s fine');";
		const result = splitSQLStatements(sql);
		expect(result).toHaveLength(1);
		expect(result[0]).toContain("'it''s fine'");
	});

	it('returns empty array for empty input', () => {
		expect(splitSQLStatements('')).toEqual([]);
		expect(splitSQLStatements('   ')).toEqual([]);
	});

	it('returns empty array for comment-only input', () => {
		expect(splitSQLStatements('-- just a comment')).toEqual([]);
	});
});

// ---------------------------------------------------------------------------
// SampleDataManager
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
			expect(result[0]!.id).toBe('test-dataset');
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

		it('calls clear() before staging (first call is DELETE)', async () => {
			await manager.load('test-dataset');
			expect(bridge.calls[0]!.type).toBe('db:exec');
			const firstPayload = bridge.calls[0]!.payload as { sql: string };
			expect(firstPayload.sql).toContain("DELETE FROM cards WHERE source = 'sample'");
		});

		it('creates _seed_nodes temp table', async () => {
			await manager.load('test-dataset');
			const createCalls = bridge.calls.filter(
				(c) =>
					c.type === 'db:exec' &&
					(c.payload as { sql: string }).sql.includes('CREATE TEMP TABLE') &&
					(c.payload as { sql: string }).sql.includes('_seed_nodes'),
			);
			expect(createCalls).toHaveLength(1);
		});

		it('creates _seed_edges temp table', async () => {
			await manager.load('test-dataset');
			const createCalls = bridge.calls.filter(
				(c) =>
					c.type === 'db:exec' &&
					(c.payload as { sql: string }).sql.includes('CREATE TEMP TABLE') &&
					(c.payload as { sql: string }).sql.includes('_seed_edges'),
			);
			expect(createCalls).toHaveLength(1);
		});

		it('retargets INSERT INTO nodes to _seed_nodes', async () => {
			await manager.load('test-dataset');
			const seedNodeInserts = bridge.calls.filter(
				(c) => c.type === 'db:exec' && (c.payload as { sql: string }).sql.includes('INSERT INTO _seed_nodes'),
			);
			// 2 node INSERTs in the test fixture
			expect(seedNodeInserts).toHaveLength(2);
		});

		it('retargets INSERT INTO edges to _seed_edges', async () => {
			await manager.load('test-dataset');
			const seedEdgeInserts = bridge.calls.filter(
				(c) => c.type === 'db:exec' && (c.payload as { sql: string }).sql.includes('INSERT INTO _seed_edges'),
			);
			// 1 edge INSERT in the test fixture
			expect(seedEdgeInserts).toHaveLength(1);
		});

		it('copies nodes to cards with CASE mapping for card_type', async () => {
			await manager.load('test-dataset');
			const copyCalls = bridge.calls.filter(
				(c) =>
					c.type === 'db:exec' &&
					(c.payload as { sql: string }).sql.includes('INSERT OR REPLACE INTO cards') &&
					(c.payload as { sql: string }).sql.includes('FROM _seed_nodes'),
			);
			expect(copyCalls).toHaveLength(1);
			const sql = (copyCalls[0]!.payload as { sql: string }).sql;
			// Should map 'film' -> 'resource'
			expect(sql).toContain("WHEN 'film' THEN 'resource'");
			// Should force source='sample'
			expect(sql).toContain("'sample'");
		});

		it('copies edges to connections', async () => {
			await manager.load('test-dataset');
			const copyCalls = bridge.calls.filter(
				(c) =>
					c.type === 'db:exec' &&
					(c.payload as { sql: string }).sql.includes('INSERT OR IGNORE INTO connections') &&
					(c.payload as { sql: string }).sql.includes('FROM _seed_edges'),
			);
			expect(copyCalls).toHaveLength(1);
		});

		it('drops temp tables after staging', async () => {
			await manager.load('test-dataset');
			const dropCalls = bridge.calls.filter(
				(c) => c.type === 'db:exec' && (c.payload as { sql: string }).sql.includes('DROP TABLE IF EXISTS'),
			);
			expect(dropCalls).toHaveLength(2);
			const sqls = dropCalls.map((c) => (c.payload as { sql: string }).sql);
			expect(sqls).toContain('DROP TABLE IF EXISTS _seed_nodes');
			expect(sqls).toContain('DROP TABLE IF EXISTS _seed_edges');
		});

		it('processes nodes before edges (FK ordering)', async () => {
			await manager.load('test-dataset');
			const sqls = bridge.calls.map((c) => (c.payload as { sql: string }).sql);
			const nodesCopyIdx = sqls.findIndex(
				(s) => s.includes('INSERT OR REPLACE INTO cards') && s.includes('FROM _seed_nodes'),
			);
			const edgesCopyIdx = sqls.findIndex(
				(s) => s.includes('INSERT OR IGNORE INTO connections') && s.includes('FROM _seed_edges'),
			);
			expect(nodesCopyIdx).toBeLessThan(edgesCopyIdx);
		});

		it('skips settings/metadata rows (only processes nodes and edges)', async () => {
			const dsWithSettings = makeTestDataset('with-settings');
			dsWithSettings.sql += "\nINSERT INTO settings (key, value) VALUES ('demo_title', 'Test');";
			const mgr = new SampleDataManager(bridge, [dsWithSettings]);
			await mgr.load('with-settings');
			const settingsCalls = bridge.calls.filter(
				(c) => c.type === 'db:exec' && (c.payload as { sql: string }).sql.includes('INSERT INTO settings'),
			);
			expect(settingsCalls).toHaveLength(0);
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
