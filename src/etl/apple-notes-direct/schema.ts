/**
 * Apple Notes Schema Module
 *
 * Direct SQLite access to NoteStore.sqlite
 * Schema validated against macOS 15.x / iOS 18.x
 *
 * Key tables:
 * - ZICCLOUDSYNCINGOBJECT: Notes, folders, and attachments (polymorphic)
 * - Z_?NOTES: Join tables (number varies by schema version)
 *
 * Key columns on ZICCLOUDSYNCINGOBJECT:
 * - Z_PK: Primary key
 * - ZTITLE1: Note title
 * - ZTITLE2: Folder title
 * - ZFOLDER: FK to parent folder (for notes)
 * - ZPARENT: FK to parent folder (for folders)
 * - ZMODIFICATIONDATE: Last modified (Core Data timestamp)
 * - ZCREATIONDATE: Created (Core Data timestamp)
 * - ZDATA: Gzipped protobuf content (in ZICNOTEDATA for some versions)
 */

import { LatchCategory, LatchTime } from './types';

// =============================================================================
// Database Path Resolution
// =============================================================================

/**
 * Get the path to NoteStore.sqlite
 * Works on both macOS and iOS (via app group container)
 */
export function getNoteStorePath(): string {
  const home = process.env.HOME || '~';
  return `${home}/Library/Group Containers/group.com.apple.notes/NoteStore.sqlite`;
}

// =============================================================================
// Core Data Timestamp Conversion
// =============================================================================

/**
 * Convert Core Data timestamp to JavaScript Date
 * Core Data uses seconds since 2001-01-01 (Cocoa reference date)
 */
export function coreDataTimestampToDate(
  timestamp: number | null
): Date | undefined {
  if (timestamp === null || timestamp === undefined) return undefined;

  // Cocoa reference date: 2001-01-01 00:00:00 UTC
  const COCOA_REFERENCE = Date.UTC(2001, 0, 1, 0, 0, 0, 0);
  const milliseconds = COCOA_REFERENCE + timestamp * 1000;
  return new Date(milliseconds);
}

/**
 * Convert JavaScript Date to Core Data timestamp
 */
export function dateToCoreDataTimestamp(date: Date): number {
  const COCOA_REFERENCE = Date.UTC(2001, 0, 1, 0, 0, 0, 0);
  return (date.getTime() - COCOA_REFERENCE) / 1000;
}

// =============================================================================
// SQL Queries
// =============================================================================

/**
 * Query to get all notes with folder hierarchy
 * Returns notes with their immediate folder and parent folder names
 */
export const QUERY_ALL_NOTES = `
SELECT
    n.Z_PK as id,
    n.ZTITLE1 as title,
    n.ZSNIPPET as snippet,
    n.ZCREATIONDATE as created_timestamp,
    n.ZMODIFICATIONDATE as modified_timestamp,
    n.ZFOLDER as folder_id,
    f.ZTITLE2 as folder_name,
    f.ZPARENT as parent_folder_id,
    pf.ZTITLE2 as parent_folder_name,
    n.ZACCOUNT as account_id,
    n.ZMARKEDFORDELETION as marked_for_deletion
FROM ZICCLOUDSYNCINGOBJECT n
LEFT JOIN ZICCLOUDSYNCINGOBJECT f ON n.ZFOLDER = f.Z_PK
LEFT JOIN ZICCLOUDSYNCINGOBJECT pf ON f.ZPARENT = pf.Z_PK
WHERE n.ZTITLE1 IS NOT NULL
  AND (n.ZMARKEDFORDELETION IS NULL OR n.ZMARKEDFORDELETION = 0)
ORDER BY n.ZMODIFICATIONDATE DESC
`;

/**
 * Query to get notes modified since a given timestamp
 * Used for incremental sync
 */
