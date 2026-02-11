/**
 * Event handlers for SuperGridDemo
 */

import { useCallback } from 'react';
import { contextLogger } from '../../utils/logging/dev-logger';
import type { LATCHFilterService } from '../../services/query/LATCHFilterService';
import type { useDatabaseService } from '../../hooks';
import type { ZoomLevel, PanLevel } from '../../d3/SuperGridZoom';
import type { SuperGrid } from '../../d3/SuperGrid';

interface HandlerParams {
  filterService: LATCHFilterService;
  databaseService: ReturnType<typeof useDatabaseService>;
  superGrid: SuperGrid | null;
  setSelectedCards: (cards: string[]) => void;
  setShowBulkActions: (show: boolean) => void;
  setSelectedCard: (card: unknown) => void;
  setIsModalOpen: (open: boolean) => void;
  setIsModalLoading: (loading: boolean) => void;
  setCurrentZoomLevel: (level: ZoomLevel) => void;
  setCurrentPanLevel: (level: PanLevel) => void;
}

export function useSuperGridDemoHandlers(params: HandlerParams) {
  const {
    filterService,
    databaseService,
    superGrid,
    setSelectedCards,
    setShowBulkActions,
    setSelectedCard,
    setIsModalOpen,
    setIsModalLoading,
    setCurrentZoomLevel,
    setCurrentPanLevel
  } = params;

  // Selection handlers
  const handleSelectionChange = useCallback((selectedIds: string[], focusedId: string | null) => {
    contextLogger.data('SuperGridDemo: Selection changed', { count: selectedIds.length, focused: focusedId });
    setSelectedCards(selectedIds);
    setShowBulkActions(selectedIds.length > 1);
  }, [setSelectedCards, setShowBulkActions]);

  // Card interaction handlers
  const handleCardClick = useCallback((card: unknown) => {
    contextLogger.data('SuperGridDemo: Card clicked', card as Record<string, unknown>);
    setSelectedCard(card);
    setIsModalOpen(true);
  }, [setSelectedCard, setIsModalOpen]);

  // Header click handler for LATCH filtering
  const handleHeaderClick = useCallback((axis: string, facet: string, value: unknown) => {
    contextLogger.data('SuperGridDemo: Header clicked', { axis, facet, value });

    const existing = filterService.getActiveFilters().find(
      filter => filter.facet === facet && filter.value === value
    );

    if (existing) {
      filterService.removeFilter(existing.id);
    } else {
      const filterId = filterService.addFilter(
        axis as any,
        facet,
        'equals',
        value,
        `${facet}: ${value}`
      );
      contextLogger.state('SuperGridDemo: Added filter', { filterId, axis, facet, value });
    }
  }, [filterService]);

  const handleFilterRemove = useCallback((filterId: string) => {
    filterService.removeFilter(filterId);
  }, [filterService]);

  const handleClearAllFilters = useCallback(() => {
    filterService.clearFilters();
  }, [filterService]);

  // Bulk operation handlers
  const handleBulkDelete = useCallback(async (selectedIds: string[]) => {
    if (!databaseService.isReady() || selectedIds.length === 0) return;

    try {
      setIsModalLoading(true);
      contextLogger.data('SuperGridDemo: Starting bulk delete', { count: selectedIds.length });

      for (const cardId of selectedIds) {
        try {
          databaseService.run('UPDATE nodes SET deleted_at = datetime(\'now\') WHERE id = ?', [cardId]);
        } catch {
          contextLogger.error('Failed to delete card', { cardId });
        }
      }

      setSelectedCards([]);
      setShowBulkActions(false);
      contextLogger.data('SuperGridDemo: Bulk delete completed', { count: selectedIds.length });

    } catch (error) {
      contextLogger.error('SuperGridDemo: Bulk delete failed', error as Record<string, unknown>);
    } finally {
      setIsModalLoading(false);
    }
  }, [databaseService, setIsModalLoading, setSelectedCards, setShowBulkActions]);

  const handleBulkStatusUpdate = useCallback(async (selectedIds: string[], newStatus: string) => {
    if (!databaseService.isReady() || selectedIds.length === 0) return;

    try {
      setIsModalLoading(true);
      contextLogger.data('SuperGridDemo: Starting bulk status update', { count: selectedIds.length, newStatus });

      for (const cardId of selectedIds) {
        try {
          databaseService.run('UPDATE nodes SET status = ? WHERE id = ?', [newStatus, cardId]);
        } catch {
          contextLogger.error('Failed to update card status', { cardId, newStatus });
        }
      }

      setSelectedCards([]);
      setShowBulkActions(false);
      contextLogger.data('SuperGridDemo: Bulk status update completed', { count: selectedIds.length, newStatus });

    } catch (error) {
      contextLogger.error('SuperGridDemo: Bulk status update failed', error as Record<string, unknown>);
    } finally {
      setIsModalLoading(false);
    }
  }, [databaseService, setIsModalLoading, setSelectedCards, setShowBulkActions]);

  const handleBulkOperation = useCallback((operation: string, selectedIds: string[]) => {
    contextLogger.data('SuperGridDemo: Bulk operation requested', { operation, count: selectedIds.length });

    switch (operation) {
      case 'delete':
        handleBulkDelete(selectedIds);
        break;
      case 'status-todo':
        handleBulkStatusUpdate(selectedIds, 'todo');
        break;
      case 'status-in-progress':
        handleBulkStatusUpdate(selectedIds, 'in-progress');
        break;
      case 'status-done':
        handleBulkStatusUpdate(selectedIds, 'done');
        break;
      default:
        contextLogger.warn('SuperGridDemo: Unknown bulk operation', { operation });
    }
  }, [handleBulkDelete, handleBulkStatusUpdate]);

  // Modal handlers
  const handleModalClose = useCallback(() => {
    setIsModalOpen(false);
    setSelectedCard(null);
    setIsModalLoading(false);
  }, [setIsModalOpen, setSelectedCard, setIsModalLoading]);

  const handleCardSave = useCallback(async (updatedCard: Partial<any>) => {
    if (!databaseService.isReady() || !updatedCard.id) return;

    try {
      setIsModalLoading(true);
      contextLogger.data('SuperGridDemo: Saving card', updatedCard);

      const fields = Object.entries(updatedCard)
        .filter(([key]) => key !== 'id')
        .map(([key]) => `${key} = ?`);
      const values = Object.entries(updatedCard)
        .filter(([key]) => key !== 'id')
        .map(([, val]) => val);

      if (fields.length > 0) {
        databaseService.run(
          `UPDATE nodes SET ${fields.join(', ')} WHERE id = ?`,
          [...values, updatedCard.id]
        );
      }

      contextLogger.data('SuperGridDemo: Card saved successfully', { id: updatedCard.id });
      setIsModalOpen(false);
      setSelectedCard(null);
    } catch (error) {
      contextLogger.error('SuperGridDemo: Card save error', error as Record<string, unknown>);
    } finally {
      setIsModalLoading(false);
    }
  }, [databaseService, setIsModalLoading, setIsModalOpen, setSelectedCard]);

  const handleCardDelete = useCallback(async (cardId: string) => {
    if (!databaseService.isReady()) return;

    try {
      setIsModalLoading(true);
      contextLogger.data('SuperGridDemo: Deleting card', { cardId });

      databaseService.run('UPDATE nodes SET deleted_at = datetime(\'now\') WHERE id = ?', [cardId]);

      contextLogger.data('SuperGridDemo: Card deleted successfully', { cardId });
      setIsModalOpen(false);
      setSelectedCard(null);
    } catch (error) {
      contextLogger.error('SuperGridDemo: Card delete error', error as Record<string, unknown>);
    } finally {
      setIsModalLoading(false);
    }
  }, [databaseService, setIsModalLoading, setIsModalOpen, setSelectedCard]);

  // Zoom/Pan control handlers
  const handleZoomLevelChange = useCallback((level: ZoomLevel) => {
    contextLogger.state('SuperGridDemo: Zoom level changed to', { level });
    setCurrentZoomLevel(level);
    if (superGrid) {
      superGrid.setZoomLevel(level);
    }
  }, [superGrid, setCurrentZoomLevel]);

  const handlePanLevelChange = useCallback((level: PanLevel) => {
    contextLogger.state('SuperGridDemo: Pan level changed to', { level });
    setCurrentPanLevel(level);
    if (superGrid) {
      superGrid.setPanLevel(level);
    }
  }, [superGrid, setCurrentPanLevel]);

  const handleResetZoomPan = useCallback(() => {
    contextLogger.state('SuperGridDemo: Resetting zoom/pan to defaults', {});
    setCurrentZoomLevel('leaf');
    setCurrentPanLevel('dense');
    if (superGrid) {
      superGrid.setZoomLevel('leaf');
      superGrid.setPanLevel('dense');
    }
  }, [superGrid, setCurrentZoomLevel, setCurrentPanLevel]);

  return {
    handleSelectionChange,
    handleCardClick,
    handleHeaderClick,
    handleFilterRemove,
    handleClearAllFilters,
    handleBulkOperation,
    handleModalClose,
    handleCardSave,
    handleCardDelete,
    handleZoomLevelChange,
    handlePanLevelChange,
    handleResetZoomPan
  };
}