// Isometry v5 — Phase 149
// WorkbenchShell: thin DOM orchestrator creating the workbench layout.
//
// Requirements: SHEL-01, SHEL-04, SHEL-05, INTG-02, MENU-04
//
// Design:
//   Two primary panels — never overlap:
//     1. .workbench-sidebar  (DockNav — left column)
//     2. .workbench-main     (flex:1 — everything else)
//
//   Inside .workbench-main:
//     - .workbench-data-explorer (toggled above content row when Data is active)
//     - .workbench-main__content (flex-row: [PanelDrawer] [view-content])

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

		// 2. Body wrapper — flex-row: [sidebar] [main]
		//    These two columns NEVER overlap.
		const body = document.createElement('div');
		body.className = 'workbench-body';
		this._el.appendChild(body);

		// 2a. Sidebar — DockNav column (left)
		const sidebar = document.createElement('div');
		sidebar.className = 'workbench-sidebar';
		body.appendChild(sidebar);
		this._sidebarEl = sidebar;

		// 2b. Main area — flex-column (right, fills remaining space)
		const main = document.createElement('div');
		main.className = 'workbench-main';
		body.appendChild(main);

		// Inside main: DataExplorer (toggled) then content row
		const dataExplorerEl = document.createElement('div');
		dataExplorerEl.className = 'workbench-data-explorer';
		dataExplorerEl.style.display = 'none';
		main.appendChild(dataExplorerEl);
		this._dataExplorerEl = dataExplorerEl;

		// Content row: [panel-drawer elements] [view-content]
		const contentRow = document.createElement('div');
		contentRow.className = 'workbench-main__content';
		main.appendChild(contentRow);

		// PanelDrawer mounts into contentRow (creates its own strip/drawer/handle children)
		this._panelDrawer = new PanelDrawer({ registry: config.panelRegistry, bridge: config.bridge });
		this._panelDrawer.mount(contentRow);

		this._viewContentEl = document.createElement('div');
		this._viewContentEl.className = 'workbench-view-content';
		contentRow.appendChild(this._viewContentEl);
	}

	getCommandBar(): CommandBar {
		return this._commandBar;
	}

	getViewContentEl(): HTMLElement {
		return this._viewContentEl;
	}

	getSidebarEl(): HTMLElement {
		return this._sidebarEl;
	}

	getPanelDrawer(): PanelDrawer {
		return this._panelDrawer;
	}

	getDataExplorerEl(): HTMLElement {
		return this._dataExplorerEl;
	}

	getSectionStates(): Map<string, boolean> {
		return new Map();
	}

	restoreSectionStates(_states: Map<string, boolean>): void {
		// No-op stub for LayoutPresetManager compatibility.
	}

	destroy(): void {
		this._commandBar.destroy();
		this._panelDrawer.destroy();
		this._el.remove();
	}
}