export const QUERY_NOTES_SINCE = `
SELECT
    n.Z_PK as id,
    n.ZTITLE1 as title,
    n.ZSNIPPET as snippet,
    n.ZCREATIONDATE as created_timestamp,
    n.ZMODIFICATIONDATE as modified_timestamp,
    n.ZFOLDER as folder_id,
    f.ZTITLE2 as folder_name,
    f.ZPARENT as parent_folder_id,
    pf.ZTITLE2 as parent_folder_name,
    n.ZACCOUNT as account_id,
    n.ZMARKEDFORDELETION as marked_for_deletion
FROM ZICCLOUDSYNCINGOBJECT n
LEFT JOIN ZICCLOUDSYNCINGOBJECT f ON n.ZFOLDER = f.Z_PK
LEFT JOIN ZICCLOUDSYNCINGOBJECT pf ON f.ZPARENT = pf.Z_PK
WHERE n.ZTITLE1 IS NOT NULL
  AND n.ZMODIFICATIONDATE > ?
  AND (n.ZMARKEDFORDELETION IS NULL OR n.ZMARKEDFORDELETION = 0)
ORDER BY n.ZMODIFICATIONDATE ASC
`;

/**
 * Query to get a single note by Z_PK
 */
export const QUERY_NOTE_BY_ID = `
SELECT
    n.Z_PK as id,
    n.ZTITLE1 as title,
    n.ZSNIPPET as snippet,
    n.ZCREATIONDATE as created_timestamp,
    n.ZMODIFICATIONDATE as modified_timestamp,
    n.ZFOLDER as folder_id,
    f.ZTITLE2 as folder_name,
    f.ZPARENT as parent_folder_id,
    pf.ZTITLE2 as parent_folder_name,
    n.ZACCOUNT as account_id
FROM ZICCLOUDSYNCINGOBJECT n
LEFT JOIN ZICCLOUDSYNCINGOBJECT f ON n.ZFOLDER = f.Z_PK
LEFT JOIN ZICCLOUDSYNCINGOBJECT pf ON f.ZPARENT = pf.Z_PK
WHERE n.Z_PK = ?
`;

/**
 * Query to get note content (gzipped protobuf)
 * Content is stored in a separate table linked by ZNOTE FK
 */
export const QUERY_NOTE_CONTENT = `
SELECT
    nd.ZDATA as content_data,
    nd.Z_PK as content_id
FROM ZICNOTEDATA nd
WHERE nd.ZNOTE = ?
`;

/**
 * Query to get full folder hierarchy
 * Returns all folders with their parent relationships
 */
export const QUERY_FOLDER_HIERARCHY = `
WITH RECURSIVE folder_tree AS (
    -- Base case: root folders (no parent)
    SELECT
        Z_PK as id,
        ZTITLE2 as name,
        ZPARENT as parent_id,
        ZTITLE2 as path,
        0 as depth
    FROM ZICCLOUDSYNCINGOBJECT
    WHERE ZTITLE2 IS NOT NULL
      AND ZPARENT IS NULL
      AND ZFOLDER IS NULL

    UNION ALL

    -- Recursive case: child folders
    SELECT
        c.Z_PK as id,
        c.ZTITLE2 as name,
        c.ZPARENT as parent_id,
        ft.path || '/' || c.ZTITLE2 as path,
        ft.depth + 1 as depth
    FROM ZICCLOUDSYNCINGOBJECT c
    JOIN folder_tree ft ON c.ZPARENT = ft.id
    WHERE c.ZTITLE2 IS NOT NULL
)
SELECT * FROM folder_tree
ORDER BY path
`;

/**
 * Query to get all tags
 * Tags are stored in a separate table with a join to notes
 */
export const QUERY_ALL_TAGS = `
SELECT DISTINCT
    t.ZNAME as tag_name,
    t.Z_PK as tag_id
FROM ZICNOTEDATATAG t
ORDER BY t.ZNAME
`;

/**
 * Query to get tags for a specific note
 */
