import React, { useState, useCallback, useEffect } from 'react';
import { usePAFV } from '../../hooks/usePAFV';
import { useViewRegistry } from './ViewRegistry';
import { PerformanceMonitor, usePerformanceTracking } from './PerformanceMonitor';
import type { ViewType, ViewComponentProps, ViewRenderer } from '../../types/view';
import type { Node } from '../../types/node';
import type { AxisMapping } from '../../types/pafv';

export interface PAFVViewSwitcherProps {
  /** Data to pass to views */
  data: Node[];

  /** Node click handler */
  onNodeClick?: (node: Node) => void;

  /** Custom transition configuration */
  transitionConfig?: {
    duration?: number;
    easing?: 'ease' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'linear';
  };

  /** Whether to show performance monitoring overlay */
  showPerformanceMonitor?: boolean;
}

/**
 * PAFVViewSwitcher - PAFV-integrated view switching with axis preservation
 *
 * Features:
 * - Integrates with PAFV context for view mode management
 * - Preserves axis mappings during view transitions
 * - Applies PAFV axis configuration to ViewRenderers
 * - Maintains PAFV wells state for GridView compatibility
 * - Smooth transitions with axis configuration preservation
 */
export function PAFVViewSwitcher({
  data,
  onNodeClick,
  transitionConfig,
  showPerformanceMonitor = false
}: PAFVViewSwitcherProps) {
  const {
    state: pafvState,
    setViewMode,
    getAxisForPlane
  } = usePAFV();

  const {
    registry,
    switchToView,
    getCurrentRenderer
  } = useViewRegistry();

  const { trackOperation } = usePerformanceTracking();

  const [isTransitioning, setIsTransitioning] = useState(false);
  const [currentRenderer, setCurrentRenderer] = useState<ViewRenderer | null>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  // Set up transition configuration
  useEffect(() => {
    if (transitionConfig) {
      registry.setTransitionConfig(transitionConfig);
    }
  }, [registry, transitionConfig]);

  // Initialize with the current PAFV view mode
  useEffect(() => {
    const initializeView = async () => {
      const renderer = await switchToView(pafvState.viewMode);
      if (renderer) {
        setCurrentRenderer(renderer);
        // Apply current PAFV axis configuration
        applyPAFVConfiguration(renderer, pafvState.mappings);
      }
    };
    initializeView();
  }, [pafvState.viewMode, switchToView]);

  // Apply PAFV axis mappings to the renderer
  const applyPAFVConfiguration = useCallback((renderer: ViewRenderer, _mappings: AxisMapping[]) => {
    // Find X and Y axis mappings
    const xMapping = mappings.find(m => m.plane === 'x');
    const yMapping = mappings.find(m => m.plane === 'y');

    // Apply axis configuration to renderer
    if (xMapping) {
      renderer.setXAxis(xMapping.facet);
    } else {
      renderer.setXAxis(null);
    }

    if (yMapping) {
      renderer.setYAxis(yMapping.facet);
    } else {
      renderer.setYAxis(null);
    }
  }, []);

  // Update renderer configuration when PAFV mappings change
  useEffect(() => {
    if (currentRenderer) {
      applyPAFVConfiguration(currentRenderer, pafvState.mappings);
    }
  }, [currentRenderer, pafvState.mappings, applyPAFVConfiguration]);

  // Handle view switching through PAFV with performance tracking
  const handleViewSwitch = useCallback(async (viewType: ViewType) => {
    if (isTransitioning || viewType === pafvState.viewMode) {
      return;
    }

    // Only handle grid and list views for PAFV integration
    if (viewType !== 'grid' && viewType !== 'list') {
      console.warn(`PAFV does not support view type: ${viewType}`);
      return;
    }

    setIsTransitioning(true);

    try {
      await trackOperation(`view-transition-${pafvState.viewMode}-to-${viewType}`, async () => {
        // Update PAFV state (which preserves per-view mappings)
        setViewMode(viewType);

        // Switch to the new view
        const newRenderer = await switchToView(viewType);
        if (newRenderer) {
          setCurrentRenderer(newRenderer);
          // PAFV configuration will be applied via useEffect
        }
      });
    } catch (error) {
      console.error('Failed to switch view:', error);
    } finally {
      setIsTransitioning(false);
    }
  }, [isTransitioning, pafvState.viewMode, setViewMode, switchToView, trackOperation]);

  // Update dimensions when container resizes
  useEffect(() => {
    const updateDimensions = () => {
      setDimensions({
        width: window.innerWidth - 300,
        height: window.innerHeight - 200
      });
    };

    window.addEventListener('resize', updateDimensions);
    updateDimensions();

    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  // Notify current renderer of resize
  useEffect(() => {
    currentRenderer?.onResize?.(dimensions);
  }, [currentRenderer, dimensions]);

  // Render the view switcher buttons
  const renderViewButtons = () => (
    <div className="pafv-view-switcher-buttons flex gap-2 mb-4">
      {(['grid', 'list'] as ViewType[]).map(viewType => {
        const isActive = viewType === pafvState.viewMode;
        const isDisabled = isTransitioning;

        return (
          <button
            key={viewType}
            onClick={() => handleViewSwitch(viewType)}
            disabled={isDisabled}
            className={`
              px-4 py-2 rounded-md font-medium transition-all duration-200
              ${isActive
                ? 'bg-blue-600 text-white shadow-md transform scale-105'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 hover:shadow-sm hover:transform hover:scale-102'}
              ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            `}
            style={{
              transform: isActive ? 'scale(1.05)' : isDisabled ? 'scale(1)' : 'scale(1)',
            }}
            aria-pressed={isActive}
            aria-label={`Switch to ${viewType} view`}
          >
            <div className="flex items-center space-x-2">
              {/* View Icon */}
              <div className="w-4 h-4">
                {viewType === 'grid' ? (
                  <svg viewBox="0 0 16 16" fill="currentColor">
                    <rect x="1" y="1" width="6" height="6" rx="1" />
                    <rect x="9" y="1" width="6" height="6" rx="1" />
                    <rect x="1" y="9" width="6" height="6" rx="1" />
                    <rect x="9" y="9" width="6" height="6" rx="1" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 16 16" fill="currentColor">
                    <rect x="1" y="2" width="14" height="3" rx="1" />
                    <rect x="1" y="7" width="14" height="3" rx="1" />
                    <rect x="1" y="12" width="14" height="3" rx="1" />
                  </svg>
                )}
              </div>

              <span>{viewType === 'grid' ? 'Grid' : 'List'}</span>

              {isTransitioning && isActive && (
                <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
              )}
            </div>
          </button>
        );
      })}
    </div>
  );

  // Enhanced view props with PAFV integration
  const getEnhancedViewProps = useCallback((): ViewComponentProps => {
    return {
      data,
      dimensions,
      onNodeClick,
      transitionState: {
        axisConfiguration: {
          x: getAxisForPlane('x'),
          y: getAxisForPlane('y')
        }
      }
    };
  }, [data, dimensions, onNodeClick, getAxisForPlane]);

  // Render the current view
  const renderCurrentView = () => {
    if (!currentRenderer) {
      return (
        <div className="flex items-center justify-center h-64 text-gray-500">
          Loading view...
        </div>
      );
    }

    // For React-based renderers, use their renderComponent method
    if (currentRenderer.renderMode === 'react' && currentRenderer.renderComponent) {
      const viewProps = getEnhancedViewProps();
      return currentRenderer.renderComponent(viewProps);
    }

    // Fallback for D3 or other rendering modes
    return (
      <div className="flex items-center justify-center h-64 text-yellow-600">
        View type "{currentRenderer.type}" not yet supported in PAFV mode
      </div>
    );
  };

  return (
    <div className="pafv-view-switcher w-full h-full flex flex-col">
      {/* View Switcher Controls */}
      {renderViewButtons()}

      {/* PAFV Configuration Display */}
      <div className="pafv-config mb-4 p-3 bg-gray-50 rounded-md border">
        <div className="text-sm text-gray-700">
          <div className="font-medium mb-1">PAFV Configuration:</div>
          <div className="space-y-1">
            {pafvState.mappings.map((mapping, index) => (
              <div key={index} className="flex items-center gap-2">
                <span className="font-mono text-xs bg-gray-200 px-1 rounded">
                  {mapping.plane.toUpperCase()}
                </span>
                <span>→</span>
                <span className="text-blue-600">{mapping.axis}</span>
                <span className="text-gray-400">({mapping.facet})</span>
              </div>
            ))}
            {pafvState.mappings.length === 0 && (
              <div className="text-gray-400 italic">No axis mappings configured</div>
            )}
          </div>
        </div>
      </div>

      {/* Transition Loading State */}
      {isTransitioning && (
        <div className="transition-overlay absolute inset-0 bg-white bg-opacity-50 flex items-center justify-center z-10">
          <div className="text-gray-600">
            Switching views with PAFV preservation...
          </div>
        </div>
      )}

      {/* Current View Content */}
      <div className="view-content flex-1 relative overflow-hidden">
        {renderCurrentView()}
      </div>

      {/* Performance Monitor Overlay */}
      <PerformanceMonitor
        visible={showPerformanceMonitor}
        position="bottom-left"
        autoTrackFrames={true}
      />
    </div>
  );
}

export default PAFVViewSwitcher;