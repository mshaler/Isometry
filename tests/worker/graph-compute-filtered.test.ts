// Isometry v9.0 — Phase 116 Plan 01
// TDD tests for handleGraphCompute with cardIds filter.
//
// Tests cover:
//   - handleGraphCompute with cardIds: only those cards in graph
//   - handleGraphCompute without cardIds: all non-deleted cards (backward compat)
//   - Edge filtering: edges between non-included cards are excluded

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Database } from '../../src/database/Database';
import { createCard } from '../../src/database/queries/cards';
import { createConnection } from '../../src/database/queries/connections';
import { GRAPH_METRICS_DDL } from '../../src/database/queries/graph-metrics';
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
// Filtered graph:compute (cardIds)
// ---------------------------------------------------------------------------

describe('handleGraphCompute — filtered by cardIds', () => {
	it('builds graph only from provided cardIds', () => {
		const a = makeCard('A');
		const b = makeCard('B');
		const c = makeCard('C');
		createConnection(db, { source_id: a.id, target_id: b.id });
		createConnection(db, { source_id: b.id, target_id: c.id });

		// Only include A and B — C should be excluded
		const result = handleGraphCompute(db, {
			algorithms: ['pagerank'],
			cardIds: [a.id, b.id],
			renderToken: 1,
		});

		expect(result.cardCount).toBe(2);
	});

	it('filters edges to only those between provided cards', () => {
		const a = makeCard('A');
		const b = makeCard('B');
		const c = makeCard('C');
		createConnection(db, { source_id: a.id, target_id: b.id });
		createConnection(db, { source_id: b.id, target_id: c.id });

		// Only A and B — edge B-C should be excluded
		const result = handleGraphCompute(db, {
			algorithms: ['pagerank'],
			cardIds: [a.id, b.id],
			renderToken: 1,
		});

		expect(result.edgeCount).toBe(1); // Only A-B edge
	});

	it('without cardIds uses all non-deleted cards (backward compat)', () => {
		const a = makeCard('A');
		const b = makeCard('B');
		const c = makeCard('C');
		createConnection(db, { source_id: a.id, target_id: b.id });
		createConnection(db, { source_id: b.id, target_id: c.id });

		const result = handleGraphCompute(db, {
			algorithms: ['pagerank'],
			renderToken: 1,
		});

		expect(result.cardCount).toBe(3);
		expect(result.edgeCount).toBe(2);
	});

	it('empty cardIds array uses all non-deleted cards', () => {
		const a = makeCard('A');
		const b = makeCard('B');
		createConnection(db, { source_id: a.id, target_id: b.id });

		const result = handleGraphCompute(db, {
			algorithms: ['pagerank'],
			cardIds: [],
			renderToken: 1,
		});

		expect(result.cardCount).toBe(2);
	});

	it('writes metrics only for filtered cards', () => {
		const a = makeCard('A');
		const b = makeCard('B');
		const c = makeCard('C');
		createConnection(db, { source_id: a.id, target_id: b.id });
		createConnection(db, { source_id: b.id, target_id: c.id });

		handleGraphCompute(db, {
			algorithms: ['pagerank'],
			cardIds: [a.id, b.id],
			renderToken: 1,
		});

		// Check graph_metrics table — should only have A and B
		const rows = db.exec('SELECT card_id FROM graph_metrics ORDER BY card_id');
		const cardIds = (rows[0]?.values ?? []).map((r) => r[0] as string);
		expect(cardIds).toHaveLength(2);
		expect(cardIds).toContain(a.id);
		expect(cardIds).toContain(b.id);
		expect(cardIds).not.toContain(c.id);
	});
});
