import '../styles/superwidget.css';
import { validateProjection } from './projection';
import type { CanvasBinding, CanvasComponent, Projection, TabMetadata, ZoneRole } from './projection';
import { TabBar } from './TabBar';
import { makeTabSlot, removeTab, reorderTabs } from './TabSlot';
import type { TabSlot } from './TabSlot';
import type { ShortcutRegistry } from '../shortcuts/ShortcutRegistry';
import type { CommandBar } from '../ui/CommandBar';

export type CanvasFactory = (canvasId: string, binding: CanvasBinding) => CanvasComponent | undefined;

// Zone label map (D-04)
const ZONE_LABELS: Record<ZoneRole, string> = {
  primary: 'Primary',
  secondary: 'Secondary',
  tertiary: 'Tertiary',
};

/**
 * SuperWidget — universal container primitive for zone-based navigation.
 *
 * Pure DOM skeleton: four named slots (header, tabs, canvas, status) laid out
 * via CSS Grid. No events, no state. Mount/destroy lifecycle only.
 *
 * Phase 162 — substrate-layout
 * Phase 164 — projection-rendering: adds canvasFactory injection and render-count tracking
 */
export class SuperWidget {
  private _root: HTMLElement;
  private _ribbonEl: HTMLElement;
  private _headerEl: HTMLElement;
  private _canvasEl: HTMLElement;
  private _statusEl: HTMLElement;
  private _tabsEl: HTMLElement;
  private _mounted: boolean = false;
  private _canvasFactory: CanvasFactory;
  private _currentCanvas: CanvasComponent | null = null;
  private _currentProjection: Projection | null = null;
  private _tabBar: TabBar;
  private _tabs: TabSlot[] = [];
  private _activeTabSlotId: string = '';
  private _shortcuts: ShortcutRegistry | undefined;
  private _commandBar: CommandBar | undefined;
  private _sidecarEl: HTMLElement;
  private _sidecarTopEl: HTMLElement;
  private _sidecarBottomEl: HTMLElement;

  constructor(canvasFactory: CanvasFactory, shortcuts?: ShortcutRegistry, commandBar?: CommandBar) {
    this._canvasFactory = canvasFactory;
    this._shortcuts = shortcuts;
    this._commandBar = commandBar;

    // Root element
    this._root = document.createElement('div');
    this._root.dataset['component'] = 'superwidget';

    // Ribbon slot — horizontal navigation bar
    this._ribbonEl = document.createElement('div');
    this._ribbonEl.dataset['slot'] = 'ribbon';

    // Header slot
    this._headerEl = document.createElement('div');
    this._headerEl.dataset['slot'] = 'header';
    if (commandBar) {
      commandBar.mount(this._headerEl);
    } else {
      this._headerEl.textContent = 'Zone';
    }

    // Tabs slot
    this._tabsEl = document.createElement('div');
    this._tabsEl.dataset['slot'] = 'tabs';

    // Initialize with a single default tab (D-01: View Bound)
    const defaultTab = makeTabSlot();
    this._tabs = [defaultTab];
    this._activeTabSlotId = defaultTab.tabId;

    // Create TabBar and append to tabs slot
    this._tabBar = new TabBar({
      tabs: this._tabs,
      activeTabId: this._activeTabSlotId,
      onSwitch: (tabId) => this._switchToTab(tabId),
      onCreate: () => this._createTab(),
      onClose: (tabId) => this._closeTab(tabId),
      onReorder: (fromIndex, toIndex) => this._reorderTabs(fromIndex, toIndex),
    });
    this._tabsEl.appendChild(this._tabBar.el);

    // Register Cmd+W shortcut (TABS-08) — D-06 guard: no-op on last tab
    if (this._shortcuts) {
      this._shortcuts.register('Cmd+W', () => {
        if (this._tabs.length <= 1) return;
        this._closeTab(this._activeTabSlotId);
      }, { category: 'Tabs', description: 'Close active tab' });
    }

    // Canvas slot
    this._canvasEl = document.createElement('div');
    this._canvasEl.dataset['slot'] = 'canvas';

    // Status slot
    this._statusEl = document.createElement('div');
    this._statusEl.dataset['slot'] = 'status';

    // Sidecar slot (3rd grid column — spans all rows, per D-01)
    this._sidecarEl = document.createElement('aside');
    this._sidecarEl.dataset['slot'] = 'sidecar';
    this._sidecarEl.setAttribute('aria-label', 'Explorer panel');

    this._sidecarTopEl = document.createElement('div');
    this._sidecarTopEl.dataset['sidecarSlot'] = 'top-slot';
    this._sidecarBottomEl = document.createElement('div');
    this._sidecarBottomEl.dataset['sidecarSlot'] = 'bottom-slot';

    this._sidecarEl.appendChild(this._sidecarTopEl);
    this._sidecarEl.appendChild(this._sidecarBottomEl);

    // Append slots to root: ribbon first (accessibility), then header/tabs/canvas/status/sidecar
    this._root.appendChild(this._ribbonEl);
    this._root.appendChild(this._headerEl);
    this._root.appendChild(this._tabsEl);
    this._root.appendChild(this._canvasEl);
    this._root.appendChild(this._statusEl);
    this._root.appendChild(this._sidecarEl);

    // Initialize render-count tracking on all five main slots (D-05)
    this._ribbonEl.dataset['renderCount'] = '0';
    this._headerEl.dataset['renderCount'] = '0';
    this._canvasEl.dataset['renderCount'] = '0';
    this._statusEl.dataset['renderCount'] = '0';
    this._tabsEl.dataset['renderCount'] = '0';

    // Initial sync indicator (STAT-06, STAT-04)
    this._renderSyncIndicator();
  }

