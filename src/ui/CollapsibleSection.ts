// Isometry v5 — Phase 54 Plan 01
// CollapsibleSection: reusable collapsible panel primitive for the workbench shell.
//
// Requirements: SHEL-02, INTG-01, INTG-04
//
// Design:
//   - mount/destroy lifecycle matching HelpOverlay pattern
//   - CSS max-height transition for smooth collapse/expand (~200ms ease-out)
//   - Keyboard accessible: Enter and Space toggle collapsed state
//   - ARIA disclosure pattern: aria-expanded on header button, aria-controls/aria-labelledby
//   - Collapse state persisted to localStorage keyed by `workbench:${storageKey}`
//   - Chevron indicator (▾/▸) reflects expanded/collapsed state
//   - Section body state: 'loading' | 'ready' | 'empty' (Phase 84-06)

import '../styles/workbench.css';
import { iconSvg } from './icons';

export type SectionState = 'loading' | 'ready' | 'empty';

export interface CollapsibleSectionConfig {
	title: string;
	icon: string;
	storageKey: string;
	defaultCollapsed?: boolean;
	stubContent?: string;
	emptyContent?: string;
	count?: number;
}

/**
 * CollapsibleSection is the core building block for explorer panels in the
 * workbench shell. Each section has a clickable header with chevron, optional
 * count badge, and an animated body region.
 *
 * mount(container) creates the DOM structure.
 * destroy() removes DOM and cleans up event listeners.
 */
export class CollapsibleSection {
	private readonly _config: CollapsibleSectionConfig;
	private _collapsed: boolean;
	private _sectionState: SectionState = 'loading';
	private _rootEl: HTMLElement | null = null;
	private _headerEl: HTMLButtonElement | null = null;
	private _chevronEl: HTMLElement | null = null;
	private _countEl: HTMLElement | null = null;
	private _bodyEl: HTMLElement | null = null;
	private _stateEl: HTMLElement | null = null;

	// Event handler references for cleanup
	private _clickHandler: (() => void) | null = null;
	private _keydownHandler: ((e: KeyboardEvent) => void) | null = null;

	constructor(config: CollapsibleSectionConfig) {
		this._config = config;

		// Read persisted state from localStorage
		const stored = localStorage.getItem(`workbench:${config.storageKey}`);
		this._collapsed = stored !== null ? stored === 'true' : (config.defaultCollapsed ?? false);
	}

	/**
	 * Create DOM structure and append to container.
	 *
	 * DOM hierarchy:
	 * ```
	 * .collapsible-section[data-section="{storageKey}"]
	 *   button.collapsible-section__header#section-{storageKey}-header
	 *     span.collapsible-section__chevron
	 *     span.collapsible-section__title
	 *     span.collapsible-section__count
	 *   .collapsible-section__body#section-{storageKey}-body[role="region"]
	 *     .collapsible-section__stub (optional)
	 *       span.collapsible-section__stub-icon
	 *       span.collapsible-section__stub-text
	 * ```
	 */
	mount(container: HTMLElement): void {
		const { title, icon, storageKey, stubContent, emptyContent, count } = this._config;

		// Root element
		const root = document.createElement('div');
		root.className = 'collapsible-section';
		root.setAttribute('data-section', storageKey);

		// Header button
		const header = document.createElement('button');
		header.className = 'collapsible-section__header';
		header.id = `section-${storageKey}-header`;
		header.type = 'button';
		header.setAttribute('aria-expanded', String(!this._collapsed));
		header.setAttribute('aria-controls', `section-${storageKey}-body`);

		// Chevron
		const chevron = document.createElement('span');
		chevron.className = 'collapsible-section__chevron';
		chevron.textContent = this._collapsed ? '\u25B8' : '\u25BE';

		// Title
		const titleEl = document.createElement('span');
		titleEl.className = 'collapsible-section__title';
		titleEl.textContent = title;

		// Count badge
		const countEl = document.createElement('span');
		countEl.className = 'collapsible-section__count';
		if (count != null && count > 0) {
			countEl.textContent = `(${count})`;
			countEl.style.display = '';
		} else {
			countEl.textContent = '(0)';
			countEl.style.display = 'none';
		}

		header.appendChild(chevron);
		header.appendChild(titleEl);
		header.appendChild(countEl);

		// Body region
		const body = document.createElement('div');
		body.className = 'collapsible-section__body';
		body.id = `section-${storageKey}-body`;
		body.setAttribute('role', 'region');
		body.setAttribute('aria-labelledby', `section-${storageKey}-header`);

		// Legacy stub content (optional — preserved for backward compat, non-explorer sections)
		if (stubContent) {
			const stub = document.createElement('div');
			stub.className = 'collapsible-section__stub';

			const stubIcon = document.createElement('span');
			stubIcon.className = 'collapsible-section__stub-icon';
			stubIcon.innerHTML = iconSvg(icon, 14);

			const stubText = document.createElement('span');
			stubText.className = 'collapsible-section__stub-text';
			stubText.textContent = stubContent;

			stub.appendChild(stubIcon);
			stub.appendChild(stubText);
			body.appendChild(stub);
			// Stub sections are implicitly 'ready' (no dynamic mount)
			this._sectionState = 'ready';
		}

		// State overlay element (used for loading/empty states on explorer-backed sections)
		const stateEl = document.createElement('div');
		stateEl.className = 'collapsible-section__state';
		stateEl.setAttribute('aria-hidden', 'true');
		body.appendChild(stateEl);
		this._stateEl = stateEl;

		// Apply empty content string if provided
		if (emptyContent) {
			const emptyText = document.createElement('span');
			emptyText.className = 'collapsible-section__empty-text';
			emptyText.textContent = emptyContent;
			stateEl.appendChild(emptyText);
		}

		root.appendChild(header);
		root.appendChild(body);

		// Apply collapsed state
		if (this._collapsed) {
			root.classList.add('collapsible-section--collapsed');
		}

		// Store references
		this._rootEl = root;
		this._headerEl = header;
		this._chevronEl = chevron;
		this._countEl = countEl;
		this._bodyEl = body;

		// Apply initial section state to DOM
		this._applyState();

		// Event listeners
		this._clickHandler = () => this._toggle();
		header.addEventListener('click', this._clickHandler);

		this._keydownHandler = (e: KeyboardEvent) => {
			if (e.key === 'Enter' || e.key === ' ') {
				e.preventDefault();
				this._toggle();
			}
		};
		header.addEventListener('keydown', this._keydownHandler);

		container.appendChild(root);
	}

