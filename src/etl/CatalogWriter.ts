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
}

/**
 * CatalogWriter manages import provenance tracking.
 */
export class CatalogWriter {
	constructor(private db: Database) {}

	/**
	 * Record an import run in the catalog.
	 * Creates source if not exists, then creates run record.
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

		return runId;
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
