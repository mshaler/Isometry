/**
 * Sync Manager for Real-time Data Coordination
 *
 * Handles bidirectional sync between React WebView and native app with conflict resolution
 */

import { useState, useEffect } from 'react';
import { webViewBridge, Environment } from './webview-bridge';

export interface DataChange {
  id: string;
  table: 'nodes' | 'notebook_cards' | 'edges';
  operation: 'create' | 'update' | 'delete';
  data: Record<string, unknown>;
  timestamp: number;
  version: number;
  userId?: string;
  sessionId?: string;
}

export interface SyncConflict {
  id: string;
  localChange: DataChange;
  remoteChange: DataChange;
  resolutionStrategy: 'local_wins' | 'remote_wins' | 'merge' | 'user_choice';
  resolvedData?: Record<string, unknown>;
}

export interface SyncState {
  isConnected: boolean;
  lastSync: Date | null;
  pendingChanges: number;
  conflictCount: number;
  syncMode: 'real-time' | 'manual' | 'offline';
}

type SyncEventHandler = (change: DataChange) => void;
type ConflictHandler = (conflict: SyncConflict) => Promise<SyncConflict>;

/**
 * Manages real-time synchronization between WebView and native app
 */
export class SyncManager {
  private isActive = false;
  private changeHandlers = new Map<string, SyncEventHandler>();
  private conflictHandlers: ConflictHandler[] = [];
  private pendingChanges = new Map<string, DataChange>();
  private _syncQueue: DataChange[] = []; // TODO: Implement queue processing
  private offlineQueue: DataChange[] = [];

  // Configuration
  private readonly debounceTime = 300; // 300ms debounce for changes
  private readonly maxRetries = 3; // Used in retry logic for failed syncs
  private readonly batchSize = 10;

  // State
  private syncState: SyncState = {
    isConnected: false,
    lastSync: null,
    pendingChanges: 0,
    conflictCount: 0,
    syncMode: 'real-time'
  };