  /**
   * Append the widget into a container element. Idempotent.
   */
  mount(container: HTMLElement): void {
    if (this._mounted) return;
    container.appendChild(this._root);
    this._mounted = true;
  }

  /**
   * Remove the widget from the DOM and null slot references. Idempotent.
   */
  destroy(): void {
    if (!this._mounted) return;
    if (this._currentCanvas !== null) {
      this._currentCanvas.destroy();
      this._currentCanvas = null;
    }
    this._currentProjection = null;
    delete this._root.dataset['sidecarVisible'];
    this._shortcuts?.unregister('Cmd+W');
    this._commandBar?.destroy();
    this._tabBar.destroy();
    this._root.remove();
    this._mounted = false;
  }

  /**
   * Show or hide the sidecar column via data attribute (CSS grid transition).
   * Does not trigger any canvas re-renders or Worker re-queries.
   */
  setSidecarVisible(visible: boolean): void {
    if (visible) {
      this._root.dataset['sidecarVisible'] = 'true';
    } else {
      delete this._root.dataset['sidecarVisible'];
    }
  }

  private _switchToTab(tabId: string): void {
    if (tabId === this._activeTabSlotId) return;
    const slot = this._tabs.find(t => t.tabId === tabId);
    if (!slot) return;
    this._activeTabSlotId = tabId;
    this._tabBar.update(this._tabs, this._activeTabSlotId);
    this.commitProjection(slot.projection);
    this._notifyTabStateChange();
  }

  private _createTab(): void {
    const newTab = makeTabSlot();
    this._tabs = [...this._tabs, newTab];
    this._activeTabSlotId = newTab.tabId;
    this._tabBar.update(this._tabs, this._activeTabSlotId);
    this.commitProjection(newTab.projection);
    this._notifyTabStateChange();
    requestAnimationFrame(() => this._tabBar.scrollToTab(newTab.tabId));
  }

  private _reorderTabs(fromIndex: number, toIndex: number): void {
    const newTabs = reorderTabs(this._tabs, fromIndex, toIndex);
    if (newTabs === this._tabs) return; // reference equality bail-out
    this._tabs = newTabs as TabSlot[];
    this._tabBar.update(this._tabs, this._activeTabSlotId);
    this._notifyTabStateChange();
  }

  private _updateTabMetadata(tabId: string, meta: TabMetadata): void {
    const index = this._tabs.findIndex((t) => t.tabId === tabId);
    if (index === -1) return;
    const current = this._tabs[index]!;
    const newLabel = meta.label ?? current.label;
    const newBadge = meta.badge !== undefined ? meta.badge : current.badge;
    const updated: TabSlot = newBadge !== undefined
      ? { tabId: current.tabId, projection: current.projection, label: newLabel, badge: newBadge }
      : { tabId: current.tabId, projection: current.projection, label: newLabel };
    this._tabs = [...this._tabs];
    this._tabs[index] = updated;
    this._tabBar.update(this._tabs, this._activeTabSlotId);
  }

