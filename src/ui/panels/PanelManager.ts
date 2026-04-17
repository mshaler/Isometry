// Isometry — Phase 156 Plan 01
// PanelManager: visibility orchestration on top of PanelRegistry.
//
// Design (D-01, D-02, D-03):
//   - Mount-once: panels are enabled+mounted on first show(), never destroyed on hide()
//   - Visibility layer: show/hide toggles container display style only
//   - Coupling groups: named groups show/hide atomically (e.g., DataExplorer + Properties)
//   - Slot sync: syncSlots callback fires after every visibility change

import type { PanelRegistry } from './PanelRegistry';
import type { SlotConfig, CouplingGroup } from './PanelTypes';

export class PanelManager {
	private _registry: PanelRegistry;
	private _slots: Map<string, SlotConfig>;
	private _mounted: Set<string>;
	private _visible: Set<string>;
	private _groups: Map<string, CouplingGroup>;
	private _syncSlots: () => void;

	constructor(config: {
		registry: PanelRegistry;
		slots: SlotConfig[];
		groups?: CouplingGroup[];
		syncSlots: () => void;
	}) {
		this._registry = config.registry;
		this._slots = new Map(config.slots.map((s) => [s.id, s]));
		this._mounted = new Set();
		this._visible = new Set();
		this._groups = new Map((config.groups ?? []).map((g) => [g.name, g]));
		this._syncSlots = config.syncSlots;
	}

	/** Show a panel: enable+mount on first call, set display='' on subsequent calls. */
	show(id: string): void {
		if (this._visible.has(id)) return;

		const slot = this._slots.get(id);
		if (!slot) return;

		if (!this._mounted.has(id)) {
			this._registry.enable(id);
			const instance = this._registry.getInstance(id);
			if (instance) {
				instance.mount(slot.container);
			}
			this._mounted.add(id);
		}

		slot.container.style.display = '';
		this._visible.add(id);
		this._syncSlots();
	}

	/** Hide a panel: set display='none'. Does NOT call registry.disable() (mount-once). */
	hide(id: string): void {
		if (!this._visible.has(id)) return;

		const slot = this._slots.get(id);
		if (!slot) return;

		slot.container.style.display = 'none';
		this._visible.delete(id);
		this._syncSlots();
	}

	/** Toggle visibility state of a panel. */
	toggle(id: string): void {
		if (this.isVisible(id)) {
			this.hide(id);
		} else {
			this.show(id);
		}
	}

	/** Returns true if the panel is currently visible. */
	isVisible(id: string): boolean {
		return this._visible.has(id);
	}

	/** Show all panels in a named coupling group. */
	showGroup(name: string): void {
		const group = this._groups.get(name);
		if (!group) return;
		for (const panelId of group.panelIds) {
			this.show(panelId);
		}
	}

	/** Hide all panels in a named coupling group. */
	hideGroup(name: string): void {
		const group = this._groups.get(name);
		if (!group) return;
		for (const panelId of group.panelIds) {
			this.hide(panelId);
		}
	}

	/** Returns true if any panel in the named group is currently visible. */
	isGroupVisible(name: string): boolean {
		const group = this._groups.get(name);
		if (!group) return false;
		return group.panelIds.some((id) => this._visible.has(id));
	}
}
