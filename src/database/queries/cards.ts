// Isometry v5 — Card CRUD Operations
// Implements CARD-01 through CARD-06.
//
// Pattern: Pass Database instance to every function (no module-level state).
// Use db.run() for mutations (INSERT/UPDATE/DELETE) and db.exec() for SELECT.
// withStatement is reserved for Phase 3+ performance-critical hot paths.

import type { Database } from '../Database';
import { execRowsToCards } from './helpers';
import type { Card, CardInput, CardListOptions } from './types';

// ---------------------------------------------------------------------------
// CARD-01: Create a card
// ---------------------------------------------------------------------------

/**
 * Insert a new card with a generated UUID. Returns the full Card object.
 *
 * All optional CardInput fields default to SQL defaults when not provided.
 * Tags are serialized to a JSON string for the TEXT column.
 * Timestamps (created_at, modified_at) are set explicitly in JavaScript
 * to ensure consistent ISO-8601 format with millisecond precision.
 */
export function createCard(db: Database, input: CardInput): Card {
	const id = crypto.randomUUID();
	const now = new Date().toISOString();
	const tagsJson = input.tags ? JSON.stringify(input.tags) : null;
	const isCollective = input.is_collective ? 1 : 0;

	db.run(
		`INSERT INTO cards (
      id, card_type, name, content, summary,
      latitude, longitude, location_name,
      created_at, modified_at,
      due_at, completed_at, event_start, event_end,
      folder, tags, status,
      priority, sort_order,
      url, mime_type, is_collective,
      source, source_id, source_url
    ) VALUES (
      ?, ?, ?, ?, ?,
      ?, ?, ?,
      ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?,
      ?, ?,
      ?, ?, ?,
      ?, ?, ?
    )`,
		[
			id,
			input.card_type ?? 'note',
			input.name,
			input.content ?? null,
			input.summary ?? null,
			input.latitude ?? null,
			input.longitude ?? null,
			input.location_name ?? null,
			now,
			now,
			input.due_at ?? null,
			input.completed_at ?? null,
			input.event_start ?? null,
			input.event_end ?? null,
			input.folder ?? null,
			tagsJson,
			input.status ?? null,
			input.priority ?? 0,
			input.sort_order ?? 0,
			input.url ?? null,
			input.mime_type ?? null,
			isCollective,
			input.source ?? null,
			input.source_id ?? null,
			input.source_url ?? null,
		],
	);

	const card = getCardIncludingDeleted(db, id);
	if (!card) {
		throw new Error(`createCard: failed to retrieve newly inserted card ${id}`);
	}
	return card;
}

// ---------------------------------------------------------------------------
// CARD-02: Retrieve a card by ID
// ---------------------------------------------------------------------------

/**
 * Retrieve a card by ID. Returns null for non-existent or soft-deleted cards.
 * Soft-deleted cards (deleted_at IS NOT NULL) are excluded by default.
 */
export function getCard(db: Database, id: string): Card | null {
	const result = db.exec('SELECT * FROM cards WHERE id = ? AND deleted_at IS NULL', [id]);
	const cards = execRowsToCards(result);
	return cards[0] ?? null;
}

/**
 * Internal: retrieve a card by ID regardless of soft-delete status.
 * Used by createCard after insert and undeleteCard after restore.
 */
function getCardIncludingDeleted(db: Database, id: string): Card | null {
	const result = db.exec('SELECT * FROM cards WHERE id = ?', [id]);
	const cards = execRowsToCards(result);
	return cards[0] ?? null;
}

// ---------------------------------------------------------------------------
// CARD-03: Update card fields
// ---------------------------------------------------------------------------

/**
 * Update specified fields on a card. Always updates modified_at.
 * Throws if the card does not exist or is soft-deleted.
 *
 * Allowed update fields: all CardInput fields except card_type (type is immutable).
 * FTS re-indexing for name/content/folder/tags is handled automatically by
 * the cards_fts_au trigger defined in schema.sql.
 */
