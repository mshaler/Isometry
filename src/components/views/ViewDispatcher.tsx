/**
 * ViewDispatcher - Routes to the correct view based on activeView prop
 *
 * Central routing component for the Grid Continuum and extended views.
 * Each mode represents a different PAFV axis allocation for the same
 * underlying data.
 *
 * Grid Continuum:
 *   Gallery (0) -> List (1) -> Kanban (1 facet) -> Grid (2) -> SuperGrid (n)
 *
 * Extended Views:
 *   Network (force-directed graph) | Timeline | Calendar | Tree
 */
import type { GridContinuumMode } from '@/types/view';
import { GalleryView } from './GalleryView';
import { ListView } from './ListView';
import { KanbanView } from './KanbanView';
import { NetworkView } from './NetworkView';
import { cn } from '@/lib/utils';

/** Extended view type including Grid Continuum modes and additional views */
type ExtendedViewMode = GridContinuumMode | 'network' | 'timeline';

interface ViewDispatcherProps {
  /** Current view mode - Grid Continuum modes or extended views */
  activeView: ExtendedViewMode;
  /** Optional CSS class name */
  className?: string;
}

/**
 * ViewDispatcher routes to the appropriate view component based on the
 * current view mode. The parent component owns the activeView state and
 * passes it down as a prop.
 *
 * Note: Grid and SuperGrid modes currently show a placeholder because
 * SuperGridCSS requires explicit PAFV axis configuration that must be
 * provided by a parent component (e.g., IntegratedLayout). A future
 * SuperGridView wrapper will handle self-contained data fetching.
 */
export function ViewDispatcher({ activeView, className }: ViewDispatcherProps) {
  switch (activeView) {
    case 'gallery':
      return <GalleryView />;
    case 'list':
      return <ListView />;
    case 'kanban':
      return <KanbanView />;
    case 'network':
      return <NetworkView />;
    case 'timeline':
      return (
        <div className={cn('flex items-center justify-center h-full text-muted-foreground', className)}>
          <div className="text-center">
            <p className="text-lg font-medium">Timeline View</p>
            <p className="text-sm">Coming in Phase 113-03</p>
          </div>
        </div>
      );
    case 'grid':
      return (
        <div className={cn('flex items-center justify-center h-full text-muted-foreground', className)}>
          <div className="text-center">
            <p className="text-lg font-medium">Grid View</p>
            <p className="text-sm">2D row x column matrix - use IntegratedLayout for full functionality</p>
          </div>
        </div>
      );
    case 'supergrid':
      return (
        <div className={cn('flex items-center justify-center h-full text-muted-foreground', className)}>
          <div className="text-center">
            <p className="text-lg font-medium">SuperGrid View</p>
            <p className="text-sm">n-dimensional nested headers - use IntegratedLayout for full functionality</p>
          </div>
        </div>
      );
    default:
      // Fallback to GalleryView for unknown modes
      return <GalleryView />;
  }
}
