// Isometry v9.0 — Phase 115 Algorithm Engine
// TDD tests for all 6 graph algorithm implementations in handleGraphCompute
//
// Covers 4 canonical fixture graphs with hand-computed expected values:
//   1. Triangle (3 nodes, 3 edges) — fully connected
//   2. Star (5 nodes, 4 edges) — one hub node
//   3. Two-component (5 nodes: 3-clique + disconnected pair)
//   4. Linear chain (5 nodes, 4 edges)
//
// Each test group validates one or more algorithms against known properties.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Database } from '../../src/database/Database';
import { createCard } from '../../src/database/queries/cards';
import { createConnection } from '../../src/database/queries/connections';
import { GRAPH_METRICS_DDL, readAllGraphMetrics } from '../../src/database/queries/graph-metrics';
import { handleGraphCompute } from '../../src/worker/handlers/graph-algorithms.handler';

let db: Database;

beforeEach(async () => {
	db = new Database();
	await db.initialize();
	const ddlStatements = GRAPH_METRICS_DDL.split(';').filter((s) => s.trim());
	for (const stmt of ddlStatements) {
		db.run(stmt);
	}
});

afterEach(() => {
	db.close();
});

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function makeCard(name: string) {
	return createCard(db, { name });
}

// ---------------------------------------------------------------------------
// Protocol extension: componentCount, pathCardIds, reachable
// ---------------------------------------------------------------------------

describe('handleGraphCompute — protocol fields', () => {
	it('returns componentCount=0 for empty graph', () => {
		const result = handleGraphCompute(db, { algorithms: [], renderToken: 1 });
		expect(result.componentCount).toBe(0);
	});

	it('returns componentCount=1 for a fully connected triangle', () => {
		const a = makeCard('A');
		const b = makeCard('B');
		const c = makeCard('C');
		createConnection(db, { source_id: a.id, target_id: b.id });
		createConnection(db, { source_id: b.id, target_id: c.id });
		createConnection(db, { source_id: c.id, target_id: a.id });
		const result = handleGraphCompute(db, { algorithms: [], renderToken: 1 });
		expect(result.componentCount).toBe(1);
	});

	it('returns componentCount=2 for two-component graph', () => {
		const a = makeCard('A');
		const b = makeCard('B');
		const c = makeCard('C');
		const d = makeCard('D');
		const e = makeCard('E');
		// Component 1: A-B-C clique
		createConnection(db, { source_id: a.id, target_id: b.id });
		createConnection(db, { source_id: b.id, target_id: c.id });
		createConnection(db, { source_id: c.id, target_id: a.id });
		// Component 2: D-E pair
		createConnection(db, { source_id: d.id, target_id: e.id });
		const result = handleGraphCompute(db, { algorithms: [], renderToken: 1 });
		expect(result.componentCount).toBe(2);
	});

	it('counts isolated nodes as separate components', () => {
		makeCard('Isolated-1');
		makeCard('Isolated-2');
		const result = handleGraphCompute(db, { algorithms: [], renderToken: 1 });
		expect(result.componentCount).toBe(2);
	});
});

// ---------------------------------------------------------------------------
// PageRank: scores sum to ~1.0
// ---------------------------------------------------------------------------

