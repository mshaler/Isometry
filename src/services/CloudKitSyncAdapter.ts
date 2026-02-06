/**
 * React CloudKit Sync Service
 *
 * Provides comprehensive CloudKit sync coordination for React components through WebView bridge.
 * Handles real-time sync status, conflict resolution, and offline queue management.
 */

// CloudKit sync adapter with WebView bridge integration

// Core sync status interface
export interface SyncStatus {
  isConnected: boolean;
  syncProgress: number; // 0.0 to 1.0
  lastSync: Date | null;
  pendingChanges: number;
  conflictCount: number;
  isInitialSync: boolean;
  consecutiveFailures: number;
  lastError?: string;
}

// Conflict management interfaces
export interface ConflictEvent {
  id: string;
  localData: Record<string, unknown>;
  serverData: Record<string, unknown>;
  conflictType: 'both_modified' | 'local_deleted' | 'server_deleted';
  detectedAt: Date;
  requiresManualResolution: boolean;
}

export interface ConflictResolution {
  conflictId: string;
  chosenData: Record<string, unknown>;
  strategy: ConflictStrategy;
}

export type ConflictStrategy =
  | 'serverWins'
  | 'localWins'
  | 'latestWins'
  | 'fieldLevelMerge'
  | 'manualResolution';

// Sync queue status for offline management
export interface SyncQueueStatus {
  pending: number;
  processing: number;
  failed: number;
  lastProcessed: Date | null;
}

// Progress event for real-time updates
export interface SyncProgressEvent {
  requestId: string;
  progress: number;
  timestamp: number;
}

// Import type for module augmentation (used in declare module below)
// import type { WebKitMessageHandlers } from '../utils/webview-bridge';

// Bridge communication interface
interface CloudKitBridge {
  postMessage(message: any): void;
}

// Module augmentation to extend the existing WebKit interface
declare module '../utils/webview-bridge' {
  interface WebKitMessageHandlers {
    cloudkit: CloudKitBridge;
  }
}

declare global {
  interface Window {
    _isometryCloudKitBridge?: {
      handleResponse: (response: BridgeResponse) => void;
    };
    addEventListener(type: 'cloudkit-sync-progress', listener: (event: CustomEvent<SyncProgressEvent>) => void): void;
  }
}

interface BridgeResponse {
  id: string;
  success: boolean;
  result?: any;
  error?: string;
  timestamp: number;
  duration: number;
}

/**
 * React service adapter for CloudKit sync integration
 * Provides complete sync coordination with progress tracking and conflict management
 */
export class CloudKitSyncAdapter {
  private static instance: CloudKitSyncAdapter | null = null;

  // Request management
  private pendingRequests = new Map<string, {
    resolve: (value: any) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }>();

  // Status caching with TTL for UI performance
  private statusCache: {
    status: SyncStatus | null;
    timestamp: number;
    ttl: number;
  } = { status: null, timestamp: 0, ttl: 2000 }; // 2-second TTL

  // Event listeners for real-time updates
  private eventListeners = new Map<string, Set<(event: any) => void>>();

  // Performance and throttling
  private readonly DEFAULT_TIMEOUT = 15000; // 15 seconds for sync operations
  private readonly DEBOUNCE_DELAY = 500; // 500ms debouncing
  private debounceTimers = new Map<string, NodeJS.Timeout>();

  // Progress tracking
  private activeSyncRequests = new Set<string>();

  private constructor() {
    this.setupBridgeHandler();
    this.setupProgressListener();
  }

  public static getInstance(): CloudKitSyncAdapter {
    if (!CloudKitSyncAdapter.instance) {
      CloudKitSyncAdapter.instance = new CloudKitSyncAdapter();
    }
    return CloudKitSyncAdapter.instance;
  }

