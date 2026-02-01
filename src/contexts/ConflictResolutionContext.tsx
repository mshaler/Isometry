/**
 * Conflict Resolution Context
 *
 * Provides global state management for conflict resolution across the application.
 * Integrates with CRDT-based conflict detection and resolution system, providing
 * real-time conflict notifications and resolution coordination.
 */

import React, { createContext, useContext, useReducer, useEffect, useRef, ReactNode } from 'react';
import { webViewBridge } from '../utils/webview-bridge';
import { bridgeLogger } from '../utils/logger';

// Types
export interface ConflictInfo {
  nodeId: string;
  conflictType: 'field_conflict' | 'version_mismatch' | 'deletion_conflict' | 'type_change';
  detectedAt: Date;
  fields: string[];
  localData: Record<string, unknown>;
  serverData: Record<string, unknown>;
  priority: 'high' | 'medium' | 'low';
}

export interface ConflictResolution {
  conflictId: string;
  strategy: 'keep_local' | 'keep_server' | 'manual_merge' | 'auto_resolved';
  resolvedAt: Date;
  resolvedBy: 'user' | 'system';
  metadata?: Record<string, unknown>;
}

export interface ConflictNotification {
  id: string;
  type: 'conflict_detected' | 'auto_resolved' | 'resolution_needed';
  message: string;
  conflictId?: string;
  timestamp: Date;
  acknowledged: boolean;
  duration?: number;
}

interface ConflictState {
  // Current conflicts
  conflicts: ConflictInfo[];

  // Resolution state
  resolvingConflicts: Set<string>;
  resolvedConflicts: ConflictResolution[];

  // Notifications
  notifications: ConflictNotification[];

  // Configuration
  autoResolutionEnabled: boolean;
  notificationsEnabled: boolean;

  // Monitoring
  isMonitoring: boolean;
  lastDetectionTime: Date | null;
  detectionErrors: string[];
}

type ConflictAction =
  | { type: 'START_MONITORING' }
  | { type: 'STOP_MONITORING' }
  | { type: 'CONFLICTS_DETECTED'; payload: { conflicts: ConflictInfo[] } }
  | { type: 'CONFLICT_RESOLVING'; payload: { conflictId: string } }
  | { type: 'CONFLICT_RESOLVED'; payload: { resolution: ConflictResolution } }
  | { type: 'CONFLICT_RESOLUTION_FAILED'; payload: { conflictId: string; error: string } }
  | { type: 'NOTIFICATION_ADDED'; payload: { notification: ConflictNotification } }
  | { type: 'NOTIFICATION_ACKNOWLEDGED'; payload: { notificationId: string } }
  | { type: 'NOTIFICATION_REMOVED'; payload: { notificationId: string } }
  | { type: 'TOGGLE_AUTO_RESOLUTION'; payload: { enabled: boolean } }
  | { type: 'TOGGLE_NOTIFICATIONS'; payload: { enabled: boolean } }
  | { type: 'DETECTION_ERROR'; payload: { error: string } };

const initialState: ConflictState = {
  conflicts: [],
  resolvingConflicts: new Set(),
  resolvedConflicts: [],
  notifications: [],
  autoResolutionEnabled: true,
  notificationsEnabled: true,
  isMonitoring: false,
  lastDetectionTime: null,
  detectionErrors: [],
};