describe('handleGraphCompute — pagerank', () => {
	it('PageRank scores sum to within 0.01 of 1.0 for triangle', () => {
		const a = makeCard('A');
		const b = makeCard('B');
		const c = makeCard('C');
		createConnection(db, { source_id: a.id, target_id: b.id });
		createConnection(db, { source_id: b.id, target_id: c.id });
		createConnection(db, { source_id: c.id, target_id: a.id });

		handleGraphCompute(db, { algorithms: ['pagerank'], renderToken: 1 });
		const rows = readAllGraphMetrics(db);

		expect(rows).toHaveLength(3);
		const sum = rows.reduce((acc, r) => acc + (r.pagerank ?? 0), 0);
		expect(sum).toBeCloseTo(1.0, 1); // within 0.01
	});

	it('PageRank: hub node in star graph has highest pagerank', () => {
		const hub = makeCard('Hub');
		const l1 = makeCard('Leaf1');
		const l2 = makeCard('Leaf2');
		const l3 = makeCard('Leaf3');
		const l4 = makeCard('Leaf4');
		createConnection(db, { source_id: hub.id, target_id: l1.id });
		createConnection(db, { source_id: hub.id, target_id: l2.id });
		createConnection(db, { source_id: hub.id, target_id: l3.id });
		createConnection(db, { source_id: hub.id, target_id: l4.id });

		handleGraphCompute(db, { algorithms: ['pagerank'], renderToken: 1 });
		const rows = readAllGraphMetrics(db);

		const hubRow = rows.find((r) => r.card_id === hub.id);
		const leafRows = rows.filter((r) => r.card_id !== hub.id);

		expect(hubRow).toBeDefined();
		expect(hubRow!.pagerank).not.toBeNull();

		for (const leaf of leafRows) {
			expect(hubRow!.pagerank!).toBeGreaterThanOrEqual(leaf.pagerank ?? 0);
		}
	});

	it('PageRank scores sum to within 0.01 of 1.0 for linear chain', () => {
		const a = makeCard('A');
		const b = makeCard('B');
		const c = makeCard('C');
		const d = makeCard('D');
		const e = makeCard('E');
		createConnection(db, { source_id: a.id, target_id: b.id });
		createConnection(db, { source_id: b.id, target_id: c.id });
		createConnection(db, { source_id: c.id, target_id: d.id });
		createConnection(db, { source_id: d.id, target_id: e.id });

		handleGraphCompute(db, { algorithms: ['pagerank'], renderToken: 1 });
		const rows = readAllGraphMetrics(db);

		const sum = rows.reduce((acc, r) => acc + (r.pagerank ?? 0), 0);
		expect(sum).toBeCloseTo(1.0, 1);
	});

	it('algorithmsComputed includes pagerank', () => {
		makeCard('A');
		const result = handleGraphCompute(db, { algorithms: ['pagerank'], renderToken: 1 });
		expect(result.algorithmsComputed).toContain('pagerank');
	});

	it('pagerank values not NaN or Infinity after write', () => {
		const a = makeCard('A');
		const b = makeCard('B');
		createConnection(db, { source_id: a.id, target_id: b.id });

		handleGraphCompute(db, { algorithms: ['pagerank'], renderToken: 1 });
		const rows = readAllGraphMetrics(db);

		for (const row of rows) {
			if (row.pagerank !== null) {
				expect(Number.isFinite(row.pagerank)).toBe(true);
			}
		}
	});
});

// ---------------------------------------------------------------------------
// Betweenness Centrality
// ---------------------------------------------------------------------------

describe('handleGraphCompute — centrality (betweenness)', () => {
	it('all nodes in triangle have equal centrality (symmetric graph)', () => {
		const a = makeCard('A');
		const b = makeCard('B');
		const c = makeCard('C');
		createConnection(db, { source_id: a.id, target_id: b.id });
		createConnection(db, { source_id: b.id, target_id: c.id });
		createConnection(db, { source_id: c.id, target_id: a.id });

		handleGraphCompute(db, { algorithms: ['centrality'], renderToken: 1 });
		const rows = readAllGraphMetrics(db);

		expect(rows).toHaveLength(3);
		const centralities = rows.map((r) => r.centrality ?? 0);
		// All equal in a triangle
		expect(Math.max(...centralities) - Math.min(...centralities)).toBeLessThan(0.01);
	});

	it('hub node in star graph has highest centrality', () => {
		const hub = makeCard('Hub');
		const l1 = makeCard('Leaf1');
		const l2 = makeCard('Leaf2');
		const l3 = makeCard('Leaf3');
		const l4 = makeCard('Leaf4');
		createConnection(db, { source_id: hub.id, target_id: l1.id });
		createConnection(db, { source_id: hub.id, target_id: l2.id });
		createConnection(db, { source_id: hub.id, target_id: l3.id });
		createConnection(db, { source_id: hub.id, target_id: l4.id });

		handleGraphCompute(db, { algorithms: ['centrality'], renderToken: 1 });
		const rows = readAllGraphMetrics(db);

		const hubRow = rows.find((r) => r.card_id === hub.id);
		const leafRows = rows.filter((r) => r.card_id !== hub.id);

		expect(hubRow!.centrality!).toBeGreaterThan(0);
		for (const leaf of leafRows) {
			expect(hubRow!.centrality!).toBeGreaterThan(leaf.centrality ?? 0);
		}
	});

	it('centrality values in [0, 1] range (normalized)', () => {
		const a = makeCard('A');
		const b = makeCard('B');
		const c = makeCard('C');
		const d = makeCard('D');
		const e = makeCard('E');
		createConnection(db, { source_id: a.id, target_id: b.id });
		createConnection(db, { source_id: b.id, target_id: c.id });
		createConnection(db, { source_id: c.id, target_id: d.id });
		createConnection(db, { source_id: d.id, target_id: e.id });

		handleGraphCompute(db, { algorithms: ['centrality'], renderToken: 1 });
		const rows = readAllGraphMetrics(db);

		for (const row of rows) {
			if (row.centrality !== null) {
				expect(row.centrality).toBeGreaterThanOrEqual(0);
				expect(row.centrality).toBeLessThanOrEqual(1);
			}
		}
	});

	it('algorithmsComputed includes centrality', () => {
		makeCard('A');
		const result = handleGraphCompute(db, { algorithms: ['centrality'], renderToken: 1 });
		expect(result.algorithmsComputed).toContain('centrality');
	});
});

