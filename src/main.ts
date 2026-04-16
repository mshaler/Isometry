// Isometry v5 — Phase 54 App Entry Point
// Bootstraps the full web runtime for native app embedding via WKWebView.
//
// This file is the app-mode entry point (not the library export).
// It wires WorkerBridge + providers + WorkbenchShell + ViewManager and mounts the default view.
//
// Loaded by index.html at project root when built with vite.config.native.ts.
// Also serves as the Vite dev server entry when `npm run dev` is used.

import { Announcer, motionProvider } from './accessibility';
import { AuditLegend, AuditOverlay, auditState } from './audit';
import type { SourceType } from './etl/types';
import { MutationManager } from './mutations';
import { base64ToUint8Array, initNativeBridge, waitForLaunchPayload } from './native/NativeBridge';
import { CommandPalette, CommandRegistry } from './palette';
import type { ThemeMode, ViewType } from './providers';
import {
	DensityProvider,
	FilterProvider,
	PAFVProvider,
	QueryBuilder,
	SchemaProvider,
	SelectionProvider,
	StateCoordinator,
	StateManager,
	setLatchSchemaProvider,
	setSchemaProvider,
	ThemeProvider,
} from './providers';
import { AliasProvider } from './providers/AliasProvider';
import { SuperDensityProvider } from './providers/SuperDensityProvider';
import { SuperPositionProvider } from './providers/SuperPositionProvider';
import { resolveRecommendation } from './providers/ViewDefaultsRegistry';
import merylStreepSql from './sample/datasets/meryl-streep-seed.sql?raw';
import northwindSql from './sample/datasets/northwind-graph-seed.sql?raw';
import { SampleDataManager } from './sample/SampleDataManager';
import type { SampleDataset } from './sample/types';
import { HelpOverlay, ShortcutRegistry } from './shortcuts';
import { ActionToast } from './ui/ActionToast';
import { AlgorithmExplorer } from './ui/AlgorithmExplorer';
import { LayoutPresetManager } from './presets/LayoutPresetManager';
import { createPresetCommands } from './presets/presetCommands';
import { PresetSuggestionToast } from './presets/PresetSuggestionToast';
import { TourEngine } from './tour/TourEngine';
import { TourPromptToast } from './tour/TourPromptToast';
import { AppDialog } from './ui/AppDialog';
import { CalcExplorer } from './ui/CalcExplorer';
import { DataExplorerPanel } from './ui/DataExplorerPanel';
import { DiffPreviewDialog } from './ui/DiffPreviewDialog';
import type { AltoDiscoveryPayload, AltoImportProgressEvent } from './ui/DirectoryDiscoverySheet';
import { DirectoryDiscoverySheet } from './ui/DirectoryDiscoverySheet';
import { ImportToast } from './ui/ImportToast';
import { LatchExplorers } from './ui/LatchExplorers';
import { migrateNotebookContent, NotebookExplorer } from './ui/NotebookExplorer';
import { ProjectionExplorer } from './ui/ProjectionExplorer';
import { PropertiesExplorer } from './ui/PropertiesExplorer';
import { DockNav } from './ui/DockNav';
import { viewOrder } from './ui/section-defs';
import { VisualExplorer } from './ui/VisualExplorer';
import { WorkbenchShell } from './ui/WorkbenchShell';
import { PanelRegistry } from './ui/panels/PanelRegistry';
import { MAPS_PANEL_META, mapsPanelFactory } from './ui/panels/MapsPanelStub';
import { FORMULAS_PANEL_META, formulasPanelFactory } from './ui/panels/FormulasPanelStub';
import { STORIES_PANEL_META, storiesPanelFactory } from './ui/panels/StoriesPanelStub';
import type { IView } from './views';
import {
	CalendarView,
	GalleryView,
	GridView,
	KanbanView,
	ListView,
	NetworkView,
	TimelineView,
	TreeView,
	ViewManager,
} from './views';
import { CatalogSuperGrid } from './views/CatalogSuperGrid';
import { ProductionSuperGrid } from './views/pivot/ProductionSuperGrid';
import type { SuperGridSelectionLike } from './views/types';
import { createWorkerBridge } from './worker';

