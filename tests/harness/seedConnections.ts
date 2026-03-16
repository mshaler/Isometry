// Isometry v6.1 — Phase 79 Test Infrastructure
// seedConnections(): connection seeding helper.
//
// Design:
//   - source_id and target_id are required (FK references to cards.id)
//   - All other fields optional with sensible defaults
//   - Uses BEGIN/COMMIT batch pattern for performance
//   - Returns inserted IDs in insertion order
//
// NOTE: Column names match the connections table in schema.sql:
//   source_id, target_id, via_card_id, label, weight, created_at

import type { Database } from '../../src/database/Database';

/**
 * Partial connection object for seeding.
 * source_id and target_id are required (they reference cards.id).
 */
export interface SeedConnection {
	id?: string;
	/** Required: ID of the source card (FK → cards.id) */
	source_id: string;
	/** Required: ID of the target card (FK → cards.id) */
	target_id: string;
	/** Optional: ID of the mediating card (FK → cards.id) */
	via_card_id?: string | null;
	/** Optional: Edge label */
	label?: string | null;
	/** Optional: Edge weight (0..1), defaults to 1.0 */
	weight?: number;
	created_at?: string;
}

/**
 * Insert an array of connections into the database.
 *
 * @param db - An initialized Database instance from realDb()
 * @param connections - Array of partial connection objects (source_id and target_id required)
 * @returns Array of inserted connection IDs in insertion order
 */
export function seedConnections(db: Database, connections: SeedConnection[]): string[] {
	const now = new Date().toISOString();
	const insertedIds: string[] = [];

	db.run('BEGIN');
	for (const conn of connections) {
		const id = conn.id ?? crypto.randomUUID();
		insertedIds.push(id);
		db.run(
			`INSERT INTO connections (id, source_id, target_id, via_card_id, label, weight, created_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?)`,
			[
				id,
				conn.source_id,
				conn.target_id,
				conn.via_card_id ?? null,
				conn.label ?? null,
				conn.weight ?? 1.0,
				conn.created_at ?? now,
			],
		);
	}
	db.run('COMMIT');

	return insertedIds;
}
