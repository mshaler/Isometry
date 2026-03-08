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
	SelectionProvider,
	StateCoordinator,
	ThemeProvider,
} from './providers';
import { AliasProvider } from './providers/AliasProvider';
import { SuperDensityProvider } from './providers/SuperDensityProvider';
import { SuperPositionProvider } from './providers/SuperPositionProvider';
import { HelpOverlay, ShortcutRegistry } from './shortcuts';
import { ActionToast } from './ui/ActionToast';
import { ImportToast } from './ui/ImportToast';
import { LatchExplorers } from './ui/LatchExplorers';
import { NotebookExplorer } from './ui/NotebookExplorer';
import { ProjectionExplorer } from './ui/ProjectionExplorer';
import { PropertiesExplorer } from './ui/PropertiesExplorer';
import { ViewTabBar } from './ui/ViewTabBar';
import { VisualExplorer } from './ui/VisualExplorer';
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
import type { SuperGridSelectionLike } from './views/types';
import { createWorkerBridge } from './worker';
import { SampleDataManager } from './sample/SampleDataManager';
import type { SampleDataset } from './sample/types';
import appleRevenue from './sample/datasets/apple-revenue.json';
import northwind from './sample/datasets/northwind.json';
import merylStreep from './sample/datasets/meryl-streep.json';

