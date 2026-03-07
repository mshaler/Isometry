// Isometry v5 — Phase 11 App Entry Point
// Bootstraps the full web runtime for native app embedding via WKWebView.
//
// This file is the app-mode entry point (not the library export).
// It wires WorkerBridge + providers + ViewManager and mounts the default view.
//
// Loaded by index.html at project root when built with vite.config.native.ts.
// Also serves as the Vite dev server entry when `npm run dev` is used.

import { AuditLegend, AuditOverlay, auditState } from './audit';
import { MutationManager } from './mutations';
import { base64ToUint8Array, initNativeBridge, waitForLaunchPayload } from './native/NativeBridge';
import type { ViewType } from './providers';
import { ShortcutRegistry } from './shortcuts';
import {
	DensityProvider,
	FilterProvider,
	PAFVProvider,
	QueryBuilder,
	SelectionProvider,
	StateCoordinator,
} from './providers';
import { SuperDensityProvider } from './providers/SuperDensityProvider';
import { SuperPositionProvider } from './providers/SuperPositionProvider';
import { ImportToast } from './ui/ImportToast';
import type { IView } from './views';
import {
	CalendarView,
	GalleryView,
	GridView,
	KanbanView,
	ListView,
	NetworkView,
	SuperGrid,
	TimelineView,
	TreeView,
	ViewManager,
} from './views';
import type { SuperGridSelectionLike } from './views/types';
import { createWorkerBridge } from './worker';

