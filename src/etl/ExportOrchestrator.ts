// Isometry v5 — ExportOrchestrator
// Phase 09-04 ETL-17: Export coordinator with format dispatch
//
// Purpose: Coordinate card queries and dispatch to format-specific exporters
// Features: Filtering by cardIds/cardTypes, deleted card exclusion, connection inclusion

import type { Database } from '../database/Database';
import type { Card, Connection } from '../database/queries/types';
import { MarkdownExporter } from './exporters/MarkdownExporter';
import { JSONExporter } from './exporters/JSONExporter';
import { CSVExporter } from './exporters/CSVExporter';

export type ExportFormat = 'markdown' | 'json' | 'csv';

/**
 * Options for filtering export data.
 */
export interface ExportOptions {
  /** Optional array of card IDs to export (if omitted, exports all) */
  cardIds?: string[];
  /** Optional array of card types to export (if omitted, exports all types) */
  cardTypes?: string[];
  /** Whether to exclude deleted cards (default: true) */
  excludeDeleted?: boolean;
}

/**
 * Result of an export operation.
 */
export interface ExportResult {
  /** Exported data as string */
  data: string;
  /** Generated filename with timestamp */
  filename: string;
  /** Export format used */
  format: ExportFormat;
  /** Number of cards exported */
  cardCount: number;
}

/**
 * Coordinates export operations across multiple formats.
 *
 * Features:
 * - Queries cards with optional filters (cardIds, cardTypes)
 * - Excludes deleted cards by default
 * - Dispatches to format-specific exporters
 * - Includes connections for markdown/json formats
 * - Generates timestamped filenames
 *
 * Requirements: ETL-17 (Export orchestration)
 */
export class ExportOrchestrator {
  private markdownExporter = new MarkdownExporter();
  private jsonExporter = new JSONExporter();
  private csvExporter = new CSVExporter();

  constructor(private db: Database) {}

  /**
   * Export cards in the specified format.
   *
   * @param format Export format (markdown, json, csv)
   * @param options Optional filters and settings
   * @returns Export result with data, filename, format, and count
   */
  export(format: ExportFormat, options: ExportOptions = {}): ExportResult {
    const { cardIds, cardTypes, excludeDeleted = true } = options;

    // Build query with filters
    let sql = 'SELECT * FROM cards WHERE 1=1';
    const params: any[] = [];

    if (excludeDeleted) {
      sql += ' AND deleted_at IS NULL';
    }

    if (cardIds && cardIds.length > 0) {
      sql += ` AND id IN (${cardIds.map(() => '?').join(',')})`;
      params.push(...cardIds);
    }

    if (cardTypes && cardTypes.length > 0) {
      sql += ` AND card_type IN (${cardTypes.map(() => '?').join(',')})`;
      params.push(...cardTypes);
    }

    sql += ' ORDER BY created_at ASC';

    // Execute query
    const stmt = this.db.prepare<any>(sql);
    const rows = stmt.all(...params);
    stmt.free();

    const cards: Card[] = rows.map((row: any) => ({
      ...row,
      tags: row.tags ? JSON.parse(row.tags) : [],
      is_collective: Boolean(row.is_collective),
    }));

    // Get connections for markdown/json formats
    let connections: Connection[] = [];
    let cardNameMap: Map<string, string> | undefined;

    if ((format === 'markdown' || format === 'json') && cards.length > 0) {
      const connSql = `SELECT * FROM connections WHERE source_id IN (${cards.map(() => '?').join(',')})`;
      const connStmt = this.db.prepare<Connection>(connSql);
      connections = connStmt.all(...cards.map((c) => c.id));
      connStmt.free();

      if (format === 'markdown') {
        cardNameMap = new Map(cards.map((c) => [c.id, c.name]));
      }
    }

    // Dispatch to exporter
    let data: string;
    let ext: string;

    switch (format) {
      case 'markdown':
        data = this.markdownExporter.export(cards, connections, cardNameMap);
        ext = 'md';
        break;
      case 'json':
        data = this.jsonExporter.export(cards, connections);
        ext = 'json';
        break;
      case 'csv':
        data = this.csvExporter.export(cards);
        ext = 'csv';
        break;
    }

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `isometry-export-${timestamp}.${ext}`;

    return {
      data,
      filename,
      format,
      cardCount: cards.length,
    };
  }
}
