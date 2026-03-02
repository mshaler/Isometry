// Isometry v5 — Phase 9 JSON Parser
// Parses JSON data with auto-field detection and array normalization.
//
// Requirements addressed:
//   - ETL-06: JSON parser with field auto-detection
//   - ETL-08: Support for nested JSON structures

import type { CanonicalCard, CanonicalConnection, ParseError } from '../types';

/**
 * Field mapping options for JSONParser.
 * Maps canonical field names to custom JSON property names.
 */
export interface JSONParseOptions {
  /** Custom field mapping (overrides auto-detection) */
  fieldMapping?: {
    name?: string;
    content?: string;
    tags?: string;
    created_at?: string;
    folder?: string;
  };
  /** Source identifier for imported cards (default: 'json') */
  source?: string;
}

/**
 * Result of JSON parsing operation.
 */
export interface ParseResult {
  cards: CanonicalCard[];
  connections: CanonicalConnection[];
  errors: ParseError[];
}

/**
 * Column name synonyms for auto-detection.
 * Matches CSVParser pattern for consistency.
 */
const HEADER_SYNONYMS = {
  name: ['title', 'name', 'subject', 'heading'],
  content: ['content', 'body', 'description', 'text', 'notes'],
  tags: ['tags', 'labels', 'categories'],
  created_at: ['date', 'created', 'created_at', 'timestamp'],
  folder: ['folder', 'category', 'group'],
};

/**
 * JSONParser transforms JSON data into canonical cards.
 * Supports array normalization, nested structure extraction, and field auto-detection.
 */
export class JSONParser {
  /**
   * Parse JSON string into canonical cards.
   *
   * @param input - JSON string to parse
   * @param options - Optional field mapping and source identifier
   * @returns ParseResult with cards, connections, and errors
   */
  parse(input: string, options?: JSONParseOptions): ParseResult {
    const cards: CanonicalCard[] = [];
    const connections: CanonicalConnection[] = [];
    const errors: ParseError[] = [];

    try {
      let data = JSON.parse(input);

      // Extract nested arrays (items, data, records)
      data = this.extractNestedArray(data);

      // Normalize to array
      const items = Array.isArray(data) ? data : [data];

      // Process each item
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (!item || typeof item !== 'object') {
          continue;
        }

        try {
          const card = this.parseItem(item, i, options);
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
      // Invalid JSON
      errors.push({
        index: 0,
        source_id: null,
        message: `Invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
      });
    }

    return { cards, connections, errors };
  }

  /**
   * Extract nested arrays from common wrapper keys.
   * Checks: data.items, data, items, records, cards
   */
  private extractNestedArray(data: unknown): unknown {
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return data;
    }

    const obj = data as Record<string, unknown>;

    // Check for deeply nested: data.items
    if (obj.data && typeof obj.data === 'object' && !Array.isArray(obj.data)) {
      const dataObj = obj.data as Record<string, unknown>;
      if (Array.isArray(dataObj.items)) {
        return dataObj.items;
      }
    }

    // Check for single-level nesting (includes Isometry JSON export format)
    if (Array.isArray(obj.cards)) {
      return obj.cards;
    }
    if (Array.isArray(obj.items)) {
      return obj.items;
    }
    if (Array.isArray(obj.data)) {
      return obj.data;
    }
    if (Array.isArray(obj.records)) {
      return obj.records;
    }

    return data;
  }

  /**
   * Parse a single JSON object into a CanonicalCard.
   */
  private parseItem(
    item: Record<string, unknown>,
    index: number,
    options?: JSONParseOptions
  ): CanonicalCard {
    const source = options?.source ?? 'json';

    // Auto-detect or use explicit field mapping
    const nameField = this.findField(item, 'name', options?.fieldMapping?.name);
    const contentField = this.findField(item, 'content', options?.fieldMapping?.content);
    const tagsField = this.findField(item, 'tags', options?.fieldMapping?.tags);
    const createdField = this.findField(item, 'created_at', options?.fieldMapping?.created_at);
    const folderField = this.findField(item, 'folder', options?.fieldMapping?.folder);

    // Extract values
    const name = this.extractString(item[nameField]) || `Row ${index}`;
    const content = this.extractContent(item[contentField]);
    const tags = this.extractTags(item[tagsField]);
    const created_at = this.extractString(item[createdField]) || new Date().toISOString();
    const folder = this.extractString(item[folderField]);

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
      mime_type: 'application/json',
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
    item: Record<string, unknown>,
    canonicalField: keyof typeof HEADER_SYNONYMS,
    explicitMapping?: string
  ): string {
    // Use explicit mapping if provided
    if (explicitMapping && explicitMapping in item) {
      return explicitMapping;
    }

    // Auto-detect using synonyms
    const synonyms = HEADER_SYNONYMS[canonicalField];
    for (const synonym of synonyms) {
      if (synonym in item) {
        return synonym;
      }
    }

    // Fallback to canonical name
    return canonicalField;
  }

  /**
   * Extract string value from JSON field.
   */
  private extractString(value: unknown): string | null {
    if (value === null || value === undefined) {
      return null;
    }
    if (typeof value === 'string') {
      return value;
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }
    return null;
  }

  /**
   * Extract content field, stringifying objects.
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