  /**
   * Setup bridge response handler for CloudKit operations
   */
  private setupBridgeHandler(): void {
    if (typeof window !== 'undefined') {
      window._isometryCloudKitBridge = {
        handleResponse: (response: BridgeResponse) => {
          const pending = this.pendingRequests.get(response.id);
          if (pending) {
            clearTimeout(pending.timeout);
            this.pendingRequests.delete(response.id);

            // Remove from active sync tracking
            this.activeSyncRequests.delete(response.id);

            if (response.success) {
              pending.resolve(response.result);
            } else {
              pending.reject(new Error(response.error || 'CloudKit sync error'));
            }
          }
        }
      };
    }
  }

  /**
   * Setup real-time progress listener for sync operations
   */
  private setupProgressListener(): void {
    if (typeof window !== 'undefined') {
      window.addEventListener('cloudkit-sync-progress', (event: CustomEvent<SyncProgressEvent>) => {
        this.emitEvent('progress', event.detail);

        // Update status cache with progress
        if (this.statusCache.status) {
          this.statusCache.status.syncProgress = event.detail.progress;
        }
      });
    }
  }

  /**
   * Check if CloudKit bridge is available
   */
  private isBridgeAvailable(): boolean {
    return typeof window !== 'undefined' &&
           window.webkit?.messageHandlers?.cloudkit != null;
  }

  /**
   * Send message to CloudKit bridge with promise-based response handling
   */
  private async sendBridgeMessage<T>(method: string, params: any = {}): Promise<T> {
    if (!this.isBridgeAvailable()) {
      throw new Error('CloudKit bridge not available');
    }

    // Debounced requests for frequent operations
    if (['getStatus', 'getQueueStatus'].includes(method)) {
      const debounceKey = `${method}_${JSON.stringify(params)}`;
      const existing = this.debounceTimers.get(debounceKey);

      if (existing) {
        clearTimeout(existing);
      }

      return new Promise<T>((resolve, reject) => {
        const timer = setTimeout(async () => {
          this.debounceTimers.delete(debounceKey);
          try {
            const result = await this.executeBridgeMessage<T>(method, params);
            resolve(result);
          } catch (error) {
            reject(error);
          }
        }, this.DEBOUNCE_DELAY);

        this.debounceTimers.set(debounceKey, timer);
      });
    }

    return this.executeBridgeMessage<T>(method, params);
  }

