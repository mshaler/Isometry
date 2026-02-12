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
 */

import type { Database } from 'sql.js';
import { parseAltoFile, generateSourceId, type ParsedAltoFile, type AltoDataType } from './alto-parser';
import { v4 as uuidv4 } from 'uuid';

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
// Mapping Functions
// ============================================================================

/**
 * Map a parsed alto file to a node record for sql.js insertion
 */
export function mapToNodeRecord(parsed: ParsedAltoFile): NodeRecord {
  const { frontmatter, content, tags, dataType } = parsed;
  const sourceId = generateSourceId(dataType, frontmatter);

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
  const lines = content.split('\n').filter(line => {
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

function getFolder(frontmatter: ParsedAltoFile['frontmatter'], dataType: AltoDataType): string {
  return frontmatter.folder || frontmatter.calendar || frontmatter.list || dataType;
}

function getPriority(frontmatter: ParsedAltoFile['frontmatter']): number {
  if (frontmatter.priority === 'high') return 5;
  if (frontmatter.priority === 'medium') return 3;
  if (frontmatter.priority === 'low') return 1;
  if (frontmatter.is_flagged) return 4;
  return 0;
}

function getImportance(frontmatter: ParsedAltoFile['frontmatter'], dataType: AltoDataType): number {
  // Derive importance from data type and attributes
  if (frontmatter.is_flagged) return 4;
  if (frontmatter.attendees && frontmatter.attendees.length > 3) return 3;
  if (dataType === 'calendar') return 2;
  if (dataType === 'reminders') return 2;
  return 1;
}

// ============================================================================
// Import Functions
// ============================================================================

/**
 * Import alto-index files from provided file contents
 * This is the browser-compatible version that takes pre-loaded content
 */
export function importAltoFiles(
  db: Database,
  files: Array<{ path: string; content: string }>,
  options: ImportOptions = {}
): ImportResult {
  const start = performance.now();
  const result: ImportResult = {
    imported: 0,
    skipped: 0,
    errors: [],
    duration: 0,
  };

  const { limit, dataTypes, clearExisting = false, onProgress } = options;

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
  // to ensure all datasets are represented
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
        const proportion = remainingInType / (files.length - filesToProcess.length + remainingInType);
        const additional = Math.min(Math.floor(remaining * proportion), remainingInType);
        if (additional > 0) {
          filesToProcess.push(...typeFiles.slice(alreadyTaken, alreadyTaken + additional));
        }
      }
    }
  } else {
    filesToProcess = files;
  }
  const total = filesToProcess.length;

  for (let i = 0; i < filesToProcess.length; i++) {
    const file = filesToProcess[i]!;

    try {
      const parsed = parseAltoFile(file.content, file.path);

      if (!parsed) {
        result.skipped++;
        continue;
      }

      // Filter by data type if specified
      if (dataTypes && !dataTypes.includes(parsed.dataType)) {
        result.skipped++;
        continue;
      }

      const node = mapToNodeRecord(parsed);

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

      result.imported++;

      if (onProgress && i % 100 === 0) {
        onProgress(result.imported, total, file.path);
      }
    } catch (error) {
      result.errors.push(`${file.path}: ${(error as Error).message}`);
      result.skipped++;
    }
  }

  result.duration = performance.now() - start;
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
