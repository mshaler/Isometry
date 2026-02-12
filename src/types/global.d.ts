/**
 * Global type declarations for Isometry
 */

/**
 * ETL Bridge API exposed on window object.
 * Enables Swift bridge to call JavaScript ETL functions.
 */
interface IsometryETL {
  /**
   * Import a file and insert resulting nodes into the database.
   *
   * @param filename - File name with extension for format detection
   * @param content - File content as string or ArrayBuffer
   * @param options - Optional format override
   * @returns Import result with success status, node count, and errors
   */
  importFile(
    filename: string,
    content: string | ArrayBuffer,
    options?: { format?: string }
  ): Promise<{ success: boolean; nodeCount: number; errors?: string[] }>;

  /**
   * Get the current sql.js Database instance.
   * Useful for direct queries from Swift bridge.
   *
   * Note: Returns unknown to avoid sql.js type dependency in global declarations.
   * Cast to Database type in consuming code.
   */
  getDatabase(): unknown | null;
}

declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown;
    /**
     * ETL Bridge API for file imports.
     * Initialized by initializeETLBridge() after database is ready.
     */
    isometryETL?: IsometryETL;
  }
}

export {};