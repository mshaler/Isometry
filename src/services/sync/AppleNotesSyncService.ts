/**
 * AppleNotesSyncService
 *
 * Orchestrates full and incremental sync from Apple Notes to Isometry's sql.js database.
 * Wraps AppleNotesAdapter (ETL extraction) + NodeWriter (persistence) + SettingsService (state).
 *
 * RUNTIME BOUNDARY NOTE:
 * AppleNotesAdapter uses better-sqlite3 (Node.js native module).
 * AppleNotesSyncService targets sql.js (WASM/browser runtime).
 * These cannot run in the same process. Production wiring via Tauri IPC is deferred to 117-04.
 * For tests, mock the AppleNotesAdapter interface.
 *
 * Phase 117-02
 */

import type { Database } from 'sql.js';

import { createNodeWriter } from '../../etl/apple-notes-direct/NodeWriter';
import { createSettingsService } from '../../db/settings';

import type { SourceAdapter, SyncState } from '../../etl/apple-notes-direct/types';

// =============================================================================
// Types
// =============================================================================

export interface SyncProgress {
  phase: 'extracting' | 'writing' | 'cleanup' | 'complete';
  current: number;
  total: number;
  message: string;
}

export interface SyncOptions {
  onProgress?: (progress: SyncProgress) => void;
  /** Batch size for node/edge writes. Default: 100 */
  batchSize?: number;
}

export interface SyncResult {
  success: boolean;
  nodesWritten: number;
  edgesWritten: number;
  duration: number;
  error?: string;
}

// =============================================================================
// Sync State Persistence Key
// =============================================================================

const SYNC_STATE_KEY = 'apple_notes_sync_state';

// =============================================================================
// AppleNotesSyncService
// =============================================================================

export class AppleNotesSyncService {
  private readonly db: Database;
  private readonly adapter: SourceAdapter;

  constructor(db: Database, adapter: SourceAdapter) {
    this.db = db;
    this.adapter = adapter;
  }

  /**
   * Perform a full sync from Apple Notes.
   * Extracts all notes, persists them to sql.js, and saves sync state.
   */
  async fullSync(options: SyncOptions = {}): Promise<SyncResult> {
    const startTime = Date.now();
    const { onProgress, batchSize = 100 } = options;
    const writer = createNodeWriter(this.db);
    const settings = createSettingsService(this.db);

    let nodesWritten = 0;
    let edgesWritten = 0;

    try {
      // Phase 1: Extract
      onProgress?.({
        phase: 'extracting',
        current: 0,
        total: 0,
        message: 'Extracting notes from Apple Notes...',
      });

      const syncResult = await this.adapter.fullSync();
      const { nodes, edges, syncState } = syncResult;

      // Phase 2: Write nodes in batches
      onProgress?.({
        phase: 'writing',
        current: 0,
        total: nodes.length,
        message: `Writing ${nodes.length} nodes...`,
      });

      for (let i = 0; i < nodes.length; i += batchSize) {
        const batch = nodes.slice(i, i + batchSize);
        const writeResult = writer.upsertNodes(batch);
        nodesWritten += writeResult.inserted + writeResult.updated;

        onProgress?.({
          phase: 'writing',
          current: Math.min(i + batchSize, nodes.length),
          total: nodes.length,
          message: `Writing nodes ${Math.min(i + batchSize, nodes.length)}/${nodes.length}...`,
        });
      }

      // Phase 2b: Write edges in batches
      for (let i = 0; i < edges.length; i += batchSize) {
        const batch = edges.slice(i, i + batchSize);
        const writeResult = writer.upsertEdges(batch);
        edgesWritten += writeResult.inserted + writeResult.updated;
      }

      // Phase 3: Cleanup (no deletions in full sync — it replaces everything)
      onProgress?.({
        phase: 'cleanup',
        current: nodesWritten,
        total: nodes.length,
        message: 'Finalizing sync state...',
      });

      // Persist sync state
      settings.setSetting<SyncState>(SYNC_STATE_KEY, syncState);

      // Phase 4: Complete
      const duration = Date.now() - startTime;
      onProgress?.({
        phase: 'complete',
        current: nodesWritten,
        total: nodes.length,
        message: `Sync complete: ${nodesWritten} nodes, ${edgesWritten} edges in ${duration}ms`,
      });

      return {
        success: true,
        nodesWritten,
        edgesWritten,
        duration,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        nodesWritten,
        edgesWritten,
        duration: Date.now() - startTime,
        error: message,
      };
    }
  }

