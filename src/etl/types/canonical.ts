/**
 * Canonical Node Schema for Isometry ETL
 *
 * This is the single source of truth for data entering the system.
 * All importers MUST output this format.
 *
 * LATCH Mapping:
 * - L (Location): latitude, longitude, locationName, locationAddress
 * - A (Alphabet): name (primary sort key)
 * - T (Time): createdAt, modifiedAt, dueAt, completedAt, eventStart, eventEnd
 * - C (Category): nodeType, folder, tags, status
 * - H (Hierarchy): priority, importance, sortOrder
 *
 * @module etl/types/canonical
 */

import { z } from 'zod';

// ISO 8601 datetime string pattern (nullable variant)
const isoDatetimeNullable = z.string().datetime().nullable();

/**
 * Zod schema for canonical Node validation.
 * All ETL importers must produce data conforming to this schema.
 */
export const CanonicalNodeSchema = z.object({
  // Core Identity
  id: z.string().uuid(),
  nodeType: z.string().min(1).default('note'),
  name: z.string().min(1),
  content: z.string().nullable().default(null),
  summary: z.string().nullable().default(null),

  // LATCH: Location
  latitude: z.number().nullable().default(null),
  longitude: z.number().nullable().default(null),
  locationName: z.string().nullable().default(null),
  locationAddress: z.string().nullable().default(null),

  // LATCH: Time (ISO 8601 strings for JSON serialization)
  createdAt: z.string().datetime(),
  modifiedAt: z.string().datetime(),
  dueAt: isoDatetimeNullable.default(null),
  completedAt: isoDatetimeNullable.default(null),
  eventStart: isoDatetimeNullable.default(null),
  eventEnd: isoDatetimeNullable.default(null),

  // LATCH: Category
  folder: z.string().nullable().default(null),
  tags: z.array(z.string()).default([]),
  status: z.string().nullable().default(null),

  // LATCH: Hierarchy
  priority: z.number().int().min(0).max(5).default(0),
  importance: z.number().int().min(0).max(5).default(0),
  sortOrder: z.number().int().default(0),

  // Grid positioning (SuperGrid)
  gridX: z.number().default(0),
  gridY: z.number().default(0),

  // Provenance
  source: z.string().nullable().default(null),
  sourceId: z.string().nullable().default(null),
  sourceUrl: z.string().url().nullable().default(null),

  // Lifecycle
  deletedAt: isoDatetimeNullable.default(null),
  version: z.number().int().positive().default(1),

  // Extension point for format-specific metadata
  properties: z.record(z.unknown()).default({}),
});

/**
 * TypeScript type inferred from Zod schema.
 * Use this for type-safe handling of canonical nodes.
 */
export type CanonicalNode = z.infer<typeof CanonicalNodeSchema>;

/**
 * SQL Column Mapping: camelCase TypeScript -> snake_case SQL
 * @deprecated Use CARDS_SQL_COLUMN_MAP for Phase 84+ code.
 * Matches the legacy nodes table schema.
 *
 * Note: 'properties' is excluded as it maps to the node_properties EAV table,
 * not a column in the nodes table.
 */
export const SQL_COLUMN_MAP: Record<keyof Omit<CanonicalNode, 'properties'>, string> = {
  id: 'id',
  nodeType: 'node_type',
  name: 'name',
  content: 'content',
  summary: 'summary',
  latitude: 'latitude',
  longitude: 'longitude',
  locationName: 'location_name',
  locationAddress: 'location_address',
  createdAt: 'created_at',
  modifiedAt: 'modified_at',
  dueAt: 'due_at',
  completedAt: 'completed_at',
  eventStart: 'event_start',
  eventEnd: 'event_end',
  folder: 'folder',
  tags: 'tags',
  status: 'status',
  priority: 'priority',
  importance: 'importance',
  sortOrder: 'sort_order',
  gridX: 'grid_x',
  gridY: 'grid_y',
  source: 'source',
  sourceId: 'source_id',
  sourceUrl: 'source_url',
  deletedAt: 'deleted_at',
  version: 'version',
};

/**
 * Cards table SQL columns (Phase 84+).
 * Matches the cards table schema - excludes columns not in cards:
 * - location_address (removed)
 * - importance (removed - use priority only)
 * - grid_x/grid_y (removed - SuperGrid manages layout)
 * - source_url (removed - use url for resources)
 *
 * Adds cards-specific columns:
 * - sync_status (new)
 * - url (for resource cards)
 * - mime_type (for resource cards)
 * - is_collective (for person cards)
 */
export const CARDS_SQL_COLUMNS = [
  'id',
  'card_type',
  'name',
  'content',
  'summary',
  'latitude',
  'longitude',
  'location_name',
  'created_at',
  'modified_at',
  'due_at',
  'completed_at',
  'event_start',
  'event_end',
  'folder',
  'tags',
  'status',
  'priority',
  'sort_order',
  'url',
  'mime_type',
  'is_collective',
  'source',
  'source_id',
  'deleted_at',
  'version',
  'sync_status',
] as const;