  private _closeTab(tabId: string): void {
    if (this._tabs.length <= 1) return;
    const closedIndex = this._tabs.findIndex(t => t.tabId === tabId);
    if (closedIndex === -1) return;

    // D-04: activate adjacent tab (right, or left if rightmost closed)
    if (tabId === this._activeTabSlotId) {
      const nextIndex = closedIndex < this._tabs.length - 1 ? closedIndex + 1 : closedIndex - 1;
      this._activeTabSlotId = this._tabs[nextIndex]!.tabId;
    }

    this._tabs = removeTab(this._tabs, tabId) as TabSlot[];
    this._tabBar.update(this._tabs, this._activeTabSlotId);
    const activeSlot = this._tabs.find(t => t.tabId === this._activeTabSlotId);
    if (activeSlot) this.commitProjection(activeSlot.projection);
    this._notifyTabStateChange();
  }

  /**
   * Commit a new Projection to the widget, updating only the affected slots.
   *
   * - Validates the Projection first (RNDR-02). Invalid → console.warn, no DOM change.
   * - Reference-equality bail-out: same reference → immediate return, no work done.
   * - Zone label update (RNDR-05): headerEl.textContent set from ZONE_LABELS map.
   * - Canvas lifecycle (RNDR-01, RNDR-04): destroy prior canvas, mount new canvas.
   * - Tab switch (RNDR-03): increments canvasEl render count only.
   */
  commitProjection(proj: Projection): void {
    // Step 1: Validate (RNDR-02)
    const result = validateProjection(proj);
    if (!result.valid) {
      console.warn(`[SuperWidget] commitProjection rejected: ${result.reason}`);
      return;
    }

    // Step 2: Bail-out on reference equality
    if (proj === this._currentProjection) return;

    const prev = this._currentProjection;

    // Step 3: Zone label update (RNDR-05) — skipped when CommandBar owns the header
    if (!this._commandBar && (!prev || prev.zoneRole !== proj.zoneRole)) {
      this._headerEl.textContent = ZONE_LABELS[proj.zoneRole];
      this._headerEl.dataset['renderCount'] = String(
        Number(this._headerEl.dataset['renderCount']) + 1
      );
    }

    // Step 3.5: Clear status slot and re-append sync indicator on canvas change (D-06, STAT-04)
    if (!prev || prev.canvasType !== proj.canvasType || prev.canvasId !== proj.canvasId || prev.canvasBinding !== proj.canvasBinding) {
      const currentSyncState = (this._statusEl.querySelector<HTMLElement>('.sw-sync-indicator__dot')?.dataset['syncState'] ?? 'idle') as 'idle' | 'syncing' | 'error';
      this._statusEl.innerHTML = '';
      this._renderSyncIndicator();
      this.setSyncState(currentSyncState);
    }

    // Step 4: Canvas lifecycle (RNDR-01, RNDR-04)
    if (!prev || prev.canvasType !== proj.canvasType || prev.canvasId !== proj.canvasId || prev.canvasBinding !== proj.canvasBinding) {
      // Destroy prior canvas (RNDR-04)
      if (this._currentCanvas) {
        this._currentCanvas.destroy();
        this._currentCanvas = null;
      }

      // Mount new canvas (RNDR-01)
      const canvas = this._canvasFactory(proj.canvasId, proj.canvasBinding);
      if (!canvas) {
        console.warn(`[SuperWidget] canvasFactory returned undefined for canvasId: ${proj.canvasId}`);
        this._currentProjection = proj;
        return;
      }

      canvas.mount(this._canvasEl);
      this._currentCanvas = canvas;
      // TABS-10: inject metadata callback so canvas can update badge/label without commitProjection
      canvas.onTabMetadataChange = (meta) => this._updateTabMetadata(this._activeTabSlotId, meta);
      // Reset render count to 1 on new canvas mount (D-07)
      this._canvasEl.dataset['renderCount'] = '1';
      // Notify newly mounted canvas of initial projection (Phase 168 D-04)
      this._currentCanvas.onProjectionChange?.(proj);
    } else if (prev.activeTabId !== proj.activeTabId) {
      // Tab switch only — increment canvas render count (RNDR-03)
      this._canvasEl.dataset['renderCount'] = String(
        Number(this._canvasEl.dataset['renderCount']) + 1
      );
      // Notify canvas of projection change (Phase 168 D-04)
      this._currentCanvas?.onProjectionChange?.(proj);
    }

    // Step 5: Store current projection
    this._currentProjection = proj;
  }

