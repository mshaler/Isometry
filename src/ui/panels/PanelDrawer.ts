// Isometry — Phase 135.2 Plan 01
// PanelDrawer: icon strip + collapsible drawer + resize handle.
//
// Design:
//   - Icon strip: 40px vertical toolbar, one button per registered panel
//   - Panel drawer: collapsible surface containing CollapsibleSection per active panel
//   - Resize handle: pointer-capture drag to resize drawer width [200, 480]px
//   - Drag-to-reorder: 150ms press threshold distinguishes from toggle click
//   - Persists drawer width and panel order to ui_state via bridge
//
// Requirements: D-04, D-05, D-06, D-07, D-08, D-09

import '../../styles/panel-drawer.css';
import { CollapsibleSection } from '../CollapsibleSection';
import { iconSvg } from '../icons';
import type { PanelRegistry } from './PanelRegistry';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export interface PanelDrawerConfig {
	registry: PanelRegistry;
	bridge: { send(cmd: string, payload: unknown): Promise<unknown> };
}

// ---------------------------------------------------------------------------
// Internal state
// ---------------------------------------------------------------------------

interface MountedPanel {
	section: CollapsibleSection;
}

// ---------------------------------------------------------------------------
// PanelDrawer
// ---------------------------------------------------------------------------

export class PanelDrawer {
	private readonly _registry: PanelRegistry;
	private readonly _bridge: PanelDrawerConfig['bridge'];

	// DOM refs
	private _stripEl: HTMLElement | null = null;
	private _drawerEl: HTMLElement | null = null;
	private _scrollEl: HTMLElement | null = null;
	private _handleEl: HTMLElement | null = null;

	// Mounted panel sections — keyed by panel ID
	private _mounted: Map<string, MountedPanel> = new Map();

	// Drawer open state
	private _open = false;

	// Resize drag state
	private _resizing = false;
	private _drawerLeft = 0;

	// Drag-to-reorder state
	private _dragTimer: ReturnType<typeof setTimeout> | null = null;
	private _dragging = false;
	private _dragSourceId: string | null = null;
	private _dragSourceEl: HTMLElement | null = null;

	// Roving tabindex — button IDs in strip order
	private _focusedIdx = 0;

	// Cleanup
	private _unsubRegistry: (() => void) | null = null;

	// Bound event handlers (for removal)
	private _onHandlePointerDown: ((e: PointerEvent) => void) | null = null;
	private _onHandlePointerMove: ((e: PointerEvent) => void) | null = null;
	private _onHandlePointerUp: ((e: PointerEvent) => void) | null = null;
	private _onHandleKeyDown: ((e: KeyboardEvent) => void) | null = null;

	constructor(config: PanelDrawerConfig) {
		this._registry = config.registry;
		this._bridge = config.bridge;
	}

	// -----------------------------------------------------------------------
	// Public API
	// -----------------------------------------------------------------------

	/**
	 * Insert icon strip, drawer, and resize handle into the container.
	 * Must be called before init().
	 */
	mount(container: HTMLElement): void {
		// --- Icon strip ---
		const strip = document.createElement('div');
		strip.className = 'panel-icon-strip';
		strip.setAttribute('role', 'toolbar');
		strip.setAttribute('aria-label', 'Panel controls');
		this._stripEl = strip;

		// --- Drawer ---
		const drawer = document.createElement('div');
		drawer.className = 'panel-drawer panel-drawer--closed';
		this._drawerEl = drawer;

		// Scroll container inside drawer
		const scroll = document.createElement('div');
		scroll.className = 'panel-drawer__scroll';
		drawer.appendChild(scroll);
		this._scrollEl = scroll;

		// --- Resize handle ---
		const handle = document.createElement('div');
		handle.className = 'panel-drawer__resize-handle';
		handle.setAttribute('role', 'separator');
		handle.setAttribute('aria-orientation', 'vertical');
		handle.setAttribute('aria-label', 'Resize panel drawer');
		handle.setAttribute('aria-valuemin', '200');
		handle.setAttribute('aria-valuemax', '480');
		handle.setAttribute('aria-valuenow', '300');
		handle.tabIndex = 0;
		this._handleEl = handle;

		// Append all to container
		container.appendChild(strip);
		container.appendChild(drawer);
		container.appendChild(handle);

		// Render initial icon strip
		this._renderStrip();

		// Subscribe to registry changes (icon active state updates)
		this._unsubRegistry = this._registry.onChange(() => {
			this._renderStrip();
		});

		// Wire resize handle events
		this._wireResizeHandle(handle);
	}

