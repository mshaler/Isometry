// Node (Card) types
//
// @deprecated This file is being replaced by card.ts in Phase 84.
// Use Card, Connection, and related types from './card' instead.
// Migration: node_type -> card_type, edges -> connections

// Re-export new types for gradual migration
export type { Card, CardType, Connection } from './card';
export { isNote, isPerson, isEvent, isResource, rowToCard, rowToConnection } from './card';

/**
 * @deprecated Use CardType from './card' instead.
 * Maps: task/project/notebook -> 'note', contact -> 'person'
 */
export type NodeType = 'note' | 'task' | 'contact' | 'event' | 'project' | 'resource' | 'notebook';

/**
 * @deprecated Use TaskStatus from './card' instead.
 */
export type TaskStatus = 'active' | 'pending' | 'completed' | 'archived';

/**
 * @deprecated Use Connection from './card' instead.
 * The new model uses label (string) instead of edge_type (enum).
 */
export type EdgeType = 'LINK' | 'NEST' | 'SEQUENCE' | 'AFFINITY';

/**
 * @deprecated Use Card from './card' instead.
 * This interface will be removed in a future version.
 */
export interface Node {
  id: string;
  nodeType: NodeType;
  name: string;
  content: string | null;
  summary: string | null;

  // LATCH: Location
  latitude: number | null;
  longitude: number | null;
  locationName: string | null;
  /** @deprecated Removed in cards model */
  locationAddress: string | null;

  // LATCH: Time
  createdAt: string;
  modifiedAt: string;
  dueAt: string | null;
  completedAt: string | null;
  eventStart: string | null;
  eventEnd: string | null;

  // LATCH: Category
  folder: string | null;
  tags: string[];
  status: TaskStatus | null;

  // LATCH: Hierarchy
  priority: number;
  /** @deprecated Removed in cards model (redundant with priority) */
  importance: number;
  sortOrder: number;

  // Metadata
  source: string | null;
  sourceId: string | null;
  /** @deprecated Use url field on ResourceCard instead */
  sourceUrl: string | null;
  deletedAt: string | null;
  version: number;
}

/**
 * @deprecated Use Connection from './card' instead.
 */
export interface Edge {
  id: string;
  edgeType: EdgeType;
  sourceId: string;
  targetId: string;
  label: string | null;
  weight: number;
  /** @deprecated Removed in connections model (direction is view concern) */
  directed: boolean;
  /** @deprecated Removed - use sort_order on cards */
  sequenceOrder: number | null;
  /** @deprecated Removed - use via_card */
  channel: string | null;
  /** @deprecated Removed - use via_card's created_at */
  timestamp: string | null;
  /** @deprecated Removed - use via_card's name */
  subject: string | null;
  createdAt: string;
}

/**
 * @deprecated Use rowToCard from './card' instead.
 */
export function rowToNode(row: Record<string, unknown>): Node {
  return {
    id: row.id as string,
    nodeType: row.node_type as NodeType,
    name: row.name as string,
    content: row.content as string | null,
    summary: row.summary as string | null,
    latitude: row.latitude as number | null,
    longitude: row.longitude as number | null,
    locationName: row.location_name as string | null,
    locationAddress: row.location_address as string | null,
    createdAt: row.created_at as string,
    modifiedAt: row.modified_at as string,
    dueAt: row.due_at as string | null,
    completedAt: row.completed_at as string | null,
    eventStart: row.event_start as string | null,
    eventEnd: row.event_end as string | null,
    folder: row.folder as string | null,
    tags: row.tags ? JSON.parse(row.tags as string) : [],
    status: row.status as TaskStatus | null,
    priority: (row.priority as number) ?? 0,
    importance: (row.importance as number) ?? 0,
    sortOrder: (row.sort_order as number) ?? 0,
    source: row.source as string | null,
    sourceId: row.source_id as string | null,
    sourceUrl: row.source_url as string | null,
    deletedAt: row.deleted_at as string | null,
    version: (row.version as number) ?? 1,
  };
}

// ============================================
// Migration Helpers
// ============================================

import type { Card, CardType } from './card';

/**
 * Convert legacy Node to new Card format.
 * Use this during migration period.
 */
export function nodeToCard(node: Node): Card {
  // Map old node_type to new card_type
  const typeMap: Record<NodeType, CardType> = {
    note: 'note',
    task: 'note',
    project: 'note',
    notebook: 'note',
    contact: 'person',
    event: 'event',
    resource: 'resource',
  };

  const cardType = typeMap[node.nodeType] || 'note';

  const base = {
    id: node.id,
    name: node.name,
    content: node.content,
    summary: node.summary,
    latitude: node.latitude,
    longitude: node.longitude,
    locationName: node.locationName,
    createdAt: node.createdAt,
    modifiedAt: node.modifiedAt,
    dueAt: node.dueAt,
    completedAt: node.completedAt,
    eventStart: node.eventStart,
    eventEnd: node.eventEnd,
    folder: node.folder,
    tags: node.tags,
    status: node.status,
    priority: node.priority,
    sortOrder: node.sortOrder,
    source: node.source,
    sourceId: node.sourceId,
    deletedAt: node.deletedAt,
    version: node.version,
    syncStatus: 'pending' as const,
  };

  switch (cardType) {
    case 'person':
      return { ...base, cardType: 'person', isCollective: false, url: null, mimeType: null };
    case 'event':
      return { ...base, cardType: 'event', isCollective: false, url: null, mimeType: null };
    case 'resource':
      return { ...base, cardType: 'resource', url: node.sourceUrl, mimeType: null, isCollective: false };
    default:
      return { ...base, cardType: 'note', isCollective: false, url: null, mimeType: null };
  }
}
