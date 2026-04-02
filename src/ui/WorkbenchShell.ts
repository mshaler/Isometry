// Isometry v5 — Phase 54 Plan 03 (updated Phase 135.2 Plan 02)
// WorkbenchShell: thin DOM orchestrator creating the workbench layout.
//
// Requirements: SHEL-01, SHEL-04, SHEL-05, INTG-02, MENU-04
//
// Design:
//   - Creates .workbench-shell flex-column container under root (#app)
//   - DOM order: CommandBar -> .workbench-body (flex-row)
//       - .workbench-sidebar (200px fixed, SidebarNav)
//       - icon-strip (40px, from PanelDrawer)
//       - drawer (from PanelDrawer)
//       - resize-handle (from PanelDrawer)
//       - .workbench-data-explorer (hidden by default, toggled via sidebar)
//       - .workbench-view-content (flex:1)
//   - Panel rail removed — replaced by PanelDrawer (Phase 135.2)
//   - getSectionStates/restoreSectionStates kept for LayoutPresetManager compatibility
//   - destroy() tears down CommandBar, PanelDrawer, and removes .workbench-shell

import '../styles/workbench.css';

import type { CommandBarConfig } from './CommandBar';
import { CommandBar } from './CommandBar';
import type { PanelRegistry } from './panels/PanelRegistry';
import { PanelDrawer } from './panels/PanelDrawer';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export interface WorkbenchShellConfig {
	commandBarConfig: CommandBarConfig;
	panelRegistry: PanelRegistry;
	bridge: { send(cmd: string, payload: unknown): Promise<unknown> };
}

// ---------------------------------------------------------------------------
// WorkbenchShell
// ---------------------------------------------------------------------------

/**
 * WorkbenchShell is the top-level DOM orchestrator for the workbench layout.
 *
 * Creates a flex-column container (.workbench-shell) under the provided root
 * and populates it with: CommandBar, then a flex-row body containing sidebar,
 * PanelDrawer (icon strip + collapsible drawer + resize handle), a dedicated
 * DataExplorer container, and view-content.
 *
 * WorkbenchShell introduces zero business logic.
 */
export class WorkbenchShell {
	private _el: HTMLElement;
	private _commandBar: CommandBar;
	private _panelDrawer: PanelDrawer;
	private _viewContentEl: HTMLElement;
	private _sidebarEl: HTMLElement;
	private _dataExplorerEl: HTMLElement;

	constructor(root: HTMLElement, config: WorkbenchShellConfig) {
		// Create .workbench-shell flex-column container
		this._el = document.createElement('div');
		this._el.className = 'workbench-shell';
		root.appendChild(this._el);

		// 1. CommandBar — first child (full width)
		this._commandBar = new CommandBar(config.commandBarConfig);
		this._commandBar.mount(this._el);

		// 2. Body wrapper — flex-row
		const body = document.createElement('div');
		body.className = 'workbench-body';
		this._el.appendChild(body);

		// 2a. Sidebar column — 200px fixed width
		const sidebar = document.createElement('div');
		sidebar.className = 'workbench-sidebar';
		body.appendChild(sidebar);
		this._sidebarEl = sidebar;

		// 2b. PanelDrawer — mounts icon strip, drawer, and resize handle into body
		this._panelDrawer = new PanelDrawer({ registry: config.panelRegistry, bridge: config.bridge });
		this._panelDrawer.mount(body);

		// 2c. DataExplorer container — hidden by default, shown via sidebar toggle
		const dataExplorerEl = document.createElement('div');
		dataExplorerEl.className = 'workbench-data-explorer';
		dataExplorerEl.style.display = 'none';
		body.appendChild(dataExplorerEl);
		this._dataExplorerEl = dataExplorerEl;

		// 2d. View content — flex-grow view container
		this._viewContentEl = document.createElement('div');
		this._viewContentEl.className = 'workbench-view-content';
		body.appendChild(this._viewContentEl);
	}

	/**
	 * Returns the CommandBar instance for direct method calls (e.g. setSubtitle).
	 */
	getCommandBar(): CommandBar {
		return this._commandBar;
	}

	/**
	 * Returns the .workbench-view-content element for ViewManager mounting.
	 */
	getViewContentEl(): HTMLElement {
		return this._viewContentEl;
	}

	/**
	 * Returns the .workbench-sidebar element for SidebarNav mounting.
	 */
	getSidebarEl(): HTMLElement {
		return this._sidebarEl;
	}

	/**
	 * Returns the PanelDrawer instance.
	 */
	getPanelDrawer(): PanelDrawer {
		return this._panelDrawer;
	}

	/**
	 * Returns the dedicated DataExplorer container element.
	 * DataExplorer is NOT a panel plugin — it is shown/hidden via the sidebar
	 * data-explorer section toggle (style.display block/none).
	 */
	getDataExplorerEl(): HTMLElement {
		return this._dataExplorerEl;
	}

	/**
	 * Get the current collapsed state of all sections (no-op stub for LayoutPresetManager).
	 * Returns an empty Map — section state is no longer tracked in WorkbenchShell.
	 */
	getSectionStates(): Map<string, boolean> {
		return new Map();
	}

	/**
	 * Restore section collapsed states from a saved Map (no-op stub for LayoutPresetManager).
	 */
	restoreSectionStates(_states: Map<string, boolean>): void {
		// Section state is no longer managed here — PanelDrawer owns panel visibility.
	}

	/**
	 * Tear down the shell: destroy CommandBar and PanelDrawer, remove .workbench-shell from DOM.
	 */
	destroy(): void {
		this._commandBar.destroy();
		this._panelDrawer.destroy();
		this._el.remove();
	}
}
