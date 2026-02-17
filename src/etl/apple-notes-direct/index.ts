/**
 * Apple Notes Direct SQLite ETL Module
 *
 * This module provides direct access to Apple Notes via NoteStore.sqlite.
 *
 * IMPORTANT: This module requires Node.js runtime (Tauri backend, Electron, or CLI)
 * because better-sqlite3 is a native module that cannot run in the browser.
 *
 * Usage:
 *   import { createAppleNotesAdapter } from '@/etl/apple-notes-direct';
 *
 *   const adapter = createAppleNotesAdapter();
 *   if (await adapter.isAvailable()) {
 *     const result = await adapter.fullSync();
 *     console.log(`Synced ${result.nodes.length} notes`);
 *   }
 */

// Types
export type {
  CanonicalNode,
  CanonicalEdge,
  SyncState,
  SyncResult,
  SourceAdapter,
  SourceType,
  NodeType,
  EdgeType,
  LatchLocation,
  LatchTime,
  LatchCategory,
  LatchHierarchy,
  ParsedContent,
  AttachmentMeta,
} from './types';

// Adapter
export { AppleNotesAdapter, createAppleNotesAdapter } from './adapter';

// Schema utilities
export {
  getNoteStorePath,
  coreDataTimestampToDate,
  dateToCoreDataTimestamp,
  buildFolderHierarchy,
  buildFolderPath,
  extractLatchTime,
  extractLatchCategory,
  generateNoteUrl,
  generateMobileNoteUrl,
} from './schema';

// Content extraction
export { extractNoteContent, extractFromHtml } from './content-extractor';

// Type mapping to Isometry schema
export type { IsometryNode, IsometryEdge, IsometryCard } from './type-mapping';
export {
  canonicalNodeToIsometryNode,
  canonicalNodeToIsometryCard,
  canonicalEdgeToIsometryEdge,
  generateNodeUpsertSQL,
  generateEdgeUpsertSQL,
  generateBatchNodeUpsertSQL,
} from './type-mapping';

// NodeWriter: Persists canonical nodes/edges to sql.js
export type { NodeWriter, WriteResult } from './NodeWriter';
export { createNodeWriter } from './NodeWriter';
