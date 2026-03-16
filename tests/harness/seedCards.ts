// Isometry v6.1 — Phase 79 Test Infrastructure
// seedCards(): lightweight card seeding helper with auto-FTS via trigger.
//
// Design:
//   - Accepts partial SeedCard objects; all fields optional
//   - Auto-generates id (crypto.randomUUID), created_at, modified_at when omitted
//   - Uses BEGIN/COMMIT batch pattern for performance
//   - Does NOT manually insert into cards_fts — the cards_fts_ai trigger handles it
//   - Returns inserted IDs in insertion order

import type { Database } from '../../src/database/Database';

/**
 * Partial card object for seeding. All fields are optional; reasonable defaults
 * are applied for omitted fields. Only specify fields relevant to your assertion.
 */
export interface SeedCard {
	id?: string;
	card_type?: 'note' | 'task' | 'event' | 'resource' | 'person';
	name?: string;
	content?: string | null;
	summary?: string | null;
	latitude?: number | null;
	longitude?: number | null;
	location_name?: string | null;
	created_at?: string;
	modified_at?: string;
	due_at?: string | null;
	completed_at?: string | null;
	event_start?: string | null;
	event_end?: string | null;
	folder?: string | null;
	tags?: string | null;
	status?: string | null;
	priority?: number;
	sort_order?: number;
	url?: string | null;
	mime_type?: string | null;
	is_collective?: number;
	source?: string | null;
	source_id?: string | null;
	source_url?: string | null;
	deleted_at?: string | null;
}

/**
 * Insert an array of cards into the database with sensible defaults for omitted fields.
 *
 * FTS5 is populated automatically via the `cards_fts_ai` trigger defined in schema.sql.
 * Do NOT insert into cards_fts manually — that would corrupt the FTS index.
 *
 * @param db - An initialized Database instance from realDb()
 * @param cards - Array of partial card objects
 * @returns Array of inserted card IDs in insertion order
 */
export function seedCards(db: Database, cards: SeedCard[]): string[] {
	const now = new Date().toISOString();
	const insertedIds: string[] = [];

	db.run('BEGIN');
	for (const card of cards) {
		const id = card.id ?? crypto.randomUUID();
		insertedIds.push(id);
		db.run(
			`INSERT INTO cards (
				id, card_type, name, content, summary,
				latitude, longitude, location_name,
				created_at, modified_at, due_at, completed_at, event_start, event_end,
				folder, tags, status,
				priority, sort_order,
				url, mime_type, is_collective,
				source, source_id, source_url,
				deleted_at
			) VALUES (
				?, ?, ?, ?, ?,
				?, ?, ?,
				?, ?, ?, ?, ?, ?,
				?, ?, ?,
				?, ?,
				?, ?, ?,
				?, ?, ?,
				?
			)`,
			[
				id,
				card.card_type ?? 'note',
				card.name ?? 'Unnamed',
				card.content ?? null,
				card.summary ?? null,
				card.latitude ?? null,
				card.longitude ?? null,
				card.location_name ?? null,
				card.created_at ?? now,
				card.modified_at ?? now,
				card.due_at ?? null,
				card.completed_at ?? null,
				card.event_start ?? null,
				card.event_end ?? null,
				card.folder ?? null,
				card.tags ?? null,
				card.status ?? null,
				card.priority ?? 0,
				card.sort_order ?? 0,
				card.url ?? null,
				card.mime_type ?? null,
				card.is_collective ?? 0,
				card.source ?? null,
				card.source_id ?? null,
				card.source_url ?? null,
				card.deleted_at ?? null,
			],
		);
		// FTS5 is populated automatically via the cards_fts_ai trigger —
		// no manual cards_fts insert needed.
	}
	db.run('COMMIT');

	return insertedIds;
}
