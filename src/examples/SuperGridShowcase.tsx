/**
 * SuperGrid Showcase - Production-Ready Feature Demonstration
 *
 * This component provides a polished, production-ready demonstration of all
 * SuperGrid capabilities integrated seamlessly for real-world usage scenarios.
 *
 * Key Features Demonstrated:
 * - Unified feature integration with contextual help
 * - Performance monitoring with real-time feedback
 * - Sample data that effectively shows grid capabilities
 * - Onboarding flow for new users
 * - Export capabilities for demonstrations
 *
 * @module examples/SuperGridShowcase
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { SuperGrid } from '../d3/SuperGrid';
import { ViewContinuum } from '../d3/ViewContinuum';
import { ViewSwitcher, useViewSwitcher } from '../components/ViewSwitcher';
import { ViewType } from '../types/views';
import { CardDetailModal } from '../components/CardDetailModal';
import { useDatabaseService } from '@/hooks';
import { LATCHFilterService } from '../services/LATCHFilterService';
import type { LATCHFilter } from '../services/LATCHFilterService';
import type { ZoomLevel, PanLevel } from '../d3/SuperGridZoom';
import { contextLogger } from '../utils/logging/dev-logger';

// Sample data that demonstrates SuperGrid capabilities effectively
const DEMO_SCENARIOS = [
  {
    id: 'project-management',
    name: 'Project Management',
    description: 'Task tracking across teams, priorities, and timelines',
    data: {
      nodes: Array.from({ length: 120 }, (_, i) => ({
        id: `task-${i + 1}`,
        name: `Task ${i + 1}: ${['Setup Database', 'Design UI', 'Write Tests', 'Deploy', 'Review Code', 'Fix Bugs', 'Document', 'Optimize'][i % 8]}`,
        folder: ['Development', 'Design', 'QA', 'DevOps', 'Documentation'][i % 5],
        status: ['Active', 'Complete', 'Pending', 'Blocked', 'Review'][i % 5],
        priority: Math.floor(i / 20) + 1,
        importance: (i % 3) + 1,
        created_at: new Date(2024, (i % 12), (i % 28) + 1).toISOString(),
        modified_at: new Date(2024, ((i + 2) % 12), (i % 28) + 1).toISOString(),
        due_at: new Date(2024, ((i + 4) % 12), (i % 28) + 1).toISOString(),
        assignee: ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve'][i % 5],
        tags: ['urgent', 'backend', 'frontend', 'mobile', 'api'][i % 5],
        location: 'Office'
      }))
    }
  },
  {
    id: 'research-analysis',
    name: 'Research & Analysis',
    description: 'Academic papers, citations, and research topics',
    data: {
      nodes: Array.from({ length: 80 }, (_, i) => ({
        id: `paper-${i + 1}`,
        name: `Research Paper ${i + 1}: ${['Machine Learning', 'Data Science', 'AI Ethics', 'Quantum Computing', 'Blockchain'][i % 5]}`,
        folder: ['Computer Science', 'Mathematics', 'Physics', 'Biology', 'Psychology'][i % 5],
        status: ['Published', 'Under Review', 'Draft', 'Accepted'][i % 4],
        priority: Math.floor(i / 16) + 1,
        importance: (i % 5) + 1,
        created_at: new Date(2023, (i % 12), (i % 28) + 1).toISOString(),
        modified_at: new Date(2024, (i % 12), (i % 28) + 1).toISOString(),
        author: ['Dr. Smith', 'Dr. Johnson', 'Dr. Williams', 'Dr. Brown'][i % 4],
        citations: Math.floor(Math.random() * 100),
        journal: ['Nature', 'Science', 'Cell', 'PNAS', 'IEEE'][i % 5],
        location: 'Library'
      }))
    }
  },
  {
    id: 'inventory-management',
    name: 'Inventory Management',
    description: 'Product catalog with categories, suppliers, and stock levels',
    data: {
      nodes: Array.from({ length: 200 }, (_, i) => ({
        id: `product-${i + 1}`,
        name: `Product ${i + 1}: ${['Laptop', 'Mouse', 'Keyboard', 'Monitor', 'Printer', 'Tablet', 'Phone'][i % 7]}`,
        folder: ['Electronics', 'Office Supplies', 'Accessories', 'Furniture'][i % 4],
        status: ['In Stock', 'Low Stock', 'Out of Stock', 'Discontinued'][i % 4],
        priority: Math.floor(i / 40) + 1,
        importance: (i % 4) + 1,
        created_at: new Date(2023, (i % 12), (i % 28) + 1).toISOString(),
        modified_at: new Date(2024, (i % 12), (i % 28) + 1).toISOString(),
        supplier: ['TechCorp', 'OfficeMax', 'GlobalSupply', 'DirectSource'][i % 4],
        stock_level: Math.floor(Math.random() * 1000),
        price: (Math.random() * 1000).toFixed(2),
        location: ['Warehouse A', 'Warehouse B', 'Store Front'][i % 3]
      }))
    }
  }
];

interface FeatureGuide {
  id: string;
  title: string;
  description: string;
  steps: string[];
  demoAction?: () => void;
}

interface ShowcaseProps {
  /** Enable onboarding mode for new users */
  showOnboarding?: boolean;
  /** Initial scenario to load */
  initialScenario?: string;
  /** Enable export functionality */
  enableExport?: boolean;
  /** Callback when user completes showcase */
  onComplete?: () => void;
}