  /**
   * Perform an incremental sync from Apple Notes.
   * Uses the stored watermark from the previous sync to fetch only changed notes.
   * Soft-deletes nodes that were removed in the source.
   */
  async incrementalSync(options: SyncOptions = {}): Promise<SyncResult> {
    const startTime = Date.now();
    const { onProgress, batchSize = 100 } = options;
    const writer = createNodeWriter(this.db);
    const settings = createSettingsService(this.db);

    let nodesWritten = 0;
    let edgesWritten = 0;

    try {
      // Load previous sync state
      const previousState = settings.getSetting<SyncState>(SYNC_STATE_KEY);
      const stateToUse: SyncState = previousState ?? { itemCount: 0 };

      // Phase 1: Extract
      onProgress?.({
        phase: 'extracting',
        current: 0,
        total: 0,
        message: 'Extracting changed notes from Apple Notes...',
      });

      const syncResult = await this.adapter.incrementalSync(stateToUse);
      const { nodes, edges, deletedIds, syncState } = syncResult;

      // Phase 2: Write nodes in batches
      onProgress?.({
        phase: 'writing',
        current: 0,
        total: nodes.length,
        message: `Writing ${nodes.length} changed nodes...`,
      });

      for (let i = 0; i < nodes.length; i += batchSize) {
        const batch = nodes.slice(i, i + batchSize);
        const writeResult = writer.upsertNodes(batch);
        nodesWritten += writeResult.inserted + writeResult.updated;

        onProgress?.({
          phase: 'writing',
          current: Math.min(i + batchSize, nodes.length),
          total: nodes.length,
          message: `Writing nodes ${Math.min(i + batchSize, nodes.length)}/${nodes.length}...`,
        });
      }

      // Phase 2b: Write edges in batches
      for (let i = 0; i < edges.length; i += batchSize) {
        const batch = edges.slice(i, i + batchSize);
        const writeResult = writer.upsertEdges(batch);
        edgesWritten += writeResult.inserted + writeResult.updated;
      }

      // Phase 3: Cleanup — soft-delete nodes removed in source
      onProgress?.({
        phase: 'cleanup',
        current: nodesWritten,
        total: nodes.length,
        message: `Cleaning up ${deletedIds.length} removed notes...`,
      });

      if (deletedIds.length > 0) {
        // Get all active node IDs for this source (to keep)
        const allActiveResult = this.db.exec(
          'SELECT id FROM nodes WHERE source = ? AND deleted_at IS NULL',
          ['apple-notes']
        );
        const allActiveIds: string[] = [];
        if (allActiveResult.length > 0) {
          for (const row of allActiveResult[0].values) {
            const id = row[0];
            if (typeof id === 'string' && !deletedIds.includes(id)) {
              allActiveIds.push(id);
            }
          }
        }
        writer.softDeleteBySource('apple-notes', allActiveIds);
      }

      // Persist updated sync state
      settings.setSetting<SyncState>(SYNC_STATE_KEY, syncState);

      // Phase 4: Complete
      const duration = Date.now() - startTime;
      onProgress?.({
        phase: 'complete',
        current: nodesWritten,
        total: nodes.length,
        message: `Incremental sync complete: ${nodesWritten} nodes, ${edgesWritten} edges in ${duration}ms`,
      });

      return {
        success: true,
        nodesWritten,
        edgesWritten,
        duration,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        nodesWritten,
        edgesWritten,
        duration: Date.now() - startTime,
        error: message,
      };
    }
  }

  /**
   * Get the current sync state from settings.
   * Returns null if no sync has been performed yet.
   */
  getSyncState(): SyncState | null {
    const settings = createSettingsService(this.db);
    return settings.getSetting<SyncState>(SYNC_STATE_KEY);
  }
}
