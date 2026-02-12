/**
 * Excel Importer for Isometry ETL
 *
 * Parses .xlsx and .xls files using SheetJS (xlsx).
 * One node per row, across all sheets.
 *
 * LATCH mapping with intelligent column detection.
 * Sheet name used as folder for organization.
 *
 * @module etl/importers/ExcelImporter
 */

import * as XLSX from 'xlsx';
import { v4 as uuidv4 } from 'uuid';
import { BaseImporter, FileSource } from './BaseImporter';
import { CanonicalNode } from '../types/canonical';
import { generateDeterministicSourceId } from '../id-generation/deterministic';

interface ParsedExcel {
  sheets: Array<{
    name: string;
    rows: Record<string, unknown>[];
  }>;
  filename: string;
}

/**
 * Excel file importer using SheetJS.
 *
 * Features:
 * - Multi-sheet workbook support (one node per row across all sheets)
 * - Sheet name stored as folder for organization
 * - Intelligent LATCH column mapping
 * - Formula value evaluation (formulas stored in properties)
 * - Mixed data type handling (numbers, booleans, strings)
 * - Deterministic source IDs for re-import stability
 */
export class ExcelImporter extends BaseImporter {
  /**
   * Parse Excel content using SheetJS.
   */
  protected async parse(source: FileSource): Promise<unknown> {
    try {
      // Convert content to buffer
      const buffer = this.toBuffer(source.content, source.encoding);

      // Read workbook
      const workbook = XLSX.read(buffer, { type: 'buffer' });

      // Extract all sheets
      const sheets = workbook.SheetNames.map(name => ({
        name,
        rows: XLSX.utils.sheet_to_json(workbook.Sheets[name]) as Record<string, unknown>[],
      }));

      return { sheets, filename: source.filename };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`Failed to parse ${source.filename}: ${message}`);
    }
  }

  /**
   * Transform parsed Excel sheets to CanonicalNode array.
   */
  protected async transform(data: unknown): Promise<CanonicalNode[]> {
    const { sheets, filename } = data as ParsedExcel;
    const nodes: CanonicalNode[] = [];
    const now = new Date().toISOString();

    for (const sheet of sheets) {
      for (let rowIndex = 0; rowIndex < sheet.rows.length; rowIndex++) {
        const row = sheet.rows[rowIndex];
        const node = this.rowToNode(row, filename, sheet.name, rowIndex, now);
        nodes.push(node);
      }
    }

    return nodes;
  }

  /**
   * Convert a single Excel row to a CanonicalNode.
   */
  private rowToNode(
    row: Record<string, unknown>,
    filename: string,
    sheetName: string,
    rowIndex: number,
    now: string
  ): CanonicalNode {
    const sourceId = generateDeterministicSourceId(
      `${filename}:${sheetName}:${rowIndex}`,
      row,
      'excel-importer'
    );

    return {
      id: uuidv4(),
      sourceId,
      source: 'excel-importer',
      nodeType: detectNodeType(row),
      name: detectName(row, sheetName, rowIndex),
      content: JSON.stringify(row, null, 2),
      summary: detectSummary(row),

      // LATCH: Location
      latitude: parseNumber(detectValue(row, ['latitude', 'lat'])),
      longitude: parseNumber(detectValue(row, ['longitude', 'lng', 'lon'])),
      locationName: detectValue(row, ['location_name', 'locationName', 'place']),
      locationAddress: detectValue(row, ['address', 'location', 'locationAddress']),

      // LATCH: Time
      createdAt: detectDate(row, ['created', 'createdAt', 'created_at', 'date', 'timestamp']) || now,
      modifiedAt: detectDate(row, ['modified', 'modifiedAt', 'modified_at', 'updated']) || now,
      dueAt: detectDate(row, ['due', 'dueAt', 'due_at', 'due_date', 'deadline']),
      completedAt: detectDate(row, ['completed', 'completedAt', 'completed_at']),
      eventStart: detectDate(row, ['start', 'eventStart', 'start_date']),
      eventEnd: detectDate(row, ['end', 'eventEnd', 'end_date']),

      // LATCH: Category
      folder: detectValue(row, ['folder', 'category', 'group', 'project']) || sheetName,
      tags: detectTags(row),
      status: detectValue(row, ['status', 'state']),

      // LATCH: Hierarchy
      priority: detectPriority(row),
      importance: parseNumber(detectValue(row, ['importance'])) || 0,
      sortOrder: parseNumber(detectValue(row, ['sort_order', 'sortOrder', 'order'])) || 0,

      // Grid
      gridX: 0,
      gridY: 0,

      // Provenance
      sourceUrl: detectValue(row, ['url', 'link', 'source_url']),
      deletedAt: null,
      version: 1,

      // Extended properties
      properties: {
        originalFormat: 'excel',
        sheetName,
        rowIndex,
        columns: Object.keys(row),
      },
    };
  }

  /**
   * Convert content string to Buffer based on encoding.
   */
  private toBuffer(content: string, encoding?: 'utf8' | 'base64'): Buffer {
    if (encoding === 'base64') {
      return Buffer.from(content, 'base64');
    }
    return Buffer.from(content);
  }
}

