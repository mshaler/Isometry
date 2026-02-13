/**
 * TauriService - Stub implementation
 *
 * Handles Tauri desktop integration for native features.
 * This is a stub for future implementation.
 */

export interface TauriCapabilities {
  isDesktop: boolean;
  hasFileSystem: boolean;
  hasNativeDialogs: boolean;
}

export interface IsometryFile {
  path: string;
  name: string;
  data: ArrayBuffer;
}

class TauriServiceImpl {
  /**
   * Check if running in desktop environment
   */
  isDesktopEnvironment(): boolean {
    return false;
  }

  /**
   * Get Tauri capabilities
   */
  getCapabilities(): TauriCapabilities {
    return {
      isDesktop: false,
      hasFileSystem: false,
      hasNativeDialogs: false
    };
  }

  /**
   * Open an Isometry file using native dialog
   */
  async openIsometryFile(): Promise<IsometryFile | null> {
    return null;
  }

  /**
   * Save an Isometry file using native dialog
   */
  async saveIsometryFile(_data: ArrayBuffer, _name?: string): Promise<string | null> {
    return null;
  }

  /**
   * Get recent files list
   */
  async getRecentFiles(): Promise<string[]> {
    return [];
  }

  /**
   * Add a file to recent files
   */
  async addRecentFile(_path: string): Promise<void> {
    // Stub implementation
  }

  /**
   * Save database to disk
   */
  async saveDatabase(_data: ArrayBuffer): Promise<void> {
    // Stub implementation
  }

  /**
   * Load database from disk
   */
  async loadDatabase(): Promise<ArrayBuffer | null> {
    return null;
  }
}

// Export singleton instance
export const tauriService = new TauriServiceImpl();
