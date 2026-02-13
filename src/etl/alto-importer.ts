/**
 * Alto-Index Importer
 *
 * Imports alto.index markdown files into the sql.js database.
 * Maps diverse data types to the unified nodes table with LATCH fields.
 *
 * LATCH mapping:
 * - L (Location): location from calendar events, addresses from contacts
 * - A (Alphabet): title/name
 * - T (Time): created, modified, start_date, end_date, due_date
 * - C (Category): folder, calendar, node_type, tags
 * - H (Hierarchy): priority, importance (derived from status)
 *
 * Phase 70-02: Refactored to extend BaseImporter and return CanonicalNode[].
 */

import type { Database } from 'sql.js';
import { v4 as uuidv4 } from 'uuid';
import { BaseImporter, type FileSource } from './importers/BaseImporter';
import { CanonicalNode, CanonicalNodeSchema, SQL_COLUMN_MAP } from './types/canonical';
import { parseFrontmatter } from './parsers/frontmatter';
import { generateDeterministicSourceId } from './id-generation/deterministic';
import { insertCanonicalNodes } from './database/insertion';
import {
  parseAltoFile,
  detectDataType,
  extractTags,
  type ParsedAltoFile,
  type AltoDataType,
  type AltoFrontmatter,
} from './alto-parser';
import { storeNodeProperties } from './storage/property-storage';

// ============================================================================
// Types
// ============================================================================

export interface ImportOptions {
  /** Maximum number of files to import (for testing) */
  limit?: number;
  /** Data types to import */
  dataTypes?: AltoDataType[];
  /** Clear existing alto-index data before import */
  clearExisting?: boolean;
  /** Progress callback */
  onProgress?: (imported: number, total: number, current: string) => void;
}

export interface ImportResult {
  imported: number;
  skipped: number;
  errors: string[];
  duration: number;
  runId?: string;
  reconciliation?: {
    totalFiles: number;
    importedByType: Record<string, number>;
    skippedByReason: Record<string, number>;
  };
}

export interface NodeRecord {
  id: string;
  node_type: string;
  name: string;
  content: string | null;
  summary: string | null;
  latitude: number | null;
  longitude: number | null;
  location_name: string | null;
  location_address: string | null;
  created_at: string;
  modified_at: string;
  due_at: string | null;
  completed_at: string | null;
  event_start: string | null;
  event_end: string | null;
  folder: string | null;
  tags: string | null;
  status: string | null;
  priority: number;
  importance: number;
  sort_order: number;
  source: string;
  source_id: string;
  source_url: string | null;
  deleted_at: string | null;
  version: number;
}

// ============================================================================
// AltoImporter Class (extends BaseImporter)
// ============================================================================

interface ParsedAltoContent {
  frontmatter: Record<string, unknown>;
  body: string;
  tags: string[];
  dataType: AltoDataType;
  filename: string;
}

/**
 * Alto-Index Importer - Extends BaseImporter for CanonicalNode pipeline.
 *
 * Parses alto.index markdown files and converts to CanonicalNode format.
 * Supports diverse data types: notes, contacts, messages, calendar, reminders,
 * safari-history, safari-bookmarks, and voice-memos.
 */
export class AltoImporter extends BaseImporter {
  protected async parse(source: FileSource): Promise<ParsedAltoContent> {
    const parsed = parseFrontmatter(source.content);

    if (!parsed) {
      throw new Error('Failed to parse frontmatter');
    }

    const { frontmatter, body } = parsed;
    const altoFrontmatter = frontmatter as unknown as AltoFrontmatter;
    const dataType = detectDataType(source.filename, altoFrontmatter);

    // Extract tags from attachments (notes-specific)
    const attachments = altoFrontmatter.attachments || [];
    const tags = extractTags(attachments);

    return {
      frontmatter,
      body,
      tags,
      dataType,
      filename: source.filename,
    };
  }

  protected async transform(data: unknown): Promise<CanonicalNode[]> {
    const { frontmatter, body, tags, dataType, filename } =
      data as ParsedAltoContent;

    const node = this.mapToCanonicalNode(frontmatter, body, tags, dataType, filename);

    // Validate against schema
    const validated = CanonicalNodeSchema.safeParse(node);
    if (!validated.success) {
      throw new Error(`Validation failed: ${validated.error.message}`);
    }

    return [validated.data];
  }

