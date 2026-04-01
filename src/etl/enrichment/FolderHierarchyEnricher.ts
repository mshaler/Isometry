// Isometry v5 — Folder Hierarchy Enricher
// Splits folder paths into folder_l1..folder_l4 materialized columns.
//
// Example:
//   folder = "Work/BairesDev/MSFT" →
//     folder_l1 = "Work"
//     folder_l2 = "BairesDev"
//     folder_l3 = "MSFT"
//     folder_l4 = null
//
// Design:
//   - Applies to all source types (folder paths are universal).
//   - Idempotent: re-running overwrites folder_l* with fresh splits.
//   - Null folder → all levels null.
//   - Depth > 4: levels 1-3 use first 3 segments, level 4 joins remaining.
//   - Separator: '/' (Apple Notes, Markdown file paths, generic convention).

import type { CanonicalCard } from '../types';
import type { Enricher } from './types';

/** Maximum hierarchy depth. Segments beyond this are joined into the last level. */
const MAX_DEPTH = 4;

/** Path separator for folder hierarchies. */
const SEPARATOR = '/';

/**
 * Split a folder path into up to MAX_DEPTH levels.
 * Exported for direct use in backfill queries.
 *
 * @param folder - Raw folder path (e.g., "Work/BairesDev/MSFT/Teams")
 * @returns Tuple of [l1, l2, l3, l4] where unused levels are null
 */
export function splitFolderPath(folder: string | null): [string | null, string | null, string | null, string | null] {
	if (!folder) return [null, null, null, null];

	const parts = folder.split(SEPARATOR).filter((p) => p.length > 0);
	if (parts.length === 0) return [null, null, null, null];

	const result: [string | null, string | null, string | null, string | null] = [null, null, null, null];

	for (let i = 0; i < MAX_DEPTH; i++) {
		if (i < MAX_DEPTH - 1) {
			// Levels 1-3: one segment each
			result[i] = i < parts.length ? parts[i]! : null;
		} else {
			// Level 4: join remaining segments (handles depth > 4)
			if (i < parts.length) {
				result[i] = parts.slice(i).join(SEPARATOR);
			}
		}
	}

	return result;
}

/**
 * FolderHierarchyEnricher splits folder paths into materialized hierarchy levels.
 */
export const folderHierarchyEnricher: Enricher = {
	id: 'folder-hierarchy',
	description: 'Split folder paths into folder_l1..folder_l4 hierarchy levels',
	appliesTo: '*',

	enrich(cards: CanonicalCard[]): CanonicalCard[] {
		for (const card of cards) {
			const [l1, l2, l3, l4] = splitFolderPath(card.folder);
			const ext = card as unknown as Record<string, unknown>;
			ext['folder_l1'] = l1;
			ext['folder_l2'] = l2;
			ext['folder_l3'] = l3;
			ext['folder_l4'] = l4;
		}
		return cards;
	},
};
