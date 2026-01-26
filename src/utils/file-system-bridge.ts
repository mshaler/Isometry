/**
 * File System Bridge for React-Native Communication
 *
 * Provides secure file operations through WebView bridge with fallback to browser APIs
 */

import { Environment, postMessage } from './webview-bridge';

export interface FileInfo {
  name: string;
  path: string;
  size: number;
  modified: Date;
  type: 'file' | 'directory';
  extension?: string;
  mimeType?: string;
}

export enum ExportFormat {
  PDF = 'pdf',
  HTML = 'html',
  JSON = 'json',
  CSV = 'csv',
  MARKDOWN = 'md'
}

export interface ExportOptions {
  format: ExportFormat;
  filename?: string;
  includeMetadata?: boolean;
  quality?: number; // For image exports
}

/**
 * File System Bridge providing secure file operations
 */
export class FileSystemBridge {
  private cache: Map<string, FileInfo[]> = new Map();
  private cacheTTL = 30000; // 30 seconds
  private cacheTimestamps: Map<string, number> = new Map();

  /**
   * Read file content as text or binary data
   */
  async readFile(path: string, binary: boolean = false): Promise<string | ArrayBuffer> {
    if (Environment.isWebView()) {
      try {
        const result = await postMessage<{ content: string; size: number; modified: number }>('filesystem', 'readFile', { path });

        if (binary) {
          // Convert base64 to ArrayBuffer if needed
          return new ArrayBuffer(result.content.length);
        }

        return result.content;
      } catch (error) {
        throw new Error(`Failed to read file: ${error}`);
      }
    } else {
      // Browser fallback - use File API or fetch for local files
      return this.readFileBrowser(path, binary);
    }
  }

  /**
   * Write file content
   */
  async writeFile(path: string, content: string | ArrayBuffer): Promise<void> {
    if (Environment.isWebView()) {
      try {
        const contentStr = content instanceof ArrayBuffer
          ? this.arrayBufferToBase64(content)
          : content;

        await postMessage('filesystem', 'writeFile', {
          path,
          content: contentStr,
          binary: content instanceof ArrayBuffer
        });

        // Invalidate directory cache
        this.invalidateDirectoryCache(path);
      } catch (error) {
        throw new Error(`Failed to write file: ${error}`);
      }
    } else {
      return this.writeFileBrowser(path, content);
    }
  }

  /**
   * Delete file or directory
   */
  async deleteFile(path: string): Promise<void> {
    if (Environment.isWebView()) {
      try {
        await postMessage('filesystem', 'deleteFile', { path });
        this.invalidateDirectoryCache(path);
      } catch (error) {
        throw new Error(`Failed to delete file: ${error}`);
      }
    } else {
      throw new Error('Delete operation not supported in browser');
    }
  }