async function main(): Promise<void> {
	const container = document.getElementById('app');
	if (!container) throw new Error('[Isometry] Missing #app container');

	// 1. Detect native shell (WKWebView app:// scheme)
	const isNative = window.location.protocol === 'app:';

	let wasmBinary: ArrayBuffer | undefined;
	let dbData: ArrayBuffer | undefined;

	if (isNative) {
		// Native shell: pre-load WASM in parallel with waiting for Swift's LaunchPayload.
		// Worker fetch() doesn't route through WKURLSchemeHandler, so WASM must be
		// fetched on the main thread and transferred to the Worker.
		// LaunchPayload contains dbData (base64) for checkpoint hydration, or null on first launch.
		console.log('[Isometry] Native shell — pre-loading WASM + waiting for LaunchPayload');
		const [wasmResponse, launchPayload] = await Promise.all([
			fetch('./assets/sql-wasm-fts5.wasm').then((r) => {
				if (!r.ok) throw new Error(`WASM fetch failed: ${r.status}`);
				return r.arrayBuffer();
			}),
			waitForLaunchPayload(),
		]);
		wasmBinary = wasmResponse;
		if (launchPayload.dbData) {
			// .buffer returns ArrayBufferLike; cast to ArrayBuffer for WorkerBridgeConfig
			dbData = base64ToUint8Array(launchPayload.dbData).buffer as ArrayBuffer;
		}
	}

	// 2. Create WorkerBridge (initializes sql.js in Worker with optional WASM + dbData)
	// exactOptionalPropertyTypes: only pass properties that have values
	const bridgeConfig = {
		...(wasmBinary !== undefined && { wasmBinary }),
		...(dbData !== undefined && { dbData }),
	};
	const bridge = createWorkerBridge(bridgeConfig);
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

	// 5. Create SuperPositionProvider — shared instance outside view factory so it survives
	//    view destroy/recreate cycles. When user switches from SuperGrid to another view and
	//    back, the new SuperGrid instance reads the same provider and restores scroll + zoom.
	//    NOT registered with StateCoordinator (would trigger 60fps Worker calls during scroll).
	const superPosition = new SuperPositionProvider();

	// 5a. Create SuperDensityProvider — shared instance outside view factory (Phase 22).
	//     Persists density state (granularity, hideEmpty, viewMode) across SuperGrid
	//     destroy/recreate cycles when user switches views and back.
	//     IS registered with StateCoordinator — density changes participate in coordinator batch.
	const superDensity = new SuperDensityProvider();
	coordinator.registerProvider('superDensity', superDensity);

	// 5b. Create MutationManager (needed by KanbanView for drag-drop)
	const mutationManager = new MutationManager(bridge);

	// 6. Create ViewManager
	const viewManager = new ViewManager({
		container,
		coordinator,
		queryBuilder,
		bridge,
		pafv,
	});

	// 6a. Mount AuditOverlay — toggle button + keyboard shortcut (Phase 37)
	const auditOverlay = new AuditOverlay(auditState);
	auditOverlay.mount(container);

	// 6b. Create AuditLegend and wire to overlay (Phase 37)
	const auditLegend = new AuditLegend(container);
	auditOverlay.setLegend(auditLegend);

	// 7. View factory map — each factory returns a fresh IView instance
	const viewFactory: Record<ViewType, () => IView> = {
		list: () => new ListView(),
		grid: () => new GridView(),
		kanban: () => new KanbanView({ mutationManager }),
		calendar: () => new CalendarView({ densityProvider: density }),
		timeline: () => new TimelineView({ densityProvider: density }),
		gallery: () => new GalleryView(),
		network: () => new NetworkView({ bridge, selectionProvider: selection }),
		tree: () => new TreeView({ bridge }),
		supergrid: () => {
			// Create SuperGridSelectionLike adapter over the existing SelectionProvider.
			// SuperGrid operates on cell-level card ID arrays; SelectionProvider operates on flat card ID sets.
			// isSelectedCell checks if any card_id in the cell is currently selected.
			const superGridSelection: SuperGridSelectionLike = {
				select: (cardIds: string[]) => selection.selectAll(cardIds),
				addToSelection: (cardIds: string[]) => {
					// Union: add each ID if not already selected (additive-only, never removes)
					for (const id of cardIds) {
						if (!selection.isSelected(id)) {
							selection.toggle(id);
						}
					}
				},
				clear: () => selection.clear(),
				isSelectedCell: (_cellKey: string) => false, // Deprecated — _updateSelectionVisuals uses isCardSelected instead
				isCardSelected: (cardId: string) => selection.isSelected(cardId),
				getSelectedCount: () => selection.getSelectionCount(),
				subscribe: (cb: () => void) => selection.subscribe(cb),
			};
			return new SuperGrid(pafv, filter, bridge, coordinator, superPosition, superGridSelection, superDensity);
		},
	};

	// 8. Mount default view (list)
	await viewManager.switchTo('list', () => viewFactory['list']());

	// 8a. Create ShortcutRegistry and register all keyboard shortcuts (Phase 44)
	//     Single keydown listener with built-in input field guard replaces ad-hoc listeners.
	const shortcuts = new ShortcutRegistry();

	// Undo/redo via ShortcutRegistry (replaces separate setupMutationShortcuts call)
	shortcuts.register('Cmd+Z', () => { void mutationManager.undo(); }, { category: 'Editing', description: 'Undo' });
	shortcuts.register('Cmd+Shift+Z', () => { void mutationManager.redo(); }, { category: 'Editing', description: 'Redo' });

	// Cmd+1-9 view switching: power user shortcut for instant view navigation (KEYS-01)
	const viewOrder: ViewType[] = ['list', 'grid', 'kanban', 'calendar', 'timeline', 'gallery', 'network', 'tree', 'supergrid'];
	viewOrder.forEach((viewType, index) => {
		const num = index + 1;
		const displayName = viewType.charAt(0).toUpperCase() + viewType.slice(1);
		shortcuts.register(`Cmd+${num}`, () => {
			void viewManager.switchTo(viewType, () => viewFactory[viewType]());
		}, { category: 'Navigation', description: `${displayName} view` });
	});

	// 9. Set up ImportToast for ETL import progress notifications
	const toast = new ImportToast(container);
	bridge.onnotification = (notification) => {
		if (notification.type === 'import_progress') {
			const { processed, total, rate, filename } = notification.payload;
			toast.showProgress(processed, total, rate, filename);
		}
	};

	// 9a. Wire AuditState to import results (Phase 37)
	//     Wrap bridge.importFile and bridge.importNative to intercept ImportResult
	//     and feed it to auditState. This avoids modifying WorkerBridge.ts.
	const originalImportFile = bridge.importFile.bind(bridge);
	bridge.importFile = async (source, data, options) => {
		const result = await originalImportFile(source, data, options);
		auditState.addImportResult(result, source);
		return result;
	};
	const originalImportNative = bridge.importNative.bind(bridge);
	bridge.importNative = async (sourceType, cards) => {
		const result = await originalImportNative(sourceType, cards);
		auditState.addImportResult(result, sourceType);
		return result;
	};

	// 10. Expose on window for native bridge and DevTools inspection
	// Note: in native mode, window.__isometry.receive was already set by waitForLaunchPayload.
	// We merge the bridge and provider refs into the existing object (if any).
	const existingIso = (window as Window & { __isometry?: Record<string, unknown> }).__isometry ?? {};
	(window as Window & { __isometry?: unknown }).__isometry = {
		...existingIso,
		bridge,
		viewManager,
		viewFactory,
		pafv,
		filter,
		selection,
		density,
		superDensity,
		coordinator,
		queryBuilder,
		mutationManager,
		shortcuts,
		auditState,
		auditOverlay,
	};

	// 11. Initialize native bridge ongoing handlers (checkpoint, mutation hook, sync)
	//     Only activates when running in WKWebView (protocol === 'app:')
	if (isNative) {
		initNativeBridge(bridge);

		// SYNC-01: After incoming sync records are merged, trigger view re-query
		// Uses JS-internal CustomEvent (NOT mutated message) to prevent sync echo loops
		window.addEventListener('isometry:sync-complete', () => {
			coordinator.scheduleUpdate();
		});
	}

	console.log('[Isometry] App ready');
}

main().catch((err) => console.error('[Isometry] Bootstrap failed:', err));
