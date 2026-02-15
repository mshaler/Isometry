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
import type { ParsedPlanFile, TaskStatus } from './gsdTypes';
import { devLogger } from '../../utils/logging';

/**
 * Incoming message types for GSD file sync
 */
export interface GSDSyncMessage {
  type: 'start_gsd_watch' | 'stop_gsd_watch' | 'gsd_task_update' | 'gsd_read_plan';
  sessionId: string;
  planPath?: string;
  taskIndex?: number;
  status?: TaskStatus;
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
    | 'gsd_error';
  sessionId: string;
  planPath?: string;
  data?: ParsedPlanFile;
  error?: string;
}

/**
 * Service that orchestrates GSD file reading, watching, and writing
 */
export class GSDFileSyncService {
  private fileWatcher: GSDFileWatcher;

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

        case 'gsd_read_plan':
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
   * Clean up file watcher and all resources
   */
  cleanup(): void {
    this.fileWatcher.cleanup();
  }
}