  /**
   * Execute bridge message without debouncing
   */
  private async executeBridgeMessage<T>(method: string, params: any): Promise<T> {
    const requestId = `cloudkit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    return new Promise<T>((resolve, reject) => {
      // Set timeout
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        this.activeSyncRequests.delete(requestId);
        reject(new Error(`CloudKit ${method} request timeout`));
      }, this.DEFAULT_TIMEOUT);

      // Store pending request
      this.pendingRequests.set(requestId, { resolve, reject, timeout });

      // Track sync operations
      if (method === 'sync') {
        this.activeSyncRequests.add(requestId);
      }

      // Send message via existing webViewBridge infrastructure
      const message = {
        id: requestId,
        method,
        params: {
          ...params,
          sequenceId: Date.now()
        }
      };

      try {
        window.webkit!.messageHandlers.cloudkit.postMessage(message);
      } catch (error) {
        clearTimeout(timeout);
        this.pendingRequests.delete(requestId);
        this.activeSyncRequests.delete(requestId);
        reject(new Error(`Failed to send CloudKit bridge message: ${error}`));
      }
    });
  }

  // MARK: - Public CloudKit Operations

  /**
   * Trigger full CloudKit sync operation
   */
  async sync(): Promise<void> {
    try {
      // Clear cached status to force refresh
      this.statusCache.status = null;

      // Emit sync start event
      this.emitEvent('sync-start', { timestamp: Date.now() });

      const result = await this.sendBridgeMessage<{
        success: boolean;
        lastSyncAt: number;
        pendingChanges: number;
        conflictCount: number;
      }>('sync');

      // Emit sync complete event
      this.emitEvent('sync-complete', {
        success: result.success,
        lastSyncAt: new Date(result.lastSyncAt * 1000),
        pendingChanges: result.pendingChanges,
        conflictCount: result.conflictCount,
        timestamp: Date.now()
      });

      // Invalidate status cache
      this.statusCache.status = null;

    } catch (error) {
      // Emit sync error event
      this.emitEvent('sync-error', {
        error: error instanceof Error ? error.message : 'Unknown sync error',
        timestamp: Date.now()
      });

      throw error;
    }
  }

  /**
   * Get current CloudKit sync status
   */
  async getSyncStatus(): Promise<SyncStatus> {
    // Check cache first
    const now = Date.now();
    if (this.statusCache.status &&
        (now - this.statusCache.timestamp) < this.statusCache.ttl) {
      return this.statusCache.status;
    }

    try {
      const result = await this.sendBridgeMessage<{
        isConnected: boolean;
        syncProgress: number;
        lastSync: number | null;
        pendingChanges: number;
        conflictCount: number;
        isInitialSync: boolean;
        consecutiveFailures: number;
        lastError?: string;
      }>('getStatus');

      const status: SyncStatus = {
        isConnected: result.isConnected,
        syncProgress: result.syncProgress,
        lastSync: result.lastSync ? new Date(result.lastSync * 1000) : null,
        pendingChanges: result.pendingChanges,
        conflictCount: result.conflictCount,
        isInitialSync: result.isInitialSync,
        consecutiveFailures: result.consecutiveFailures,
        lastError: result.lastError
      };

      // Cache the status
      this.statusCache = {
        status,
        timestamp: now,
        ttl: this.statusCache.ttl
      };

      return status;

    } catch (error) {
      console.warn('Failed to get CloudKit sync status:', error);
      // Return fallback status
      return {
        isConnected: false,
        syncProgress: 0,
        lastSync: null,
        pendingChanges: 0,
        conflictCount: 0,
        isInitialSync: false,
        consecutiveFailures: 0,
        lastError: error instanceof Error ? error.message : 'Status unavailable'
      };
    }
  }

  /**
   * Get pending conflicts requiring resolution
   */
  async getPendingConflicts(): Promise<ConflictEvent[]> {
    try {
      const result = await this.sendBridgeMessage<{
        conflicts: Array<{
          id: string;
          localData: Record<string, unknown>;
          serverData: Record<string, unknown>;
          conflictType: string;
          detectedAt: number;
          requiresManualResolution: boolean;
        }>;
        totalCount: number;
      }>('getConflicts');

      return result.conflicts.map(conflict => ({
        id: conflict.id,
        localData: conflict.localData,
        serverData: conflict.serverData,
        conflictType: conflict.conflictType as ConflictEvent['conflictType'],
        detectedAt: new Date(conflict.detectedAt * 1000),
        requiresManualResolution: conflict.requiresManualResolution
      }));

    } catch (error) {
      console.warn('Failed to get CloudKit conflicts:', error);
      return [];
    }
  }

  /**
   * Resolve a specific conflict with chosen data
   */
  async resolveConflict(resolution: ConflictResolution): Promise<void> {
    try {
      await this.sendBridgeMessage('resolveConflict', {
        conflictId: resolution.conflictId,
        resolution: {
          chosenData: resolution.chosenData,
          strategy: resolution.strategy
        }
      });

      // Emit conflict resolved event
      this.emitEvent('conflict-resolved', {
        conflictId: resolution.conflictId,
        strategy: resolution.strategy,
        timestamp: Date.now()
      });

      // Invalidate status cache
      this.statusCache.status = null;

    } catch (error) {
      this.emitEvent('conflict-error', {
        conflictId: resolution.conflictId,
        error: error instanceof Error ? error.message : 'Resolution failed',
        timestamp: Date.now()
      });

      throw error;
    }
  }

  /**
   * Set conflict resolution strategy
   */
  async setConflictStrategy(strategy: ConflictStrategy): Promise<void> {
    try {
      await this.sendBridgeMessage('setConflictStrategy', { strategy });

      this.emitEvent('strategy-changed', {
        strategy,
        timestamp: Date.now()
      });

    } catch (error) {
      console.warn('Failed to set CloudKit conflict strategy:', error);
      throw error;
    }
  }

  /**
   * Enable real-time sync with change notifications
   */
  async enableRealTimeSync(): Promise<void> {
    try {
      await this.sendBridgeMessage('enableRealTimeSync');

      this.emitEvent('realtime-enabled', {
        timestamp: Date.now()
      });

    } catch (error) {
      console.warn('Failed to enable real-time sync:', error);
      throw error;
    }
  }

  /**
   * Disable real-time sync
   */
  async disableRealTimeSync(): Promise<void> {
    try {
      await this.sendBridgeMessage('disableRealTimeSync');

      this.emitEvent('realtime-disabled', {
        timestamp: Date.now()
      });

    } catch (error) {
      console.warn('Failed to disable real-time sync:', error);
      throw error;
    }
  }

  /**
   * Get offline sync queue status
   */
  async getQueueStatus(): Promise<SyncQueueStatus> {
    try {
      const result = await this.sendBridgeMessage<{
        pending: number;
        processing: number;
        failed: number;
        lastProcessed: number;
      }>('getQueueStatus');

      return {
        pending: result.pending,
        processing: result.processing,
        failed: result.failed,
        lastProcessed: new Date(result.lastProcessed * 1000)
      };

    } catch (error) {
      console.warn('Failed to get CloudKit queue status:', error);
      return {
        pending: 0,
        processing: 0,
        failed: 0,
        lastProcessed: null
      };
    }
  }

  // MARK: - Event Management

  /**
   * Add event listener for CloudKit sync events
   */
  addEventListener(event: string, listener: (data: any) => void): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(listener);
  }

  /**
   * Remove event listener
   */
  removeEventListener(event: string, listener: (data: any) => void): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.delete(listener);
      if (listeners.size === 0) {
        this.eventListeners.delete(event);
      }
    }
  }

  /**
   * Emit event to all listeners
   */
  private emitEvent(event: string, data: any): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(data);
        } catch (error) {
          console.error('Error in CloudKit event listener:', error);
        }
      });
    }
  }

  /**
   * Check if any sync operations are currently active
   */
  get isSyncInProgress(): boolean {
    return this.activeSyncRequests.size > 0;
  }

  /**
   * Get performance statistics
   */
  getPerformanceStats(): {
    pendingRequests: number;
    activeSyncs: number;
    cacheAge: number;
    eventListeners: number;
  } {
    return {
      pendingRequests: this.pendingRequests.size,
      activeSyncs: this.activeSyncRequests.size,
      cacheAge: this.statusCache.status ? Date.now() - this.statusCache.timestamp : 0,
      eventListeners: Array.from(this.eventListeners.values()).reduce((sum, set) => sum + set.size, 0)
    };
  }

  /**
   * Clear all caches and reset state
   */
  clearCache(): void {
    this.statusCache.status = null;
    this.statusCache.timestamp = 0;

    // Clear debounce timers
    this.debounceTimers.forEach(timer => clearTimeout(timer));
    this.debounceTimers.clear();
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    // Cancel all pending requests
    this.pendingRequests.forEach(({ timeout }) => clearTimeout(timeout));
    this.pendingRequests.clear();

    // Clear active sync tracking
    this.activeSyncRequests.clear();

    // Clear debounce timers
    this.debounceTimers.forEach(timer => clearTimeout(timer));
    this.debounceTimers.clear();

    // Clear caches
    this.clearCache();

    // Clear event listeners
    this.eventListeners.clear();

    // Remove bridge handler
    if (typeof window !== 'undefined' && window._isometryCloudKitBridge) {
      delete window._isometryCloudKitBridge;
    }
  }
}

// Export singleton instance for convenience
export const cloudKitSync = CloudKitSyncAdapter.getInstance();

// Auto-cleanup on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    cloudKitSync.cleanup();
  });
}