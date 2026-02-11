/**
 * Type definitions for SuperGrid Integration Demo
 */

import type { LATCHFilter } from '../services/query/LATCHFilterService';
import type { ZoomLevel, PanLevel } from '../d3/SuperGridZoom';
import type { ProgressiveDisclosureState, JanusDensityState } from '../types/supergrid';
import type { ViewAxisMapping } from '../types/views';

// Re-export types used by demo sub-components
export type { ProgressiveDisclosureState, JanusDensityState } from '../types/supergrid';
export type { ViewAxisMapping } from '../types/views';

// Performance monitoring
export interface PerformanceMetrics {
  lastRenderTime: number;
  averageFrameRate: number;
  featureUsageCount: Record<string, number>;
  userInteractions: Array<{
    feature: string;
    timestamp: number;
    duration: number;
    data?: unknown;
  }>;
}

export interface FilterChipProps {
  filter: LATCHFilter;
  onRemove: () => void;
}

// Demo component state
export interface DemoState {
  // Core state
  selectedCard: unknown | null;
  isModalOpen: boolean;
  isModalLoading: boolean;
  selectedCards: string[];
  showBulkActions: boolean;
  activeFilters: LATCHFilter[];

  // Feature states
  progressiveState: ProgressiveDisclosureState;
  axisMapping: ViewAxisMapping;
  isDragInProgress: boolean;
  janusState: JanusDensityState;
  zoomLevel: ZoomLevel;
  panLevel: PanLevel;
  zoomTransform: { x: number; y: number; k: number };
  performanceMetrics: PerformanceMetrics;
}

// Demo component callbacks
export interface DemoCallbacks {
  // Performance
  trackFeatureUsage: (feature: string, data?: unknown) => void;
  updateFrameRate: (fps: number) => void;

  // Core SuperGrid
  handleCardClick: (card: unknown) => void;
  handleSelectionChange: (selectedIds: string[], focusedId: string | null) => void;
  handleHeaderClick: (axis: string, facet: string, value: unknown) => void;

  // SuperStack (Progressive Disclosure)
  handleLevelTabChange: (tabIndex: number) => void;
  handleZoomLevelChange: (level: number) => void;

  // SuperDynamic (Axis Repositioning)
  handleAxisRepositioning: (newMapping: ViewAxisMapping) => void;

  // Janus Density
  handleValueDensityChange: (mode: 'leaf' | 'collapsed') => void;
  handleExtentDensityChange: (mode: 'sparse' | 'populated-only') => void;

  // SuperZoom (Cartographic)
  handleCartographicZoom: (transform: { x: number; y: number; k: number }) => void;

  // Filter management
  handleFilterRemove: (filterId: string) => void;
  handleClearAllFilters: () => void;

  // Bulk operations
  handleBulkOperation: (operation: string, selectedIds: string[]) => void;
}