function conflictReducer(state: ConflictState, action: ConflictAction): ConflictState {
  switch (action.type) {
    case 'START_MONITORING':
      return {
        ...state,
        isMonitoring: true,
        detectionErrors: [],
      };

    case 'STOP_MONITORING':
      return {
        ...state,
        isMonitoring: false,
      };

    case 'CONFLICTS_DETECTED': {
      const { conflicts } = action.payload;
      const newConflicts = conflicts.filter(
        newConflict => !state.conflicts.some(existing => existing.nodeId === newConflict.nodeId)
      );

      // Create notifications for new conflicts
      const newNotifications: ConflictNotification[] = newConflicts.map(conflict => ({
        id: `conflict_${conflict.nodeId}_${Date.now()}`,
        type: 'conflict_detected',
        message: `Conflict detected in ${conflict.fields.join(', ')} for node ${conflict.nodeId}`,
        conflictId: conflict.nodeId,
        timestamp: new Date(),
        acknowledged: false,
        duration: 10000, // 10 seconds for conflict notifications
      }));

      return {
        ...state,
        conflicts,
        lastDetectionTime: new Date(),
        notifications: state.notificationsEnabled
          ? [...state.notifications, ...newNotifications]
          : state.notifications,
      };
    }

    case 'CONFLICT_RESOLVING':
      return {
        ...state,
        resolvingConflicts: new Set([...state.resolvingConflicts, action.payload.conflictId]),
      };

    case 'CONFLICT_RESOLVED': {
      const { resolution } = action.payload;
      const newResolvingConflicts = new Set(state.resolvingConflicts);
      newResolvingConflicts.delete(resolution.conflictId);

      const notification: ConflictNotification = {
        id: `resolved_${resolution.conflictId}_${Date.now()}`,
        type: resolution.resolvedBy === 'system' ? 'auto_resolved' : 'conflict_detected',
        message: resolution.resolvedBy === 'system'
          ? `Auto-resolved conflict for node ${resolution.conflictId} (${resolution.strategy})`
          : `Manually resolved conflict for node ${resolution.conflictId} (${resolution.strategy})`,
        conflictId: resolution.conflictId,
        timestamp: new Date(),
        acknowledged: false,
        duration: resolution.resolvedBy === 'system' ? 5000 : 8000,
      };

      return {
        ...state,
        conflicts: state.conflicts.filter(c => c.nodeId !== resolution.conflictId),
        resolvingConflicts: newResolvingConflicts,
        resolvedConflicts: [...state.resolvedConflicts, resolution],
        notifications: state.notificationsEnabled
          ? [...state.notifications, notification]
          : state.notifications,
      };
    }

    case 'CONFLICT_RESOLUTION_FAILED': {
      const { conflictId, error } = action.payload;
      const newResolvingConflicts = new Set(state.resolvingConflicts);
      newResolvingConflicts.delete(conflictId);

      const notification: ConflictNotification = {
        id: `error_${conflictId}_${Date.now()}`,
        type: 'resolution_needed',
        message: `Failed to resolve conflict for node ${conflictId}: ${error}`,
        conflictId,
        timestamp: new Date(),
        acknowledged: false,
        duration: 15000, // Longer duration for errors
      };

      return {
        ...state,
        resolvingConflicts: newResolvingConflicts,
        notifications: [...state.notifications, notification],
      };
    }

    case 'NOTIFICATION_ADDED':
      return {
        ...state,
        notifications: [...state.notifications, action.payload.notification],
      };

    case 'NOTIFICATION_ACKNOWLEDGED':
      return {
        ...state,
        notifications: state.notifications.map(n =>
          n.id === action.payload.notificationId
            ? { ...n, acknowledged: true }
            : n
        ),
      };

    case 'NOTIFICATION_REMOVED':
      return {
        ...state,
        notifications: state.notifications.filter(n => n.id !== action.payload.notificationId),
      };

    case 'TOGGLE_AUTO_RESOLUTION':
      return {
        ...state,
        autoResolutionEnabled: action.payload.enabled,
      };

    case 'TOGGLE_NOTIFICATIONS':
      return {
        ...state,
        notificationsEnabled: action.payload.enabled,
      };

    case 'DETECTION_ERROR':
      return {
        ...state,
        detectionErrors: [...state.detectionErrors.slice(-4), action.payload.error], // Keep last 5 errors
      };

    default:
      return state;
  }
}

// Context
interface ConflictResolutionContextType {
  // State
  state: ConflictState;

  // Actions
  startMonitoring: () => Promise<void>;
  stopMonitoring: () => void;
  detectConflicts: () => Promise<ConflictInfo[]>;
  resolveConflict: (conflictId: string, strategy: string, options?: Record<string, unknown>) => Promise<void>;
  acknowledgeNotification: (notificationId: string) => void;
  removeNotification: (notificationId: string) => void;
  toggleAutoResolution: (enabled: boolean) => void;
  toggleNotifications: (enabled: boolean) => void;

