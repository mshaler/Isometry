/**
 * Type Mapping: CanonicalNode/CanonicalEdge → Isometry Schema
 *
 * This module bridges the ETL canonical format to Isometry's SQLite schema.
 * Supports both legacy `nodes`/`edges` tables and new `cards`/`connections` tables.
 */

import { CanonicalNode, CanonicalEdge } from './types';

// =============================================================================
// Isometry Schema Types (matching schema.sql)
// =============================================================================

/**
 * Isometry Node (legacy nodes table)
 */
export interface IsometryNode {
  id: string;
  node_type: string;
  name: string;
  content: string | null;
  summary: string | null;

  // LATCH: Location
  latitude: number | null;
  longitude: number | null;
  location_name: string | null;
  location_address: string | null;

  // LATCH: Time
  created_at: string;
  modified_at: string;
  due_at: string | null;
  completed_at: string | null;
  event_start: string | null;
  event_end: string | null;

  // LATCH: Category
  folder: string | null;
  tags: string | null; // JSON array
  status: string | null;

  // LATCH: Hierarchy
  priority: number;
  importance: number;
  sort_order: number;

  // Metadata
  source: string | null;
  source_id: string | null;
  source_url: string | null;
  deleted_at: string | null;
  version: number;
}

/**
 * Isometry Edge (edges table)
 */
export interface IsometryEdge {
  id: string;
  edge_type: string;
  source_id: string;
  target_id: string;
  label: string | null;
  weight: number;
  directed: number;
  sequence_order: number | null;
  channel: string | null;
  timestamp: string | null;
  subject: string | null;
  created_at: string;
}

/**
 * Isometry Card (new cards table - Phase 84)
 */
export interface IsometryCard {
  id: string;
  card_type: 'note' | 'person' | 'event' | 'resource';
  name: string;
  content: string | null;
  summary: string | null;

  // LATCH: Location
  latitude: number | null;
  longitude: number | null;
  location_name: string | null;

  // LATCH: Time
  created_at: string;
  modified_at: string;
  due_at: string | null;
  completed_at: string | null;
  event_start: string | null;
  event_end: string | null;

  // LATCH: Category
  folder: string | null;
  tags: string | null; // JSON array
  status: string | null;

  // LATCH: Hierarchy
  priority: number;
  sort_order: number;

  // Resource-specific
  url: string | null;
  mime_type: string | null;

  // Person-specific
  is_collective: number;

  // Source tracking
  source: string | null;
  source_id: string | null;

  // Lifecycle
  deleted_at: string | null;
  version: number;
  sync_status: string;
}

// =============================================================================
// Mapping Functions
// =============================================================================

/**
 * Map CanonicalNode → IsometryNode
 */
export function canonicalNodeToIsometryNode(node: CanonicalNode): IsometryNode {
  return {
    id: node.id,
    node_type: node.nodeType,
    name: node.name,
    content: node.content || null,
    summary: node.summary || null,

    // LATCH: Location
    latitude: node.location?.latitude || null,
    longitude: node.location?.longitude || null,
    location_name: node.location?.name || null,
    location_address: node.location?.address || null,

    // LATCH: Time
    created_at: node.time.created.toISOString(),
    modified_at: node.time.modified.toISOString(),
    due_at: node.time.due?.toISOString() || null,
    completed_at: node.time.completed?.toISOString() || null,
    event_start: node.time.eventStart?.toISOString() || null,
    event_end: node.time.eventEnd?.toISOString() || null,

    // LATCH: Category
    folder: node.category.hierarchy.join('/') || null,
    tags: node.category.tags.length > 0 ? JSON.stringify(node.category.tags) : null,
    status: node.category.status || null,

    // LATCH: Hierarchy
    priority: node.hierarchy.priority,
    importance: node.hierarchy.importance,
    sort_order: node.hierarchy.sortOrder,

    // Metadata
    source: node.source,
    source_id: node.sourceId,
    source_url: node.sourceUrl || null,
    deleted_at: null,
    version: 1,
  };
}

/**
 * Map CanonicalNode → IsometryCard (new schema)
 */
