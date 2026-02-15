import { useEffect, useRef, useCallback, useMemo } from 'react';
import { useSQLite } from '@/db/SQLiteProvider';
import { debounce } from '@/utils/debounce';

interface CellSizeState {
  cellSizes: Record<string, { width: number; height: number }>;
  globalSizeFactor: number;
}

const VIEW_STATE_KEY = 'supergrid-cell-sizes';

/**
 * Persist and restore cell sizes to/from SQLite view_state table
 * Used by SuperSize component for persistence across navigation
 */
export function useCellSizePersistence(datasetId: string = 'default') {
  const { db } = useSQLite();
  const initialLoadRef = useRef(false);

  // Load saved sizes on mount
  const loadSizes = useCallback(async (): Promise<CellSizeState | null> => {
    if (!db) return null;

    try {
      const result = db.exec(`
        SELECT state_json FROM view_state
        WHERE id = ? AND family = 'LATCH'
      `, [VIEW_STATE_KEY]);

      if (result[0]?.values?.[0]?.[0]) {
        const state = JSON.parse(result[0].values[0][0] as string);
        return state.cellSizes ? state : null;
      }
    } catch (e) {
      console.warn('[useCellSizePersistence] Failed to load sizes:', e);
    }
    return null;
  }, [db]);

  // Save sizes (debounced to avoid DB spam)
  const saveSizes = useMemo(() => {
    const saveFn = (state: CellSizeState) => {
      if (!db) return;

      try {
        db.run(`
          INSERT OR REPLACE INTO view_state (id, dataset_id, app_id, family, state_json, updated_at)
          VALUES (?, ?, 'isometry', 'LATCH', ?, datetime('now'))
        `, [VIEW_STATE_KEY, datasetId, JSON.stringify(state)]);
      } catch (e) {
        console.warn('[useCellSizePersistence] Failed to save sizes:', e);
      }
    };

    return debounce(saveFn as (state: CellSizeState) => void, 500);
  }, [db, datasetId]);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      saveSizes.cancel();
    };
  }, [saveSizes]);

  return {
    loadSizes,
    saveSizes,
    initialLoadRef,
  };
}
