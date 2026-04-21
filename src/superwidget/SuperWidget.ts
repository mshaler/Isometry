import '../styles/superwidget.css';

/**
 * SuperWidget — universal container primitive for zone-based navigation.
 *
 * Pure DOM skeleton: four named slots (header, tabs, canvas, status) laid out
 * via CSS Grid. No events, no state. Mount/destroy lifecycle only.
 *
 * Phase 162 — substrate-layout
 */
export class SuperWidget {
  private _root: HTMLElement;
  private _headerEl: HTMLElement;
  private _canvasEl: HTMLElement;
  private _statusEl: HTMLElement;
  private _tabsEl: HTMLElement;
  private _mounted: boolean = false;

  constructor() {
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
    this._root.remove();
    this._mounted = false;
  }

  // Public read-only slot getters (D-05)
  get headerEl(): HTMLElement { return this._headerEl; }
  get canvasEl(): HTMLElement { return this._canvasEl; }
  get statusEl(): HTMLElement { return this._statusEl; }
  get tabsEl(): HTMLElement { return this._tabsEl; }
  get rootEl(): HTMLElement { return this._root; }
  get mounted(): boolean { return this._mounted; }
}