  /**
   * List files in directory with caching
   */
  async listFiles(directory: string = ''): Promise<FileInfo[]> {
    const cacheKey = directory || 'root';

    // Check cache first
    if (this.isCacheValid(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (cached) {
        return cached;
      }
    }

    if (Environment.isWebView()) {
      try {
        const result = await postMessage<Array<{
          name: string;
          path: string;
          isDirectory: boolean;
          size: number;
          modified: number;
        }>>('filesystem', 'listFiles', { path: directory });

        const fileInfos: FileInfo[] = result.map(item => ({
          name: item.name,
          path: item.path,
          size: item.size,
          modified: new Date(item.modified * 1000),
          type: item.isDirectory ? 'directory' : 'file',
          extension: item.isDirectory ? undefined : this.getFileExtension(item.name),
          mimeType: item.isDirectory ? undefined : this.getMimeType(item.name)
        }));

        // Cache the result
        this.cache.set(cacheKey, fileInfos);
        this.cacheTimestamps.set(cacheKey, Date.now());

        return fileInfos;
      } catch (error) {
        throw new Error(`Failed to list files: ${error}`);
      }
    } else {
      // Browser fallback - limited directory listing
      return this.listFilesBrowser(directory);
    }
  }

  /**
   * Export file with native sharing
   */
  async exportFile(path: string, options: ExportOptions): Promise<string> {
    if (Environment.isWebView()) {
      try {
        const result = await postMessage<{ exportPath: string; shareURL?: string }>('filesystem', 'exportFile', {
          path,
          ...options
        });

        return result.shareURL || result.exportPath;
      } catch (error) {
        throw new Error(`Failed to export file: ${error}`);
      }
    } else {
      return this.exportFileBrowser(path, options);
    }
  }

  /**
   * Create directory
   */
  async createDirectory(path: string): Promise<void> {
    if (Environment.isWebView()) {
      try {
        await postMessage('filesystem', 'createDirectory', { path });
        this.invalidateDirectoryCache(path);
      } catch (error) {
        throw new Error(`Failed to create directory: ${error}`);
      }
    } else {
      throw new Error('Create directory not supported in browser');
    }
  }

  /**
   * Check if file exists
   */
  async fileExists(path: string): Promise<boolean> {
    if (Environment.isWebView()) {
      try {
        const result = await postMessage<{ exists: boolean }>('filesystem', 'fileExists', { path });
        return result.exists;
      } catch (error) {
        return false;
      }
    } else {
      return this.fileExistsBrowser(path);
    }
  }

  /**
   * Get file metadata without reading content
   */
  async getFileInfo(path: string): Promise<FileInfo | null> {
    try {
      const directory = this.getDirectoryPath(path);
      const filename = this.getFileName(path);

      const files = await this.listFiles(directory);
      return files.find(f => f.name === filename) || null;
    } catch {
      return null;
    }
  }

  // MARK: - Browser Fallbacks

  private async readFileBrowser(path: string, binary: boolean): Promise<string | ArrayBuffer> {
    // In browser, we can only read files that the user explicitly selects
    // This would typically involve file input or drag-drop
    throw new Error('Direct file reading not supported in browser. Use file input instead.');
  }

  private async writeFileBrowser(path: string, content: string | ArrayBuffer): Promise<void> {
    // Browser file write using download
    const blob = content instanceof ArrayBuffer
      ? new Blob([content])
      : new Blob([content], { type: 'text/plain' });

    const url = URL.createObjectURL(blob);
    const filename = this.getFileName(path);

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  private async listFilesBrowser(directory: string): Promise<FileInfo[]> {
    // Browser can't list arbitrary directories
    // Return empty list or show file picker
    return [];
  }

  private async exportFileBrowser(path: string, options: ExportOptions): Promise<string> {
    // Browser export using download
    try {
      const content = await this.readFile(path);
      const filename = options.filename || `export.${options.format}`;

      let mimeType = 'text/plain';
      switch (options.format) {
        case ExportFormat.JSON:
          mimeType = 'application/json';
          break;
        case ExportFormat.HTML:
          mimeType = 'text/html';
          break;
        case ExportFormat.CSV:
          mimeType = 'text/csv';
          break;
        case ExportFormat.PDF:
          mimeType = 'application/pdf';
          break;
        case ExportFormat.MARKDOWN:
          mimeType = 'text/markdown';
          break;
      }

      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      return url;
    } catch (error) {
      throw new Error(`Browser export failed: ${error}`);
    }
  }

  private async fileExistsBrowser(path: string): Promise<boolean> {
    // Browser can't check arbitrary file existence
    return false;
  }

  // MARK: - Utility Methods

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  private getFileExtension(filename: string): string {
    const parts = filename.split('.');
    return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
  }

  private getMimeType(filename: string): string {
    const ext = this.getFileExtension(filename);
    const mimeMap: Record<string, string> = {
      'txt': 'text/plain',
      'md': 'text/markdown',
      'json': 'application/json',
      'html': 'text/html',
      'css': 'text/css',
      'js': 'application/javascript',
      'ts': 'application/typescript',
      'pdf': 'application/pdf',
      'png': 'image/png',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'gif': 'image/gif',
      'svg': 'image/svg+xml',
      'csv': 'text/csv',
      'xml': 'application/xml',
      'yaml': 'application/yaml',
      'yml': 'application/yaml'
    };
    return mimeMap[ext] || 'application/octet-stream';
  }

  private getDirectoryPath(path: string): string {
    const lastSlash = path.lastIndexOf('/');
    return lastSlash >= 0 ? path.substring(0, lastSlash) : '';
  }

  private getFileName(path: string): string {
    const lastSlash = path.lastIndexOf('/');
    return lastSlash >= 0 ? path.substring(lastSlash + 1) : path;
  }

  private isCacheValid(key: string): boolean {
    const timestamp = this.cacheTimestamps.get(key);
    if (!timestamp) return false;
    return Date.now() - timestamp < this.cacheTTL;
  }

  private invalidateDirectoryCache(filePath: string): void {
    const directory = this.getDirectoryPath(filePath);
    const cacheKey = directory || 'root';
    this.cache.delete(cacheKey);
    this.cacheTimestamps.delete(cacheKey);
  }

  /**
   * Clear all cached directory listings
   */
  clearCache(): void {
    this.cache.clear();
    this.cacheTimestamps.clear();
  }
}

/**
 * Singleton file system bridge instance
 */
export const fileSystemBridge = new FileSystemBridge();

/**
 * Convenience functions for common operations
 */
export const readFile = (path: string, binary?: boolean) => fileSystemBridge.readFile(path, binary);
export const writeFile = (path: string, content: string | ArrayBuffer) => fileSystemBridge.writeFile(path, content);
export const deleteFile = (path: string) => fileSystemBridge.deleteFile(path);
export const listFiles = (directory?: string) => fileSystemBridge.listFiles(directory);
export const exportFile = (path: string, options: ExportOptions) => fileSystemBridge.exportFile(path, options);
export const createDirectory = (path: string) => fileSystemBridge.createDirectory(path);
export const fileExists = (path: string) => fileSystemBridge.fileExists(path);