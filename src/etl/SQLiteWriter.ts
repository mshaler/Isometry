// Isometry v5 — Phase 8 SQLiteWriter
// Batched database writes with FTS optimization.
//
// CRITICAL MITIGATIONS:
// - P22 (OOM): 100-card transaction batches
// - P23 (buffer overflow): db.prepare() with parameterized statements
// - P24 (FTS overhead): Trigger disable/rebuild for bulk imports

import type { Database } from '../database/Database';
import type { CanonicalCard, CanonicalConnection } from './types';

const BATCH_SIZE = 100;
const BULK_THRESHOLD = 500;

/**
 * Callback for import progress reporting.
 * Called at each batch boundary during writeCards.
 */
export type ProgressCallback = (processed: number, total: number, rate: number) => void;

/**
 * SQLiteWriter handles batched database writes with safety mitigations.
 */
export class SQLiteWriter {
  constructor(private db: Database) {}

  /**
   * Write cards to database in 100-card batches.
   *
   * @param cards - Cards to insert
   * @param isBulkImport - If true and >500 cards, use FTS optimization
   * @param onProgress - Optional callback fired at each batch boundary
   */
  async writeCards(
    cards: CanonicalCard[],
    isBulkImport = false,
    onProgress?: ProgressCallback
  ): Promise<void> {
    if (cards.length === 0) return;

    const useFTSOptimization = isBulkImport && cards.length > BULK_THRESHOLD;

    if (useFTSOptimization) {
      this.disableFTSTriggers();
    }

    try {
      // Process in 100-card batches with progress reporting
      let smoothedRate = 0;

      for (let i = 0; i < cards.length; i += BATCH_SIZE) {
        const batch = cards.slice(i, i + BATCH_SIZE);
        const batchStart = performance.now();
        this.insertBatch(batch);
        const batchElapsed = performance.now() - batchStart;

        // Calculate smoothed rate (exponential moving average)
        const processed = Math.min(i + BATCH_SIZE, cards.length);
        const batchRate = batchElapsed > 0
          ? Math.round((batch.length / batchElapsed) * 1000)
          : 0;
        smoothedRate = smoothedRate === 0
          ? batchRate
          : Math.round(0.7 * smoothedRate + 0.3 * batchRate);

        // Yield to event loop between batches (prevents Worker starvation)
        if (i + BATCH_SIZE < cards.length) {
          await new Promise(resolve => setTimeout(resolve, 0));
        }

        // Emit progress after each batch
        onProgress?.(processed, cards.length, smoothedRate);
      }

      if (useFTSOptimization) {
        this.rebuildFTS();
      }
    } finally {
      if (useFTSOptimization) {
        this.restoreFTSTriggers();
      }
    }
  }

  /**
   * Update existing cards in database.
   */
  async updateCards(cards: CanonicalCard[]): Promise<void> {
    if (cards.length === 0) return;

    for (let i = 0; i < cards.length; i += BATCH_SIZE) {
      const batch = cards.slice(i, i + BATCH_SIZE);

      this.db.transaction(() => {
        const stmt = this.db.prepare<never>(
          `UPDATE cards SET
            card_type = ?, name = ?, content = ?, summary = ?,
            latitude = ?, longitude = ?, location_name = ?,
            modified_at = ?, due_at = ?, completed_at = ?,
            event_start = ?, event_end = ?,
            folder = ?, tags = ?, status = ?,
            priority = ?, sort_order = ?,
            url = ?, mime_type = ?, is_collective = ?,
            source = ?, source_id = ?, source_url = ?
          WHERE id = ?`
        );

        for (const card of batch) {
          stmt.run(
            card.card_type, card.name, card.content, card.summary,
            card.latitude, card.longitude, card.location_name,
            card.modified_at, card.due_at, card.completed_at,
            card.event_start, card.event_end,
            card.folder, JSON.stringify(card.tags), card.status,
            card.priority, card.sort_order,
            card.url, card.mime_type, card.is_collective ? 1 : 0,
            card.source, card.source_id, card.source_url,
            card.id  // WHERE clause
          );
        }
      })();

      if (i + BATCH_SIZE < cards.length) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }
  }

