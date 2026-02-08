/**
 * Tauri Desktop Integration Service
 * Provides native desktop features for the Isometry SuperGrid application
 */

import { invoke } from '@tauri-apps/api/core';
import { open, save } from '@tauri-apps/plugin-dialog';

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

export class TauriService {
  private static instance: TauriService;
  private capabilities: TauriCapabilities;

  private constructor() {
    this.capabilities = this.detectCapabilities();
  }

  public static getInstance(): TauriService {
    if (!TauriService.instance) {
      TauriService.instance = new TauriService();
    }
    return TauriService.instance;
  }

  private detectCapabilities(): TauriCapabilities {
    // Check if we're running in Tauri context
    const isDesktop = typeof window !== 'undefined' &&
                     window.__TAURI_INTERNALS__ !== undefined;

    return {
      isDesktop,
      hasFileSystem: isDesktop,
      hasNativeDialogs: isDesktop,
    };
  }

  public getCapabilities(): TauriCapabilities {
    return this.capabilities;
  }

  /**
   * Open .isometry file using native file dialog
   */
  async openIsometryFile(): Promise<IsometryFile | null> {
    if (!this.capabilities.hasNativeDialogs) {
      throw new Error('Native file dialogs not available');
    }

    try {
      const selected = await open({
        filters: [
          {
            name: 'Isometry Database',
            extensions: ['isometry', 'db', 'sqlite', 'sqlite3']
          }
        ],
        multiple: false,
        directory: false,
      });

      if (!selected) {
        return null; // User cancelled
      }

      const path = typeof selected === 'string' ? selected : selected.path;
      const name = this.extractFileName(path);

      // Read file data (placeholder for now)
      // TODO: Implement actual file reading with @tauri-apps/plugin-fs
      const data = new ArrayBuffer(0);

      return {
        path,
        name,
        data,
      };
    } catch (error) {
      console.error('Failed to open file:', error);
      throw new Error('Failed to open file: ' + (error as Error).message);
    }
  }

  /**
   * Save .isometry file using native file dialog
   */
  async saveIsometryFile(data: ArrayBuffer, suggestedName?: string): Promise<string | null> {
    if (!this.capabilities.hasNativeDialogs) {
      throw new Error('Native file dialogs not available');
    }

    try {
      const path = await save({
        filters: [
          {
            name: 'Isometry Database',
            extensions: ['isometry']
          }
        ],
        defaultPath: suggestedName ? `${suggestedName}.isometry` : 'untitled.isometry',
      });

      if (!path) {
        return null; // User cancelled
      }

      // Save file data (placeholder for now)
      // TODO: Implement actual file writing with @tauri-apps/plugin-fs
      await invoke('save_isometry_file', { data: 'placeholder' });

      return path;
    } catch (error) {
      console.error('Failed to save file:', error);
      throw new Error('Failed to save file: ' + (error as Error).message);
    }
  }

  /**
   * Save current database state
   */
  async saveDatabase(databaseData: ArrayBuffer): Promise<void> {
    if (!this.capabilities.hasFileSystem) {
      console.warn('Desktop file system not available, falling back to browser storage');
      // TODO: Implement browser storage fallback
      return;
    }

    try {
      // Convert ArrayBuffer to base64 for transmission
      const base64Data = this.arrayBufferToBase64(databaseData);
      await invoke('save_isometry_file', { data: base64Data });
    } catch (error) {
      console.error('Failed to save database:', error);
      throw new Error('Failed to save database: ' + (error as Error).message);
    }
  }

  /**
   * Load database from file
   */
  async loadDatabase(): Promise<ArrayBuffer | null> {
    try {
      const result = await invoke<string>('open_isometry_file');

      if (result === 'placeholder-file-path') {
        // Placeholder response, return null for now
        return null;
      }

      // Convert base64 back to ArrayBuffer
      return this.base64ToArrayBuffer(result);
    } catch (error) {
      console.error('Failed to load database:', error);
      return null;
    }
  }

  /**
   * Check if we're running in Tauri desktop environment
   */
  isDesktopEnvironment(): boolean {
    return this.capabilities.isDesktop;
  }

  /**
   * Get recent files (placeholder for implementation)
   */
  async getRecentFiles(): Promise<string[]> {
    // TODO: Implement with window state plugin or local storage
    return [];
  }

  /**
   * Add file to recent files list
   */
  async addRecentFile(filePath: string): Promise<void> {
    // TODO: Implement with window state plugin or local storage
    console.log('Adding to recent files:', filePath);
  }

  // Utility methods
  private extractFileName(path: string): string {
    return path.split(/[\\/]/).pop() || 'unknown';
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }
}

// Export singleton instance
export const tauriService = TauriService.getInstance();