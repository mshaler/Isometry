// Isometry v5 — Phase 44 Plan 02
// Help overlay component showing all registered keyboard shortcuts.
//
// Requirements: KEYS-03
//
// Design:
//   - Reads shortcuts from ShortcutRegistry.getAll()
//   - Groups shortcuts by category
//   - Toggled by ? key (registered through ShortcutRegistry)
//   - Escape key closes overlay (separate keydown listener)
//   - Follows AuditOverlay pattern: mount/destroy lifecycle

import '../styles/help-overlay.css';
import type { ShortcutRegistry } from './ShortcutRegistry';

/**
 * HelpOverlay displays all registered keyboard shortcuts grouped by category.
 *
 * mount(container) creates the overlay DOM and registers the ? shortcut.
 * destroy() removes DOM and unregisters the shortcut.
 *
 * The overlay is hidden by default and toggled via the ? key.
 * Escape closes the overlay when visible.
 */
export class HelpOverlay {
	private readonly _registry: ShortcutRegistry;
	private _overlayEl: HTMLElement | null = null;
	private _bodyEl: HTMLElement | null = null;
	private _visible = false;
	private _escapeHandler: ((e: KeyboardEvent) => void) | null = null;

	constructor(registry: ShortcutRegistry) {
		this._registry = registry;
	}

	/**
	 * Create overlay DOM, register ? shortcut, attach Escape handler.
	 */
	mount(container: HTMLElement): void {
		// Create overlay root
		const overlay = document.createElement('div');
		overlay.className = 'help-overlay';

		// Card container
		const card = document.createElement('div');
		card.className = 'help-overlay__card';

		// Header
		const header = document.createElement('div');
		header.className = 'help-overlay__header';

		const title = document.createElement('h2');
		title.textContent = 'Keyboard Shortcuts';

		const closeBtn = document.createElement('button');
		closeBtn.className = 'help-overlay__close';
		closeBtn.type = 'button';
		closeBtn.textContent = '\u00D7'; // multiplication sign (x)
		closeBtn.addEventListener('click', () => this.hide());

		header.appendChild(title);
		header.appendChild(closeBtn);

		// Body (populated on show)
		const body = document.createElement('div');
		body.className = 'help-overlay__body';

		card.appendChild(header);
		card.appendChild(body);
		overlay.appendChild(card);
		container.appendChild(overlay);

		this._overlayEl = overlay;
		this._bodyEl = body;

		// Register ? shortcut through ShortcutRegistry
		this._registry.register('?', () => this.toggle(), {
			category: 'Help',
			description: 'Show keyboard shortcuts',
		});

		// Escape handler (separate from ShortcutRegistry — contextual to overlay)
		this._escapeHandler = (e: KeyboardEvent) => {
			if (e.key === 'Escape' && this._visible) {
				e.preventDefault();
				this.hide();
			}
		};
		document.addEventListener('keydown', this._escapeHandler);
	}

	/**
	 * Populate shortcuts from registry and show overlay.
	 */
	show(): void {
		if (!this._overlayEl || !this._bodyEl) return;
		this._populateShortcuts();
		this._overlayEl.classList.add('is-visible');
		this._visible = true;
	}

	/**
	 * Hide the overlay.
	 */
	hide(): void {
		if (!this._overlayEl) return;
		this._overlayEl.classList.remove('is-visible');
		this._visible = false;
	}

	/**
	 * Toggle overlay visibility.
	 */
	toggle(): void {
		if (this._visible) {
			this.hide();
		} else {
			this.show();
		}
	}

	/**
	 * Whether the overlay is currently visible.
	 */
	isVisible(): boolean {
		return this._visible;
	}

	/**
	 * Remove DOM, unregister shortcut, remove Escape handler.
	 */
	destroy(): void {
		if (this._overlayEl) {
			this._overlayEl.remove();
			this._overlayEl = null;
		}
		this._bodyEl = null;
		this._visible = false;

		// Unregister ? shortcut
		this._registry.unregister('?');

		// Remove Escape handler
		if (this._escapeHandler) {
			document.removeEventListener('keydown', this._escapeHandler);
			this._escapeHandler = null;
		}
	}

	// ---------------------------------------------------------------------------
	// Private
	// ---------------------------------------------------------------------------

	/**
	 * Populate the body element with shortcuts grouped by category.
	 */
	private _populateShortcuts(): void {
		if (!this._bodyEl) return;

		// Clear previous content
		this._bodyEl.innerHTML = '';

		const all = this._registry.getAll();

		// Group by category
		const grouped = new Map<string, Array<{ shortcut: string; description: string }>>();
		for (const entry of all) {
			if (!grouped.has(entry.category)) {
				grouped.set(entry.category, []);
			}
			grouped.get(entry.category)!.push({
				shortcut: entry.shortcut,
				description: entry.description,
			});
		}

		// Render each category
		for (const [category, shortcuts] of grouped) {
			const heading = document.createElement('h3');
			heading.className = 'help-overlay__category';
			heading.textContent = category;
			this._bodyEl.appendChild(heading);

			const list = document.createElement('div');
			list.className = 'help-overlay__list';

			for (const shortcut of shortcuts) {
				const row = document.createElement('div');
				row.className = 'help-overlay__row';

				const kbd = document.createElement('kbd');
				kbd.className = 'help-overlay__key';
				kbd.textContent = shortcut.shortcut;

				const desc = document.createElement('span');
				desc.className = 'help-overlay__desc';
				desc.textContent = shortcut.description;

				row.appendChild(kbd);
				row.appendChild(desc);
				list.appendChild(row);
			}

			this._bodyEl.appendChild(list);
		}
	}
}
