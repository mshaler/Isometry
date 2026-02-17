/**
 * Isometry ETL Core Types
 *
 * Canonical intermediate format for all source adapters.
 * Source adapters transform platform-specific data into these types,
 * then the NodeWriter persists them to Isometry's SQLite.
 */

// =============================================================================
// LATCH Axes - The Five Organizing Principles
// =============================================================================

/** Location data (LATCH: L) */
export interface LatchLocation {
  latitude?: number;
  longitude?: number;
  name?: string;
  address?: string;
}

/** Time data (LATCH: T) */
export interface LatchTime {
  created: Date;
  modified: Date;
  due?: Date;
  completed?: Date;
  eventStart?: Date;
  eventEnd?: Date;
}

/** Category data (LATCH: C) */
export interface LatchCategory {
  /** Folder hierarchy from root to leaf, e.g., ["Family", "Stacey"] */
  hierarchy: string[];
  /** Tags without # prefix */
  tags: string[];
  /** Status if applicable */
  status?: 'active' | 'pending' | 'completed' | 'archived';
}

/** Hierarchy/ranking data (LATCH: H) */
export interface LatchHierarchy {
  priority: number; // 0-5, higher = more important
  importance: number; // Computed from graph centrality
  sortOrder: number; // Manual ordering within a list
}

// =============================================================================
// Canonical Node Format
// =============================================================================

export interface CanonicalNode {
  /** Namespaced ID: "source:local_id", e.g., "apple-notes:138083" */
  id: string;

  /** Source identifier for filtering and re-sync */
  source: SourceType;

  /** Original ID in source system */
  sourceId: string;

  /** URL to open in source application, if available */
  sourceUrl?: string;

  /** Node type classification */
  nodeType: NodeType;

  /** Display name / title */
  name: string;

  /** Rich content (Markdown preferred, HTML accepted) */
  content?: string;

  /** AI-generated or extracted summary */
  summary?: string;

  /** LATCH properties */
  location?: LatchLocation;
  time: LatchTime;
  category: LatchCategory;
  hierarchy: LatchHierarchy;

  /** Raw metadata from source (for debugging/future use) */
  sourceMeta?: Record<string, unknown>;
}

export type SourceType =
  | 'apple-notes'
  | 'apple-reminders'
  | 'apple-calendar'
  | 'apple-contacts'
  | 'obsidian'
  | 'notion'
  | 'manual';

export type NodeType =
  | 'note'
  | 'task'
  | 'event'
  | 'contact'
  | 'project'
  | 'resource';

// =============================================================================
// Canonical Edge Format
// =============================================================================

export interface CanonicalEdge {
  /** Namespaced ID */
  id: string;

  /** GRAPH edge type */
  edgeType: EdgeType;

  /** Source node ID (namespaced) */
  sourceId: string;

  /** Target node ID (namespaced) */
  targetId: string;

  /** Human-readable label */
  label?: string;

  /** Relationship strength 0-1 */
  weight: number;

  /** Is this a directed relationship? */
  directed: boolean;

  /** For SEQUENCE edges: order in sequence */
  sequenceOrder?: number;

  /** For communication edges */
  channel?: string;
  timestamp?: Date;
  subject?: string;
}

export type EdgeType =
  | 'LINK' // Explicit reference between nodes
  | 'NEST' // Containment (folder contains note)
  | 'SEQUENCE' // Ordered relationship (task dependencies)
  | 'AFFINITY'; // Computed similarity

// =============================================================================
// Source Adapter Interface
// =============================================================================

export interface SyncState {
  /** Last successful sync timestamp */
  lastSync?: Date;

  /** Watermark for incremental sync (source-specific) */
  watermark?: string;

  /** Number of items synced */
  itemCount: number;

  /** Any errors from last sync */
  lastError?: string;
}

export interface SyncResult {
  /** Nodes to upsert */
  nodes: CanonicalNode[];

  /** Edges to upsert */
  edges: CanonicalEdge[];

  /** IDs of nodes deleted in source */
  deletedIds: string[];

  /** Updated sync state */
  syncState: SyncState;
}

export interface SourceAdapter {
  /** Unique identifier for this source */
  readonly sourceType: SourceType;

  /** Human-readable name */
  readonly displayName: string;

  /** Check if source is available on this platform */
  isAvailable(): Promise<boolean>;

  /** Perform full sync (first run or reset) */
  fullSync(): Promise<SyncResult>;

  /** Perform incremental sync since last watermark */
  incrementalSync(state: SyncState): Promise<SyncResult>;

  /** Get current sync state */
  getSyncState(): Promise<SyncState>;
}

// =============================================================================
// Utility Types
// =============================================================================

/** Result of parsing note content */
export interface ParsedContent {
  /** Plain text extraction */
  plainText: string;

  /** Markdown conversion */
  markdown: string;

  /** Extracted inline tags */
  inlineTags: string[];

  /** Extracted URLs */
  urls: string[];

  /** Extracted @mentions */
  mentions: string[];

  /** Has attachments? */
  hasAttachments: boolean;

  /** Attachment metadata */
  attachments: AttachmentMeta[];
}

export interface AttachmentMeta {
  id: string;
  filename: string;
  mimeType: string;
  size?: number;
}
