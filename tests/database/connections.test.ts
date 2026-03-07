// Isometry v5 — Connection CRUD TDD Tests
// Covers CONN-01 through CONN-05.
//
// Setup: Fresh Database per test group via beforeEach/afterEach.
// Three test cards (cardA, cardB, cardC) are created in beforeEach.
// Connections require valid FK references to existing cards.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Database } from '../../src/database/Database';
import { createCard } from '../../src/database/queries/cards';
import { createConnection, deleteConnection, getConnections } from '../../src/database/queries/connections';
import type { Card } from '../../src/database/queries/types';

// ---------------------------------------------------------------------------
// Shared setup helpers
// ---------------------------------------------------------------------------

let db: Database;
let cardA: Card;
let cardB: Card;
let cardC: Card;

beforeEach(async () => {
	db = new Database();
	await db.initialize();

	cardA = createCard(db, { name: 'Card A' });
	cardB = createCard(db, { name: 'Card B' });
	cardC = createCard(db, { name: 'Card C' });
});

afterEach(() => {
	db.close();
});

// ---------------------------------------------------------------------------
// CONN-01: Create a connection between two cards
// ---------------------------------------------------------------------------

describe('CONN-01: createConnection', () => {
	it('returns a Connection with a generated UUID', () => {
		const conn = createConnection(db, {
			source_id: cardA.id,
			target_id: cardB.id,
		});
		expect(conn.id).toBeDefined();
		expect(conn.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
	});

	it('throws FK constraint violation on invalid source_id', () => {
		expect(() =>
			createConnection(db, {
				source_id: 'nonexistent-card-id',
				target_id: cardB.id,
			}),
		).toThrow();
	});

	it('throws FK constraint violation on invalid target_id', () => {
		expect(() =>
			createConnection(db, {
				source_id: cardA.id,
				target_id: 'nonexistent-card-id',
			}),
		).toThrow();
	});

	it('stores label when provided', () => {
		const conn = createConnection(db, {
			source_id: cardA.id,
			target_id: cardB.id,
			label: 'mentions',
		});
		expect(conn.label).toBe('mentions');
	});

	it('defaults label to null when not provided', () => {
		const conn = createConnection(db, {
			source_id: cardA.id,
			target_id: cardB.id,
		});
		expect(conn.label).toBeNull();
	});

	it('stores weight when provided', () => {
		const conn = createConnection(db, {
			source_id: cardA.id,
			target_id: cardB.id,
			weight: 0.5,
		});
		expect(conn.weight).toBe(0.5);
	});

	it('defaults weight to 1.0 when not provided', () => {
		const conn = createConnection(db, {
			source_id: cardA.id,
			target_id: cardB.id,
		});
		expect(conn.weight).toBe(1.0);
	});

	it('throws UNIQUE constraint violation on duplicate (same source, target, non-null via_card_id, same label)', () => {
		// SQLite treats NULLs as distinct in UNIQUE constraints (SQL standard).
		// See STATE.md decision [01-03]: "UNIQUE constraint test uses non-NULL via_card_id".
		// Use a non-NULL via_card_id to make the UNIQUE constraint trigger reliably.
		// When via_card_id=NULL, SQLite considers each NULL distinct (ISO SQL behavior).
		createConnection(db, {
			source_id: cardA.id,
			target_id: cardB.id,
			via_card_id: cardC.id,
			label: 'duplicate-label',
		});
		expect(() =>
			createConnection(db, {
				source_id: cardA.id,
				target_id: cardB.id,
				via_card_id: cardC.id,
				label: 'duplicate-label',
			}),
		).toThrow();
	});
});

// ---------------------------------------------------------------------------
// CONN-02: Retrieve connections by direction
// ---------------------------------------------------------------------------

describe('CONN-02: getConnections by direction', () => {
	it("returns only outgoing connections when direction='outgoing'", () => {
		const outgoing = createConnection(db, {
			source_id: cardA.id,
			target_id: cardB.id,
			label: 'outgoing-edge',
		});
		// incoming connection for cardA
		createConnection(db, {
			source_id: cardB.id,
			target_id: cardA.id,
			label: 'incoming-edge',
		});

		const result = getConnections(db, cardA.id, 'outgoing');
		expect(result).toHaveLength(1);
		expect(result[0]!.id).toBe(outgoing.id);
		expect(result[0]!.source_id).toBe(cardA.id);
	});

	it("returns only incoming connections when direction='incoming'", () => {
		// outgoing from cardA
		createConnection(db, {
			source_id: cardA.id,
			target_id: cardB.id,
			label: 'outgoing-edge',
		});
		// incoming to cardA
		const incoming = createConnection(db, {
			source_id: cardB.id,
			target_id: cardA.id,
			label: 'incoming-edge',
		});

		const result = getConnections(db, cardA.id, 'incoming');
		expect(result).toHaveLength(1);
		expect(result[0]!.id).toBe(incoming.id);
		expect(result[0]!.target_id).toBe(cardA.id);
	});

	it("returns both outgoing and incoming when direction='bidirectional'", () => {
		createConnection(db, {
			source_id: cardA.id,
			target_id: cardB.id,
			label: 'outgoing-edge',
		});
		createConnection(db, {
			source_id: cardB.id,
			target_id: cardA.id,
			label: 'incoming-edge',
		});

		const result = getConnections(db, cardA.id, 'bidirectional');
		expect(result).toHaveLength(2);
	});

	it("defaults to 'bidirectional' when direction not specified", () => {
		createConnection(db, {
			source_id: cardA.id,
			target_id: cardB.id,
			label: 'outgoing-edge',
		});
		createConnection(db, {
			source_id: cardB.id,
			target_id: cardA.id,
			label: 'incoming-edge',
		});

		const result = getConnections(db, cardA.id);
		expect(result).toHaveLength(2);
	});

	it('returns empty array for a card with no connections', () => {
		// cardC has no connections
		const result = getConnections(db, cardC.id);
		expect(result).toEqual([]);
	});

	it('returns connections ordered by created_at DESC', async () => {
		// Insert connections with a small delay to ensure distinct timestamps
		const first = createConnection(db, {
			source_id: cardA.id,
			target_id: cardB.id,
			label: 'first',
		});
		// Advance the timestamp by directly updating created_at for ordering verification
		db.run(`UPDATE connections SET created_at = '2020-01-01T00:00:00Z' WHERE id = ?`, [first.id]);

		const second = createConnection(db, {
			source_id: cardA.id,
			target_id: cardC.id,
			label: 'second',
		});
		db.run(`UPDATE connections SET created_at = '2020-01-02T00:00:00Z' WHERE id = ?`, [second.id]);

		const result = getConnections(db, cardA.id, 'outgoing');
		expect(result).toHaveLength(2);
		// DESC order: second (Jan 2) before first (Jan 1)
		expect(result[0]!.id).toBe(second.id);
		expect(result[1]!.id).toBe(first.id);
	});
});

// ---------------------------------------------------------------------------
// CONN-03: Create connection with via_card_id
// ---------------------------------------------------------------------------

describe('CONN-03: createConnection with via_card_id', () => {
	it('stores via_card_id (bridge card reference)', () => {
		const conn = createConnection(db, {
			source_id: cardA.id,
			target_id: cardB.id,
			via_card_id: cardC.id,
			label: 'via-bridge',
		});
		expect(conn.via_card_id).toBe(cardC.id);
	});

	it('throws FK constraint violation on invalid via_card_id', () => {
		expect(() =>
			createConnection(db, {
				source_id: cardA.id,
				target_id: cardB.id,
				via_card_id: 'nonexistent-via-id',
			}),
		).toThrow();
	});

	it('same source/target/label with different via_card_id creates distinct connections', () => {
		// Create a 4th card to use as second via
		const cardD = createCard(db, { name: 'Card D' });

		createConnection(db, {
			source_id: cardA.id,
			target_id: cardB.id,
			via_card_id: cardC.id,
			label: 'same-label',
		});

		// Different via_card_id — should succeed (UNIQUE includes via_card_id)
		const second = createConnection(db, {
			source_id: cardA.id,
			target_id: cardB.id,
			via_card_id: cardD.id,
			label: 'same-label',
		});

		expect(second.via_card_id).toBe(cardD.id);
	});
});

// ---------------------------------------------------------------------------
// CONN-04: Delete a connection
// ---------------------------------------------------------------------------

describe('CONN-04: deleteConnection', () => {
	it('removes the connection (getConnections no longer includes it)', () => {
		const conn = createConnection(db, {
			source_id: cardA.id,
			target_id: cardB.id,
		});

		deleteConnection(db, conn.id);

		const remaining = getConnections(db, cardA.id);
		expect(remaining).toHaveLength(0);
	});

	it('does not throw when deleting a non-existent connection (idempotent)', () => {
		expect(() => deleteConnection(db, 'nonexistent-connection-id')).not.toThrow();
	});

	it('source and target cards still exist after deleteConnection', () => {
		const conn = createConnection(db, {
			source_id: cardA.id,
			target_id: cardB.id,
		});

		deleteConnection(db, conn.id);

		// Verify cards still exist by checking connections table and directly
		const result = db.exec('SELECT id FROM cards WHERE id = ?', [cardA.id]);
		expect(result[0]?.values).toHaveLength(1);
		const resultB = db.exec('SELECT id FROM cards WHERE id = ?', [cardB.id]);
		expect(resultB[0]?.values).toHaveLength(1);
	});
});

// ---------------------------------------------------------------------------
// CONN-05: Cascade delete when card is hard-deleted
// ---------------------------------------------------------------------------

describe('CONN-05: Cascade delete on card hard-delete', () => {
	it('hard-deleting source card removes all connections where card is source', () => {
		createConnection(db, {
			source_id: cardA.id,
			target_id: cardB.id,
			label: 'source-conn-1',
		});
		createConnection(db, {
			source_id: cardA.id,
			target_id: cardC.id,
			label: 'source-conn-2',
		});

		// Hard delete cardA (raw SQL — not the soft-delete API)
		db.run('DELETE FROM cards WHERE id = ?', [cardA.id]);

		// All connections with cardA as source should be gone (ON DELETE CASCADE)
		const result = db.exec('SELECT * FROM connections WHERE source_id = ?', [cardA.id]);
		expect(result).toHaveLength(0);
	});

	it('hard-deleting target card removes all connections where card is target', () => {
		createConnection(db, {
			source_id: cardA.id,
			target_id: cardC.id,
			label: 'target-conn',
		});
		createConnection(db, {
			source_id: cardB.id,
			target_id: cardC.id,
			label: 'target-conn-2',
		});

		// Hard delete cardC (the target)
		db.run('DELETE FROM cards WHERE id = ?', [cardC.id]);

		// All connections with cardC as target should be gone (ON DELETE CASCADE)
		const result = db.exec('SELECT * FROM connections WHERE target_id = ?', [cardC.id]);
		expect(result).toHaveLength(0);
	});

	it('hard-deleting via_card sets via_card_id to NULL (ON DELETE SET NULL), connection survives', () => {
		const conn = createConnection(db, {
			source_id: cardA.id,
			target_id: cardB.id,
			via_card_id: cardC.id,
			label: 'via-bridge',
		});

		// Hard delete cardC (the via_card)
		db.run('DELETE FROM cards WHERE id = ?', [cardC.id]);

		// Connection should still exist but via_card_id should be NULL
		const result = db.exec('SELECT * FROM connections WHERE id = ?', [conn.id]);
		expect(result[0]?.values).toHaveLength(1);

		const row = result[0]!.values[0]!;
		const colIdx = result[0]!.columns.indexOf('via_card_id');
		expect(row[colIdx]).toBeNull();
	});
});