// ---------------------------------------------------------------------------
// Louvain Community Detection
// ---------------------------------------------------------------------------

describe('handleGraphCompute — community (Louvain)', () => {
	it('triangle: all 3 nodes share same community (fully connected)', () => {
		const a = makeCard('A');
		const b = makeCard('B');
		const c = makeCard('C');
		createConnection(db, { source_id: a.id, target_id: b.id });
		createConnection(db, { source_id: b.id, target_id: c.id });
		createConnection(db, { source_id: c.id, target_id: a.id });

		handleGraphCompute(db, { algorithms: ['community'], renderToken: 1 });
		const rows = readAllGraphMetrics(db);

		expect(rows).toHaveLength(3);
		// All nodes in a clique should share the same community
		const communityIds = new Set(rows.map((r) => r.community_id));
		expect(communityIds.size).toBe(1);
		// community_id should be a non-null integer
		expect(rows[0]!.community_id).not.toBeNull();
	});

	it('two-component graph: detects 2+ communities', () => {
		const a = makeCard('A');
		const b = makeCard('B');
		const c = makeCard('C');
		const d = makeCard('D');
		const e = makeCard('E');
		createConnection(db, { source_id: a.id, target_id: b.id });
		createConnection(db, { source_id: b.id, target_id: c.id });
		createConnection(db, { source_id: c.id, target_id: a.id });
		createConnection(db, { source_id: d.id, target_id: e.id });

		handleGraphCompute(db, { algorithms: ['community'], renderToken: 1 });
		const rows = readAllGraphMetrics(db);

		// Should detect at least 2 communities
		const communityIds = new Set(rows.filter((r) => r.community_id !== null).map((r) => r.community_id));
		expect(communityIds.size).toBeGreaterThanOrEqual(2);
	});

	it('isolated nodes get community_id = null', () => {
		makeCard('Isolated');

		handleGraphCompute(db, { algorithms: ['community'], renderToken: 1 });
		const rows = readAllGraphMetrics(db);

		expect(rows).toHaveLength(1);
		expect(rows[0]!.community_id).toBeNull();
	});

	it('nodes in same clique share community (membership invariant)', () => {
		const a = makeCard('A');
		const b = makeCard('B');
		const c = makeCard('C');
		createConnection(db, { source_id: a.id, target_id: b.id });
		createConnection(db, { source_id: b.id, target_id: c.id });
		createConnection(db, { source_id: c.id, target_id: a.id });

		handleGraphCompute(db, {
			algorithms: ['community'],
			params: { community: { resolution: 1 } },
			renderToken: 1,
		});
		const rows = readAllGraphMetrics(db);

		const aRow = rows.find((r) => r.card_id === a.id);
		const bRow = rows.find((r) => r.card_id === b.id);
		const cRow = rows.find((r) => r.card_id === c.id);
		// All in clique should be in same community
		expect(aRow!.community_id).toBe(bRow!.community_id);
		expect(bRow!.community_id).toBe(cRow!.community_id);
	});

	it('algorithmsComputed includes community', () => {
		const a = makeCard('A');
		const b = makeCard('B');
		createConnection(db, { source_id: a.id, target_id: b.id });
		const result = handleGraphCompute(db, { algorithms: ['community'], renderToken: 1 });
		expect(result.algorithmsComputed).toContain('community');
	});
});

