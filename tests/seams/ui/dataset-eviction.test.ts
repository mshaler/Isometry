// @vitest-environment node
// Isometry v5 — Phase 85 Plan 02
// Integration test: dataset eviction zero-bleed
//
// Verifies that loading a new dataset via SampleDataManager fully evicts
// prior data. Uses real sql.js to confirm zero rows from Dataset A exist
// after loading Dataset B.
//
// Requirements: EVIC-01, EVIC-02, EVIC-03

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Database } from '../../../src/database/Database';
import { SampleDataManager } from '../../../src/sample/SampleDataManager';
import type { SampleDataset } from '../../../src/sample/types';
import type { WorkerBridgeLike } from '../../../src/views/types';
import { realDb } from '../../harness/realDb';

// ---------------------------------------------------------------------------
// WorkerBridgeLike mock that wraps the real sql.js Database
// ---------------------------------------------------------------------------

function makeBridge(db: Database): WorkerBridgeLike {
	return {
		async send(type: string, payload: unknown): Promise<unknown> {
			const p = payload as { sql: string; params: unknown[] };
			if (type === 'db:exec') {
				db.run(p.sql, p.params as Parameters<typeof db.run>[1]);
				return {};
			}
			if (type === 'db:query') {
				const results = db.exec(p.sql);
				if (results.length === 0) return { columns: [], rows: [] };
				const { columns, values } = results[0]!;
				const rows = values.map((row) => {
					const obj: Record<string, unknown> = {};
					columns.forEach((col, i) => {
						obj[col] = row[i];
					});
					return obj;
				});
				return { columns, rows };
			}
			return {};
		},
	};
}

// ---------------------------------------------------------------------------
// Minimal SQL seed fixtures
// Nodes use the INSERT INTO nodes format that SampleDataManager.load() expects.
// ---------------------------------------------------------------------------

// Dataset A: 3 nodes (Alpha-1, Alpha-2, Alpha-3) with one connection
const DATASET_A_SQL = `
INSERT INTO nodes (id, node_type, name, source) VALUES ('a1', 'note', 'Alpha-1', 'sample');
INSERT INTO nodes (id, node_type, name, source) VALUES ('a2', 'note', 'Alpha-2', 'sample');
INSERT INTO nodes (id, node_type, name, source) VALUES ('a3', 'note', 'Alpha-3', 'sample');
INSERT INTO edges (id, edge_type, source_id, target_id) VALUES ('e-a1-a2', 'link', 'a1', 'a2');
`;

// Dataset B: 2 nodes (Beta-1, Beta-2) with no connections
const DATASET_B_SQL = `
INSERT INTO nodes (id, node_type, name, source) VALUES ('b1', 'note', 'Beta-1', 'sample');
INSERT INTO nodes (id, node_type, name, source) VALUES ('b2', 'note', 'Beta-2', 'sample');
`;

const datasetA: SampleDataset = {
	id: 'dataset-a',
	name: 'Dataset A',
	description: 'Alpha nodes for testing',
	defaultView: 'list',
	sql: DATASET_A_SQL,
};

const datasetB: SampleDataset = {
	id: 'dataset-b',
	name: 'Dataset B',
	description: 'Beta nodes for testing',
	defaultView: 'list',
	sql: DATASET_B_SQL,
};

// ---------------------------------------------------------------------------
// Test state
// ---------------------------------------------------------------------------

let db: Database;
let manager: SampleDataManager;

beforeEach(async () => {
	db = await realDb();
	const bridge = makeBridge(db);
	manager = new SampleDataManager(bridge, [datasetA, datasetB]);
});

afterEach(() => {
	db.close();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function countCards(): number {
	const results = db.exec('SELECT COUNT(*) as cnt FROM cards');
	if (results.length === 0) return 0;
	const val = results[0]!.values[0]?.[0];
	return typeof val === 'number' ? val : 0;
}

function countConnections(): number {
	const results = db.exec('SELECT COUNT(*) as cnt FROM connections');
	if (results.length === 0) return 0;
	const val = results[0]!.values[0]?.[0];
	return typeof val === 'number' ? val : 0;
}

function getCardNames(): string[] {
	const results = db.exec('SELECT name FROM cards ORDER BY name');
	if (results.length === 0) return [];
	return results[0]!.values.map((row) => row[0] as string);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Dataset eviction (real sql.js)', () => {
	it('evictAll() leaves zero cards in database', async () => {
		// Load Dataset A first
		await manager.load('dataset-a');
		expect(countCards()).toBe(3);

		// evictAll() should delete everything
		await manager.evictAll();
		expect(countCards()).toBe(0);
	});

	it('load Dataset B after evictAll removes all Dataset A rows', async () => {
		// Load Dataset A
		await manager.load('dataset-a');
		const namesA = getCardNames();
		expect(namesA).toContain('Alpha-1');
		expect(namesA).toContain('Alpha-2');
		expect(namesA).toContain('Alpha-3');

		// Evict all, then load Dataset B
		await manager.evictAll();
		await manager.load('dataset-b');

		// Zero Alpha cards remain
		const results = db.exec("SELECT COUNT(*) as cnt FROM cards WHERE name LIKE 'Alpha%'");
		const alphaCount = results[0]?.values[0]?.[0] as number;
		expect(alphaCount).toBe(0);

		// Only Beta cards exist
		const names = getCardNames();
		expect(names).toContain('Beta-1');
		expect(names).toContain('Beta-2');
		expect(names).not.toContain('Alpha-1');
	});

	it('connections from prior dataset are evicted', async () => {
		// Load Dataset A (with edges)
		await manager.load('dataset-a');
		expect(countConnections()).toBeGreaterThan(0);

		// Evict all, load Dataset B (no edges)
		await manager.evictAll();
		await manager.load('dataset-b');

		// No connections remain from Dataset A
		expect(countConnections()).toBe(0);
	});

	it('sequential dataset switches maintain zero-bleed invariant', async () => {
		// A → evictAll → B → evictAll → A
		await manager.load('dataset-a');
		await manager.evictAll();
		await manager.load('dataset-b');
		await manager.evictAll();
		await manager.load('dataset-a');

		// Only Dataset A cards exist
		const names = getCardNames();
		expect(names).toContain('Alpha-1');
		expect(names).toContain('Alpha-2');
		expect(names).toContain('Alpha-3');
		expect(names).not.toContain('Beta-1');
		expect(names).not.toContain('Beta-2');
		expect(countCards()).toBe(3);
	});
});
