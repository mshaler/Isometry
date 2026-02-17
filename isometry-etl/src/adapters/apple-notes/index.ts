/**
 * Apple Notes Adapter Module
 * 
 * Direct ETL from Apple Notes (NoteStore.sqlite) to Isometry.
 * 
 * @example
 * ```typescript
 * import { createAppleNotesAdapter } from './adapters/apple-notes';
 * 
 * const adapter = createAppleNotesAdapter();
 * 
 * if (await adapter.isAvailable()) {
 *   // First run: full sync
 *   const result = await adapter.fullSync();
 *   
 *   // Subsequent runs: incremental sync
 *   const updates = await adapter.incrementalSync(result.syncState);
 * }
 * ```
 */

export { AppleNotesAdapter, createAppleNotesAdapter } from './adapter.js';
export { extractNoteContent, extractFromHtml } from './content-extractor.js';
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
  // SQL queries (for advanced usage)
  QUERY_ALL_NOTES,
  QUERY_NOTES_SINCE,
  QUERY_NOTE_BY_ID,
  QUERY_NOTE_CONTENT,
  QUERY_FOLDER_HIERARCHY,
  QUERY_ALL_TAGS,
  QUERY_NOTE_TAGS,
  QUERY_DELETED_NOTES,
  QUERY_NOTE_COUNT,
  // Types
  type RawNoteRow,
  type RawFolderRow,
  type RawContentRow,
} from './schema.js';
