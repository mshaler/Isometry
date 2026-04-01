// Isometry v5 — Phase 54 Plan 03 (updated Phase 86 Plan 01, Phase 135.1 Plan 03)
// WorkbenchShell: thin DOM orchestrator creating the two-column workbench layout.
//
// Requirements: SHEL-01, SHEL-04, SHEL-05, INTG-02, MENU-04
//
// Design:
//   - Creates .workbench-shell flex-column container under root (#app)
//   - DOM order: CommandBar -> .workbench-body (flex-row)
//       - .workbench-sidebar (resizable, contains nav + sections)
//           - .workbench-sidebar__nav  (SidebarNav mount point)
//           - .workbench-sidebar__sections (6 CollapsibleSections)
//           - .workbench-sidebar__resize-handle (drag to resize)
//       - .workbench-main (flex: 1, flex-column)
//           - view-content
//   - Exposes getViewContentEl() for ViewManager re-rooting
//   - Exposes getSidebarEl() for SidebarNav mounting (returns navContainer)
//   - Exposes getSectionsEl() for DataExplorer panel mounting
//   - collapseAll() / getSectionStates() / restoreSectionStates() for focus mode toggle
//   - destroy() tears down CommandBar, all CollapsibleSections, and removes .workbench-shell
//   - Explorer-backed sections (Properties/Projection/LATCH) start in 'loading' state (Phase 84-06)

import '../styles/workbench.css';

import type { CollapsibleSectionConfig, SectionState } from './CollapsibleSection';
import { CollapsibleSection } from './CollapsibleSection';
import type { CommandBarConfig } from './CommandBar';
import { CommandBar } from './CommandBar';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export interface WorkbenchShellConfig {
	commandBarConfig: CommandBarConfig;
	bridge: { send: (type: string, payload: Record<string, unknown>) => Promise<unknown> };
}

// ---------------------------------------------------------------------------
// Section definitions — matching D3 Spec v2 DOM hierarchy
// ---------------------------------------------------------------------------

// Explorer-backed section keys — start in 'loading' state, no stub text.
const EXPLORER_SECTION_KEYS = new Set(['properties', 'projection', 'latch']);

const SECTION_CONFIGS: CollapsibleSectionConfig[] = [
	{ title: 'Notebook', icon: 'notebook-pen', storageKey: 'notebook', defaultCollapsed: true },
	{ title: 'Properties', icon: 'sliders', storageKey: 'properties' },
	{ title: 'Projection', icon: 'layout-template', storageKey: 'projection' },
	{ title: 'LATCH', icon: 'tag', storageKey: 'latch' },
	{ title: 'Calc', icon: 'sigma', storageKey: 'calc', defaultCollapsed: true },
	{ title: 'Algorithm', icon: 'brain', storageKey: 'algorithm', defaultCollapsed: true },
];

// ---------------------------------------------------------------------------
// WorkbenchShell
// ---------------------------------------------------------------------------

/**
 * WorkbenchShell is the top-level DOM orchestrator for the workbench layout.
 *
 * It creates a flex-column container (.workbench-shell) under the provided root
 * element and populates it with: CommandBar, tab-bar-slot, panel-rail (5
 * CollapsibleSection instances), and view-content.  (6 sections as of v9.x)
 *
 * WorkbenchShell introduces zero business logic — it only wires UI triggers
 * to callbacks provided via config.
 */
export class WorkbenchShell {
	private _el: HTMLElement;
	private _commandBar: CommandBar;
	private _viewContentEl: HTMLElement;
	private _navContainerEl: HTMLElement;
	private _sectionsContainerEl: HTMLElement;
	private _sections: CollapsibleSection[];