  private heartbeatInterval: NodeJS.Timeout | null = null;
  private syncTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.setupEventListeners();
  }

  /**
   * Start real-time synchronization
   */
  async startSync(): Promise<void> {
    if (this.isActive) {
      return;
    }

    console.log('Starting sync manager...');

    try {
      // Test connection first
      await this.testConnection();

      this.isActive = true;
      this.syncState.isConnected = true;
      this.syncState.syncMode = Environment.isWebView() ? 'real-time' : 'manual';

      // Start heartbeat to monitor connection
      this.startHeartbeat();

      // Process any offline queue
      await this.processOfflineQueue();

      console.log('Sync manager started successfully');
      this.notifyStateChange();

    } catch (error) {
      console.error('Failed to start sync:', error);
      this.syncState.isConnected = false;
      this.syncState.syncMode = 'offline';
      throw error;
    }
  }

  /**
   * Stop synchronization
   */
  async stopSync(): Promise<void> {
    console.log('Stopping sync manager...');

    this.isActive = false;
    this.syncState.isConnected = false;

    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    if (this.syncTimer) {
      clearTimeout(this.syncTimer);
      this.syncTimer = null;
    }

    console.log('Sync manager stopped');
    this.notifyStateChange();
  }

  /**
   * Handle incoming change from remote source
   */
  async handleRemoteChange(change: DataChange): Promise<void> {
    console.log('Processing remote change:', change);

    // Check for conflicts
    const localChange = this.pendingChanges.get(change.id);
    if (localChange && this.hasConflict(localChange, change)) {
      await this.handleConflict(localChange, change);
      return;
    }

    // Apply change and notify handlers
    this.applyChange(change);
    this.notifyChangeHandlers(change);

    // Update sync state
    this.syncState.lastSync = new Date();
    this.notifyStateChange();
  }

  /**
   * Publish local change to remote
   */
  async publishLocalChange(change: DataChange): Promise<void> {
    // Add to pending changes
    this.pendingChanges.set(change.id, change);

    if (this.syncState.isConnected && Environment.isWebView()) {
      // Real-time sync
      this.debounceSync(change);
    } else {
      // Add to offline queue
      this.offlineQueue.push(change);
      this.syncState.syncMode = 'offline';
      this.notifyStateChange();
    }
  }

  /**
   * Register change event handler
   */
  onDataChange(table: string, handler: SyncEventHandler): void {
    this.changeHandlers.set(table, handler);
  }

  /**
   * Register conflict resolution handler
   */
  onConflict(handler: ConflictHandler): void {
    this.conflictHandlers.push(handler);
  }

  /**
   * Get current sync state
   */
  getSyncState(): SyncState {
    return { ...this.syncState };
  }

  /**
   * Force manual sync
   */
  async forcSync(): Promise<void> {
    if (this.offlineQueue.length === 0) {
      return;
    }

    try {
      await this.processOfflineQueue();
      console.log('Manual sync completed');
    } catch (error) {
      console.error('Manual sync failed:', error);
      throw error;
    }
  }

  // Private Methods

  private setupEventListeners(): void {
    if (typeof window !== 'undefined') {
      // Listen for WebView sync notifications
      window.addEventListener('isometry-sync-update', this.handleSyncEvent.bind(this));

      // Handle network changes
      window.addEventListener('online', this.handleOnline.bind(this));
      window.addEventListener('offline', this.handleOffline.bind(this));
    }
  }

  private async handleSyncEvent(event: any): Promise<void> {
    const change = event.detail as DataChange;
    await this.handleRemoteChange(change);
  }

  private handleOnline(): void {
    if (this.isActive) {
      console.log('Network back online, resuming sync...');
      this.syncState.isConnected = true;
      this.syncState.syncMode = 'real-time';
      this.processOfflineQueue();
    }
  }

  private handleOffline(): void {
    console.log('Network offline, switching to offline mode...');
    this.syncState.isConnected = false;
    this.syncState.syncMode = 'offline';
    this.notifyStateChange();
  }

  private async testConnection(): Promise<void> {
    if (!Environment.isWebView()) {
      return; // Skip for browser environments
    }

    try {
      await webViewBridge.database.execute('SELECT 1', []);
    } catch (error) {
      throw new Error(`Sync connection test failed: ${error}`);
    }
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(async () => {
      try {
        await this.testConnection();
        if (!this.syncState.isConnected) {
          this.syncState.isConnected = true;
          this.notifyStateChange();
        }
      } catch (error) {
        if (this.syncState.isConnected) {
          console.warn('Heartbeat failed, connection lost:', error);
          this.syncState.isConnected = false;
          this.syncState.syncMode = 'offline';
          this.notifyStateChange();
        }
      }
    }, 10000); // 10 second heartbeat
  }

  private debounceSync(change: DataChange): void {
    if (this.syncTimer) {
      clearTimeout(this.syncTimer);
    }

    this.syncTimer = setTimeout(async () => {
      await this.sendChange(change);
    }, this.debounceTime);
  }

  private async sendChange(change: DataChange): Promise<void> {
    try {
      if (Environment.isWebView()) {
        switch (change.operation) {
          case 'create':
            await webViewBridge.database.createNode(change.data);
            break;
          case 'update':
            await webViewBridge.database.updateNode(change.data);
            break;
          case 'delete':
            await webViewBridge.database.deleteNode((change.data as { id: string }).id);
            break;
          default:
            console.warn(`Unknown operation: ${change.operation}`);
        }
      }

      // Remove from pending
      this.pendingChanges.delete(change.id);
      this.syncState.lastSync = new Date();
      this.syncState.pendingChanges = this.pendingChanges.size;
      this.notifyStateChange();

    } catch (error) {
      console.error('Failed to send change:', error);
      // Move to offline queue for retry
      this.offlineQueue.push(change);
      this.syncState.syncMode = 'offline';
      this.notifyStateChange();
    }
  }

  private async processOfflineQueue(): Promise<void> {
    if (this.offlineQueue.length === 0) {
      return;
    }

    console.log(`Processing ${this.offlineQueue.length} offline changes...`);

    const batch = this.offlineQueue.splice(0, this.batchSize);

    for (const change of batch) {
      try {
        await this.sendChange(change);
      } catch (error) {
        console.error('Failed to process offline change:', error);
        // Put failed changes back in queue
        this.offlineQueue.unshift(change);
        break;
      }
    }

    this.syncState.pendingChanges = this.offlineQueue.length;
    this.notifyStateChange();

    // Process more if queue is not empty
    if (this.offlineQueue.length > 0 && this.syncState.isConnected) {
      setTimeout(() => this.processOfflineQueue(), 1000);
    }
  }

  private hasConflict(local: DataChange, remote: DataChange): boolean {
    return (
      local.id === remote.id &&
      local.table === remote.table &&
      local.timestamp !== remote.timestamp &&
      Math.abs(local.timestamp - remote.timestamp) < 5000 // 5 second conflict window
    );
  }

  private async handleConflict(local: DataChange, remote: DataChange): Promise<void> {
    const conflict: SyncConflict = {
      id: local.id,
      localChange: local,
      remoteChange: remote,
      resolutionStrategy: 'remote_wins' // Default strategy
    };

    console.warn('Sync conflict detected:', conflict);

    // Try conflict handlers
    for (const handler of this.conflictHandlers) {
      try {
        const resolved = await handler(conflict);
        await this.applyConflictResolution(resolved);
        this.syncState.conflictCount++;
        return;
      } catch (error) {
        console.error('Conflict handler failed:', error);
      }
    }

    // Default resolution: remote wins
    await this.applyConflictResolution(conflict);
    this.syncState.conflictCount++;
  }

  private async applyConflictResolution(conflict: SyncConflict): Promise<void> {
    let changeToApply: DataChange;

    switch (conflict.resolutionStrategy) {
      case 'local_wins':
        changeToApply = conflict.localChange;
        break;
      case 'merge':
        changeToApply = {
          ...conflict.localChange,
          data: conflict.resolvedData || conflict.localChange.data
        };
        break;
      case 'remote_wins':
      default:
        changeToApply = conflict.remoteChange;
        break;
    }

    this.applyChange(changeToApply);
    this.notifyChangeHandlers(changeToApply);
    this.pendingChanges.delete(conflict.id);
  }

  private applyChange(change: DataChange): void {
    // This would typically update the local state/cache
    console.log('Applying change:', change);
  }

  private notifyChangeHandlers(change: DataChange): void {
    const handler = this.changeHandlers.get(change.table);
    if (handler) {
      handler(change);
    }

    // Notify all handlers
    const allHandler = this.changeHandlers.get('*');
    if (allHandler) {
      allHandler(change);
    }
  }

  private notifyStateChange(): void {
    // Dispatch custom event for state changes
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('isometry-sync-state', {
        detail: this.syncState
      }));
    }
  }
}

/**
 * Global sync manager instance
 */
export const syncManager = new SyncManager();

/**
 * Hook for React components to use sync manager
 */
export function useSyncManager() {
  const [syncState, setSyncState] = useState(syncManager.getSyncState());

  useEffect(() => {
    const handleStateChange = (event: any) => {
      setSyncState(event.detail);
    };

    window.addEventListener('isometry-sync-state', handleStateChange);
    return () => window.removeEventListener('isometry-sync-state', handleStateChange);
  }, []);

  return {
    syncState,
    startSync: () => syncManager.startSync(),
    stopSync: () => syncManager.stopSync(),
    forceSync: () => syncManager.forcSync(),
    publishChange: (change: DataChange) => syncManager.publishLocalChange(change),
    onDataChange: (table: string, handler: SyncEventHandler) => syncManager.onDataChange(table, handler),
    onConflict: (handler: ConflictHandler) => syncManager.onConflict(handler)
  };
}

// Re-export for convenience
export type { SyncEventHandler, ConflictHandler };