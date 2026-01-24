import type { Database } from 'sql.js';

/**
 * FTS5 Index Maintenance Utilities
 *
 * These functions help maintain the FTS5 full-text search index
 * for optimal performance.
 */

/**
 * Rebuild the FTS5 index from scratch
 *
 * Use this if the index becomes corrupted or after bulk imports.
 * This will re-index all nodes in the database.
 *
 * @param db - SQLite database instance
 */
export function rebuildFTS5Index(db: Database): void {
  try {
    // FTS5 special command to rebuild the entire index
    db.run("INSERT INTO nodes_fts(nodes_fts) VALUES('rebuild')");
    console.log('FTS5 index rebuilt successfully');
  } catch (error) {
    console.error('Failed to rebuild FTS5 index:', error);
    throw error;
  }
}

/**
 * Optimize the FTS5 index to reclaim space and improve performance
 *
 * Use this periodically (e.g., after deleting many nodes) or when
 * search performance degrades.
 *
 * @param db - SQLite database instance
 */
export function optimizeFTS5Index(db: Database): void {
  try {
    // FTS5 special command to merge all index segments
    db.run("INSERT INTO nodes_fts(nodes_fts) VALUES('optimize')");
    console.log('FTS5 index optimized successfully');
  } catch (error) {
    console.error('Failed to optimize FTS5 index:', error);
    throw error;
  }
}

/**
 * Get FTS5 index statistics
 *
 * Returns information about the FTS5 index size and row count.
 *
 * @param db - SQLite database instance
 * @returns Index statistics
 */
export function getFTS5Stats(db: Database): {
  rowCount: number;
  indexedColumns: string[];
} {
  try {
    // Count rows in FTS5 table
    const countResult = db.exec('SELECT COUNT(*) as count FROM nodes_fts');
    const rowCount = countResult[0]?.values[0]?.[0] as number || 0;

    // FTS5 columns are: name, content, summary, tags
    const indexedColumns = ['name', 'content', 'summary', 'tags'];

    return { rowCount, indexedColumns };
  } catch (error) {
    console.error('Failed to get FTS5 stats:', error);
    throw error;
  }
}

/**
 * Verify FTS5 index integrity
 *
 * Checks that the FTS5 index is in sync with the nodes table.
 * Useful for debugging or after manual database changes.
 *
 * @param db - SQLite database instance
 * @returns True if index is valid, false otherwise
 */
export function verifyFTS5Index(db: Database): boolean {
  try {
    // Check that FTS5 table exists
    const tableCheck = db.exec(`
      SELECT name FROM sqlite_master
      WHERE type='table' AND name='nodes_fts'
    `);

    if (!tableCheck || tableCheck.length === 0) {
      console.error('FTS5 table does not exist');
      return false;
    }

    // Verify row counts match (nodes vs nodes_fts)
    const nodesCount = db.exec('SELECT COUNT(*) as count FROM nodes WHERE deleted_at IS NULL');
    const ftsCount = db.exec('SELECT COUNT(*) as count FROM nodes_fts');

    const nodesTotal = nodesCount[0]?.values[0]?.[0] as number || 0;
    const ftsTotal = ftsCount[0]?.values[0]?.[0] as number || 0;

    if (nodesTotal !== ftsTotal) {
      console.warn(
        `FTS5 index out of sync: nodes=${nodesTotal}, fts=${ftsTotal}`
      );
      return false;
    }

    // Try a simple search to ensure index is queryable
    db.exec("SELECT rowid FROM nodes_fts WHERE nodes_fts MATCH 'test' LIMIT 1");

    console.log('FTS5 index verification passed');
    return true;
  } catch (error) {
    console.error('FTS5 index verification failed:', error);
    return false;
  }
}