/**
 * SuperGrid Showcase - Complete feature demonstration with guided experience
 */
export function SuperGridShowcase({
  showOnboarding = true,
  initialScenario = 'project-management',
  enableExport = true,
  onComplete
}: ShowcaseProps) {
  // Core state
  const canvasId = 'supergrid-showcase';
  const { currentView, setCurrentView } = useViewSwitcher(canvasId, ViewType.SUPERGRID);
  const [superGrid, setSuperGrid] = useState<SuperGrid | null>(null);
  const [viewContinuum, setViewContinuum] = useState<ViewContinuum | null>(null);

  // Demo state
  const [currentScenario, setCurrentScenario] = useState(initialScenario);
  const [isOnboardingActive, setIsOnboardingActive] = useState(showOnboarding);
  const [currentGuideStep, setCurrentGuideStep] = useState(0);
  const [isGuidedMode, setIsGuidedMode] = useState(false);

  // Feature state
  const [selectedCard, setSelectedCard] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCards, setSelectedCards] = useState<string[]>([]);
  const [activeFilters, setActiveFilters] = useState<LATCHFilter[]>([]);
  const [filterService] = useState(() => new LATCHFilterService());

  // Janus controls
  const [currentZoomLevel, setCurrentZoomLevel] = useState<ZoomLevel>('leaf');
  const [currentPanLevel, setCurrentPanLevel] = useState<PanLevel>('dense');

  // Performance tracking
  const [performanceStats, setPerformanceStats] = useState({
    renderTime: 0,
    frameRate: 60,
    featuresUsed: new Set<string>(),
    interactionCount: 0
  });

  // Refs
  const svgRef = useRef<SVGSVGElement>(null);
  const guideTimeoutRef = useRef<NodeJS.Timeout>();

  // Context hooks
  const databaseService = useDatabaseService();

  // Current scenario data
  const scenarioData = useMemo(() => {
    return DEMO_SCENARIOS.find(s => s.id === currentScenario)?.data;
  }, [currentScenario]);

  // Feature guides for onboarding
  const featureGuides: FeatureGuide[] = useMemo(() => [
    {
      id: 'basic-navigation',
      title: 'Basic Navigation',
      description: 'Learn how to navigate and interact with the SuperGrid',
      steps: [
        'Click on any card to view details',
        'Use arrow keys to navigate between cards',
        'Press Space to select/deselect cards',
        'Hold Shift and click to select multiple cards'
      ]
    },
    {
      id: 'header-filtering',
      title: 'Header Filtering',
      description: 'Filter data by clicking on column and row headers',
      steps: [
        'Click on any column header to filter by that value',
        'Click on row headers to filter by categories',
        'Use the filter chips to see active filters',
        'Clear filters by clicking the × on filter chips'
      ],
      demoAction: () => {
        // Simulate header click for demo
        const mockFilter = filterService.addFilter('C', 'folder', 'equals', 'Development', 'Folder: Development');
        contextLogger.data('Demo filter added', { mockFilter });
      }
    },
    {
      id: 'density-controls',
      title: 'Janus Density Controls',
      description: 'Control how much detail you see with independent zoom and pan controls',
      steps: [
        'Use Zoom Level to control detail (Leaf = detailed, Collapsed = summary)',
        'Use Pan Level to control empty space (Dense = hide empty, Sparse = show all)',
        'These controls work independently for maximum flexibility',
        'Try different combinations to see the effect'
      ],
      demoAction: () => {
        setCurrentZoomLevel('collapsed');
        setCurrentPanLevel('sparse');
      }
    },
    {
      id: 'view-switching',
      title: 'View Transitions',
      description: 'Switch between different data views seamlessly',
      steps: [
        'Use the view switcher to change between SuperGrid, List, and Kanban views',
        'Notice how the same data is presented differently',
        'Your selections and filters are preserved across views',
        'Each view is optimized for different use cases'
      ]
    },
    {
      id: 'bulk-operations',
      title: 'Bulk Operations',
      description: 'Perform actions on multiple cards at once',
      steps: [
        'Select multiple cards using Shift+click or keyboard navigation',
        'Bulk action buttons appear when multiple cards are selected',
        'You can update status, move folders, or delete in bulk',
        'This is powerful for managing large datasets'
      ]
    }
  ], [filterService]);

  // Performance tracking
  const trackFeature = useCallback((featureName: string) => {
    setPerformanceStats(prev => ({
      ...prev,
      featuresUsed: new Set([...prev.featuresUsed, featureName]),
      interactionCount: prev.interactionCount + 1
    }));
  }, []);

  // Event handlers
  const handleCardClick = useCallback((card: any) => {
    trackFeature('card-click');
    setSelectedCard(card);
    setIsModalOpen(true);
  }, [trackFeature]);

  const handleSelectionChange = useCallback((selectedIds: string[], _focusedId: string | null) => {
    trackFeature('selection-change');
    setSelectedCards(selectedIds);
  }, [trackFeature]);

  const handleHeaderClick = useCallback((axis: string, facet: string, value: any) => {
    trackFeature('header-filter');
    const existing = filterService.getActiveFilters().find(
      filter => filter.facet === facet && filter.value === value
    );

    if (existing) {
      filterService.removeFilter(existing.id);
    } else {
      filterService.addFilter(axis as any, facet, 'equals', value, `${facet}: ${value}`);
    }
  }, [filterService, trackFeature]);

  const handleZoomLevelChange = useCallback((level: ZoomLevel) => {
    trackFeature('zoom-level');
    setCurrentZoomLevel(level);
    if (superGrid) {
      superGrid.setZoomLevel(level);
    }
  }, [superGrid, trackFeature]);

  const handlePanLevelChange = useCallback((level: PanLevel) => {
    trackFeature('pan-level');
    setCurrentPanLevel(level);
    if (superGrid) {
      superGrid.setPanLevel(level);
    }
  }, [superGrid, trackFeature]);

  const handleScenarioChange = useCallback((scenarioId: string) => {
    trackFeature('scenario-change');
    setCurrentScenario(scenarioId);
    filterService.clearFilters();
    setSelectedCards([]);
  }, [filterService, trackFeature]);

  const handleStartGuide = useCallback((guideId: string) => {
    const guideIndex = featureGuides.findIndex(g => g.id === guideId);
    if (guideIndex >= 0) {
      setIsGuidedMode(true);
      setCurrentGuideStep(guideIndex);
    }
  }, [featureGuides]);

  const handleNextGuideStep = useCallback(() => {
    if (currentGuideStep < featureGuides.length - 1) {
      setCurrentGuideStep(currentGuideStep + 1);
      const nextGuide = featureGuides[currentGuideStep + 1];
      if (nextGuide.demoAction) {
        guideTimeoutRef.current = setTimeout(() => {
          nextGuide.demoAction!();
        }, 1000);
      }
    } else {
      setIsGuidedMode(false);
      setIsOnboardingActive(false);
      onComplete?.();
    }
  }, [currentGuideStep, featureGuides, onComplete]);

  // Set up filter listener
  useEffect(() => {
    const unsubscribe = filterService.onFilterChange(setActiveFilters);
    return unsubscribe;
  }, [filterService]);

  // Initialize SuperGrid
  useEffect(() => {
    if (!svgRef.current || !databaseService || !scenarioData) return;

    // Mock database with scenario data
    const mockDatabase = {
      exec: (query: string) => {
        if (query.includes('FROM nodes')) {
          return [{
            columns: Object.keys(scenarioData.nodes[0] || {}),
            values: scenarioData.nodes.map(node => Object.values(node))
          }];
        }
        return [];
      },
      run: () => ({ changes: 1 }),
      isReady: () => true
    } as any;

    const continuum = new ViewContinuum(
      svgRef.current,
      canvasId,
      {
        onViewChange: (event) => setCurrentView(event.toView),
        onSelectionChange: handleSelectionChange,
        onCardClick: handleCardClick
      }
    );

    const superGridRenderer = new SuperGrid(
      svgRef.current,
      mockDatabase,
      {
        columnsPerRow: 6,
        enableHeaders: true,
        enableSelection: true,
        enableKeyboardNavigation: true,
        enableColumnResizing: true
      } as any,
      {
        onCardClick: handleCardClick,
        onSelectionChange: handleSelectionChange,
        onHeaderClick: handleHeaderClick
      }
    );

    const adapter = {
      render: (cards: any[]) => {
        const start = performance.now();
        superGridRenderer.updateCards(cards);
        superGridRenderer.render([]);
        const duration = performance.now() - start;
        setPerformanceStats(prev => ({
          ...prev,
          renderTime: duration,
          frameRate: Math.min(60, 1000 / duration)
        }));
      },
      getCardPositions: () => superGridRenderer.getCardPositions(),
      scrollToCard: (cardId: string) => superGridRenderer.scrollToCard(cardId),
      destroy: () => superGridRenderer.destroy()
    };

    continuum.registerViewRenderer(ViewType.SUPERGRID, adapter);
    continuum.switchToView(ViewType.SUPERGRID, 'programmatic', false);

    setSuperGrid(superGridRenderer);
    setViewContinuum(continuum);

    // Load scenario data
    adapter.render(scenarioData.nodes);

    return () => {
      continuum.destroy();
      if (guideTimeoutRef.current) {
        clearTimeout(guideTimeoutRef.current);
      }
    };
  }, [scenarioData, databaseService, canvasId, handleCardClick, handleSelectionChange, handleHeaderClick]);

  // Show loading state
  if (!databaseService.isReady()) {
    return (
      <div className="h-full bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-gray-700 mb-2">Loading SuperGrid Showcase</h2>
          <p className="text-gray-500">Preparing interactive demonstration...</p>
        </div>
      </div>
    );
  }

  const currentGuide = featureGuides[currentGuideStep];

  return (
    <div className="w-full h-full flex flex-col bg-white">
      {/* Header */}
      <header className="flex-none bg-gradient-to-r from-blue-600 to-purple-600 text-white">
        <div className="p-6">
          <h1 className="text-3xl font-bold mb-2">SuperGrid Showcase</h1>
          <p className="text-blue-100 mb-4">
            Experience the next generation of data visualization and interaction
          </p>

          {/* Quick Stats */}
          <div className="flex items-center space-x-6 text-sm">
            <div className="flex items-center space-x-2">
              <span className="bg-white bg-opacity-20 px-2 py-1 rounded">
                {scenarioData?.nodes.length || 0} items
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="bg-white bg-opacity-20 px-2 py-1 rounded">
                {performanceStats.frameRate.toFixed(0)} fps
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="bg-white bg-opacity-20 px-2 py-1 rounded">
                {performanceStats.featuresUsed.size} features used
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="bg-white bg-opacity-20 px-2 py-1 rounded">
                {performanceStats.interactionCount} interactions
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Onboarding Guide */}
      {isOnboardingActive && (
        <div className="flex-none bg-yellow-50 border-b border-yellow-200">
          <div className="p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-yellow-800 mb-2">
                  Welcome to SuperGrid! 👋
                </h3>
                <p className="text-yellow-700 mb-3">
                  Let's take a quick tour of the key features. This interactive guide will show you
                  how to get the most out of SuperGrid's advanced capabilities.
                </p>
                <div className="flex space-x-2">
                  {featureGuides.map((guide, _index) => (
                    <button
                      key={guide.id}
                      onClick={() => handleStartGuide(guide.id)}
                      className="px-3 py-1 text-sm bg-yellow-200 text-yellow-800 rounded hover:bg-yellow-300"
                    >
                      {guide.title}
                    </button>
                  ))}
                </div>
              </div>
              <button
                onClick={() => setIsOnboardingActive(false)}
                className="text-yellow-600 hover:text-yellow-800"
              >
                Skip Tour
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Guided Mode Overlay */}
      {isGuidedMode && currentGuide && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md mx-4">
            <h3 className="text-xl font-semibold mb-3">{currentGuide.title}</h3>
            <p className="text-gray-600 mb-4">{currentGuide.description}</p>
            <ul className="space-y-2 mb-4">
              {currentGuide.steps.map((step, index) => (
                <li key={index} className="flex items-start space-x-2 text-sm">
                  <span className="flex-shrink-0 w-5 h-5 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs">
                    {index + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ul>
            <div className="flex justify-between">
              <button
                onClick={() => setIsGuidedMode(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Skip
              </button>
              <button
                onClick={handleNextGuideStep}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                {currentGuideStep < featureGuides.length - 1 ? 'Next' : 'Finish'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Control Panel */}
      <div className="flex-none bg-gray-50 border-b border-gray-200">
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-4">
              {/* Scenario Selector */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Demo Scenario
                </label>
                <select
                  value={currentScenario}
                  onChange={(e) => handleScenarioChange(e.target.value)}
                  className="border border-gray-300 rounded px-3 py-1 text-sm"
                >
                  {DEMO_SCENARIOS.map(scenario => (
                    <option key={scenario.id} value={scenario.id}>
                      {scenario.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* View Switcher */}
              <ViewSwitcher
                currentView={currentView}
                onViewChange={async (newView) => {
                  trackFeature('view-switch');
                  if (viewContinuum) {
                    await viewContinuum.switchToView(newView, 'user', true);
                  }
                }}
              />
            </div>

            {/* Janus Density Controls */}
            <div className="flex items-center space-x-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Zoom Level
                </label>
                <div className="flex border border-gray-300 rounded overflow-hidden">
                  <button
                    onClick={() => handleZoomLevelChange('leaf')}
                    className={`px-3 py-1 text-sm ${
                      currentZoomLevel === 'leaf'
                        ? 'bg-blue-600 text-white'
                        : 'bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    Detailed
                  </button>
                  <button
                    onClick={() => handleZoomLevelChange('collapsed')}
                    className={`px-3 py-1 text-sm border-l ${
                      currentZoomLevel === 'collapsed'
                        ? 'bg-blue-600 text-white'
                        : 'bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    Summary
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Pan Level
                </label>
                <div className="flex border border-gray-300 rounded overflow-hidden">
                  <button
                    onClick={() => handlePanLevelChange('dense')}
                    className={`px-3 py-1 text-sm ${
                      currentPanLevel === 'dense'
                        ? 'bg-green-600 text-white'
                        : 'bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    Dense
                  </button>
                  <button
                    onClick={() => handlePanLevelChange('sparse')}
                    className={`px-3 py-1 text-sm border-l ${
                      currentPanLevel === 'sparse'
                        ? 'bg-green-600 text-white'
                        : 'bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    Sparse
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Active Filters */}
          {activeFilters.length > 0 && (
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-500">Filters:</span>
              <div className="flex flex-wrap gap-2">
                {activeFilters.map(filter => (
                  <span
                    key={filter.id}
                    className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800"
                  >
                    {filter.label}
                    <button
                      onClick={() => filterService.removeFilter(filter.id)}
                      className="ml-2 w-4 h-4 text-blue-600 hover:text-blue-800"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Selected Cards Info */}
          {selectedCards.length > 0 && (
            <div className="mt-2 text-sm text-blue-600">
              {selectedCards.length} card{selectedCards.length > 1 ? 's' : ''} selected
              {selectedCards.length > 1 && (
                <span className="ml-2 text-gray-500">
                  (Use bulk actions to manage multiple items)
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Main Grid */}
      <div className="flex-1 overflow-hidden relative">
        <svg
          ref={svgRef}
          className="w-full h-full"
          style={{ backgroundColor: '#fafafa' }}
          tabIndex={0}
        />

        {/* Help Overlay */}
        {!isOnboardingActive && (
          <button
            onClick={() => setIsOnboardingActive(true)}
            className="absolute top-4 right-4 bg-blue-600 text-white rounded-full w-12 h-12 flex items-center justify-center hover:bg-blue-700 shadow-lg"
            title="Show help and tutorials"
          >
            ?
          </button>
        )}
      </div>

      {/* Footer with Keyboard Shortcuts */}
      <footer className="flex-none bg-gray-100 border-t border-gray-200 p-3">
        <div className="flex items-center justify-between text-xs text-gray-600">
          <div className="flex space-x-4">
            <span><kbd className="px-2 py-1 bg-gray-200 rounded">←→↑↓</kbd> Navigate</span>
            <span><kbd className="px-2 py-1 bg-gray-200 rounded">Space</kbd> Select</span>
            <span><kbd className="px-2 py-1 bg-gray-200 rounded">Enter</kbd> Open</span>
            <span><kbd className="px-2 py-1 bg-gray-200 rounded">Esc</kbd> Clear</span>
          </div>
          <div className="flex space-x-4">
            <span>Scenario: {DEMO_SCENARIOS.find(s => s.id === currentScenario)?.name}</span>
            <span>Performance: {performanceStats.frameRate.toFixed(0)}fps</span>
            {enableExport && (
              <button
                onClick={() => trackFeature('export')}
                className="text-blue-600 hover:text-blue-800"
              >
                Export Demo
              </button>
            )}
          </div>
        </div>
      </footer>

      {/* Card Detail Modal */}
      <CardDetailModal
        card={selectedCard}
        isOpen={isModalOpen}
        isLoading={false}
        onClose={() => {
          trackFeature('modal-close');
          setIsModalOpen(false);
          setSelectedCard(null);
        }}
        onSave={async (_updatedCard) => {
          trackFeature('card-update');
          setIsModalOpen(false);
        }}
        onDelete={async (_cardId) => {
          trackFeature('card-delete');
          setIsModalOpen(false);
        }}
      />
    </div>
  );
}