  private mapToCanonicalNode(
    frontmatter: Record<string, unknown>,
    body: string,
    tags: string[],
    dataType: AltoDataType,
    filename: string
  ): CanonicalNode {
    const id = uuidv4();
    const sourceId = generateDeterministicSourceId(
      filename,
      frontmatter,
      'alto',
      body
    );

    // Extract values with type coercion
    const title = String(frontmatter.title || frontmatter.name || filename);
    const now = new Date().toISOString();

    // Location extraction (calendar events, contacts)
    let locationName: string | null = null;
    let locationAddress: string | null = null;
    if (frontmatter.location) {
      const loc = String(frontmatter.location);
      locationAddress = loc;
      locationName = loc.split('\n')[0] || null;
    }

    // Folder extraction (type-specific)
    const folder = this.extractFolder(frontmatter, dataType);

    // Status extraction (reminders specific)
    let status = frontmatter.status ? String(frontmatter.status) : null;
    if (dataType === 'reminders' && frontmatter.is_flagged) {
      status = 'flagged';
    }

    // Summary extraction
    const summary = this.extractSummary(body, frontmatter);

    return {
      id,
      nodeType: dataType,
      name: title,
      content: body || null,
      summary,
      source: 'alto-index',
      sourceId,
      sourceUrl: this.extractSourceUrl(frontmatter),

      // Location
      latitude: null,
      longitude: null,
      locationName,
      locationAddress,

      // Time (ISO 8601 strings)
      createdAt: this.extractDate(frontmatter, [
        'created',
        'created_date',
        'first_message',
        'start_date',
      ]) || now,
      modifiedAt: this.extractDate(frontmatter, [
        'modified',
        'modified_date',
        'last_modified',
        'last_message',
      ]) || now,
      dueAt: this.extractDate(frontmatter, ['due_date', 'due']) || null,
      completedAt: null,
      eventStart: this.extractDate(frontmatter, ['start_date', 'start']) || null,
      eventEnd: this.extractDate(frontmatter, ['end_date', 'end']) || null,

      // Category
      folder,
      tags: tags.length > 0 ? tags : [],
      status,

      // Hierarchy
      priority: this.extractPriority(frontmatter),
      importance: this.extractImportance(frontmatter, dataType),
      sortOrder: 0,

      // Grid
      gridX: 0,
      gridY: 0,

      // Lifecycle
      version: 1,
      deletedAt: null,

      // Dynamic properties (keys not in SQL_COLUMN_MAP)
      properties: this.extractUnknownProperties(frontmatter),
    };
  }

  private extractFolder(
    frontmatter: Record<string, unknown>,
    dataType: AltoDataType
  ): string | null {
    if (frontmatter.folder) return String(frontmatter.folder);
    if (frontmatter.calendar) return String(frontmatter.calendar);
    if (frontmatter.list) return String(frontmatter.list);
    if (frontmatter.organization) return String(frontmatter.organization);

    // Type-specific defaults
    switch (dataType) {
      case 'contacts':
        return 'Contacts';
      case 'messages':
        return frontmatter.is_group ? 'Group Chats' : 'Messages';
      case 'calendar':
        return 'Calendar';
      case 'reminders':
        return 'Reminders';
      case 'safari-history':
        return 'History';
      case 'safari-bookmarks':
        return 'Bookmarks';
      default:
        return dataType;
    }
  }

  private extractSummary(
    content: string | null,
    frontmatter: Record<string, unknown>
  ): string | null {
    // Messages get participants as summary
    if (Array.isArray(frontmatter.participants)) {
      return (frontmatter.participants as string[]).join(', ');
    }

    if (!content) return null;

    // Get first non-empty line that isn't a heading
    const lines = content.split('\n').filter((line) => {
      const trimmed = line.trim();
      return trimmed && !trimmed.startsWith('#') && !trimmed.startsWith('---');
    });

    return lines[0]?.slice(0, 200) || null;
  }

  private extractDate(
    frontmatter: Record<string, unknown>,
    keys: string[]
  ): string | null {
    for (const key of keys) {
      const val = frontmatter[key];
      if (val) {
        if (val instanceof Date) return val.toISOString();
        if (typeof val === 'string') {
          // If already ISO, return as-is
          if (/^\d{4}-\d{2}-\d{2}T/.test(val)) return val;
          // Try to parse and convert
          const parsed = new Date(val);
          if (!isNaN(parsed.getTime())) return parsed.toISOString();
        }
      }
    }
    return null;
  }

