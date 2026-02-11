/**
 * Callback implementations for SuperGrid Integration Demo
 */

import { useCallback } from 'react';
import { SuperGrid } from '../d3/SuperGrid';
import { LATCHFilterService } from '../services/query/LATCHFilterService';
import { contextLogger } from '../utils/logging/dev-logger';
import type { ProgressiveDisclosureState, JanusDensityState } from '../types';
import type { ViewAxisMapping } from '../types/views';
import type { ZoomLevel, PanLevel } from '../d3/SuperGridZoom';

interface CallbackHookParams {
  superGrid: SuperGrid | null;
  filterService: LATCHFilterService;
  trackFeatureUsage: (feature: string, data?: unknown) => void;
  setSelectedCard: (card: unknown) => void;
  setIsModalOpen: (open: boolean) => void;
  setSelectedCards: (cards: string[]) => void;
  setShowBulkActions: (show: boolean) => void;
  setProgressiveState: React.Dispatch<React.SetStateAction<ProgressiveDisclosureState>>;
  setAxisMapping: React.Dispatch<React.SetStateAction<ViewAxisMapping>>;
  setIsDragInProgress: (progress: boolean) => void;
  setJanusState: React.Dispatch<React.SetStateAction<JanusDensityState>>;
  setZoomLevel: (level: ZoomLevel) => void;
  setPanLevel: (level: PanLevel) => void;
  setZoomTransform: React.Dispatch<React.SetStateAction<{ x: number; y: number; k: number }>>;
}

export function useDemoCallbacks({
  superGrid,
  filterService,
  trackFeatureUsage,
  setSelectedCard,
  setIsModalOpen,
  setSelectedCards,
  setShowBulkActions,
  setProgressiveState,
  setAxisMapping,
  setIsDragInProgress,
  setJanusState,
  setZoomLevel,
  setPanLevel,
  setZoomTransform
}: CallbackHookParams) {

  // Core SuperGrid callbacks
  const handleCardClick = useCallback((card: unknown) => {
    trackFeatureUsage('card-click', { cardId: (card as Record<string, unknown>).id });
    setSelectedCard(card);
    setIsModalOpen(true);
  }, [trackFeatureUsage, setSelectedCard, setIsModalOpen]);

  const handleSelectionChange = useCallback((selectedIds: string[], focusedId: string | null) => {
    trackFeatureUsage('selection-change', { count: selectedIds.length, focused: focusedId });
    setSelectedCards(selectedIds);
    setShowBulkActions(selectedIds.length > 1);
  }, [trackFeatureUsage, setSelectedCards, setShowBulkActions]);

  const handleHeaderClick = useCallback((axis: string, facet: string, value: unknown) => {
    trackFeatureUsage('header-filter', { axis, facet, value });

    const existing = filterService.getActiveFilters().find(
      filter => filter.facet === facet && filter.value === value
    );

    if (existing) {
      filterService.removeFilter(existing.id);
    } else {
      filterService.addFilter(
        axis as any,
        facet,
        'equals',
        value,
        `${facet}: ${value}`
      );
    }
  }, [filterService, trackFeatureUsage]);

  // SuperStack (Progressive Disclosure) callbacks
  const handleLevelTabChange = useCallback((tabIndex: number) => {
    trackFeatureUsage('superstack-tab-change', { tabIndex });
    setProgressiveState(prev => ({
      ...prev,
      activeLevelTab: tabIndex,
      isTransitioning: true,
      lastTransitionTime: performance.now()
    }));

    // Simulate transition completion
    setTimeout(() => {
      setProgressiveState(prev => ({ ...prev, isTransitioning: false }));
    }, 300);
  }, [trackFeatureUsage, setProgressiveState]);

  const handleZoomLevelChange = useCallback((level: number) => {
    trackFeatureUsage('superstack-zoom', { level });
    setProgressiveState(prev => ({ ...prev, zoomLevel: level }));
  }, [trackFeatureUsage, setProgressiveState]);

  // SuperDynamic (Axis Repositioning) callbacks
  const handleAxisRepositioning = useCallback((newMapping: ViewAxisMapping) => {
    trackFeatureUsage('superdynamic-reposition', { newMapping });
    setIsDragInProgress(true);
    setAxisMapping(newMapping);

    // Simulate reflow animation
    setTimeout(() => {
      setIsDragInProgress(false);
      // Trigger grid reflow with new axis mapping
      if (superGrid) {
        superGrid.refresh();
      }
    }, 500);
  }, [superGrid, trackFeatureUsage, setIsDragInProgress, setAxisMapping]);

  // Janus Density callbacks
  const handleValueDensityChange = useCallback((mode: 'leaf' | 'collapsed') => {
    trackFeatureUsage('janus-value-density', { mode });
    setJanusState(prev => ({ ...prev, valueDensity: mode }));
    setZoomLevel(mode);
    if (superGrid) {
      superGrid.setZoomLevel(mode);
    }
  }, [superGrid, trackFeatureUsage, setJanusState, setZoomLevel]);

  const handleExtentDensityChange = useCallback((mode: 'sparse' | 'populated-only') => {
    trackFeatureUsage('janus-extent-density', { mode });
    setJanusState(prev => ({ ...prev, extentDensity: mode }));
    setPanLevel(mode === 'sparse' ? 'sparse' : 'dense');
    if (superGrid) {
      superGrid.setPanLevel(mode === 'sparse' ? 'sparse' : 'dense');
    }
  }, [superGrid, trackFeatureUsage, setJanusState, setPanLevel]);

  // SuperZoom (Cartographic) callbacks
  const handleCartographicZoom = useCallback((transform: { x: number; y: number; k: number }) => {
    trackFeatureUsage('superzoom-cartographic', { scale: transform.k });
    setZoomTransform(transform);
  }, [trackFeatureUsage, setZoomTransform]);

  // Filter management
  const handleFilterRemove = useCallback((filterId: string) => {
    trackFeatureUsage('filter-remove', { filterId });
    filterService.removeFilter(filterId);
  }, [filterService, trackFeatureUsage]);

  const handleClearAllFilters = useCallback(() => {
    trackFeatureUsage('filter-clear-all');
    filterService.clearFilters();
  }, [filterService, trackFeatureUsage]);

  // Bulk operations
  const handleBulkOperation = useCallback((operation: string, selectedIds: string[]) => {
    trackFeatureUsage('bulk-operation', { operation, count: selectedIds.length });
    // Implementation would go here
    contextLogger.data('Bulk operation', { operation, count: selectedIds.length });
  }, [trackFeatureUsage]);

  return {
    handleCardClick,
    handleSelectionChange,
    handleHeaderClick,
    handleLevelTabChange,
    handleZoomLevelChange,
    handleAxisRepositioning,
    handleValueDensityChange,
    handleExtentDensityChange,
    handleCartographicZoom,
    handleFilterRemove,
    handleClearAllFilters,
    handleBulkOperation
  };
}