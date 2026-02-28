// Isometry v5 — Phase 4 Inverse SQL Generators
// Generates Mutation objects with forward + inverse SQL for card and connection operations.
//
// Requirements:
//   - MUT-02: Every mutation has both forward and inverse SQL computed at creation time
//   - MUT-04: Batch mutations produce a single undo step with correctly reversed inverse ordering
//
// RESEARCH Pitfall 3: DELETE requires full row — deleteCardMutation takes full Card, not just ID
// RESEARCH Pitfall 4: Batch inverse order reversed — forward [A,B,C] → inverse [undoC,undoB,undoA]

import type { Card, CardInput, Connection, ConnectionInput } from '../database/queries/types';
import type { Mutation, MutationCommand } from './types';

// ---------------------------------------------------------------------------
// Card columns (in schema order) — 26 columns total
// ---------------------------------------------------------------------------

const CARD_COLUMNS = [
  'id', 'card_type', 'name', 'content', 'summary',
  'latitude', 'longitude', 'location_name',
  'created_at', 'modified_at', 'due_at', 'completed_at',
  'event_start', 'event_end', 'folder', 'tags',
  'status', 'priority', 'sort_order', 'url',
  'mime_type', 'is_collective', 'source', 'source_id',
  'source_url', 'deleted_at',
] as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Serialize tags array to JSON string for TEXT column storage. */
function serializeTags(tags: string[] | undefined | null): string {
  return JSON.stringify(tags ?? []);
}

/** Convert boolean to SQLite integer (0 or 1). */
function boolToInt(value: boolean | undefined | null): number {
  return value ? 1 : 0;
}

/** Extract all 26 column values from a Card in CARD_COLUMNS order. */
function cardToParams(card: Card): unknown[] {
  return [
    card.id,
    card.card_type,
    card.name,
    card.content,
    card.summary,
    card.latitude,
    card.longitude,
    card.location_name,
    card.created_at,
    card.modified_at,
    card.due_at,
    card.completed_at,
    card.event_start,
    card.event_end,
    card.folder,
    serializeTags(card.tags),
    card.status,
    card.priority,
    card.sort_order,
    card.url,
    card.mime_type,
    boolToInt(card.is_collective),
    card.source,
    card.source_id,
    card.source_url,
    card.deleted_at,
  ];
}

// ---------------------------------------------------------------------------
// createCardMutation
// ---------------------------------------------------------------------------

/**
 * Create a card mutation.
 * Generates a UUID for the card that appears in both forward (INSERT) and inverse (DELETE).
 *
 * MUT-02: forward + inverse computed at creation time
 */
export function createCardMutation(input: CardInput): Mutation {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  // Build INSERT params matching CARD_COLUMNS order
  const insertParams: unknown[] = [
    id,
    input.card_type ?? 'note',
    input.name,
    input.content ?? null,
    input.summary ?? null,
    input.latitude ?? null,
    input.longitude ?? null,
    input.location_name ?? null,
    now,                              // created_at
    now,                              // modified_at
    input.due_at ?? null,
    input.completed_at ?? null,
    input.event_start ?? null,
    input.event_end ?? null,
    input.folder ?? null,
    serializeTags(input.tags),
    input.status ?? null,
    input.priority ?? 0,
    input.sort_order ?? 0,
    input.url ?? null,
    input.mime_type ?? null,
    boolToInt(input.is_collective),
    input.source ?? null,
    input.source_id ?? null,
    input.source_url ?? null,
    null,                             // deleted_at
  ];

  const placeholders = CARD_COLUMNS.map(() => '?').join(', ');
  const columnList = CARD_COLUMNS.join(', ');

  const forward: MutationCommand[] = [
    {
      sql: `INSERT INTO cards (${columnList}) VALUES (${placeholders})`,
      params: insertParams,
    },
  ];

  const inverse: MutationCommand[] = [
    {
      sql: 'DELETE FROM cards WHERE id = ?',
      params: [id],
    },
  ];

  return {
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    description: `Create card ${input.name}`,
    forward,
    inverse,
  };
}

// ---------------------------------------------------------------------------
// updateCardMutation
// ---------------------------------------------------------------------------

/**
 * Update a card mutation.
 * Only includes fields present in `after` — not all 25 columns.
 * Inverse restores old values from `before`.
 *
 * MUT-02: forward + inverse computed at creation time (before state captured now)
 */