	constructor(root: HTMLElement, config: WorkbenchShellConfig) {
		// Create .workbench-shell flex-column container
		this._el = document.createElement('div');
		this._el.className = 'workbench-shell';
		root.appendChild(this._el);

		// 1. CommandBar — first child (full width)
		this._commandBar = new CommandBar(config.commandBarConfig);
		this._commandBar.mount(this._el);

		// 2. Body wrapper — flex-row for two-column layout (Phase 86: MENU-04)
		const body = document.createElement('div');
		body.className = 'workbench-body';
		this._el.appendChild(body);

		// 2a. Sidebar column — resizable, contains nav + sections + drag handle
		const sidebar = document.createElement('div');
		sidebar.className = 'workbench-sidebar';
		body.appendChild(sidebar);

		// Nav container — SidebarNav mounts here
		const navContainer = document.createElement('div');
		navContainer.className = 'workbench-sidebar__nav';
		sidebar.appendChild(navContainer);
		this._navContainerEl = navContainer;

		// Sections container — CollapsibleSections mount here
		const sectionsContainer = document.createElement('div');
		sectionsContainer.className = 'workbench-sidebar__sections';
		sidebar.appendChild(sectionsContainer);
		this._sectionsContainerEl = sectionsContainer;

		// Resize handle
		const resizeHandle = document.createElement('div');
		resizeHandle.className = 'workbench-sidebar__resize-handle';
		resizeHandle.setAttribute('aria-label', 'Resize sidebar');
		resizeHandle.setAttribute('title', 'Drag to resize sidebar');
		sidebar.appendChild(resizeHandle);

		// Create 6 CollapsibleSection instances in sections container
		this._sections = SECTION_CONFIGS.map((sectionConfig) => {
			const section = new CollapsibleSection(sectionConfig);
			section.mount(sectionsContainer);
			// Explorer-backed sections start in loading state (no stub text)
			if (EXPLORER_SECTION_KEYS.has(sectionConfig.storageKey)) {
				section.setState('loading');
			}
			// Tour target anchors for guided tour (Phase 134)
			if (sectionConfig.storageKey === 'latch') {
				section.getElement()?.setAttribute('data-tour-target', 'latch-explorers');
			} else if (sectionConfig.storageKey === 'notebook') {
				section.getElement()?.setAttribute('data-tour-target', 'notebook-explorer');
			}
			return section;
		});

		// 2b. Main column — flex: 1, view content only (no panel rail)
		const main = document.createElement('div');
		main.className = 'workbench-main';
		body.appendChild(main);

		// 3. View content — flex-grow view container (inside main column)
		this._viewContentEl = document.createElement('div');
		this._viewContentEl.className = 'workbench-view-content';
		main.appendChild(this._viewContentEl);

		// Sidebar resize drag logic
		let dragging = false;
		let clamped = 280;
		resizeHandle.addEventListener('mousedown', () => {
			dragging = true;
			sidebar.style.transition = 'none';

			const onMouseMove = (e: MouseEvent) => {
				if (!dragging) return;
				const newWidth = e.clientX - sidebar.getBoundingClientRect().left;
				clamped = Math.max(200, Math.min(480, newWidth));
				sidebar.style.width = `${clamped}px`;
			};

			const onMouseUp = () => {
				dragging = false;
				sidebar.style.removeProperty('transition');
				document.removeEventListener('mousemove', onMouseMove);
				document.removeEventListener('mouseup', onMouseUp);
				void config.bridge.send('ui:set', { key: 'sidebar:width', value: String(clamped) });
			};

			document.addEventListener('mousemove', onMouseMove);
			document.addEventListener('mouseup', onMouseUp);
		});

		// Restore persisted sidebar width
		void config.bridge.send('ui:get', { key: 'sidebar:width' }).then((row) => {
			const value = (row as { value?: string | null } | null)?.value;
			const width = value ? parseInt(value, 10) : 280;
			const clampedWidth = Math.max(200, Math.min(480, isNaN(width) ? 280 : width));
			sidebar.style.width = `${clampedWidth}px`;
		});
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
	 * Returns the .workbench-sidebar__nav element for SidebarNav mounting.
	 */
	getSidebarEl(): HTMLElement {
		return this._navContainerEl;
	}

	/**
	 * Returns the .workbench-sidebar__sections element for Data Explorer panel mounting.
	 */
	getSectionsEl(): HTMLElement {
		return this._sectionsContainerEl;
	}

	/**
	 * Get the body element of a section by its storageKey.
	 * Returns null if the storageKey is not found.
	 */
	getSectionBody(storageKey: string): HTMLElement | null {
		const index = SECTION_CONFIGS.findIndex((c) => c.storageKey === storageKey);
		if (index === -1) return null;
		return this._sections[index]!.getBodyEl();
	}

	/**
	 * Transition a section's body state. Call setState('ready') after an explorer mounts.
	 *
	 * Also adds the collapsible-section__body--has-explorer class when state is 'ready'
	 * to sync with Plan 02's CSS fallback.
	 *
	 * No-op if storageKey is not found.
	 */
	setSectionState(storageKey: string, state: SectionState): void {
		const index = SECTION_CONFIGS.findIndex((c) => c.storageKey === storageKey);
		if (index === -1) return;
		const section = this._sections[index]!;
		section.setState(state);
		// Sync the has-explorer class on the body element when transitioning to ready
		if (state === 'ready') {
			const bodyEl = section.getBodyEl();
			if (bodyEl) {
				bodyEl.classList.add('collapsible-section__body--has-explorer');
			}
		}
	}

	/**
	 * Collapse all 5 sections in the panel rail (focus mode).
	 */
	collapseAll(): void {
		for (const section of this._sections) {
			section.setCollapsed(true);
		}
	}

	/**
	 * Get the current collapsed state of all sections.
	 * Returns Map<storageKey, collapsed>.
	 */
	getSectionStates(): Map<string, boolean> {
		const states = new Map<string, boolean>();
		for (let i = 0; i < this._sections.length; i++) {
			const key = SECTION_CONFIGS[i]!.storageKey;
			states.set(key, this._sections[i]!.getCollapsed());
		}
		return states;
	}

	/**
	 * Restore section collapsed states from a saved Map.
	 */
	restoreSectionStates(states: Map<string, boolean>): void {
		for (let i = 0; i < this._sections.length; i++) {
			const key = SECTION_CONFIGS[i]!.storageKey;
			const collapsed = states.get(key);
			if (collapsed !== undefined) {
				this._sections[i]!.setCollapsed(collapsed);
			}
		}
	}

	/**
	 * Tear down the shell: destroy CommandBar and all CollapsibleSections,
	 * remove .workbench-shell from DOM.
	 */
	destroy(): void {
		this._commandBar.destroy();
		for (const section of this._sections) {
			section.destroy();
		}
		this._sections = [];
		this._el.remove();
	}
}