	/**
	 * Load persisted drawer state (order, width) from ui_state.
	 */
	async init(): Promise<void> {
		try {
			// Restore panel order
			const orderRaw = (await this._bridge.send('ui:get', {
				key: 'panel-drawer:order',
			})) as string | null;
			if (orderRaw) {
				const ids = JSON.parse(orderRaw) as string[];
				this._registry.setOrder(ids);
				this._renderStrip();
			}
		} catch {
			// ignore — first run or parse error
		}

		try {
			// Restore drawer width
			const widthRaw = (await this._bridge.send('ui:get', {
				key: 'panel-drawer:width',
			})) as string | null;
			if (widthRaw && this._drawerEl) {
				const w = Number(widthRaw);
				if (w >= 200 && w <= 480) {
					this._drawerEl.style.setProperty('--panel-drawer-width', `${w}px`);
					this._handleEl?.setAttribute('aria-valuenow', String(w));
				}
			}
		} catch {
			// ignore
		}
	}

	/**
	 * Remove DOM, event listeners, and unsubscribe from registry.
	 */
	destroy(): void {
		// Destroy all mounted panel sections
		for (const { section } of this._mounted.values()) {
			section.destroy();
		}
		this._mounted.clear();

		// Unsubscribe from registry
		this._unsubRegistry?.();
		this._unsubRegistry = null;

		// Remove resize handle listeners
		if (this._handleEl) {
			if (this._onHandlePointerDown) {
				this._handleEl.removeEventListener('pointerdown', this._onHandlePointerDown);
			}
			if (this._onHandleKeyDown) {
				this._handleEl.removeEventListener('keydown', this._onHandleKeyDown);
			}
		}

		// Remove DOM
		this._stripEl?.remove();
		this._drawerEl?.remove();
		this._handleEl?.remove();

		this._stripEl = null;
		this._drawerEl = null;
		this._scrollEl = null;
		this._handleEl = null;
	}

	// -----------------------------------------------------------------------
	// Icon strip rendering
	// -----------------------------------------------------------------------

	private _renderStrip(): void {
		if (!this._stripEl) return;

		// Preserve focus position
		const previousFocusId = this._getFocusedPanelId();

		// Clear existing buttons
		this._stripEl.textContent = '';

		const panels = this._registry.getAll();

		panels.forEach((meta, idx) => {
			const btn = document.createElement('button');
			btn.className = 'panel-icon-strip__btn';
			btn.type = 'button';
			btn.setAttribute('aria-label', meta.description);
			btn.title = meta.description;
			btn.setAttribute('data-panel-id', meta.id);
			btn.innerHTML = iconSvg(meta.icon, 16);

			const enabled = this._registry.isEnabled(meta.id);
			btn.setAttribute('aria-pressed', String(enabled));
			if (enabled) {
				btn.classList.add('panel-icon-strip__btn--active');
			}

			// Roving tabindex
			const isFocused = meta.id === previousFocusId || (previousFocusId === null && idx === 0);
			btn.tabIndex = isFocused ? 0 : -1;
			if (isFocused) {
				this._focusedIdx = idx;
			}

			// Toggle click
			btn.addEventListener('pointerdown', (e) => this._onBtnPointerDown(e, meta.id, btn));

			// Roving tabindex keyboard nav
			btn.addEventListener('keydown', (e) => this._onBtnKeyDown(e, idx));

			this._stripEl!.appendChild(btn);
		});
	}

	private _getFocusedPanelId(): string | null {
		if (!this._stripEl) return null;
		const btns = this._stripEl.querySelectorAll<HTMLElement>('.panel-icon-strip__btn');
		const focused = Array.from(btns).find((b) => b.tabIndex === 0);
		return focused?.getAttribute('data-panel-id') ?? null;
	}

	// -----------------------------------------------------------------------
	// Button interactions
	// -----------------------------------------------------------------------

	private _onBtnPointerDown(e: PointerEvent, panelId: string, btn: HTMLElement): void {
		if (e.button !== 0) return;

		// Start 150ms drag threshold timer
		this._dragTimer = setTimeout(() => {
			this._startDrag(panelId, btn);
		}, 150);

		// Listen for pointerup to cancel or commit
		const onUp = (upEvent: PointerEvent) => {
			window.removeEventListener('pointerup', onUp);
			window.removeEventListener('pointermove', onMove);

			if (this._dragging) {
				this._commitDrag(upEvent);
			} else {
				// Short press — treat as toggle
				if (this._dragTimer !== null) {
					clearTimeout(this._dragTimer);
					this._dragTimer = null;
				}
				this._togglePanel(panelId);
				this._moveFocusTo(btn);
			}
		};

		const onMove = (moveEvent: PointerEvent) => {
			if (this._dragging) {
				this._onDragMove(moveEvent);
			}
		};

		window.addEventListener('pointerup', onUp);
		window.addEventListener('pointermove', onMove);
	}

