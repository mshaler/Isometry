// Isometry v5 — Phase 88 + Phase 125
// Handlers for datasets:query, datasets:stats, datasets:vacuum, datasets:delete,
// datasets:reimport, and datasets:commit-reimport Worker message types.

import type { Database } from '../../database/Database';
import { CatalogWriter } from '../../etl/CatalogWriter';
import { DedupEngine, type DedupResult } from '../../etl/DedupEngine';
import { SQLiteWriter } from '../../etl/SQLiteWriter';
import type { CanonicalCard, ImportResult } from '../../etl/types';
import type { WorkerResponses } from '../protocol';
import { getSourceName } from './etl-import-native.handler';

/**
 * Return all rows from the datasets registry, ordered by most recently imported.
 */
export function handleDatasetsQuery(db: Database): WorkerResponses['datasets:query'] {
	return db
		.prepare<WorkerResponses['datasets:query'][number]>(
			`SELECT id, name, source_type, card_count, connection_count,
            file_size_bytes, filename, is_active, created_at, last_imported_at,
            directory_path
     FROM datasets
     ORDER BY last_imported_at DESC`,
		)
		.all();
}

/**
 * Return aggregate card count, connection count, and database file size.
 * Phase 169: also returns last_import_at from import_runs MAX(completed_at).
 */