	/**
	 * Programmatically set collapsed state. Persists to localStorage.
	 */
	setCollapsed(v: boolean): void {
		this._collapsed = v;
		localStorage.setItem(`workbench:${this._config.storageKey}`, String(v));
		this._updateDOM();
	}

	/**
	 * Get current collapsed state.
	 */
	getCollapsed(): boolean {
		return this._collapsed;
	}

	/**
	 * Update count badge dynamically.
	 */
	setCount(n: number): void {
		if (!this._countEl) return;
		if (n > 0) {
			this._countEl.textContent = `(${n})`;
			this._countEl.style.display = '';
		} else {
			this._countEl.textContent = '(0)';
			this._countEl.style.display = 'none';
		}
	}

	/**
	 * Access the root element (null if not mounted or destroyed).
	 */
	getElement(): HTMLElement | null {
		return this._rootEl;
	}

	/**
	 * Access the body element for direct mounting (null if not mounted or destroyed).
	 */
	getBodyEl(): HTMLElement | null {
		return this._bodyEl;
	}

	/**
	 * Set the section body state. Idempotent — safe to call multiple times with same state.
	 *
	 * - 'loading' — neutral blank body, no stub text, state overlay hidden
	 * - 'ready'   — explorer mounted: hide state overlay, body visible
	 * - 'empty'   — intentionally unpopulated: show emptyContent if configured
	 */
	setState(state: SectionState): void {
		if (this._sectionState === state) return;
		this._sectionState = state;
		this._applyState();
	}

	/**
	 * Get the current section body state.
	 */
	getSectionState(): SectionState {
		return this._sectionState;
	}

	/**
	 * Replace all body content with the provided element.
	 * Clears existing children (including stub content) and appends the new element.
	 * No-op if the section is not mounted.
	 */
	setContent(el: HTMLElement): void {
		if (!this._bodyEl) return;
		this._bodyEl.textContent = '';
		this._bodyEl.appendChild(el);
	}

	/**
	 * Remove DOM element and clean up event listeners.
	 */
	destroy(): void {
		if (this._headerEl) {
			if (this._clickHandler) {
				this._headerEl.removeEventListener('click', this._clickHandler);
				this._clickHandler = null;
			}
			if (this._keydownHandler) {
				this._headerEl.removeEventListener('keydown', this._keydownHandler);
				this._keydownHandler = null;
			}
		}

		if (this._rootEl) {
			this._rootEl.remove();
			this._rootEl = null;
		}

		this._headerEl = null;
		this._chevronEl = null;
		this._countEl = null;
		this._bodyEl = null;
		this._stateEl = null;
	}

	// ---------------------------------------------------------------------------
	// Private
	// ---------------------------------------------------------------------------

	/**
	 * Sync state overlay DOM with current _sectionState.
	 * - loading: state element hidden, no data-state attribute
	 * - ready:   state element hidden, body has 'has-explorer' modifier
	 * - empty:   state element visible with empty content
	 */
	private _applyState(): void {
		if (!this._rootEl || !this._bodyEl || !this._stateEl) return;

		// Remove all state modifiers
		this._rootEl.removeAttribute('data-section-state');
		this._stateEl.style.display = 'none';

		switch (this._sectionState) {
			case 'loading':
				this._rootEl.setAttribute('data-section-state', 'loading');
				this._stateEl.style.display = 'none';
				break;
			case 'ready':
				this._rootEl.setAttribute('data-section-state', 'ready');
				this._bodyEl.classList.add('collapsible-section__body--has-explorer');
				this._stateEl.style.display = 'none';
				break;
			case 'empty':
				this._rootEl.setAttribute('data-section-state', 'empty');
				this._stateEl.style.display = '';
				break;
		}
	}

	/**
	 * Toggle collapsed state (used by click and keyboard handlers).
	 */
	private _toggle(): void {
		this.setCollapsed(!this._collapsed);
	}

	/**
	 * Sync DOM with current collapsed state.
	 */
	private _updateDOM(): void {
		if (!this._rootEl || !this._headerEl || !this._chevronEl) return;

		if (this._collapsed) {
			this._rootEl.classList.add('collapsible-section--collapsed');
			this._headerEl.setAttribute('aria-expanded', 'false');
			this._chevronEl.textContent = '\u25B8'; // ▸
		} else {
			this._rootEl.classList.remove('collapsible-section--collapsed');
			this._headerEl.setAttribute('aria-expanded', 'true');
			this._chevronEl.textContent = '\u25BE'; // ▾
		}
	}
}
