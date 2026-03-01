// Isometry v5 — Phase 8 ETL Core Types
// Defines the fundamental types for the ETL pipeline.
//
// Requirements addressed:
//   - ETL-01: SourceType union for all supported import formats
//   - ETL-02: ImportResult interface for standardized import feedback

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

/**
 * Error detail for a single failed import item.
 */
export interface ImportErrorDetail {
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
  errors_detail: ImportErrorDetail[];
}
