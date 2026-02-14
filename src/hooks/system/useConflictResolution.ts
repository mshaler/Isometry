import { useState, useCallback, useRef, useEffect } from 'react';
// Bridge eliminated in v4 - sql.js direct access
import { getWebViewBridge } from '../../utils/webview-bridge';
import type {
  ConflictInfo,
  ConflictDiff,
  ResolutionDecision,
} from '../../components/ConflictResolutionModal';

/**
 * Result of automatic conflict resolution
 */
export interface AutoResolutionResult {
  resolvedCount: number;
  remainingConflicts: ConflictInfo[];
  errors: string[];
}

/**
 * Result of conflict resolution operation
 */
export interface ConflictResolutionResult {
  success: boolean;
  resolvedConflictId: string;
  error?: string;
}

/**
 * Toast notification for auto-resolved conflicts
 */
export interface ConflictToast {
  id: string;
  message: string;
  type: 'auto-resolved' | 'manual-resolved' | 'error';
  duration: number;
  timestamp: Date;
  timeoutId?: NodeJS.Timeout;
}

/**
 * Hook for managing conflict resolution state and operations
 *
 * Provides conflict detection, automatic resolution, and manual resolution flows.
 * Integrates with ConflictResolver bridge for resolution application.
 * Includes subtle toast notifications for auto-resolved conflicts.
 */
