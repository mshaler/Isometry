// Isometry v5 — Enrich Backfill Handler
// Retroactively populates enriched columns (folder_l1..folder_l4) on existing cards.
// Runs in batches to avoid blocking the Worker thread.

import type { Database } from '../../database/Database';
import { splitFolderPath } from '../../etl/enrichment/FolderHierarchyEnricher';

const BATCH_SIZE = 1000;

export interface BackfillResult {
	updated: number;
	skipped: number;
}

/**
 * Backfill folder_l1..folder_l4 for all cards with a non-null folder
 * that have null folder_l1 (not yet enriched).
 *
 * Uses pure SQL UPDATE with splitFolderPath logic applied in JS.
 * Processes in batches to yield to event loop.
 */
export async function handleEnrichBackfill(db: Database): Promise<BackfillResult> {
	// Find all cards with folder but no folder_l1 (not yet enriched)
	const rows = db
		.prepare<{ id: string; folder: string }>(
			`SELECT id, folder FROM cards
		 WHERE folder IS NOT NULL AND folder_l1 IS NULL AND deleted_at IS NULL`,
		)
		.all();

	if (rows.length === 0) {
		return { updated: 0, skipped: 0 };
	}

	let updated = 0;

	for (let i = 0; i < rows.length; i += BATCH_SIZE) {
		const batch = rows.slice(i, i + BATCH_SIZE);

		db.transaction(() => {
			const stmt = db.prepare<never>(
				`UPDATE cards SET folder_l1 = ?, folder_l2 = ?, folder_l3 = ?, folder_l4 = ? WHERE id = ?`,
			);

			for (const row of batch) {
				const [l1, l2, l3, l4] = splitFolderPath(row.folder);
				stmt.run(l1, l2, l3, l4, row.id);
				updated++;
			}
		})();

		// Yield to event loop between batches
		if (i + BATCH_SIZE < rows.length) {
			await new Promise((resolve) => setTimeout(resolve, 0));
		}
	}

	// Also handle cards where folder is null — set all levels to null explicitly
	// (ensures idempotency if columns were added but not populated)
	const nullFolderCount = db
		.prepare<{ cnt: number }>(
			`SELECT COUNT(*) as cnt FROM cards
		 WHERE folder IS NULL AND folder_l1 IS NOT NULL AND deleted_at IS NULL`,
		)
		.all();

	const staleCount = nullFolderCount[0]?.cnt ?? 0;
	if (staleCount > 0) {
		db.run(
			`UPDATE cards SET folder_l1 = NULL, folder_l2 = NULL, folder_l3 = NULL, folder_l4 = NULL
		 WHERE folder IS NULL AND folder_l1 IS NOT NULL AND deleted_at IS NULL`,
		);
	}

	return { updated, skipped: staleCount };
}