export function handleDatasetsStats(db: Database): WorkerResponses['datasets:stats'] {
	const cardRow = db.prepare<{ cnt: number }>('SELECT COUNT(*) as cnt FROM cards WHERE deleted_at IS NULL').all();
	const connRow = db.prepare<{ cnt: number }>('SELECT COUNT(*) as cnt FROM connections').all();
	// page_count * page_size gives total DB file size in bytes
	const sizeRow = db
		.prepare<{ size: number }>('SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size()')
		.all();
	// Phase 169 (STAT-03): last completed import timestamp from import_runs
	const importRow = db.prepare<{ last_import: string | null }>('SELECT MAX(completed_at) as last_import FROM import_runs').all();

	return {
		card_count: cardRow[0]?.cnt ?? 0,
		connection_count: connRow[0]?.cnt ?? 0,
		db_size_bytes: sizeRow[0]?.size ?? 0,
		last_import_at: importRow[0]?.last_import ?? null,
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
export function handleDatasetsDelete(db: Database, payload: { datasetId: string }): WorkerResponses['datasets:delete'] {
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
	db.run(`DELETE FROM connections WHERE source_id IN (${placeholders}) OR target_id IN (${placeholders})`, [
		...cardIds,
		...cardIds,
	]);

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

// ---------------------------------------------------------------------------
// Phase 125 DSET-03/04: Two-phase re-import pipeline
// ---------------------------------------------------------------------------

/**
 * Module-level cache for pending reimport DedupResult.
 * Cleared on new reimport start or after commit/cancel.
 */
let pendingReimport: {
	datasetId: string;
	dedupResult: DedupResult;
	sourceType: string;
	directoryPath: string | null;
} | null = null;

/**
 * Phase 1 of two-phase re-import: parse+dedup without writing to DB.
 * Caches the DedupResult for the commit phase.
 * Returns a serializable summary of changes for UI display.
 */
export function handleDatasetsReimport(
	db: Database,
	payload: { datasetId: string; cards: CanonicalCard[] },
): WorkerResponses['datasets:reimport'] {
	// Concurrency guard: if a reimport is already pending (e.g., rapid double-click),
	// clear it with a warning before starting a new one
	if (pendingReimport !== null) {
		console.warn('[datasets] Overwriting pending reimport for dataset', pendingReimport.datasetId);
		pendingReimport = null;
	}

	// Look up dataset to get source_type and directory_path
	const dataset = db
		.prepare<{ source_type: string; directory_path: string | null; name: string }>(
			'SELECT source_type, directory_path, name FROM datasets WHERE id = ?',
		)
		.all(payload.datasetId);
	if (dataset.length === 0) {
		return { toInsert: [], toUpdate: [], deletedIds: [], deletedNames: [], unchanged: 0 };
	}

	const { source_type, directory_path } = dataset[0]!;

	// Determine dedup source (same normalization as import)
	const dedupSource = source_type.startsWith('alto_index_') ? 'alto_index' : source_type;

	// Run dedup without writing
	const dedup = new DedupEngine(db);
	const dedupResult = dedup.process(payload.cards, [], dedupSource);

	// Cache for commit phase
	pendingReimport = {
		datasetId: payload.datasetId,
		dedupResult,
		sourceType: source_type,
		directoryPath: directory_path,
	};

	// Look up names for deleted cards
	const deletedNames: string[] = [];
	for (const id of dedupResult.deletedIds) {
		const row = db.prepare<{ name: string }>('SELECT name FROM cards WHERE id = ?').all(id);
		if (row.length > 0 && row[0]) deletedNames.push(row[0].name);
	}

	return {
		toInsert: dedupResult.toInsert.map((c) => ({ id: c.id, name: c.name })),
		toUpdate: dedupResult.toUpdate.map((c) => ({ id: c.id, name: c.name })),
		deletedIds: dedupResult.deletedIds,
		deletedNames,
		unchanged: dedupResult.toSkip.length,
	};
}

/**
 * Phase 2 of two-phase re-import: apply the cached DedupResult to the database.
 * Handles inserts, updates, soft-deletes, connection cleanup, and catalog recording.
 */
export async function handleDatasetsCommitReimport(
	db: Database,
	payload: { datasetId: string },
): Promise<WorkerResponses['datasets:commit-reimport']> {
	if (!pendingReimport || pendingReimport.datasetId !== payload.datasetId) {
		return {
			inserted: 0,
			updated: 0,
			unchanged: 0,
			skipped: 0,
			errors: 0,
			connections_created: 0,
			insertedIds: [],
			updatedIds: [],
			deletedIds: [],
			errors_detail: [],
		};
	}

	const { dedupResult, sourceType, directoryPath } = pendingReimport;
	const startTime = new Date().toISOString();

	// Write phase — same as etl-import-native handler
	const writer = new SQLiteWriter(db);
	const totalCards = dedupResult.toInsert.length + dedupResult.toUpdate.length;
	const isBulkImport = totalCards > 500;

	// Write inserts and updates
	await writer.writeCards(dedupResult.toInsert, isBulkImport);
	await writer.updateCards(dedupResult.toUpdate);
	await writer.writeConnections(dedupResult.connections);

	// Handle deletions — soft delete cards that were removed from source
	for (const id of dedupResult.deletedIds) {
		db.prepare<never>("UPDATE cards SET deleted_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = ?").run(id);
	}
	// Also clean up connections referencing deleted cards
	if (dedupResult.deletedIds.length > 0) {
		const ph = dedupResult.deletedIds.map(() => '?').join(',');
		db.run(`DELETE FROM connections WHERE source_id IN (${ph}) OR target_id IN (${ph})`, [
			...dedupResult.deletedIds,
			...dedupResult.deletedIds,
		]);
	}

	// Stamp dataset_id on newly inserted cards
	for (const card of dedupResult.toInsert) {
		db.prepare<never>('UPDATE cards SET dataset_id = ? WHERE id = ?').run(payload.datasetId, card.id);
	}

	// FTS optimize for incremental imports (>100 inserts, non-bulk path)
	if (!isBulkImport && dedupResult.toInsert.length > 100) {
		writer.optimizeFTS();
	}

	const result: ImportResult = {
		inserted: dedupResult.toInsert.length,
		updated: dedupResult.toUpdate.length,
		unchanged: dedupResult.toSkip.length,
		skipped: 0,
		errors: 0,
		connections_created: dedupResult.connections.length,
		insertedIds: dedupResult.toInsert.map((c) => c.id),
		updatedIds: dedupResult.toUpdate.map((c) => c.id),
		deletedIds: dedupResult.deletedIds,
		errors_detail: [],
	};

	// Record in catalog
	const catalog = new CatalogWriter(db);
	const sourceName = getSourceName(sourceType);
	catalog.recordImportRun({
		source: sourceType,
		sourceName,
		started_at: startTime,
		completed_at: new Date().toISOString(),
		result,
		...(directoryPath !== null ? { directoryPath } : {}),
	});

	// Clear cache
	pendingReimport = null;

	return result;
}
