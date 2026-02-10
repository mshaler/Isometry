import type { Database } from 'sql.js';

export interface CardSuggestion {
  id: string;
  name: string;
  modifiedAt: string;
}

export interface BacklinkInfo {
  id: string;
  name: string;
  createdAt: string;
}

/**
 * Query sql.js for card suggestions matching the search query.
 * Returns up to 10 most recently modified cards.
 */
export function queryCardsForSuggestions(
  db: Database | null,
  query: string,
  limit: number = 10
): CardSuggestion[] {
  if (!db) return [];

  try {
    const results = db.exec(
      `SELECT id, name, modified_at
       FROM nodes
       WHERE name LIKE ? AND deleted_at IS NULL
       ORDER BY modified_at DESC
       LIMIT ?`,
      [`%${query}%`, limit]
    );

    if (!results[0]?.values) return [];

    return results[0].values.map(([id, name, modifiedAt]) => ({
      id: String(id),
      name: String(name),
      modifiedAt: String(modifiedAt),
    }));
  } catch (error) {
    console.error('Failed to query cards for suggestions:', error);
    return [];
  }
}

/**
 * Query all cards (no filter) for initial display.
 * Returns up to 10 most recently modified cards.
 */
export function queryRecentCards(
  db: Database | null,
  limit: number = 10
): CardSuggestion[] {
  if (!db) return [];

  try {
    const results = db.exec(
      `SELECT id, name, modified_at
       FROM nodes
       WHERE deleted_at IS NULL AND name IS NOT NULL AND name != ''
       ORDER BY modified_at DESC
       LIMIT ?`,
      [limit]
    );

    if (!results[0]?.values) return [];

    return results[0].values.map(([id, name, modifiedAt]) => ({
      id: String(id),
      name: String(name),
      modifiedAt: String(modifiedAt),
    }));
  } catch (error) {
    console.error('Failed to query recent cards:', error);
    return [];
  }
}

/**
 * Query backlinks for a given card - cards that link TO this card.
 * Used for future backlinks panel feature.
 */
export function queryBacklinks(
  db: Database | null,
  cardId: string
): BacklinkInfo[] {
  if (!db) return [];

  try {
    const results = db.exec(
      `SELECT DISTINCT n.id, n.name, e.created_at
       FROM nodes n
       JOIN edges e ON e.source_id = n.id
       WHERE e.target_id = ? AND e.edge_type = 'LINK' AND n.deleted_at IS NULL
       ORDER BY e.created_at DESC`,
      [cardId]
    );

    if (!results[0]?.values) return [];

    return results[0].values.map(([id, name, createdAt]) => ({
      id: String(id),
      name: String(name),
      createdAt: String(createdAt),
    }));
  } catch (error) {
    console.error('Failed to query backlinks:', error);
    return [];
  }
}

/**
 * Create a LINK edge when a wiki link is created.
 * Called when user selects a card from the wiki link autocomplete.
 */
export function createLinkEdge(
  db: Database | null,
  sourceCardId: string,
  targetCardId: string
): boolean {
  if (!db) return false;

  try {
    const now = new Date().toISOString();
    const edgeId = `edge-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    db.run(
      `INSERT OR IGNORE INTO edges (id, source_id, target_id, edge_type, created_at)
       VALUES (?, ?, ?, 'LINK', ?)`,
      [edgeId, sourceCardId, targetCardId, now]
    );

    return true;
  } catch (error) {
    console.error('Failed to create link edge:', error);
    return false;
  }
}