export function useConflictResolution() {
  // State management
  const [conflicts, setConflicts] = useState<ConflictInfo[]>([]);
  const [isResolving, setIsResolving] = useState(false);
  const [pendingConflictDiff, setPendingConflictDiff] = useState<ConflictDiff | null>(null);
  const [toasts, setToasts] = useState<ConflictToast[]>([]);

  // Bridge reference
  const bridgeRef = useRef(getWebViewBridge());

  // Toast management
  const addToast = useCallback((toast: Omit<ConflictToast, 'id' | 'timestamp'>) => {
    const newToast: ConflictToast = {
      ...toast,
      id: `toast_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
    };

    setToasts(prev => {
      // Prevent duplicate toasts with same message
      const exists = prev.some(t => t.message === toast.message && t.type === toast.type);
      if (exists) return prev;

      return [...prev, newToast];
    });

    // Auto-remove after duration using ref to avoid stale closures
    const timeoutId = setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== newToast.id));
    }, toast.duration);

    // Store timeout for potential cleanup
    newToast.timeoutId = timeoutId;

    return newToast.id;
  }, []);

  // Remove specific toast
  const removeToast = useCallback((toastId: string) => {
    setToasts(prev => {
      const toastToRemove = prev.find(t => t.id === toastId);
      if (toastToRemove?.timeoutId) {
        clearTimeout(toastToRemove.timeoutId);
      }
      return prev.filter(t => t.id !== toastId);
    });
  }, []);

  // Load conflicts from native side
  const loadConflicts = useCallback(async () => {
    try {
      const bridge = bridgeRef.current;
      const conflictData = await bridge.sendMessage({ type: 'conflict', action: 'getPendingConflicts', data: {} }) as ConflictInfo[];

      // Convert date strings to Date objects
      const processedConflicts = conflictData.map(conflict => ({
        ...conflict,
        detectedAt: new Date(conflict.detectedAt),
      }));

      setConflicts(processedConflicts);
      return processedConflicts;

    } catch (error) {
      console.error('Failed to load conflicts:', error);
      // Don't add toast during initial load to prevent loops
      return [];
    }
  }, []); // Remove addToast dependency to prevent loops

  // Auto-resolve simple conflicts
  const autoResolveSimple = useCallback(async (conflictsToResolve: ConflictInfo[]): Promise<AutoResolutionResult> => {
    if (conflictsToResolve.length === 0) {
      return {
        resolvedCount: 0,
        remainingConflicts: [],
        errors: [],
      };
    }

    setIsResolving(true);

    try {
      const bridge = bridgeRef.current;
      const result = await bridge.sendMessage({
        type: 'conflict',
        action: 'autoResolve',
        data: { conflicts: conflictsToResolve.map(c => c.nodeId) }
      }) as AutoResolutionResult;

      // Update local conflicts state
      const remainingConflictIds = new Set(result.remainingConflicts.map(c => c.nodeId));
      setConflicts(prev => prev.filter(c => remainingConflictIds.has(c.nodeId)));

      // Show subtle notification for auto-resolved conflicts
      if (result.resolvedCount > 0) {
        const conflictText = result.resolvedCount === 1 ? 'conflict' : 'conflicts';
        addToast({
          message: `Auto-resolved ${result.resolvedCount} ${conflictText}`,
          type: 'auto-resolved',
          duration: 3000, // Brief notification
        });
      }

      // Show errors if any
      result.errors.forEach(error => {
        addToast({
          message: `Auto-resolution error: ${error}`,
          type: 'error',
          duration: 5000,
        });
      });

      return result;

    } catch (error) {
      console.error('Auto-resolution failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      addToast({
        message: `Auto-resolution failed: ${errorMessage}`,
        type: 'error',
        duration: 5000,
      });

      return {
        resolvedCount: 0,
        remainingConflicts: conflictsToResolve,
        errors: [errorMessage],
      };

    } finally {
      setIsResolving(false);
    }
  }, [addToast]);

  // Prepare manual resolution (get diff for UI)
  const prepareManualResolution = useCallback(async (conflictId: string): Promise<ConflictDiff | null> => {
    try {
      const bridge = bridgeRef.current;
      const diffData = await bridge.sendMessage({
        type: 'conflict',
        action: 'prepareManualResolution',
        data: { conflictId }
      }) as ConflictDiff;

      setPendingConflictDiff(diffData);
      return diffData;

    } catch (error) {
      console.error('Failed to prepare manual resolution:', error);
      addToast({
        message: 'Failed to prepare conflict resolution interface',
        type: 'error',
        duration: 5000,
      });
      return null;
    }
  }, [addToast]);

  // Apply manual resolution decision
  const resolveConflict = useCallback(async (conflictId: string, decision: ResolutionDecision): Promise<void> => {
    setIsResolving(true);

    try {
      const bridge = bridgeRef.current;
      const result = await bridge.sendMessage({
        type: 'conflict',
        action: 'applyResolution',
        data: {
          conflictId,
          decision,
        }
      }) as ConflictResolutionResult;

      if (result.success) {
        // Remove resolved conflict from local state
        setConflicts(prev => prev.filter(c => c.nodeId !== conflictId));
        setPendingConflictDiff(null);

        // Show success notification
        addToast({
          message: 'Conflict resolved successfully',
          type: 'manual-resolved',
          duration: 3000,
        });

      } else {
        throw new Error(result.error || 'Resolution failed');
      }

    } catch (error) {
      console.error('Manual resolution failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      addToast({
        message: `Resolution failed: ${errorMessage}`,
        type: 'error',
        duration: 5000,
      });

      throw error; // Re-throw for component error handling

    } finally {
      setIsResolving(false);
    }
  }, [addToast]);

  // Clear all toasts
  const clearToasts = useCallback(() => {
    setToasts(prev => {
      // Clean up all timeouts
      prev.forEach(toast => {
        if (toast.timeoutId) {
          clearTimeout(toast.timeoutId);
        }
      });
      return [];
    });
  }, []);

  // Get conflicts by type
  const getConflictsByType = useCallback((type: ConflictInfo['conflictType']) => {
    return conflicts.filter(c => c.conflictType === type);
  }, [conflicts]);

  // Check if there are unresolved conflicts
  const hasUnresolvedConflicts = conflicts.length > 0;

  // Get the most recent conflict
  const mostRecentConflict = conflicts.length > 0
    ? conflicts.reduce((latest, current) =>
        current.detectedAt > latest.detectedAt ? current : latest
      )
    : null;

  // Setup conflict detection listener
  useEffect(() => {
    const handleConflictDetected = (event: CustomEvent<ConflictInfo>) => {
      const newConflict = {
        ...event.detail,
        detectedAt: new Date(event.detail.detectedAt),
      };

      setConflicts(prev => {
        // Avoid duplicates
        const exists = prev.some(c => c.nodeId === newConflict.nodeId);
        if (exists) return prev;

        return [...prev, newConflict];
      });
    };

    // Listen for conflict detection events from bridge
    window.addEventListener('conflict-detected', handleConflictDetected as EventListener);

    // Initial load - only on mount, not on every render
    loadConflicts().catch(error => {
      console.error('Initial conflict load failed:', error);
    });

    return () => {
      window.removeEventListener('conflict-detected', handleConflictDetected as EventListener);
    };
  }, []); // Empty dependencies - only run on mount

  // Development testing function setup (separate useEffect)
  useEffect(() => {
    if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
      (window as any).testConflictResolution = (conflictData: Partial<ConflictInfo> & {
        recordId?: string;
        type?: ConflictInfo['conflictType'];
        fieldName?: string;
        clientValue?: string;
        serverValue?: string;
      }) => {
        const testConflict: ConflictInfo = {
          nodeId: conflictData.recordId || conflictData.nodeId || 'test_node_001',
          conflictType: conflictData.type || conflictData.conflictType || 'field_conflict',
          detectedAt: conflictData.detectedAt || new Date(),
          fields: conflictData.fields || [conflictData.fieldName || 'content'],
        };

        // Create test diff data
        const testDiff: ConflictDiff = {
          nodeId: testConflict.nodeId,
          conflictType: testConflict.conflictType,
          canAutoResolve: false,
          fieldDiffs: [
            {
              fieldName: conflictData.fieldName || 'content',
              localValue: conflictData.clientValue || 'Modified content on client',
              serverValue: conflictData.serverValue || 'Original content from server',
              conflicted: true,
              autoResolved: false,
            },
            {
              fieldName: 'modifiedAt',
              localValue: new Date().toISOString(),
              serverValue: new Date(Date.now() - 60000).toISOString(),
              conflicted: true,
              autoResolved: false,
            },
            {
              fieldName: 'tags',
              localValue: '["local-tag", "shared-tag"]',
              serverValue: '["server-tag", "shared-tag"]',
              conflicted: true,
              autoResolved: true,
              resolvedValue: '["local-tag", "server-tag", "shared-tag"]',
            },
          ],
        };

        // Add to conflicts and set diff
        setConflicts(prev => [...prev, testConflict]);
        setPendingConflictDiff(testDiff);

        console.warn('Test conflict created:', testConflict);
        console.warn('Test diff prepared:', testDiff);
      };
    }

    return () => {
      if (typeof window !== 'undefined') {
        delete (window as any).testConflictResolution;
      }
    };
  }, []); // Only setup once on mount

  return {
    // State
    conflicts,
    isResolving,
    pendingConflictDiff,
    toasts,
    hasUnresolvedConflicts,
    mostRecentConflict,

    // Actions
    resolveConflict,
    autoResolveSimple,
    prepareManualResolution,
    loadConflicts,
    clearToasts,
    removeToast,
    getConflictsByType,

    // Utilities
    conflictCount: conflicts.length,
    autoResolvableCount: conflicts.filter(c => c.fields.length <= 2).length, // Heuristic
  };
}