/**
 * Map nodeType values to card_type values.
 * Cards have only 4 types: note, person, event, resource.
 */
export function mapNodeTypeToCardType(nodeType: string): 'note' | 'person' | 'event' | 'resource' {
  const mapping: Record<string, 'note' | 'person' | 'event' | 'resource'> = {
    note: 'note',
    document: 'note',
    task: 'note',
    project: 'note',
    person: 'person',
    contact: 'person',
    event: 'event',
    meeting: 'event',
    resource: 'resource',
    link: 'resource',
    file: 'resource',
    image: 'resource',
  };
  return mapping[nodeType.toLowerCase()] ?? 'note';
}

/**
 * Convert CanonicalNode to cards table SQL record.
 * Maps legacy node fields to new cards schema.
 */
export function toCardsSQLRecord(node: CanonicalNode): Record<string, unknown> {
  const cardType = mapNodeTypeToCardType(node.nodeType);

  return {
    id: node.id,
    card_type: cardType,
    name: node.name,
    content: node.content,
    summary: node.summary,
    latitude: node.latitude,
    longitude: node.longitude,
    location_name: node.locationName,
    created_at: node.createdAt,
    modified_at: node.modifiedAt,
    due_at: node.dueAt,
    completed_at: node.completedAt,
    event_start: node.eventStart,
    event_end: node.eventEnd,
    folder: node.folder,
    tags: node.tags && node.tags.length > 0 ? JSON.stringify(node.tags) : null,
    status: node.status,
    priority: node.priority ?? 0,
    sort_order: node.sortOrder ?? 0,
    // url: populated from sourceUrl for resource types
    url: cardType === 'resource' ? node.sourceUrl : null,
    mime_type: null, // Not available in CanonicalNode
    is_collective: 0, // Default to individual
    source: node.source,
    source_id: node.sourceId,
    deleted_at: node.deletedAt,
    version: node.version ?? 1,
    sync_status: 'pending',
  };
}

/**
 * Convert CanonicalNode to SQL-compatible record (snake_case keys).
 *
 * Handles special conversions:
 * - tags array -> JSON string
 * - Empty tags -> null
 *
 * @param node - Validated CanonicalNode
 * @returns Record with snake_case keys for SQL insertion
 */
export function toSQLRecord(node: CanonicalNode): Record<string, unknown> {
  const record: Record<string, unknown> = {};
  for (const [tsKey, sqlKey] of Object.entries(SQL_COLUMN_MAP)) {
    const value = node[tsKey as keyof Omit<CanonicalNode, 'properties'>];
    // Convert tags array to JSON string for SQL storage
    if (tsKey === 'tags') {
      record[sqlKey] = value && Array.isArray(value) && value.length > 0
        ? JSON.stringify(value)
        : null;
    } else {
      record[sqlKey] = value;
    }
  }
  return record;
}

/**
 * Convert SQL record (snake_case keys) to CanonicalNode.
 *
 * Handles special conversions:
 * - JSON string -> tags array
 * - null tags -> empty array
 * - Validates result against schema
 *
 * @param record - SQL query result row
 * @returns Validated CanonicalNode
 * @throws ZodError if record doesn't conform to schema
 */
export function fromSQLRecord(record: Record<string, unknown>): CanonicalNode {
  const node: Partial<CanonicalNode> = {};

  for (const [tsKey, sqlKey] of Object.entries(SQL_COLUMN_MAP)) {
    const value = record[sqlKey];
    // Parse tags JSON string back to array
    if (tsKey === 'tags') {
      node.tags = value ? JSON.parse(value as string) : [];
    } else {
      (node as Record<string, unknown>)[tsKey] = value;
    }
  }

  // Properties come from node_properties table, not included in basic SQL record
  node.properties = {};

  return CanonicalNodeSchema.parse(node);
}

/**
 * Partial schema for creating new nodes with auto-generated fields.
 * Omits id (generated), createdAt/modifiedAt (auto-set), version (starts at 1).
 */
export const CanonicalNodeInputSchema = CanonicalNodeSchema.omit({
  id: true,
  createdAt: true,
  modifiedAt: true,
  version: true,
}).partial({
  nodeType: true,
  content: true,
  summary: true,
  latitude: true,
  longitude: true,
  locationName: true,
  locationAddress: true,
  dueAt: true,
  completedAt: true,
  eventStart: true,
  eventEnd: true,
  folder: true,
  tags: true,
  status: true,
  priority: true,
  importance: true,
  sortOrder: true,
  gridX: true,
  gridY: true,
  source: true,
  sourceId: true,
  sourceUrl: true,
  deletedAt: true,
  properties: true,
});

export type CanonicalNodeInput = z.infer<typeof CanonicalNodeInputSchema>;