  /**
   * Write connections to database.
   * Uses INSERT OR IGNORE to silently drop duplicates.
   */
  async writeConnections(connections: CanonicalConnection[]): Promise<void> {
    if (connections.length === 0) return;

    for (let i = 0; i < connections.length; i += BATCH_SIZE) {
      const batch = connections.slice(i, i + BATCH_SIZE);

      this.db.transaction(() => {
        const stmt = this.db.prepare<never>(
          `INSERT OR IGNORE INTO connections
            (id, source_id, target_id, via_card_id, label, weight, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)`
        );

        for (const conn of batch) {
          stmt.run(
            conn.id,
            conn.source_id,
            conn.target_id,
            conn.via_card_id,
            conn.label,
            conn.weight,
            conn.created_at
          );
        }
      })();

      if (i + BATCH_SIZE < connections.length) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }
  }

  /**
   * Run FTS optimize on the cards_fts index.
   * Merges FTS segments for better query performance.
   * Silently swallows errors — import already succeeded; FTS retries on next search.
   */
  optimizeFTS(): void {
    try {
      this.db.run("INSERT INTO cards_fts(cards_fts) VALUES('optimize')");
    } catch {
      // Silent — import already succeeded; FTS optimize retries on next search
    }
  }

  /**
   * Insert a batch of cards in a single transaction.
   * CRITICAL (P23): Uses parameterized statements, never concatenated VALUES.
   */
  private insertBatch(cards: CanonicalCard[]): void {
    this.db.transaction(() => {
      const stmt = this.db.prepare<never>(
        `INSERT INTO cards (
          id, card_type, name, content, summary,
          latitude, longitude, location_name,
          created_at, modified_at, due_at, completed_at,
          event_start, event_end,
          folder, tags, status,
          priority, sort_order,
          url, mime_type, is_collective,
          source, source_id, source_url
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );

      for (const card of cards) {
        stmt.run(
          card.id, card.card_type, card.name, card.content, card.summary,
          card.latitude, card.longitude, card.location_name,
          card.created_at, card.modified_at, card.due_at, card.completed_at,
          card.event_start, card.event_end,
          card.folder, JSON.stringify(card.tags), card.status,
          card.priority, card.sort_order,
          card.url, card.mime_type, card.is_collective ? 1 : 0,
          card.source, card.source_id, card.source_url
        );
      }
    })();
  }

  /**
   * Disable FTS triggers for bulk import optimization.
   */
  private disableFTSTriggers(): void {
    this.db.run('DROP TRIGGER IF EXISTS cards_fts_ai');
    this.db.run('DROP TRIGGER IF EXISTS cards_fts_ad');
    this.db.run('DROP TRIGGER IF EXISTS cards_fts_au');
  }

  /**
   * Rebuild FTS index from cards table in one pass.
   */
  private rebuildFTS(): void {
    // Use FTS5's rebuild command for external content tables
    // This is safer than DELETE + INSERT for content='cards' tables
    this.db.run("INSERT INTO cards_fts(cards_fts) VALUES('rebuild')");

    // Optimize FTS segments (merge into single segment)
    this.db.run("INSERT INTO cards_fts(cards_fts) VALUES('optimize')");
  }

  /**
   * Restore FTS triggers after bulk import.
   */
  private restoreFTSTriggers(): void {
    this.db.run(`
      CREATE TRIGGER IF NOT EXISTS cards_fts_ai AFTER INSERT ON cards BEGIN
        INSERT INTO cards_fts(rowid, name, content, folder, tags)
        VALUES (NEW.rowid, NEW.name, NEW.content, NEW.folder, NEW.tags);
      END
    `);

    this.db.run(`
      CREATE TRIGGER IF NOT EXISTS cards_fts_ad AFTER DELETE ON cards BEGIN
        INSERT INTO cards_fts(cards_fts, rowid, name, content, folder, tags)
        VALUES ('delete', OLD.rowid, OLD.name, OLD.content, OLD.folder, OLD.tags);
      END
    `);

    this.db.run(`
      CREATE TRIGGER IF NOT EXISTS cards_fts_au AFTER UPDATE OF name, content, folder, tags ON cards BEGIN
        INSERT INTO cards_fts(cards_fts, rowid, name, content, folder, tags)
        VALUES ('delete', OLD.rowid, OLD.name, OLD.content, OLD.folder, OLD.tags);
        INSERT INTO cards_fts(rowid, name, content, folder, tags)
        VALUES (NEW.rowid, NEW.name, NEW.content, NEW.folder, NEW.tags);
      END
    `);
  }
}
