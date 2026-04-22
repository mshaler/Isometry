import '../styles/superwidget.css';
import { validateProjection } from './projection';
import type { CanvasBinding, CanvasComponent, Projection, ZoneRole } from './projection';
import { TabBar } from './TabBar';
import { makeTabSlot, removeTab } from './TabSlot';
import type { TabSlot } from './TabSlot';

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

  constructor(canvasFactory: CanvasFactory) {
    this._canvasFactory = canvasFactory;
    // Root element
    this._root = document.createElement('div');
    this._root.dataset['component'] = 'superwidget';

    // Header slot
    this._headerEl = document.createElement('div');
    this._headerEl.dataset['slot'] = 'header';
    this._headerEl.textContent = 'Zone';

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
    });
    this._tabsEl.appendChild(this._tabBar.el);

    // Canvas slot
    this._canvasEl = document.createElement('div');
    this._canvasEl.dataset['slot'] = 'canvas';

    // Status slot
    this._statusEl = document.createElement('div');
    this._statusEl.dataset['slot'] = 'status';

    // Append slots to root in grid order: header, tabs, canvas, status (D-07)
    this._root.appendChild(this._headerEl);
    this._root.appendChild(this._tabsEl);
    this._root.appendChild(this._canvasEl);
    this._root.appendChild(this._statusEl);

    // Initialize render-count tracking on all four slots (D-05)
    this._headerEl.dataset['renderCount'] = '0';
    this._canvasEl.dataset['renderCount'] = '0';
    this._statusEl.dataset['renderCount'] = '0';
    this._tabsEl.dataset['renderCount'] = '0';
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
    this._tabBar.destroy();
    this._root.remove();
    this._mounted = false;
  }

  private _switchToTab(tabId: string): void {
    if (tabId === this._activeTabSlotId) return;
    const slot = this._tabs.find(t => t.tabId === tabId);
    if (!slot) return;
    this._activeTabSlotId = tabId;
    this._tabBar.update(this._tabs, this._activeTabSlotId);
    this.commitProjection(slot.projection);
  }

  private _createTab(): void {
    const newTab = makeTabSlot();
    this._tabs = [...this._tabs, newTab];
    this._activeTabSlotId = newTab.tabId;
    this._tabBar.update(this._tabs, this._activeTabSlotId);
    this.commitProjection(newTab.projection);
    requestAnimationFrame(() => this._tabBar.scrollToTab(newTab.tabId));
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

    // Step 3: Zone label update (RNDR-05)
    if (!prev || prev.zoneRole !== proj.zoneRole) {
      this._headerEl.textContent = ZONE_LABELS[proj.zoneRole];
      this._headerEl.dataset['renderCount'] = String(
        Number(this._headerEl.dataset['renderCount']) + 1
      );
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

  // Public read-only slot getters (D-05)
  get headerEl(): HTMLElement { return this._headerEl; }
  get canvasEl(): HTMLElement { return this._canvasEl; }
  get statusEl(): HTMLElement { return this._statusEl; }
  get tabsEl(): HTMLElement { return this._tabsEl; }
  get rootEl(): HTMLElement { return this._root; }
  get mounted(): boolean { return this._mounted; }

  // Tab state getters (for Plan 03 and Phase 177)
  get tabs(): readonly TabSlot[] { return this._tabs; }
  get activeTabSlotId(): string { return this._activeTabSlotId; }
}