  // Utilities
  getConflictById: (conflictId: string) => ConflictInfo | undefined;
  getUnacknowledgedNotifications: () => ConflictNotification[];
  hasActiveConflicts: () => boolean;
}

const ConflictResolutionContext = createContext<ConflictResolutionContextType | null>(null);

// Provider component
interface ConflictResolutionProviderProps {
  children: ReactNode;
  monitoringEnabled?: boolean;
  pollingInterval?: number;
}

export function ConflictResolutionProvider({
  children,
  monitoringEnabled = true,
  pollingInterval = 30000
}: ConflictResolutionProviderProps) {
  const [state, dispatch] = useReducer(conflictReducer, initialState);
  const monitoringTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const notificationTimeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Auto-start monitoring if enabled
  useEffect(() => {
    if (monitoringEnabled) {
      startMonitoring();
    }

    return () => {
      stopMonitoring();
    };
  }, [monitoringEnabled]);

  // Auto-remove notifications after their duration
  useEffect(() => {
    state.notifications.forEach(notification => {
      if (!notification.acknowledged && notification.duration && !notificationTimeoutsRef.current.has(notification.id)) {
        const timeout = setTimeout(() => {
          removeNotification(notification.id);
        }, notification.duration);

        notificationTimeoutsRef.current.set(notification.id, timeout);
      }
    });

    // Cleanup timeouts for removed notifications
    const currentNotificationIds = new Set(state.notifications.map(n => n.id));
    for (const [id, timeout] of notificationTimeoutsRef.current.entries()) {
      if (!currentNotificationIds.has(id)) {
        clearTimeout(timeout);
        notificationTimeoutsRef.current.delete(id);
      }
    }
  }, [state.notifications]);

  // Context API implementation
  const startMonitoring = async (): Promise<void> => {
    if (state.isMonitoring) return;

    dispatch({ type: 'START_MONITORING' });

    // Start periodic conflict detection
    const scheduleNextDetection = () => {
      if (monitoringTimeoutRef.current) {
        clearTimeout(monitoringTimeoutRef.current);
      }

      // Adaptive interval: shorter if conflicts exist
      const interval = state.conflicts.length > 0 ? pollingInterval / 2 : pollingInterval;

      monitoringTimeoutRef.current = setTimeout(async () => {
        try {
          await detectConflicts();
        } catch (error) {
          dispatch({
            type: 'DETECTION_ERROR',
            payload: { error: error instanceof Error ? error.message : String(error) }
          });
        }

        if (state.isMonitoring) {
          scheduleNextDetection();
        }
      }, interval);
    };

    scheduleNextDetection();

    // Initial conflict detection
    try {
      await detectConflicts();
    } catch (error) {
      dispatch({
        type: 'DETECTION_ERROR',
        payload: { error: error instanceof Error ? error.message : String(error) }
      });
    }
  };

  const stopMonitoring = (): void => {
    dispatch({ type: 'STOP_MONITORING' });

    if (monitoringTimeoutRef.current) {
      clearTimeout(monitoringTimeoutRef.current);
      monitoringTimeoutRef.current = null;
    }
  };

  const detectConflicts = async (): Promise<ConflictInfo[]> => {
    try {
      const response = await webViewBridge.sendMessage('database', 'detectConflicts', {});

      if (response.success && Array.isArray(response.data)) {
        const conflicts: ConflictInfo[] = response.data.map((conflict: any) => ({
          nodeId: conflict.nodeId,
          conflictType: conflict.conflictType,
          detectedAt: new Date(conflict.detectedAt),
          fields: conflict.fields || [],
          localData: conflict.localData || {},
          serverData: conflict.serverData || {},
          priority: conflict.priority || 'medium',
        }));

        dispatch({ type: 'CONFLICTS_DETECTED', payload: { conflicts } });

        // Auto-resolve if enabled
        if (state.autoResolutionEnabled && conflicts.length > 0) {
          try {
            await autoResolveSimpleConflicts(conflicts);
          } catch (error) {
            bridgeLogger.warn('Auto-resolution failed:', error);
          }
        }

        return conflicts;
      } else {
        throw new Error(response.error || 'Failed to detect conflicts');
      }
    } catch (error) {
      bridgeLogger.error('Conflict detection failed:', error);
      throw error;
    }
  };

  const resolveConflict = async (
    conflictId: string,
    strategy: string,
    options: Record<string, unknown> = {}
  ): Promise<void> => {
    dispatch({ type: 'CONFLICT_RESOLVING', payload: { conflictId } });

    try {
      const response = await webViewBridge.sendMessage('database', 'resolveConflict', {
        conflictId,
        strategy,
        options,
      });

      if (response.success) {
        const resolution: ConflictResolution = {
          conflictId,
          strategy,
          resolvedAt: new Date(),
          resolvedBy: 'user',
          metadata: options,
        };

        dispatch({ type: 'CONFLICT_RESOLVED', payload: { resolution } });
        bridgeLogger.info(`Conflict resolved: ${conflictId} using ${strategy}`);
      } else {
        throw new Error(response.error || 'Failed to resolve conflict');
      }
    } catch (error) {
      dispatch({
        type: 'CONFLICT_RESOLUTION_FAILED',
        payload: {
          conflictId,
          error: error instanceof Error ? error.message : String(error)
        }
      });
      throw error;
    }
  };

  const autoResolveSimpleConflicts = async (conflicts: ConflictInfo[]): Promise<void> => {
    try {
      const response = await webViewBridge.sendMessage('database', 'autoResolveConflicts', {
        conflicts: conflicts.map(c => ({
          nodeId: c.nodeId,
          conflictType: c.conflictType,
          fields: c.fields,
        })),
      });

      if (response.success && response.data?.autoResolutions) {
        response.data.autoResolutions.forEach((autoResolution: any) => {
          const resolution: ConflictResolution = {
            conflictId: autoResolution.nodeId,
            strategy: autoResolution.strategy,
            resolvedAt: new Date(autoResolution.resolvedAt),
            resolvedBy: 'system',
          };

          dispatch({ type: 'CONFLICT_RESOLVED', payload: { resolution } });
        });
      }
    } catch (error) {
      bridgeLogger.warn('Auto-resolution failed:', error);
    }
  };

  const acknowledgeNotification = (notificationId: string): void => {
    dispatch({ type: 'NOTIFICATION_ACKNOWLEDGED', payload: { notificationId } });
  };

  const removeNotification = (notificationId: string): void => {
    // Clear timeout if exists
    const timeout = notificationTimeoutsRef.current.get(notificationId);
    if (timeout) {
      clearTimeout(timeout);
      notificationTimeoutsRef.current.delete(notificationId);
    }

    dispatch({ type: 'NOTIFICATION_REMOVED', payload: { notificationId } });
  };

  const toggleAutoResolution = (enabled: boolean): void => {
    dispatch({ type: 'TOGGLE_AUTO_RESOLUTION', payload: { enabled } });
  };

  const toggleNotifications = (enabled: boolean): void => {
    dispatch({ type: 'TOGGLE_NOTIFICATIONS', payload: { enabled } });
  };

  const getConflictById = (conflictId: string): ConflictInfo | undefined => {
    return state.conflicts.find(c => c.nodeId === conflictId);
  };

  const getUnacknowledgedNotifications = (): ConflictNotification[] => {
    return state.notifications.filter(n => !n.acknowledged);
  };

  const hasActiveConflicts = (): boolean => {
    return state.conflicts.length > 0;
  };

  const contextValue: ConflictResolutionContextType = {
    state,
    startMonitoring,
    stopMonitoring,
    detectConflicts,
    resolveConflict,
    acknowledgeNotification,
    removeNotification,
    toggleAutoResolution,
    toggleNotifications,
    getConflictById,
    getUnacknowledgedNotifications,
    hasActiveConflicts,
  };

  return (
    <ConflictResolutionContext.Provider value={contextValue}>
      {children}
    </ConflictResolutionContext.Provider>
  );
}

// Custom hook to use the context
export function useConflictResolutionContext(): ConflictResolutionContextType {
  const context = useContext(ConflictResolutionContext);
  if (!context) {
    throw new Error('useConflictResolutionContext must be used within a ConflictResolutionProvider');
  }
  return context;
}

// Export types
export type { ConflictInfo, ConflictResolution, ConflictNotification };