// Isometry v5 — Graph Traversal TDD Tests
// Covers PERF-04 functional behavior: connectedCards and shortestPath.
//
// Setup: Fresh Database per test group via beforeEach/afterEach.
// Test graph topology:
//   A --- B --- C --- D
//   |         |
//   E         F
//             |
//             G (soft-deleted)
//
// Connections created as:
//   A->B, B->C, C->D, A->E, C->F, F->G (G is soft-deleted)

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Database } from '../../src/database/Database';
import { createCard, deleteCard } from '../../src/database/queries/cards';
import { createConnection } from '../../src/database/queries/connections';
import { connectedCards, shortestPath } from '../../src/database/queries/graph';
import type { Card } from '../../src/database/queries/types';

// ---------------------------------------------------------------------------
// Shared setup helpers
// ---------------------------------------------------------------------------

let db: Database;
let cardA: Card;
let cardB: Card;
let cardC: Card;
let cardD: Card;
let cardE: Card;
let cardF: Card;
let cardG: Card;

beforeEach(async () => {
	db = new Database();
	await db.initialize();

	// Create cards
	cardA = createCard(db, { name: 'Card A' });
	cardB = createCard(db, { name: 'Card B' });
	cardC = createCard(db, { name: 'Card C' });
	cardD = createCard(db, { name: 'Card D' });
	cardE = createCard(db, { name: 'Card E' });
	cardF = createCard(db, { name: 'Card F' });
	cardG = createCard(db, { name: 'Card G' });

	// Build graph topology: A->B, B->C, C->D, A->E, C->F, F->G
	createConnection(db, { source_id: cardA.id, target_id: cardB.id });
	createConnection(db, { source_id: cardB.id, target_id: cardC.id });
	createConnection(db, { source_id: cardC.id, target_id: cardD.id });
	createConnection(db, { source_id: cardA.id, target_id: cardE.id });
	createConnection(db, { source_id: cardC.id, target_id: cardF.id });
	createConnection(db, { source_id: cardF.id, target_id: cardG.id });

	// Soft-delete G
	deleteCard(db, cardG.id);
});

afterEach(() => {
	db.close();
});

// ---------------------------------------------------------------------------
// connectedCards() — Depth-limited traversal
// ---------------------------------------------------------------------------

describe('connectedCards: depth-limited traversal', () => {
	it('maxDepth=1 returns only direct neighbors B and E from A', () => {
		const result = connectedCards(db, cardA.id, 1);
		const ids = result.map((r) => r.card.id).sort();
		expect(ids).toHaveLength(2);
		expect(ids).toContain(cardB.id);
		expect(ids).toContain(cardE.id);
	});

	it('maxDepth=2 returns B, E, C (2 hops from A)', () => {
		const result = connectedCards(db, cardA.id, 2);
		const ids = result.map((r) => r.card.id).sort();
		expect(ids).toHaveLength(3);
		expect(ids).toContain(cardB.id);
		expect(ids).toContain(cardE.id);
		expect(ids).toContain(cardC.id);
	});

	it('maxDepth=3 returns B, E, C, D, F (3 hops, excluding soft-deleted G)', () => {
		const result = connectedCards(db, cardA.id, 3);
		const ids = result.map((r) => r.card.id).sort();
		expect(ids).toHaveLength(5);
		expect(ids).toContain(cardB.id);
		expect(ids).toContain(cardE.id);
		expect(ids).toContain(cardC.id);
		expect(ids).toContain(cardD.id);
		expect(ids).toContain(cardF.id);
	});

	it('maxDepth=0 returns empty array (no traversal)', () => {
		const result = connectedCards(db, cardA.id, 0);
		expect(result).toHaveLength(0);
	});

	it('does NOT include A itself (start card excluded)', () => {
		const result = connectedCards(db, cardA.id, 3);
		const ids = result.map((r) => r.card.id);
		expect(ids).not.toContain(cardA.id);
	});

	it('does NOT include soft-deleted G', () => {
		const result = connectedCards(db, cardA.id, 4);
		const ids = result.map((r) => r.card.id);
		expect(ids).not.toContain(cardG.id);
	});

	it('returns correct depth property for each card (B=1, E=1, C=2)', () => {
		const result = connectedCards(db, cardA.id, 2);
		const byId: Record<string, number> = {};
		result.forEach((r) => {
			byId[r.card.id] = r.depth;
		});
		expect(byId[cardB.id]).toBe(1);
		expect(byId[cardE.id]).toBe(1);
		expect(byId[cardC.id]).toBe(2);
	});

	it('returns correct depth=3 for D and F', () => {
		const result = connectedCards(db, cardA.id, 3);
		const byId: Record<string, number> = {};
		result.forEach((r) => {
			byId[r.card.id] = r.depth;
		});
		expect(byId[cardD.id]).toBe(3);
		expect(byId[cardF.id]).toBe(3);
	});

	it('returns empty array for a card with no connections', () => {
		const isolated = createCard(db, { name: 'Isolated' });
		const result = connectedCards(db, isolated.id, 3);
		expect(result).toHaveLength(0);
	});

	it('defaults to maxDepth=3 when not specified', () => {
		const result = connectedCards(db, cardA.id);
		const ids = result.map((r) => r.card.id);
		// Should include B, E (depth 1), C (depth 2), D, F (depth 3) — 5 cards
		expect(ids).toHaveLength(5);
	});
});

