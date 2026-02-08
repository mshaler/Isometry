import { useEffect, useState, useRef, useCallback } from 'react';
import { SuperGrid } from '../d3/SuperGrid';
import { ListView } from '../d3/ListView';
import { KanbanView } from '../d3/KanbanView';
import { ViewContinuum } from '../d3/ViewContinuum';
import type { ViewContinuumCallbacks } from '../d3/ViewContinuum';
import { ViewSwitcher, useViewSwitcher } from './ViewSwitcher';
import { ViewType } from '../types/views';
import { CardDetailModal } from './CardDetailModal';
import { useDatabaseService, usePAFV } from '@/hooks';
import { LATCHFilterService } from '../services/LATCHFilterService';
import type { LATCHFilter } from '../services/LATCHFilterService';
import { SQLiteDebugConsole } from './SQLiteDebugConsole';
import type { ZoomLevel, PanLevel } from '../d3/SuperGridZoom';
import { contextLogger } from '../utils/logging/dev-logger';

interface FilterChipProps {
  filter: LATCHFilter;
  onRemove: () => void;
}

function FilterChip({ filter, onRemove }: FilterChipProps) {
  return (
    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800">
      {filter.label}
      <button
        onClick={onRemove}
        className="ml-2 w-4 h-4 text-blue-600 hover:text-blue-800"
        aria-label="Remove filter"
      >
        ×
      </button>
    </span>
  );
}

/**
 * SuperGridDemo - Demonstration component showcasing multi-select capabilities
 *
 * Features:
 * - Multi-select cards with visual feedback
 * - Keyboard navigation (arrow keys, space, enter, esc)
 * - Bulk operations (delete, edit status, move to folder)
 * - Integration with LATCH filtering
 * - Card detail modals
 */
