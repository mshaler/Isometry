// Isometry v5 — Phase 2 Query Type Definitions
// Data contracts for Cards, Connections, Search, and Graph modules.

// ---------------------------------------------------------------------------
// Card types
// ---------------------------------------------------------------------------

export type CardType = 'note' | 'task' | 'event' | 'resource' | 'person';

export interface Card {
	id: string;
	card_type: CardType;
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
	tags: string[]; // JSON-parsed from TEXT column
	status: string | null;
	priority: number;
	sort_order: number;
	url: string | null;
	mime_type: string | null;
	is_collective: boolean; // Mapped from INTEGER 0/1
	source: string | null;
	source_id: string | null;
	source_url: string | null;
	deleted_at: string | null;
}

export interface CardInput {
	card_type?: CardType;
	name: string;
	content?: string | null;
	summary?: string | null;
	folder?: string | null;
	tags?: string[];
	status?: string | null;
	priority?: number;
	sort_order?: number;
	url?: string | null;
	mime_type?: string | null;
	is_collective?: boolean;
	source?: string | null;
	source_id?: string | null;
	source_url?: string | null;
	due_at?: string | null;
	completed_at?: string | null;
	event_start?: string | null;
	event_end?: string | null;
	latitude?: number | null;
	longitude?: number | null;
	location_name?: string | null;
}

export interface CardListOptions {
	folder?: string;
	status?: string;
	card_type?: CardType;
	source?: string;
	limit?: number;
}

// ---------------------------------------------------------------------------
// Connection types (used by Plan 02-02)
// ---------------------------------------------------------------------------

export interface Connection {
	id: string;
	source_id: string;
	target_id: string;
	via_card_id: string | null;
	label: string | null;
	weight: number;
	created_at: string;
}

export interface ConnectionInput {
	source_id: string;
	target_id: string;
	via_card_id?: string | null;
	label?: string | null;
	weight?: number;
}

export type ConnectionDirection = 'outgoing' | 'incoming' | 'bidirectional';

// ---------------------------------------------------------------------------
// Search types (used by Plan 02-03)
// ---------------------------------------------------------------------------

export interface SearchResult {
	card: Card;
	rank: number;
	snippet: string;
}

// ---------------------------------------------------------------------------
// Graph types (used by Plan 02-04)
// ---------------------------------------------------------------------------

export interface CardWithDepth {
	card: Card;
	depth: number;
}
