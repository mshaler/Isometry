/**
 * SuperGrid Integration Demo - Comprehensive Feature Showcase
 *
 * This demo showcases all SuperGrid features working together harmoniously:
 * - SuperStack (Progressive disclosure), SuperDynamic (Axis repositioning)
 * - Janus Density (Pan × Zoom), SuperZoom (Cartographic navigation)
 * - Core SuperGrid with multi-select, drag & drop, filtering, and modal
 *
 * @module demos/SuperGridIntegrationDemo
 */

import { useState, useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { SuperGrid } from '../d3/SuperGrid';
import { ViewContinuum } from '../d3/ViewContinuum';
import type { ViewRenderer } from '../d3/viewcontinuum/types';
import type { CardPosition } from '../types/views';
import { useViewSwitcher } from '../components/ViewSwitcher';
import { ViewType } from '../types/views';
import { CardDetailModal } from '../components/CardDetailModal';
import { useDatabaseService } from '@/hooks';
import { usePAFV } from '../hooks/data/usePAFV';
import { LATCHFilterService } from '../services/query/LATCHFilterService';
import { contextLogger } from '../utils/logging/dev-logger';
import { usePerformanceTracking } from './performance';
import { useDemoCallbacks } from './callbacks';
import { DemoHeader } from './components/DemoHeader';
import { DemoFooter } from './components/DemoFooter';
import type { LATCHFilter } from '../services/query/LATCHFilterService';
import type { ZoomLevel, PanLevel } from '../d3/SuperGridZoom';
import type { ProgressiveDisclosureState, JanusDensityState } from '../types/supergrid';
import type { ViewAxisMapping } from '../types/views';

/**
 * SuperGrid Integration Demo - All Features Working Together
 *
 * This component demonstrates the complete SuperGrid feature set in a unified
 * interface, showing how all Super* features integrate seamlessly.
 */
export function SuperGridIntegrationDemo() {
  // Core SuperGrid state
  const canvasId = 'supergrid-integration-demo';
  const { currentView, setCurrentView } = useViewSwitcher(canvasId, ViewType.SUPERGRID);
  const [superGrid, setSuperGrid] = useState<SuperGrid | null>(null);
  const [viewContinuum, setViewContinuum] = useState<ViewContinuum | null>(null);

  // Modal state
  const [selectedCard, setSelectedCard] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isModalLoading, setIsModalLoading] = useState(false);

  // Selection and filtering state
  const [selectedCards, setSelectedCards] = useState<string[]>([]);
  const [_showBulkActions, setShowBulkActions] = useState(false);
  const [activeFilters, setActiveFilters] = useState<LATCHFilter[]>([]);
  const [filterService] = useState(() => new LATCHFilterService());

  // SuperStack (Progressive Disclosure) state
  const [progressiveState, setProgressiveState] = useState<ProgressiveDisclosureState>({
    currentLevels: [0, 1, 2],
    availableLevelGroups: [],
    activeLevelTab: 0,
    zoomLevel: 0,
    isTransitioning: false,
    lastTransitionTime: 0
  });

  // SuperDynamic (Axis Repositioning) state
  const [axisMapping, setAxisMapping] = useState<ViewAxisMapping>({
    xAxis: {
      latchDimension: 'C',
      facet: 'folder',
      label: 'Category → Folder'
    },
    yAxis: {
      latchDimension: 'T',
      facet: 'created_at',
      label: 'Time → Created'
    },
    zAxis: {
      latchDimension: 'H',
      facet: 'priority',
      label: 'Hierarchy → Priority',
      depth: 5
    }
  });
  const [isDragInProgress, setIsDragInProgress] = useState(false);

  // Janus Density state
  const [janusState, setJanusState] = useState<JanusDensityState>({
    valueDensity: 'leaf',
    extentDensity: 'populated-only',
    viewDensity: 'spreadsheet',
    regionConfig: [],
    axisGranularity: {},
    aggregationPreferences: {
      defaultFunction: 'count',
      facetAggregations: {},
      preservePrecision: true,
      showAggregationSource: true
    }
  });

  // SuperZoom (Cartographic) state
  const [_zoomLevel, setZoomLevel] = useState<ZoomLevel>('leaf');
  const [_panLevel, setPanLevel] = useState<PanLevel>('dense');
  const [zoomTransform, setZoomTransform] = useState({ x: 0, y: 0, k: 1 });

  // Refs
  const svgRef = useRef<SVGSVGElement>(null);

  // Context hooks
  const databaseService = useDatabaseService();
  const { state: _pafvState } = usePAFV();

  // Performance tracking
  const { performanceMetrics, trackFeatureUsage, updateFrameRate, updateRenderTime } = usePerformanceTracking();

  // Demo callbacks
  const callbacks = useDemoCallbacks({
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
  });

  // Set up filter service listener
  useEffect(() => {
    const unsubscribe = filterService.onFilterChange((filters) => {
      setActiveFilters(filters);
    });
    setActiveFilters(filterService.getActiveFilters());
    return unsubscribe;
  }, [filterService]);

  // Initialize SuperGrid and ViewContinuum
  useEffect(() => {
    if (!svgRef.current || !databaseService) return;

    contextLogger.setup('SuperGridIntegrationDemo: Initializing complete system');

    // Initialize ViewContinuum
    const continuum = new ViewContinuum(
      svgRef.current,
      canvasId,
      {
        onViewChange: (event) => setCurrentView(event.toView),
        onSelectionChange: callbacks.handleSelectionChange,
        onCardClick: callbacks.handleCardClick
      }
    );

    // Create SuperGrid with all features enabled
    const superGridRenderer = new SuperGrid(
      d3.select(svgRef.current) as unknown as d3.Selection<SVGElement, unknown, null, undefined>,
      databaseService,
      {
        columnsPerRow: 4,
        enableHeaders: true,
        enableSelection: true,
        enableKeyboardNavigation: true,
        enableColumnResizing: true,
        enableProgressiveDisclosure: true,
        enableCartographicZoom: true,
        onCardClick: callbacks.handleCardClick,
        onSelectionChange: callbacks.handleSelectionChange,
        onBulkOperation: callbacks.handleBulkOperation,
        onHeaderClick: callbacks.handleHeaderClick
      } as any
    );

    // Create adapter for SuperGrid
    const superGridAdapter: ViewRenderer = {
      render: (cards, _axisMapping, activeFilters) => {
        const start = performance.now();
        superGridRenderer.updateCards(cards);
        superGridRenderer.render(activeFilters);
        const duration = performance.now() - start;
        updateRenderTime(duration);
        updateFrameRate(Math.min(60, 1000 / duration));
      },
      getCardPositions: () => superGridRenderer.getCardPositions() as unknown as Map<string, CardPosition>,
      scrollToCard: (cardId: string) => superGridRenderer.scrollToCard(cardId),
      destroy: () => superGridRenderer.destroy()
    };

    continuum.registerViewRenderer(ViewType.SUPERGRID, superGridAdapter);
    continuum.switchToView(currentView, 'programmatic', false);

    setSuperGrid(superGridRenderer);
    setViewContinuum(continuum);

    // Load initial data
    const filterCompilation = filterService.compileToSQL();
    superGridRenderer.query(filterCompilation);

    return () => {
      // ViewContinuum does not have a destroy method; clean up references
      setViewContinuum(null);
      setSuperGrid(null);
    };
  }, [
    databaseService,
    canvasId,
    currentView,
    callbacks.handleCardClick,
    callbacks.handleSelectionChange,
    callbacks.handleBulkOperation,
    callbacks.handleHeaderClick,
    filterService,
    updateFrameRate
  ]);

  // Apply filters to grid
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
          <p className="text-gray-600">Loading SuperGrid Integration Demo...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col bg-gray-50">
      {/* Header with comprehensive controls */}
      <DemoHeader
        selectedCardsCount={selectedCards.length}
        performanceMetrics={performanceMetrics}
        progressiveState={progressiveState}
        axisMapping={axisMapping}
        isDragInProgress={isDragInProgress}
        janusState={janusState}
        zoomTransform={zoomTransform}
        activeFilters={activeFilters}
        currentView={currentView}
        onLevelTabChange={callbacks.handleLevelTabChange}
        onZoomLevelChange={callbacks.handleZoomLevelChange}
        onAxisRepositioning={callbacks.handleAxisRepositioning}
        onValueDensityChange={callbacks.handleValueDensityChange}
        onExtentDensityChange={callbacks.handleExtentDensityChange}
        onCartographicZoom={callbacks.handleCartographicZoom}
        onFilterRemove={callbacks.handleFilterRemove}
        onClearAllFilters={callbacks.handleClearAllFilters}
        onViewChange={async (newView) => {
          trackFeatureUsage('view-switch', { from: currentView, to: newView });
          if (viewContinuum) {
            await viewContinuum.switchToView(newView, 'user', true);
          }
        }}
        trackFeatureUsage={trackFeatureUsage}
      />

      {/* Main Grid Canvas */}
      <div className="flex-1 overflow-hidden">
        <svg
          ref={svgRef}
          className="w-full h-full"
          style={{ backgroundColor: '#fafafa' }}
          tabIndex={0}
        />
      </div>

      {/* Feature Status Footer */}
      <DemoFooter
        superGrid={superGrid}
        progressiveState={progressiveState}
        isDragInProgress={isDragInProgress}
        janusState={janusState}
        zoomTransform={zoomTransform}
        performanceMetrics={performanceMetrics}
      />

      {/* Card Detail Modal */}
      <CardDetailModal
        card={selectedCard}
        isOpen={isModalOpen}
        isLoading={isModalLoading}
        onClose={() => {
          trackFeatureUsage('modal-close');
          setIsModalOpen(false);
          setSelectedCard(null);
          setIsModalLoading(false);
        }}
        onSave={async (updatedCard) => {
          trackFeatureUsage('card-save', { cardId: updatedCard.id });
          // Implementation would go here
          setIsModalOpen(false);
        }}
        onDelete={async (cardId) => {
          trackFeatureUsage('card-delete', { cardId });
          // Implementation would go here
          setIsModalOpen(false);
        }}
      />
    </div>
  );
}