/**
 * CloudKitSyncAdapter - Stub implementation
 *
 * Handles CloudKit synchronization for iCloud data sync.
 * This is a stub for future implementation.
 */

export type ConflictStrategy = 'serverWins' | 'localWins' | 'merge';

export interface ConflictResolution {
  conflictId: string;
  chosenData: Record<string, unknown>;
  strategy: ConflictStrategy;
}

export interface ConflictEvent {
  id: string;
  conflictType: string;
  serverData: Record<string, unknown>;
  localData: Record<string, unknown>;
  detectedAt: Date;
}

export interface SyncStatus {
  isConnected: boolean;
  syncProgress: number;
  lastSync: Date | null;
  pendingChanges: number;
  conflictCount: number;
  isInitialSync: boolean;
  consecutiveFailures: number;
}

export interface SyncQueueStatus {
  pending: number;
  processing: number;
  failed: number;
  lastProcessed: Date | null;
}

type EventCallback = (event: unknown) => void;

export interface CloudKitSyncAdapter {
  getSyncStatus: () => Promise<SyncStatus>;
  getPendingConflicts: () => Promise<ConflictEvent[]>;
  getQueueStatus: () => Promise<SyncQueueStatus>;
  sync: () => Promise<void>;
  resolveConflict: (resolution: ConflictResolution) => Promise<void>;
  setConflictStrategy: (strategy: ConflictStrategy) => Promise<void>;
  enableRealTimeSync: () => Promise<void>;
  disableRealTimeSync: () => Promise<void>;
  addEventListener: (event: string, callback: EventCallback) => void;
  removeEventListener: (event: string, callback: EventCallback) => void;
}

/**
 * Creates a CloudKit sync adapter instance
 * Stub implementation - returns no-op functions
 */
function createCloudKitSyncAdapter(): CloudKitSyncAdapter {
  const listeners: Map<string, EventCallback[]> = new Map();

  return {
    getSyncStatus: async () => ({
      isConnected: false,
      syncProgress: 0,
      lastSync: null,
      pendingChanges: 0,
      conflictCount: 0,
      isInitialSync: false,
      consecutiveFailures: 0
    }),
    getPendingConflicts: async () => [],
    getQueueStatus: async () => ({
      pending: 0,
      processing: 0,
      failed: 0,
      lastProcessed: null
    }),
    sync: async () => {},
    resolveConflict: async () => {},
    setConflictStrategy: async () => {},
    enableRealTimeSync: async () => {},
    disableRealTimeSync: async () => {},
    addEventListener: (event, callback) => {
      const existing = listeners.get(event) || [];
      listeners.set(event, [...existing, callback]);
    },
    removeEventListener: (event, callback) => {
      const existing = listeners.get(event) || [];
      listeners.set(event, existing.filter(cb => cb !== callback));
    }
  };
}

// Default export as singleton - named to match what useCloudKitSync imports
export const cloudKitSync = createCloudKitSyncAdapter();
export const cloudKitSyncAdapter = cloudKitSync;
