// Isometry v5 — Phase 8 DedupEngine
// Classifies cards as insert/update/skip for idempotent re-import.
//
// CRITICAL (P25): Uses parameterized query to load existing cards.
// Never interpolate source_id values into SQL strings.

import type { Database } from '../database/Database';
import type { CanonicalCard, CanonicalConnection } from './types';

/**
 * Result of deduplication classification.
 */
export interface DedupResult {
  toInsert: CanonicalCard[];
  toUpdate: CanonicalCard[];
  toSkip: CanonicalCard[];
  connections: CanonicalConnection[];
  sourceIdMap: Map<string, string>;  // source_id → card.id (UUID)
}

/**
 * DedupEngine classifies parsed cards as insert/update/skip
 * based on source_id and modified_at comparison.
 *
 * Key behaviors:
 * - Loads all existing cards for source type in single query (P25 safe)
 * - Builds sourceIdMap for connection ID resolution
 * - Resolves connection targets; drops unresolvable connections
 */
export class DedupEngine {
  constructor(private db: Database) {}

  /**
   * Process cards and connections, classifying each for database action.
   *
   * @param cards - Parsed canonical cards (may have temporary IDs)
   * @param connections - Parsed connections (may have unresolved IDs)
   * @param sourceType - Source identifier (e.g., 'apple_notes')
   * @returns Classification result with resolved connections
   */
  process(
    cards: CanonicalCard[],
    connections: CanonicalConnection[],
    sourceType: string
  ): DedupResult {
    const toInsert: CanonicalCard[] = [];
    const toUpdate: CanonicalCard[] = [];
    const toSkip: CanonicalCard[] = [];
    const sourceIdMap = new Map<string, string>();

    // Load all existing cards for this source type in one query
    // CRITICAL (P25): Parameterized query prevents SQL injection
    const existing = this.db
      .prepare<{ id: string; source_id: string; modified_at: string }>(
        `SELECT id, source_id, modified_at
         FROM cards
         WHERE source = ? AND source_id IS NOT NULL`
      )
      .all(sourceType);

    const existingMap = new Map<string, { id: string; modified_at: string }>();
    for (const row of existing) {
      existingMap.set(row.source_id, { id: row.id, modified_at: row.modified_at });
      // Pre-populate sourceIdMap with existing cards
      sourceIdMap.set(row.source_id, row.id);
    }

    // Classify each incoming card
    for (const card of cards) {
      const existingCard = existingMap.get(card.source_id);

      if (!existingCard) {
        // New card — insert
        toInsert.push(card);
        sourceIdMap.set(card.source_id, card.id);
      } else {
        // Existing card — compare timestamps
        const incomingDate = new Date(card.modified_at);
        const existingDate = new Date(existingCard.modified_at);

        if (incomingDate > existingDate) {
          // Incoming is newer — update (use existing UUID)
          toUpdate.push({ ...card, id: existingCard.id });
          sourceIdMap.set(card.source_id, existingCard.id);
        } else {
          // Same or older — skip (unchanged)
          toSkip.push(card);
          sourceIdMap.set(card.source_id, existingCard.id);
        }
      }
    }

    // Resolve connection IDs via sourceIdMap
    // Drop connections with unresolvable targets (P30)
    const resolvedConnections = this.resolveConnections(connections, sourceIdMap);

    return {
      toInsert,
      toUpdate,
      toSkip,
      connections: resolvedConnections,
      sourceIdMap,
    };
  }

  /**
   * Resolve connection source/target IDs from source_ids to UUIDs.
   * Connections with unresolvable targets are dropped.
   */
  private resolveConnections(
    connections: CanonicalConnection[],
    sourceIdMap: Map<string, string>
  ): CanonicalConnection[] {
    const resolved: CanonicalConnection[] = [];

    for (const conn of connections) {
      // Try to resolve source and target
      const resolvedSourceId = sourceIdMap.get(conn.source_id) ?? conn.source_id;
      const resolvedTargetId = sourceIdMap.get(conn.target_id) ?? conn.target_id;
      const resolvedViaCardId = conn.via_card_id
        ? (sourceIdMap.get(conn.via_card_id) ?? conn.via_card_id)
        : null;

      // Only include if both endpoints are resolved (exist in sourceIdMap)
      const sourceResolved = sourceIdMap.has(conn.source_id) ||
        this.isUUID(conn.source_id);
      const targetResolved = sourceIdMap.has(conn.target_id) ||
        this.isUUID(conn.target_id);

      if (sourceResolved && targetResolved) {
        resolved.push({
          ...conn,
          source_id: resolvedSourceId,
          target_id: resolvedTargetId,
          via_card_id: resolvedViaCardId,
        });
      }
      // Else: silently drop (P30 — unresolvable connections)
    }

    return resolved;
  }

  /**
   * Check if a string looks like a UUID (already resolved).
   */
  private isUUID(str: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
  }
}
