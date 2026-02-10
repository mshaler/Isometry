import { useEffect, useState, useRef } from 'react';
import { SuperGrid } from '../d3/SuperGrid';
import { ListView } from '../d3/ListView';
import { KanbanView } from '../d3/KanbanView';
import { ViewContinuum } from '../d3/ViewContinuum';
import { ViewSwitcher, useViewSwitcher } from './ViewSwitcher';
import { ViewType } from '../types/views';
import { CardDetailModal } from './CardDetailModal';
import { useDatabaseService, usePAFV } from '@/hooks';
import { LATCHFilterService } from '../services/LATCHFilterService';
import type { LATCHFilter } from '../services/LATCHFilterService';
import { SQLiteDebugConsole } from './SQLiteDebugConsole';
import type { ZoomLevel, PanLevel } from '../d3/SuperGridZoom';
import { contextLogger } from '../utils/logging/dev-logger';
import { useSuperGridDemoHandlers } from './supergrid-demo/handlers';
import { FilterChip } from './supergrid-demo/FilterChip';

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

  // Core component references
  const [superGrid, setSuperGrid] = useState<SuperGrid | null>(null);
  const [viewContinuum, setViewContinuum] = useState<ViewContinuum | null>(null);
  const [selectedCard, setSelectedCard] = useState<CardData | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isModalLoading, setIsModalLoading] = useState(false);
  const [activeFilters, setActiveFilters] = useState<LATCHFilter[]>([]);
  const [selectedCards, setSelectedCards] = useState<string[]>([]);
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [filterService] = useState(() => new LATCHFilterService());

  // Zoom/pan state
  const [currentZoomLevel, setCurrentZoomLevel] = useState<ZoomLevel>('leaf');
  const [currentPanLevel, setCurrentPanLevel] = useState<PanLevel>('dense');

  // Refs
  const svgRef = useRef<SVGSVGElement>(null);

  // Context hooks
  const databaseService = useDatabaseService();
  const { state: pafvState } = usePAFV();

  // Get all handlers from the custom hook
  const handlers = useSuperGridDemoHandlers({
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
  });

  // Set up filter change listener
  useEffect(() => {
    const unsubscribe = filterService.onFilterChange((filters) => {
      setActiveFilters(filters);
    });
    setActiveFilters(filterService.getActiveFilters());
    return unsubscribe;
  }, [filterService]);

  // Initialize ViewContinuum and SuperGrid
  useEffect(() => {
    if (!svgRef.current || !databaseService) return;

    contextLogger.setup('SuperGridDemo: Initializing view continuum and SuperGrid');

    // Create ViewContinuum
    const continuum = new ViewContinuum(
      svgRef.current,
      canvasId,
      {
        onViewChange: (event) => setCurrentView(event.toView),
        onSelectionChange: handlers.handleSelectionChange,
        onCardClick: handlers.handleCardClick
      }
    );

    // Create SuperGrid with advanced features
    const superGridRenderer = new SuperGrid(
      svgRef.current,
      databaseService,
      {
        columnsPerRow: 4,
        enableHeaders: true,
        enableSelection: true,
        enableKeyboardNavigation: true,
        enableColumnResizing: true
      },
      {
        onCardClick: handlers.handleCardClick,
        onSelectionChange: handlers.handleSelectionChange,
        onBulkOperation: handlers.handleBulkOperation,
        onHeaderClick: handlers.handleHeaderClick
      }
    );

    // Register renderers
    continuum.registerViewRenderer(ViewType.LIST, new ListView(svgRef.current));
    continuum.registerViewRenderer(ViewType.KANBAN, new KanbanView(svgRef.current));
    continuum.registerViewRenderer(ViewType.SUPERGRID, superGridRenderer);

    continuum.switchToView(currentView, 'programmatic', false);

    setSuperGrid(superGridRenderer);
    setViewContinuum(continuum);

    // Load initial data
    const filterCompilation = filterService.compileToSQL();
    superGridRenderer.query(filterCompilation);

    return () => {
      continuum.destroy();
      setViewContinuum(null);
      setSuperGrid(null);
    };
  }, [
    databaseService,
    canvasId,
    currentView,
    setCurrentView,
    handlers.handleSelectionChange,
    handlers.handleCardClick,
    handlers.handleBulkOperation,
    handlers.handleHeaderClick,
    filterService
  ]);

  // Apply filters when they change
  useEffect(() => {
    if (!superGrid || !filterService) return;
    const filterCompilation = filterService.compileToSQL();
    superGrid.query(filterCompilation);
  }, [superGrid, activeFilters, filterService]);

  // Show loading state
  if (!databaseService.isReady()) {
    return (
      <div className="h-full bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading SuperGrid Demo...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="flex-none bg-white border-b border-gray-200 p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">SuperGrid Demo</h1>
            <p className="text-sm text-gray-600 mt-1">
              Advanced grid with multi-select, filtering, and bulk operations
            </p>
          </div>
          <ViewSwitcher
            currentView={currentView}
            onViewChange={async (newView) => {
              if (viewContinuum) {
                await viewContinuum.switchToView(newView, 'user', true);
              }
            }}
          />
        </div>

        {/* Active Filters */}
        {activeFilters.length > 0 && (
          <div className="flex items-center space-x-2 mb-4">
            <span className="text-sm text-gray-500">Active filters:</span>
            <div className="flex flex-wrap gap-2">
              {activeFilters.map(filter => (
                <FilterChip
                  key={filter.id}
                  filter={filter}
                  onRemove={() => handlers.handleFilterRemove(filter.id)}
                />
              ))}
            </div>
            {activeFilters.length > 1 && (
              <button
                onClick={handlers.handleClearAllFilters}
                className="text-sm text-gray-500 hover:text-gray-700 underline"
              >
                Clear all
              </button>
            )}
          </div>
        )}

        {/* Bulk Actions */}
        {showBulkActions && (
          <div className="flex items-center space-x-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <span className="text-sm text-blue-800 font-medium">
              {selectedCards.length} card{selectedCards.length > 1 ? 's' : ''} selected
            </span>
            <button
              onClick={() => handlers.handleBulkOperation('delete', selectedCards)}
              className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700"
            >
              Delete
            </button>
            <button
              onClick={() => handlers.handleBulkOperation('status-todo', selectedCards)}
              className="px-3 py-1 text-sm bg-gray-600 text-white rounded hover:bg-gray-700"
            >
              Mark as Todo
            </button>
            <button
              onClick={() => handlers.handleBulkOperation('status-done', selectedCards)}
              className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
            >
              Mark as Done
            </button>
          </div>
        )}

        {/* Zoom/Pan Controls */}
        {currentView === ViewType.SUPERGRID && (
          <div className="flex items-center space-x-4 mt-4 p-3 bg-gray-50 border border-gray-200 rounded-lg">
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-700 font-medium">Zoom:</span>
              <button
                onClick={() => handlers.handleZoomLevelChange('leaf')}
                className={`px-2 py-1 text-sm rounded ${
                  currentZoomLevel === 'leaf'
                    ? 'bg-blue-600 text-white'
                    : 'border border-gray-300 hover:bg-gray-50 text-gray-700'
                }`}
              >
                Leaf Values
              </button>
              <button
                onClick={() => handlers.handleZoomLevelChange('collapsed')}
                className={`px-2 py-1 text-sm rounded ${
                  currentZoomLevel === 'collapsed'
                    ? 'bg-blue-600 text-white'
                    : 'border border-gray-300 hover:bg-gray-50 text-gray-700'
                }`}
              >
                Collapsed
              </button>
            </div>

            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-700 font-medium">Pan:</span>
              <button
                onClick={() => handlers.handlePanLevelChange('dense')}
                className={`px-2 py-1 text-sm rounded ${
                  currentPanLevel === 'dense'
                    ? 'bg-purple-600 text-white'
                    : 'border border-gray-300 hover:bg-gray-50 text-gray-700'
                }`}
              >
                Dense (Populated Only)
              </button>
              <button
                onClick={() => handlers.handlePanLevelChange('sparse')}
                className={`px-2 py-1 text-sm rounded ${
                  currentPanLevel === 'sparse'
                    ? 'bg-purple-600 text-white'
                    : 'border border-gray-300 hover:bg-gray-50 text-gray-700'
                }`}
              >
                Sparse (Full Cartesian)
              </button>
            </div>

            <button
              onClick={handlers.handleResetZoomPan}
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
          tabIndex={0}
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
        onClose={handlers.handleModalClose}
        onSave={handlers.handleCardSave}
        onDelete={handlers.handleCardDelete}
      />

      {/* Debug Console */}
      <SQLiteDebugConsole />
    </div>
  );
}