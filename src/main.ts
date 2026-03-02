// Isometry v5 — Phase 11 App Entry Point
// Bootstraps the full web runtime for native app embedding via WKWebView.
//
// This file is the app-mode entry point (not the library export).
// It wires WorkerBridge + providers + ViewManager and mounts the default view.
//
// Loaded by index.html at project root when built with vite.config.native.ts.
// Also serves as the Vite dev server entry when `npm run dev` is used.

import { createWorkerBridge } from './worker';
import {
  FilterProvider,
  PAFVProvider,
  DensityProvider,
  SelectionProvider,
  StateCoordinator,
  QueryBuilder,
} from './providers';
import {
  ViewManager,
  ListView,
  GridView,
  KanbanView,
  CalendarView,
  TimelineView,
  GalleryView,
  NetworkView,
  TreeView,
  SuperGrid,
} from './views';
import type { IView } from './views';
import { MutationManager } from './mutations';
import { ImportToast } from './ui/ImportToast';
import type { ViewType } from './providers';

async function main(): Promise<void> {
  const container = document.getElementById('app');
  if (!container) throw new Error('[Isometry] Missing #app container');

  // 1. Create WorkerBridge (initializes sql.js in Worker)
  const bridge = createWorkerBridge();
  await bridge.isReady;

  // 2. Create providers
  const filter = new FilterProvider();
  const pafv = new PAFVProvider();
  const selection = new SelectionProvider();
  const density = new DensityProvider();

  // 3. Wire StateCoordinator to providers
  const coordinator = new StateCoordinator();
  coordinator.registerProvider('filter', filter);
  coordinator.registerProvider('pafv', pafv);
  coordinator.registerProvider('selection', selection);
  coordinator.registerProvider('density', density);

  // 4. Create QueryBuilder (filter + pafv + density)
  const queryBuilder = new QueryBuilder(filter, pafv, density);

  // 5. Create MutationManager (needed by KanbanView for drag-drop)
  const mutationManager = new MutationManager(bridge);

  // 6. Create ViewManager
  const viewManager = new ViewManager({
    container,
    coordinator,
    queryBuilder,
    bridge,
    pafv,
  });

  // 7. View factory map — each factory returns a fresh IView instance
  const viewFactory: Record<ViewType, () => IView> = {
    list: () => new ListView(),
    grid: () => new GridView(),
    kanban: () => new KanbanView({ mutationManager }),
    calendar: () => new CalendarView({ densityProvider: density }),
    timeline: () => new TimelineView({ densityProvider: density }),
    gallery: () => new GalleryView(),
    network: () => new NetworkView({ bridge, selectionProvider: selection }),
    tree: () => new TreeView({ bridge, selectionProvider: selection }),
    supergrid: () => new SuperGrid(),
  };

  // 8. Mount default view (list)
  await viewManager.switchTo('list', () => viewFactory['list']());

  // 9. Set up ImportToast for ETL import progress notifications
  const toast = new ImportToast(container);
  bridge.onnotification = notification => {
    if (notification.type === 'import_progress') {
      const { processed, total, rate, filename } = notification.payload;
      toast.showProgress(processed, total, rate, filename);
    }
  };

  // 10. Expose on window for native bridge (future Phase 12)
  (window as Window & { __isometry?: unknown }).__isometry = {
    bridge,
    viewManager,
    viewFactory,
    pafv,
    filter,
    selection,
    density,
    coordinator,
    queryBuilder,
    mutationManager,
  };

  console.log('[Isometry] App ready');
}

main().catch(err => console.error('[Isometry] Bootstrap failed:', err));
