import { useState, useCallback } from 'react';

export interface DataConflict {
  id: string;
  type: 'create' | 'update' | 'delete';
  localData: any;
  remoteData: any;
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

      console.log(`[ConflictResolution] Resolved conflict ${conflictId} using ${resolution} strategy`);

      // Simulate resolution delay
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      console.error('[ConflictResolution] Failed to resolve conflict:', error);
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

      console.log(`[ConflictResolution] Resolved all conflicts using ${resolution} strategy`);
    } catch (error) {
      console.error('[ConflictResolution] Failed to resolve all conflicts:', error);
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