// ---------------------------------------------------------------------------
// connectedCards() — Bidirectional traversal
// ---------------------------------------------------------------------------

describe('connectedCards: bidirectional traversal', () => {
	it('connectedCards(C, maxDepth=1) returns B, D, F (follows edges both ways)', () => {
		const result = connectedCards(db, cardC.id, 1);
		const ids = result.map((r) => r.card.id).sort();
		expect(ids).toHaveLength(3);
		expect(ids).toContain(cardB.id);
		expect(ids).toContain(cardD.id);
		expect(ids).toContain(cardF.id);
	});

	it('connectedCards(D, maxDepth=2) returns C, B, F (traverses backward through graph)', () => {
		const result = connectedCards(db, cardD.id, 2);
		const ids = result.map((r) => r.card.id).sort();
		expect(ids).toHaveLength(3);
		expect(ids).toContain(cardC.id);
		expect(ids).toContain(cardB.id);
		expect(ids).toContain(cardF.id);
	});
});

// ---------------------------------------------------------------------------
// connectedCards() — Cycle prevention
// ---------------------------------------------------------------------------

describe('connectedCards: cycle prevention', () => {
	it('cycle A->B->C->A returns B, C exactly once (no infinite loop, no duplicates)', () => {
		// Create a new isolated cycle: X->Y->Z->X
		const cardX = createCard(db, { name: 'X' });
		const cardY = createCard(db, { name: 'Y' });
		const cardZ = createCard(db, { name: 'Z' });
		createConnection(db, { source_id: cardX.id, target_id: cardY.id });
		createConnection(db, { source_id: cardY.id, target_id: cardZ.id });
		createConnection(db, { source_id: cardZ.id, target_id: cardX.id });

		const result = connectedCards(db, cardX.id, 5);
		const ids = result.map((r) => r.card.id);
		// Should return Y and Z exactly once (X is excluded as start card)
		expect(ids).toHaveLength(2);
		expect(ids).toContain(cardY.id);
		expect(ids).toContain(cardZ.id);
		// No duplicates
		expect(new Set(ids).size).toBe(ids.length);
	});

	it('fully connected triangle returns each card exactly once', () => {
		const p = createCard(db, { name: 'P' });
		const q = createCard(db, { name: 'Q' });
		const r = createCard(db, { name: 'R' });
		createConnection(db, { source_id: p.id, target_id: q.id });
		createConnection(db, { source_id: q.id, target_id: r.id });
		createConnection(db, { source_id: r.id, target_id: p.id });

		const result = connectedCards(db, p.id, 3);
		const ids = result.map((r2) => r2.card.id);
		expect(ids).toHaveLength(2); // Q and R (P excluded as start card)
		expect(new Set(ids).size).toBe(ids.length);
	});
});

// ---------------------------------------------------------------------------
// shortestPath()
// ---------------------------------------------------------------------------

describe('shortestPath', () => {
	it('shortestPath(A, D) returns [A, B, C, D]', () => {
		const path = shortestPath(db, cardA.id, cardD.id);
		expect(path).not.toBeNull();
		expect(path).toEqual([cardA.id, cardB.id, cardC.id, cardD.id]);
	});

	it('shortestPath(A, E) returns [A, E] (direct connection)', () => {
		const path = shortestPath(db, cardA.id, cardE.id);
		expect(path).not.toBeNull();
		expect(path).toEqual([cardA.id, cardE.id]);
	});

	it('shortestPath(A, A) returns empty array (same card)', () => {
		const path = shortestPath(db, cardA.id, cardA.id);
		expect(path).toEqual([]);
	});

	it('shortestPath(A, nonexistent) returns null (no path to non-existent card)', () => {
		const path = shortestPath(db, cardA.id, 'nonexistent-id');
		expect(path).toBeNull();
	});

	it('shortestPath between two disconnected components returns null', () => {
		const isolated = createCard(db, { name: 'Isolated Island' });
		const path = shortestPath(db, cardA.id, isolated.id);
		expect(path).toBeNull();
	});
});
