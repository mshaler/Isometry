// Isometry v13.3 — Phase 174 Plan 02 TabBar
//
// TabBar renders a scrollable tab strip with chevron overflow controls,
// an add (+) button, and per-tab close (✕) buttons.
//
// Requirements: TABS-01, TABS-02, TABS-03, TABS-04, TABS-06

import type { TabSlot } from './TabSlot';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface TabBarConfig {
  tabs: TabSlot[];
  activeTabId: string;
  onSwitch: (tabId: string) => void;
  onCreate: () => void;
  onClose: (tabId: string) => void;
}

// ---------------------------------------------------------------------------
// TabBar class
// ---------------------------------------------------------------------------

export class TabBar {
  private _config: TabBarConfig;
  private _rootEl: HTMLElement;
  private _stripEl: HTMLElement;
  private _leftChevron: HTMLButtonElement;
  private _rightChevron: HTMLButtonElement;
  private _addBtn: HTMLButtonElement;
  private _resizeObserver: ResizeObserver;
  private _onScroll: () => void;

  constructor(config: TabBarConfig) {
    this._config = { ...config };

    // Root wrapper (flex row)
    this._rootEl = document.createElement('div');
    this._rootEl.className = 'sw-tab-bar-root';
    this._rootEl.style.display = 'contents';

    // Left chevron
    this._leftChevron = document.createElement('button');
    this._leftChevron.className = 'sw-tab-strip__chevron';
    this._leftChevron.dataset['direction'] = 'left';
    this._leftChevron.setAttribute('aria-label', 'Scroll tabs left');
    this._leftChevron.textContent = '‹';
    this._leftChevron.style.display = 'none';

    // Tab strip
    this._stripEl = document.createElement('div');
    this._stripEl.className = 'sw-tab-strip';
    this._stripEl.setAttribute('role', 'tablist');
    this._stripEl.setAttribute('aria-label', 'Workspace tabs');

    // Right chevron
    this._rightChevron = document.createElement('button');
    this._rightChevron.className = 'sw-tab-strip__chevron';
    this._rightChevron.dataset['direction'] = 'right';
    this._rightChevron.setAttribute('aria-label', 'Scroll tabs right');
    this._rightChevron.textContent = '›';
    this._rightChevron.style.display = 'none';

    // Add button
    this._addBtn = document.createElement('button');
    this._addBtn.className = 'sw-tab-strip__add';
    this._addBtn.setAttribute('aria-label', 'New tab');
    this._addBtn.textContent = '+';

    // Wire add button
    this._addBtn.addEventListener('click', () => this._config.onCreate());

    // Wire chevrons
    this._leftChevron.addEventListener('click', () => {
      const tabWidth = (this._stripEl.firstElementChild as HTMLElement | null)?.offsetWidth ?? 120;
      this._stripEl.scrollBy({ left: -(tabWidth + 4), behavior: 'smooth' });
    });
    this._rightChevron.addEventListener('click', () => {
      const tabWidth = (this._stripEl.firstElementChild as HTMLElement | null)?.offsetWidth ?? 120;
      this._stripEl.scrollBy({ left: tabWidth + 4, behavior: 'smooth' });
    });

    // Wire scroll event for chevron visibility
    this._onScroll = () => this._updateChevrons();
    this._stripEl.addEventListener('scroll', this._onScroll);

    // Event delegation on strip for tab click and close click
    this._stripEl.addEventListener('click', (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const closeBtn = target.closest('.sw-tab__close');
      if (closeBtn) {
        e.stopPropagation();
        const tabBtn = closeBtn.closest('[data-tab-role="tab"]') as HTMLElement | null;
        const tabId = tabBtn?.dataset['tabId'];
        if (tabId) this._config.onClose(tabId);
        return;
      }
      const tabBtn = target.closest('[data-tab-role="tab"]') as HTMLElement | null;
      if (tabBtn) {
        const tabId = tabBtn.dataset['tabId'];
        if (tabId) this._config.onSwitch(tabId);
      }
    });

    // Append to root
    this._rootEl.appendChild(this._leftChevron);
    this._rootEl.appendChild(this._stripEl);
    this._rootEl.appendChild(this._rightChevron);
    this._rootEl.appendChild(this._addBtn);

    // ResizeObserver for chevron visibility updates
    this._resizeObserver = new ResizeObserver(() => this._updateChevrons());
    this._resizeObserver.observe(this._stripEl);

    // Initial render
    this._renderTabs();
  }

  // ---------------------------------------------------------------------------
  // Private methods
  // ---------------------------------------------------------------------------

  private _renderTabs(): void {
    this._stripEl.innerHTML = '';

    for (const tab of this._config.tabs) {
      const btn = document.createElement('button');
      btn.dataset['tabRole'] = 'tab';
      btn.dataset['tabId'] = tab.tabId;
      btn.id = `sw-tab-${tab.tabId}`;

      const labelEl = document.createElement('span');
      labelEl.className = 'sw-tab__label';
      labelEl.textContent = tab.label;
      btn.appendChild(labelEl);

      if (tab.badge !== undefined) {
        const badgeEl = document.createElement('span');
        badgeEl.className = 'sw-tab__badge';
        badgeEl.textContent = tab.badge;
        btn.appendChild(badgeEl);
      }

      const closeBtn = document.createElement('span');
      closeBtn.className = 'sw-tab__close';
      closeBtn.setAttribute('aria-label', 'Close tab');
      closeBtn.textContent = '✕';
      if (this._config.tabs.length <= 1) {
        closeBtn.style.display = 'none';
      }
      btn.appendChild(closeBtn);

      if (tab.tabId === this._config.activeTabId) {
        btn.dataset['tabActive'] = 'true';
        btn.setAttribute('aria-selected', 'true');
        btn.setAttribute('tabindex', '0');
      } else {
        btn.setAttribute('aria-selected', 'false');
        btn.setAttribute('tabindex', '-1');
      }

      this._stripEl.appendChild(btn);
    }

    requestAnimationFrame(() => this._updateChevrons());
  }

  private _updateChevrons(): void {
    const { scrollLeft, scrollWidth, clientWidth } = this._stripEl;
    const atStart = scrollLeft <= 0;
    const atEnd = scrollLeft + clientWidth >= scrollWidth - 1;

    this._leftChevron.style.display = atStart ? 'none' : '';
    this._rightChevron.style.display = atEnd ? 'none' : '';
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  update(tabs: TabSlot[], activeTabId: string): void {
    this._config.tabs = tabs;
    this._config.activeTabId = activeTabId;
    this._renderTabs();
  }

  scrollToTab(tabId: string): void {
    const btn = this._stripEl.querySelector(`[data-tab-id="${tabId}"]`) as HTMLElement | null;
    if (btn) {
      requestAnimationFrame(() => {
        btn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
      });
    }
  }

  focusTab(tabId: string): void {
    const btn = this._stripEl.querySelector(`[data-tab-id="${tabId}"]`) as HTMLButtonElement | null;
    btn?.focus();
  }

  get el(): HTMLElement {
    return this._rootEl;
  }

  destroy(): void {
    this._resizeObserver.disconnect();
    this._stripEl.removeEventListener('scroll', this._onScroll);
    this._rootEl.remove();
  }
}
