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
import merylStreepSql from './sample/datasets/meryl-streep-seed.sql?raw';
import northwindSql from './sample/datasets/northwind-graph-seed.sql?raw';
import { SampleDataManager } from './sample/SampleDataManager';
import type { SampleDataset } from './sample/types';
import { HelpOverlay, ShortcutRegistry } from './shortcuts';
import { ActionToast } from './ui/ActionToast';
import { AppDialog } from './ui/AppDialog';
import { AlgorithmExplorer } from './ui/AlgorithmExplorer';
import { CalcExplorer } from './ui/CalcExplorer';
import { ImportToast } from './ui/ImportToast';
import { LatchExplorers } from './ui/LatchExplorers';
import { migrateNotebookContent, NotebookExplorer } from './ui/NotebookExplorer';
import { ProjectionExplorer } from './ui/ProjectionExplorer';
import { PropertiesExplorer } from './ui/PropertiesExplorer';
import { VisualExplorer } from './ui/VisualExplorer';
import { DataExplorerPanel } from './ui/DataExplorerPanel';
import { SidebarNav } from './ui/SidebarNav';
import { WorkbenchShell } from './ui/WorkbenchShell';
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
import { CatalogSuperGrid } from './views/CatalogSuperGrid';
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
	sm.registerProvider('filter', filter);
	sm.registerProvider('pafv', pafv);
	sm.registerProvider('density', density);
	sm.registerProvider('superDensity', superDensity);
	sm.registerProvider('alias', alias);
	sm.registerProvider('theme', theme);
	await sm.restore();
	sm.enableAutoPersist();

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

	// Undo/redo via ShortcutRegistry (replaces separate setupMutationShortcuts call)
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

	// Cmd+1-9 view switching: power user shortcut for instant view navigation (KEYS-01)
	// viewOrder and viewFactory defined here so shortcuts can reference them.
	// viewManager is referenced in closures — assigned after creation below.
	const viewOrder: ViewType[] = [
		'list',
		'grid',
		'kanban',
		'calendar',
		'timeline',
		'gallery',
		'network',
		'tree',
		'supergrid',
	];

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
				algorithmExplorer.nodeClicked(cardId, cardName);
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
			const sg = new SuperGrid(pafv, filter, bridge, coordinator, superPosition, superGridSelection, superDensity);
			// Phase 62: Wire CalcExplorer into SuperGrid for footer row rendering.
			// calcExplorer is forward-declared — assigned after WorkbenchShell creation.
			// The closure captures the variable reference, so setCalcExplorer runs with
			// the actual instance (SuperGrid factory runs after mount, not during init).
			if (calcExplorer) sg.setCalcExplorer(calcExplorer);
			// Phase 71 DYNM-10: Wire SchemaProvider for dynamic time/numeric field classification.
			// schemaProvider is available here (wired at startup in step 2a-70).
			sg.setSchemaProvider(schemaProvider);
			// Phase 89 SGFX-01 gap closure: Wire depth getter from PropertiesExplorer.
			// propertiesExplorer is forward-declared and assigned before the factory runs
			// (SuperGrid factory executes lazily on first view switch, after full init).
			sg.setDepthGetter(() => propertiesExplorer.getDepth());
			return sg;
		},
	};

	// Forward-declared viewManager — assigned after WorkbenchShell creation.
	// Closures in shortcuts/commands capture the variable reference (not value).
	let viewManager: ViewManager;

	// Forward-declared calcExplorer — assigned after WorkbenchShell creation (Phase 62).
	// Captured by supergrid factory closure for setCalcExplorer() wiring.
	let calcExplorer: CalcExplorer;

	// Forward-declared algorithmExplorer — assigned after WorkbenchShell creation (Phase 116).
	// Captured by network factory closure for pick-mode wiring (Phase 117-02).
	let algorithmExplorer: AlgorithmExplorer;

	viewOrder.forEach((viewType, index) => {
		const num = index + 1;
		const displayName = viewType.charAt(0).toUpperCase() + viewType.slice(1);
		shortcuts.register(
			`Cmd+${num}`,
			() => {
				sidebarNav.setActiveItem('visualization', viewType);
				const viewContentEl = shell.getViewContentEl();
				viewContentEl.style.opacity = '0';
				void viewManager.switchTo(viewType, () => viewFactory[viewType]()).then(() => {
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
				sidebarNav.setActiveItem('visualization', viewType);
				const viewContentEl = shell.getViewContentEl();
				viewContentEl.style.opacity = '0';
				void viewManager.switchTo(viewType, () => viewFactory[viewType]()).then(() => {
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
				dark: 'Modern Dark', light: 'Modern Light', system: 'Modern System',
				nextstep: 'NeXTSTEP', material: 'Material 3',
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

	// 9. Create WorkbenchShell — takes over #app, creates .workbench-shell layout
	//    All dependencies (helpOverlay, commandPalette, theme, density) are now available.
	const shell = new WorkbenchShell(container, {
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
					dark: 'Modern Dark', light: 'Modern Light', system: 'Modern System',
					nextstep: 'NeXTSTEP', material: 'Material 3',
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

	const panelRailEl = shell.getPanelRailEl();

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
		filter.resetToDefaults();
		pafv.resetToDefaults();
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
	}

	function showDataExplorer(): void {
		if (!dataExplorerMounted) {
			// Hide all existing workbench panels in panel rail
			for (const child of Array.from(panelRailEl.children)) {
				(child as HTMLElement).style.display = 'none';
			}
			panelRailEl.setAttribute('data-active-panel', 'data-explorer');

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
						const data: string | ArrayBuffer = binaryFormats.has(ext)
							? await file.arrayBuffer()
							: await file.text();
						await bridge.importFile(source as SourceType, data, { filename: file.name });
						coordinator.scheduleUpdate();
						void refreshDataExplorer();
					})();
				},
				onSelectCard: (cardId: string) => {
					selection.select(cardId);
				},
			});
			dataExplorer.mount(panelRailEl);
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
				});
				catalogGrid.mount(catalogBodyEl);
			}

			void refreshDataExplorer();
		} else {
			// Already mounted — show data explorer, hide workbench panels
			for (const child of Array.from(panelRailEl.children)) {
				const el = child as HTMLElement;
				if (el.classList.contains('data-explorer')) {
					el.style.display = '';
				} else {
					el.style.display = 'none';
				}
			}
			panelRailEl.setAttribute('data-active-panel', 'data-explorer');
			void refreshDataExplorer();
		}
	}

	function hideDataExplorer(): void {
		if (!dataExplorerMounted) return;
		// Hide data explorer root element
		const rootEl = panelRailEl.querySelector('.data-explorer') as HTMLElement | null;
		if (rootEl) rootEl.style.display = 'none';
		// Restore all workbench panels
		for (const child of Array.from(panelRailEl.children)) {
			const el = child as HTMLElement;
			if (!el.classList.contains('data-explorer')) {
				el.style.display = '';
			}
		}
		panelRailEl.removeAttribute('data-active-panel');
	}

	const sidebarNav = new SidebarNav({
		onActivateItem: (sectionKey: string, itemKey: string) => {
			// Hide Data Explorer when switching to any non-data-explorer section
			if (sectionKey !== 'data-explorer' && panelRailEl.getAttribute('data-active-panel') === 'data-explorer') {
				hideDataExplorer();
			}

			if (sectionKey === 'data-explorer') {
				showDataExplorer();
				if (itemKey === 'catalog') {
					dataExplorer?.expandSection('catalog');
				}
				return;
			}

			// Visualization section items map to view types
			if (sectionKey === 'visualization') {
				const viewType = itemKey as ViewType;
				const viewContentEl = shell.getViewContentEl();
				viewContentEl.style.opacity = '0';
				void viewManager.switchTo(viewType, () => viewFactory[viewType]()).then(() => {
					viewContentEl.style.opacity = '1';
				});
			}
			// Other section items are navigation stubs or existing panel activations
			// Properties/Projection/LATCH items scroll the panel rail to the matching section
		},
		onActivateSection: (sectionKey: string) => {
			// Hide Data Explorer when workbench section is activated
			if (panelRailEl.getAttribute('data-active-panel') === 'data-explorer') {
				hideDataExplorer();
			}

			// Leaf sections (properties, projection) — expand the matching CollapsibleSection
			const body = shell.getSectionBody(sectionKey);
			if (body) {
				// Scroll to section in panel rail
				body.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
			}
		},
		announcer,
	});
	sidebarNav.mount(shell.getSidebarEl());

	// 11a. Wire ViewManager to update zoom rail visibility and sidebar active state on view switch.
	//      Phase 94: Also restore persisted dimension level for the new view type.
	viewManager.onViewSwitch = (viewType) => {
		sidebarNav.setActiveItem('visualization', viewType);
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

	// 12. Mount default view (list)
	await viewManager.switchTo('list', () => viewFactory['list']());

	// 12z. Show active dataset name in command bar subtitle on initial page load (SGFX-03)
	void (async () => {
		try {
			const statsResult = await bridge.send('datasets:stats', {}) as Record<string, unknown>;
			const activeDataset = statsResult['activeDataset'] as { name?: string } | undefined;
			if (activeDataset?.name) {
				shell.getCommandBar().setSubtitle(activeDataset.name);
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

	// 14a-1. Subscribe to MutationManager for view re-render + DataExplorer refresh (BUGF-02)
	//        Any mutation (card create/update/delete, undo, redo) triggers:
	//          - coordinator.scheduleUpdate() → all views re-query from sql.js
	//          - refreshDataExplorer() → Recent Cards list reflects latest state
	mutationManager.subscribe(() => {
		coordinator.scheduleUpdate();
		void refreshDataExplorer();
	});

	// 14b. Mount PropertiesExplorer and ProjectionExplorer into WorkbenchShell sections (Phase 55)
	const propertiesBody = shell.getSectionBody('properties');
	const projectionBody = shell.getSectionBody('projection');

	if (propertiesBody) {
		propertiesBody.textContent = ''; // Clear stub content
	}
	if (projectionBody) {
		projectionBody.textContent = ''; // Clear stub content
	}

	const propertiesExplorer = new PropertiesExplorer({
		alias,
		schema: schemaProvider,
		container: propertiesBody!,
		bridge, // Phase 73: ui:set/ui:get persistence for LATCH overrides (UCFG-03)
		filter, // Phase 73: clear filters on field disable (UCFG-04)
		onCountChange: (_count) => {
			// Optional: could update section badge here
		},
	});
	propertiesExplorer.mount();
	propertiesBody?.classList.add('collapsible-section__body--has-explorer');

	const projectionExplorer = new ProjectionExplorer({
		pafv,
		alias,
		schema: schemaProvider,
		superDensity,
		auditState,
		actionToast,
		container: projectionBody!,
		enabledFieldsGetter: () => propertiesExplorer.getEnabledFields(),
	});
	projectionExplorer.mount();
	projectionBody?.classList.add('collapsible-section__body--has-explorer');

	// Wire PropertiesExplorer toggle changes to re-render ProjectionExplorer
	propertiesExplorer.subscribe(() => projectionExplorer.update());

	// Wire PropertiesExplorer depth changes to re-render SuperGrid
	propertiesExplorer.subscribe(() => coordinator.scheduleUpdate());

	// 14c. Mount LatchExplorers into WorkbenchShell LATCH section (Phase 56)
	const latchBody = shell.getSectionBody('latch');
	if (latchBody) {
		latchBody.textContent = ''; // Clear stub content
	}

	const latchExplorers = new LatchExplorers({
		filter,
		bridge,
		coordinator,
		schema: schemaProvider,
	});
	latchExplorers.mount(latchBody!);
	latchBody?.classList.add('collapsible-section__body--has-explorer');

	// Phase 73: Remount LatchExplorers when LATCH overrides change (UCFG-04)
	// Fields move between family sections, requiring full DOM rebuild.
	// Full destroy+remount is acceptable: override changes are rare user events.
	// CollapsibleSection collapse state persists to localStorage and survives remount.
	schemaProvider.subscribe(() => {
		latchExplorers.destroy();
		latchExplorers.mount(latchBody!);
	});

	// Phase 73: Update ProjectionExplorer when disabled fields change (UCFG-04)
	schemaProvider.subscribe(() => projectionExplorer.update());

	// Phase 91: Migrate legacy notebook:{cardId} ui_state entries to cards.content (one-shot, EDIT-05)
	await migrateNotebookContent(bridge);

	// 14d. Mount NotebookExplorer into WorkbenchShell Notebook section (Phase 57)
	const notebookBody = shell.getSectionBody('notebook');
	if (notebookBody) {
		notebookBody.textContent = ''; // Clear any stub content
	}

	const notebookExplorer = new NotebookExplorer({
		bridge,
		selection,
		filter,
		alias,
		schema: schemaProvider,
		mutations: mutationManager,
	});
	notebookExplorer.mount(notebookBody!);
	notebookBody?.classList.add('collapsible-section__body--has-explorer');

	// Phase 92 CREA-01: Register Cmd+N shortcut for card creation.
	// ShortcutRegistry fires only when focus is NOT in INPUT/TEXTAREA.
	// Component-level handlers in NotebookExplorer cover Cmd+N while in inputs.
	shortcuts.register(
		'Cmd+N',
		() => {
			notebookExplorer.enterCreationMode();
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
			notebookExplorer.enterCreationMode();
		},
	});

	// 14e. Mount CalcExplorer into WorkbenchShell Calc section (Phase 62)
	const calcBody = shell.getSectionBody('calc');
	if (calcBody) {
		calcBody.textContent = ''; // Clear any stub content
	}

	calcExplorer = new CalcExplorer({
		bridge,
		pafv,
		schema: schemaProvider,
		alias,
		container: calcBody!,
		onConfigChange: (_config) => {
			// SuperGrid will read config via calcExplorer.getConfig() in _fetchAndRender
			// Trigger a re-render by notifying via coordinator (existing pattern)
			coordinator.scheduleUpdate();
		},
	});
	calcExplorer.mount();
	calcBody?.classList.add('collapsible-section__body--has-explorer');

	// 14f. Mount AlgorithmExplorer into WorkbenchShell Algorithm section (Phase 116)
	const algorithmBody = shell.getSectionBody('algorithm');
	if (algorithmBody) {
		algorithmBody.textContent = ''; // Clear any stub content
	}

	algorithmExplorer = new AlgorithmExplorer({
		bridge,
		schema: schemaProvider,
		filter,
		container: algorithmBody!,
		coordinator,
		mutationManager,
	});
	algorithmExplorer.mount();
	shell.setSectionState('algorithm', 'ready');

	// Phase 117: Wire AlgorithmExplorer callbacks to NetworkView for algorithm encoding
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

	// Phase 117-02: Wire pick mode changes to NetworkView
	algorithmExplorer.onPickModeChange((mode, sourceId, targetId) => {
		const currentView = viewManager.getCurrentView();
		if (currentView && 'setPickMode' in currentView) {
			const nv = currentView as import('./views/NetworkView').NetworkView;
			nv.setPickMode(mode !== 'idle');
			nv.setPickedNodes(sourceId, targetId);
		}
	});

	// 15. Register collapse-all focus mode shortcut (Cmd+\)
	let savedCollapseState: Map<string, boolean> | null = null;
	const toggleFocusMode = () => {
		if (savedCollapseState === null) {
			savedCollapseState = shell.getSectionStates();
			shell.collapseAll();
		} else {
			shell.restoreSectionStates(savedCollapseState);
			savedCollapseState = null;
		}
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
		auditState.addImportResult(result, source);
		toast.showSuccess(result);
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
		auditState.addImportResult(result, sourceType);
		toast.showSuccess(result);
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
