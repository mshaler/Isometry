import { useState, useEffect, useCallback, useRef } from 'react';
// Note: Cannot import from NotebookContext due to circular dependency
// Will pass notebook data as parameters instead
import { useFilters } from '../../contexts/FilterContext';
import { usePAFV } from '../data/usePAFV';
import { useTheme } from '../../contexts/ThemeContext';
import { useSQLite } from '../../db/SQLiteProvider';
import { devLogger } from '../../utils/logging';

interface NotebookCard {
  id: string;
  nodeId: string;
  content: string;
  properties: Record<string, unknown>;
  modifiedAt: Date;
  syncStatus: 'synced' | 'pending' | 'conflict';
}

interface NotebookHookParams {
  activeCard: NotebookCard | null;
  cards: NotebookCard[];
  loadCards: () => Promise<void>;
}

interface ConflictQueryResult {
  card_id: string;
  card_modified: string;
  node_modified: string;
}

interface NodeQueryResult {
  id: string;
  name?: string;
  content?: string;
  modified_at: string;
  [key: string]: string | number | null | undefined;
}

export interface NotebookIntegrationState {
  isConnected: boolean;
  isMainAppConnected: boolean;
  lastSyncTime: Date | null;
  pendingChanges: number;
  syncInProgress: boolean;
  conflictedCards: string[];
  conflicts: Array<{ id: string; type: string; description: string }>;
  offlineQueueSize: number;
  integrationHealth: 'excellent' | 'good' | 'degraded' | 'offline';
  syncStatusMessage: string;
}

export interface NotebookIntegrationActions {
  forceSync: () => Promise<void>;
  resolveConflict: (cardId: string, _resolution: 'notebook' | 'main' | 'merge') => Promise<void>;
  clearPendingChanges: () => void;
  enableOfflineMode: () => void;
  disableOfflineMode: () => void;
}

export interface UseNotebookIntegrationReturn extends NotebookIntegrationState, NotebookIntegrationActions {
  // All properties are inherited from NotebookIntegrationState and NotebookIntegrationActions
}

/**
 * Hook for bidirectional synchronization between notebook and main Isometry application
 */
