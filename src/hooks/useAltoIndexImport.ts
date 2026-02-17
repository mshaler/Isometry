/**
 * useAltoIndexImport Hook
 *
 * React hook for importing alto-index data into the sql.js database.
 * Loads preprocessed JSON from the public directory and imports nodes.
 *
 * @deprecated useAltoIndexImport is deprecated. Apple Notes direct sync is
 * now available via useAppleNotesSync and the 'Sync Apple Notes...' File menu.
 * The alto-index.json pipeline has known folder mapping errors. This hook will
 * be removed in a future phase after IntegratedLayout.tsx and
 * SuperGridScrollTest.tsx are migrated to useAppleNotesSync.
 */

import { useState, useCallback, useEffect } from 'react';
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
  const { db, loading: dbLoading, save } = useSQLite();
  const [status, setStatus] = useState<UseAltoIndexImportResult['status']>('idle');
  const [progress, setProgress] = useState(0);
  const [currentFile, setCurrentFile] = useState('');
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.warn('[DEPRECATED] useAltoIndexImport is deprecated. Apple Notes direct sync is now available in File menu.');
  }, []);

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

        // Handle missing file gracefully - return empty result instead of crashing
        // This supports the deprecation path: alto-index.json may not exist for new users
        if (!response.ok || response.status === 404) {
          devLogger.warn('alto-index.json not found - this is expected if using Apple Notes direct sync');
          const emptyResult: ImportResult = {
            imported: 0,
            skipped: 0,
            errors: [],
            duration: 0,
            reconciliation: { totalFiles: 0, importedByType: {}, skippedByReason: {} },
          };
          setResult(emptyResult);
          setStatus('done');
          return emptyResult;
        }

        // Verify response is actually JSON (not HTML fallback)
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          devLogger.warn('alto-index.json returned non-JSON content - treating as missing');
          const emptyResult: ImportResult = {
            imported: 0,
            skipped: 0,
            errors: [],
            duration: 0,
            reconciliation: { totalFiles: 0, importedByType: {}, skippedByReason: {} },
          };
          setResult(emptyResult);
          setStatus('done');
          return emptyResult;
        }

        const data: AltoIndexData = await response.json();
        devLogger.inspect('Loaded alto-index data', { stats: data.stats });

        setStatus('importing');

        // Memory optimization: process in batches to allow GC between batches
        const BATCH_SIZE = 2000;
        const totalFiles = data.files.length;
        const cumulativeResult: ImportResult = {
          imported: 0,
          skipped: 0,
          errors: [],
          duration: 0,
          reconciliation: {
            totalFiles,
            importedByType: {},
            skippedByReason: {},
          },
        };

        // Process in batches to reduce memory pressure
        for (let batchStart = 0; batchStart < totalFiles; batchStart += BATCH_SIZE) {
          const batchEnd = Math.min(batchStart + BATCH_SIZE, totalFiles);
          const batch = data.files.slice(batchStart, batchEnd);

          const batchResult = importAltoFiles(
            db,
            batch.map((f) => ({ path: f.path, content: f.content })),
            {
              dataTypes: options.dataTypes,
              // Only clear on first batch
              clearExisting: batchStart === 0 ? options.clearExisting : false,
              onProgress: (imported, _batchTotal, current) => {
                const globalProgress = batchStart + imported;
                setProgress(Math.round((globalProgress / totalFiles) * 100));
                setCurrentFile(current);
              },
            }
          );

          // Merge batch results
          cumulativeResult.imported += batchResult.imported;
          cumulativeResult.skipped += batchResult.skipped;
          cumulativeResult.errors.push(...batchResult.errors);
          cumulativeResult.duration += batchResult.duration;

          // Merge reconciliation
          if (batchResult.reconciliation) {
            for (const [type, count] of Object.entries(batchResult.reconciliation.importedByType)) {
              cumulativeResult.reconciliation!.importedByType[type] =
                (cumulativeResult.reconciliation!.importedByType[type] || 0) + count;
            }
            for (const [reason, count] of Object.entries(batchResult.reconciliation.skippedByReason)) {
              cumulativeResult.reconciliation!.skippedByReason[reason] =
                (cumulativeResult.reconciliation!.skippedByReason[reason] || 0) + count;
            }
          }

          // Allow garbage collection between batches
          await new Promise(resolve => setTimeout(resolve, 0));
        }

        const importResult = cumulativeResult;

        setResult(importResult);
        setStatus('done');
        devLogger.info('Alto-index import complete', { importResult });

        // Trigger auto-save to localStorage
        await save();

        return importResult;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        setError(message);
        setStatus('error');
        throw err;
      }
    },
    [db, dbLoading, save]
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
    // Trigger auto-save after clearing
    await save();
    return count;
  }, [db, dbLoading, save]);

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
