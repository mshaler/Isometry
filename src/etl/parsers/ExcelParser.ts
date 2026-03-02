// Isometry v5 — Phase 9 Excel Parser
// Parses Excel files with dynamic SheetJS import to minimize bundle size.
//
// Requirements addressed:
//   - ETL-08: Excel parser with dynamic import strategy
//
// Per RESEARCH.md locked decisions:
// - Dynamic import of xlsx (not top-level) to defer ~1MB bundle load
// - cellDates: true to avoid Excel date serial number confusion
// - Date objects converted to ISO 8601 strings

import type { CanonicalCard, CanonicalConnection, ParseError } from '../types';

/**
 * Field mapping options for ExcelParser.
 * Maps canonical field names to custom Excel column names.
 */
export interface ExcelParseOptions {
  /** Custom field mapping (overrides auto-detection) */
  fieldMapping?: {
    name?: string;
    content?: string;
    tags?: string;
    created_at?: string;
    folder?: string;
  };
  /** Source identifier for imported cards (default: 'excel') */
  source?: string;
  /** Specific sheet name to parse (default: first sheet) */
  sheet?: string;
}

/**
 * Result of Excel parsing operation.
 */
export interface ParseResult {
  cards: CanonicalCard[];
  connections: CanonicalConnection[];
  errors: ParseError[];
}

/**
 * Column name synonyms for auto-detection.
 * Matches CSVParser and JSONParser patterns for consistency.
 */
const HEADER_SYNONYMS = {
  name: ['title', 'name', 'subject', 'heading'],
  content: ['content', 'body', 'description', 'text', 'notes'],
  tags: ['tags', 'labels', 'categories'],
  created_at: ['date', 'created', 'created_at', 'timestamp'],
  folder: ['folder', 'category', 'group'],
};

/**
 * ExcelParser transforms Excel files into canonical cards.
 * Uses dynamic import to load xlsx library only when needed (bundle optimization).
 */
export class ExcelParser {
  private xlsx: typeof import('xlsx') | null = null;

  /**
   * Parse Excel file from ArrayBuffer.
   *
   * @param buffer - ArrayBuffer containing Excel file data
   * @param options - Optional field mapping, sheet selection, and source identifier
   * @returns ParseResult with cards, connections, and errors
   */
  async parse(buffer: ArrayBuffer, options?: ExcelParseOptions): Promise<ParseResult> {
    const cards: CanonicalCard[] = [];
    const connections: CanonicalConnection[] = [];
    const errors: ParseError[] = [];

    try {
      // Dynamic import on first use (P27 - bundle size optimization)
      if (!this.xlsx) {
        this.xlsx = await import('xlsx');
      }

      // Parse workbook with cellDates: true to convert serial numbers
      const workbook = this.xlsx.read(buffer, {
        type: 'array',
        cellDates: true, // Convert Excel date serial numbers to Date objects
      });

      // Select sheet (explicit option or first sheet)
      const sheetName = options?.sheet ?? workbook.SheetNames[0];
      if (!sheetName) {
        return { cards, connections, errors };
      }

      const sheet = workbook.Sheets[sheetName];
      if (!sheet) {
        errors.push({
          index: 0,
          source_id: null,
          message: `Sheet "${sheetName}" not found in workbook`,
        });
        return { cards, connections, errors };
      }

      // Convert sheet to JSON (array of objects)
      const rows = this.xlsx.utils.sheet_to_json(sheet) as Record<string, unknown>[];

      // Process each row
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (!row || typeof row !== 'object') {
          continue;
        }

        try {
          const card = this.parseRow(row, i, options);
          cards.push(card);
        } catch (error) {
          errors.push({
            index: i,
            source_id: String(i),
            message: error instanceof Error ? error.message : String(error),
          });
        }
      }
    } catch (error) {
      // Workbook parsing error
      errors.push({
        index: 0,
        source_id: null,
        message: `Failed to parse Excel file: ${error instanceof Error ? error.message : String(error)}`,
      });
    }

