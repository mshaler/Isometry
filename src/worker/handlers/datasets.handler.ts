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
