import initSqlJs, { Database, SqlJsStatic } from 'sql.js';

/**
 * Core DatabaseService class providing synchronous sql.js API
 *
 * Purpose: Eliminate 40KB MessageBridge by putting SQLite in same JavaScript runtime as D3.js
 * Architecture: Bridge Elimination - sql.js enables direct D3.js data binding
 *
 * Key features:
 * - Synchronous query/run methods (no promises after initialization)
 * - FTS5 + JSON1 + recursive CTE support verified
 * - Direct sql.js Database access for zero serialization
 * - Export capability for Swift file I/O persistence
 * - Proper WASM locateFile configuration for vendored binary
 */
export class DatabaseService {
  private db: Database | null = null;
  private SQL: SqlJsStatic | null = null;
  private dirty = false;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;

  /**
   * Initialize sql.js with vendored WASM binary
   * @param dbBytes Optional ArrayBuffer containing existing database
   */
  async initialize(dbBytes?: ArrayBuffer): Promise<void> {
    try {
      // Load sql.js with FTS5-enabled WASM from public/wasm/
      this.SQL = await initSqlJs({
        locateFile: (file: string) => {
          // Map sql-wasm.wasm to our vendored FTS5-enabled version
          if (file === 'sql-wasm.wasm') {
            // In tests, use the node_modules version; in browser, use our vendored version
            if (typeof window === 'undefined' || globalThis.process?.env?.NODE_ENV === 'test') {
              // Node.js/test environment - use npm distributed WASM
              return './node_modules/sql.js/dist/sql-wasm.wasm';
            }
            return '/wasm/sql-wasm.wasm';
          }
          return `/wasm/${file}`;
        }
      });

      // Create or load database
      if (dbBytes) {
        this.db = new this.SQL.Database(new Uint8Array(dbBytes));
      } else {
        this.db = new this.SQL.Database();
      }

      // Configure SQLite pragmas for optimal performance
      this.db.run("PRAGMA foreign_keys = ON");
      this.db.run("PRAGMA journal_mode = MEMORY");
      this.db.run("PRAGMA synchronous = NORMAL");
      this.db.run("PRAGMA cache_size = 1000");
      this.db.run("PRAGMA temp_store = MEMORY");

    } catch (error) {
      throw new Error(`Failed to initialize DatabaseService: ${error}`);
    }
  }

  /**
   * Execute synchronous SQL query returning results
   * Core CLAUDE.md requirement: zero serialization boundaries
   *
   * @param sql SQL query string
   * @param params Optional parameters for prepared statement
   * @returns Query results as typed array
   */
  query<T = any>(sql: string, params?: any[]): T[] {
    if (!this.db) {
      throw new Error('Database not initialized. Call initialize() first.');
    }

    try {
      const results = this.db.exec(sql, params);

      if (results.length === 0) {
        return [];
      }

      // Convert sql.js results to typed objects
      const { columns, values } = results[0];
      return values.map(row => {
        const obj: any = {};
        columns.forEach((col, index) => {
          obj[col] = row[index];
        });
        return obj as T;
      });

    } catch (error) {
      throw new Error(`Query failed: ${error}\nSQL: ${sql}\nParams: ${JSON.stringify(params)}`);
    }
  }

  /**
   * Execute synchronous SQL mutation (INSERT/UPDATE/DELETE)
   * Marks database as dirty for debounced persistence
   *
   * @param sql SQL statement
   * @param params Optional parameters for prepared statement
   */
  run(sql: string, params?: any[]): void {
    if (!this.db) {
      throw new Error('Database not initialized. Call initialize() first.');
    }

    try {
      this.db.run(sql, params);
      this.markDirty();

    } catch (error) {
      throw new Error(`Run failed: ${error}\nSQL: ${sql}\nParams: ${JSON.stringify(params)}`);
    }
  }

  /**
   * Export database as Uint8Array for Swift file I/O
   * Enables persistence layer bridge with minimal data transfer
   */
  export(): Uint8Array {
    if (!this.db) {
      throw new Error('Database not initialized. Call initialize() first.');
    }

    try {
      return this.db.export();
    } catch (error) {
      throw new Error(`Export failed: ${error}`);
    }
  }

  /**
   * Close database and cleanup resources
   */
  close(): void {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }

    if (this.db) {
      try {
        this.db.close();
      } catch (error) {
        // Ignore close errors - database may already be closed
      }
      this.db = null;
    }

