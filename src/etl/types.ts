// Isometry v5 — Phase 8 ETL Type Definitions
// Canonical types for the import/export pipeline
//
// Requirements addressed:
//   - ETL-01: Canonical ETL type contract (CanonicalCard, CanonicalConnection)
//   - ETL-02: ImportResult interface for standardized import feedback

import type { CardType } from '../database/queries/types';

// ---------------------------------------------------------------------------
// Source Types
// ---------------------------------------------------------------------------

/**
 * Supported data source types for import operations.
 * Each source type maps to a dedicated parser implementation.
 */
export type SourceType =
  | 'apple_notes'
  | 'markdown'
  | 'excel'
  | 'csv'
  | 'json'
  | 'html';

// ---------------------------------------------------------------------------
// Canonical ETL Types (The Integration Seam)
// ---------------------------------------------------------------------------

/**
 * CanonicalCard: Maps 1:1 to cards table columns.
 * This is the critical integration contract between parsers and writers.
 *
 * Key differences from Card type:
 * - tags is string[] (not JSON-stringified) - SQLiteWriter handles serialization
 * - source and source_id are required (non-null) for ETL deduplication
 */
export interface CanonicalCard {
  // Identity
  id: string;
  card_type: CardType;

  // Content
  name: string;
  content: string | null;
  summary: string | null;

  // Location
  latitude: number | null;
  longitude: number | null;
  location_name: string | null;

  // Time
  created_at: string;
  modified_at: string;
  due_at: string | null;
  completed_at: string | null;
  event_start: string | null;
  event_end: string | null;

  // Category
  folder: string | null;
  tags: string[]; // Array, not JSON string - SQLiteWriter serializes
  status: string | null;

  // Hierarchy
  priority: number;
  sort_order: number;

  // Resource
  url: string | null;
  mime_type: string | null;

  // Collection
  is_collective: boolean;

  // Source (required for ETL deduplication)
  source: string; // Non-null for ETL
  source_id: string; // Non-null for ETL
  source_url: string | null;

  // Lifecycle
  deleted_at: string | null;
}

/**
 * CanonicalConnection: Maps 1:1 to connections table columns.
 *
 * Note: source_id/target_id may initially be temporary source_ids
 * that DedupEngine resolves to UUIDs.
 */
export interface CanonicalConnection {
  id: string;
  source_id: string;
  target_id: string;
  via_card_id: string | null;
  label: string | null;
  weight: number;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Import Result Types
// ---------------------------------------------------------------------------

/**
 * Error detail for a single failed import item.
 */
export interface ParseError {
  /** Index of item in source data (0-based) */
  index: number;
  /** Source identifier from input (e.g., note ID, filename) */
  source_id: string | null;
  /** Human-readable error message */
  message: string;
}

/**
 * Standardized result object returned by all import operations.
 * Provides detailed counts and error information for UI feedback.
 *
 * Requirements: ETL-02 (standardized import result structure)
 */
export interface ImportResult {
  /** Number of new cards inserted */
  inserted: number;
  /** Number of existing cards updated */
  updated: number;
  /** Number of cards skipped (no changes detected) */
  unchanged: number;
  /** Number of cards skipped (validation failed) */
  skipped: number;
  /** Number of items that failed to import */
  errors: number;
  /** Number of connections created during import */
  connections_created: number;
  /** Array of inserted card IDs (for post-import actions) */
  insertedIds: string[];
  /** Detailed error information (empty if errors === 0) */
  errors_detail: ParseError[];
}

// ---------------------------------------------------------------------------
// Alto-Index Specific Types (Apple Notes Parser)
// ---------------------------------------------------------------------------

/**
 * Attachment metadata from alto-index YAML frontmatter.
 * Supports hashtags, tables (inline), and binary files.
 */
export interface AltoAttachment {
  id: string;
  /** MIME/UTI type (e.g., 'com.apple.notes.inlinetextattachment.hashtag', 'public.jpeg') */
  type: string;
  /** Attachment title (optional) */
  title?: string;
  /** HTML content for inline attachments (hashtags, tables) */
  content?: string;
  /** File path for binary attachments */
  path?: string;
}

/**
 * Alto-index YAML frontmatter structure.
 * Matches the output format of alto-index note extraction.
 */
export interface AltoNoteFrontmatter {
  /** Note title */
  title?: string;
  /** Numeric note identifier */
  id: number;
  /** ISO 8601 creation timestamp */
  created: string;
  /** ISO 8601 modification timestamp */
  modified: string;
  /** Folder name */
  folder?: string;
  /** Array of attachments (hashtags, images, etc.) */
  attachments?: AltoAttachment[];
  /** Array of linked note IDs */
  links?: string[];
  /** notes:// URL for this note */
  source: string;
}
