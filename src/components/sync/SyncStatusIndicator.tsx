/**
 * CloudKit Sync Status Indicator Component
 *
 * Visual sync status and progress component with real-time updates, conflict resolution,
 * and comprehensive sync queue management.
 */

import { useState, useCallback } from 'react';
import { useCloudKitSync } from '@/hooks/system/useCloudKitSync';
import { ConflictResolution, ConflictStrategy, type ConflictEvent } from '@/services/data-sync/CloudKitSyncAdapter';
import { cn } from '@/lib/utils';

// Component props
export interface SyncStatusIndicatorProps {
  /** Display mode - compact for header, expanded for settings */
  mode?: 'compact' | 'expanded';
  /** Show detailed conflict resolution interface */
  showConflictResolution?: boolean;
  /** Auto-hide after successful operations */
  autoHide?: boolean;
  /** Custom CSS classes */
  className?: string;
  /** Click handler for compact mode */
  onClick?: () => void;
}

/**
 * CloudKit sync status indicator with real-time updates and conflict management
 */
export function SyncStatusIndicator({
  mode = 'compact',
  showConflictResolution = false,
  className,
  onClick
}: SyncStatusIndicatorProps) {
  const {
    syncStatus,
    conflicts,
    queueStatus,
    isLoading,
    isSyncing,
    isResolvingConflict,
    error,
    startSync,
    resolveConflict,
    enableRealTimeSync,
    disableRealTimeSync,
    refreshStatus,
    clearError
  } = useCloudKitSync({
    autoRefreshInterval: 30000,
    enableRealTimeUpdates: true,
    conflictAutoRefresh: true
  });

  const [showDetails, setShowDetails] = useState(false);
  const [_selectedConflict, setSelectedConflict] = useState<string | null>(null);

  /**
   * Format relative time for last sync
   */
  const formatRelativeTime = useCallback((date: Date | null): string => {
    if (!date) return 'Never';

    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  }, []);

  /**
   * Get connection status display properties
   */
  const getConnectionStatus = useCallback(() => {
    if (isLoading) {
      return {
        color: 'text-gray-500',
        bgColor: 'bg-gray-100',
        indicator: 'bg-gray-400',
        label: 'Loading...'
      };
    }

    if (!syncStatus.isConnected) {
      return {
        color: 'text-red-600',
        bgColor: 'bg-red-50',
        indicator: 'bg-red-500',
        label: 'Offline'
      };
    }

    if (isSyncing || syncStatus.syncProgress > 0 && syncStatus.syncProgress < 1) {
      return {
        color: 'text-blue-600',
        bgColor: 'bg-blue-50',
        indicator: 'bg-blue-500',
        label: 'Syncing...'
      };
    }

    if (error) {
      return {
        color: 'text-amber-600',
        bgColor: 'bg-amber-50',
        indicator: 'bg-amber-500',
        label: 'Error'
      };
    }

    return {
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      indicator: 'bg-green-500',
      label: 'Connected'
    };
  }, [isLoading, syncStatus.isConnected, syncStatus.syncProgress, isSyncing, error]);

  /**
   * Handle conflict resolution
   */
  const handleResolveConflict = useCallback(async (
    conflictId: string,
    strategy: ConflictStrategy,
    chosenData: Record<string, unknown>
  ) => {
    try {
      const resolution: ConflictResolution = {
        conflictId,
        chosenData,
        strategy
      };

      await resolveConflict(conflictId, resolution);
      setSelectedConflict(null);
    } catch (err) {
      console.error('Failed to resolve conflict:', err);
    }
  }, [resolveConflict]);

  /**
   * Handle manual sync trigger
   */
  const handleSync = useCallback(async () => {
    try {
      clearError();
      await startSync();
    } catch (err) {
      console.error('Manual sync failed:', err);
    }
  }, [startSync, clearError]);

  const status = getConnectionStatus();

  // Compact mode for header integration
  if (mode === 'compact') {
    return (
      <div
        className={cn(
          'flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors cursor-pointer',
          status.bgColor,
          className
        )}
        onClick={onClick || (() => setShowDetails(!showDetails))}
      >
        {/* Connection indicator */}
        <div className="flex items-center gap-1.5">
          <div
            className={cn(
              'w-2 h-2 rounded-full transition-colors',
              status.indicator,
              isSyncing && 'animate-pulse'
            )}
          />
          <span className={cn('text-xs font-medium', status.color)}>
            {status.label}
          </span>
        </div>

        {/* Progress bar during sync */}
        {(isSyncing || syncStatus.syncProgress > 0) && (
          <div className="w-16 h-1 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 transition-all duration-300 ease-out"
              style={{ width: `${syncStatus.syncProgress * 100}%` }}
            />
          </div>
        )}

        {/* Conflict indicator */}
        {conflicts.length > 0 && (
          <div className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 bg-orange-500 rounded-full" />
            <span className="text-xs text-orange-600 font-medium">
              {conflicts.length}
            </span>
          </div>
        )}

        {/* Queue indicator */}
        {queueStatus.pending > 0 && (
          <span className="text-xs text-gray-500">
            {queueStatus.pending} pending
          </span>
        )}
      </div>
    );
  }

  // Expanded mode for settings and detailed view
  return (
    <div className={cn('space-y-4 p-4 border rounded-lg bg-white', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">CloudKit Sync</h3>
        <button
          onClick={handleSync}
          disabled={isSyncing || isLoading}
          className="px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 rounded-md hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isSyncing ? 'Syncing...' : 'Sync Now'}
        </button>
      </div>

      {/* Connection Status */}
      <div className="flex items-center justify-between p-3 rounded-lg" style={{ backgroundColor: status.bgColor.replace('bg-', '') }}>
        <div className="flex items-center gap-2">
          <div className={cn('w-3 h-3 rounded-full', status.indicator, isSyncing && 'animate-pulse')} />
          <span className={cn('font-medium', status.color)}>
            {status.label}
          </span>
        </div>
        <div className="text-sm text-gray-600">
          Last sync: {formatRelativeTime(syncStatus.lastSync)}
        </div>
      </div>

      {/* Progress Bar */}
      {(isSyncing || syncStatus.syncProgress > 0) && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Sync Progress</span>
            <span className="font-medium">
              {Math.round(syncStatus.syncProgress * 100)}%
            </span>
          </div>
          <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 transition-all duration-300 ease-out"
              style={{ width: `${syncStatus.syncProgress * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-start gap-2">
            <div className="w-5 h-5 text-red-500 flex-shrink-0">
              <svg fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-sm text-red-800">{error}</p>
              <button
                onClick={clearError}
                className="mt-1 text-xs text-red-600 hover:text-red-800 underline"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4">
        <div className="p-3 bg-gray-50 rounded-lg">
          <div className="text-2xl font-bold text-gray-900">
            {syncStatus.pendingChanges}
          </div>
          <div className="text-sm text-gray-600">Pending Changes</div>
        </div>
        <div className="p-3 bg-gray-50 rounded-lg">
          <div className="text-2xl font-bold text-gray-900">
            {conflicts.length}
          </div>
          <div className="text-sm text-gray-600">Conflicts</div>
        </div>
      </div>

      {/* Queue Status */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium text-gray-900">Sync Queue</h4>
        <div className="flex justify-between text-sm text-gray-600">
          <span>Pending: {queueStatus.pending}</span>
          <span>Processing: {queueStatus.processing}</span>
          <span>Failed: {queueStatus.failed}</span>
        </div>
      </div>

      {/* Conflicts Section */}
      {conflicts.length > 0 && showConflictResolution && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-gray-900">
            Conflicts Requiring Resolution ({conflicts.length})
          </h4>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {conflicts.map((conflict: ConflictEvent) => (
              <div
                key={conflict.id}
                className="p-3 border border-orange-200 bg-orange-50 rounded-lg"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-orange-800">
                    {conflict.conflictType.replace('_', ' ').toUpperCase()}
                  </span>
                  <span className="text-xs text-orange-600">
                    {formatRelativeTime(conflict.detectedAt)}
                  </span>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleResolveConflict(conflict.id, 'serverWins', conflict.serverData)}
                    disabled={isResolvingConflict}
                    className="px-2 py-1 text-xs bg-orange-100 text-orange-700 rounded hover:bg-orange-200 disabled:opacity-50"
                  >
                    Use Server
                  </button>
                  <button
                    onClick={() => handleResolveConflict(conflict.id, 'localWins', conflict.localData)}
                    disabled={isResolvingConflict}
                    className="px-2 py-1 text-xs bg-orange-100 text-orange-700 rounded hover:bg-orange-200 disabled:opacity-50"
                  >
                    Use Local
                  </button>
                  <button
                    onClick={() => setSelectedConflict(conflict.id)}
                    disabled={isResolvingConflict}
                    className="px-2 py-1 text-xs bg-orange-100 text-orange-700 rounded hover:bg-orange-200 disabled:opacity-50"
                  >
                    Review
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Real-time Sync Controls */}
      <div className="pt-3 border-t border-gray-200">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">
            Real-time Sync
          </span>
          <div className="flex gap-2">
            <button
              onClick={enableRealTimeSync}
              className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200"
            >
              Enable
            </button>
            <button
              onClick={disableRealTimeSync}
              className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
            >
              Disable
            </button>
          </div>
        </div>
      </div>

      {/* Refresh Button */}
      <div className="pt-2">
        <button
          onClick={refreshStatus}
          disabled={isLoading}
          className="w-full px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? 'Refreshing...' : 'Refresh Status'}
        </button>
      </div>
    </div>
  );
}