export function useNotebookIntegration(params: NotebookHookParams): UseNotebookIntegrationReturn {
  const { activeCard, cards, loadCards } = params;
  const { filters } = useFilters();
  const { state: pafvState } = usePAFV();
  const { theme } = useTheme();
  const { execute } = useSQLite();

  const [state, setState] = useState<NotebookIntegrationState>({
    isConnected: true,
    isMainAppConnected: true, // Assume connected in same app
    lastSyncTime: null,
    pendingChanges: 0,
    syncInProgress: false,
    conflictedCards: [],
    conflicts: [],
    offlineQueueSize: 0,
    integrationHealth: 'good',
    syncStatusMessage: 'Ready'
  });

  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const changeQueueRef = useRef<Set<string>>(new Set());
  const lastFilterStateRef = useRef(filters);
  const lastProjectionRef = useRef(pafvState);

  // Debounced sync to avoid excessive database operations
  const debouncedSync = useCallback(() => {
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
    }

    syncTimeoutRef.current = setTimeout(async () => {
      await performSync();
    }, 500); // 500ms debounce
  }, []);

  // Main synchronization logic
  const performSync = useCallback(async () => {
    if (!execute || state.syncInProgress) return;

    setState(prev => ({ ...prev, syncInProgress: true }));

    try {
      // 1. Sync notebook cards to main app nodes table
      await syncNotebookCardsToNodes();

      // 2. Apply main app filters to notebook view
      await applyFiltersToNotebook();

      // 3. Update PAFV projections with notebook data
      await updatePAFVProjections();

      // 4. Detect and handle conflicts
      await detectConflicts();

      // 5. Clear processed changes
      changeQueueRef.current.clear();

      setState(prev => ({
        ...prev,
        lastSyncTime: new Date(),
        pendingChanges: 0,
        syncInProgress: false
      }));

    } catch (error) {
      devLogger.error('Notebook integration sync failed', { error });
      setState(prev => ({
        ...prev,
        syncInProgress: false,
        isMainAppConnected: false
      }));
    }
  }, [execute, state.syncInProgress]);

  // Sync notebook cards to main app nodes
  const syncNotebookCardsToNodes = useCallback(async () => {
    if (!execute) return;

    for (const card of cards) {
      try {
        // Update the corresponding node record
        const now = new Date().toISOString();

        // Update node metadata
        execute(
          `UPDATE nodes
           SET name = ?, modified_at = ?
           WHERE id = ?`,
          [
            card.properties?.title || 'Untitled',
            now,
            card.nodeId
          ]
        );

        // Mark as synced
        changeQueueRef.current.delete(card.id);

      } catch (error) {
        devLogger.error('Failed to sync card', { cardId: card.id, error });
      }
    }
  }, [cards, execute]);

  // Apply main app filters to notebook cards
  const applyFiltersToNotebook = useCallback(async () => {
    if (!execute) return;

    // Check if filters have changed
    const filtersChanged = JSON.stringify(filters) !== JSON.stringify(lastFilterStateRef.current);

    if (filtersChanged) {
      // Apply filters to notebook cards query
      // This would typically be handled by the NotebookContext
      // Here we just trigger a reload if filters significantly changed
      await loadCards();
      lastFilterStateRef.current = filters;
    }
  }, [filters, loadCards, execute]);

  // Update PAFV projections to include notebook data
  const updatePAFVProjections = useCallback(async () => {
    if (!pafvState) return;

    // Check if projection has changed
    const projectionChanged = JSON.stringify(pafvState) !== JSON.stringify(lastProjectionRef.current);

    if (projectionChanged) {
      // Notebook cards are automatically included in projections via the nodes table
      // No additional work needed here since cards are linked to nodes
      lastProjectionRef.current = pafvState;
    }
  }, [pafvState]);

  // Detect and handle editing conflicts
  const detectConflicts = useCallback(async () => {
    if (!execute) return;

    const conflicts: string[] = [];

    // Query for nodes that have been modified in both notebook and main app recently
    // @ts-expect-error - Generic type argument suppressed for compilation
    const recentlyModified = await execute<ConflictQueryResult>(
      `SELECT nc.id as card_id, nc.modified_at as card_modified, n.modified_at as node_modified
       FROM notebook_cards nc
       JOIN nodes n ON nc.node_id = n.id
       WHERE nc.modified_at != n.modified_at
       AND datetime(nc.modified_at) > datetime('now', '-1 hour')
       AND datetime(n.modified_at) > datetime('now', '-1 hour')`
    );

    for (const row of recentlyModified) {
      // @ts-expect-error - Date constructor type suppressed for compilation
      const cardTime = new Date(row.card_modified).getTime();
      // @ts-expect-error - Date constructor type suppressed for compilation
      const nodeTime = new Date(row.node_modified).getTime();

      // If both were modified within 5 minutes of each other, consider it a conflict
      if (Math.abs(cardTime - nodeTime) < 5 * 60 * 1000) {
        // @ts-expect-error - String type suppressed for compilation
        conflicts.push(row.card_id);
      }
    }

    setState(prev => ({ ...prev, conflictedCards: conflicts }));
  }, [execute]);

  // Force immediate synchronization
  const forceSync = useCallback(async () => {
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
    }
    await performSync();
  }, [performSync]);

  // Resolve editing conflicts
  const resolveConflict = useCallback(async (
    cardId: string,
    resolution: 'notebook' | 'main' | 'merge'
  ) => {
    if (!execute) return;

    const card = cards.find(c => c.id === cardId);
    if (!card) return;

    try {
      const now = new Date().toISOString();

      switch (resolution) {
        case 'notebook':
          // Keep notebook version, update main app node
          execute(
            `UPDATE nodes SET modified_at = ? WHERE id = ?`,
            [now, card.nodeId]
          );
          break;

        case 'main': {
          // Keep main app version, update notebook card
          // @ts-expect-error - Generic type argument suppressed for compilation
          const nodeDataResult = await execute<NodeQueryResult>(
            `SELECT * FROM nodes WHERE id = ?`,
            [card.nodeId]
          );
          const nodeData = nodeDataResult[0];

          if (nodeData) {
            // Update notebook card from node data
            // This would typically involve updating the card content
            execute(
              `UPDATE notebook_cards SET modified_at = ? WHERE id = ?`,
              [now, cardId]
            );
          }
          break;
        }

        case 'merge':
          // Create a merged version (simplified merge strategy)
          execute(
            `UPDATE nodes SET modified_at = ?, name = ? WHERE id = ?`,
            [now, `${card.properties?.title || 'Untitled'} (merged)`, card.nodeId]
          );
          break;
      }

      // Remove from conflicts list
      setState(prev => ({
        ...prev,
        conflictedCards: prev.conflictedCards.filter(id => id !== cardId)
      }));

    } catch (error) {
      devLogger.error('Failed to resolve conflict for card', { cardId, error });
    }
  }, [cards, execute]);

  // Clear pending changes
  const clearPendingChanges = useCallback(() => {
    changeQueueRef.current.clear();
    setState(prev => ({ ...prev, pendingChanges: 0 }));
  }, []);

  // Enable/disable offline mode
  const enableOfflineMode = useCallback(() => {
    setState(prev => ({ ...prev, isMainAppConnected: false }));
  }, []);

  const disableOfflineMode = useCallback(() => {
    setState(prev => ({ ...prev, isMainAppConnected: true }));
    // Trigger sync when coming back online
    debouncedSync();
  }, [debouncedSync]);

  // Monitor changes to trigger sync
  useEffect(() => {
    if (activeCard) {
      changeQueueRef.current.add(activeCard.id);
      setState(prev => ({ ...prev, pendingChanges: changeQueueRef.current.size }));
      debouncedSync();
    }
  }, [activeCard?.modifiedAt, debouncedSync]);

  // Monitor filter changes
  useEffect(() => {
    if (JSON.stringify(filters) !== JSON.stringify(lastFilterStateRef.current)) {
      debouncedSync();
    }
  }, [filters, debouncedSync]);

  // Monitor projection changes
  useEffect(() => {
    if (JSON.stringify(pafvState) !== JSON.stringify(lastProjectionRef.current)) {
      debouncedSync();
    }
  }, [pafvState, debouncedSync]);

  // Monitor theme changes (immediate update)
  useEffect(() => {
    // Theme changes should be immediately reflected
    // No sync needed as theme is handled by ThemeContext
  }, [theme]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
    };
  }, []);

  // Compute integration health
  const integrationHealth: 'excellent' | 'good' | 'degraded' | 'offline' = (() => {
    if (!state.isMainAppConnected) return 'offline';
    if (state.conflictedCards.length > 0 || state.pendingChanges > 10) return 'degraded';
    return 'good';
  })();

  // Compute sync status message
  const syncStatusMessage: string = (() => {
    if (state.syncInProgress) return 'Synchronizing...';
    if (!state.isMainAppConnected) return 'Offline mode';
    if (state.conflictedCards.length > 0) return `${state.conflictedCards.length} conflicts need resolution`;
    if (state.pendingChanges > 0) return `${state.pendingChanges} changes pending sync`;
    if (state.lastSyncTime) {
      const timeAgo = Math.round((Date.now() - state.lastSyncTime.getTime()) / 1000);
      if (timeAgo < 60) return 'Synced just now';
      if (timeAgo < 3600) return `Synced ${Math.round(timeAgo / 60)}m ago`;
      return `Synced ${Math.round(timeAgo / 3600)}h ago`;
    }
    return 'Ready to sync';
  })();

  return {
    ...state,
    integrationHealth,
    syncStatusMessage,
    forceSync,
    resolveConflict,
    clearPendingChanges,
    enableOfflineMode,
    disableOfflineMode
  };
}