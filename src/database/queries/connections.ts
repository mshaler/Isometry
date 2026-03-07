// Isometry v5 — Connection CRUD Operations
// Implements CONN-01 through CONN-05.
//
// Pattern: Pass Database instance to every function (no module-level state).
// Use db.run() for mutations (INSERT/UPDATE/DELETE) and db.exec() for SELECT.
// CONN-05 cascade behavior is enforced by schema ON DELETE CASCADE / SET NULL.

import type { Database } from '../Database';
import { execRowsToConnections } from './helpers';
import type { Connection, ConnectionDirection, ConnectionInput } from './types';

// ---------------------------------------------------------------------------
// CONN-01: Create a connection between two cards
// ---------------------------------------------------------------------------

/**
 * Insert a new connection with a generated UUID. Returns the full Connection object.
 *
 * FK constraints on source_id and target_id will throw if the referenced cards
 * do not exist (FOREIGN KEY constraint violation). via_card_id is optional and
 * defaults to null when not provided.
 *
 * The UNIQUE constraint (source_id, target_id, via_card_id, label) prevents
 * duplicate edges with the same combination.
 */
export function createConnection(db: Database, input: ConnectionInput): Connection {
	const id = crypto.randomUUID();

	db.run(
		`INSERT INTO connections (id, source_id, target_id, via_card_id, label, weight)
     VALUES (?, ?, ?, ?, ?, ?)`,
		[id, input.source_id, input.target_id, input.via_card_id ?? null, input.label ?? null, input.weight ?? 1.0],
	);

	const result = db.exec('SELECT * FROM connections WHERE id = ?', [id]);
	if (!result[0]?.values[0]) {
		throw new Error(`createConnection: insert failed for id ${id}`);
	}
	return execRowsToConnections(result)[0]!;
}

// ---------------------------------------------------------------------------
// CONN-02: Retrieve connections by direction
// ---------------------------------------------------------------------------

/**
 * Return connections for a given card filtered by direction.
 *
 * - 'outgoing': connections where cardId is source_id
 * - 'incoming': connections where cardId is target_id
 * - 'bidirectional' (default): connections where cardId is source OR target
 *
 * Results are ordered by created_at DESC.
 */
export function getConnections(
	db: Database,
	cardId: string,
	direction: ConnectionDirection = 'bidirectional',
): Connection[] {
	let sql: string;
	let params: unknown[];

	switch (direction) {
		case 'outgoing':
			sql = 'SELECT * FROM connections WHERE source_id = ? ORDER BY created_at DESC';
			params = [cardId];
			break;
		case 'incoming':
			sql = 'SELECT * FROM connections WHERE target_id = ? ORDER BY created_at DESC';
			params = [cardId];
			break;
		case 'bidirectional':
		default:
			sql = 'SELECT * FROM connections WHERE source_id = ? OR target_id = ? ORDER BY created_at DESC';
			params = [cardId, cardId];
			break;
	}

	return execRowsToConnections(db.exec(sql, params as import('sql.js').BindParams));
}

// ---------------------------------------------------------------------------
// CONN-04: Delete a connection (hard delete)
// ---------------------------------------------------------------------------

/**
 * Hard-delete a connection by ID. Idempotent — does not throw if the connection
 * does not exist.
 *
 * Note: CONN-05 cascade behavior (deleting a card removes its connections) is
 * implemented by the schema's ON DELETE CASCADE on source_id and target_id,
 * and ON DELETE SET NULL on via_card_id. No additional API function is needed.
 */
export function deleteConnection(db: Database, id: string): void {
	db.run('DELETE FROM connections WHERE id = ?', [id]);
}
