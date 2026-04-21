import '../styles/superwidget.css';
import { validateProjection } from './projection';
import type { CanvasBinding, CanvasComponent, Projection, ZoneRole } from './projection';

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

    // Placeholder tab buttons
    const tabLabels = ['Tab 1', 'Tab 2', 'Tab 3'];
    tabLabels.forEach((label, i) => {
      const btn = document.createElement('button');
      btn.dataset['tabRole'] = 'tab';
      btn.textContent = label;
      if (i === 0) {
        btn.dataset['tabActive'] = 'true';
      }
      this._tabsEl.appendChild(btn);
    });

    // Config gear button
    const configBtn = document.createElement('button');
    configBtn.dataset['tabRole'] = 'config';
    configBtn.textContent = '\u2699';
    configBtn.setAttribute('aria-label', 'Configure');
    this._tabsEl.appendChild(configBtn);

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
    this._root.remove();
    this._mounted = false;
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
}