async function main(): Promise<void> {
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
	// exactOptionalPropertyTypes: only pass properties that have values
	const bridgeConfig = {
		...(wasmBinary !== undefined && { wasmBinary }),
		...(dbData !== undefined && { dbData }),
	};
	const bridge = createWorkerBridge(bridgeConfig);
	await bridge.isReady;

	// 2a. Create SampleDataManager (datasets injected, wired in step 12b)
	const sampleDatasets = [appleRevenue, northwind, merylStreep] as SampleDataset[];
	const sampleManager = new SampleDataManager(bridge, sampleDatasets);
	let sampleDataLoaded = await sampleManager.hasSampleData();

	// 3. Create providers
	const filter = new FilterProvider();
	const pafv = new PAFVProvider();
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
	coordinator.registerProvider('superDensity', superDensity);

	// 6c. Create AliasProvider — display aliases for AxisField values (Phase 55).
	//     Persists via StateCoordinator Tier 2 for display name round-trip.
	const alias = new AliasProvider();
	coordinator.registerProvider('alias', alias);

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

	// Forward-declared viewManager — assigned after WorkbenchShell creation.
	// Closures in shortcuts/commands capture the variable reference (not value).
	let viewManager: ViewManager;

	viewOrder.forEach((viewType, index) => {
		const num = index + 1;
		const displayName = viewType.charAt(0).toUpperCase() + viewType.slice(1);
		shortcuts.register(
			`Cmd+${num}`,
			() => {
				void viewManager.switchTo(viewType, () => viewFactory[viewType]());
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
				void viewManager.switchTo(viewType, () => viewFactory[viewType]());
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
		label: 'Cycle Theme (Dark / Light / System)',
		category: 'Settings',
		shortcut: 'Cmd+Shift+T',
		execute: () => {
			const modes: ThemeMode[] = ['dark', 'light', 'system'];
			const current = modes.indexOf(theme.theme);
			const next = modes[(current + 1) % modes.length]!;
			theme.setTheme(next);
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
			onCycleTheme: () => {
				const modes: ThemeMode[] = ['dark', 'light', 'system'];
				const current = modes.indexOf(theme.theme);
				const next = modes[(current + 1) % modes.length]!;
				theme.setTheme(next);
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
			getThemeLabel: () => theme.theme.charAt(0).toUpperCase() + theme.theme.slice(1),
			getDensityLabel: () => {
				const g = density.getState().granularity;
				return g.charAt(0).toUpperCase() + g.slice(1);
			},
		},
	});

	// 9a. Create VisualExplorer — mounts inside shell's view-content div,
	//     provides zoom rail alongside SuperGrid content area.
	const visualExplorer = new VisualExplorer({
		positionProvider: superPosition,
	});
	visualExplorer.mount(shell.getViewContentEl());
	visualExplorer.setZoomRailVisible(false); // Default view is 'list', not 'supergrid'

	// 10. Create ViewManager with visualExplorer.getContentEl() (re-rooted into inner content)
	viewManager = new ViewManager({
		container: visualExplorer.getContentEl(),
		coordinator,
		queryBuilder,
		bridge,
		pafv,
		filter,
		announcer,
	});

	// 10a. Mount AuditOverlay — toggle button + keyboard shortcut (Phase 37)
	//      Stays on #app container (button is fixed-position, .audit-mode toggles on container)
	const auditOverlay = new AuditOverlay(auditState);
	auditOverlay.mount(container);

	// 10b. Create AuditLegend and wire to overlay (Phase 37)
	const auditLegend = new AuditLegend(container);
	auditOverlay.setLegend(auditLegend);

	// 11. View tab bar — mounts into WorkbenchShell's dedicated slot
	const viewTabBar = new ViewTabBar({
		container: shell.getViewContentEl(),
		onSwitch: (viewType) => {
			void viewManager.switchTo(viewType, () => viewFactory[viewType]());
		},
		mountTarget: shell.getTabBarSlot(),
	});

	// 11a. Wire ViewManager to update tab bar + zoom rail visibility on view switch
	viewManager.onViewSwitch = (viewType) => {
		viewTabBar.setActive(viewType);
		visualExplorer.setZoomRailVisible(viewType === 'supergrid');
	};

	// 12. Mount default view (list)
	await viewManager.switchTo('list', () => viewFactory['list']());

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
			await sampleManager.load(datasetId);
			sampleDataLoaded = true;
			coordinator.scheduleUpdate();
			// Navigate to dataset's showcase view
			const dataset = sampleManager.getDatasets().find((d) => d.id === datasetId);
			if (dataset) {
				await viewManager.switchTo(dataset.defaultView, () => viewFactory[dataset.defaultView]());
			}
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
		container: propertiesBody!,
		onCountChange: (_count) => {
			// Optional: could update section badge here
		},
	});
	propertiesExplorer.mount();

	const projectionExplorer = new ProjectionExplorer({
		pafv,
		alias,
		superDensity,
		auditState,
		actionToast,
		container: projectionBody!,
		enabledFieldsGetter: () => propertiesExplorer.getEnabledFields(),
	});
	projectionExplorer.mount();

	// Wire PropertiesExplorer toggle changes to re-render ProjectionExplorer
	propertiesExplorer.subscribe(() => projectionExplorer.update());

	// 14c. Mount LatchExplorers into WorkbenchShell LATCH section (Phase 56)
	const latchBody = shell.getSectionBody('latch');
	if (latchBody) {
		latchBody.textContent = ''; // Clear stub content
	}

	const latchExplorers = new LatchExplorers({
		filter,
		bridge,
		coordinator,
	});
	latchExplorers.mount(latchBody!);

	// 14d. Mount NotebookExplorer into WorkbenchShell Notebook section (Phase 57)
	const notebookBody = shell.getSectionBody('notebook');
	if (notebookBody) {
		notebookBody.textContent = ''; // Clear any stub content
	}

	const notebookExplorer = new NotebookExplorer();
	notebookExplorer.mount(notebookBody!);

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
			const clearIt = confirm('You have sample data loaded. Clear it before importing?');
			if (clearIt) {
				await sampleManager.clear();
				sampleDataLoaded = false;
			}
		}
		const result = await originalImportFile(source, data, options);
		auditState.addImportResult(result, source);
		toast.showSuccess(result);
		return result;
	};
	const originalImportNative = bridge.importNative.bind(bridge);
	bridge.importNative = async (sourceType, cards) => {
		// SMPL-07: Prompt to clear sample data before first native import
		if (sampleDataLoaded) {
			const clearIt = confirm('You have sample data loaded. Clear it before importing?');
			if (clearIt) {
				await sampleManager.clear();
				sampleDataLoaded = false;
			}
		}
		const result = await originalImportNative(sourceType, cards);
		auditState.addImportResult(result, sourceType);
		toast.showSuccess(result);
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
		sampleManager,
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