export const QUERY_NOTE_TAGS = `
SELECT t.ZNAME as tag_name
FROM ZICNOTEDATATAG t
JOIN Z_?TAGS zt ON zt.Z_?TAGS = t.Z_PK
WHERE zt.Z_?NOTEDATA = ?
`;

/**
 * Query to get deleted note IDs (for sync)
 */
export const QUERY_DELETED_NOTES = `
SELECT Z_PK as id
FROM ZICCLOUDSYNCINGOBJECT
WHERE ZTITLE1 IS NOT NULL
  AND ZMARKEDFORDELETION = 1
  AND ZMODIFICATIONDATE > ?
`;

/**
 * Query to count notes (for sync state)
 */
export const QUERY_NOTE_COUNT = `
SELECT COUNT(*) as count
FROM ZICCLOUDSYNCINGOBJECT
WHERE ZTITLE1 IS NOT NULL
  AND (ZMARKEDFORDELETION IS NULL OR ZMARKEDFORDELETION = 0)
`;

// =============================================================================
// Raw Row Types (from SQLite queries)
// =============================================================================

export interface RawNoteRow {
  id: number;
  title: string;
  snippet: string | null;
  created_timestamp: number | null;
  modified_timestamp: number | null;
  folder_id: number | null;
  folder_name: string | null;
  parent_folder_id: number | null;
  parent_folder_name: string | null;
  account_id: number | null;
  marked_for_deletion: number | null;
}

export interface RawFolderRow {
  id: number;
  name: string;
  parent_id: number | null;
  path: string;
  depth: number;
}

export interface RawContentRow {
  content_data: Buffer | null;
  content_id: number;
}

// =============================================================================
// Hierarchy Builder
// =============================================================================

/**
 * Build folder hierarchy array from raw note row
 * Returns path from root to immediate folder, e.g., ["Family", "Stacey"]
 */
export function buildFolderHierarchy(row: RawNoteRow): string[] {
  const hierarchy: string[] = [];

  // Add parent folder first (if exists)
  if (row.parent_folder_name) {
    hierarchy.push(row.parent_folder_name);
  }

  // Add immediate folder
  if (row.folder_name) {
    hierarchy.push(row.folder_name);
  }

  return hierarchy;
}

/**
 * Build full folder path string
 */
export function buildFolderPath(row: RawNoteRow): string {
  const hierarchy = buildFolderHierarchy(row);
  return hierarchy.join('/') || 'Unfiled';
}

// =============================================================================
// LATCH Property Extractors
// =============================================================================

/**
 * Extract LATCH Time properties from raw note row
 */
export function extractLatchTime(row: RawNoteRow): LatchTime {
  const created = coreDataTimestampToDate(row.created_timestamp);
  const modified = coreDataTimestampToDate(row.modified_timestamp);

  return {
    created: created || new Date(),
    modified: modified || new Date(),
  };
}

/**
 * Extract LATCH Category properties from raw note row
 * Tags are added separately after querying the tags table
 */
export function extractLatchCategory(
  row: RawNoteRow,
  tags: string[] = []
): LatchCategory {
  return {
    hierarchy: buildFolderHierarchy(row),
    tags,
    status: 'active',
  };
}

// =============================================================================
// URL Scheme
// =============================================================================

/**
 * Generate Apple Notes URL for a note
 * Format: applenotes://note/{identifier}
 *
 * Note: The identifier needs to come from a different column (ZIDENTIFIER)
 * For now, we use the Z_PK which works for x-coredata:// URLs
 */
export function generateNoteUrl(noteId: number): string {
  // x-coredata URL format (works within the app)
  return `x-coredata://note/${noteId}`;
}

/**
 * Generate mobilenotes:// URL (works on iOS)
 */
export function generateMobileNoteUrl(noteId: number): string {
  return `mobilenotes://showNote?identifier=${noteId}`;
}
