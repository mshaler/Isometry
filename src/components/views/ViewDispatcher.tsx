/**
 * ViewDispatcher - Routes to the correct view based on activeView prop
 *
 * Central routing component for the Grid Continuum. Each mode represents
 * a different PAFV axis allocation for the same underlying data.
 *
 * Gallery (0) -> List (1) -> Kanban (1 facet) -> Grid (2) -> SuperGrid (n)
 */
import type { GridContinuumMode } from '@/types/view';
import { GalleryView } from './GalleryView';
import { ListView } from './ListView';
import { KanbanView } from './KanbanView';
import { cn } from '@/lib/utils';

interface ViewDispatcherProps {
  /** Current Grid Continuum mode determining which view to render */
  activeView: GridContinuumMode;
  /** Optional CSS class name */
  className?: string;
}

/**
 * ViewDispatcher routes to the appropriate view component based on the
 * current Grid Continuum mode. The parent component owns the activeView
 * state and passes it down as a prop.
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
