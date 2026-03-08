// Isometry v5 -- Phase 52 Sample Data Types
// Defines the shape of bundled sample dataset JSON files.
//
// Requirements: SMPL-06 (three curated datasets with connections for visual impact)

import type { ViewType } from '../providers/types';

/** Shape of a bundled sample dataset JSON file. */
export interface SampleDataset {
	id: string;
	name: string;
	defaultView: ViewType;
	cards: SampleCard[];
	connections: SampleConnection[];
}

/** Card shape within dataset JSON -- mirrors CanonicalCard columns. */
export interface SampleCard {
	id: string;
	card_type: string;
	name: string;
	content: string | null;
	summary: string | null;
	latitude: number | null;
	longitude: number | null;
	location_name: string | null;
	created_at: string;
	modified_at: string;
	due_at: string | null;
	completed_at: string | null;
	event_start: string | null;
	event_end: string | null;
	folder: string | null;
	tags: string[];
	status: string | null;
	priority: number;
	sort_order: number;
	url: string | null;
	mime_type: string | null;
	is_collective: boolean;
	source: 'sample';
	source_id: string;
	source_url: string | null;
	deleted_at: string | null;
}

/** Connection shape within dataset JSON -- mirrors connections table. */
export interface SampleConnection {
	id: string;
	source_id: string;
	target_id: string;
	via_card_id: string | null;
	label: string | null;
	weight: number;
	created_at: string;
}