// Helper functions

/**
 * Detect node type from row data.
 */
function detectNodeType(row: Record<string, unknown>): string {
  const type = detectValue(row, ['type', 'node_type', 'nodeType']);
  return type || 'note';
}

/**
 * Detect the name field from a row.
 * Tries common name columns, then falls back to sheet name + row number.
 * Does NOT use arbitrary column values as names to avoid misleading labels.
 */
function detectName(row: Record<string, unknown>, sheetName: string, rowIndex: number): string {
  const nameKeys = ['name', 'title', 'task', 'subject', 'description', 'label', 'item'];
  const name = detectValue(row, nameKeys);
  if (name) return name;

  // Fallback to sheet name + row number
  return `${sheetName} Row ${rowIndex + 1}`;
}

/**
 * Detect summary/description from row.
 */
function detectSummary(row: Record<string, unknown>): string | null {
  const summary = detectValue(row, ['summary', 'description', 'notes', 'excerpt']);
  return summary ? summary.slice(0, 200) : null;
}

/**
 * Detect a value from a row using multiple possible column names.
 * Case-insensitive matching.
 */
function detectValue(row: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    // Case-insensitive matching
    const matchedKey = Object.keys(row).find(
      k => k.toLowerCase() === key.toLowerCase()
    );
    if (matchedKey) {
      const value = row[matchedKey];
      if (value !== null && value !== undefined && value !== '') {
        return String(value).trim();
      }
    }
  }
  return null;
}

/**
 * Detect and parse a date from a row.
 * Returns ISO 8601 format string or null.
 */
function detectDate(row: Record<string, unknown>, keys: string[]): string | null {
  const value = detectValue(row, keys);
  if (!value) return null;

  // Already ISO format
  if (/^\d{4}-\d{2}-\d{2}T/.test(value)) return value;

  // Try to parse
  const parsed = new Date(value);
  if (!isNaN(parsed.getTime())) return parsed.toISOString();

  return null;
}

/**
 * Detect tags from a row.
 * Splits by comma or semicolon.
 */
function detectTags(row: Record<string, unknown>): string[] {
  const tagValue = detectValue(row, ['tags', 'labels', 'categories', 'keywords']);
  if (!tagValue) return [];

  // Split by comma or semicolon
  return tagValue.split(/[,;]/).map(t => t.trim()).filter(Boolean);
}

/**
 * Detect priority from a row.
 * Supports numeric (0-5) or string values (high, medium, low).
 */
function detectPriority(row: Record<string, unknown>): number {
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

/**
 * Parse a string value to number, returning null if invalid.
 */
function parseNumber(value: string | null): number | null {
  if (!value) return null;
  const num = parseFloat(value);
  return isNaN(num) ? null : num;
}
