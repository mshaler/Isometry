import { createContext, useContext, ReactNode, useState, useCallback, useEffect } from 'react';
import { useLiveData, type LiveDataPerformanceMetrics } from '@/hooks';
import type { Node } from '@/types/node';

export interface Chip {
  id: string;
  label: string;
  hasCheckbox?: boolean;
  checked?: boolean;
}

export interface Wells {
  available: Chip[];
  rows: Chip[];      // Row headers (left side, vertical grouping)
  columns: Chip[];   // Column headers (top, horizontal grouping)
  zLayers: Chip[];
}

export interface QueryPerformanceMetrics {
  latency: number;
  rowCount: number;
  cacheHit: boolean;
  queryComplexity: number;
  lastUpdated: Date;
}

interface PAFVContextType {
  // Existing wells management
  wells: Wells;
  moveChip: (fromWell: keyof Wells, _fromIndex: number, toWell: keyof Wells, toIndex: number) => void;
  toggleCheckbox: (well: keyof Wells, _chipId: string) => void;
  transpose: () => void;

  // SuperDynamic axis repositioning
  swapPlaneMapping: (fromAxis: 'x' | 'y', toAxis: 'x' | 'y') => void;

  // New live data integration
  currentQuery: string;
  filteredData: Node[];
  isLoading: boolean;
  error: string | null;
  queryMetrics: QueryPerformanceMetrics | null;
  refreshData: () => void;
  subscriptionId: string | null;
}

const PAFVContext = createContext<PAFVContextType | undefined>(undefined);

const DEFAULT_WELLS: Wells = {
  available: [],
  rows: [
    { id: 'folder', label: 'Folder' },
    { id: 'subfolder', label: 'Sub-folder' },
    { id: 'tags', label: 'Tags' },
  ],
  columns: [
    { id: 'year', label: 'Year' },
    { id: 'month', label: 'Month' },
  ],
  zLayers: [
    { id: 'auditview', label: 'Audit View', hasCheckbox: true, checked: false },
  ],
};

export function PAFVProvider({ children }: { children: ReactNode }) {
  const [wells, setWells] = useState<Wells>(DEFAULT_WELLS);
  const [currentQuery, setCurrentQuery] = useState<string>('');
  const [queryMetrics, setQueryMetrics] = useState<QueryPerformanceMetrics | null>(null);

  // Generate query from current wells configuration
  const generatePAFVQuery = useCallback((wellsConfig: Wells): string => {
    // Start with base query
    let query = 'SELECT * FROM nodes WHERE deleted_at IS NULL';
    const conditions: string[] = [];

    // Add row-based grouping conditions
    if (wellsConfig.rows.length > 0) {
      const rowConditions = wellsConfig.rows.map(chip => {
        switch (chip.id) {
          case 'folder':
            return 'folder IS NOT NULL';
          case 'subfolder':
            return 'folder LIKE "%/%"';  // Has subfolder structure
          case 'tags':
            return 'tags != "[]" AND tags IS NOT NULL';
          default:
            return '1=1';
        }
      });
      conditions.push(`(${rowConditions.join(' OR ')})`);
    }

    // Add column-based grouping conditions
    if (wellsConfig.columns.length > 0) {
      const colConditions = wellsConfig.columns.map(chip => {
        switch (chip.id) {
          case 'year':
            return 'created_at >= datetime("now", "-1 year")';
          case 'month':
            return 'created_at >= datetime("now", "-1 month")';
          default:
            return '1=1';
        }
      });
      conditions.push(`(${colConditions.join(' OR ')})`);
    }

    // Add z-layer filters
    const activeZLayers = wellsConfig.zLayers.filter(chip => chip.checked);
    if (activeZLayers.length > 0) {
      const zConditions = activeZLayers.map(chip => {
        switch (chip.id) {
          case 'auditview':
            return 'modified_at != created_at';  // Show modified items
          default:
            return '1=1';
        }
      });
      conditions.push(`(${zConditions.join(' AND ')})`);
    }

    // Combine all conditions
    if (conditions.length > 0) {
      query += ' AND ' + conditions.join(' AND ');
    }

    // Add reasonable ordering and limit for performance
    query += ' ORDER BY modified_at DESC LIMIT 1000';

    return query;
  }, []);

  // Update query when wells change (debounced)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      const newQuery = generatePAFVQuery(wells);
      setCurrentQuery(newQuery);
    }, 200); // 200ms debounce

    return () => clearTimeout(timeoutId);
  }, [wells, generatePAFVQuery]);

  // Live data subscription with performance tracking
  const liveDataSubscription = useLiveData<Node[]>(
    currentQuery,
    [],
    {
      throttleMs: 100,
      trackPerformance: true,
      onPerformanceUpdate: (metrics: LiveDataPerformanceMetrics) => {
        setQueryMetrics({
          latency: metrics.lastLatency,
          rowCount: Array.isArray(liveDataSubscription.data) ? liveDataSubscription.data.length : 0,
          cacheHit: metrics.cacheHitRate > 0,
          queryComplexity: currentQuery.length, // Simple complexity metric
          lastUpdated: new Date()
        });
      }
    }
  );

  const moveChip = useCallback((
    fromWell: keyof Wells,
    fromIndex: number,
    toWell: keyof Wells,
    toIndex: number
  ) => {
    setWells(prev => {
      const newWells: Wells = {
        available: [...prev.available],
        rows: [...prev.rows],
        columns: [...prev.columns],
        zLayers: [...prev.zLayers],
      };
      const [movedChip] = newWells[fromWell].splice(fromIndex, 1);
      newWells[toWell].splice(toIndex, 0, movedChip);
      return newWells;
    });
  }, []);

  const toggleCheckbox = useCallback((well: keyof Wells, chipId: string) => {
    setWells(prev => ({
      ...prev,
      [well]: prev[well].map(chip =>
        chip.id === chipId ? { ...chip, checked: !chip.checked } : chip
      ),
    }));
  }, []);

  const transpose = useCallback(() => {
    setWells(prev => ({
      ...prev,
      rows: prev.columns,
      columns: prev.rows,
    }));
  }, []);

  /**
   * SuperDynamic: Swap axis mappings when header is dragged to opposite zone.
   * When x-axis is dragged to y-axis zone (or vice versa), swap rows and columns.
   */
  const swapPlaneMapping = useCallback((fromAxis: 'x' | 'y', toAxis: 'x' | 'y') => {
    // Only swap if actually moving to opposite axis
    if (fromAxis === toAxis) return;

    // Swapping axes is equivalent to transpose
    setWells(prev => ({
      ...prev,
      rows: prev.columns,
      columns: prev.rows,
    }));
  }, []);

  const refreshData = useCallback(() => {
    // Force refresh by regenerating the query
    const newQuery = generatePAFVQuery(wells);
    setCurrentQuery(`${newQuery} /* refresh:${Date.now()} */`);
  }, [wells, generatePAFVQuery]);

  return (
    <PAFVContext.Provider
      value={{
        wells,
        moveChip,
        toggleCheckbox,
        transpose,
        swapPlaneMapping,
        currentQuery,
        filteredData: liveDataSubscription.data || [],
        isLoading: liveDataSubscription.isLoading,
        error: liveDataSubscription.error,
        queryMetrics,
        refreshData,
        subscriptionId: liveDataSubscription.id
      }}
    >
      {children}
    </PAFVContext.Provider>
  );
}

export function usePAFV() {
  const context = useContext(PAFVContext);
  if (context === undefined) {
    throw new Error('usePAFV must be used within a PAFVProvider');
  }
  return context;
}
