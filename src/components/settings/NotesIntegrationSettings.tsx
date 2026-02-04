import { useState, useEffect, useCallback } from 'react';
import {
  BookOpen,
  Settings,
  AlertCircle,
  CheckCircle,
  RefreshCw,
  Clock,
  Zap,
  Battery,
  ChevronRight
} from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { useLiveDataContext } from '@/contexts/LiveDataContext';

// ============================================
// Types
// ============================================

interface NotesIntegrationSettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

interface NotesPermissionStatus {
  status: 'not_determined' | 'denied' | 'restricted' | 'authorized';
  message: string;
  canRequest: boolean;
}

interface LiveSyncStatus {
  enabled: boolean;
  state: 'idle' | 'monitoring' | 'syncing' | 'conflict_resolution' | 'error';
  frequency: number;
  performanceMode: 'battery' | 'balanced' | 'performance';
  autoResolveConflicts: boolean;
}

interface SyncStatistics {
  totalNotes: number;
  lastSyncTime?: Date;
  totalSyncs: number;
  averageDuration: number;
  conflictCount: number;
  errorCount: number;
}

// ============================================
// Component
// ============================================

export function NotesIntegrationSettings({ isOpen, onClose }: NotesIntegrationSettingsProps) {
  const { theme } = useTheme();
  // Context available for future use
  useLiveDataContext();

  // Mock executeQuery functionality for Notes integration
  const executeQuery = useCallback(async (method: string, params?: unknown): Promise<any> => {
    // This would be implemented to communicate with the native bridge
    // For now, return mock data for development
    console.log('Executing query:', method, params);

    switch (method) {
      case 'notes.getPermissionStatus':
        return {
          status: 'not_determined' as const,
          message: 'Notes access permission has not been requested',
          canRequest: true
        } as NotesPermissionStatus;
      case 'notes.requestPermission':
        return {
          status: 'authorized' as const,
          message: 'Notes access granted',
          canRequest: false
        } as NotesPermissionStatus;
      case 'notes.getLiveSyncStatus':
        return {
          enabled: false,
          state: 'idle' as const,
          frequency: 30,
          performanceMode: 'balanced' as const,
          autoResolveConflicts: true
        } as LiveSyncStatus;
      case 'notes.getStatistics':
        return {
          totalNotes: 6891,
          lastSyncTime: new Date(),
          totalSyncs: 42,
          averageDuration: 2.3,
          conflictCount: 0,
          errorCount: 0
        } as SyncStatistics;
      case 'notes.setLiveSyncEnabled':
      case 'notes.setSyncFrequency':
      case 'notes.startLiveSync':
      case 'notes.stopLiveSync':
        return {}; // These operations don't return specific data
      default:
        return {};
    }
  }, []);

  // State management
  const [permissionStatus, setPermissionStatus] = useState<NotesPermissionStatus>({
    status: 'not_determined',
    message: '',
    canRequest: true
  });

  const [liveSyncStatus, setLiveSyncStatus] = useState<LiveSyncStatus>({
    enabled: false,
    state: 'idle',
    frequency: 30,
    performanceMode: 'balanced',
    autoResolveConflicts: true
  });

  const [statistics, setStatistics] = useState<SyncStatistics>({
    totalNotes: 0,
    totalSyncs: 0,
    averageDuration: 0,
    conflictCount: 0,
    errorCount: 0
  });

  const [isRequestingPermission, setIsRequestingPermission] = useState(false);

  // Styling based on theme
  const modalStyles = theme === 'NeXTSTEP'
    ? 'bg-[#d4d4d4] border-2 border-[#808080] shadow-[4px_4px_8px_rgba(0,0,0,0.3)]'
    : 'bg-white border border-gray-200 shadow-xl rounded-lg';

  const headerStyles = theme === 'NeXTSTEP'
    ? 'bg-[#a8a8a8] border-b-2 border-b-[#505050] border-l-2 border-t-2 border-[#c8c8c8]'
    : 'border-b border-gray-200';

  const sectionStyles = theme === 'NeXTSTEP'
    ? 'bg-[#d4d4d4] border-2 border-[#a0a0a0] p-4'
    : 'bg-gray-50 border border-gray-200 rounded-lg p-4';

  const buttonStyles = theme === 'NeXTSTEP'
    ? 'bg-[#c8c8c8] border-2 border-t-[#e0e0e0] border-l-[#e0e0e0] border-b-[#808080] border-r-[#808080] hover:bg-[#d0d0d0]'
    : 'bg-blue-600 hover:bg-blue-700 text-white rounded-lg';

  // Load initial data
  useEffect(() => {
    loadPermissionStatus();
    loadLiveSyncStatus();
    loadStatistics();
  }, []);

  // Permission management
  const loadPermissionStatus = useCallback(async () => {
    try {
      const result = await executeQuery('notes.getPermissionStatus', {});
      setPermissionStatus(result);
    } catch (error) {
      console.error('Failed to load permission status:', error);
    }
  }, [executeQuery]);

  const requestPermission = useCallback(async () => {
    setIsRequestingPermission(true);
    try {
      const result = await executeQuery('notes.requestPermission', {});
      setPermissionStatus(result);

      if (result.status === 'authorized' && liveSyncStatus.enabled) {
        await executeQuery('notes.startLiveSync', {});
      }
    } catch (error) {
      console.error('Permission request failed:', error);
    } finally {
      setIsRequestingPermission(false);
    }
  }, [executeQuery, liveSyncStatus.enabled]);

  // Live sync management
  const loadLiveSyncStatus = useCallback(async () => {
    try {
      const result = await executeQuery('notes.getLiveSyncStatus', {});
      setLiveSyncStatus(result);
    } catch (error) {
      console.error('Failed to load live sync status:', error);
    }
  }, [executeQuery]);

  const toggleLiveSync = useCallback(async (enabled: boolean) => {
    try {
      await executeQuery('notes.setLiveSyncEnabled', { enabled });
      setLiveSyncStatus(prev => ({ ...prev, enabled }));

      if (enabled) {
        await executeQuery('notes.startLiveSync', {});
      } else {
        await executeQuery('notes.stopLiveSync', {});
      }
    } catch (error) {
      console.error('Failed to toggle live sync:', error);
    }
  }, [executeQuery]);

  const updateSyncFrequency = useCallback(async (frequency: number) => {
    try {
      await executeQuery('notes.setSyncFrequency', { frequency });
      setLiveSyncStatus(prev => ({ ...prev, frequency }));

      // Restart sync if currently enabled
      if (liveSyncStatus.enabled) {
        await executeQuery('notes.startLiveSync', {});
      }
    } catch (error) {
      console.error('Failed to update sync frequency:', error);
    }
  }, [executeQuery, liveSyncStatus.enabled]);


  // Statistics
  const loadStatistics = useCallback(async () => {
    try {
      const result = await executeQuery('notes.getStatistics', {});
      setStatistics(result);
    } catch (error) {
      console.error('Failed to load statistics:', error);
    }
  }, [executeQuery]);

  // Helper functions
  const getPermissionStatusColor = () => {
    switch (permissionStatus.status) {
      case 'authorized': return 'text-green-600';
      case 'denied':
      case 'restricted': return 'text-red-600';
      case 'not_determined': return 'text-orange-600';
      default: return 'text-gray-600';
    }
  };

  const getSyncStatusColor = () => {
    switch (liveSyncStatus.state) {
      case 'monitoring': return 'text-green-600';
      case 'syncing':
      case 'conflict_resolution': return 'text-blue-600';
      case 'error': return 'text-red-600';
      case 'idle':
      default: return 'text-gray-600';
    }
  };

  const getSyncStatusIcon = () => {
    switch (liveSyncStatus.state) {
      case 'monitoring': return <CheckCircle className="w-4 h-4" />;
      case 'syncing': return <RefreshCw className="w-4 h-4 animate-spin" />;
      case 'conflict_resolution': return <AlertCircle className="w-4 h-4" />;
      case 'error': return <AlertCircle className="w-4 h-4" />;
      case 'idle':
      default: return <Clock className="w-4 h-4" />;
    }
  };

  const getFrequencyDescription = () => {
    if (liveSyncStatus.frequency <= 5) {
      return 'Real-time monitoring (high performance impact)';
    } else if (liveSyncStatus.frequency <= 30) {
      return 'Frequent updates (balanced performance)';
    } else if (liveSyncStatus.frequency <= 120) {
      return 'Regular updates (battery friendly)';
    } else {
      return 'Periodic updates (minimal battery impact)';
    }
  };

  const getPerformanceIcon = (mode: string) => {
    switch (mode) {
      case 'performance': return <Zap className="w-4 h-4" />;
      case 'battery': return <Battery className="w-4 h-4" />;
      default: return <Settings className="w-4 h-4" />;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className={`${modalStyles} w-full max-w-4xl max-h-[90vh] overflow-hidden`}>
        {/* Header */}
        <div className={`${headerStyles} p-6 flex items-center justify-between`}>
          <div className="flex items-center gap-3">
            <BookOpen className="w-6 h-6 text-blue-600" />
            <div>
              <h2 className="text-xl font-semibold">Apple Notes Integration</h2>
              <p className="text-sm text-gray-600">Sync your Apple Notes with real-time monitoring</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded">
            ×
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 overflow-y-auto max-h-[calc(90vh-120px)]">

          {/* Permission Status */}
          <div className={sectionStyles}>
            <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Permissions
            </h3>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-medium">Status</span>
                <span className={`flex items-center gap-2 ${getPermissionStatusColor()}`}>
                  <div className={`w-2 h-2 rounded-full bg-current`}></div>
                  {permissionStatus.status.replace('_', ' ').toUpperCase()}
                </span>
              </div>

              <p className="text-sm text-gray-600">{permissionStatus.message}</p>

              {permissionStatus.canRequest && (
                <button
                  onClick={requestPermission}
                  disabled={isRequestingPermission}
                  className={`${buttonStyles} px-4 py-2 flex items-center gap-2 disabled:opacity-50`}
                >
                  {isRequestingPermission ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle className="w-4 h-4" />
                  )}
                  {permissionStatus.status === 'not_determined' ? 'Request Access' : 'Open Settings'}
                </button>
              )}
            </div>
          </div>

          {/* Live Sync Configuration */}
          {permissionStatus.status === 'authorized' && (
            <div className={sectionStyles}>
              <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
                <RefreshCw className="w-5 h-5" />
                Live Synchronization
              </h3>

              <div className="space-y-4">
                {/* Enable/Disable Toggle */}
                <div className="flex items-center justify-between">
                  <label className="font-medium">Enable Live Sync</label>
                  <input
                    type="checkbox"
                    checked={liveSyncStatus.enabled}
                    onChange={(e) => toggleLiveSync(e.target.checked)}
                    className="toggle"
                  />
                </div>

                {liveSyncStatus.enabled && (
                  <>
                    {/* Sync Frequency */}
                    <div className="space-y-2">
                      <label className="block font-medium">Sync Frequency</label>
                      <div className="flex items-center gap-4">
                        <span className="text-sm">Real-time</span>
                        <input
                          type="range"
                          min={1}
                          max={300}
                          value={liveSyncStatus.frequency}
                          onChange={(e) => updateSyncFrequency(parseInt(e.target.value))}
                          className="flex-1"
                        />
                        <span className="text-sm">5min</span>
                      </div>
                      <p className="text-xs text-gray-600">{getFrequencyDescription()}</p>
                    </div>

                    {/* Performance Mode */}
                    <div className="space-y-2">
                      <label className="block font-medium">Performance Mode</label>
                      <div className="flex gap-2">
                        {(['battery', 'balanced', 'performance'] as const).map((mode) => (
                          <button
                            key={mode}
                            onClick={() => setLiveSyncStatus(prev => ({ ...prev, performanceMode: mode }))}
                            className={`flex items-center gap-2 px-3 py-2 rounded border ${
                              liveSyncStatus.performanceMode === mode
                                ? 'border-blue-500 bg-blue-50'
                                : 'border-gray-300 hover:border-gray-400'
                            }`}
                          >
                            {getPerformanceIcon(mode)}
                            {mode.charAt(0).toUpperCase() + mode.slice(1)}
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Conflict Resolution */}
          {permissionStatus.status === 'authorized' && (
            <div className={sectionStyles}>
              <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
                <AlertCircle className="w-5 h-5" />
                Conflict Resolution
              </h3>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="font-medium">Auto-resolve Simple Conflicts</label>
                  <input
                    type="checkbox"
                    checked={liveSyncStatus.autoResolveConflicts}
                    onChange={(e) => setLiveSyncStatus(prev => ({
                      ...prev,
                      autoResolveConflicts: e.target.checked
                    }))}
                    className="toggle"
                  />
                </div>

                <p className="text-sm text-gray-600">
                  When enabled, simple conflicts like metadata changes will be resolved automatically using smart merge strategies.
                </p>

                <div className="flex items-center justify-between">
                  <span className="font-medium">Active Conflicts</span>
                  {statistics.conflictCount > 0 ? (
                    <button
                      onClick={() => console.log('Show conflicts modal - to be implemented')}
                      className="text-orange-600 hover:text-orange-700 flex items-center gap-1"
                    >
                      {statistics.conflictCount} conflicts
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  ) : (
                    <span className="text-gray-500">None</span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Statistics */}
          <div className={sectionStyles}>
            <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Statistics
            </h3>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Total Notes</span>
                  <span className="font-medium">{statistics.totalNotes}</span>
                </div>

                <div className="flex justify-between">
                  <span>Last Sync</span>
                  <span className="font-medium">
                    {statistics.lastSyncTime
                      ? new Date(statistics.lastSyncTime).toLocaleString()
                      : 'Never'
                    }
                  </span>
                </div>

                <div className="flex justify-between">
                  <span>Sync Status</span>
                  <div className={`flex items-center gap-2 ${getSyncStatusColor()}`}>
                    {getSyncStatusIcon()}
                    <span className="font-medium capitalize">
                      {liveSyncStatus.state.replace('_', ' ')}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Total Syncs</span>
                  <span className="font-medium">{statistics.totalSyncs}</span>
                </div>

                <div className="flex justify-between">
                  <span>Avg Duration</span>
                  <span className="font-medium">
                    {statistics.averageDuration.toFixed(1)}s
                  </span>
                </div>

                {statistics.errorCount > 0 && (
                  <div className="flex justify-between">
                    <span>Errors</span>
                    <span className="font-medium text-red-600">{statistics.errorCount}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Fallback Methods */}
          {permissionStatus.status !== 'authorized' && (
            <div className={sectionStyles}>
              <h3 className="text-lg font-medium mb-4">Alternative Sync Methods</h3>

              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <BookOpen className="w-5 h-5 text-blue-600 mt-1" />
                  <div>
                    <h4 className="font-medium">Alto-Index Export</h4>
                    <p className="text-sm text-gray-600">
                      Export your Notes using the alto-index tool for periodic synchronization
                    </p>
                    <button className="text-blue-600 hover:text-blue-700 text-sm mt-1">
                      View Setup Instructions →
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default NotesIntegrationSettings;