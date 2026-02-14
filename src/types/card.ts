/**
 * Card and Connection types for Isometry v4 data model
 *
 * Cards: The four entity types (note, person, event, resource)
 * Connections: Lightweight relationships with optional via_card bridging
 *
 * Key principles:
 * - A Card is a Card (no node/edge distinction at data level)
 * - Schema stores facts, views create meaning
 * - Connections are rich through what they bridge (via_card_id)
 */

// ============================================
// Card Types
// ============================================

/** The four card types - constrained, no expansion */
export type CardType = 'note' | 'person' | 'event' | 'resource';

/** Task status values (unchanged from prior model) */
export type TaskStatus = 'active' | 'pending' | 'completed' | 'archived' | 'blocked' | 'in_progress';

/** Sync status for offline-first support */
export type SyncStatus = 'pending' | 'synced' | 'conflict' | 'error';

// ============================================
// Base Card Interface
// ============================================

/** Base properties shared by all card types */
interface BaseCard {
  id: string;
  name: string;
  content: string | null;
  summary: string | null;

  // LATCH: Location
  latitude: number | null;
  longitude: number | null;
  locationName: string | null;

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
  sortOrder: number;

  // Source tracking
  source: string | null;
  sourceId: string | null;

  // Lifecycle
  deletedAt: string | null;
  version: number;
  syncStatus: SyncStatus;
}

// ============================================
// Discriminated Union Card Types
// ============================================

/** Note card - content carrier, freeform, default type */
export interface NoteCard extends BaseCard {
  cardType: 'note';
  // Notes use base fields only
  url: null;
  mimeType: null;
  isCollective: false;
}

/** Person card - anchor point, thin, positional */
export interface PersonCard extends BaseCard {
  cardType: 'person';
  /** Is this a group/organization (true) or individual (false) */
  isCollective: boolean;
  url: null;
  mimeType: null;
}

/** Event card - anchor point, time-positioned */
export interface EventCard extends BaseCard {
  cardType: 'event';
  /** Event start is required for events (though may be null in DB for tasks) */
  eventStart: string | null;
  eventEnd: string | null;
  url: null;
  mimeType: null;
  isCollective: false;
}

/** Resource card - content carrier, external reference */
export interface ResourceCard extends BaseCard {
  cardType: 'resource';
  /** URL to external resource */
  url: string | null;
  /** MIME type of resource */
  mimeType: string | null;
  isCollective: false;
}

/** Union type: all possible card types */
export type Card = NoteCard | PersonCard | EventCard | ResourceCard;

// ============================================
// Connection Interface
// ============================================

/**
 * Connection between two cards.
 *
 * Unlike the old edges table:
 * - No directed column (direction is view concern)
 * - No edge_type enum (label is user-provided string)
 * - via_card_id enables rich connections through bridge cards
 */
export interface Connection {
  id: string;
  sourceId: string;
  targetId: string;
  /** Optional bridge card that characterizes this connection */
  viaCardId: string | null;
  /** User-provided label (schema-on-read, not an enum) */
  label: string | null;
  /** Weight for graph algorithms (0-1) */
  weight: number;
  createdAt: string;
}

// ============================================
// Type Guards
// ============================================

/** Type guard for NoteCard */
export function isNote(card: Card): card is NoteCard {
  return card.cardType === 'note';
}

/** Type guard for PersonCard */
export function isPerson(card: Card): card is PersonCard {
  return card.cardType === 'person';
}

/** Type guard for EventCard */
export function isEvent(card: Card): card is EventCard {
  return card.cardType === 'event';
}

/** Type guard for ResourceCard */
export function isResource(card: Card): card is ResourceCard {
  return card.cardType === 'resource';
}

/** Check if a card type string is valid */
export function isValidCardType(type: string): type is CardType {
  return ['note', 'person', 'event', 'resource'].includes(type);
}

// ============================================
// Row Converters
// ============================================

/**
 * Convert database row to typed Card object.
 * Handles the discriminated union based on card_type column.
 */
export function rowToCard(row: Record<string, unknown>): Card {
  const cardType = row.card_type as CardType;
  const tags = row.tags ? (typeof row.tags === 'string' ? JSON.parse(row.tags) : row.tags) : [];

  const base: Omit<BaseCard, 'syncStatus'> & { syncStatus: SyncStatus } = {
    id: row.id as string,
    name: row.name as string,
    content: row.content as string | null,
    summary: row.summary as string | null,
    latitude: row.latitude as number | null,
    longitude: row.longitude as number | null,
    locationName: row.location_name as string | null,
    createdAt: row.created_at as string,
    modifiedAt: row.modified_at as string,
    dueAt: row.due_at as string | null,
    completedAt: row.completed_at as string | null,
    eventStart: row.event_start as string | null,
    eventEnd: row.event_end as string | null,
    folder: row.folder as string | null,
    tags,
    status: row.status as TaskStatus | null,
    priority: (row.priority as number) ?? 0,
    sortOrder: (row.sort_order as number) ?? 0,
    source: row.source as string | null,
    sourceId: row.source_id as string | null,
    deletedAt: row.deleted_at as string | null,
    version: (row.version as number) ?? 1,
    syncStatus: (row.sync_status as SyncStatus) ?? 'pending',
  };

  switch (cardType) {
    case 'person':
      return {
        ...base,
        cardType: 'person',
        isCollective: Boolean(row.is_collective),
        url: null,
        mimeType: null,
      };
    case 'event':
      return {
        ...base,
        cardType: 'event',
        url: null,
        mimeType: null,
        isCollective: false,
      };
    case 'resource':
      return {
        ...base,
        cardType: 'resource',
        url: row.url as string | null,
        mimeType: row.mime_type as string | null,
        isCollective: false,
      };
    case 'note':
    default:
      return {
        ...base,
        cardType: 'note',
        url: null,
        mimeType: null,
        isCollective: false,
      };
  }
}

/**
 * Convert database row to Connection object.
 */
export function rowToConnection(row: Record<string, unknown>): Connection {
  return {
    id: row.id as string,
    sourceId: row.source_id as string,
    targetId: row.target_id as string,
    viaCardId: row.via_card_id as string | null,
    label: row.label as string | null,
    weight: (row.weight as number) ?? 1.0,
    createdAt: row.created_at as string,
  };
}

// ============================================
// Card to Row Converter (for inserts/updates)
// ============================================

/**
 * Convert Card object to database row format.
 */
export function cardToRow(card: Card): Record<string, unknown> {
  return {
    id: card.id,
    card_type: card.cardType,
    name: card.name,
    content: card.content,
    summary: card.summary,
    latitude: card.latitude,
    longitude: card.longitude,
    location_name: card.locationName,
    created_at: card.createdAt,
    modified_at: card.modifiedAt,
    due_at: card.dueAt,
    completed_at: card.completedAt,
    event_start: card.eventStart,
    event_end: card.eventEnd,
    folder: card.folder,
    tags: JSON.stringify(card.tags),
    status: card.status,
    priority: card.priority,
    sort_order: card.sortOrder,
    url: isResource(card) ? card.url : null,
    mime_type: isResource(card) ? card.mimeType : null,
    is_collective: isPerson(card) ? (card.isCollective ? 1 : 0) : 0,
    source: card.source,
    source_id: card.sourceId,
    deleted_at: card.deletedAt,
    version: card.version,
    sync_status: card.syncStatus,
  };
}
