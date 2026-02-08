/**
 * React Hook for Enhanced Synchronization
 *
 * Provides enhanced sync capabilities with offline support,
 * cross-device sync, and advanced conflict resolution.
 */

import { useState, useEffect, useCallback } from 'react';
import { enhancedSyncManager, type SyncDevice, type SyncSession } from '../../utils/database/enhanced-sync';
import { type DataChange } from '../../utils/database/sync-manager';

export interface EnhancedSyncState {
  isInitialized: boolean;
  currentDevice: SyncDevice | null;
  connectedDevices: SyncDevice[];
  activeSessions: SyncSession[];
  offlineChanges: number;
  lastSync: Date | null;
  isProcessingOffline: boolean;
}

export interface EnhancedSyncHookResult {
  state: EnhancedSyncState;
  publishChange: (
    change: DataChange,
    options?: {
      priority?: 'low' | 'normal' | 'high' | 'critical';
      dependencies?: string[];
    }
  ) => Promise<void>;
  processOfflineChanges: () => Promise<{ processed: number; failed: number; conflicts: number }>;
  startSyncSession: () => Promise<string>;
  forceSyncAll: () => Promise<void>;
  clearOfflineQueue: () => Promise<void>;
  refreshStatus: () => void;
}

/**
 * Hook for enhanced synchronization capabilities
 */
export function useEnhancedSync(): EnhancedSyncHookResult {
  const [state, setState] = useState<EnhancedSyncState>({
    isInitialized: false,
    currentDevice: null,
    connectedDevices: [],
    activeSessions: [],
    offlineChanges: 0,
    lastSync: null,
    isProcessingOffline: false
  });

  /**
   * Initialize enhanced sync
   */
  useEffect(() => {
    let mounted = true;

    const initialize = async () => {
      try {
        await (enhancedSyncManager as any).initialize();

        if (mounted) {
          setState(prev => ({ ...prev, isInitialized: true }));
          refreshStatus();
        }
      } catch (error) {
        console.error('Failed to initialize enhanced sync:', error);
      }
    };

    initialize();

    return () => {
      mounted = false;
    };
  }, []);

  /**
   * Refresh sync status
   */
  const refreshStatus = useCallback(() => {
    const status = (enhancedSyncManager as any).getCrossDeviceStatus();
    setState(prev => ({
      ...prev,
      currentDevice: status.currentDevice,
      connectedDevices: status.connectedDevices,
      activeSessions: status.activeSessions,
      offlineChanges: status.offlineChanges,
      lastSync: status.lastSync
    }));
  }, []);

  /**
   * Auto-refresh status periodically
   */
  useEffect(() => {
    if (!state.isInitialized) return;

    const interval = setInterval(refreshStatus, 5000); // Refresh every 5 seconds
    return () => clearInterval(interval);
  }, [state.isInitialized, refreshStatus]);

  /**
   * Publish change with enhanced capabilities
   */
  const publishChange = useCallback(async (
    change: DataChange,
    options?: {
      priority?: 'low' | 'normal' | 'high' | 'critical';
      dependencies?: string[];
    }
  ): Promise<void> => {
    try {
      await (enhancedSyncManager as any).publishChange(change, options);
      refreshStatus();
    } catch (error) {
      console.error('Failed to publish change:', error);
      refreshStatus(); // Still refresh to show offline queue changes
      throw error;
    }
  }, [refreshStatus]);

  /**
   * Process offline changes
   */
  const processOfflineChanges = useCallback(async (): Promise<{
    processed: number;
    failed: number;
    conflicts: number;
  }> => {
    setState(prev => ({ ...prev, isProcessingOffline: true }));

    try {
      const result = await (enhancedSyncManager as any).processOfflineChanges();
      refreshStatus();
      return result;
    } catch (error) {
      console.error('Failed to process offline changes:', error);
      throw error;
    } finally {
      setState(prev => ({ ...prev, isProcessingOffline: false }));
    }
  }, [refreshStatus]);

  /**
   * Start sync session
   */
  const startSyncSession = useCallback(async (): Promise<string> => {
    const session = await (enhancedSyncManager as any).startSyncSession();
    refreshStatus();
    return session.id;
  }, [refreshStatus]);

  /**
   * Force sync all offline changes
   */
  const forceSyncAll = useCallback(async (): Promise<void> => {
    setState(prev => ({ ...prev, isProcessingOffline: true }));

    try {
      await enhancedSyncManager.forceSyncAll();
      refreshStatus();
    } catch (error) {
      console.error('Failed to force sync all:', error);
      throw error;
    } finally {
      setState(prev => ({ ...prev, isProcessingOffline: false }));
    }
  }, [refreshStatus]);

  /**
   * Clear offline queue
   */
  const clearOfflineQueue = useCallback(async (): Promise<void> => {
    await enhancedSyncManager.clearOfflineQueue();
    refreshStatus();
  }, [refreshStatus]);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      // Note: We don't destroy the global sync manager on unmount
      // since it should persist across component lifecycles
    };
  }, []);

  return {
    state,
    publishChange,
    processOfflineChanges,
    startSyncSession,
    forceSyncAll,
    clearOfflineQueue,
    refreshStatus
  };
}

/**
 * Hook for monitoring sync performance
 */
export function useSyncPerformance() {
  const [metrics, setMetrics] = useState({
    avgSyncLatency: 0,
    syncSuccessRate: 0,
    offlineQueueSize: 0,
    activeSessions: 0,
    lastSyncTime: null as Date | null
  });

  useEffect(() => {
    const updateMetrics = () => {
      const status = (enhancedSyncManager as any).getCrossDeviceStatus();
      setMetrics({
        avgSyncLatency: 0, // Would need to track this in enhanced sync manager
        syncSuccessRate: 0, // Would need to track this in enhanced sync manager
        offlineQueueSize: status.offlineChanges,
        activeSessions: status.activeSessions.length,
        lastSyncTime: status.lastSync
      });
    };

    const interval = setInterval(updateMetrics, 2000);
    updateMetrics(); // Initial update

    return () => clearInterval(interval);
  }, []);

  return metrics;
}

/**
 * Hook for device management
 */
export function useDeviceManagement() {
  const [devices, setDevices] = useState<SyncDevice[]>([]);
  const [currentDevice, setCurrentDevice] = useState<SyncDevice | null>(null);

  useEffect(() => {
    const updateDevices = () => {
      const status = (enhancedSyncManager as any).getCrossDeviceStatus();
      setDevices([status.currentDevice, ...status.connectedDevices]);
      setCurrentDevice(status.currentDevice);
    };

    const interval = setInterval(updateDevices, 3000);
    updateDevices(); // Initial update

    return () => clearInterval(interval);
  }, []);

  const getDeviceInfo = useCallback((deviceId: string): SyncDevice | null => {
    return devices.find(device => device.id === deviceId) || null;
  }, [devices]);

  const isDeviceOnline = useCallback((deviceId: string): boolean => {
    const device = getDeviceInfo(deviceId);
    if (!device) return false;

    // Consider device online if last seen within 60 seconds
    return Date.now() - (device.lastSeen as any) < 60000;
  }, [getDeviceInfo]);

  return {
    devices,
    currentDevice,
    getDeviceInfo,
    isDeviceOnline
  };
}