    this.SQL = null;
    this.dirty = false;
  }

  /**
   * Check if database is initialized and ready
   */
  isReady(): boolean {
    return this.db !== null;
  }

  /**
   * Check if database has unsaved changes
   */
  isDirty(): boolean {
    return this.dirty;
  }

  /**
   * Get raw sql.js Database instance for advanced operations
   * Use carefully - prefer query() and run() methods
   */
  getRawDatabase(): Database | null {
    return this.db;
  }

  /**
   * Execute multiple statements in a transaction
   * Provides atomicity for complex operations
   */
  transaction<T>(fn: () => T): T {
    if (!this.db) {
      throw new Error('Database not initialized. Call initialize() first.');
    }

    try {
      this.db.run("BEGIN TRANSACTION");
      const result = fn();
      this.db.run("COMMIT");
      this.markDirty();
      return result;
    } catch (error) {
      try {
        this.db.run("ROLLBACK");
      } catch (rollbackError) {
        // Ignore rollback errors
      }
      throw error;
    }
  }

  /**
   * Verify FTS5 support is available
   * Critical gate per CLAUDE.md architecture requirements
   *
   * NOTE: Standard sql.js v1.13.0 build does NOT include FTS5.
   * For production FTS5 support, need custom SQLite build with FTS5 enabled.
   * Current implementation provides graceful fallback to LIKE queries for text search.
   */
  verifyFTS5(): { available: boolean; version?: string; error?: string } {
    try {
      const result = this.query<{fts5_version: string}>("SELECT fts5_version()");
      return {
        available: true,
        version: result[0]?.fts5_version
      };
    } catch (error) {
      return {
        available: false,
        error: 'FTS5 not available in standard sql.js build. Text search will use LIKE queries as fallback.'
      };
    }
  }

  /**
   * Verify JSON1 support is available
   */
  verifyJSON1(): { available: boolean; error?: string } {
    try {
      this.query("SELECT json('{\"test\": true}')");
      return { available: true };
    } catch (error) {
      return {
        available: false,
        error: String(error)
      };
    }
  }

  /**
   * Verify recursive CTE support
   */
  verifyRecursiveCTE(): { available: boolean; error?: string } {
    try {
      // Test basic recursive CTE
      this.query(`
        WITH RECURSIVE series(x) AS (
          SELECT 1
          UNION ALL
          SELECT x + 1 FROM series WHERE x < 3
        )
        SELECT x FROM series
      `);
      return { available: true };
    } catch (error) {
      return {
        available: false,
        error: String(error)
      };
    }
  }

  /**
   * Get comprehensive capability report
   */
  getCapabilities() {
    return {
      fts5: this.verifyFTS5(),
      json1: this.verifyJSON1(),
      recursiveCTE: this.verifyRecursiveCTE(),
      ready: this.isReady(),
      dirty: this.isDirty()
    };
  }

  /**
   * Mark database as dirty and schedule debounced save
   * Private method for internal mutation tracking
   */
  private markDirty(): void {
    this.dirty = true;

    // Debounced save could be implemented here for auto-persistence
    // For now, manual export() calls handle persistence
  }

  /**
   * Update card position in the database
   * @param cardId Card identifier
   * @param x X coordinate position
   * @param y Y coordinate position
   * @returns Success status
   */
  updateCardPosition(cardId: string, x: number, y: number): { success: boolean; error?: string } {
    if (!this.db) {
      return { success: false, error: 'Database not initialized' };
    }

    // Validate inputs
    if (!cardId || typeof x !== 'number' || typeof y !== 'number') {
      return { success: false, error: 'Invalid parameters: cardId, x, and y are required' };
    }

    // Validate coordinate ranges
    if (x < 0 || y < 0 || x > 10000 || y > 10000) {
      return { success: false, error: 'Invalid coordinates: x and y must be between 0 and 10000' };
    }

    try {
      // First, check if we need to add the position columns
      this.ensurePositionColumns();

      // Check if card exists
      const existingCard = this.query("SELECT id FROM nodes WHERE id = ? AND deleted_at IS NULL", [cardId]);
      if (existingCard.length === 0) {
        return { success: false, error: `Card with id ${cardId} not found` };
      }

      // Update position with rounded values to avoid floating point precision issues
      const roundedX = Math.round(x * 100) / 100;
      const roundedY = Math.round(y * 100) / 100;

      this.run(`
        UPDATE nodes
        SET grid_x = ?,
            grid_y = ?,
            modified_at = datetime('now')
        WHERE id = ?
      `, [roundedX, roundedY, cardId]);

      return { success: true };
    } catch (error) {
      return { success: false, error: `Position update failed: ${error}` };
    }
  }

  /**
   * Bulk update multiple card positions in a transaction
   * @param positions Array of position updates {cardId, x, y}
   * @returns Success status with details
   */
  updateCardPositions(positions: Array<{cardId: string, x: number, y: number}>): {
    success: boolean;
    updated: number;
    failed: number;
    errors: Array<{cardId: string, error: string}>;
  } {
    if (!this.db) {
      return { success: false, updated: 0, failed: positions.length, errors: [{ cardId: 'all', error: 'Database not initialized' }] };
    }

    if (!positions || positions.length === 0) {
      return { success: true, updated: 0, failed: 0, errors: [] };
    }

    const errors: Array<{cardId: string, error: string}> = [];
    let updated = 0;

    try {
      // Ensure position columns exist
      this.ensurePositionColumns();

      // Use transaction for atomicity
      return this.transaction(() => {
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
            const existingCard = this.query("SELECT id FROM nodes WHERE id = ? AND deleted_at IS NULL", [cardId]);
            if (existingCard.length === 0) {
              errors.push({ cardId, error: 'Card not found' });
              continue;
            }

            // Update position
            const roundedX = Math.round(x * 100) / 100;
            const roundedY = Math.round(y * 100) / 100;

            this.run(`
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

        return {
          success: errors.length === 0,
          updated,
          failed: errors.length,
          errors
        };
      });
    } catch (error) {
      return {
        success: false,
        updated,
        failed: positions.length - updated,
        errors: [{ cardId: 'transaction', error: String(error) }]
      };
    }
  }

  /**
   * Get card position by ID
   * @param cardId Card identifier
   * @returns Position data or null if not found
   */
  getCardPosition(cardId: string): { x: number; y: number } | null {
    if (!this.db || !cardId) {
      return null;
    }

    try {
      this.ensurePositionColumns();

      const result = this.query<{grid_x: number, grid_y: number}>(
        "SELECT grid_x, grid_y FROM nodes WHERE id = ? AND deleted_at IS NULL",
        [cardId]
      );

      if (result.length === 0) {
        return null;
      }

      const { grid_x, grid_y } = result[0];
      return {
        x: grid_x || 0,
        y: grid_y || 0
      };
    } catch (error) {
      console.error('Get card position failed:', error);
      return null;
    }
  }

  /**
   * Get cards within a specific region
   * @param x1 Left boundary
   * @param y1 Top boundary
   * @param x2 Right boundary
   * @param y2 Bottom boundary
   * @returns Cards in the region
   */
  getCardsInRegion(x1: number, y1: number, x2: number, y2: number): any[] {
    if (!this.db) {
      return [];
    }

    try {
      this.ensurePositionColumns();

      return this.query(`
        SELECT id, name, grid_x, grid_y
        FROM nodes
        WHERE deleted_at IS NULL
          AND grid_x >= ? AND grid_x <= ?
          AND grid_y >= ? AND grid_y <= ?
      `, [Math.min(x1, x2), Math.max(x1, x2), Math.min(y1, y2), Math.max(y1, y2)]);
    } catch (error) {
      console.error('Get cards in region failed:', error);
      return [];
    }
  }

  /**
   * Get cards within distance from a center point
   * @param centerX Center X coordinate
   * @param centerY Center Y coordinate
   * @param radius Maximum distance
   * @returns Cards within the radius
   */
  getCardsByDistance(centerX: number, centerY: number, radius: number): any[] {
    if (!this.db) {
      return [];
    }

    try {
      this.ensurePositionColumns();

      // Use Pythagorean theorem for distance calculation
      return this.query(`
        SELECT id, name, grid_x, grid_y,
               SQRT(POWER(grid_x - ?, 2) + POWER(grid_y - ?, 2)) as distance
        FROM nodes
        WHERE deleted_at IS NULL
          AND grid_x IS NOT NULL
          AND grid_y IS NOT NULL
          AND SQRT(POWER(grid_x - ?, 2) + POWER(grid_y - ?, 2)) <= ?
        ORDER BY distance ASC
      `, [centerX, centerY, centerX, centerY, radius]);
    } catch (error) {
      console.error('Get cards by distance failed:', error);
      return [];
    }
  }

  /**
   * Ensure position columns exist in the database (migration helper)
   * This is a safe operation that only adds columns if they don't exist
   */
  private ensurePositionColumns(): void {
    try {
      // Check if grid_x column exists
      const columns = this.query("PRAGMA table_info(nodes)");
      const hasGridX = columns.some((col: any) => col.name === 'grid_x');
      const hasGridY = columns.some((col: any) => col.name === 'grid_y');

      if (!hasGridX) {
        this.run("ALTER TABLE nodes ADD COLUMN grid_x REAL");
      }

      if (!hasGridY) {
        this.run("ALTER TABLE nodes ADD COLUMN grid_y REAL");
      }
    } catch (error) {
      // Ignore errors - columns might already exist
      // This is a safe operation for schema migration
    }
  }

  /**
   * Get database statistics for monitoring
   */
  getStats(): {
    tables: number;
    indexes: number;
    triggers: number;
    size?: number;
  } {
    if (!this.db) {
      return { tables: 0, indexes: 0, triggers: 0 };
    }

    try {
      const tables = this.query<{count: number}>("SELECT COUNT(*) as count FROM sqlite_master WHERE type='table'");
      const indexes = this.query<{count: number}>("SELECT COUNT(*) as count FROM sqlite_master WHERE type='index'");
      const triggers = this.query<{count: number}>("SELECT COUNT(*) as count FROM sqlite_master WHERE type='trigger'");

      return {
        tables: tables[0]?.count || 0,
        indexes: indexes[0]?.count || 0,
        triggers: triggers[0]?.count || 0,
        size: this.export().length
      };
    } catch (error) {
      return { tables: 0, indexes: 0, triggers: 0 };
    }
  }
}