export function canonicalNodeToIsometryCard(node: CanonicalNode): IsometryCard {
  // Map nodeType to card_type
  const cardTypeMap: Record<string, 'note' | 'person' | 'event' | 'resource'> = {
    note: 'note',
    task: 'note', // Tasks are notes with due dates
    project: 'note', // Folders become notes with special handling
    contact: 'person',
    event: 'event',
    resource: 'resource',
  };

  return {
    id: node.id,
    card_type: cardTypeMap[node.nodeType] || 'note',
    name: node.name,
    content: node.content || null,
    summary: node.summary || null,

    // LATCH: Location
    latitude: node.location?.latitude || null,
    longitude: node.location?.longitude || null,
    location_name: node.location?.name || null,

    // LATCH: Time
    created_at: node.time.created.toISOString(),
    modified_at: node.time.modified.toISOString(),
    due_at: node.time.due?.toISOString() || null,
    completed_at: node.time.completed?.toISOString() || null,
    event_start: node.time.eventStart?.toISOString() || null,
    event_end: node.time.eventEnd?.toISOString() || null,

    // LATCH: Category
    folder: node.category.hierarchy.join('/') || null,
    tags: node.category.tags.length > 0 ? JSON.stringify(node.category.tags) : null,
    status: node.category.status || null,

    // LATCH: Hierarchy
    priority: node.hierarchy.priority,
    sort_order: node.hierarchy.sortOrder,

    // Resource-specific (default values)
    url: node.sourceUrl || null,
    mime_type: null,

    // Person-specific
    is_collective: 0,

    // Source tracking
    source: node.source,
    source_id: node.sourceId,

    // Lifecycle
    deleted_at: null,
    version: 1,
    sync_status: 'pending',
  };
}

/**
 * Map CanonicalEdge → IsometryEdge
 */
export function canonicalEdgeToIsometryEdge(edge: CanonicalEdge): IsometryEdge {
  return {
    id: edge.id,
    edge_type: edge.edgeType,
    source_id: edge.sourceId,
    target_id: edge.targetId,
    label: edge.label || null,
    weight: edge.weight,
    directed: edge.directed ? 1 : 0,
    sequence_order: edge.sequenceOrder || null,
    channel: edge.channel || null,
    timestamp: edge.timestamp?.toISOString() || null,
    subject: edge.subject || null,
    created_at: new Date().toISOString(),
  };
}

// =============================================================================
// SQL Generation Helpers
// =============================================================================

/**
 * Generate INSERT OR REPLACE SQL for a node
 */
export function generateNodeUpsertSQL(node: IsometryNode): {
  sql: string;
  params: unknown[];
} {
  const sql = `
    INSERT OR REPLACE INTO nodes (
      id, node_type, name, content, summary,
      latitude, longitude, location_name, location_address,
      created_at, modified_at, due_at, completed_at, event_start, event_end,
      folder, tags, status,
      priority, importance, sort_order,
      source, source_id, source_url, deleted_at, version
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const params = [
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
  ];

  return { sql, params };
}

/**
 * Generate INSERT OR REPLACE SQL for an edge
 */
export function generateEdgeUpsertSQL(edge: IsometryEdge): {
  sql: string;
  params: unknown[];
} {
  const sql = `
    INSERT OR REPLACE INTO edges (
      id, edge_type, source_id, target_id,
      label, weight, directed, sequence_order,
      channel, timestamp, subject, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const params = [
    edge.id,
    edge.edge_type,
    edge.source_id,
    edge.target_id,
    edge.label,
    edge.weight,
    edge.directed,
    edge.sequence_order,
    edge.channel,
    edge.timestamp,
    edge.subject,
    edge.created_at,
  ];

  return { sql, params };
}

/**
 * Generate batch upsert for multiple nodes
 */
export function generateBatchNodeUpsertSQL(nodes: IsometryNode[]): {
  sql: string;
  params: unknown[][];
} {
  const sql = `
    INSERT OR REPLACE INTO nodes (
      id, node_type, name, content, summary,
      latitude, longitude, location_name, location_address,
      created_at, modified_at, due_at, completed_at, event_start, event_end,
      folder, tags, status,
      priority, importance, sort_order,
      source, source_id, source_url, deleted_at, version
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const params = nodes.map((node) => [
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

  return { sql, params };
}