	private _togglePanel(panelId: string): void {
		if (this._registry.isEnabled(panelId)) {
			this._registry.disable(panelId);
			this._unmountPanel(panelId);

			// Close drawer if no panels remain enabled
			if (this._registry.getEnabled().length === 0) {
				this._closeDrawer();
			}
		} else {
			this._registry.enable(panelId);
			this._mountPanel(panelId);

			// Open drawer if it was closed
			if (!this._open) {
				this._openDrawer();
			}
		}
	}

	// -----------------------------------------------------------------------
	// Drawer management
	// -----------------------------------------------------------------------

	private _openDrawer(): void {
		if (!this._drawerEl) return;
		this._drawerEl.classList.remove('panel-drawer--closed');
		this._open = true;
	}

	private _closeDrawer(): void {
		if (!this._drawerEl) return;
		this._drawerEl.classList.add('panel-drawer--closed');
		this._open = false;
	}

	private _mountPanel(panelId: string): void {
		if (!this._scrollEl) return;
		if (this._mounted.has(panelId)) return;

		const meta = this._registry.getAll().find((m) => m.id === panelId);
		if (!meta) return;

		const instance = this._registry.getInstance(panelId);
		if (!instance) return;

		const section = new CollapsibleSection({
			title: meta.name,
			icon: meta.icon,
			storageKey: `panel-section:${panelId}`,
		});

		section.mount(this._scrollEl);
		section.setState('ready');

		const body = section.getBodyEl();
		if (body) {
			instance.mount(body);
		}

		this._mounted.set(panelId, { section });
	}

	private _unmountPanel(panelId: string): void {
		const entry = this._mounted.get(panelId);
		if (!entry) return;

		// Registry already called destroy() on the instance via disable()
		entry.section.destroy();
		this._mounted.delete(panelId);
	}

	// -----------------------------------------------------------------------
	// Drag-to-reorder
	// -----------------------------------------------------------------------

	private _startDrag(panelId: string, btn: HTMLElement): void {
		this._dragging = true;
		this._dragSourceId = panelId;
		this._dragSourceEl = btn;
		btn.classList.add('panel-icon-strip__btn--dragging');
	}

	private _onDragMove(e: PointerEvent): void {
		if (!this._dragging || !this._stripEl || !this._dragSourceEl) return;

		// Find the button currently under the pointer
		const target = document.elementFromPoint(e.clientX, e.clientY);
		const targetBtn = target?.closest<HTMLElement>('.panel-icon-strip__btn');
		if (!targetBtn || targetBtn === this._dragSourceEl) return;

		const targetId = targetBtn.getAttribute('data-panel-id');
		if (!targetId) return;

		// Swap DOM positions
		const parent = this._stripEl;
		const btns = Array.from(parent.children) as HTMLElement[];
		const srcIdx = btns.indexOf(this._dragSourceEl);
		const tgtIdx = btns.indexOf(targetBtn);
		if (srcIdx === -1 || tgtIdx === -1) return;

		if (srcIdx < tgtIdx) {
			parent.insertBefore(this._dragSourceEl, targetBtn.nextSibling);
		} else {
			parent.insertBefore(this._dragSourceEl, targetBtn);
		}
	}

	private _commitDrag(_e: PointerEvent): void {
		this._dragging = false;

		if (this._dragSourceEl) {
			this._dragSourceEl.classList.remove('panel-icon-strip__btn--dragging');
			this._dragSourceEl = null;
		}
		this._dragSourceId = null;

		if (this._dragTimer !== null) {
			clearTimeout(this._dragTimer);
			this._dragTimer = null;
		}

		// Read new order from DOM
		if (!this._stripEl) return;
		const btns = Array.from(this._stripEl.querySelectorAll<HTMLElement>('.panel-icon-strip__btn'));
		const ids = btns.map((b) => b.getAttribute('data-panel-id')).filter((id): id is string => id !== null);

		this._registry.setOrder(ids);

		// Persist to ui_state
		this._bridge
			.send('ui:set', { key: 'panel-drawer:order', value: JSON.stringify(ids) })
			.catch(() => {
				// ignore persistence errors
			});
	}

	// -----------------------------------------------------------------------
	// Keyboard navigation (roving tabindex)
	// -----------------------------------------------------------------------

