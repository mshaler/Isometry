/**
 * GSD File Watcher - Monitors .planning/ directory for file changes
 *
 * Uses chokidar with debounced updates to detect file changes in the
 * GSD planning directory and emit WebSocket messages for frontend consumption.
 * Foundation for bidirectional file sync.
 *
 * GSD-02 Requirement: <500ms debounced update
 * Implementation: 400ms stabilityThreshold (100ms safety margin)
 */

import * as chokidar from 'chokidar';
import type { FSWatcher } from 'chokidar';
import { WebSocket } from 'ws';
import { join, relative } from 'path';
import { devLogger } from '../../utils/logging';

/**
 * Event emitted when a GSD file changes
 */
export interface GSDFileChangeEvent {
  type: 'gsd_file_update';
  filePath: string; // Relative to project root
  changeType: 'add' | 'change' | 'unlink';
  timestamp: string;
  sessionId: string;
}

/**
 * Watches .planning/ directory for file changes and broadcasts to WebSocket clients
 */
export class GSDFileWatcher {
  private watcher: FSWatcher | null = null;
  private clients = new Map<string, WebSocket>(); // sessionId -> ws
  private skipWatchPaths = new Set<string>(); // Paths to skip (own writes)

  constructor(private projectPath: string) {}

  /**
   * Start watching .planning/ directory for a client session
   * Creates single watcher shared across all clients
   */
  startWatching(sessionId: string, ws: WebSocket): void {
    // Store client
    this.clients.set(sessionId, ws);

    // Only create one watcher per project
    if (this.watcher) return;

    const planningPath = join(this.projectPath, '.planning');

    this.watcher = chokidar.watch(planningPath, {
      ignored: /(^|[/\\])\../, // Ignore dotfiles
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 400, // 400ms debounce - within <500ms requirement (GSD-02)
        pollInterval: 100,
      },
      depth: 10, // Watch nested phase directories
    });

    this.watcher
      .on('add', (path) => this.emitChange(path, 'add'))
      .on('change', (path) => this.emitChange(path, 'change'))
      .on('unlink', (path) => this.emitChange(path, 'unlink'))
      .on('error', (error) => {
        devLogger.error('GSD file watcher error', {
          component: 'GSDFileWatcher',
          error,
        });
      });

    devLogger.debug('GSD file watcher started', {
      component: 'GSDFileWatcher',
      planningPath,
    });
  }

  /**
   * Stop watching for a client session
   * Only closes watcher when no clients remain
   */
  stopWatching(sessionId: string): void {
    this.clients.delete(sessionId);

    // Only close watcher when no clients remain
    if (this.clients.size === 0 && this.watcher) {
      this.watcher.close();
      this.watcher = null;
      devLogger.debug('GSD file watcher stopped', {
        component: 'GSDFileWatcher',
      });
    }
  }

  /**
   * Mark a path to skip to prevent update loop from own writes
   * Auto-clears after debounce window (600ms)
   */
  markWritePath(filePath: string): void {
    this.skipWatchPaths.add(filePath);
    // Auto-clear after debounce window
    setTimeout(() => this.skipWatchPaths.delete(filePath), 600);
  }

  /**
   * Emit change event to all connected clients
   */
  private emitChange(
    fullPath: string,
    changeType: 'add' | 'change' | 'unlink'
  ): void {
    // Filter to only markdown files
    if (!fullPath.endsWith('.md')) return;

    const relativePath = relative(this.projectPath, fullPath);

    // Skip own writes to prevent update loop
    if (this.skipWatchPaths.has(relativePath)) {
      devLogger.debug('Skipping own write', {
        component: 'GSDFileWatcher',
        relativePath,
      });
      return;
    }

    devLogger.debug('GSD file change detected', {
      component: 'GSDFileWatcher',
      relativePath,
      changeType,
    });

    // Broadcast to all connected clients
    this.clients.forEach((ws, sessionId) => {
      if (ws.readyState === WebSocket.OPEN) {
        const event: GSDFileChangeEvent = {
          type: 'gsd_file_update',
          filePath: relativePath,
          changeType,
          timestamp: new Date().toISOString(),
          sessionId,
        };
        ws.send(JSON.stringify(event));
      }
    });
  }

  /**
   * Clean up watcher and all state
   */
  cleanup(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
    this.clients.clear();
    this.skipWatchPaths.clear();
  }
}