export function updateCardMutation(
  id: string,
  before: Card,
  after: Partial<CardInput>
): Mutation {
  const changedFields = Object.keys(after) as Array<keyof CardInput>;

  if (changedFields.length === 0) {
    // No-op mutation (identity)
    return {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      description: `Update card ${before.name}`,
      forward: [],
      inverse: [],
    };
  }

  const forwardSets: string[] = [];
  const forwardParams: unknown[] = [];
  const inverseSets: string[] = [];
  const inverseParams: unknown[] = [];

  for (const field of changedFields) {
    forwardSets.push(`${field} = ?`);
    inverseSets.push(`${field} = ?`);

    // Serialize tags specially
    if (field === 'tags') {
      forwardParams.push(serializeTags(after[field] as string[] | undefined));
      inverseParams.push(serializeTags(before.tags));
    } else if (field === 'is_collective') {
      forwardParams.push(boolToInt(after[field] as boolean | undefined));
      inverseParams.push(boolToInt(before.is_collective));
    } else {
      forwardParams.push(after[field] as unknown);
      // Get old value from before card
      inverseParams.push((before as unknown as Record<string, unknown>)[field]);
    }
  }

  // WHERE id = ? at end
  forwardParams.push(id);
  inverseParams.push(id);

  const forward: MutationCommand[] = [
    {
      sql: `UPDATE cards SET ${forwardSets.join(', ')} WHERE id = ?`,
      params: forwardParams,
    },
  ];

  const inverse: MutationCommand[] = [
    {
      sql: `UPDATE cards SET ${inverseSets.join(', ')} WHERE id = ?`,
      params: inverseParams,
    },
  ];

  return {
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    description: `Update card ${before.name}`,
    forward,
    inverse,
  };
}

// ---------------------------------------------------------------------------
// deleteCardMutation
// ---------------------------------------------------------------------------

/**
 * Delete a card mutation.
 * Forward: DELETE WHERE id = ?
 * Inverse: INSERT with ALL 26 columns (restores complete row).
 *
 * RESEARCH Pitfall 3: Takes full Card, not just ID — full row needed for inverse INSERT.
 */
export function deleteCardMutation(card: Card): Mutation {
  const placeholders = CARD_COLUMNS.map(() => '?').join(', ');
  const columnList = CARD_COLUMNS.join(', ');

  const forward: MutationCommand[] = [
    {
      sql: 'DELETE FROM cards WHERE id = ?',
      params: [card.id],
    },
  ];

  const inverse: MutationCommand[] = [
    {
      sql: `INSERT INTO cards (${columnList}) VALUES (${placeholders})`,
      params: cardToParams(card),
    },
  ];

  return {
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    description: `Delete card ${card.name}`,
    forward,
    inverse,
  };
}

// ---------------------------------------------------------------------------
// createConnectionMutation
// ---------------------------------------------------------------------------

/**
 * Create a connection mutation.
 * Generates a UUID for the connection.
 */
export function createConnectionMutation(input: ConnectionInput): Mutation {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  const forward: MutationCommand[] = [
    {
      sql: 'INSERT INTO connections (id, source_id, target_id, via_card_id, label, weight, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      params: [
        id,
        input.source_id,
        input.target_id,
        input.via_card_id ?? null,
        input.label ?? null,
        input.weight ?? 1,
        now,
      ],
    },
  ];

  const inverse: MutationCommand[] = [
    {
      sql: 'DELETE FROM connections WHERE id = ?',
      params: [id],
    },
  ];

  return {
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    description: `Create connection ${input.source_id} → ${input.target_id}`,
    forward,
    inverse,
  };
}

// ---------------------------------------------------------------------------
// deleteConnectionMutation
// ---------------------------------------------------------------------------

/**
 * Delete a connection mutation.
 * Inverse: INSERT with all connection fields to restore the row.
 */
export function deleteConnectionMutation(conn: Connection): Mutation {
  const forward: MutationCommand[] = [
    {
      sql: 'DELETE FROM connections WHERE id = ?',
      params: [conn.id],
    },
  ];

  const inverse: MutationCommand[] = [
    {
      sql: 'INSERT INTO connections (id, source_id, target_id, via_card_id, label, weight, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      params: [
        conn.id,
        conn.source_id,
        conn.target_id,
        conn.via_card_id,
        conn.label,
        conn.weight,
        conn.created_at,
      ],
    },
  ];

  return {
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    description: `Delete connection ${conn.source_id} → ${conn.target_id}`,
    forward,
    inverse,
  };
}

// ---------------------------------------------------------------------------
// batchMutation
// ---------------------------------------------------------------------------

/**
 * Combine multiple mutations into a single undo step.
 *
 * RESEARCH Pitfall 4: Inverse order is REVERSED.
 * Forward:  [A, B, C] → batch.forward  = [A.forward..., B.forward..., C.forward...]
 * Inverse:  [A, B, C] → batch.inverse  = [C.inverse..., B.inverse..., A.inverse...]
 */
export function batchMutation(description: string, ...mutations: Mutation[]): Mutation {
  const forward: MutationCommand[] = mutations.flatMap(m => m.forward);
  // Reverse the mutations array for inverse, but keep each mutation's internal order
  const inverse: MutationCommand[] = [...mutations].reverse().flatMap(m => m.inverse);

  return {
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    description,
    forward,
    inverse,
  };
}
