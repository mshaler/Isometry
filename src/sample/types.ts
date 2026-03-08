// Isometry v5 -- Phase 52 Sample Data Types (SQL seed edition)
// Defines the shape of bundled sample dataset SQL seed files.
//
// Requirements: SMPL-06 (curated datasets with connections for visual impact)

import type { ViewType } from '../providers/types';

/**
 * Metadata for a bundled sample dataset.
 * The actual data lives in a .sql seed file imported as a raw string.
 */
export interface SampleDataset {
	id: string;
	name: string;
	description: string;
	defaultView: ViewType;
	/** Raw SQL seed text (INSERT INTO nodes/edges statements). */
	sql: string;
}
