/**
 * React Hook for CloudKit Sync State Management
 *
 * Provides real-time CloudKit sync status, conflict management, and queue monitoring
 * with comprehensive event handling and performance optimization.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  cloudKitSync,
  SyncStatus,
  ConflictEvent,
  ConflictResolution,
  ConflictStrategy,
  SyncQueueStatus
} from '@/services/CloudKitSyncAdapter';

// Hook state interface
export interface CloudKitSyncState {
  // Status
  syncStatus: SyncStatus;
  conflicts: ConflictEvent[];
  queueStatus: SyncQueueStatus;

  // Loading states
  isLoading: boolean;
  isSyncing: boolean;
  isResolvingConflict: boolean;

  // Error state
  error: string | null;

  // Methods
  startSync: () => Promise<void>;
  resolveConflict: (conflictId: string, resolution: ConflictResolution) => Promise<void>;
  setConflictStrategy: (strategy: ConflictStrategy) => Promise<void>;
  enableRealTimeSync: () => Promise<void>;
  disableRealTimeSync: () => Promise<void>;
  refreshStatus: () => Promise<void>;
  clearError: () => void;
}

// Hook configuration options
export interface CloudKitSyncOptions {
  autoRefreshInterval?: number; // Auto-refresh interval in ms (0 to disable)
  enableRealTimeUpdates?: boolean; // Enable real-time event listeners
  conflictAutoRefresh?: boolean; // Auto-refresh when conflicts are detected
}

/**
 * React hook for CloudKit sync state management with real-time updates
 */