export function updateCard(db: Database, id: string, updates: Partial<Omit<CardInput, 'card_type'>>): void {
	const setClauses: string[] = [];
	const params: unknown[] = [];

	// Build dynamic SET clause from provided update fields
	if (updates.name !== undefined) {
		setClauses.push('name = ?');
		params.push(updates.name);
	}
	if (updates.content !== undefined) {
		setClauses.push('content = ?');
		params.push(updates.content);
	}
	if (updates.summary !== undefined) {
		setClauses.push('summary = ?');
		params.push(updates.summary);
	}
	if (updates.folder !== undefined) {
		setClauses.push('folder = ?');
		params.push(updates.folder);
	}
	if (updates.tags !== undefined) {
		setClauses.push('tags = ?');
		params.push(JSON.stringify(updates.tags));
	}
	if (updates.status !== undefined) {
		setClauses.push('status = ?');
		params.push(updates.status);
	}
	if (updates.priority !== undefined) {
		setClauses.push('priority = ?');
		params.push(updates.priority);
	}
	if (updates.sort_order !== undefined) {
		setClauses.push('sort_order = ?');
		params.push(updates.sort_order);
	}
	if (updates.url !== undefined) {
		setClauses.push('url = ?');
		params.push(updates.url);
	}
	if (updates.mime_type !== undefined) {
		setClauses.push('mime_type = ?');
		params.push(updates.mime_type);
	}
	if (updates.is_collective !== undefined) {
		setClauses.push('is_collective = ?');
		params.push(updates.is_collective ? 1 : 0);
	}
	if (updates.source !== undefined) {
		setClauses.push('source = ?');
		params.push(updates.source);
	}
	if (updates.source_id !== undefined) {
		setClauses.push('source_id = ?');
		params.push(updates.source_id);
	}
	if (updates.source_url !== undefined) {
		setClauses.push('source_url = ?');
		params.push(updates.source_url);
	}
	if (updates.due_at !== undefined) {
		setClauses.push('due_at = ?');
		params.push(updates.due_at);
	}
	if (updates.completed_at !== undefined) {
		setClauses.push('completed_at = ?');
		params.push(updates.completed_at);
	}
	if (updates.event_start !== undefined) {
		setClauses.push('event_start = ?');
		params.push(updates.event_start);
	}
	if (updates.event_end !== undefined) {
		setClauses.push('event_end = ?');
		params.push(updates.event_end);
	}
	if (updates.latitude !== undefined) {
		setClauses.push('latitude = ?');
		params.push(updates.latitude);
	}
	if (updates.longitude !== undefined) {
		setClauses.push('longitude = ?');
		params.push(updates.longitude);
	}
	if (updates.location_name !== undefined) {
		setClauses.push('location_name = ?');
		params.push(updates.location_name);
	}

	if (setClauses.length === 0) {
		// Nothing to update — verify card exists and is not deleted before returning
		const existing = getCard(db, id);
		if (!existing) {
			throw new Error(`updateCard: card ${id} not found or is soft-deleted`);
		}
		return;
	}

	// Always update modified_at
	const now = new Date().toISOString();
	setClauses.push('modified_at = ?');
	params.push(now);

	// WHERE clause: only update non-deleted cards
	params.push(id);

	const sql = `UPDATE cards SET ${setClauses.join(', ')} WHERE id = ? AND deleted_at IS NULL`;
	db.run(sql, params as import('sql.js').BindParams);

	// Verify the update affected a row (card existed and was not deleted)
	const updated = getCard(db, id);
	if (!updated) {
		throw new Error(`updateCard: card ${id} not found or is soft-deleted`);
	}
}

// ---------------------------------------------------------------------------
// CARD-04: Soft delete
// ---------------------------------------------------------------------------

/**
 * Soft-delete a card by setting deleted_at to the current timestamp.
 * Idempotent: calling on an already-deleted card updates deleted_at again (no error).
 * After deletion, getCard() and listCards() will exclude this card.
 */
export function deleteCard(db: Database, id: string): void {
	const now = new Date().toISOString();
	db.run('UPDATE cards SET deleted_at = ? WHERE id = ?', [now, id]);
}

// ---------------------------------------------------------------------------
// CARD-05: List cards with filters
// ---------------------------------------------------------------------------

/**
 * Return all non-deleted cards, with optional filters.
 * Filters are applied with AND logic. All filter values are parameterized.
 * Allowed filters: folder, status, card_type, source, limit.
 */
export function listCards(db: Database, options?: CardListOptions): Card[] {
	const conditions: string[] = ['deleted_at IS NULL'];
	const params: unknown[] = [];

	if (options?.folder !== undefined) {
		conditions.push('folder = ?');
		params.push(options.folder);
	}
	if (options?.status !== undefined) {
		conditions.push('status = ?');
		params.push(options.status);
	}
	if (options?.card_type !== undefined) {
		conditions.push('card_type = ?');
		params.push(options.card_type);
	}
	if (options?.source !== undefined) {
		conditions.push('source = ?');
		params.push(options.source);
	}

	let sql = `SELECT * FROM cards WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC`;

	if (options?.limit !== undefined) {
		sql += ' LIMIT ?';
		params.push(options.limit);
	}

	const result = db.exec(sql, params.length > 0 ? (params as import('sql.js').BindParams) : undefined);
	return execRowsToCards(result);
}

// ---------------------------------------------------------------------------
// CARD-06: Undelete
// ---------------------------------------------------------------------------

/**
 * Restore a soft-deleted card by clearing deleted_at.
 * Throws if the card does not exist (any id, including non-existent).
 * After restoration, getCard() and listCards() will include this card again.
 */
export function undeleteCard(db: Database, id: string): void {
	const now = new Date().toISOString();

	// Check if card exists at all (including deleted)
	const existing = getCardIncludingDeleted(db, id);
	if (!existing) {
		throw new Error(`undeleteCard: card ${id} not found`);
	}

	db.run('UPDATE cards SET deleted_at = NULL, modified_at = ? WHERE id = ?', [now, id]);
}
