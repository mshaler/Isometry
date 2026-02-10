import { useState, useCallback } from 'react';
import { devLogger } from '../utils/logging';

export interface DataConflict {
  id: string;
  type: 'create' | 'update' | 'delete';
  localData: unknown;
  remoteData: unknown;
  timestamp: Date;
  resolved: boolean;
}

export interface ConflictResolution {
  conflicts: DataConflict[];
  pendingCount: number;
  isResolving: boolean;
  resolveConflict: (conflictId: string, resolution: 'local' | 'remote' | 'merge') => Promise<void>;
  resolveAllConflicts: (resolution: 'local' | 'remote') => Promise<void>;
  dismissConflict: (conflictId: string) => void;
}

/**
 * Hook for handling data synchronization conflicts
 * Bridge eliminated - simplified conflict resolution for v4
 */
export function useConflictResolution(): ConflictResolution {
  const [conflicts, setConflicts] = useState<DataConflict[]>([]);
  const [isResolving, setIsResolving] = useState(false);

  const resolveConflict = useCallback(async (
    conflictId: string,
    resolution: 'local' | 'remote' | 'merge'
  ): Promise<void> => {
    setIsResolving(true);

    try {
      // In v4, conflicts are resolved locally since there's no bridge
      setConflicts(prev =>
        prev.map(conflict =>
          conflict.id === conflictId
            ? { ...conflict, resolved: true }
            : conflict
        )
      );

      devLogger.debug('ConflictResolution resolved conflict', { conflictId, resolution });

      // Simulate resolution delay
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      devLogger.error('ConflictResolution failed to resolve conflict', { error, conflictId });
      throw error;
    } finally {
      setIsResolving(false);
    }
  }, []);

  const resolveAllConflicts = useCallback(async (
    resolution: 'local' | 'remote'
  ): Promise<void> => {
    setIsResolving(true);

    try {
      const unresolvedConflicts = conflicts.filter(c => !c.resolved);

      for (const conflict of unresolvedConflicts) {
        await resolveConflict(conflict.id, resolution);
      }

      devLogger.debug('ConflictResolution resolved all conflicts', { resolution, count: unresolvedConflicts.length });
    } catch (error) {
      devLogger.error('ConflictResolution failed to resolve all conflicts', { error });
      throw error;
    } finally {
      setIsResolving(false);
    }
  }, [conflicts, resolveConflict]);

  const dismissConflict = useCallback((conflictId: string) => {
    setConflicts(prev => prev.filter(conflict => conflict.id !== conflictId));
  }, []);

  const pendingCount = conflicts.filter(c => !c.resolved).length;

  return {
    conflicts,
    pendingCount,
    isResolving,
    resolveConflict,
    resolveAllConflicts,
    dismissConflict
  };
}