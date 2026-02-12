/**
 * CSV Importer for Isometry ETL
 *
 * Parses .csv and .tsv files using PapaParse.
 * One node per row, header row maps to fields.
 *
 * LATCH mapping with intelligent column detection.
 *
 * @module etl/importers/CsvImporter
 */

import * as Papa from 'papaparse';
import { v4 as uuidv4 } from 'uuid';
import { BaseImporter, FileSource } from './BaseImporter';
import { CanonicalNode } from '../types/canonical';
import { generateDeterministicSourceId } from '../id-generation/deterministic';

interface ParsedCsv {
  rows: Record<string, string>[];
  filename: string;
}

/**
 * CSV/TSV file importer using PapaParse.
 *
 * Features:
 * - RFC 4180 compliant parsing (quoted fields, commas in values)
 * - Automatic header detection
 * - Intelligent LATCH column mapping
 * - TSV support via tab delimiter detection
 * - Deterministic source IDs for re-import stability
 */
export class CsvImporter extends BaseImporter {
  /**
   * Parse CSV/TSV content using PapaParse.
   */
  protected async parse(source: FileSource): Promise<unknown> {
    return new Promise((resolve, reject) => {
      Papa.parse<Record<string, string>>(source.content, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header) => header.trim(),
        complete: (results) => {
          if (results.errors.length > 0) {
            // Filter out recoverable errors
            const fatalErrors = results.errors.filter(e => e.type === 'Quotes');
            if (fatalErrors.length > 0) {
              reject(new Error(
                `CSV parse errors in ${source.filename}: ${JSON.stringify(fatalErrors)}`
              ));
              return;
            }
          }
          resolve({ rows: results.data, filename: source.filename });
        },
        error: (err: Error) => reject(new Error(`CSV parse failed: ${err.message}`)),
      });
    });
  }

  /**
   * Transform parsed CSV rows to CanonicalNode array.
   */
  protected async transform(data: unknown): Promise<CanonicalNode[]> {
    const { rows, filename } = data as ParsedCsv;
    const now = new Date().toISOString();

    return rows.map((row, index) => this.rowToNode(row, filename, index, now));
  }

  /**
   * Convert a single CSV row to a CanonicalNode.
   */
  private rowToNode(
    row: Record<string, string>,
    filename: string,
    index: number,
    now: string
  ): CanonicalNode {
    const sourceId = generateDeterministicSourceId(
      `${filename}:row:${index}`,
      row,
      'csv-importer'
    );

    return {
      id: uuidv4(),
      sourceId,
      source: 'csv-importer',
      nodeType: detectValue(row, ['type', 'node_type', 'nodeType']) || 'note',
      name: detectName(row, index),
      content: JSON.stringify(row, null, 2),
      summary: detectValue(row, ['summary', 'description', 'notes'])?.slice(0, 200) || null,

      // LATCH: Location
      latitude: parseFloat(detectValue(row, ['latitude', 'lat']) || '') || null,
      longitude: parseFloat(detectValue(row, ['longitude', 'lng', 'lon']) || '') || null,
      locationName: detectValue(row, ['location_name', 'locationName', 'place']) || null,
      locationAddress: detectValue(row, ['address', 'location', 'locationAddress']) || null,

      // LATCH: Time
      createdAt: detectDate(row, ['created', 'createdAt', 'created_at', 'date', 'timestamp']) || now,
      modifiedAt: detectDate(row, ['modified', 'modifiedAt', 'modified_at', 'updated']) || now,
      dueAt: detectDate(row, ['due', 'dueAt', 'due_at', 'due_date', 'deadline']) || null,
      completedAt: detectDate(row, ['completed', 'completedAt', 'completed_at']) || null,
      eventStart: detectDate(row, ['start', 'eventStart', 'start_date']) || null,
      eventEnd: detectDate(row, ['end', 'eventEnd', 'end_date']) || null,

      // LATCH: Category
      folder: detectValue(row, ['folder', 'category', 'group', 'project']) || null,
      tags: detectTags(row),
      status: detectValue(row, ['status', 'state']) || null,

      // LATCH: Hierarchy
      priority: detectPriority(row),
      importance: parseInt(detectValue(row, ['importance']) || '0', 10) || 0,
      sortOrder: parseInt(detectValue(row, ['sort_order', 'sortOrder', 'order']) || '0', 10),

      // Grid
      gridX: 0,
      gridY: 0,

      // Provenance
      sourceUrl: detectValue(row, ['url', 'link', 'source_url']) || null,
      deletedAt: null,
      version: 1,

      // Store column headers for reference
      properties: {
        originalFormat: 'csv',
        rowIndex: index,
        columns: Object.keys(row),
      },
    };
  }
}

// Helper functions

/**
 * Detect a value from a row using multiple possible column names.
 * Case-insensitive matching.
 */
function detectValue(row: Record<string, string>, keys: string[]): string | null {
  for (const key of keys) {
    // Case-insensitive matching
    const matchedKey = Object.keys(row).find(
      k => k.toLowerCase() === key.toLowerCase()
    );
    if (matchedKey && row[matchedKey]?.trim()) {
      return row[matchedKey].trim();
    }
  }
  return null;
}

/**
 * Detect the name field from a row.
 * Tries common name columns, then falls back to first non-empty value.
 */
function detectName(row: Record<string, string>, index: number): string {
  const nameKeys = ['name', 'title', 'task', 'subject', 'description', 'item'];
  const name = detectValue(row, nameKeys);
  if (name) return name;

  // Fallback to first non-empty column value
  for (const value of Object.values(row)) {
    if (value?.trim()) return value.trim();
  }

  return `Row ${index + 1}`;
}

/**
 * Detect and parse a date from a row.
 * Returns ISO 8601 format string or null.
 */
function detectDate(row: Record<string, string>, keys: string[]): string | null {
  const value = detectValue(row, keys);
  if (!value) return null;

  // Already ISO format
  if (/^\d{4}-\d{2}-\d{2}T/.test(value)) {
    // Ensure full ISO format with milliseconds
    const parsed = new Date(value);
    if (!isNaN(parsed.getTime())) return parsed.toISOString();
    return value;
  }

  // Try to parse
  const parsed = new Date(value);
  if (!isNaN(parsed.getTime())) return parsed.toISOString();

  return null;
}

/**
 * Detect tags from a row.
 * Splits by comma or semicolon.
 */
function detectTags(row: Record<string, string>): string[] {
  const tagValue = detectValue(row, ['tags', 'labels', 'categories', 'keywords']);
  if (!tagValue) return [];

  // Split by comma or semicolon
  return tagValue.split(/[,;]/).map(t => t.trim()).filter(Boolean);
}

/**
 * Detect priority from a row.
 * Supports numeric (0-5) or string values (high, medium, low).
 */
function detectPriority(row: Record<string, string>): number {
  const p = detectValue(row, ['priority']);
  if (!p) return 0;

  // Numeric
  const num = parseInt(p, 10);
  if (!isNaN(num)) return Math.min(5, Math.max(0, num));

  // String values
  const lower = p.toLowerCase();
  if (lower === 'high' || lower === 'urgent' || lower === 'critical') return 5;
  if (lower === 'medium' || lower === 'normal') return 3;
  if (lower === 'low') return 1;

  return 0;
}