    return { cards, connections, errors };
  }

  /**
   * Parse a single Excel row into a CanonicalCard.
   */
  private parseRow(
    row: Record<string, unknown>,
    index: number,
    options?: ExcelParseOptions
  ): CanonicalCard {
    const source = options?.source ?? 'excel';

    // Auto-detect or use explicit field mapping
    const nameField = this.findField(row, 'name', options?.fieldMapping?.name);
    const contentField = this.findField(row, 'content', options?.fieldMapping?.content);
    const tagsField = this.findField(row, 'tags', options?.fieldMapping?.tags);
    const createdField = this.findField(row, 'created_at', options?.fieldMapping?.created_at);
    const folderField = this.findField(row, 'folder', options?.fieldMapping?.folder);

    // Extract values
    const name = this.extractString(row[nameField]) || `Row ${index}`;
    const content = this.extractContent(row[contentField]);
    const tags = this.extractTags(row[tagsField]);
    const created_at = this.extractDate(row[createdField]);
    const folder = this.extractString(row[folderField]);

    const card: CanonicalCard = {
      id: crypto.randomUUID(),
      card_type: 'note',
      name: name,
      content: content,
      summary: content ? content.slice(0, 200) : null,

      latitude: null,
      longitude: null,
      location_name: null,

      created_at: created_at,
      modified_at: created_at,
      due_at: null,
      completed_at: null,
      event_start: null,
      event_end: null,

      folder: folder,
      tags: tags,
      status: null,

      priority: 0,
      sort_order: index,

      url: null,
      mime_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      is_collective: false,

      source: source,
      source_id: String(index),
      source_url: null,

      deleted_at: null,
    };

    return card;
  }

  /**
   * Find field name using auto-detection or explicit mapping.
   */
  private findField(
    row: Record<string, unknown>,
    canonicalField: keyof typeof HEADER_SYNONYMS,
    explicitMapping?: string
  ): string {
    // Use explicit mapping if provided
    if (explicitMapping && explicitMapping in row) {
      return explicitMapping;
    }

    // Auto-detect using synonyms
    const synonyms = HEADER_SYNONYMS[canonicalField];
    for (const synonym of synonyms) {
      if (synonym in row) {
        return synonym;
      }
    }

    // Fallback to canonical name
    return canonicalField;
  }

  /**
   * Extract string value from Excel cell.
   */
  private extractString(value: unknown): string | null {
    if (value === null || value === undefined) {
      return null;
    }
    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : null;
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }
    if (value instanceof Date) {
      return value.toISOString();
    }
    return null;
  }

  /**
   * Extract content field, handling various types.
   */
  private extractContent(value: unknown): string | null {
    if (value === null || value === undefined) {
      return null;
    }
    if (typeof value === 'string') {
      return value;
    }
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    return String(value);
  }

  /**
   * Extract date value and convert to ISO 8601 string.
   * Handles Date objects (from cellDates: true) and string dates.
   */
  private extractDate(value: unknown): string {
    if (value instanceof Date) {
      return value.toISOString();
    }
    if (typeof value === 'string') {
      // Try parsing as date
      const parsed = new Date(value);
      if (!isNaN(parsed.getTime())) {
        return parsed.toISOString();
      }
      return value;
    }
    // Fallback to current timestamp
    return new Date().toISOString();
  }

  /**
   * Extract tags from array or delimited string.
   */
  private extractTags(value: unknown): string[] {
    if (!value) {
      return [];
    }

    // Array of strings
    if (Array.isArray(value)) {
      return value.map(v => String(v).trim()).filter(Boolean);
    }

    // Comma or semicolon delimited string
    if (typeof value === 'string') {
      return value
        .split(/[,;]/)
        .map(tag => tag.trim())
        .filter(Boolean);
    }

    return [];
  }
}
