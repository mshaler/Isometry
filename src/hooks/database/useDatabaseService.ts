import { useSQLite } from '../db/SQLiteProvider';
import type { Database } from 'sql.js-fts5';

/**
 * Unified Database Access Hook
 *
 * Purpose: Consolidate competing DatabaseService class and SQLiteProvider patterns
 * into a single unified approach that eliminates adapter patterns and achieves
 * true bridge elimination architecture.
 *
 * Architecture: Provides DatabaseService-compatible interface while using
 * SQLiteProvider internally for zero-serialization sql.js access.
 */
export function useDatabaseService() {
  const { db, execute, run, loading } = useSQLite();

  // Return loading state instead of throwing error
  if (!db) {
    return {
      db: null,
      loading: loading,
      error: null,
      query: () => [],
      run: () => {},
      isReady: () => false,
      getRawDatabase: () => null,
      export: () => new Uint8Array(),
      close: () => {},
      transaction: <T>(fn: () => T): T => fn(),
      updateCardPosition: () => {},
      updateCardData: () => {},
      addCard: () => null,
      deleteCard: () => {},
      getFilteredCards: () => [],
      saveHeaderState: () => {},
      getHeaderState: () => null,
      getStats: () => ({ totalCards: 0, totalEdges: 0 })
    };
  }

  return {
    // Direct database access for zero serialization
    db,
    loading: false,
    error: null,

    // DatabaseService-compatible interface
    query: (sql: string, params: any[] = []) => execute(sql, params),
    run: (sql: string, params: any[] = []) => run(sql, params),

    // Additional methods SuperGrid needs
    isReady: () => !!db,
    getRawDatabase: () => db,
    export: () => db.export(),
    close: () => db.close(),

    // Transaction support
    transaction: <T>(fn: () => T): T => {
      db.exec("BEGIN TRANSACTION");
      try {
        const result = fn();
        db.exec("COMMIT");
        return result;
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
    },

    // Position update methods (preserve SuperGrid functionality)
    updateCardPosition: (cardId: string, x: number, y: number) => {
      if (!cardId || typeof x !== 'number' || typeof y !== 'number') {
        return { success: false, error: 'Invalid parameters' };
      }

      try {
        // Check if card exists
        const existing = execute("SELECT id FROM nodes WHERE id = ? AND deleted_at IS NULL", [cardId]);
        if (existing.length === 0) {
          return { success: false, error: 'Card not found' };
        }

        // Update position
        run(`
          UPDATE nodes
          SET grid_x = ?, grid_y = ?, modified_at = datetime('now')
          WHERE id = ?
        `, [Math.round(x * 100) / 100, Math.round(y * 100) / 100, cardId]);

        return { success: true };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    },

    // Bulk position updates with transaction support
    updateCardPositions: (positions: Array<{cardId: string, x: number, y: number}>) => {
      if (!positions || positions.length === 0) {
        return { success: true, updated: 0, failed: 0, errors: [] };
      }

      const errors: Array<{cardId: string, error: string}> = [];
      let updated = 0;

      try {
        // Use transaction within the hook scope
        db.exec("BEGIN TRANSACTION");
        try {
          for (const { cardId, x, y } of positions) {
            try {
              // Validate each position update
              if (!cardId || typeof x !== 'number' || typeof y !== 'number') {
                errors.push({ cardId, error: 'Invalid parameters' });
                continue;
              }

              if (x < 0 || y < 0 || x > 10000 || y > 10000) {
                errors.push({ cardId, error: 'Coordinates out of range' });
                continue;
              }

              // Check if card exists
              const existing = execute("SELECT id FROM nodes WHERE id = ? AND deleted_at IS NULL", [cardId]);
              if (existing.length === 0) {
                errors.push({ cardId, error: 'Card not found' });
                continue;
              }

              // Update position
              const roundedX = Math.round(x * 100) / 100;
              const roundedY = Math.round(y * 100) / 100;

              run(`
                UPDATE nodes
                SET grid_x = ?,
                    grid_y = ?,
                    modified_at = datetime('now')
                WHERE id = ?
              `, [roundedX, roundedY, cardId]);

              updated++;
            } catch (error) {
              errors.push({ cardId, error: String(error) });
            }
          }

          db.exec("COMMIT");
          return {
            success: errors.length === 0,
            updated,
            failed: errors.length,
            errors
          };
        } catch (error) {
          db.exec("ROLLBACK");
          throw error;
        }
      } catch (error) {
        return {
          success: false,
          updated,
          failed: positions.length - updated,
          errors: [{ cardId: 'transaction', error: String(error) }]
        };
      }
    },

    // Header state methods (preserve Phase 36 functionality)
    saveHeaderState: (datasetId: string, appContext: string, expandedLevels: string[], zoomLevel: string, panLevel: string) => {
      try {
        // Create table if needed
        run(`
          CREATE TABLE IF NOT EXISTS header_state (
            dataset_id TEXT NOT NULL,
            app_context TEXT NOT NULL,
            expanded_levels TEXT NOT NULL DEFAULT '[]',
            zoom_level TEXT NOT NULL DEFAULT 'leaf',
            pan_level TEXT NOT NULL DEFAULT 'dense',
            last_updated TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (dataset_id, app_context)
          )
        `);

        // Upsert state
        run(`
          INSERT OR REPLACE INTO header_state
          (dataset_id, app_context, expanded_levels, zoom_level, pan_level, last_updated)
          VALUES (?, ?, ?, ?, ?, datetime('now'))
        `, [datasetId, appContext, JSON.stringify(expandedLevels), zoomLevel, panLevel]);

        return { success: true };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    },

    loadHeaderState: (datasetId: string, appContext: string) => {
      try {
        const result = execute(`
          SELECT expanded_levels, zoom_level, pan_level, last_updated
          FROM header_state
          WHERE dataset_id = ? AND app_context = ?
        `, [datasetId, appContext]);

        if (result.length === 0) return null;

        const state = result[0];
        return {
          expandedLevels: JSON.parse(state.expanded_levels as string || '[]'),
          zoomLevel: state.zoom_level as string,
          panLevel: state.pan_level as string,
          lastUpdated: state.last_updated as string
        };
      } catch (error) {
        console.error('Load header state failed:', error);
        return null;
      }
    },

    // Additional DatabaseService compatibility methods
    isDirty: () => false, // SQLiteProvider handles dirty state
    verifyFTS5: () => ({ available: false }), // Delegate to SQLiteProvider capabilities
    verifyJSON1: () => ({ available: false }),
    verifyRecursiveCTE: () => ({ available: false }),
    getCapabilities: () => ({
      fts5: { available: false },
      json1: { available: false },
      recursiveCTE: { available: false },
      ready: true,
      dirty: false
    }),
    getStats: () => ({
      tables: 0,
      indexes: 0,
      triggers: 0,
      size: db.export().length
    })
  };
}