  private extractSourceUrl(frontmatter: Record<string, unknown>): string | null {
    const url = frontmatter.source || frontmatter.link || frontmatter.url;
    if (!url) return null;

    // Validate it's a valid URL
    const urlStr = String(url);
    try {
      new URL(urlStr);
      return urlStr;
    } catch {
      return null; // Invalid URL format
    }
  }

  private extractPriority(frontmatter: Record<string, unknown>): number {
    const p = frontmatter.priority;
    if (typeof p === 'number') return Math.min(5, Math.max(0, p));
    if (typeof p === 'string') {
      const lower = p.toLowerCase();
      if (lower === 'high') return 5;
      if (lower === 'medium') return 3;
      if (lower === 'low') return 1;
      const num = parseInt(p, 10);
      if (!isNaN(num)) return Math.min(5, Math.max(0, num));
    }
    if (frontmatter.is_flagged) return 4;
    return 0;
  }

  private extractImportance(
    frontmatter: Record<string, unknown>,
    dataType: AltoDataType
  ): number {
    if (frontmatter.is_flagged) return 4;
    const attendees = frontmatter.attendees as unknown[] | undefined;
    if (attendees && attendees.length > 3) return 3;
    if (dataType === 'calendar') return 2;
    if (dataType === 'reminders') return 2;
    return 1;
  }

  private extractUnknownProperties(
    frontmatter: Record<string, unknown>
  ): Record<string, unknown> {
    // Use SQL_COLUMN_MAP to get complete list of canonical fields
    const canonicalKeys = new Set(Object.keys(SQL_COLUMN_MAP));

    // Plus the explicit frontmatter key aliases that map to canonical fields
    const frontmatterAliases = new Set([
      'title', // -> name
      'created', // -> createdAt
      'created_date',
      'first_message',
      'modified', // -> modifiedAt
      'modified_date',
      'last_modified',
      'last_message',
      'due', // -> dueAt
      'due_date',
      'start', // -> eventStart
      'start_date',
      'end', // -> eventEnd
      'end_date',
      'location', // -> locationName/Address
      'calendar', // -> folder
      'list', // -> folder
      'organization', // -> folder
      'participants', // -> summary (messages)
      'is_group', // -> folder (messages)
      'is_flagged', // -> priority/status
      'link', // -> sourceUrl
      'url', // -> sourceUrl
      'attachments', // -> tags extraction
      'attendees', // -> importance
    ]);

    const unknown: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(frontmatter)) {
      // Skip if it's a canonical field OR a known alias
      if (!canonicalKeys.has(key) && !frontmatterAliases.has(key)) {
        unknown[key] = value;
      }
    }

    return unknown; // Return empty object rather than undefined (schema default is {})
  }
}

// ============================================================================
// Backward-Compatible Wrappers
// ============================================================================

/**
 * Import a single alto-index file and insert into database.
 *
 * ARCHITECTURE NOTE: This wrapper exists for backward compatibility only.
 * The clean architecture is:
 *   AltoImporter.import() -> CanonicalNode[] -> caller handles insertion
 *
 * New code should use:
 *   const importer = new AltoImporter();
 *   const nodes = await importer.import({ filename, content });
 *   await insertCanonicalNodes(db, nodes);
 *
 * @deprecated Use AltoImporter class directly for new code
 */
export async function importAltoFile(
  db: Database,
  filename: string,
  content: string
): Promise<{ nodeId: string; errors: string[] }> {
  const importer = new AltoImporter();

  try {
    const nodes = await importer.import({ filename, content });

    if (nodes.length > 0) {
      // Insert using new utility
      const insertResult = await insertCanonicalNodes(db, nodes);
      return {
        nodeId: nodes[0].id,
        errors: insertResult.errors.map((e) => e.error),
      };
    }

    return { nodeId: '', errors: ['No nodes imported'] };
  } catch (error) {
    return {
      nodeId: '',
      errors: [error instanceof Error ? error.message : String(error)],
    };
  }
}

// ============================================================================
// Legacy Mapping Functions (preserved for batch import)
// ============================================================================

/**
 * Map a parsed alto file to a node record for sql.js insertion.
 *
 * @deprecated Use AltoImporter.import() which returns CanonicalNode[]
 */
