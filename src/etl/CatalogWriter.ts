// Isometry v5 — Phase 8 CatalogWriter
// Records import provenance in Data Catalog tables.

import type { Database } from '../database/Database';
import type { ImportResult } from './types';

export interface ImportRunRecord {
	source: string;
	sourceName: string;
	filename?: string;
	started_at: string;
	completed_at: string;
	result: ImportResult;
	directoryPath?: string; // Phase 125: stored path for re-import without re-picking
}

export interface DatasetRow {
	id: string;
	name: string;
	source_type: string;
	card_count: number;
	connection_count: number;
	file_size_bytes: number | null;
	filename: string | null;
	import_run_id: string | null;
	source_id: string | null;
	is_active: number;
	created_at: string;
	last_imported_at: string;
}

/**
 * CatalogWriter manages import provenance tracking.
 */
export class CatalogWriter {
	constructor(private db: Database) {}

	/**
	 * Record an import run in the catalog.
	 * Creates source if not exists, then creates run record.
	 * Also auto-upserts the datasets registry row (DEXP-02).
	 *
	 * @param record - Import run metadata and results
	 * @returns The import run ID
	 */
	recordImportRun(record: ImportRunRecord): string {
		// Upsert import_sources
		const sourceId = this.upsertSource(record.source, record.sourceName);

		// Create import_runs row
		const runId = crypto.randomUUID();

		this.db
			.prepare<never>(
				`INSERT INTO import_runs (
        id, source_id, filename, started_at, completed_at,
        cards_inserted, cards_updated, cards_unchanged, cards_skipped,
        connections_created, errors_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			)
			.run(
				runId,
				sourceId,
				record.filename ?? null,
				record.started_at,
				record.completed_at,
				record.result.inserted,
				record.result.updated,
				record.result.unchanged,
				record.result.skipped,
				record.result.connections_created,
				JSON.stringify(record.result.errors_detail),
			);

		// Auto-populate datasets registry (DEXP-02)
		this.upsertDataset({
			name: record.sourceName,
			sourceType: record.source,
			...(record.filename !== undefined ? { filename: record.filename } : {}),
			importRunId: runId,
			sourceId: sourceId,
			...(record.directoryPath !== undefined ? { directoryPath: record.directoryPath } : {}),
		});

		return runId;
	}

	/**
	 * Upsert a dataset row in the datasets registry.
	 * Deactivates all other rows and sets this one as active.
	 *
	 * @returns The dataset ID (existing or newly created)
	 */
	upsertDataset(opts: {
		name: string;
		sourceType: string;
		filename?: string;
		fileSizeBytes?: number;
		importRunId: string;
		sourceId: string;
		directoryPath?: string; // Phase 125: stored path for re-import without re-picking
	}): string {
		// Deactivate all other datasets first
		this.db.prepare<never>('UPDATE datasets SET is_active = 0 WHERE is_active = 1').run();

		// Upsert by (name, source_type)
		const existing = this.db
			.prepare<{ id: string }>('SELECT id FROM datasets WHERE name = ? AND source_type = ?')
			.all(opts.name, opts.sourceType);

		// Per-dataset scoped counts (DSET-01): count only cards belonging to this dataset,
		// not all cards globally. Uses dataset_id column added in Phase 125.
		let cardCount = 0;
		let connCount = 0;
		if (existing.length > 0 && existing[0]) {
			const dsId = existing[0].id;
			cardCount =
				this.db
					.prepare<{ cnt: number }>('SELECT COUNT(*) as cnt FROM cards WHERE dataset_id = ? AND deleted_at IS NULL')
					.all(dsId)[0]?.cnt ?? 0;
			connCount =
				this.db
					.prepare<{ cnt: number }>(
						`SELECT COUNT(*) as cnt FROM connections
						 WHERE source_id IN (SELECT id FROM cards WHERE dataset_id = ?)
						    OR target_id IN (SELECT id FROM cards WHERE dataset_id = ?)`,
					)
					.all(dsId, dsId)[0]?.cnt ?? 0;
		}
		// For new datasets (no existing row), counts start at 0 and will be updated
		// after cards are written and dataset_id is stamped via etl-import-native handler.

		const datasetId = existing.length > 0 && existing[0] ? existing[0].id : crypto.randomUUID();

		this.db
			.prepare<never>(
				`INSERT INTO datasets (id, name, source_type, card_count, connection_count, file_size_bytes, filename, import_run_id, source_id, is_active, directory_path, last_imported_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
     ON CONFLICT(name, source_type) DO UPDATE SET
       card_count = excluded.card_count,
       connection_count = excluded.connection_count,
       file_size_bytes = excluded.file_size_bytes,
       filename = excluded.filename,
       import_run_id = excluded.import_run_id,
       is_active = 1,
       directory_path = COALESCE(excluded.directory_path, directory_path),
       last_imported_at = excluded.last_imported_at`,
			)
			.run(
				datasetId,
				opts.name,
				opts.sourceType,
				cardCount,
				connCount,
				opts.fileSizeBytes ?? null,
				opts.filename ?? null,
				opts.importRunId,
				opts.sourceId,
				opts.directoryPath ?? null,
			);

		return datasetId;
	}

	/**
	 * Upsert a sample dataset row in the datasets registry.
	 * Used by SampleDataManager after loading sample data.
	 *
	 * @param name - Display name for the sample dataset
	 * @returns The dataset ID
	 */
	upsertSampleDataset(name: string): string {
		// Deactivate all
		this.db.prepare<never>('UPDATE datasets SET is_active = 0 WHERE is_active = 1').run();

		const cardCount =
			this.db.prepare<{ cnt: number }>('SELECT COUNT(*) as cnt FROM cards WHERE deleted_at IS NULL').all()[0]?.cnt ?? 0;
		const connCount = this.db.prepare<{ cnt: number }>('SELECT COUNT(*) as cnt FROM connections').all()[0]?.cnt ?? 0;

		const existing = this.db
			.prepare<{ id: string }>('SELECT id FROM datasets WHERE name = ? AND source_type = ?')
			.all(name, 'sample');

		const datasetId = existing.length > 0 && existing[0] ? existing[0].id : crypto.randomUUID();

		this.db
			.prepare<never>(
				`INSERT INTO datasets (id, name, source_type, card_count, connection_count, is_active, last_imported_at)
     VALUES (?, ?, 'sample', ?, ?, 1, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
     ON CONFLICT(name, source_type) DO UPDATE SET
       card_count = excluded.card_count,
       connection_count = excluded.connection_count,
       is_active = 1,
       last_imported_at = excluded.last_imported_at`,
			)
			.run(datasetId, name, cardCount, connCount);

		return datasetId;
	}

	/**
	 * Get the ID of the currently active dataset.
	 *
	 * @returns The active dataset ID, or null if no dataset is active
	 */
	getActiveDatasetId(): string | null {
		const rows = this.db.prepare<{ id: string }>('SELECT id FROM datasets WHERE is_active = 1').all();
		return rows.length > 0 && rows[0] ? rows[0].id : null;
	}

	/**
	 * Upsert import source by source_type + name.
	 *
	 * @returns Source ID (existing or newly created)
	 */
	private upsertSource(sourceType: string, name: string): string {
		// Check if source exists
		const existing = this.db
			.prepare<{ id: string }>(`SELECT id FROM import_sources WHERE source_type = ? AND name = ?`)
			.all(sourceType, name);

		if (existing.length > 0 && existing[0]) {
			return existing[0].id;
		}

		// Create new source
		const sourceId = crypto.randomUUID();
		this.db
			.prepare<never>(`INSERT INTO import_sources (id, name, source_type) VALUES (?, ?, ?)`)
			.run(sourceId, name, sourceType);

		return sourceId;
	}

	/**
	 * Get all import runs for a source type.
	 */
	getRunsForSource(sourceType: string): Array<{
		id: string;
		filename: string | null;
		completed_at: string;
		cards_inserted: number;
		cards_updated: number;
		cards_unchanged: number;
		errors_json: string | null;
	}> {
		return this.db
			.prepare<{
				id: string;
				filename: string | null;
				completed_at: string;
				cards_inserted: number;
				cards_updated: number;
				cards_unchanged: number;
				errors_json: string | null;
			}>(
				`SELECT r.id, r.filename, r.completed_at,
              r.cards_inserted, r.cards_updated, r.cards_unchanged, r.errors_json
       FROM import_runs r
       JOIN import_sources s ON r.source_id = s.id
       WHERE s.source_type = ?
       ORDER BY r.completed_at DESC`,
			)
			.all(sourceType);
	}
}
