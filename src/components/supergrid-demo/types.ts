/**
 * Type definitions for SuperGridDemo
 */

import type { LATCHFilter } from '../../services/LATCHFilterService';
import type { ZoomLevel, PanLevel } from '../../d3/SuperGridZoom';

export interface FilterChipProps {
  filter: LATCHFilter;
  onRemove: () => void;
}

export interface SuperGridDemoState {
  selectedCard: unknown | null;
  isModalOpen: boolean;
  isModalLoading: boolean;
  activeFilters: LATCHFilter[];
  selectedCards: string[];
  showBulkActions: boolean;
  currentZoomLevel: ZoomLevel;
  currentPanLevel: PanLevel;
}