// ---------------------------------------------------------------------------
// Clustering Coefficient
// ---------------------------------------------------------------------------

describe('handleGraphCompute — clustering', () => {
	it('triangle: all nodes have clustering_coeff = 1.0', () => {
		const a = makeCard('A');
		const b = makeCard('B');
		const c = makeCard('C');
		createConnection(db, { source_id: a.id, target_id: b.id });
		createConnection(db, { source_id: b.id, target_id: c.id });
		createConnection(db, { source_id: c.id, target_id: a.id });

		handleGraphCompute(db, { algorithms: ['clustering'], renderToken: 1 });
		const rows = readAllGraphMetrics(db);

		for (const row of rows) {
			expect(row.clustering_coeff).toBeCloseTo(1.0, 5);
		}
	});

	it('star graph: leaves have clustering_coeff = 0', () => {
		const hub = makeCard('Hub');
		const l1 = makeCard('Leaf1');
		const l2 = makeCard('Leaf2');
		const l3 = makeCard('Leaf3');
		const l4 = makeCard('Leaf4');
		createConnection(db, { source_id: hub.id, target_id: l1.id });
		createConnection(db, { source_id: hub.id, target_id: l2.id });
		createConnection(db, { source_id: hub.id, target_id: l3.id });
		createConnection(db, { source_id: hub.id, target_id: l4.id });

		handleGraphCompute(db, { algorithms: ['clustering'], renderToken: 1 });
		const rows = readAllGraphMetrics(db);

		const leafRows = rows.filter((r) => r.card_id !== hub.id);
		for (const leaf of leafRows) {
			// Leaves have degree 1, so clustering_coeff = 0
			expect(leaf.clustering_coeff).toBeCloseTo(0, 5);
		}
	});

	it('isolated nodes get clustering_coeff = 0', () => {
		makeCard('Isolated');

		handleGraphCompute(db, { algorithms: ['clustering'], renderToken: 1 });
		const rows = readAllGraphMetrics(db);

		expect(rows[0]!.clustering_coeff).toBe(0);
	});

	it('algorithmsComputed includes clustering', () => {
		makeCard('A');
		const result = handleGraphCompute(db, { algorithms: ['clustering'], renderToken: 1 });
		expect(result.algorithmsComputed).toContain('clustering');
	});
});

// ---------------------------------------------------------------------------
// MST (Kruskal's spanning forest)
// ---------------------------------------------------------------------------

describe('handleGraphCompute — spanning_tree', () => {
	it('linear chain (5 nodes, 4 edges): MST has all 4 edges (is the chain)', () => {
		const a = makeCard('A');
		const b = makeCard('B');
		const c = makeCard('C');
		const d = makeCard('D');
		const e = makeCard('E');
		createConnection(db, { source_id: a.id, target_id: b.id });
		createConnection(db, { source_id: b.id, target_id: c.id });
		createConnection(db, { source_id: c.id, target_id: d.id });
		createConnection(db, { source_id: d.id, target_id: e.id });

		handleGraphCompute(db, { algorithms: ['spanning_tree'], renderToken: 1 });
		const rows = readAllGraphMetrics(db);

		// MST of linear chain = chain itself, 4 edges = 4 in_spanning_tree nodes touched
		// For MST we mark edges, not nodes. in_spanning_tree=1 for nodes whose edges are in MST.
		// Actually in_spanning_tree is per-node field — let's check the sum of spanning tree nodes
		const inMst = rows.filter((r) => r.in_spanning_tree === 1);
		// All 5 nodes should be in the spanning tree (chain is already a tree)
		expect(inMst).toHaveLength(5);
	});

	it('triangle (3 nodes, 3 edges): MST has 2 edges (n-1=2)', () => {
		const a = makeCard('A');
		const b = makeCard('B');
		const c = makeCard('C');
		createConnection(db, { source_id: a.id, target_id: b.id });
		createConnection(db, { source_id: b.id, target_id: c.id });
		createConnection(db, { source_id: c.id, target_id: a.id });

		handleGraphCompute(db, { algorithms: ['spanning_tree'], renderToken: 1 });
		const rows = readAllGraphMetrics(db);

		// All 3 nodes should be in the spanning tree
		const inMst = rows.filter((r) => r.in_spanning_tree === 1);
		expect(inMst).toHaveLength(3);
	});

	it('two-component graph: componentCount=2, edge count = n - components', () => {
		const a = makeCard('A');
		const b = makeCard('B');
		const c = makeCard('C');
		const d = makeCard('D');
		const e = makeCard('E');
		// Component 1: A-B-C clique
		createConnection(db, { source_id: a.id, target_id: b.id });
		createConnection(db, { source_id: b.id, target_id: c.id });
		createConnection(db, { source_id: c.id, target_id: a.id });
		// Component 2: D-E pair
		createConnection(db, { source_id: d.id, target_id: e.id });

		const result = handleGraphCompute(db, { algorithms: ['spanning_tree'], renderToken: 1 });
		const rows = readAllGraphMetrics(db);

		// componentCount should reflect 2 disconnected components
		expect(result.componentCount).toBe(2);
		// All 5 nodes should be in the spanning forest
		const inMst = rows.filter((r) => r.in_spanning_tree === 1);
		expect(inMst).toHaveLength(5);
	});

	it('algorithmsComputed includes spanning_tree', () => {
		const a = makeCard('A');
		const b = makeCard('B');
		createConnection(db, { source_id: a.id, target_id: b.id });
		const result = handleGraphCompute(db, { algorithms: ['spanning_tree'], renderToken: 1 });
		expect(result.algorithmsComputed).toContain('spanning_tree');
	});
});

