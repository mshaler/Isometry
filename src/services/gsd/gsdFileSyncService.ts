/**
 * GSD File Sync Service - Orchestrates file synchronization
 *
 * Handles WebSocket messages for GSD file operations:
 * - start_gsd_watch: Begin watching .planning/ directory
 * - stop_gsd_watch: Stop watching for a session
 * - gsd_read_plan: Parse and return a plan file
 * - gsd_task_update: Update task status in a plan file
 *
 * Integrates file watcher with file writer, preventing update loops
 * by marking write paths before executing writes.
 */

import { WebSocket } from 'ws';
import { GSDFileWatcher } from './gsdFileWatcher';
import { parseGSDPlanFile } from './gsdFileParser';
import { updateTaskStatus } from './gsdFileWriter';
import {
  applyResolution,
  detectConflict,
  type ConflictData,
  type ConflictResolution,
} from './gsdConflictResolver';
import type { ParsedPlanFile, TaskStatus } from './gsdTypes';
import { devLogger } from '../../utils/logging';

/**
 * Incoming message types for GSD file sync
 */
export interface GSDSyncMessage {
  type:
    | 'start_gsd_watch'
    | 'stop_gsd_watch'
    | 'gsd_task_update'
    | 'gsd_read_plan'
    | 'gsd_resolve_conflict';
  sessionId: string;
  planPath?: string;
  taskIndex?: number;
  status?: TaskStatus;
  resolution?: ConflictResolution;
  conflict?: ConflictData;
}

/**
 * Response message types for GSD file sync
 */
export interface GSDSyncResponse {
  type:
    | 'gsd_watch_started'
    | 'gsd_watch_stopped'
    | 'gsd_plan_data'
    | 'gsd_task_updated'
    | 'gsd_conflict'
    | 'gsd_conflict_resolved'
    | 'gsd_error';
  sessionId: string;
  planPath?: string;
  data?: ParsedPlanFile;
  conflict?: ConflictData;
  resolution?: ConflictResolution;
  error?: string;
}

/**
 * Service that orchestrates GSD file reading, watching, and writing
 */
export class GSDFileSyncService {
  private fileWatcher: GSDFileWatcher;
  /** Last synced state per plan path for conflict detection */
  private lastSyncedState = new Map<string, ParsedPlanFile>();

  constructor(private projectPath: string) {
    this.fileWatcher = new GSDFileWatcher(projectPath);
  }

  /**
   * Handle incoming WebSocket message for GSD operations
   */
  async handleMessage(ws: WebSocket, message: GSDSyncMessage): Promise<void> {
    try {
      switch (message.type) {
        case 'start_gsd_watch':
          this.fileWatcher.startWatching(message.sessionId, ws);
          ws.send(
            JSON.stringify({
              type: 'gsd_watch_started',
              sessionId: message.sessionId,
            } as GSDSyncResponse)
          );
          break;

        case 'stop_gsd_watch':
          this.fileWatcher.stopWatching(message.sessionId);
          ws.send(
            JSON.stringify({
              type: 'gsd_watch_stopped',
              sessionId: message.sessionId,
            } as GSDSyncResponse)
          );
          break;

        case 'gsd_read_plan': {
          if (!message.planPath) {
            throw new Error('planPath required for gsd_read_plan');
          }
          const parsed = await parseGSDPlanFile(
            `${this.projectPath}/.planning/${message.planPath}`
          );
          ws.send(
            JSON.stringify({
              type: 'gsd_plan_data',
              sessionId: message.sessionId,
              planPath: message.planPath,
              data: parsed,
            } as GSDSyncResponse)
          );
          break;
        }

        case 'gsd_task_update':
          if (
            !message.planPath ||
            message.taskIndex === undefined ||
            !message.status
          ) {
            throw new Error(
              'planPath, taskIndex, and status required for gsd_task_update'
            );
          }

          // Mark path to prevent update loop from our own write
          this.fileWatcher.markWritePath(`.planning/${message.planPath}`);

          await updateTaskStatus(
            this.projectPath,
            message.planPath,
            message.taskIndex,
            message.status
          );

          ws.send(
            JSON.stringify({
              type: 'gsd_task_updated',
              sessionId: message.sessionId,
              planPath: message.planPath,
            } as GSDSyncResponse)
          );
          break;

        case 'gsd_resolve_conflict':
          if (
            !message.planPath ||
            !message.resolution ||
            !message.conflict
          ) {
            throw new Error(
              'planPath, resolution, and conflict required for gsd_resolve_conflict'
            );
          }
          await this.handleConflictResolution(
            ws,
            message.sessionId,
            message.planPath,
            message.resolution,
            message.conflict
          );
          break;

        default:
          throw new Error(
            `Unknown GSD message type: ${(message as { type: string }).type}`
          );
      }
    } catch (error) {
      devLogger.error('GSD sync error', {
        component: 'GSDFileSyncService',
        error,
        messageType: message.type,
      });
      ws.send(
        JSON.stringify({
          type: 'gsd_error',
          sessionId: message.sessionId,
          error: error instanceof Error ? error.message : 'Unknown error',
        } as GSDSyncResponse)
      );
    }
  }