export function SuperGridDemo() {
  // View state management
  const canvasId = 'supergrid-demo';
  const { currentView, setCurrentView } = useViewSwitcher(canvasId, ViewType.SUPERGRID);

  // State management
  const [superGrid, setSuperGrid] = useState<SuperGrid | null>(null);
  const [viewContinuum, setViewContinuum] = useState<ViewContinuum | null>(null);
  const [selectedCard, setSelectedCard] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isModalLoading, setIsModalLoading] = useState(false);
  const [activeFilters, setActiveFilters] = useState<LATCHFilter[]>([]);
  const [selectedCards, setSelectedCards] = useState<string[]>([]);
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [filterService] = useState(() => new LATCHFilterService());

  // Zoom/Pan state for Janus controls (SuperGrid specific)
  const [currentZoomLevel, setCurrentZoomLevel] = useState<ZoomLevel>('leaf');
  const [currentPanLevel, setCurrentPanLevel] = useState<PanLevel>('dense');

  // Refs
  const svgRef = useRef<SVGSVGElement>(null);

  // Context hooks
  const databaseService = useDatabaseService();
  const { state: pafvState } = usePAFV();

  // Debug logging
  contextLogger.state('SuperGridDemo: Database service state', { ready: databaseService.isReady() });

  // Set up filter service listener for state sync
  useEffect(() => {
    const unsubscribe = filterService.onFilterChange((filters) => {
      contextLogger.state('SuperGridDemo: Filter service state changed', { count: filters.length, filters });
      setActiveFilters(filters);
    });

    // Initialize with current filters
    setActiveFilters(filterService.getActiveFilters());

    return unsubscribe;
  }, [filterService]);


  // Selection handlers
  const handleSelectionChange = useCallback((selectedIds: string[], focusedId: string | null) => {
    contextLogger.data('SuperGridDemo: Selection changed', { count: selectedIds.length, focused: focusedId });
    setSelectedCards(selectedIds);
    setShowBulkActions(selectedIds.length > 1);
  }, []);

  // Card interaction handlers
  const handleCardClick = useCallback((card: any) => {
    contextLogger.data('SuperGridDemo: Card clicked', card);
    setSelectedCard(card);
    setIsModalOpen(true);
  }, []);

  // Header click handler for LATCH filtering
  const handleHeaderClick = useCallback((axis: string, facet: string, value: any) => {
    contextLogger.data('SuperGridDemo: Header clicked', { axis, facet, value });

    // Check if filter already exists
    const existing = filterService.getActiveFilters().find(
      filter => filter.facet === facet && filter.value === value
    );

    if (existing) {
      // Remove existing filter (toggle off)
      filterService.removeFilter(existing.id);
    } else {
      // Add new filter
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
    if (!databaseService || selectedIds.length === 0) return;

    try {
      setIsModalLoading(true);
      const selectionManager = superGrid?.getSelectionManager();

      // Soft delete - mark as deleted_at
      const placeholders = selectedIds.map(() => '?').join(', ');
      databaseService.run(`UPDATE nodes SET deleted_at = datetime('now') WHERE id IN (${placeholders})`, selectedIds);

      // Clear selection and refresh grid
      selectionManager?.clearSelection();
      superGrid?.refresh();

      // Update stats
      const stats = superGrid?.getStats();
      contextLogger.metrics('Bulk delete completed', { deletedCount: selectedIds.length, stats });

    } catch (error) {
      console.error('Bulk delete error:', error);
    } finally {
      setIsModalLoading(false);
    }
  }, [databaseService, superGrid]);

  const handleBulkStatusUpdate = useCallback(async (selectedIds: string[], newStatus: string) => {
    if (!databaseService || selectedIds.length === 0) return;

    try {
      setIsModalLoading(true);
      const selectionManager = superGrid?.getSelectionManager();

      // Update status for selected cards
      const placeholders = selectedIds.map(() => '?').join(', ');
      databaseService.run(`UPDATE nodes SET status = ? WHERE id IN (${placeholders})`, [newStatus, ...selectedIds]);

      // Clear selection and refresh grid
      selectionManager?.clearSelection();
      superGrid?.refresh();

      // Update stats
      const stats = superGrid?.getStats();
      contextLogger.metrics('Bulk status update completed', {
        updatedCount: selectedIds.length,
        newStatus,
        stats
      });

    } catch (error) {
      console.error('Bulk status update error:', error);
    } finally {
      setIsModalLoading(false);
    }
  }, [databaseService, superGrid]);

  const handleBulkFolderMove = useCallback(async (selectedIds: string[], newFolder: string) => {
    if (!databaseService || selectedIds.length === 0) return;

    try {
      setIsModalLoading(true);
      const selectionManager = superGrid?.getSelectionManager();

      // Update folder for selected cards
      const placeholders = selectedIds.map(() => '?').join(', ');
      databaseService.run(`UPDATE nodes SET folder = ? WHERE id IN (${placeholders})`, [newFolder, ...selectedIds]);

      // Clear selection and refresh grid
      selectionManager?.clearSelection();
      superGrid?.refresh();

      // Update stats
      const stats = superGrid?.getStats();
      contextLogger.metrics('Bulk folder move completed', {
        movedCount: selectedIds.length,
        newFolder,
        stats
      });

    } catch (error) {
      console.error('Bulk folder move error:', error);
    } finally {
      setIsModalLoading(false);
    }
  }, [databaseService, superGrid]);

  const handleBulkOperation = useCallback((operation: string, selectedIds: string[]) => {
    contextLogger.data('SuperGridDemo: Bulk operation requested', { operation, count: selectedIds.length });

    switch (operation) {
      case 'delete':
        handleBulkDelete(selectedIds);
        break;
      case 'archive':
        handleBulkFolderMove(selectedIds, 'archive');
        break;
      default:
        console.warn('Unknown bulk operation:', operation);
    }
  }, [handleBulkDelete, handleBulkFolderMove]);

  // Modal handlers
  const handleModalClose = useCallback(() => {
    setIsModalOpen(false);
    setSelectedCard(null);
    setIsModalLoading(false);
  }, []);

  const handleCardSave = useCallback(async (updatedCard: Partial<any>) => {
    if (!databaseService || !updatedCard.id) return;

    try {
      setIsModalLoading(true);

      // Build dynamic SQL update query
      const updates: string[] = [];
      const params: any[] = [];

      if (updatedCard.name !== undefined) {
        updates.push('name = ?');
        params.push(updatedCard.name);
      }
      if (updatedCard.folder !== undefined) {
        updates.push('folder = ?');
        params.push(updatedCard.folder);
      }
      if (updatedCard.status !== undefined) {
        updates.push('status = ?');
        params.push(updatedCard.status);
      }
      if (updatedCard.summary !== undefined) {
        updates.push('summary = ?');
        params.push(updatedCard.summary);
      }
      if (updatedCard.priority !== undefined) {
        updates.push('priority = ?');
        params.push(updatedCard.priority);
      }
      if (updatedCard.importance !== undefined) {
        updates.push('importance = ?');
        params.push(updatedCard.importance);
      }

      if (updates.length > 0) {
        updates.push('modified_at = datetime(\'now\')');
        params.push(updatedCard.id);

        const sql = `UPDATE nodes SET ${updates.join(', ')} WHERE id = ?`;
        databaseService.run(sql, params);

        // Refresh grid to show changes
        superGrid?.refresh();

        // Update stats
        const stats = superGrid?.getStats();
        contextLogger.metrics('Card updated', { cardId: updatedCard.id, stats });
      }

      handleModalClose();

    } catch (error) {
      console.error('Card save error:', error);
    } finally {
      setIsModalLoading(false);
    }
  }, [databaseService, superGrid, handleModalClose]);

  const handleCardDelete = useCallback(async (cardId: string) => {
    if (!databaseService) return;

    try {
      setIsModalLoading(true);

      // Soft delete
      databaseService.run('UPDATE nodes SET deleted_at = datetime(\'now\') WHERE id = ?', [cardId]);

      // Refresh grid
      superGrid?.refresh();

      // Update stats
      const stats = superGrid?.getStats();
      contextLogger.metrics('Card deleted', { cardId, stats });

      handleModalClose();

    } catch (error) {
      console.error('Card delete error:', error);
    } finally {
      setIsModalLoading(false);
    }
  }, [databaseService, superGrid, handleModalClose]);

  // ViewContinuum callbacks
  const viewContinuumCallbacks: ViewContinuumCallbacks = {
    onViewChange: (event) => {
      contextLogger.metrics('SuperGridDemo: View change event', { event: JSON.stringify(event) });
      setCurrentView(event.toView);
    },
    onSelectionChange: (selectedIds, _focusedId) => {
      setSelectedCards(selectedIds);
      setShowBulkActions(selectedIds.length > 0);
    },
    onCardClick: (card) => {
      setSelectedCard(card);
      setIsModalOpen(true);
    }
  };

  // Initialize ViewContinuum when database service is ready
  useEffect(() => {
    if (!svgRef.current || !databaseService) return;

    contextLogger.setup('SuperGridDemo: Initializing ViewContinuum', {});

    // Initialize ViewContinuum
    const continuum = new ViewContinuum(
      svgRef.current,
      canvasId,
      viewContinuumCallbacks
    );

    // Create and register view renderers
    const superGridRenderer = new SuperGrid(
      svgRef.current,
      databaseService,
      {
        columnsPerRow: 4,
        enableHeaders: true,
        enableSelection: true,
        enableKeyboardNavigation: true
      },
      {
        onCardClick: handleCardClick,
        onSelectionChange: handleSelectionChange,
        onBulkOperation: handleBulkOperation,
        onHeaderClick: handleHeaderClick
      }
    );

    const listViewRenderer = new ListView(svgRef.current);
    const kanbanViewRenderer = new KanbanView(svgRef.current);

    // Create adapter for SuperGrid to implement ViewRenderer interface
    const superGridAdapter = {
      render: (cards: any[], _axisMapping: any, activeFilters: any[]) => {
        // Update SuperGrid data and re-render
        superGridRenderer.updateCards(cards);
        superGridRenderer.render(activeFilters);
      },
      getCardPositions: () => superGridRenderer.getCardPositions(),
      scrollToCard: (cardId: string) => superGridRenderer.scrollToCard(cardId),
      destroy: () => superGridRenderer.destroy()
    };

    // Register view renderers with ViewContinuum
    continuum.registerViewRenderer(ViewType.SUPERGRID, superGridAdapter);
    continuum.registerViewRenderer(ViewType.LIST, listViewRenderer);
    continuum.registerViewRenderer(ViewType.KANBAN, kanbanViewRenderer);

    setViewContinuum(continuum);
    setSuperGrid(superGridRenderer); // Keep for compatibility with Janus controls

    // Switch to current view
    continuum.switchToView(currentView, 'programmatic', false);

    // Load initial data with compiled filters
    contextLogger.setup('SuperGridDemo: Loading initial data', {});
    const filterCompilation = filterService.compileToSQL();

    // Query via ViewContinuum instead of direct SuperGrid
    // TODO: Replace with continuum.queryAndCache when DatabaseService is integrated
    superGridRenderer.query(filterCompilation);

    // Sync component state with SuperGrid's zoom/pan levels (only for SuperGrid view)
    setTimeout(() => {
      if (currentView === ViewType.SUPERGRID) {
        const currentZoom = superGridRenderer.getCurrentZoomLevel();
        const currentPan = superGridRenderer.getCurrentPanLevel();
        setCurrentZoomLevel(currentZoom);
        setCurrentPanLevel(currentPan);
      }
    }, 100);

    return () => {
      continuum.destroy();
      setViewContinuum(null);
      setSuperGrid(null);
    };
  }, [databaseService, canvasId, currentView, viewContinuumCallbacks, handleCardClick, handleSelectionChange, handleBulkOperation, handleHeaderClick, filterService]);

  // Apply LATCH filters to grid
  useEffect(() => {
    if (!superGrid || !filterService) return;

    contextLogger.state('SuperGridDemo: Compiling and applying filters', { activeFilterCount: activeFilters.length });
    const filterCompilation = filterService.compileToSQL();
    contextLogger.data('SuperGridDemo: Filter compilation result', {
      whereClause: filterCompilation.whereClause,
      parameterCount: filterCompilation.parameters.length,
      isEmpty: filterCompilation.isEmpty
    });

    superGrid.query(filterCompilation);
  }, [superGrid, activeFilters, filterService]);

  // Handle PAFV state changes
  useEffect(() => {
    if (!superGrid || !pafvState) return;

    contextLogger.state('SuperGridDemo: PAFV state changed', { pafvState: JSON.stringify(pafvState) });
    // Future: Apply PAFV axis mappings to grid layout
  }, [superGrid, pafvState]);

  const handleFilterFromHeader = useCallback((headerValue: string, facet: string) => {
    // Map facet to LATCH axis
    const facetToAxisMap: Record<string, 'L' | 'A' | 'T' | 'C' | 'H'> = {
      'status': 'C',
      'folder': 'C',
      'priority': 'H',
      'name': 'A',
      'created_at': 'T'
    };

    const axis = facetToAxisMap[facet] || 'C'; // Default to Category

    // Add filter using LATCHFilterService
    const filterId = filterService.addFilter(
      axis,
      facet,
      'equals',
      headerValue,
      `${facet}: ${headerValue}`
    );
    contextLogger.state('SuperGridDemo: Quick filter added', { filterId, axis, facet, value: headerValue });
  }, [filterService]);

  // Zoom/Pan control handlers
  const handleZoomLevelChange = useCallback((level: ZoomLevel) => {
    contextLogger.state('SuperGridDemo: Zoom level changed to', { level });
    setCurrentZoomLevel(level);
    if (superGrid) {
      superGrid.setZoomLevel(level);
    }
  }, [superGrid]);

  const handlePanLevelChange = useCallback((level: PanLevel) => {
    contextLogger.state('SuperGridDemo: Pan level changed to', { level });
    setCurrentPanLevel(level);
    if (superGrid) {
      superGrid.setPanLevel(level);
    }
  }, [superGrid]);

  const handleResetZoomPan = useCallback(() => {
    contextLogger.state('SuperGridDemo: Resetting zoom/pan to defaults', {});
    setCurrentZoomLevel('leaf');
    setCurrentPanLevel('dense');
    if (superGrid) {
      superGrid.resetZoomPan();
    }
  }, [superGrid]);

  // Show loading state if database service is not ready
  if (!databaseService.isReady()) {
    return (
      <div className="h-full bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading database service...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col bg-gray-50">
      {/* SQLite Debug Console */}
      <div className="flex-none p-4 bg-white border-b border-gray-200">
        <SQLiteDebugConsole />
      </div>

      {/* Header with filter controls */}
      <div className="flex-none p-4 bg-white border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Grid Continuum Demo</h2>
            <p className="text-sm text-gray-600">
              {selectedCards.length > 0
                ? `${selectedCards.length} card${selectedCards.length > 1 ? 's' : ''} selected`
                : 'Switch views and see seamless data projection transitions'
              }
            </p>
          </div>

          {/* View Switcher */}
          <ViewSwitcher
            currentView={currentView}
            onViewChange={async (newView) => {
              contextLogger.metrics('SuperGridDemo: View switch requested', { from: currentView, to: newView });
              if (viewContinuum) {
                await viewContinuum.switchToView(newView, 'user', true);
              }
            }}
            className="ml-4"
          />

          {/* Bulk action controls */}
          {showBulkActions && (
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-500">
                {selectedCards.length} selected:
              </span>
              <button
                onClick={() => handleBulkStatusUpdate(selectedCards, 'active')}
                className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                disabled={isModalLoading}
              >
                Mark Active
              </button>
              <button
                onClick={() => handleBulkStatusUpdate(selectedCards, 'completed')}
                className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                disabled={isModalLoading}
              >
                Mark Complete
              </button>
              <button
                onClick={() => handleBulkFolderMove(selectedCards, 'archive')}
                className="px-3 py-1 text-sm bg-yellow-600 text-white rounded hover:bg-yellow-700"
                disabled={isModalLoading}
              >
                Archive
              </button>
              <button
                onClick={() => handleBulkDelete(selectedCards)}
                className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700"
                disabled={isModalLoading}
              >
                Delete
              </button>
            </div>
          )}
        </div>

        {/* Active filters */}
        {activeFilters.length > 0 && (
          <div className="flex items-center space-x-2 mb-4">
            <span className="text-sm text-gray-500">Active filters:</span>
            <div className="flex flex-wrap gap-2">
              {activeFilters.map(filter => (
                <FilterChip
                  key={filter.id}
                  filter={filter}
                  onRemove={() => handleFilterRemove(filter.id)}
                />
              ))}
            </div>
            {activeFilters.length > 1 && (
              <button
                onClick={handleClearAllFilters}
                className="text-sm text-gray-500 hover:text-gray-700 underline"
              >
                Clear all
              </button>
            )}
          </div>
        )}

        {/* Quick filter buttons */}
        <div className="flex items-center space-x-2 mb-4">
          <span className="text-sm text-gray-500">Quick filters:</span>
          <button
            onClick={() => handleFilterFromHeader('active', 'status')}
            className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50"
          >
            Active Items
          </button>
          <button
            onClick={() => handleFilterFromHeader('work', 'folder')}
            className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50"
          >
            Work Items
          </button>
          <button
            onClick={() => handleFilterFromHeader('5', 'priority')}
            className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50"
          >
            High Priority
          </button>
        </div>

        {/* Janus Zoom/Pan Controls (SuperGrid only) */}
        {currentView === ViewType.SUPERGRID && (
        <div className="flex items-center justify-between">
          {/* Zoom Level Control (Value Density) */}
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-500">Zoom Level:</span>
            <div className="flex border border-gray-300 rounded overflow-hidden">
              <button
                onClick={() => handleZoomLevelChange('leaf')}
                className={`px-3 py-1 text-sm ${
                  currentZoomLevel === 'leaf'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                Leaf (Jan, Feb, Mar)
              </button>
              <button
                onClick={() => handleZoomLevelChange('collapsed')}
                className={`px-3 py-1 text-sm border-l ${
                  currentZoomLevel === 'collapsed'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                Collapsed (Q1)
              </button>
            </div>
          </div>

          {/* Pan Level Control (Extent Density) */}
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-500">Pan Level:</span>
            <div className="flex border border-gray-300 rounded overflow-hidden">
              <button
                onClick={() => handlePanLevelChange('dense')}
                className={`px-3 py-1 text-sm ${
                  currentPanLevel === 'dense'
                    ? 'bg-green-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                Dense (Populated Only)
              </button>
              <button
                onClick={() => handlePanLevelChange('sparse')}
                className={`px-3 py-1 text-sm border-l ${
                  currentPanLevel === 'sparse'
                    ? 'bg-green-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                Sparse (Full Cartesian)
              </button>
            </div>
          </div>

          {/* Reset Control */}
          <button
            onClick={handleResetZoomPan}
            className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 text-gray-700"
          >
            Reset View
          </button>
        </div>
        )}
      </div>

      {/* Grid container */}
      <div className="flex-1 overflow-hidden">
        <svg
          ref={svgRef}
          className="w-full h-full"
          style={{ backgroundColor: '#fafafa' }}
          tabIndex={0} // Enable keyboard focus
        />
      </div>

      {/* Keyboard shortcuts help */}
      <div className="flex-none p-2 bg-gray-100 text-xs text-gray-600">
        <span className="font-medium">Keyboard shortcuts:</span>
        <span className="mx-2">⌘1: List View</span>
        <span className="mx-2">⌘2: Kanban</span>
        <span className="mx-2">⌘3: SuperGrid</span>
        <span className="mx-2">Space/Enter: Select</span>
        <span className="mx-2">Escape: Clear selection</span>
        <span className="mx-2">Arrow keys: Navigate</span>
      </div>

      {/* Card detail modal */}
      <CardDetailModal
        card={selectedCard}
        isOpen={isModalOpen}
        isLoading={isModalLoading}
        onClose={handleModalClose}
        onSave={handleCardSave}
        onDelete={handleCardDelete}
      />
    </div>
  );
}