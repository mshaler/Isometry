// Isometry v5 — Phase 9 CSVParser
// Parses CSV files with BOM handling and column auto-detection.
//
// Features:
// - PapaParse for robust CSV parsing
// - UTF-8 BOM stripping
// - Column auto-detection via synonym matching
// - Explicit column mapping override
// - Ragged row handling (missing columns)
// - TSV auto-detection

import * as Papa from 'papaparse';
import type { CanonicalCard, CanonicalConnection, ParseError } from '../types';

export interface ParsedFile {
  path: string;
  content: string;
}

export interface CSVColumnMapping {
  name?: string;
  content?: string;
  tags?: string;
  created_at?: string;
}

export interface CSVParseOptions {
  /** Explicit column mapping (overrides auto-detection) */
  columnMapping?: CSVColumnMapping;
  /** Default timestamp for rows without dates */
  defaultTimestamp?: string;
}

export interface CSVParseResult {
  cards: CanonicalCard[];
  connections: CanonicalConnection[];
  errors: ParseError[];
}

/**
 * Header synonyms for auto-detection (case-insensitive matching).
 */
const HEADER_SYNONYMS = {
  name: ['title', 'name', 'subject', 'heading'],
  content: ['content', 'body', 'description', 'text', 'notes'],
  tags: ['tags', 'labels', 'categories'],
  created_at: ['date', 'created', 'created_at', 'timestamp'],
};

/**
 * CSVParser transforms CSV files into canonical cards.
 *
 * Supports spreadsheet exports with auto-detected column mapping.
 */
export class CSVParser {
  /**
   * Parse an array of CSV files into canonical types.
   *
   * @param files - Array of {path, content} objects
   * @param options - Optional parsing configuration
   * @returns Parse result with cards, connections, and errors
   */
  parse(files: ParsedFile[], options?: CSVParseOptions): CSVParseResult {
    const cards: CanonicalCard[] = [];
    const connections: CanonicalConnection[] = [];
    const errors: ParseError[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file) continue;

      try {
        const result = this.parseFile(file, options);
        cards.push(...result.cards);
        connections.push(...result.connections);
      } catch (error) {
        // Per plan: continue on error, log and skip problematic files
        errors.push({
          index: i,
          source_id: file.path,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return { cards, connections, errors };
  }

  /**
   * Parse a single CSV file.
   */
  private parseFile(
    file: ParsedFile,
    options?: CSVParseOptions
  ): { cards: CanonicalCard[]; connections: CanonicalConnection[] } {
    const cards: CanonicalCard[] = [];
    const connections: CanonicalConnection[] = [];

    // Strip UTF-8 BOM if present
    let content = file.content;
    if (content.charCodeAt(0) === 0xfeff) {
      content = content.slice(1);
    }

    // Handle empty content
    if (!content.trim()) {
      return { cards, connections };
    }

    // Parse CSV with PapaParse
    const parseResult = Papa.parse<Record<string, string>>(content, {
      header: true,
      skipEmptyLines: true,
      delimiter: '', // Auto-detect
      worker: false, // Synchronous (already in Worker context)
    });

    // Determine column mapping
    const columnMap = options?.columnMapping || this.autoDetectColumns(parseResult.meta.fields || []);

    // Convert rows to cards
    for (let i = 0; i < parseResult.data.length; i++) {
      const row = parseResult.data[i];
      if (!row) continue;

      const card = this.rowToCard(row, file.path, i, columnMap, options);
      cards.push(card);
    }

    return { cards, connections };
  }

  /**
   * Auto-detect column mapping from header row.
   */
  private autoDetectColumns(headers: string[]): CSVColumnMapping {
    const mapping: CSVColumnMapping = {};

    for (const header of headers) {
      const lower = header.toLowerCase();

      // Check name synonyms
      if (!mapping.name && HEADER_SYNONYMS.name.includes(lower)) {
        mapping.name = header;
      }

      // Check content synonyms
      if (!mapping.content && HEADER_SYNONYMS.content.includes(lower)) {
        mapping.content = header;
      }

      // Check tags synonyms
      if (!mapping.tags && HEADER_SYNONYMS.tags.includes(lower)) {
        mapping.tags = header;
      }

      // Check created_at synonyms
      if (!mapping.created_at && HEADER_SYNONYMS.created_at.includes(lower)) {
        mapping.created_at = header;
      }
    }

    return mapping;
  }

  /**
   * Convert a CSV row to a CanonicalCard.
   */
  private rowToCard(
    row: Record<string, string>,
    filePath: string,
    rowIndex: number,
    columnMap: CSVColumnMapping,
    options?: CSVParseOptions
  ): CanonicalCard {
    // Extract fields using column mapping
    const name = (columnMap.name && row[columnMap.name]) || `Row ${rowIndex + 1}`;
    const content = (columnMap.content && row[columnMap.content]) || null;
    const tagsRaw = (columnMap.tags && row[columnMap.tags]) || '';
    const createdAt =
      (columnMap.created_at && row[columnMap.created_at]) ||
      options?.defaultTimestamp ||
      new Date().toISOString();

    // Parse tags (split on comma or semicolon)
    const tags = this.parseTags(tagsRaw);

    return {
      id: crypto.randomUUID(),
      card_type: 'note',
      name: name.trim(),
      content: content?.trim() || null,
      summary: content ? content.slice(0, 200) : null,

      latitude: null,
      longitude: null,
      location_name: null,

      created_at: createdAt,
      modified_at: createdAt,
      due_at: null,
      completed_at: null,
      event_start: null,
      event_end: null,

      folder: null,
      tags: tags,
      status: null,

      priority: 0,
      sort_order: rowIndex,

      url: null,
      mime_type: 'text/csv',
      is_collective: false,

      source: 'csv',
      source_id: `${filePath}:${rowIndex}`,
      source_url: null,

      deleted_at: null,
    };
  }

  /**
   * Parse tags from comma/semicolon-separated string.
   */
  private parseTags(tagsRaw: string): string[] {
    if (!tagsRaw?.trim()) {
      return [];
    }

    // Split on comma or semicolon
    const parts = tagsRaw.split(/[,;]/);
    const tags: string[] = [];

    for (const part of parts) {
      const trimmed = part.trim();
      if (trimmed) {
        tags.push(trimmed);
      }
    }

    return tags;
  }
}
