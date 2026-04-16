// Isometry v5 — Phase 151
// WorkbenchShell: thin DOM orchestrator creating the workbench layout.
//
// Design:
//   Two primary panels — never overlap:
//     1. .workbench-sidebar  (DockNav — left column)
//     2. .workbench-main     (flex:1 — everything else)
//
//   Inside .workbench-main:
//     - .workbench-main__content (flex-col: [slot-top] [view-content] [slot-bottom])

import '../styles/workbench.css';

import type { CommandBarConfig } from './CommandBar';
import { CommandBar } from './CommandBar';
import type { PanelRegistry } from './panels/PanelRegistry';

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
	private _panelRegistry: PanelRegistry;
	private _viewContentEl: HTMLElement;
	private _sidebarEl: HTMLElement;
	private _topSlotEl: HTMLElement;
	private _bottomSlotEl: HTMLElement;

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

		// Content stack: [slot-top] [view-content] [slot-bottom]
		const contentRow = document.createElement('div');
		contentRow.className = 'workbench-main__content';
		main.appendChild(contentRow);

		// Top slot — inline embedding container (populated Phase 152)
		const topSlot = document.createElement('div');
		topSlot.className = 'workbench-slot-top';
		topSlot.style.display = 'none';
		contentRow.appendChild(topSlot);
		this._topSlotEl = topSlot;

		this._viewContentEl = document.createElement('div');
		this._viewContentEl.className = 'workbench-view-content';
		contentRow.appendChild(this._viewContentEl);

		// Bottom slot — inline embedding container (populated Phase 153)
		const bottomSlot = document.createElement('div');
		bottomSlot.className = 'workbench-slot-bottom';
		bottomSlot.style.display = 'none';
		contentRow.appendChild(bottomSlot);
		this._bottomSlotEl = bottomSlot;

		this._panelRegistry = config.panelRegistry;
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

	getTopSlotEl(): HTMLElement {
		return this._topSlotEl;
	}

	getBottomSlotEl(): HTMLElement {
		return this._bottomSlotEl;
	}

	getPanelRegistry(): PanelRegistry {
		return this._panelRegistry;
	}

	getSectionStates(): Map<string, boolean> {
		return new Map();
	}

	restoreSectionStates(_states: Map<string, boolean>): void {
		// No-op stub for LayoutPresetManager compatibility.
	}

	destroy(): void {
		this._commandBar.destroy();
		this._el.remove();
	}
}
