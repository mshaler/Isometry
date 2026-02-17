/**
 * useAppleNotesSync Hook
 *
 * React hook for triggering Apple Notes direct sync from the UI.
 * Wraps AppleNotesSyncService with state management for progress display.
 *
 * RUNTIME BOUNDARY (RUNTIME-BOUNDARY-01 from 117-02):
 * AppleNotesAdapter uses better-sqlite3 (Node.js native) and cannot run
 * in the same process as the sql.js browser runtime. This hook wires to a
 * MOCK adapter that returns empty sample data, enabling the UI to be built
 * and tested now. Real Tauri IPC wiring is deferred to a future phase.
 *
 * Phase 117-04
 */

import { useState, useCallback } from 'react';
import { useSQLite } from '../db/SQLiteProvider';
import { AppleNotesSyncService } from '../services/sync/AppleNotesSyncService';
import type { SyncProgress, SyncResult } from '../services/sync/AppleNotesSyncService';
import type { SourceAdapter, SyncState } from '../etl/apple-notes-direct/types';

// =============================================================================
// Mock Adapter (RUNTIME-BOUNDARY-01)
// =============================================================================

/**
 * Mock SourceAdapter for browser runtime.
 *
 * AppleNotesAdapter (Node.js / better-sqlite3) cannot run in the browser.
 * This mock allows the UI sync flow to work end-to-end in development.
 * Real adapter injection via Tauri IPC is deferred to a future phase.
 *
 * @see RUNTIME-BOUNDARY-01 in 117-02-SUMMARY.md
 */
const createMockAdapter = (): SourceAdapter => ({
  sourceType: 'apple-notes',
  displayName: 'Apple Notes (Mock)',

  async isAvailable() {
    return false; // Not available in browser runtime
  },

  async fullSync() {
    return {
      nodes: [],
      edges: [],
      deletedIds: [],
      syncState: { itemCount: 0 } satisfies SyncState,
    };
  },

  async incrementalSync(_state: SyncState) {
    return {
      nodes: [],
      edges: [],
      deletedIds: [],
      syncState: { itemCount: 0 } satisfies SyncState,
    };
  },

  async getSyncState() {
    return { itemCount: 0 };
  },
});

// =============================================================================
// Types
// =============================================================================

export type SyncStatus = 'idle' | 'syncing' | 'complete' | 'error';

export interface UseAppleNotesSyncResult {
  /** Current sync status */
  syncStatus: SyncStatus;
  /** Live sync progress from AppleNotesSyncService (phase, current, total, message) */
  progress: SyncProgress | null;
  /** Sync result after completion (nodesWritten, edgesWritten, duration, error) */
  result: SyncResult | null;
  /** Trigger a full sync (all notes) */
  startFullSync: () => Promise<void>;
  /** Trigger an incremental sync (only changed notes since last sync) */
  startIncrementalSync: () => Promise<void>;
}

// =============================================================================
// Hook
// =============================================================================

/**
 * useAppleNotesSync
 *
 * Wraps AppleNotesSyncService with React state for progress display and
 * result reporting. Exposes startFullSync and startIncrementalSync actions
 * that update progress in real-time via the onProgress callback.
 *
 * @example
 * ```tsx
 * const { syncStatus, progress, result, startFullSync } = useAppleNotesSync();
 *
 * // In menu handler:
 * startFullSync();
 * ```
 */
export function useAppleNotesSync(): UseAppleNotesSyncResult {
  const { db, loading: dbLoading } = useSQLite();
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [progress, setProgress] = useState<SyncProgress | null>(null);
  const [result, setResult] = useState<SyncResult | null>(null);

  const startFullSync = useCallback(async () => {
    if (!db || dbLoading) {
      console.warn('[useAppleNotesSync] Database not initialized, skipping sync');
      return;
    }

    setSyncStatus('syncing');
    setProgress(null);
    setResult(null);

    const mockAdapter = createMockAdapter();
    const service = new AppleNotesSyncService(db, mockAdapter);

    const syncResult = await service.fullSync({
      onProgress: (p: SyncProgress) => {
        setProgress(p);
      },
    });

    setResult(syncResult);
    setSyncStatus(syncResult.success ? 'complete' : 'error');
  }, [db, dbLoading]);

  const startIncrementalSync = useCallback(async () => {
    if (!db || dbLoading) {
      console.warn('[useAppleNotesSync] Database not initialized, skipping sync');
      return;
    }

    setSyncStatus('syncing');
    setProgress(null);
    setResult(null);

    const mockAdapter = createMockAdapter();
    const service = new AppleNotesSyncService(db, mockAdapter);

    const syncResult = await service.incrementalSync({
      onProgress: (p: SyncProgress) => {
        setProgress(p);
      },
    });

    setResult(syncResult);
    setSyncStatus(syncResult.success ? 'complete' : 'error');
  }, [db, dbLoading]);

  return {
    syncStatus,
    progress,
    result,
    startFullSync,
    startIncrementalSync,
  };
}
