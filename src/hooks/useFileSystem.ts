/**
 * React Hook for File System Operations
 *
 * Provides a React-friendly interface for file operations with loading states,
 * error handling, and progress tracking
 */

import { useState, useCallback, useEffect } from 'react';
import {
  fileSystemBridge,
  FileInfo,
  ExportFormat,
  ExportOptions
} from '../utils/file-system-bridge';
import { Environment } from '../utils/webview-bridge';

interface UseFileSystemState {
  isLoading: boolean;
  error: string | null;
  files: FileInfo[];
  currentDirectory: string;
}

interface UseFileSystemActions {
  readFile: (path: string, binary?: boolean) => Promise<string | ArrayBuffer>;
  writeFile: (path: string, content: string | ArrayBuffer) => Promise<void>;
  deleteFile: (path: string) => Promise<void>;
  listFiles: (directory?: string) => Promise<FileInfo[]>;
  exportFile: (path: string, options: ExportOptions) => Promise<string>;
  createDirectory: (path: string) => Promise<void>;
  fileExists: (path: string) => Promise<boolean>;
  getFileInfo: (path: string) => Promise<FileInfo | null>;
  refreshDirectory: () => Promise<void>;
  clearCache: () => void;
  setCurrentDirectory: (path: string) => void;
}

export interface UseFileSystemResult extends UseFileSystemState, UseFileSystemActions {
  isWebViewEnvironment: boolean;
  canWrite: boolean;
  canDelete: boolean;
  canExport: boolean;
}

/**
 * Hook for file system operations with React state management
 */
