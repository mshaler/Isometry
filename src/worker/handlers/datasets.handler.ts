// Isometry v5 — Phase 88
// Handlers for datasets:query, datasets:stats, and datasets:vacuum Worker message types.

import type { Database } from '../../database/Database';
import type { WorkerResponses } from '../protocol';

/**
 * Return all rows from the datasets registry, ordered by most recently imported.
 */
export function handleDatasetsQuery(db: Database): WorkerResponses['datasets:query'] {
	return db
		.prepare<WorkerResponses['datasets:query'][number]>(
			`SELECT id, name, source_type, card_count, connection_count,
            file_size_bytes, filename, is_active, created_at, last_imported_at
     FROM datasets
     ORDER BY last_imported_at DESC`,
		)
		.all();
}

/**
 * Return aggregate card count, connection count, and database file size.
 */
export function handleDatasetsStats(db: Database): WorkerResponses['datasets:stats'] {
	const cardRow = db.prepare<{ cnt: number }>('SELECT COUNT(*) as cnt FROM cards WHERE deleted_at IS NULL').all();
	const connRow = db.prepare<{ cnt: number }>('SELECT COUNT(*) as cnt FROM connections').all();
	// page_count * page_size gives total DB file size in bytes
	const sizeRow = db
		.prepare<{ size: number }>('SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size()')
		.all();

	return {
		card_count: cardRow[0]?.cnt ?? 0,
		connection_count: connRow[0]?.cnt ?? 0,
		db_size_bytes: sizeRow[0]?.size ?? 0,
	};
}

/**
 * Run VACUUM and REINDEX to compact and optimize the database.
 */
export function handleDatasetsVacuum(db: Database): WorkerResponses['datasets:vacuum'] {
	db.exec('VACUUM');
	db.exec('REINDEX');
	return { success: true };
}

/**
 * Delete all cards belonging to a dataset, their cross-boundary connections,
 * and the dataset registry row. Hard delete — no undo.
 *
 * Phase 125 (DSET-02): Uses dataset_id column on cards for per-dataset scoping.
 */
export function handleDatasetsDelete(
	db: Database,
	payload: { datasetId: string },
): WorkerResponses['datasets:delete'] {
	// Verify dataset exists
	const datasetRows = db.prepare<{ id: string }>('SELECT id FROM datasets WHERE id = ?').all(payload.datasetId);
	if (datasetRows.length === 0) {
		return { deleted_cards: 0, deleted_connections: 0 };
	}

	// Collect card IDs belonging to this dataset
	const cardRows = db
		.prepare<{ id: string }>('SELECT id FROM cards WHERE dataset_id = ? AND deleted_at IS NULL')
		.all(payload.datasetId);
	const cardIds = cardRows.map((r) => r.id);

	if (cardIds.length === 0) {
		// No cards — just delete dataset registry row
		db.prepare<never>('DELETE FROM datasets WHERE id = ?').run(payload.datasetId);
		return { deleted_cards: 0, deleted_connections: 0 };
	}

	// Count connections where either endpoint belongs to this dataset
	// connections table uses source_id and target_id (FK to cards.id)
	const placeholders = cardIds.map(() => '?').join(',');
	const connCountRows = db
		.prepare<{ cnt: number }>(
			`SELECT COUNT(*) as cnt FROM connections
			 WHERE source_id IN (${placeholders}) OR target_id IN (${placeholders})`,
		)
		.all(...cardIds, ...cardIds);
	const deletedConnections = connCountRows[0]?.cnt ?? 0;

	// Delete connections referencing any of these cards
	db.run(
		`DELETE FROM connections WHERE source_id IN (${placeholders}) OR target_id IN (${placeholders})`,
		[...cardIds, ...cardIds],
	);

	// Hard-delete cards belonging to this dataset
	db.run('DELETE FROM cards WHERE dataset_id = ?', [payload.datasetId]);

	// Delete dataset registry row
	db.prepare<never>('DELETE FROM datasets WHERE id = ?').run(payload.datasetId);

	return { deleted_cards: cardIds.length, deleted_connections: deletedConnections };
}

/**
 * Return the 8 most recently created non-deleted cards for notebook verification.
 * Each row includes id, name, source, and created_at for display and selection.
 */
export function handleDatasetsRecentCards(db: Database): WorkerResponses['datasets:recent-cards'] {
	return db
		.prepare<WorkerResponses['datasets:recent-cards'][number]>(
			`SELECT id, name, source, created_at
           FROM cards
           WHERE deleted_at IS NULL
           ORDER BY created_at DESC
           LIMIT 8`,
		)
		.all();
}
