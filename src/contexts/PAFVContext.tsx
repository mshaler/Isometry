import { createContext, useContext } from 'react';
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

export function usePAFV() {
  const context = useContext(PAFVContext);
  if (context === undefined) {
    throw new Error('usePAFV must be used within a PAFVProvider');
  }
  return context;
}