  /**
   * Handle file update from watcher - check for conflicts before broadcasting
   *
   * Call this when file watcher detects a change to check if there's a conflict
   * with any pending UI changes.
   *
   * @param ws - WebSocket to send conflict notification
   * @param sessionId - Session that owns the WebSocket
   * @param planPath - Relative path to the plan file
   * @param newFileState - Newly parsed file state from disk
   * @returns Whether a conflict was detected
   */
  async handleFileChange(
    ws: WebSocket,
    sessionId: string,
    planPath: string,
    newFileState: ParsedPlanFile
  ): Promise<{ hasConflict: boolean; conflict?: ConflictData }> {
    const lastSynced = this.lastSyncedState.get(planPath);

    if (!lastSynced) {
      // First load - no conflict possible
      this.lastSyncedState.set(planPath, newFileState);
      return { hasConflict: false };
    }

    // Check if there are pending UI changes (compare current state)
    const conflict = detectConflict(newFileState, lastSynced);

    if (conflict) {
      // Send conflict notification to client
      ws.send(
        JSON.stringify({
          type: 'gsd_conflict',
          sessionId,
          planPath,
          conflict,
        } as GSDSyncResponse)
      );

      devLogger.debug('GSD conflict detected', {
        component: 'GSDFileSyncService',
        planPath,
        diffCount: conflict.diffs.length,
      });

      return { hasConflict: true, conflict };
    }

    // No conflict - update synced state
    this.lastSyncedState.set(planPath, newFileState);
    return { hasConflict: false };
  }

  /**
   * Handle conflict resolution from client
   *
   * @param ws - WebSocket to send response
   * @param sessionId - Session that sent the resolution
   * @param planPath - Path to the conflicting plan
   * @param resolution - User's resolution choice
   * @param conflict - The conflict data
   */
  async handleConflictResolution(
    ws: WebSocket,
    sessionId: string,
    planPath: string,
    resolution: ConflictResolution,
    conflict: ConflictData
  ): Promise<void> {
    const resolved = applyResolution(conflict, resolution);

    if (resolution === 'keep_ui' && resolved) {
      // Write UI version back to file
      this.fileWatcher.markWritePath(`.planning/${planPath}`);

      // Update each differing task
      for (const diff of conflict.diffs.filter((d) => d.taskIndex >= 0)) {
        await updateTaskStatus(
          this.projectPath,
          planPath,
          diff.taskIndex,
          diff.uiValue
        );
      }

      devLogger.debug('GSD conflict resolved with UI version', {
        component: 'GSDFileSyncService',
        planPath,
        tasksUpdated: conflict.diffs.filter((d) => d.taskIndex >= 0).length,
      });
    }

    // Update last synced state
    const newState =
      resolution === 'keep_ui' ? conflict.uiVersion : conflict.fileVersion;
    this.lastSyncedState.set(planPath, newState);

    // Notify client of resolution
    ws.send(
      JSON.stringify({
        type: 'gsd_conflict_resolved',
        sessionId,
        planPath,
        resolution,
        data: newState,
      } as GSDSyncResponse)
    );
  }

  /**
   * Update the last synced state for a plan
   *
   * Call this after successfully loading a plan to track its state.
   */
  updateSyncedState(planPath: string, state: ParsedPlanFile): void {
    this.lastSyncedState.set(planPath, state);
  }

  /**
   * Get the last synced state for a plan
   */
  getSyncedState(planPath: string): ParsedPlanFile | undefined {
    return this.lastSyncedState.get(planPath);
  }

  /**
   * Clean up file watcher and all resources
   */
  cleanup(): void {
    this.fileWatcher.cleanup();
    this.lastSyncedState.clear();
  }
}
