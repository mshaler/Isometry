/**
 * Isometry ETL Module
 * 
 * Unified data ingestion from multiple sources into Isometry's
 * canonical format (PAFV + LATCH + GRAPH).
 * 
 * @example
 * ```typescript
 * import { createAppleNotesAdapter, NodeWriter } from '@isometry/etl';
 * 
 * // Create adapter for source
 * const notes = createAppleNotesAdapter();
 * 
 * // Sync to canonical format
 * const result = await notes.fullSync();
 * 
 * // Write to Isometry database
 * const writer = new NodeWriter(isometryDb);
 * await writer.upsertNodes(result.nodes);
 * await writer.upsertEdges(result.edges);
 * ```
 */

// Core types
export type {
  CanonicalNode,
  CanonicalEdge,
  SourceAdapter,
  SyncState,
  SyncResult,
  SourceType,
  NodeType,
  EdgeType,
  LatchLocation,
  LatchTime,
  LatchCategory,
  LatchHierarchy,
  ParsedContent,
  AttachmentMeta,
} from './core/types.js';

// Apple Notes adapter
export {
  AppleNotesAdapter,
  createAppleNotesAdapter,
  extractNoteContent,
  getNoteStorePath,
} from './adapters/apple-notes/index.js';

// Future adapters will be exported here:
// export { AppleRemindersAdapter } from './adapters/apple-reminders/index.js';
// export { AppleCalendarAdapter } from './adapters/apple-calendar/index.js';
// export { ObsidianAdapter } from './adapters/obsidian/index.js';