export function useFileSystem(initialDirectory: string = ''): UseFileSystemResult {
  const [state, setState] = useState<UseFileSystemState>({
    isLoading: false,
    error: null,
    files: [],
    currentDirectory: initialDirectory
  });

  const isWebViewEnvironment = Environment.isWebView();
  const canWrite = isWebViewEnvironment;
  const canDelete = isWebViewEnvironment;
  const canExport = true; // Works in both environments

  // Update state helper
  const updateState = useCallback((updates: Partial<UseFileSystemState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  // Error handler
  const handleError = useCallback((error: unknown, operation: string) => {
    const message = error instanceof Error ? error.message : `${operation} failed`;
    console.error(`File system ${operation} error:`, error);
    updateState({ error: message, isLoading: false });
  }, [updateState]);

  // Success handler
  const handleSuccess = useCallback(() => {
    updateState({ error: null, isLoading: false });
  }, [updateState]);

  // Read file operation
  const readFile = useCallback(async (path: string, binary: boolean = false): Promise<string | ArrayBuffer> => {
    updateState({ isLoading: true, error: null });

    try {
      const result = await fileSystemBridge.readFile(path, binary);
      handleSuccess();
      return result;
    } catch (error) {
      handleError(error, 'read file');
      throw error;
    }
  }, [updateState, handleError, handleSuccess]);

  // Write file operation
  const writeFile = useCallback(async (path: string, content: string | ArrayBuffer): Promise<void> => {
    if (!canWrite) {
      throw new Error('Write operations not supported in browser environment');
    }

    updateState({ isLoading: true, error: null });

    try {
      await fileSystemBridge.writeFile(path, content);
      handleSuccess();

      // Refresh current directory if the file is in it
      if (path.startsWith(state.currentDirectory)) {
        await listFiles(state.currentDirectory);
      }
    } catch (error) {
      handleError(error, 'write file');
      throw error;
    }
  }, [canWrite, state.currentDirectory, updateState, handleError, handleSuccess]);

  // Delete file operation
  const deleteFile = useCallback(async (path: string): Promise<void> => {
    if (!canDelete) {
      throw new Error('Delete operations not supported in browser environment');
    }

    updateState({ isLoading: true, error: null });

    try {
      await fileSystemBridge.deleteFile(path);
      handleSuccess();

      // Refresh current directory if the file was in it
      if (path.startsWith(state.currentDirectory)) {
        await listFiles(state.currentDirectory);
      }
    } catch (error) {
      handleError(error, 'delete file');
      throw error;
    }
  }, [canDelete, state.currentDirectory, updateState, handleError, handleSuccess]);

  // List files operation
  const listFiles = useCallback(async (directory?: string): Promise<FileInfo[]> => {
    const targetDir = directory ?? state.currentDirectory;
    updateState({ isLoading: true, error: null });

    try {
      const files = await fileSystemBridge.listFiles(targetDir);
      updateState({
        files,
        currentDirectory: targetDir,
        isLoading: false,
        error: null
      });
      return files;
    } catch (error) {
      handleError(error, 'list files');
      return [];
    }
  }, [state.currentDirectory, updateState, handleError]);

  // Export file operation
  const exportFile = useCallback(async (path: string, options: ExportOptions): Promise<string> => {
    updateState({ isLoading: true, error: null });

    try {
      const result = await fileSystemBridge.exportFile(path, options);
      handleSuccess();
      return result;
    } catch (error) {
      handleError(error, 'export file');
      throw error;
    }
  }, [updateState, handleError, handleSuccess]);

  // Create directory operation
  const createDirectory = useCallback(async (path: string): Promise<void> => {
    if (!canWrite) {
      throw new Error('Create directory not supported in browser environment');
    }

    updateState({ isLoading: true, error: null });

    try {
      await fileSystemBridge.createDirectory(path);
      handleSuccess();

      // Refresh current directory if the new directory is in it
      const parentDir = path.substring(0, path.lastIndexOf('/'));
      if (parentDir === state.currentDirectory) {
        await listFiles(state.currentDirectory);
      }
    } catch (error) {
      handleError(error, 'create directory');
      throw error;
    }
  }, [canWrite, state.currentDirectory, updateState, handleError, handleSuccess]);

  // File exists check
  const fileExists = useCallback(async (path: string): Promise<boolean> => {
    try {
      return await fileSystemBridge.fileExists(path);
    } catch (error) {
      console.warn('File exists check failed:', error);
      return false;
    }
  }, []);

  // Get file info
  const getFileInfo = useCallback(async (path: string): Promise<FileInfo | null> => {
    try {
      return await fileSystemBridge.getFileInfo(path);
    } catch (error) {
      console.warn('Get file info failed:', error);
      return null;
    }
  }, []);

  // Refresh current directory
  const refreshDirectory = useCallback(async (): Promise<void> => {
    await listFiles(state.currentDirectory);
  }, [state.currentDirectory, listFiles]);

  // Clear cache
  const clearCache = useCallback((): void => {
    fileSystemBridge.clearCache();
  }, []);

  // Set current directory
  const setCurrentDirectory = useCallback((path: string): void => {
    updateState({ currentDirectory: path });
  }, [updateState]);

  // Load initial directory on mount
  useEffect(() => {
    if (isWebViewEnvironment && state.currentDirectory) {
      listFiles(state.currentDirectory).catch(error => {
        console.warn('Failed to load initial directory:', error);
      });
    }
  }, [isWebViewEnvironment, state.currentDirectory, listFiles]);

  return {
    // State
    isLoading: state.isLoading,
    error: state.error,
    files: state.files,
    currentDirectory: state.currentDirectory,

    // Environment info
    isWebViewEnvironment,
    canWrite,
    canDelete,
    canExport,

    // Actions
    readFile,
    writeFile,
    deleteFile,
    listFiles,
    exportFile,
    createDirectory,
    fileExists,
    getFileInfo,
    refreshDirectory,
    clearCache,
    setCurrentDirectory
  };
}

/**
 * Hook for simple file operations without state management
 */
export function useSimpleFileSystem() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const executeOperation = useCallback(async <T>(operation: () => Promise<T>): Promise<T> => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await operation();
      setIsLoading(false);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Operation failed';
      setError(message);
      setIsLoading(false);
      throw err;
    }
  }, []);

  return {
    isLoading,
    error,
    readFile: (path: string, binary?: boolean) =>
      executeOperation(() => fileSystemBridge.readFile(path, binary)),
    writeFile: (path: string, content: string | ArrayBuffer) =>
      executeOperation(() => fileSystemBridge.writeFile(path, content)),
    exportFile: (path: string, options: ExportOptions) =>
      executeOperation(() => fileSystemBridge.exportFile(path, options)),
    fileExists: (path: string) =>
      executeOperation(() => fileSystemBridge.fileExists(path)),
    clearError: () => setError(null)
  };
}

/**
 * Hook for file picker operations (browser compatible)
 */
export function useFilePicker() {
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  const pickFile = useCallback((accept?: string): Promise<File | null> => {
    return new Promise((resolve) => {
      setIsPickerOpen(true);

      const input = document.createElement('input');
      input.type = 'file';
      if (accept) input.accept = accept;

      input.onchange = (e) => {
        const target = e.target as HTMLInputElement;
        const file = target.files?.[0] || null;
        setIsPickerOpen(false);
        resolve(file);
      };

      input.oncancel = () => {
        setIsPickerOpen(false);
        resolve(null);
      };

      input.click();
    });
  }, []);

  const pickFiles = useCallback((accept?: string, multiple: boolean = true): Promise<File[]> => {
    return new Promise((resolve) => {
      setIsPickerOpen(true);

      const input = document.createElement('input');
      input.type = 'file';
      input.multiple = multiple;
      if (accept) input.accept = accept;

      input.onchange = (e) => {
        const target = e.target as HTMLInputElement;
        const files = Array.from(target.files || []);
        setIsPickerOpen(false);
        resolve(files);
      };

      input.oncancel = () => {
        setIsPickerOpen(false);
        resolve([]);
      };

      input.click();
    });
  }, []);

  return {
    isPickerOpen,
    pickFile,
    pickFiles
  };
}