export function mapToNodeRecord(
  parsed: ParsedAltoFile,
  filePath: string,
  rawFrontmatter: Record<string, unknown>
): NodeRecord {
  const { frontmatter, content, tags, dataType } = parsed;

  // Use deterministic ID based on file path and frontmatter
  const sourceId = generateDeterministicSourceId(
    filePath,
    rawFrontmatter,
    'alto-index',
    content || ''
  );

  // Base node with defaults
  const node: NodeRecord = {
    id: uuidv4(),
    node_type: dataType,
    name: frontmatter.title || 'Untitled',
    content: content || null,
    summary: extractSummary(content),
    latitude: null,
    longitude: null,
    location_name: null,
    location_address: null,
    created_at: getCreatedDate(frontmatter),
    modified_at: getModifiedDate(frontmatter),
    due_at: frontmatter.due_date || null,
    completed_at: null,
    event_start: frontmatter.start_date || null,
    event_end: frontmatter.end_date || null,
    folder: getFolder(frontmatter, dataType),
    tags: tags.length > 0 ? JSON.stringify(tags) : null,
    status: frontmatter.status || null,
    priority: getPriority(frontmatter),
    importance: getImportance(frontmatter, dataType),
    sort_order: 0,
    source: 'alto-index',
    source_id: sourceId,
    source_url: frontmatter.source || frontmatter.link || frontmatter.url || null,
    deleted_at: null,
    version: 1,
  };

  // Type-specific enrichment
  switch (dataType) {
    case 'contacts':
      node.folder = frontmatter.organization || 'Contacts';
      break;

    case 'messages':
      node.folder = frontmatter.is_group ? 'Group Chats' : 'Messages';
      node.summary = frontmatter.participants?.join(', ') || null;
      break;

    case 'calendar':
      node.folder = frontmatter.calendar || 'Calendar';
      if (frontmatter.location) {
        node.location_address = frontmatter.location;
        node.location_name = frontmatter.location.split('\n')[0] || null;
      }
      break;

    case 'reminders':
      node.folder = frontmatter.list || 'Reminders';
      node.status = frontmatter.is_flagged ? 'flagged' : 'pending';
      break;

    case 'safari-history':
    case 'safari-bookmarks':
      node.folder = dataType === 'safari-history' ? 'History' : 'Bookmarks';
      break;
  }

  return node;
}

function extractSummary(content: string | null): string | null {
  if (!content) return null;

  // Get first non-empty line that isn't a heading
  const lines = content.split('\n').filter((line) => {
    const trimmed = line.trim();
    return trimmed && !trimmed.startsWith('#') && !trimmed.startsWith('---');
  });

  const summary = lines[0]?.slice(0, 200) || null;
  return summary;
}

function getCreatedDate(frontmatter: ParsedAltoFile['frontmatter']): string {
  return (
    frontmatter.created ||
    frontmatter.created_date ||
    frontmatter.first_message ||
    frontmatter.start_date ||
    new Date().toISOString()
  );
}

function getModifiedDate(frontmatter: ParsedAltoFile['frontmatter']): string {
  return (
    frontmatter.modified ||
    frontmatter.modified_date ||
    frontmatter.last_modified ||
    frontmatter.last_message ||
    getCreatedDate(frontmatter)
  );
}

function getFolder(
  frontmatter: ParsedAltoFile['frontmatter'],
  dataType: AltoDataType
): string {
  return frontmatter.folder || frontmatter.calendar || frontmatter.list || dataType;
}

function getPriority(frontmatter: ParsedAltoFile['frontmatter']): number {
  if (frontmatter.priority === 'high') return 5;
  if (frontmatter.priority === 'medium') return 3;
  if (frontmatter.priority === 'low') return 1;
  if (frontmatter.is_flagged) return 4;
  return 0;
}

function getImportance(
  frontmatter: ParsedAltoFile['frontmatter'],
  dataType: AltoDataType
): number {
  // Derive importance from data type and attributes
  if (frontmatter.is_flagged) return 4;
  if (frontmatter.attendees && frontmatter.attendees.length > 3) return 3;
  if (dataType === 'calendar') return 2;
  if (dataType === 'reminders') return 2;
  return 1;
}

// ============================================================================
// Batch Import Functions (legacy - uses direct SQL insertion)
// ============================================================================

