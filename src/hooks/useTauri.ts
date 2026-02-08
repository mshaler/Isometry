/**
 * React hook for Tauri desktop integration
 */

import { useState, useEffect, useCallback } from 'react';
import { tauriService, TauriCapabilities, IsometryFile } from '@/services/TauriService';

export interface TauriHookState {
  isDesktop: boolean;
  capabilities: TauriCapabilities;
  isLoading: boolean;
  error: string | null;
  recentFiles: string[];
}

export interface TauriActions {
  openFile: () => Promise<IsometryFile | null>;
  saveFile: (data: ArrayBuffer, name?: string) => Promise<string | null>;
  saveDatabase: (data: ArrayBuffer) => Promise<void>;
  loadDatabase: () => Promise<ArrayBuffer | null>;
  clearError: () => void;
}

export function useTauri(): [TauriHookState, TauriActions] {
  const [state, setState] = useState<TauriHookState>({
    isDesktop: false,
    capabilities: {
      isDesktop: false,
      hasFileSystem: false,
      hasNativeDialogs: false,
    },
    isLoading: false,
    error: null,
    recentFiles: [],
  });

  // Initialize Tauri capabilities on mount
  useEffect(() => {
    const capabilities = tauriService.getCapabilities();
    setState(prev => ({
      ...prev,
      isDesktop: capabilities.isDesktop,
      capabilities,
    }));

    // Load recent files
    if (capabilities.isDesktop) {
      tauriService.getRecentFiles()
        .then(files => {
          setState(prev => ({ ...prev, recentFiles: files }));
        })
        .catch(error => {
          console.warn('Failed to load recent files:', error);
        });
    }
  }, []);

  const setLoading = useCallback((loading: boolean) => {
    setState(prev => ({ ...prev, isLoading: loading }));
  }, []);

  const setError = useCallback((error: string | null) => {
    setState(prev => ({ ...prev, error }));
  }, []);

  const openFile = useCallback(async (): Promise<IsometryFile | null> => {
    if (!state.capabilities.hasNativeDialogs) {
      setError('Native file dialogs not available');
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      const file = await tauriService.openIsometryFile();

      if (file) {
        // Add to recent files
        await tauriService.addRecentFile(file.path);

        // Update recent files list
        const recentFiles = await tauriService.getRecentFiles();
        setState(prev => ({ ...prev, recentFiles }));
      }

      return file;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setError(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  }, [state.capabilities.hasNativeDialogs]);

  const saveFile = useCallback(async (data: ArrayBuffer, name?: string): Promise<string | null> => {
    if (!state.capabilities.hasNativeDialogs) {
      setError('Native file dialogs not available');
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      const filePath = await tauriService.saveIsometryFile(data, name);

      if (filePath) {
        // Add to recent files
        await tauriService.addRecentFile(filePath);

        // Update recent files list
        const recentFiles = await tauriService.getRecentFiles();
        setState(prev => ({ ...prev, recentFiles }));
      }

      return filePath;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setError(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  }, [state.capabilities.hasNativeDialogs]);

  const saveDatabase = useCallback(async (data: ArrayBuffer): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      await tauriService.saveDatabase(data);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setError(errorMessage);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDatabase = useCallback(async (): Promise<ArrayBuffer | null> => {
    setLoading(true);
    setError(null);

    try {
      const data = await tauriService.loadDatabase();
      return data;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setError(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const actions: TauriActions = {
    openFile,
    saveFile,
    saveDatabase,
    loadDatabase,
    clearError,
  };

  return [state, actions];
}

/**
 * Hook to check if running in Tauri desktop environment
 */
export function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    setIsDesktop(tauriService.isDesktopEnvironment());
  }, []);

  return isDesktop;
}