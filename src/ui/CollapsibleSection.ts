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

import '../styles/workbench.css';

export interface CollapsibleSectionConfig {
	title: string;
	icon: string;
	storageKey: string;
	defaultCollapsed?: boolean;
	stubContent?: string;
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
	private _rootEl: HTMLElement | null = null;
	private _headerEl: HTMLButtonElement | null = null;
	private _chevronEl: HTMLElement | null = null;
	private _countEl: HTMLElement | null = null;
	private _bodyEl: HTMLElement | null = null;

	// Event handler references for cleanup
	private _clickHandler: (() => void) | null = null;
	private _keydownHandler: ((e: KeyboardEvent) => void) | null = null;

	constructor(config: CollapsibleSectionConfig) {
		this._config = config;

		// Read persisted state from localStorage
		const stored = localStorage.getItem(`workbench:${config.storageKey}`);
		this._collapsed =
			stored !== null ? stored === 'true' : (config.defaultCollapsed ?? false);
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
		const { title, icon, storageKey, stubContent, count } = this._config;

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

		// Stub content (optional)
		if (stubContent) {
			const stub = document.createElement('div');
			stub.className = 'collapsible-section__stub';

			const stubIcon = document.createElement('span');
			stubIcon.className = 'collapsible-section__stub-icon';
			stubIcon.textContent = icon;

			const stubText = document.createElement('span');
			stubText.className = 'collapsible-section__stub-text';
			stubText.textContent = stubContent;

			stub.appendChild(stubIcon);
			stub.appendChild(stubText);
			body.appendChild(stub);
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
		localStorage.setItem(
			`workbench:${this._config.storageKey}`,
			String(v),
		);
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
	}

	// ---------------------------------------------------------------------------
	// Private
	// ---------------------------------------------------------------------------

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