	private _onBtnKeyDown(e: KeyboardEvent, idx: number): void {
		if (!this._stripEl) return;
		const btns = Array.from(this._stripEl.querySelectorAll<HTMLElement>('.panel-icon-strip__btn'));

		let newIdx = idx;
		if (e.key === 'ArrowDown') {
			newIdx = Math.min(idx + 1, btns.length - 1);
		} else if (e.key === 'ArrowUp') {
			newIdx = Math.max(idx - 1, 0);
		} else {
			return;
		}

		e.preventDefault();
		this._moveFocusToIdx(newIdx, btns);
	}

	private _moveFocusTo(btn: HTMLElement): void {
		if (!this._stripEl) return;
		const btns = Array.from(this._stripEl.querySelectorAll<HTMLElement>('.panel-icon-strip__btn'));
		const idx = btns.indexOf(btn);
		if (idx !== -1) {
			this._moveFocusToIdx(idx, btns);
		}
	}

	private _moveFocusToIdx(idx: number, btns: HTMLElement[]): void {
		btns.forEach((b, i) => {
			b.tabIndex = i === idx ? 0 : -1;
		});
		btns[idx]?.focus();
		this._focusedIdx = idx;
	}

	// -----------------------------------------------------------------------
	// Resize handle
	// -----------------------------------------------------------------------

	private _wireResizeHandle(handle: HTMLElement): void {
		this._onHandlePointerDown = (e: PointerEvent) => {
			if (e.button !== 0 || !this._drawerEl) return;
			e.preventDefault();
			handle.setPointerCapture(e.pointerId);
			this._resizing = true;
			this._drawerLeft = this._drawerEl.getBoundingClientRect().left;
			handle.classList.add('panel-drawer__resize-handle--active');

			this._onHandlePointerMove = (moveEvent: PointerEvent) => {
				if (!this._resizing || !this._drawerEl) return;
				const newWidth = Math.max(200, Math.min(480, moveEvent.clientX - this._drawerLeft));
				this._drawerEl.style.setProperty('--panel-drawer-width', `${newWidth}px`);
				handle.setAttribute('aria-valuenow', String(Math.round(newWidth)));
			};

			this._onHandlePointerUp = (upEvent: PointerEvent) => {
				if (!this._resizing || !this._drawerEl) return;
				handle.releasePointerCapture(upEvent.pointerId);
				this._resizing = false;
				handle.classList.remove('panel-drawer__resize-handle--active');

				// Read final width and persist
				const widthStr = this._drawerEl.style.getPropertyValue('--panel-drawer-width');
				const finalWidth = parseInt(widthStr, 10);
				if (!isNaN(finalWidth)) {
					this._bridge
						.send('ui:set', { key: 'panel-drawer:width', value: String(finalWidth) })
						.catch(() => {
							// ignore persistence errors
						});
				}

				if (this._onHandlePointerMove) {
					handle.removeEventListener('pointermove', this._onHandlePointerMove);
				}
				if (this._onHandlePointerUp) {
					handle.removeEventListener('pointerup', this._onHandlePointerUp);
				}
			};

			handle.addEventListener('pointermove', this._onHandlePointerMove);
			handle.addEventListener('pointerup', this._onHandlePointerUp);
		};

		handle.addEventListener('pointerdown', this._onHandlePointerDown);

		// Keyboard resize: ArrowLeft/ArrowRight ±16px, Home → 200, End → 480
		this._onHandleKeyDown = (e: KeyboardEvent) => {
			if (!this._drawerEl) return;
			const widthStr = this._drawerEl.style.getPropertyValue('--panel-drawer-width') || '300';
			let w = parseInt(widthStr, 10);
			if (isNaN(w)) w = 300;

			let changed = false;
			if (e.key === 'ArrowLeft') {
				w = Math.max(200, w - 16);
				changed = true;
			} else if (e.key === 'ArrowRight') {
				w = Math.min(480, w + 16);
				changed = true;
			} else if (e.key === 'Home') {
				w = 200;
				changed = true;
			} else if (e.key === 'End') {
				w = 480;
				changed = true;
			}

			if (changed) {
				e.preventDefault();
				this._drawerEl.style.setProperty('--panel-drawer-width', `${w}px`);
				handle.setAttribute('aria-valuenow', String(w));
				this._bridge
					.send('ui:set', { key: 'panel-drawer:width', value: String(w) })
					.catch(() => {
						// ignore persistence errors
					});
			}
		};

		handle.addEventListener('keydown', this._onHandleKeyDown);
	}
}