async function main(): Promise<void> {
	// Early harness branch — ?harness=1 loads HarnessShell instead of the full app.
	// Dynamic import keeps harness code tree-shaken from the normal production bundle.
	const params = new URLSearchParams(window.location.search);
	if (params.has('harness')) {
		const container = document.getElementById('app');
		if (!container) throw new Error('[Isometry] Missing #app container');
		const { HarnessShell } = await import('./views/pivot/harness/HarnessShell');
		const shell = new HarnessShell();
		shell.mount(container);
		return;
	}

	const container = document.getElementById('app');
	if (!container) throw new Error('[Isometry] Missing #app container');

	// 0. ARIA landmarks — role="main" on app container for screen reader navigation
	container.setAttribute('role', 'main');
	container.id = 'main-content';

	// 0a. Announcer — aria-live region for screen reader announcements (A11Y-05)
	// Appended to document.body (not #app) so it survives view lifecycle destroy/recreate.
	const announcer = new Announcer(document.body);

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
	// Phase 70: Create SchemaProvider BEFORE bridge so it's ready for the onSchema callback.
	// WorkerBridge calls onSchema BEFORE resolveReady(), so schema is populated
	// synchronously after `await bridge.isReady`.
	const schemaProvider = new SchemaProvider();

	// exactOptionalPropertyTypes: only pass properties that have values
	const bridgeConfig = {
		...(wasmBinary !== undefined && { wasmBinary }),
		...(dbData !== undefined && { dbData }),
		onSchema: (schema: {
			cards: import('./worker/protocol').ColumnInfo[];
			connections: import('./worker/protocol').ColumnInfo[];
		}) => schemaProvider.initialize(schema),
	};
	const bridge = createWorkerBridge(bridgeConfig);
	await bridge.isReady;

	// 2a-70: Wire SchemaProvider to allowlist for dynamic schema validation (SCHM-07).
	// Schema is now populated (onSchema was called before isReady resolved).
	setSchemaProvider(schemaProvider);
	// 2a-71: Wire SchemaProvider to latch.ts for dynamic LATCH family lookup (DYNM-01..04).
	setLatchSchemaProvider(schemaProvider);

	// Phase 73: Restore LATCH overrides and disabled fields from ui_state (UCFG-03)
	{
		const overridesRow = (await bridge.send('ui:get', { key: 'latch:overrides' })) as { value?: string };
		if (overridesRow?.value) {
			try {
				const parsed = JSON.parse(overridesRow.value) as Record<string, string>;
				schemaProvider.setOverrides(
					new Map(Object.entries(parsed)) as Map<string, import('./worker/protocol').LatchFamily>,
				);
			} catch {
				/* ignore corrupt data */
			}
		}
		const disabledRow = (await bridge.send('ui:get', { key: 'latch:disabled' })) as { value?: string };
		if (disabledRow?.value) {
			try {
				const parsed = JSON.parse(disabledRow.value) as string[];
				schemaProvider.setDisabled(new Set(parsed));
			} catch {
				/* ignore corrupt data */
			}
		}
	}

	// 2a. Create SampleDataManager (datasets injected, wired in step 12b)
	const sampleDatasets: SampleDataset[] = [
		{
			id: 'meryl-streep',
			name: 'Meryl Streep Career',
			description: '47 films, 35 persons, 21 awards, ~140 edges. Career as network topology.',
			defaultView: 'timeline',
			sql: merylStreepSql,
		},
		{
			id: 'northwind-graph',
			name: 'Northwind Graph',
			description: '5 hidden graphs inside the classic Northwind schema. Same data, new eyes.',
			defaultView: 'network',
			sql: northwindSql,
		},
	];
	const sampleManager = new SampleDataManager(bridge, sampleDatasets);
	let sampleDataLoaded = await sampleManager.hasSampleData();

	// 3. Create providers
	const filter = new FilterProvider();
	const pafv = new PAFVProvider();
	// Phase 71-02: Wire SchemaProvider for schema-aware supergrid defaults (DYNM-11).
	pafv.setSchemaProvider(schemaProvider);
	const selection = new SelectionProvider();
	const density = new DensityProvider();
	const theme = new ThemeProvider();

	// 4. Wire StateCoordinator to providers
	const coordinator = new StateCoordinator();
	coordinator.registerProvider('filter', filter);
	coordinator.registerProvider('pafv', pafv);
	coordinator.registerProvider('selection', selection);
	coordinator.registerProvider('density', density);
	coordinator.registerProvider('theme', theme);

	// 5. Create QueryBuilder (filter + pafv + density)
	const queryBuilder = new QueryBuilder(filter, pafv, density);

	// 6. Create SuperPositionProvider — shared instance outside view factory so it survives
	//    view destroy/recreate cycles. When user switches from SuperGrid to another view and
	//    back, the new SuperGrid instance reads the same provider and restores scroll + zoom.
	//    NOT registered with StateCoordinator (would trigger 60fps Worker calls during scroll).
	const superPosition = new SuperPositionProvider();

	// 6a. Create SuperDensityProvider — shared instance outside view factory (Phase 22).
	//     Persists density state (granularity, hideEmpty, viewMode) across SuperGrid
	//     destroy/recreate cycles when user switches views and back.
	//     IS registered with StateCoordinator — density changes participate in coordinator batch.
	const superDensity = new SuperDensityProvider();
	// Phase 71-02: Wire SchemaProvider for dynamic displayField validation (DYNM-12).
	superDensity.setSchemaProvider(schemaProvider);
	coordinator.registerProvider('superDensity', superDensity);

	// 6c. Create AliasProvider — display aliases for AxisField values (Phase 55).
	//     Persists via StateCoordinator Tier 2 for display name round-trip.
	const alias = new AliasProvider();
	coordinator.registerProvider('alias', alias);

	// 6e. Create StateManager (Phase 72) — schema-aware persistence for Tier 2 providers.
	//     Placed after all Tier 2 providers are created AND after SchemaProvider is
	//     initialized (onSchema fired before isReady resolved) so _migrateState() has
	//     valid schema when restore() is called.
	const sm = new StateManager(bridge);
	sm.setSchemaProvider(schemaProvider);
	sm.registerProvider('filter', filter, { scoped: true });
	sm.registerProvider('pafv', pafv, { scoped: true });
	sm.registerProvider('density', density, { scoped: true });
	sm.registerProvider('superDensity', superDensity, { scoped: true });
	sm.registerProvider('alias', alias, { scoped: true });
	sm.registerProvider('theme', theme);
	const activeDsResult = await bridge.send('db:query', {
		sql: 'SELECT id FROM datasets WHERE is_active = 1 LIMIT 1',
		params: [],
	});
	const activeDsRows =
		activeDsResult && 'rows' in activeDsResult
			? (activeDsResult as { rows: Array<Record<string, unknown>> }).rows
			: [];
	const bootDatasetId = activeDsRows.length > 0 ? String(activeDsRows[0]!['id']) : null;
	sm.initActiveDataset(bootDatasetId);
	await sm.restore();
	sm.enableAutoPersist();

	// SGDF-05: Track active dataset's source type for ProjectionExplorer Reset button.
	let activeSourceType: string | null = null;

	// 6d. Register SchemaProvider with coordinator (Phase 70).
	//     SchemaProvider is NOT persistable — schema is derived from PRAGMA, not user state.
	//     Registered for discoverability (DevTools, future schema-aware explorers).
	coordinator.registerProvider('schema', schemaProvider);

	// 6b. Create MutationManager (needed by KanbanView for drag-drop)
	const mutationManager = new MutationManager(bridge);

	// 7. Create ShortcutRegistry and register all keyboard shortcuts (Phase 44)
	//    Single keydown listener with built-in input field guard replaces ad-hoc listeners.
	//    Created before WorkbenchShell so HelpOverlay and CommandPalette are available for callbacks.
	const shortcuts = new ShortcutRegistry();

	// Undo/redo via ShortcutRegistry (replaces separate setupMutationShortcuts call).
	// In native mode, Cmd+Z/Cmd+Shift+Z are handled by the Swift menu bar
	// (IsometryApp.swift CommandGroup) which calls mutationManager.undo/redo via
	// evaluateJavaScript. Registering here too would cause double-undo/redo.
	if (!isNative) {
		shortcuts.register(
			'Cmd+Z',
			() => {
				void mutationManager.undo();
			},
			{ category: 'Editing', description: 'Undo' },
		);
		shortcuts.register(
			'Cmd+Shift+Z',
			() => {
				void mutationManager.redo();
			},
			{ category: 'Editing', description: 'Redo' },
		);
	}

	// Cmd+1-9 view switching: power user shortcut for instant view navigation (KEYS-01)
	// viewOrder imported from section-defs.ts — viewFactory defined here so shortcuts can reference them.
	// viewManager is referenced in closures — assigned after creation below.

	// 7a. View factory map — each factory returns a fresh IView instance
	const viewFactory: Record<ViewType, () => IView> = {
		list: () => new ListView(),
		grid: () => new GridView(),
		kanban: () => new KanbanView({ mutationManager }),
		calendar: () => new CalendarView({ densityProvider: density }),
		timeline: () => new TimelineView({ densityProvider: density }),
		gallery: () => new GalleryView(),
		network: () => {
			const nv = new NetworkView({ bridge, selectionProvider: selection });
			nv.setPickClickCallback((cardId, cardName) => {
				algorithmExplorer?.nodeClicked(cardId, cardName);
			});
			return nv;
		},
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
			const sg = new ProductionSuperGrid({
				provider: pafv,
				filter,
				bridge,
				coordinator,
				positionProvider: superPosition,
				selectionAdapter: superGridSelection,
				densityProvider: superDensity,
			});
			// Phase 62: Wire CalcExplorer into ProductionSuperGrid for footer row rendering.
			// calcExplorer is forward-declared — assigned after WorkbenchShell creation.
			// The closure captures the variable reference, so setCalcExplorer runs with
			// the actual instance (factory runs after mount, not during init).
			if (calcExplorer) sg.setCalcExplorer(calcExplorer);
			// Phase 71 DYNM-10: Wire SchemaProvider for dynamic time/numeric field classification.
			// schemaProvider is available here (wired at startup in step 2a-70).
			sg.setSchemaProvider(schemaProvider);
			// Phase 89 SGFX-01 gap closure: Wire depth getter from PropertiesExplorer.
			// propertiesExplorer is lazy-initialized inside the Properties panel factory.
			// Guard with optional chain — if Properties panel not yet opened, default to 1.
			sg.setDepthGetter(() => propertiesExplorer?.getDepth() ?? 1);
			return sg;
		},
	};

	// Forward-declared viewManager — assigned after WorkbenchShell creation.
	// Closures in shortcuts/commands capture the variable reference (not value).
	let viewManager: ViewManager;

	// Forward-declared calcExplorer — assigned lazily when Calc panel first opens (Phase 135.2).
	// Captured by supergrid factory closure for setCalcExplorer() wiring.
	let calcExplorer: CalcExplorer | null = null;

	// Forward-declared algorithmExplorer — assigned lazily when Algorithm panel first opens (Phase 135.2).
	// Captured by network factory closure for pick-mode wiring (Phase 117-02).
	let algorithmExplorer: AlgorithmExplorer | null = null;

	viewOrder.forEach((viewType, index) => {
		const num = index + 1;
		const displayName = viewType.charAt(0).toUpperCase() + viewType.slice(1);
		shortcuts.register(
			`Cmd+${num}`,
			() => {
				dockNav.setActiveItem('visualize', viewType);
				const viewContentEl = shell.getViewContentEl();
				viewContentEl.style.opacity = '0';
				void viewManager
					.switchTo(viewType, () => viewFactory[viewType]())
					.then(() => {
						viewContentEl.style.opacity = '1';
					});
			},
			{ category: 'Navigation', description: `${displayName} view` },
		);
	});

	// 7b. Theme cycling shortcut (Phase 49 THME-01)
	shortcuts.register(
		'Cmd+Shift+T',
		() => {
			const modes: ThemeMode[] = ['dark', 'light', 'system'];
			const current = modes.indexOf(theme.theme);
			const next = modes[(current + 1) % modes.length]!;
			theme.setTheme(next);
			console.log(`[Theme] Switched to: ${next}`);
		},
		{ category: 'Settings', description: 'Cycle theme (Dark/Light/System)' },
	);

	// 8. Create HelpOverlay (needed for WorkbenchShell commandBarConfig callbacks)
	const helpOverlay = new HelpOverlay(shortcuts);

	// 8a. Create CommandRegistry and populate with all app commands (Phase 51, CMDK-01..08)
	const commandRegistry = new CommandRegistry();

	// Register view-switching commands from viewOrder
	viewOrder.forEach((viewType, index) => {
		const num = index + 1;
		const displayName = viewType.charAt(0).toUpperCase() + viewType.slice(1);
		commandRegistry.register({
			id: `view:${viewType}`,
			label: `${displayName} View`,
			category: 'Views',
			shortcut: `Cmd+${num}`,
			execute: () => {
				dockNav.setActiveItem('visualize', viewType);
				const viewContentEl = shell.getViewContentEl();
				viewContentEl.style.opacity = '0';
				void viewManager
					.switchTo(viewType, () => viewFactory[viewType]())
					.then(() => {
						viewContentEl.style.opacity = '1';
					});
			},
		});
	});

	// Register action commands
	commandRegistry.register({
		id: 'action:clear-filters',
		label: 'Clear Filters',
		category: 'Actions',
		visible: () => filter.hasActiveFilters(),
		execute: () => {
			filter.clearFilters();
			coordinator.scheduleUpdate();
		},
	});

	commandRegistry.register({
		id: 'action:toggle-audit',
		label: 'Toggle Audit Overlay',
		category: 'Actions',
		shortcut: 'Shift+A',
		execute: () => {
			auditState.toggle();
		},
	});

	// Register settings commands
	commandRegistry.register({
		id: 'setting:cycle-theme',
		label: 'Change Appearance',
		category: 'Settings',
		shortcut: 'Cmd+Shift+T',
		execute: () => {
			const modes: ThemeMode[] = ['dark', 'light', 'system', 'nextstep', 'material'];
			const current = modes.indexOf(theme.theme);
			const next = modes[(current + 1) % modes.length]!;
			theme.setTheme(next);
			const labels: Record<string, string> = {
				dark: 'Modern Dark',
				light: 'Modern Light',
				system: 'Modern System',
				nextstep: 'NeXTSTEP',
				material: 'Material 3',
			};
			announcer.announce(`Theme changed to ${labels[next] ?? next}`);
		},
	});

	commandRegistry.register({
		id: 'setting:toggle-help',
		label: 'Keyboard Shortcuts',
		category: 'Settings',
		shortcut: '?',
		execute: () => {
			helpOverlay.toggle();
		},
	});

	// Register Help commands (Phase 134 TOUR-05)
	commandRegistry.register({
		id: 'action:restart-tour',
		label: 'Restart Tour',
		category: 'Help',
		execute: () => { tourEngine?.start(); },
	});

	// 8b. Create CommandPalette (needed for WorkbenchShell commandBarConfig callbacks)
	const commandPalette = new CommandPalette(
		commandRegistry,
		(query, limit) => bridge.searchCards(query, limit),
		announcer,
	);

	// Register Cmd+K via ShortcutRegistry to open/toggle palette
	shortcuts.register(
		'Cmd+K',
		() => {
			if (commandPalette.isVisible()) {
				commandPalette.close();
			} else {
				// Close help overlay if open (palette takes priority)
				if (helpOverlay.isVisible()) helpOverlay.hide();
				commandPalette.open();
			}
		},
		{ category: 'Help', description: 'Command palette' },
	);

	// 9. Create PanelRegistry + WorkbenchShell
	//    PanelRegistry created before shell so it can be passed to config.
	const panelRegistry = new PanelRegistry();

	const shell = new WorkbenchShell(container, {
		panelRegistry,
		bridge,
		commandBarConfig: {
			onOpenPalette: () => {
				if (commandPalette.isVisible()) {
					commandPalette.close();
				} else {
					if (helpOverlay.isVisible()) helpOverlay.hide();
					commandPalette.open();
				}
			},
			onSetTheme: (mode: string) => {
				theme.setTheme(mode as ThemeMode);
				// Find the label for announcement
				const labels: Record<string, string> = {
					dark: 'Modern Dark',
					light: 'Modern Light',
					system: 'Modern System',
					nextstep: 'NeXTSTEP',
					material: 'Material 3',
				};
				announcer.announce(`Theme changed to ${labels[mode] ?? mode}`);
			},
			onCycleDensity: () => {
				// Cycle DensityProvider granularity (day -> week -> month -> quarter -> year)
				const granularities = ['day', 'week', 'month', 'quarter', 'year'] as const;
				const current = granularities.indexOf(density.getState().granularity);
				const next = granularities[(current + 1) % granularities.length]!;
				density.setGranularity(next);
			},
			onToggleHelp: () => {
				helpOverlay.toggle();
			},
			getTheme: () => theme.theme,
			getDensityLabel: () => {
				const g = density.getState().granularity;
				return g.charAt(0).toUpperCase() + g.slice(1);
			},
		},
	});

	// 9a. Create VisualExplorer — mounts inside shell's view-content div,
	//     provides zoom rail alongside SuperGrid content area.
	//     Phase 94: onDimensionChange wires dimension switching to ViewManager + persistence.
	const visualExplorer = new VisualExplorer({
		positionProvider: superPosition,
		bridge,
		onDimensionChange: (level) => {
			// Apply dimension attribute to view container immediately (CSS-only, no re-query)
			viewManager.setDimension(level);
			// Persist per-view in ui_state: key = 'dimension:{viewType}'
			const vt = viewManager['currentViewType'] as string | null;
			if (vt) {
				void bridge.send('ui:set', { key: `dimension:${vt}`, value: level });
			}
		},
	});
	visualExplorer.mount(shell.getViewContentEl());
	visualExplorer.setZoomRailVisible(false); // Default view is 'list', not 'supergrid'

	// Apply crossfade transition class to view content element
	const viewContentEl = shell.getViewContentEl();
	viewContentEl.classList.add('view-crossfade');

	// 10. Create ViewManager with visualExplorer.getContentEl() (re-rooted into inner content)
	viewManager = new ViewManager({
		container: visualExplorer.getContentEl(),
		coordinator,
		queryBuilder,
		bridge,
		pafv,
		filter,
		announcer,
		// Phase 94: VisualExplorer dimension getter so ViewManager can apply data-dimension on mount
		getDimension: () => visualExplorer.getDimension(),
	});

	// 10a. Mount AuditOverlay — toggle button + keyboard shortcut (Phase 37)
	//      Stays on #app container (button is fixed-position, .audit-mode toggles on container)
	const auditOverlay = new AuditOverlay(auditState);
	auditOverlay.mount(container);

	// 10b. Create AuditLegend and wire to overlay (Phase 37)
	const auditLegend = new AuditLegend(container);
	auditOverlay.setLegend(auditLegend);

	// 11. Sidebar navigation — mounts into WorkbenchShell's sidebar column

	// 11b. Data Explorer panel state — lazy mount, persists across sidebar activations
	let dataExplorer: DataExplorerPanel | null = null;
	let catalogGrid: CatalogSuperGrid | null = null;
	let dataExplorerMounted = false;

	// Forward-declared for handleDatasetSwitch closure — assigned after LayoutPresetManager creation (Phase 133)
	let presetManager: LayoutPresetManager | null = null;
	let presetSuggestionToast: PresetSuggestionToast | null = null;

	// Forward-declared for import hook closures — assigned after TourEngine creation (Phase 134)
	let tourEngine: TourEngine | null = null;
	let tourPromptToast: TourPromptToast | null = null;

	// Phase 123 DISC-03: Singleton DirectoryDiscoverySheet — one instance reused across openings
	const discoverySheet = new DirectoryDiscoverySheet();

	const dataExplorerEl = shell.getTopSlotEl();

	async function refreshDataExplorer(): Promise<void> {
		if (!dataExplorer) return;
		// Fetch DB stats and update stats display
		const stats = await bridge.send('datasets:stats', {});
		dataExplorer.updateStats(stats);
		// Fetch and display recent cards for notebook verification
		const recentCards = await bridge.send('datasets:recent-cards', {});
		dataExplorer.updateRecentCards(recentCards);
		// Trigger catalog SuperGrid re-fetch
		catalogGrid?.refresh();
	}

	async function handleDatasetSwitch(datasetId: string, datasetName: string): Promise<void> {
		// Show loading state immediately in command bar
		shell.getCommandBar().setSubtitle('Loading\u2026');
		viewManager.showLoading();
		await sampleManager.evictAll();

		// Persist current dataset's scoped state, reset scoped providers, restore new dataset's state
		await sm.setActiveDataset(datasetId);

		// SGDF-05: Update active source type for ProjectionExplorer Reset button
		const _dsRow = (await bridge.send('db:query', {
			sql: 'SELECT source_type FROM datasets WHERE id = ? LIMIT 1',
			params: [datasetId],
		})) as { rows: Array<Record<string, unknown>> } | null;
		activeSourceType = _dsRow?.rows?.[0]?.['source_type'] != null
			? String(_dsRow.rows[0]!['source_type'])
			: null;
		dockNav.updateRecommendations(activeSourceType);

		selection.clear();
		superPosition.reset();

		// Update datasets table: deactivate all, then activate the selected dataset
		await bridge.send('db:exec', {
			sql: 'UPDATE datasets SET is_active = 0 WHERE is_active = 1',
			params: [],
		});
		await bridge.send('db:exec', {
			sql: 'UPDATE datasets SET is_active = 1 WHERE id = ?',
			params: [datasetId],
		});

		schemaProvider.refresh();
		coordinator.scheduleUpdate();
		await viewManager.switchTo('list', () => viewFactory['list']());
		// Show dataset name after switch completes
		shell.getCommandBar().setSubtitle(datasetName);
		void refreshDataExplorer();

		// Check for dataset-preset association and show suggestion toast (Phase 133)
		// Delay slightly so import/switch toast clears first (per D-09 in UI-SPEC)
		setTimeout(() => {
			void presetManager?.getAssociation(datasetId).then((presetName) => {
				if (presetName) {
					presetSuggestionToast?.show(presetName);
				}
			});
		}, 500);
	}

	function showDataExplorer(): void {
		if (!dataExplorerMounted) {
			// Show dedicated DataExplorer container
			dataExplorerEl.style.display = 'block';

			dataExplorer = new DataExplorerPanel({
				onImportFile: importFileHandler,
				onExport: (format) => {
					void (async () => {
						const result = await bridge.send('etl:export', { format });
						const blob = new Blob([result.data], { type: 'text/plain;charset=utf-8' });
						const url = URL.createObjectURL(blob);
						const a = document.createElement('a');
						a.href = url;
						a.download = result.filename;
						a.click();
						URL.revokeObjectURL(url);
					})();
				},
				onExportDatabase: async () => {
					// db:export returns the database as a Uint8Array blob
					const data = await bridge.send('db:export', {});
					// Ensure underlying ArrayBuffer is a plain ArrayBuffer (not SharedArrayBuffer)
					const blob = new Blob([new Uint8Array(data.buffer as ArrayBuffer)], { type: 'application/x-sqlite3' });
					const url = URL.createObjectURL(blob);
					const a = document.createElement('a');
					a.href = url;
					const dateStr = new Date().toISOString().slice(0, 10);
					a.download = `isometry-backup-${dateStr}.sqlite`;
					a.click();
					URL.revokeObjectURL(url);
				},
				onVacuum: async () => {
					await bridge.send('datasets:vacuum', {});
					void refreshDataExplorer();
				},
				onFileDrop: (file: File) => {
					const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
					const sourceMap: Record<string, string> = {
						json: 'json',
						csv: 'csv',
						xlsx: 'excel',
						xls: 'excel',
						md: 'markdown',
						html: 'html',
						htm: 'html',
					};
					const source = sourceMap[ext] ?? 'json';
					const binaryFormats = new Set(['xlsx', 'xls']);
					void (async () => {
						const data: string | ArrayBuffer = binaryFormats.has(ext) ? await file.arrayBuffer() : await file.text();
						await bridge.importFile(source as SourceType, data, { filename: file.name });
						coordinator.scheduleUpdate();
						void refreshDataExplorer();
					})();
				},
				onSelectCard: (cardId: string) => {
					selection.select(cardId);
				},
				onPickAltoDirectory: () => {
					if (isNative) {
						window.webkit!.messageHandlers.nativeBridge.postMessage({
							id: crypto.randomUUID(),
							type: 'native:request-alto-discovery',
							payload: {},
							timestamp: Date.now(),
						});
					}
				},
			});
			dataExplorer.mount(dataExplorerEl);
			dataExplorerMounted = true;

			// Mount Catalog SuperGrid into the catalog body element
			const catalogBodyEl = dataExplorer.getCatalogBodyEl();
			if (catalogBodyEl) {
				catalogGrid = new CatalogSuperGrid({
					bridge,
					onDatasetClick: (datasetId, name, _sourceType, isActive) => {
						if (isActive) return; // No-op on already-active dataset
						void (async () => {
							const confirmed = await AppDialog.show({
								variant: 'confirm',
								title: 'Switch Dataset?',
								message: `Switching to "${name}" will replace all current data. This cannot be undone.`,
								confirmLabel: 'Switch Dataset',
								cancelLabel: 'Keep Current Dataset',
							});
							if (confirmed) {
								await handleDatasetSwitch(datasetId, name);
							}
						})();
					},
					onDeleteDataset: (datasetId, name, cardCount) => {
						void (async () => {
							const confirmed = await AppDialog.show({
								variant: 'confirm',
								title: `Delete '${name}'?`,
								message: `${cardCount} card${cardCount === 1 ? '' : 's'} and all associated connections will be permanently removed. This cannot be undone.`,
								confirmLabel: 'Delete Dataset',
								cancelLabel: 'Cancel',
								confirmVariant: 'danger',
							});
							if (!confirmed) return;
							await bridge.send('datasets:delete', { datasetId });
							catalogGrid?.refresh();
							void refreshDataExplorer();
						})();
					},
					onReimportDataset: (datasetId, _name, sourceType) => {
						void (async () => {
							// Look up directory_path from the catalog
							const datasets = await bridge.send('datasets:query', {});
							const ds = datasets.find((d) => d.id === datasetId);
							if (!ds) return;

							const directoryPath = ds.directory_path;

							if (isNative && directoryPath) {
								// Extract dirName from source_type (alto_index_{dirName})
								const dirName = sourceType.startsWith('alto_index_')
									? sourceType.replace('alto_index_', '')
									: sourceType;

								// Send re-import request to Swift with stored directory path
								window.webkit!.messageHandlers.nativeBridge.postMessage({
									id: crypto.randomUUID(),
									type: 'native:request-alto-reimport',
									payload: {
										datasetId,
										name: dirName,
										cardType: dirName,
										path: directoryPath,
									},
									timestamp: Date.now(),
								});
							} else if (isNative && !directoryPath) {
								// Fallback: path not stored — trigger discovery picker
								window.webkit!.messageHandlers.nativeBridge.postMessage({
									id: crypto.randomUUID(),
									type: 'native:request-alto-discovery',
									payload: {},
									timestamp: Date.now(),
								});
							}
						})();
					},
				});
				catalogGrid.mount(catalogBodyEl);
			}

			void refreshDataExplorer();
		} else {
			// Already mounted — just show the container
			dataExplorerEl.style.display = 'block';
			void refreshDataExplorer();
		}
	}

	function hideDataExplorer(): void {
		if (!dataExplorerMounted) return;
		dataExplorerEl.style.display = 'none';
	}

	// Phase 123 DISC-03: Listen for alto-discovery events dispatched by NativeBridge.
	// NativeBridge receives native:alto-discovery from Swift and dispatches this custom event.
	// Opens DirectoryDiscoverySheet with the discovered subdirectory list.
	window.addEventListener('alto-discovery', (e) => {
		const payload = (e as CustomEvent<AltoDiscoveryPayload>).detail;
		const ctaBtn = dataExplorer?.getAltoCTABtn() ?? undefined;
		void discoverySheet.open(payload, ctaBtn).then((selected) => {
			if (selected && selected.length > 0) {
				// Phase 124: Send selected directories to Swift for import
				if (isNative) {
					window.webkit!.messageHandlers.nativeBridge.postMessage({
						id: crypto.randomUUID(),
						type: 'native:request-alto-import',
						payload: {
							rootPath: payload.rootPath,
							directories: selected.map((s) => ({
								name: s.name,
								cardType: s.cardType,
								path: s.path,
							})),
						},
						timestamp: Date.now(),
					});
				}
			}
		});
	});

	// Phase 124 IMPT-04: Per-directory import progress
	window.addEventListener('alto-import-progress', (e) => {
		const event = (e as CustomEvent<AltoImportProgressEvent>).detail;
		discoverySheet.updateProgress(event);

		// On all-complete, refresh the coordinator to show new data
		if (event.status === 'all-complete' && event.cardCount > 0) {
			coordinator.scheduleUpdate();
		}
	});

	// Phase 125 DSET-03/04: Handle re-import result from Swift
	// Dispatched by NativeBridge when Swift sends native:alto-reimport-result
	window.addEventListener('alto-reimport-result', (e) => {
		const detail = (
			e as CustomEvent<{
				datasetId: string;
				cards: import('./etl/types').CanonicalCard[];
				name: string;
			}>
		).detail;

		void (async () => {
			// Step 1: Send cards to Worker for dedup (no write yet)
			const diffResult = await bridge.send('datasets:reimport', {
				datasetId: detail.datasetId,
				cards: detail.cards,
			});

			// Step 2: Check for zero changes
			const totalChanges = diffResult.toInsert.length + diffResult.toUpdate.length + diffResult.deletedIds.length;

			if (totalChanges === 0) {
				// Zero changes — show brief toast, no modal
				toast.showSuccess({
					inserted: 0,
					updated: 0,
					unchanged: diffResult.unchanged,
					skipped: 0,
					errors: 0,
					connections_created: 0,
					insertedIds: [],
					updatedIds: [],
					deletedIds: [],
					errors_detail: [],
				});
				return;
			}

			// Step 3: Show diff preview modal
			const committed = await DiffPreviewDialog.show({
				datasetName: detail.name,
				toInsert: diffResult.toInsert,
				toUpdate: diffResult.toUpdate,
				deletedIds: diffResult.deletedIds,
				deletedNames: diffResult.deletedNames,
				unchanged: diffResult.unchanged,
			});

			if (committed) {
				// Step 4: Commit — apply the cached DedupResult
				const result = await bridge.send('datasets:commit-reimport', {
					datasetId: detail.datasetId,
				});

				// Show completion toast
				toast.showSuccess(result);

				// Refresh catalog and views
				catalogGrid?.refresh();
				coordinator.scheduleUpdate();
				// Refresh DataExplorer stats so updated card counts are visible immediately (DSET-04)
				void refreshDataExplorer();
			}
			// If cancelled, do nothing — pendingReimport cache is abandoned
		})();
	});

	// Track whether data explorer is currently visible
	let dataExplorerVisible = false;

	// Map dock item composite keys to PanelRegistry panel IDs for explorer toggle routing
	const dockToPanelMap: Record<string, string> = {
		'analyze:filter': 'latch',
		'activate:notebook': 'notebook',
		// Stub panels (Phase 149)
		'analyze:formula': 'formulas-stub',
		'activate:stories': 'stories-stub',
	};

	const dockNav = new DockNav({
		bridge,
		onActivateItem: (sectionKey: string, itemKey: string) => {
			// Hide Data Explorer when switching to any non-integrate section
			if (sectionKey !== 'integrate' && dataExplorerVisible) {
				hideDataExplorer();
				dataExplorerVisible = false;
			}

			if (sectionKey === 'integrate') {
				// Toggle DataExplorer: show for 'catalog', hide for others
				if (itemKey === 'catalog') {
					if (dataExplorerVisible) {
						hideDataExplorer();
						dataExplorerVisible = false;
					} else {
						showDataExplorer();
						dataExplorerVisible = true;
						dataExplorer?.expandSection('catalog');
					}
					return;
				}

				// Explorer panel items (properties, projection) — fall through to panel toggle below
				if (dataExplorerVisible) {
					hideDataExplorer();
					dataExplorerVisible = false;
				}
			}

			// Visualize section items map to view types
			if (sectionKey === 'visualize') {
				const viewType = itemKey as ViewType;
				const viewContentEl = shell.getViewContentEl();
				viewContentEl.style.opacity = '0';
				void viewManager
					.switchTo(viewType, () => viewFactory[viewType]())
					.then(() => {
						viewContentEl.style.opacity = '1';
					});
				return;
			}

			// Explorer panel toggle — route dock items to PanelRegistry
			const compositeKey = `${sectionKey}:${itemKey}`;
			const panelId = dockToPanelMap[compositeKey];
			if (panelId) {
				if (panelRegistry.isEnabled(panelId)) {
					panelRegistry.disable(panelId);
				} else {
					panelRegistry.enable(panelId);
				}
				return;
			}
			// Other section items are navigation stubs
		},
		onActivateSection: (_sectionKey: string) => {
			// No-op — leaf sections (properties/projection/latch) removed from sidebar (Phase 135.2)
		},
		announcer,
	});
	dockNav.mount(shell.getSidebarEl());

	// 11-minimap. Wire minimap thumbnail data source, navigate callback, and re-render triggers.
	dockNav.setThumbnailDataSource(() => {
		const pafvState = pafv.getState();
		return {
			cards: viewManager.getLastCards(),
			pafvAxes: {
				xAxis: pafvState.xAxis,
				yAxis: pafvState.yAxis,
				groupBy: pafvState.groupBy,
				colAxes: [...pafvState.colAxes],
				rowAxes: [...pafvState.rowAxes],
			},
		};
	});

	dockNav.setNavigateCallback((normX, normY) => {
		const vmContainer = viewManager.getContainer();
		const maxScrollLeft = vmContainer.scrollWidth - vmContainer.clientWidth;
		const maxScrollTop = vmContainer.scrollHeight - vmContainer.clientHeight;
		vmContainer.scrollTo({
			left: normX * maxScrollLeft,
			top: normY * maxScrollTop,
			behavior: 'instant',
		});
	});

	coordinator.subscribe(() => {
		dockNav.requestThumbnailUpdate();
	});

	// 11a. Wire ViewManager to update zoom rail visibility and sidebar active state on view switch.
	//      Phase 94: Also restore persisted dimension level for the new view type.
	//      Phase 134: Notify TourEngine of view switch so it can reposition or advance (D-06).
	viewManager.onViewSwitch = (viewType) => {
		dockNav.setActiveItem('visualize', viewType);
		dockNav.requestThumbnailUpdate();
		tourEngine?.handleViewSwitch();
		visualExplorer.setZoomRailVisible(viewType === 'supergrid');

		// Phase 94: Restore persisted dimension for this view type (async, fire-and-forget)
		void (async () => {
			try {
				const row = (await bridge.send('ui:get', { key: `dimension:${viewType}` })) as { value: string | null };
				const level = (row?.value as '1x' | '2x' | '5x' | null) ?? '2x';
				// Validate to guard against corrupt persisted values
				const validLevel: '1x' | '2x' | '5x' = (['1x', '2x', '5x'] as const).includes(level as '1x' | '2x' | '5x')
					? (level as '1x' | '2x' | '5x')
					: '2x';
				visualExplorer.setDimension(validLevel);
				viewManager.setDimension(validLevel);
			} catch {
				// Dimension restore is best-effort — default to 2x on error
				visualExplorer.setDimension('2x');
				viewManager.setDimension('2x');
			}
		})();
	};

	// 12. Mount initial view — restore persisted viewType when data exists, else list
	const _bootViewType: ViewType = bootDatasetId !== null ? pafv.getState().viewType : 'list';
	await viewManager.switchTo(_bootViewType, () => viewFactory[_bootViewType]());

	// 12z. Restore active dataset context on initial page load (SGFX-03)
	//      Queries the datasets table directly for name + source_type of the active dataset.
	void (async () => {
		try {
			const _bootDsResult = (await bridge.send('db:query', {
				sql: 'SELECT name, source_type FROM datasets WHERE is_active = 1 LIMIT 1',
				params: [],
			})) as { rows: Array<Record<string, unknown>> } | null;
			const _bootDs = _bootDsResult?.rows?.[0];
			if (_bootDs?.['name']) {
				shell.getCommandBar().setSubtitle(String(_bootDs['name']));
			}
			// Restore activeSourceType at boot so sidebar recommendations badge is correct
			if (_bootDs?.['source_type']) {
				activeSourceType = String(_bootDs['source_type']);
				dockNav.updateRecommendations(activeSourceType);
			}
		} catch {
			// No active dataset — subtitle stays hidden
		}
	})();

	// 12a. Wire welcome panel CTAs to import flows (EMPTY-01)
	// Guard against HMR listener stacking: remove any previous listener before adding.
	// The handler is stored on window so it can be removed on re-run.
	// Forward-declare toast — assigned later but captured by closure (called only after assignment).
	let toast: ImportToast;

	if ((window as any).__isometry_importFileHandler) {
		window.removeEventListener('isometry:import-file', (window as any).__isometry_importFileHandler);
	}
	if ((window as any).__isometry_importNativeHandler) {
		window.removeEventListener('isometry:import-native', (window as any).__isometry_importNativeHandler);
	}
	const importFileHandler = () => {
		if (isNative) {
			// Native: ask Swift to open file picker — Swift sends file data back via native:action
			window.webkit!.messageHandlers.nativeBridge.postMessage({
				id: crypto.randomUUID(),
				type: 'native:request-file-import',
				payload: {},
				timestamp: Date.now(),
			});
		} else {
			// Web: create ephemeral file input for manual file selection
			const input = document.createElement('input');
			input.type = 'file';
			input.accept = '.json,.csv,.xlsx,.xls,.md,.html,.htm';
			input.style.display = 'none';
			input.addEventListener('change', async () => {
				const file = input.files?.[0];
				if (!file) return;

				// File size guard: reject files over 25MB before parsing attempt
				if (file.size > 25 * 1024 * 1024) {
					toast.showError('File too large (max 25MB)');
					return;
				}

				const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
				const sourceMap: Record<string, string> = {
					json: 'json',
					csv: 'csv',
					xlsx: 'excel',
					xls: 'excel',
					md: 'markdown',
					html: 'html',
					htm: 'html',
				};
				const source = sourceMap[ext] ?? 'json';

				// Binary formats (xlsx, xls) need ArrayBuffer; text formats use string
				const binaryFormats = new Set(['xlsx', 'xls']);
				const data: string | ArrayBuffer = binaryFormats.has(ext) ? await file.arrayBuffer() : await file.text();

				await bridge.importFile(source as SourceType, data, { filename: file.name });
				coordinator.scheduleUpdate();
			});
			document.body.appendChild(input);
			input.click();
			// Cleanup after selection or cancel
			setTimeout(() => input.remove(), 60000);
		}
	};
	(window as any).__isometry_importFileHandler = importFileHandler;
	window.addEventListener('isometry:import-file', importFileHandler);

	const importNativeHandler = () => {
		// Only in native: request Swift to show ImportSourcePickerView
		if (isNative) {
			window.webkit!.messageHandlers.nativeBridge.postMessage({
				id: crypto.randomUUID(),
				type: 'native:show-import-source-picker',
				payload: {},
				timestamp: Date.now(),
			});
		}
	};
	(window as any).__isometry_importNativeHandler = importNativeHandler;
	window.addEventListener('isometry:import-native', importNativeHandler);

	// 12a-fix. Wire direct callbacks so welcome panel buttons call handlers directly
	// instead of going through CustomEvent dispatch (which can break the user activation
	// chain needed for programmatic input.click() file dialogs).
	viewManager.onImportFile = importFileHandler;
	viewManager.onImportNative = importNativeHandler;

	// 12b. Wire sample data CTA into welcome panel (SMPL-01, SMPL-04)
	const defaultDataset = sampleManager.getDefaultDataset();
	const orderedDatasets = [defaultDataset, ...sampleManager.getDatasets().filter((d) => d.id !== defaultDataset.id)];
	viewManager.sampleDatasets = orderedDatasets.map((d) => ({ id: d.id, name: d.name }));

	viewManager.onLoadSample = (datasetId: string) => {
		void (async () => {
			// 1. Show loading state (prevents flash of old data during eviction)
			viewManager.showLoading();

			// 2. Evict ALL prior data (cards + connections)
			await sampleManager.evictAll();

			// 3. Reset all provider state to defaults BEFORE loading new data
			filter.resetToDefaults();
			pafv.resetToDefaults();
			selection.clear();
			superPosition.reset();

			// 4. Load new dataset into freshly emptied database
			await sampleManager.load(datasetId);
			sampleDataLoaded = true;

			// 5. Re-notify SchemaProvider subscribers (re-introspect after new data loads)
			//    DDL is constant across datasets, so refresh() re-notifies without re-querying PRAGMA
			schemaProvider.refresh();

			// 6. Trigger coordinated re-render (all views re-query from sql.js)
			coordinator.scheduleUpdate();

			// 7. Navigate to dataset's showcase view
			const dataset = sampleManager.getDatasets().find((d) => d.id === datasetId);
			if (dataset) {
				await viewManager.switchTo(dataset.defaultView, () => viewFactory[dataset.defaultView]());
			}

			// 8. Refresh DataExplorer (stats + recent cards) after sample data loads
			//    Matches all other import paths (file drop ~648, importFile ~1100, importNative ~1122, vacuum ~627)
			void refreshDataExplorer();
		})();
	};

	// 12c. Register sample data commands in command palette (SMPL-04)
	for (const ds of sampleManager.getDatasets()) {
		commandRegistry.register({
			id: `action:load-sample-${ds.id}`,
			label: `Load Sample: ${ds.name}`,
			category: 'Actions',
			execute: () => {
				viewManager.onLoadSample?.(ds.id);
			},
		});
	}

	commandRegistry.register({
		id: 'action:clear-sample-data',
		label: 'Clear Sample Data',
		category: 'Actions',
		visible: () => sampleDataLoaded,
		execute: () => {
			void sampleManager.clear().then(() => {
				sampleDataLoaded = false;
				coordinator.scheduleUpdate();
			});
		},
	});

	// 13. Mount overlays to document.body (above the shell via z-index stacking)
	helpOverlay.mount(document.body);
	commandPalette.mount(document.body);

	// 14. Set up ImportToast and ActionToast on document.body
	//     (always visible regardless of shell scroll position)
	toast = new ImportToast(document.body);
	bridge.onnotification = (notification) => {
		if (notification.type === 'import_progress') {
			const { processed, total, rate, filename } = notification.payload;
			toast.showProgress(processed, total, rate, filename);
		}
	};

	// 14a. Set up ActionToast for undo/redo feedback (RFIX-03)
	//      MutationManager owns toast wiring — undo/redo from ANY trigger shows feedback.
	const actionToast = new ActionToast(document.body);
	mutationManager.setToast(actionToast);

	// 14a-2. Create LayoutPresetManager and wire preset commands into command palette (Phase 133)
	presetManager = new LayoutPresetManager(
		() => shell.getSectionStates(),
		(states) => shell.restoreSectionStates(states),
		bridge,
	);
	await presetManager.loadCustomPresets();
	createPresetCommands({
		presetManager,
		registry: commandRegistry,
		palette: commandPalette,
		actionToast,
		mutationManager,
		restoreSectionStates: (states) => shell.restoreSectionStates(states),
		getActiveDatasetId: () => sm.getActiveDatasetId(),
	});

	// 14a-3. Create PresetSuggestionToast for dataset-switch preset associations (Phase 133)
	presetSuggestionToast = new PresetSuggestionToast(document.body);
	presetSuggestionToast.setOnApply((name) => {
		presetManager?.applyPreset(name);
		actionToast.show(`Applied preset \u201C${name}\u201D`);
	});

	// 14a-4. Create TourEngine + TourPromptToast for guided tour (Phase 134)
	tourEngine = new TourEngine({
		getAxisNames: () => {
			const state = pafv.getState();
			const rowAxis = state.rowAxes[0]?.field ?? null;
			const columnAxis = state.colAxes[0]?.field ?? null;
			return { rowAxis, columnAxis };
		},
	});
	tourEngine.onComplete = () => {
		void bridge.send('ui:set', { key: 'tour:completed:v1', value: '1' });
	};
	tourPromptToast = new TourPromptToast(document.body);
	tourPromptToast.setOnStartTour(() => {
		// Persist tour:prompted immediately (D-10)
		void bridge.send('ui:set', { key: 'tour:prompted', value: '1' });
		tourEngine?.start();
	});

	// 14a-1. Subscribe to MutationManager for view re-render + DataExplorer refresh (BUGF-02)
	//        Any mutation (card create/update/delete, undo, redo) triggers:
	//          - coordinator.scheduleUpdate() → all views re-query from sql.js
	//          - refreshDataExplorer() → Recent Cards list reflects latest state
	mutationManager.subscribe(() => {
		coordinator.scheduleUpdate();
		void refreshDataExplorer();
	});

	// Phase 91: Migrate legacy notebook:{cardId} ui_state entries to cards.content (one-shot, EDIT-05)
	await migrateNotebookContent(bridge);

	// 14b. Register all 6 explorer panels into PanelRegistry (Phase 135.2)
	//      Explorer instances are created inside panel factories so they receive
	//      the correct container element when the panel is first opened.

	// Forward-declare explorer instances so cross-panel wiring works in factory closures.
	let propertiesExplorer!: PropertiesExplorer;
	let projectionExplorer!: ProjectionExplorer;
	let latchExplorers!: LatchExplorers;
	let notebookExplorer!: NotebookExplorer;

	panelRegistry.register(
		{
			id: 'properties',
			name: 'Properties',
			icon: 'sliders',
			description: 'Properties Explorer',
			dependencies: [],
			defaultEnabled: true,
		},
		() => ({
			mount(container: HTMLElement): void {
				container.textContent = '';
				propertiesExplorer = new PropertiesExplorer({
					alias,
					schema: schemaProvider,
					container,
					bridge,
					filter,
					onCountChange: (_count) => {
						// Optional: could update section badge here
					},
				});
				propertiesExplorer.mount();
				// Wire toggle changes to re-render ProjectionExplorer and SuperGrid
				propertiesExplorer.subscribe(() => {
					projectionExplorer?.update?.();
					coordinator.scheduleUpdate();
				});
			},
			update(): void {
				// PropertiesExplorer auto-subscribes via schemaProvider
			},
			destroy(): void {
				// PropertiesExplorer has no explicit destroy — DOM removal handles cleanup
			},
		}),
	);

	panelRegistry.register(
		{
			id: 'projection',
			name: 'Projection',
			icon: 'layout-template',
			description: 'Projection Explorer',
			dependencies: [],
			defaultEnabled: true,
		},
		() => ({
			mount(container: HTMLElement): void {
				container.textContent = '';
				projectionExplorer = new ProjectionExplorer({
					pafv,
					alias,
					schema: schemaProvider,
					superDensity,
					auditState,
					actionToast,
					container,
					enabledFieldsGetter: () => propertiesExplorer?.getEnabledFields() ?? new Set(),
					getSourceType: () => activeSourceType,
				});
				projectionExplorer.mount();
			},
			update(): void {
				projectionExplorer?.update?.();
			},
			destroy(): void {
				// ProjectionExplorer has no explicit destroy
			},
		}),
	);

	panelRegistry.register(
		{
			id: 'latch',
			name: 'Filters',
			icon: 'tags',
			description: 'Filters',
			dependencies: [],
			defaultEnabled: true,
		},
		() => ({
			mount(container: HTMLElement): void {
				container.textContent = '';
				latchExplorers = new LatchExplorers({
					filter,
					bridge,
					coordinator,
					schema: schemaProvider,
				});
				latchExplorers.mount(container);
				// Phase 73: Remount LatchExplorers when LATCH overrides change (UCFG-04)
				schemaProvider.subscribe(() => {
					latchExplorers.destroy();
					latchExplorers.mount(container);
				});
			},
			update(): void {
				// LatchExplorers auto-subscribe to filter changes
			},
			destroy(): void {
				latchExplorers?.destroy?.();
			},
		}),
	);

	panelRegistry.register(
		{
			id: 'notebook',
			name: 'Notebook',
			icon: 'notebook-pen',
			description: 'Notebook Explorer',
			dependencies: [],
			defaultEnabled: false,
		},
		() => ({
			mount(container: HTMLElement): void {
				container.textContent = '';
				notebookExplorer = new NotebookExplorer({
					bridge,
					selection,
					filter,
					alias,
					schema: schemaProvider,
					mutations: mutationManager,
				});
				notebookExplorer.mount(container);
			},
			update(): void {
				// NotebookExplorer auto-subscribes to selection
			},
			destroy(): void {
				// NotebookExplorer has no explicit destroy
			},
		}),
	);

	panelRegistry.register(
		{
			id: 'calc',
			name: 'Calculations',
			icon: 'sigma',
			description: 'Calc Explorer',
			dependencies: [],
			defaultEnabled: false,
		},
		() => ({
			mount(container: HTMLElement): void {
				container.textContent = '';
				calcExplorer = new CalcExplorer({
					bridge,
					pafv,
					schema: schemaProvider,
					alias,
					container,
					onConfigChange: (_config) => {
						coordinator.scheduleUpdate();
					},
				});
				calcExplorer.mount();
			},
			update(): void {
				// CalcExplorer re-renders on pafv subscription
			},
			destroy(): void {
				calcExplorer = null as unknown as CalcExplorer;
			},
		}),
	);

	panelRegistry.register(
		{
			id: 'algorithm',
			name: 'Algorithm',
			icon: 'brain',
			description: 'Algorithm Explorer',
			dependencies: [],
			defaultEnabled: false,
		},
		() => ({
			mount(container: HTMLElement): void {
				container.textContent = '';
				algorithmExplorer = new AlgorithmExplorer({
					bridge,
					schema: schemaProvider,
					filter,
					container,
					coordinator,
					mutationManager,
				});
				algorithmExplorer.mount();
				// Wire AlgorithmExplorer callbacks to NetworkView
				algorithmExplorer.onResult((params) => {
					const currentView = viewManager.getCurrentView();
					if (currentView && 'applyAlgorithmEncoding' in currentView) {
						void (currentView as import('./views/NetworkView').NetworkView).applyAlgorithmEncoding(params);
					}
				});
				algorithmExplorer.onReset(() => {
					const currentView = viewManager.getCurrentView();
					if (currentView && 'resetEncoding' in currentView) {
						(currentView as import('./views/NetworkView').NetworkView).resetEncoding();
					}
				});
				algorithmExplorer.onPickModeChange((mode, sourceId, targetId) => {
					const currentView = viewManager.getCurrentView();
					if (currentView && 'setPickMode' in currentView) {
						const nv = currentView as import('./views/NetworkView').NetworkView;
						nv.setPickMode(mode !== 'idle');
						nv.setPickedNodes(sourceId, targetId);
					}
				});
			},
			update(): void {
				// AlgorithmExplorer auto-subscribes to filter
			},
			destroy(): void {
				algorithmExplorer = null as unknown as AlgorithmExplorer;
			},
		}),
	);

	panelRegistry.register(MAPS_PANEL_META, mapsPanelFactory);
	panelRegistry.register(FORMULAS_PANEL_META, formulasPanelFactory);
	panelRegistry.register(STORIES_PANEL_META, storiesPanelFactory);

	// Wire panelRegistry.broadcastUpdate() to coordinator subscription and schema changes (D-03)
	coordinator.subscribe(() => panelRegistry.broadcastUpdate());
	schemaProvider.subscribe(() => {
		panelRegistry.broadcastUpdate();
		// Phase 73: Update ProjectionExplorer when disabled fields change (UCFG-04)
		projectionExplorer?.update?.();
	});

	// Forward-declare notebookExplorer for shortcuts (created inside panel factory)
	// Shortcuts use closures — notebookExplorer is assigned when panel first opens.

	// Phase 92 CREA-01: Register Cmd+N shortcut for card creation.
	shortcuts.register(
		'Cmd+N',
		() => {
			notebookExplorer?.enterCreationMode?.();
		},
		{ category: 'Editing', description: 'New Card' },
	);

	// Phase 92 CREA-01: Register "New Card" in CommandPalette.
	commandRegistry.register({
		id: 'action:new-card',
		label: 'New Card',
		category: 'Actions',
		shortcut: 'Cmd+N',
		execute: () => {
			notebookExplorer?.enterCreationMode?.();
		},
	});

	// 15. Register focus mode shortcut (Cmd+\) — no-op for collapsed state (drawer manages panels)
	const toggleFocusMode = () => {
		// Focus mode is a no-op in the panel drawer architecture.
		// Panel visibility is managed by the icon strip toggle.
	};

	shortcuts.register('Cmd+\\', toggleFocusMode, {
		category: 'Navigation',
		description: 'Toggle focus mode',
	});

	commandRegistry.register({
		id: 'action:toggle-focus',
		label: 'Toggle Focus Mode',
		category: 'Actions',
		shortcut: 'Cmd+\\',
		execute: toggleFocusMode,
	});

	// 16. Wire AuditState to import results (Phase 37) + sample data import guard (SMPL-07)
	//     Wrap bridge.importFile and bridge.importNative to intercept ImportResult
	//     and feed it to auditState. This avoids modifying WorkerBridge.ts.
	const originalImportFile = bridge.importFile.bind(bridge);
	bridge.importFile = async (source, data, options) => {
		// SMPL-07: Prompt to clear sample data before first real import
		if (sampleDataLoaded) {
			const clearIt = await AppDialog.show({
				variant: 'confirm',
				title: 'Sample Data',
				message: 'You have sample data loaded. Clear it before importing?',
				confirmLabel: 'Clear and Import',
				cancelLabel: 'Keep Sample Data',
			});
			if (clearIt) {
				await sampleManager.clear();
				sampleDataLoaded = false;
			}
		}
		const result = await originalImportFile(source, data, options);
		// SGDF-05: Track source type for ProjectionExplorer Reset button
		activeSourceType = source;
		dockNav.updateRecommendations(activeSourceType);
		// SGDF-06: Apply source-type defaults only on first import for this dataset
		const _fileDatasetId = sm.getActiveDatasetId();
		if (_fileDatasetId) {
			const _fileFlagKey = `view:defaults:applied:${_fileDatasetId}`;
			const _fileFlagRow = (await bridge.send('ui:get', { key: _fileFlagKey })) as { value?: string | null } | null;
			if (!_fileFlagRow?.value) {
				pafv.applySourceDefaults(source, schemaProvider);
				// OVDF-02 + OVDF-04: Auto-switch to recommended view + apply viewConfig on first import
				const _fileRec = resolveRecommendation(source);
				if (_fileRec) {
					setTimeout(() => {
						void viewManager.switchTo(_fileRec.recommendedView, () => viewFactory[_fileRec.recommendedView]()).then(() => {
							if (_fileRec.viewConfig) {
								if (_fileRec.viewConfig.groupBy !== undefined) pafv.setGroupBy(_fileRec.viewConfig.groupBy);
								if (_fileRec.viewConfig.xAxis !== undefined) pafv.setXAxis(_fileRec.viewConfig.xAxis);
								if (_fileRec.viewConfig.yAxis !== undefined) pafv.setYAxis(_fileRec.viewConfig.yAxis);
							}
						});
						toast.showMessage(_fileRec.toastMessage, 3000);
					}, 500);
				}
				await bridge.send('ui:set', { key: _fileFlagKey, value: '1' });
			}
		}
		auditState.addImportResult(result, source);
		toast.showSuccess(result);
		// TOUR-06: Show tour prompt on first-ever import (D-08/D-09)
		if (tourPromptToast) {
			const _tourPrompted = (await bridge.send('ui:get', { key: 'tour:prompted' })) as { value?: string | null } | null;
			const _tourCompleted = (await bridge.send('ui:get', { key: 'tour:completed:v1' })) as { value?: string | null } | null;
			if (!_tourPrompted?.value && !_tourCompleted?.value) {
				void bridge.send('ui:set', { key: 'tour:prompted', value: '1' });
				setTimeout(() => tourPromptToast?.show(), 1500);
			}
		}
		void refreshDataExplorer();
		return result;
	};
	const originalImportNative = bridge.importNative.bind(bridge);
	bridge.importNative = async (sourceType, cards) => {
		// SMPL-07: Prompt to clear sample data before first native import
		if (sampleDataLoaded) {
			const clearIt = await AppDialog.show({
				variant: 'confirm',
				title: 'Sample Data',
				message: 'You have sample data loaded. Clear it before importing?',
				confirmLabel: 'Clear and Import',
				cancelLabel: 'Keep Sample Data',
			});
			if (clearIt) {
				await sampleManager.clear();
				sampleDataLoaded = false;
			}
		}
		const result = await originalImportNative(sourceType, cards);
		// SGDF-05: Track source type for ProjectionExplorer Reset button
		activeSourceType = sourceType;
		dockNav.updateRecommendations(activeSourceType);
		// SGDF-06: Apply source-type defaults only on first import for this dataset
		const _nativeDatasetId = sm.getActiveDatasetId();
		if (_nativeDatasetId) {
			const _nativeFlagKey = `view:defaults:applied:${_nativeDatasetId}`;
			const _nativeFlagRow = (await bridge.send('ui:get', { key: _nativeFlagKey })) as { value?: string | null } | null;
			if (!_nativeFlagRow?.value) {
				pafv.applySourceDefaults(sourceType, schemaProvider);
				// OVDF-02 + OVDF-04: Auto-switch to recommended view + apply viewConfig on first import
				const _nativeRec = resolveRecommendation(sourceType);
				if (_nativeRec) {
					setTimeout(() => {
						void viewManager.switchTo(_nativeRec.recommendedView, () => viewFactory[_nativeRec.recommendedView]()).then(() => {
							if (_nativeRec.viewConfig) {
								if (_nativeRec.viewConfig.groupBy !== undefined) pafv.setGroupBy(_nativeRec.viewConfig.groupBy);
								if (_nativeRec.viewConfig.xAxis !== undefined) pafv.setXAxis(_nativeRec.viewConfig.xAxis);
								if (_nativeRec.viewConfig.yAxis !== undefined) pafv.setYAxis(_nativeRec.viewConfig.yAxis);
							}
						});
						toast.showMessage(_nativeRec.toastMessage, 3000);
					}, 500);
				}
				await bridge.send('ui:set', { key: _nativeFlagKey, value: '1' });
			}
		}
		auditState.addImportResult(result, sourceType);
		toast.showSuccess(result);
		// TOUR-06: Show tour prompt on first-ever import (D-08/D-09)
		if (tourPromptToast) {
			const _tourPrompted = (await bridge.send('ui:get', { key: 'tour:prompted' })) as { value?: string | null } | null;
			const _tourCompleted = (await bridge.send('ui:get', { key: 'tour:completed:v1' })) as { value?: string | null } | null;
			if (!_tourPrompted?.value && !_tourCompleted?.value) {
				void bridge.send('ui:set', { key: 'tour:prompted', value: '1' });
				setTimeout(() => tourPromptToast?.show(), 1500);
			}
		}
		void refreshDataExplorer();
		return result;
	};

	// 17. Expose on window for native bridge and DevTools inspection
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
		helpOverlay,
		auditState,
		auditOverlay,
		announcer,
		motionProvider,
		themeProvider: theme,
		commandRegistry,
		commandPalette,
		shell,
		visualExplorer,
		latchExplorers,
		notebookExplorer,
		calcExplorer,
		sampleManager,
		schemaProvider,
		sm,
		queryAll: async (sql: string, params: unknown[] = []) => {
			const result = await bridge.send('db:query', { sql, params });
			const firstRow = result.rows[0];
			const columns = firstRow !== undefined ? Object.keys(firstRow) : [];
			return { columns, rows: result.rows as Record<string, unknown>[] };
		},
		exec: async (sql: string) => {
			await bridge.send('db:query', { sql, params: [] });
		},
	};

	// 18. Initialize native bridge ongoing handlers (checkpoint, mutation hook, sync)
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
