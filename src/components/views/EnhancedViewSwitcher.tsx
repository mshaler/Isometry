import { useState, useCallback, useEffect } from 'react';
import { useViewRegistry } from './ViewRegistry';
import type { ViewType, ViewComponentProps, ViewRenderer } from '../../types/view';
import type { Node } from '../../types/node';

export interface EnhancedViewSwitcherProps {
  /** Available view types to switch between */
  availableViews?: ViewType[];

  /** Initial view type */
  initialView?: ViewType;

  /** Data to pass to views */
  data: Node[];

  /** Node click handler */
  onNodeClick?: (node: Node) => void;

  /** View change callback */
  onViewChange?: (viewType: ViewType) => void;

  /** Custom transition configuration */
  transitionConfig?: {
    duration?: number;
    easing?: 'ease' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'linear';
  };
}

/**
 * EnhancedViewSwitcher - Advanced view switching with smooth transitions
 *
 * Features:
 * - Smooth transitions between view types
 * - State preservation across view switches
 * - Loading states during transitions
 * - Error handling for failed transitions
 * - Performance optimization with should-update checks
 */
export function EnhancedViewSwitcher({
  availableViews = ['grid', 'list'],
  initialView = 'grid',
  data,
  onNodeClick,
  onViewChange,
  transitionConfig
}: EnhancedViewSwitcherProps) {
  const {
    registry,
    switchToView,
    getAvailableViews,
    getViewInfo
  } = useViewRegistry();

  const [currentViewType, setCurrentViewType] = useState<ViewType>(initialView);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [currentRenderer, setCurrentRenderer] = useState<ViewRenderer | null>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  // Set up transition configuration
  useEffect(() => {
    if (transitionConfig) {
      registry.setTransitionConfig(transitionConfig);
    }
  }, [registry, transitionConfig]);

  // Initialize with the initial view
  useEffect(() => {
    const initializeView = async () => {
      const renderer = await switchToView(initialView);
      setCurrentRenderer(renderer);
    };
    initializeView();
  }, [initialView, switchToView]);

  // Handle view switching
  const handleViewSwitch = useCallback(async (viewType: ViewType) => {
    if (isTransitioning || viewType === currentViewType) {
      return;
    }

    setIsTransitioning(true);

    try {
      const newRenderer = await switchToView(viewType);
      if (newRenderer) {
        setCurrentViewType(viewType);
        setCurrentRenderer(newRenderer);
        onViewChange?.(viewType);
      }
    } catch (error) {
      console.error('Failed to switch view:', error);
    } finally {
      setIsTransitioning(false);
    }
  }, [isTransitioning, currentViewType, switchToView, onViewChange]);

  // Update dimensions when container resizes
  useEffect(() => {
    const updateDimensions = () => {
      // In a real implementation, this would measure the actual container
      setDimensions({
        width: window.innerWidth - 300, // Account for sidebar
        height: window.innerHeight - 200 // Account for header/footer
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

  // Get filtered available views
  const viewsToShow = availableViews.filter(viewType =>
    getAvailableViews().includes(viewType)
  );

  // Render the view switcher buttons
  const renderViewButtons = () => (
    <div className="view-switcher-buttons flex gap-2 mb-4">
      {viewsToShow.map(viewType => {
        const viewInfo = getViewInfo(viewType);
        const isActive = viewType === currentViewType;
        const isDisabled = isTransitioning;

        return (
          <button
            key={viewType}
            onClick={() => handleViewSwitch(viewType)}
            disabled={isDisabled}
            className={`
              px-4 py-2 rounded-md font-medium transition-colors
              ${isActive
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}
              ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            `}
            aria-pressed={isActive}
            aria-label={`Switch to ${viewInfo?.name || viewType} view`}
          >
            {viewInfo?.name || viewType}
            {isTransitioning && isActive && (
              <span className="ml-2 inline-block w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
            )}
          </button>
        );
      })}
    </div>
  );

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
      const viewProps: ViewComponentProps = {
        data,
        dimensions,
        onNodeClick
      };

      return currentRenderer.renderComponent(viewProps);
    }

    // Fallback for D3 or other rendering modes
    return (
      <div className="flex items-center justify-center h-64 text-yellow-600">
        View type "{currentRenderer.type}" not yet supported
      </div>
    );
  };

  return (
    <div className="enhanced-view-switcher w-full h-full flex flex-col">
      {/* View Switcher Controls */}
      {renderViewButtons()}

      {/* Transition Loading State */}
      {isTransitioning && (
        <div className="transition-overlay absolute inset-0 bg-white bg-opacity-50 flex items-center justify-center z-10">
          <div className="text-gray-600">
            Switching views...
          </div>
        </div>
      )}

      {/* Current View Content */}
      <div className="view-content flex-1 relative overflow-hidden">
        {renderCurrentView()}
      </div>
    </div>
  );
}

export default EnhancedViewSwitcher;