/**
 * Import alto-index files from provided file contents
 * This is the browser-compatible version that takes pre-loaded content
 *
 * NOTE: For new code, consider using AltoImporter with insertCanonicalNodes.
 */
export function importAltoFiles(
  db: Database,
  files: Array<{ path: string; content: string }>,
  options: ImportOptions = {}
): ImportResult {
  const runId = `alto-run-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const start = performance.now();
  const result: ImportResult = {
    imported: 0,
    skipped: 0,
    errors: [],
    duration: 0,
    runId,
    reconciliation: {
      totalFiles: 0,
      importedByType: {},
      skippedByReason: {},
    },
  };

  const { limit, dataTypes, clearExisting = false, onProgress } = options;

  // Ensure import run metadata tables exist and register the run.
  db.exec(`
    CREATE TABLE IF NOT EXISTS etl_import_runs (
      run_id TEXT PRIMARY KEY,
      source TEXT NOT NULL,
      started_at TEXT NOT NULL DEFAULT (datetime('now')),
      finished_at TEXT,
      status TEXT NOT NULL DEFAULT 'running',
      total_files INTEGER NOT NULL DEFAULT 0,
      imported_count INTEGER NOT NULL DEFAULT 0,
      skipped_count INTEGER NOT NULL DEFAULT 0,
      error_count INTEGER NOT NULL DEFAULT 0,
      options_json TEXT,
      reconciliation_json TEXT
    );
    CREATE TABLE IF NOT EXISTS etl_import_run_types (
      run_id TEXT NOT NULL REFERENCES etl_import_runs(run_id) ON DELETE CASCADE,
      node_type TEXT NOT NULL,
      imported_count INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (run_id, node_type)
    );
  `);
  db.run(
    `INSERT OR REPLACE INTO etl_import_runs (
      run_id, source, status, options_json
    ) VALUES (?, ?, 'running', ?)`,
    [runId, 'alto-index', JSON.stringify(options)]
  );

  // Clear existing alto-index data if requested
  if (clearExisting) {
    db.run(`DELETE FROM nodes WHERE source = 'alto-index'`);
  }

  // Prepare insert statement
  const insertSQL = `
    INSERT OR REPLACE INTO nodes (
      id, node_type, name, content, summary,
      latitude, longitude, location_name, location_address,
      created_at, modified_at, due_at, completed_at,
      event_start, event_end,
      folder, tags, status,
      priority, importance, sort_order,
      source, source_id, source_url,
      deleted_at, version
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  // Stratified sampling: if limit is set, sample proportionally from each data type
  let filesToProcess: Array<{ path: string; content: string }>;
  if (limit && limit < files.length) {
    // Group files by data type (detected from path)
    const byType = new Map<string, Array<{ path: string; content: string }>>();
    for (const file of files) {
      const pathParts = file.path.replace(/^\//, '').split('/');
      const type = pathParts[0] || 'unknown';
      if (!byType.has(type)) byType.set(type, []);
      byType.get(type)!.push(file);
    }

    // Calculate proportional samples per type (minimum 50 per type if available)
    const types = Array.from(byType.keys());
    const minPerType = Math.min(50, Math.floor(limit / types.length));
    let remaining = limit;
    filesToProcess = [];

    // First pass: ensure minimum representation from each type
    for (const type of types) {
      const typeFiles = byType.get(type)!;
      const toTake = Math.min(minPerType, typeFiles.length, remaining);
      filesToProcess.push(...typeFiles.slice(0, toTake));
      remaining -= toTake;
    }

    // Second pass: distribute remaining slots proportionally
    if (remaining > 0) {
      for (const type of types) {
        const typeFiles = byType.get(type)!;
        const alreadyTaken = Math.min(minPerType, typeFiles.length);
        const remainingInType = typeFiles.length - alreadyTaken;
        const proportion =
          remainingInType / (files.length - filesToProcess.length + remainingInType);
        const additional = Math.min(
          Math.floor(remaining * proportion),
          remainingInType
        );
        if (additional > 0) {
          filesToProcess.push(
            ...typeFiles.slice(alreadyTaken, alreadyTaken + additional)
          );
        }
      }
    }
  } else {
    filesToProcess = files;
  }
  const total = filesToProcess.length;
  result.reconciliation!.totalFiles = total;

  for (let i = 0; i < filesToProcess.length; i++) {
    const file = filesToProcess[i]!;

    try {
      const parsed = parseAltoFile(file.content, file.path);

      if (!parsed) {
        result.skipped++;
        result.reconciliation!.skippedByReason.parse_failed =
          (result.reconciliation!.skippedByReason.parse_failed || 0) + 1;
        continue;
      }

      // Filter by data type if specified
      if (dataTypes && !dataTypes.includes(parsed.dataType)) {
        result.skipped++;
        result.reconciliation!.skippedByReason.filtered_data_type =
          (result.reconciliation!.skippedByReason.filtered_data_type || 0) + 1;
        continue;
      }

      // Preserve raw frontmatter for property storage
      const rawFrontmatter = parsed.frontmatter as unknown as Record<
        string,
        unknown
      >;

      const node = mapToNodeRecord(parsed, file.path, rawFrontmatter);

      // Check if already exists
      const existing = db.exec(
        `SELECT id FROM nodes WHERE source = 'alto-index' AND source_id = ?`,
        [node.source_id]
      );

      if (existing.length > 0 && existing[0]!.values.length > 0) {
        // Update existing - use the existing ID
        node.id = existing[0]!.values[0]![0] as string;
      }

      db.run(insertSQL, [
        node.id,
        node.node_type,
        node.name,
        node.content,
        node.summary,
        node.latitude,
        node.longitude,
        node.location_name,
        node.location_address,
        node.created_at,
        node.modified_at,
        node.due_at,
        node.completed_at,
        node.event_start,
        node.event_end,
        node.folder,
        node.tags,
        node.status,
        node.priority,
        node.importance,
        node.sort_order,
        node.source,
        node.source_id,
        node.source_url,
        node.deleted_at,
        node.version,
      ]);

      // Store unknown frontmatter keys in node_properties
      storeNodeProperties(db, node.id, rawFrontmatter);

      result.imported++;
      result.reconciliation!.importedByType[node.node_type] =
        (result.reconciliation!.importedByType[node.node_type] || 0) + 1;

      if (onProgress && i % 100 === 0) {
        onProgress(result.imported, total, file.path);
      }
    } catch (error) {
      result.errors.push(`${file.path}: ${(error as Error).message}`);
      result.skipped++;
      result.reconciliation!.skippedByReason.error =
        (result.reconciliation!.skippedByReason.error || 0) + 1;
    }
  }

  result.duration = performance.now() - start;
  db.run(
    `UPDATE etl_import_runs
      SET finished_at = datetime('now'),
          status = ?,
          total_files = ?,
          imported_count = ?,
          skipped_count = ?,
          error_count = ?,
          reconciliation_json = ?
      WHERE run_id = ?`,
    [
      result.errors.length > 0 ? 'failed' : 'completed',
      total,
      result.imported,
      result.skipped,
      result.errors.length,
      JSON.stringify(result.reconciliation),
      runId,
    ]
  );

  if (result.reconciliation) {
    for (const [nodeType, importedCount] of Object.entries(result.reconciliation.importedByType)) {
      db.run(
        `INSERT OR REPLACE INTO etl_import_run_types (run_id, node_type, imported_count)
         VALUES (?, ?, ?)`,
        [runId, nodeType, importedCount]
      );
    }
  }

  return result;
}

/**
 * Get import statistics for alto-index data
 */
export function getImportStats(db: Database): Record<string, number> {
  const result = db.exec(`
    SELECT node_type, COUNT(*) as count
    FROM nodes
    WHERE source = 'alto-index'
    GROUP BY node_type
    ORDER BY count DESC
  `);

  const stats: Record<string, number> = {};
  if (result.length > 0) {
    for (const row of result[0]!.values) {
      stats[row[0] as string] = row[1] as number;
    }
  }

  // Add total
  const totalResult = db.exec(`
    SELECT COUNT(*) FROM nodes WHERE source = 'alto-index'
  `);
  stats['_total'] = (totalResult[0]?.values[0]?.[0] as number) || 0;

  return stats;
}

/**
 * Clear all alto-index imported data
 */
export function clearAltoIndexData(db: Database): number {
  const before = db.exec(`SELECT COUNT(*) FROM nodes WHERE source = 'alto-index'`);
  const count = (before[0]?.values[0]?.[0] as number) || 0;

  db.run(`DELETE FROM nodes WHERE source = 'alto-index'`);

  return count;
}
