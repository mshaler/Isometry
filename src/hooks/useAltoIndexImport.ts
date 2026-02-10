/**
 * useAltoIndexImport Hook
 *
 * React hook for importing alto-index data into the sql.js database.
 * Loads preprocessed JSON from the public directory and imports nodes.
 */

import { useState, useCallback } from 'react';
import { useSQLite } from '../db/SQLiteProvider';
import { importAltoFiles, getImportStats, clearAltoIndexData, type ImportResult, type AltoDataType } from '../etl';
import { devLogger } from '../utils/logging';

// Note: notifyDataChanged is called after import to trigger query invalidation and auto-save

export interface AltoIndexFile {
  path: string;
  content: string;
  type: string;
}

export interface AltoIndexData {
  version: number;
  generated: string;
  source: string;
  stats: Record<string, number>;
  files: AltoIndexFile[];
}

export interface UseAltoIndexImportOptions {
  /** Data types to import */
  dataTypes?: AltoDataType[];
  /** Maximum number of files to import */
  limit?: number;
  /** Clear existing alto-index data before import */
  clearExisting?: boolean;
}

export interface UseAltoIndexImportResult {
  /** Import alto-index data from preprocessed JSON */
  importFromJSON: (options?: UseAltoIndexImportOptions) => Promise<ImportResult>;
  /** Load and import from the default public/alto-index.json */
  importFromPublic: (options?: UseAltoIndexImportOptions) => Promise<ImportResult>;
  /** Get current import statistics */
  getStats: () => Record<string, number>;
  /** Clear all imported alto-index data */
  clearData: () => Promise<number>;
  /** Current import status */
  status: 'idle' | 'loading' | 'importing' | 'done' | 'error';
  /** Import progress (0-100) */
  progress: number;
  /** Current file being processed */
  currentFile: string;
  /** Last import result */
  result: ImportResult | null;
  /** Error message if any */
  error: string | null;
}

export function useAltoIndexImport(): UseAltoIndexImportResult {
  const { db, loading: dbLoading, notifyDataChanged } = useSQLite();
  const [status, setStatus] = useState<UseAltoIndexImportResult['status']>('idle');
  const [progress, setProgress] = useState(0);
  const [currentFile, setCurrentFile] = useState('');
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const importFromJSON = useCallback(
    async (options: UseAltoIndexImportOptions = {}): Promise<ImportResult> => {
      if (!db || dbLoading) {
        throw new Error('Database not initialized');
      }

      // Reset state
      setStatus('loading');
      setProgress(0);
      setCurrentFile('');
      setError(null);

      try {
        // Fetch the preprocessed JSON
        const response = await fetch('/alto-index.json');
        if (!response.ok) {
          throw new Error(`Failed to load alto-index.json: ${response.statusText}`);
        }

        const data: AltoIndexData = await response.json();
        devLogger.inspect('Loaded alto-index data', { stats: data.stats });

        setStatus('importing');

        // Import files
        const importResult = importAltoFiles(
          db,
          data.files.map((f) => ({ path: f.path, content: f.content })),
          {
            dataTypes: options.dataTypes,
            limit: options.limit,
            clearExisting: options.clearExisting,
            onProgress: (imported, total, current) => {
              setProgress(Math.round((imported / total) * 100));
              setCurrentFile(current);
            },
          }
        );

        setResult(importResult);
        setStatus('done');
        devLogger.info('Alto-index import complete', { importResult });

        // Trigger query invalidation and auto-save to localStorage
        await notifyDataChanged();

        return importResult;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        setError(message);
        setStatus('error');
        throw err;
      }
    },
    [db, dbLoading, notifyDataChanged]
  );

  const importFromPublic = useCallback(
    async (options: UseAltoIndexImportOptions = {}): Promise<ImportResult> => {
      return importFromJSON(options);
    },
    [importFromJSON]
  );

  const getStats = useCallback((): Record<string, number> => {
    if (!db || dbLoading) {
      return {};
    }
    return getImportStats(db);
  }, [db, dbLoading]);

  const clearData = useCallback(async (): Promise<number> => {
    if (!db || dbLoading) {
      return 0;
    }
    const count = clearAltoIndexData(db);
    setResult(null);
    setStatus('idle');
    // Trigger query invalidation and auto-save after clearing
    await notifyDataChanged();
    return count;
  }, [db, dbLoading, notifyDataChanged]);

  return {
    importFromJSON,
    importFromPublic,
    getStats,
    clearData,
    status,
    progress,
    currentFile,
    result,
    error,
  };
}
