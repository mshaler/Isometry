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

// Sync events handled through callbacks and custom event listeners

// Conflict resolution handled through SyncConflict interface

interface QueueStatus {
  pending: number;
  processed: number;
  errors: string[];
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
  private _syncQueue: DataChange[] = [];
  private offlineQueue: DataChange[] = [];
  private processingQueue = false;
  private queueTimer: NodeJS.Timeout | null = null;
  private retryAttempts = new Map<string, number>();

  // Configuration
  private readonly debounceTime = 300; // 300ms debounce for changes
  private readonly maxRetries = 3; // Used in retry logic for failed syncs
  private readonly batchSize = 10;
  private readonly queueProcessInterval = 1000; // Process queue every 1 second
  private readonly retryBackoffBase = 1000; // 1 second base backoff

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

      // Start sync queue processing
      this.startQueueProcessor();

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

    if (this.queueTimer) {
      clearInterval(this.queueTimer);
      this.queueTimer = null;
    }

    this.processingQueue = false;

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
      // Add to sync queue for background processing
      this.addToSyncQueue(change);

      // Also do immediate sync for time-sensitive operations
      if (change.operation === 'delete' || change.table === 'notebook_cards') {
        this.debounceSync(change);
      }
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
    if (this.offlineQueue.length === 0 && this._syncQueue.length === 0) {
      return;
    }

    try {
      await this.processOfflineQueue();
      await this.processSyncQueue();
      console.log('Manual sync completed');
    } catch (error) {
      console.error('Manual sync failed:', error);
      throw error;
    }
  }

  /**
   * Add change to sync queue for background processing
   */
  addToSyncQueue(change: DataChange): void {
    this._syncQueue.push(change);
    this.syncState.pendingChanges = this.pendingChanges.size + this._syncQueue.length;
    this.notifyStateChange();
  }

  /**
   * Get sync queue status
   */
  getSyncQueueStatus(): QueueStatus {
    return {
      pending: this._syncQueue.length,
      processed: Array.from(this.retryAttempts.values()).reduce((sum, attempts) => sum + attempts, 0),
      errors: this._syncQueue
        .filter(change => this.retryAttempts.get(change.id) === this.maxRetries)
        .map(change => `Failed to sync ${change.operation} on ${change.table}:${change.id}`)
    };
  }

  // Private Methods

  private setupEventListeners(): void {
    if (typeof window !== 'undefined') {
      // Listen for WebView sync notifications
      window.addEventListener('isometry-sync-update', this.handleSyncEvent.bind(this) as EventListener);

      // Handle network changes
      window.addEventListener('online', this.handleOnline.bind(this));
      window.addEventListener('offline', this.handleOffline.bind(this));
    }
  }

  private async handleSyncEvent(event: Event): Promise<void> {
    if (event instanceof CustomEvent && event.detail) {
      const change = event.detail as DataChange;
      await this.handleRemoteChange(change);
    }
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

  private startQueueProcessor(): void {
    if (this.queueTimer) {
      clearInterval(this.queueTimer);
    }

    this.queueTimer = setInterval(() => {
      if (this.syncState.isConnected && !this.processingQueue) {
        this.processSyncQueue().catch(error => {
          console.error('Queue processing failed:', error);
        });
      }
    }, this.queueProcessInterval);
  }

  private async processSyncQueue(): Promise<void> {
    if (this.processingQueue || this._syncQueue.length === 0) {
      return;
    }

    this.processingQueue = true;
    console.log(`Processing sync queue: ${this._syncQueue.length} items`);

    try {
      // Process queue in batches
      while (this._syncQueue.length > 0 && this.syncState.isConnected) {
        const batch = this._syncQueue.splice(0, this.batchSize);
        await this.processBatch(batch);
      }

      // Notify queue processed
      this.notifyQueueProcessed();
    } finally {
      this.processingQueue = false;
      this.syncState.pendingChanges = this.pendingChanges.size + this._syncQueue.length;
      this.notifyStateChange();
    }
  }

  private async processBatch(batch: DataChange[]): Promise<void> {
    const processPromises = batch.map(async (change) => {
      try {
        await this.sendChangeWithRetry(change);
        // Remove from retry tracking on success
        this.retryAttempts.delete(change.id);
      } catch (error) {
        console.error(`Failed to sync change ${change.id}:`, error);
        await this.handleSyncFailure(change, error as Error);
      }
    });

    await Promise.allSettled(processPromises);
  }

  private async sendChangeWithRetry(change: DataChange): Promise<void> {
    const currentRetries = this.retryAttempts.get(change.id) || 0;

    if (currentRetries >= this.maxRetries) {
      throw new Error(`Max retries exceeded for change ${change.id}`);
    }

    try {
      await this.sendChange(change);
    } catch (error) {
      this.retryAttempts.set(change.id, currentRetries + 1);

      if (currentRetries + 1 < this.maxRetries) {
        // Exponential backoff
        const backoffTime = this.retryBackoffBase * Math.pow(2, currentRetries);
        console.log(`Retrying change ${change.id} in ${backoffTime}ms (attempt ${currentRetries + 1}/${this.maxRetries})`);

        await new Promise(resolve => setTimeout(resolve, backoffTime));
        throw error; // Re-throw to trigger retry
      } else {
        throw new Error(`Failed to sync change ${change.id} after ${this.maxRetries} attempts: ${error}`);
      }
    }
  }

  private async handleSyncFailure(change: DataChange, error: Error): Promise<void> {
    const retries = this.retryAttempts.get(change.id) || 0;

    if (retries >= this.maxRetries) {
      console.error(`Permanently failed to sync change ${change.id}:`, error);
      // Move to offline queue for manual retry later
      this.offlineQueue.push(change);
    } else {
      // Re-add to queue for next processing cycle
      this._syncQueue.push(change);
    }
  }

  private notifyQueueProcessed(): void {
    const queueStatus = this.getSyncQueueStatus();

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('isometry-sync-update', {
        detail: {
          type: 'queueProcessed',
          payload: queueStatus,
          timestamp: Date.now()
        }
      }));
    }
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
    const handleStateChange = (event: Event) => {
      if (event instanceof CustomEvent && event.detail) {
        setSyncState(event.detail as SyncState);
      }
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
    onDataChange: (table: string, _handler: SyncEventHandler) => syncManager.onDataChange(table, handler),
    onConflict: (handler: ConflictHandler) => syncManager.onConflict(handler),
    getQueueStatus: () => syncManager.getSyncQueueStatus()
  };
}

// Re-export for convenience
export type { SyncEventHandler, ConflictHandler };