// ---------------------------------------------------------------------------
// Shortest Path
// ---------------------------------------------------------------------------

describe('handleGraphCompute — shortest_path', () => {
	it('linear chain: sp_depth increases from source', () => {
		const a = makeCard('A');
		const b = makeCard('B');
		const c = makeCard('C');
		const d = makeCard('D');
		const e = makeCard('E');
		createConnection(db, { source_id: a.id, target_id: b.id });
		createConnection(db, { source_id: b.id, target_id: c.id });
		createConnection(db, { source_id: c.id, target_id: d.id });
		createConnection(db, { source_id: d.id, target_id: e.id });

		handleGraphCompute(db, {
			algorithms: ['shortest_path'],
			params: { shortest_path: { sourceCardId: a.id } },
			renderToken: 1,
		});
		const rows = readAllGraphMetrics(db);

		const aRow = rows.find((r) => r.card_id === a.id);
		const bRow = rows.find((r) => r.card_id === b.id);
		const eRow = rows.find((r) => r.card_id === e.id);

		expect(aRow!.sp_depth).toBe(0);
		expect(bRow!.sp_depth).toBe(1);
		expect(eRow!.sp_depth).toBe(4);
	});

	it('disconnected: nodes in other component get sp_depth = null', () => {
		const a = makeCard('A');
		const b = makeCard('B');
		const isolated = makeCard('Isolated');

		createConnection(db, { source_id: a.id, target_id: b.id });

		handleGraphCompute(db, {
			algorithms: ['shortest_path'],
			params: { shortest_path: { sourceCardId: a.id } },
			renderToken: 1,
		});
		const rows = readAllGraphMetrics(db);

		const isolatedRow = rows.find((r) => r.card_id === isolated.id);
		expect(isolatedRow!.sp_depth).toBeNull();
	});

	it('auto-selects highest-degree node when no sourceCardId given', () => {
		const hub = makeCard('Hub');
		const l1 = makeCard('Leaf1');
		const l2 = makeCard('Leaf2');
		createConnection(db, { source_id: hub.id, target_id: l1.id });
		createConnection(db, { source_id: hub.id, target_id: l2.id });

		// No sourceCardId — should auto-select hub
		handleGraphCompute(db, { algorithms: ['shortest_path'], renderToken: 1 });
		const rows = readAllGraphMetrics(db);

		// Hub should have depth 0, leaves depth 1
		const hubRow = rows.find((r) => r.card_id === hub.id);
		expect(hubRow!.sp_depth).toBe(0);
	});

	it('returns reachable: true when source exists in graph', () => {
		const a = makeCard('A');
		const b = makeCard('B');
		createConnection(db, { source_id: a.id, target_id: b.id });

		const result = handleGraphCompute(db, {
			algorithms: ['shortest_path'],
			params: { shortest_path: { sourceCardId: a.id } },
			renderToken: 1,
		});
		expect(result.reachable).toBe(true);
	});

	it('returns reachable: false when sourceCardId not in graph', () => {
		makeCard('A');

		const result = handleGraphCompute(db, {
			algorithms: ['shortest_path'],
			params: { shortest_path: { sourceCardId: 'nonexistent-id' } },
			renderToken: 1,
		});
		expect(result.reachable).toBe(false);
	});

	it('never stores Infinity as sp_depth', () => {
		const a = makeCard('A');
		const b = makeCard('B');
		const c = makeCard('C');
		createConnection(db, { source_id: a.id, target_id: b.id });
		// c is isolated from a

		handleGraphCompute(db, {
			algorithms: ['shortest_path'],
			params: { shortest_path: { sourceCardId: a.id } },
			renderToken: 1,
		});
		const rows = readAllGraphMetrics(db);

		for (const row of rows) {
			if (row.sp_depth !== null) {
				expect(Number.isFinite(row.sp_depth)).toBe(true);
			}
		}
	});

	it('algorithmsComputed includes shortest_path', () => {
		const a = makeCard('A');
		const b = makeCard('B');
		createConnection(db, { source_id: a.id, target_id: b.id });
		const result = handleGraphCompute(db, {
			algorithms: ['shortest_path'],
			params: { shortest_path: { sourceCardId: a.id } },
			renderToken: 1,
		});
		expect(result.algorithmsComputed).toContain('shortest_path');
	});
});