  /**
   * Creates and appends the sync indicator to the status slot (STAT-06).
   * Called on construction and after status slot clearing on canvas switch.
   */
  private _renderSyncIndicator(): void {
    const wrapper = document.createElement('div');
    wrapper.className = 'sw-sync-indicator';
    wrapper.dataset['stat'] = 'sync-status';
    wrapper.setAttribute('role', 'status');
    wrapper.setAttribute('aria-live', 'polite');

    const dot = document.createElement('span');
    dot.className = 'sw-sync-indicator__dot';
    dot.dataset['syncState'] = 'idle';

    const label = document.createElement('span');
    label.className = 'sw-sync-indicator__label';
    label.textContent = '';

    wrapper.appendChild(dot);
    wrapper.appendChild(label);
    this._statusEl.appendChild(wrapper);
  }

  /**
   * Update the sync indicator state (STAT-06).
   * idle = grey dot, no label; syncing = pulsing accent dot + "Syncing…"; error = red dot + "Sync error".
   */
  setSyncState(state: 'idle' | 'syncing' | 'error'): void {
    const dot = this._statusEl.querySelector<HTMLElement>('.sw-sync-indicator__dot');
    const label = this._statusEl.querySelector<HTMLElement>('.sw-sync-indicator__label');
    if (!dot || !label) return;
    dot.dataset['syncState'] = state;
    label.textContent = state === 'syncing' ? 'Syncing\u2026' : state === 'error' ? 'Sync error' : '';
  }

  // Public read-only slot getters (D-05)
  get headerEl(): HTMLElement { return this._headerEl; }
  get canvasEl(): HTMLElement { return this._canvasEl; }
  get statusEl(): HTMLElement { return this._statusEl; }
  get tabsEl(): HTMLElement { return this._tabsEl; }
  get rootEl(): HTMLElement { return this._root; }
  get mounted(): boolean { return this._mounted; }
  get ribbonEl(): HTMLElement { return this._ribbonEl; }

  // CommandBar accessor (D-03, D-06)
  getCommandBar(): CommandBar | undefined { return this._commandBar; }

  // Sidecar slot accessors (Phase 176)
  get sidecarTopEl(): HTMLElement { return this._sidecarTopEl; }
  get sidecarBottomEl(): HTMLElement { return this._sidecarBottomEl; }
  get sidecarEl(): HTMLElement { return this._sidecarEl; }

  // Tab state getters (for Plan 03 and Phase 177)
  get tabs(): readonly TabSlot[] { return this._tabs; }
  get activeTabSlotId(): string { return this._activeTabSlotId; }

  // Phase 177 PRST-01: Tab mutation notification callback (injection pattern per TABS-10)
  onTabStateChange?: ((tabs: readonly TabSlot[], activeTabSlotId: string) => void) | undefined;

  private _notifyTabStateChange(): void {
    this.onTabStateChange?.(this._tabs, this._activeTabSlotId);
  }

  /**
   * Restore tabs from persisted state.
   * Does NOT call _notifyTabStateChange — avoids persist-on-restore echo loop
   * (same as PAFVProvider's setState pattern).
   */
  restoreTabs(tabs: TabSlot[], activeTabSlotId: string): void {
    if (tabs.length === 0) return;
    const validActive = tabs.find(t => t.tabId === activeTabSlotId);
    if (!validActive) return;
    this._tabs = [...tabs];
    this._activeTabSlotId = activeTabSlotId;
    this._tabBar.update(this._tabs, this._activeTabSlotId);
    this.commitProjection(validActive.projection);
  }
}
