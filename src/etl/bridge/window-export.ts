/**
 * Window API Bridge for ETL
 *
 * Exposes ETL functionality on window.isometryETL for Swift bridge integration.
 * Delegates to ImportCoordinator for format detection and parsing,
 * then uses insertCanonicalNodes for database insertion.
 *
 * @module etl/bridge/window-export
 */

import { ImportCoordinator } from '../coordinator/ImportCoordinator';
import { insertCanonicalNodes } from '../database/insertion';
import type { Database } from 'sql.js';

// Module-level state for initialized coordinator and database
let coordinator: ImportCoordinator | null = null;
let db: Database | null = null;

/**
 * Initialize the ETL bridge and expose window.isometryETL API.
 *
 * Call this from SQLiteProvider (after database is ready) or App.tsx
 * when the sql.js database has been initialized.
 *
 * @param database - Initialized sql.js Database instance
 *
 * @example
 * // In SQLiteProvider after db initialization:
 * import { initializeETLBridge } from '@/etl/bridge/window-export';
 *
 * useEffect(() => {
 *   if (database) {
 *     initializeETLBridge(database);
 *   }
 * }, [database]);
 */
export function initializeETLBridge(database: Database): void {
  db = database;
  coordinator = new ImportCoordinator();

  // TODO: Register importers when they're wired up
  // coordinator.registerImporter(['.md', '.markdown', '.mdx'], new MarkdownImporter());
  // coordinator.registerImporter(['.json'], new JsonImporter());
  // etc.

  window.isometryETL = {
    /**
     * Import a file and insert resulting nodes into database.
     */
    async importFile(filename, content, options) {
      if (!coordinator || !db) {
        return {
          success: false,
          nodeCount: 0,
          errors: ['ETL not initialized - call initializeETLBridge() first'],
        };
      }

      try {
        // Detect format for validation (throws if unsupported)
        // Format override not yet implemented - coordinator uses filename extension
        const _format = options?.format || coordinator.detectFormat(filename);
        void _format; // Validation only - format routing handled by coordinator

        // Convert ArrayBuffer to string if needed
        const contentStr =
          typeof content === 'string' ? content : new TextDecoder().decode(content);

        // Import via coordinator - parses file and returns CanonicalNode[]
        // Note: coordinator.importFile detects format from filename extension
        const nodes = await coordinator.importFile({
          filename,
          content: contentStr,
        });

        // Insert nodes into database
        const result = await insertCanonicalNodes(db, nodes);

        return {
          success: result.failed === 0,
          nodeCount: result.inserted,
          errors: result.errors.length > 0 ? result.errors.map((e) => e.error) : undefined,
        };
      } catch (error) {
        return {
          success: false,
          nodeCount: 0,
          errors: [error instanceof Error ? error.message : String(error)],
        };
      }
    },

    /**
     * Get the current database instance.
     */
    getDatabase() {
      return db;
    },
  };
}

/**
 * Clean up the ETL bridge.
 * Call when database is being closed/replaced.
 */
export function cleanupETLBridge(): void {
  coordinator = null;
  db = null;
  if (typeof window !== 'undefined') {
    delete window.isometryETL;
  }
}

/**
 * Check if ETL bridge is initialized.
 */
export function isETLBridgeInitialized(): boolean {
  return coordinator !== null && db !== null && window.isometryETL !== undefined;
}