export function useCloudKitSync(options: CloudKitSyncOptions = {}): CloudKitSyncState {
  const {
    autoRefreshInterval = 30000, // 30 seconds default
    enableRealTimeUpdates = true,
    conflictAutoRefresh = true
  } = options;

  // Core state
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    isConnected: false,
    syncProgress: 0,
    lastSync: null,
    pendingChanges: 0,
    conflictCount: 0,
    isInitialSync: false,
    consecutiveFailures: 0
  });

  const [conflicts, setConflicts] = useState<ConflictEvent[]>([]);
  const [queueStatus, setQueueStatus] = useState<SyncQueueStatus>({
    pending: 0,
    processing: 0,
    failed: 0,
    lastProcessed: null
  });

  // Loading and error states
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isResolvingConflict, setIsResolvingConflict] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Clear error state
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  /**
   * Refresh all sync status data
   */
  const refreshStatus = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Fetch all status data in parallel
      const [status, conflictList, queue] = await Promise.all([
        cloudKitSync.getSyncStatus(),
        cloudKitSync.getPendingConflicts(),
        cloudKitSync.getQueueStatus()
      ]);

      setSyncStatus(status);
      setConflicts(conflictList);
      setQueueStatus(queue);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to refresh sync status';
      setError(errorMessage);
      console.warn('CloudKit status refresh failed:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Start sync operation with progress tracking
   */
  const startSync = useCallback(async () => {
    try {
      setIsSyncing(true);
      setError(null);

      await cloudKitSync.sync();

      // Refresh status after sync completes
      await refreshStatus();

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Sync operation failed';
      setError(errorMessage);
      throw err; // Re-throw for caller handling
    } finally {
      setIsSyncing(false);
    }
  }, [refreshStatus]);

  /**
   * Resolve a specific conflict
   */
  const resolveConflict = useCallback(async (conflictId: string, resolution: ConflictResolution) => {
    try {
      setIsResolvingConflict(true);
      setError(null);

      await cloudKitSync.resolveConflict(resolution);

      // Remove resolved conflict from local state
      setConflicts(prev => prev.filter(c => c.id !== conflictId));

      // Refresh status to get updated conflict count
      if (conflictAutoRefresh) {
        await refreshStatus();
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Conflict resolution failed';
      setError(errorMessage);
      throw err;
    } finally {
      setIsResolvingConflict(false);
    }
  }, [conflictAutoRefresh, refreshStatus]);

  /**
   * Set conflict resolution strategy
   */
  const setConflictStrategy = useCallback(async (strategy: ConflictStrategy) => {
    try {
      setError(null);

      await cloudKitSync.setConflictStrategy(strategy);

      // Refresh conflicts after strategy change
      const updatedConflicts = await cloudKitSync.getPendingConflicts();
      setConflicts(updatedConflicts);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to set conflict strategy';
      setError(errorMessage);
      throw err;
    }
  }, []);

  /**
   * Enable real-time sync
   */
  const enableRealTimeSync = useCallback(async () => {
    try {
      setError(null);
      await cloudKitSync.enableRealTimeSync();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to enable real-time sync';
      setError(errorMessage);
      throw err;
    }
  }, []);

  /**
   * Disable real-time sync
   */
  const disableRealTimeSync = useCallback(async () => {
    try {
      setError(null);
      await cloudKitSync.disableRealTimeSync();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to disable real-time sync';
      setError(errorMessage);
      throw err;
    }
  }, []);

  // Setup real-time event listeners
  useEffect(() => {
    if (!enableRealTimeUpdates) return;

    // Progress updates during sync
    const handleProgressUpdate = (event: any) => {
      setSyncStatus(prev => ({
        ...prev,
        syncProgress: event.progress
      }));
    };

    // Sync completion events
    const handleSyncComplete = (event: any) => {
      setSyncStatus(prev => ({
        ...prev,
        syncProgress: 1.0,
        lastSync: event.lastSyncAt,
        pendingChanges: event.pendingChanges,
        conflictCount: event.conflictCount
      }));

      setIsSyncing(false);
    };

    // Sync error events
    const handleSyncError = (event: any) => {
      setError(event.error);
      setIsSyncing(false);
    };

    // Sync start events
    const handleSyncStart = () => {
      setIsSyncing(true);
      setError(null);
    };

    // Conflict events
    const handleConflictDetected = (event: any) => {
      setConflicts(prev => [...prev, event.conflict]);
      setSyncStatus(prev => ({
        ...prev,
        conflictCount: prev.conflictCount + 1
      }));
    };

    const handleConflictResolved = (event: any) => {
      setConflicts(prev => prev.filter(c => c.id !== event.conflictId));
      setSyncStatus(prev => ({
        ...prev,
        conflictCount: Math.max(0, prev.conflictCount - 1)
      }));
    };

    // Connection status events
    const handleConnectionChange = (event: any) => {
      setSyncStatus(prev => ({
        ...prev,
        isConnected: event.isConnected
      }));
    };

    // Register event listeners
    cloudKitSync.addEventListener('progress', handleProgressUpdate);
    cloudKitSync.addEventListener('sync-complete', handleSyncComplete);
    cloudKitSync.addEventListener('sync-error', handleSyncError);
    cloudKitSync.addEventListener('sync-start', handleSyncStart);
    cloudKitSync.addEventListener('conflict-detected', handleConflictDetected);
    cloudKitSync.addEventListener('conflict-resolved', handleConflictResolved);
    cloudKitSync.addEventListener('connection-change', handleConnectionChange);

    // Cleanup listeners
    return () => {
      cloudKitSync.removeEventListener('progress', handleProgressUpdate);
      cloudKitSync.removeEventListener('sync-complete', handleSyncComplete);
      cloudKitSync.removeEventListener('sync-error', handleSyncError);
      cloudKitSync.removeEventListener('sync-start', handleSyncStart);
      cloudKitSync.removeEventListener('conflict-detected', handleConflictDetected);
      cloudKitSync.removeEventListener('conflict-resolved', handleConflictResolved);
      cloudKitSync.removeEventListener('connection-change', handleConnectionChange);
    };
  }, [enableRealTimeUpdates]);

  // Auto-refresh interval
  useEffect(() => {
    if (autoRefreshInterval <= 0) return;

    const interval = setInterval(() => {
      // Only refresh if not currently syncing
      if (!isSyncing && !isResolvingConflict) {
        refreshStatus().catch(err => {
          console.warn('Auto-refresh failed:', err);
        });
      }
    }, autoRefreshInterval);

    return () => clearInterval(interval);
  }, [autoRefreshInterval, isSyncing, isResolvingConflict, refreshStatus]);

  // Initial status load
  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  return {
    // State
    syncStatus,
    conflicts,
    queueStatus,

    // Loading states
    isLoading,
    isSyncing,
    isResolvingConflict,

    // Error state
    error,

    // Methods
    startSync,
    resolveConflict,
    setConflictStrategy,
    enableRealTimeSync,
    disableRealTimeSync,
    refreshStatus,
    clearError
  };
}