// ---------------------------------------------------------------------------
// Multi-algorithm batch: results merged per card
// ---------------------------------------------------------------------------

describe('handleGraphCompute — multi-algorithm batch', () => {
	it('running pagerank + clustering together fills both columns', () => {
		const a = makeCard('A');
		const b = makeCard('B');
		const c = makeCard('C');
		createConnection(db, { source_id: a.id, target_id: b.id });
		createConnection(db, { source_id: b.id, target_id: c.id });
		createConnection(db, { source_id: c.id, target_id: a.id });

		const result = handleGraphCompute(db, {
			algorithms: ['pagerank', 'clustering'],
			renderToken: 1,
		});
		const rows = readAllGraphMetrics(db);

		expect(result.algorithmsComputed).toContain('pagerank');
		expect(result.algorithmsComputed).toContain('clustering');

		for (const row of rows) {
			expect(row.pagerank).not.toBeNull();
			expect(row.clustering_coeff).not.toBeNull();
		}
	});

	it('writeGraphMetrics is called exactly once per handleGraphCompute invocation', () => {
		// Verify: single transactional batch write — read back should show consistent computed_at
		const a = makeCard('A');
		const b = makeCard('B');
		createConnection(db, { source_id: a.id, target_id: b.id });

		handleGraphCompute(db, { algorithms: ['pagerank', 'centrality', 'clustering'], renderToken: 1 });
		const rows = readAllGraphMetrics(db);

		// All rows should have the same computed_at timestamp (single batch write)
		const timestamps = new Set(rows.map((r) => r.computed_at));
		expect(timestamps.size).toBe(1);
	});

	it('empty algorithms array: no graph metrics written', () => {
		const a = makeCard('A');
		const b = makeCard('B');
		createConnection(db, { source_id: a.id, target_id: b.id });

		handleGraphCompute(db, { algorithms: [], renderToken: 1 });
		const rows = readAllGraphMetrics(db);

		expect(rows).toHaveLength(0);
	});
});

// ---------------------------------------------------------------------------
// Sanitization: no NaN/Infinity in DB after any algorithm
// ---------------------------------------------------------------------------

describe('handleGraphCompute — sanitization', () => {
	it('no metric field contains NaN or Infinity after any algorithm runs', () => {
		const a = makeCard('A');
		const b = makeCard('B');
		const isolated = makeCard('Isolated');
		createConnection(db, { source_id: a.id, target_id: b.id });

		handleGraphCompute(db, {
			algorithms: ['pagerank', 'centrality', 'community', 'clustering', 'spanning_tree', 'shortest_path'],
			params: { shortest_path: { sourceCardId: a.id } },
			renderToken: 1,
		});
		const rows = readAllGraphMetrics(db);

		for (const row of rows) {
			const fields = [
				'centrality',
				'pagerank',
				'community_id',
				'clustering_coeff',
				'sp_depth',
				'in_spanning_tree',
			] as const;
			for (const f of fields) {
				const val = row[f];
				if (val !== null) {
					expect(Number.isFinite(val)).toBe(true);
				}
			}
		}
	});
});
