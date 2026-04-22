// Isometry v13.3 — Phase 174 Plan 03 TabBar
//
// TabBar renders a scrollable tab strip with chevron overflow controls,
// an add (+) button, and per-tab close (✕) buttons.
// Also handles drag-to-reorder (TABS-05) and keyboard navigation (TABS-07).
//
// Requirements: TABS-01, TABS-02, TABS-03, TABS-04, TABS-05, TABS-06, TABS-07

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
  onReorder: (fromIndex: number, toIndex: number) => void;
}

// ---------------------------------------------------------------------------
// Drag state type
// ---------------------------------------------------------------------------

interface DragState {
  active: boolean;
  startX: number;
  startY: number;
  pointerId: number;
  sourceIndex: number;
  sourceEl: HTMLElement;
  insertionLine: HTMLElement | null;
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
  private _dragState: DragState | null = null;

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

    // Drag-to-reorder: pointerdown on tab starts tracking (TABS-05)
    this._stripEl.addEventListener('pointerdown', (e: PointerEvent) => {
      const tabEl = (e.target as HTMLElement).closest('[data-tab-role="tab"]') as HTMLElement | null;
      if (!tabEl) return;
      const tabs = this._config.tabs;
      const tabId = tabEl.dataset['tabId'];
      const sourceIndex = tabs.findIndex((t) => t.tabId === tabId);
      if (sourceIndex === -1) return;

      e.preventDefault();
      tabEl.setPointerCapture(e.pointerId);
      this._dragState = {
        active: false,
        startX: e.clientX,
        startY: e.clientY,
        pointerId: e.pointerId,
        sourceIndex,
        sourceEl: tabEl,
        insertionLine: null,
      };
    });

    // pointermove: activate drag after 4px threshold, position insertion line
    this._stripEl.addEventListener('pointermove', (e: PointerEvent) => {
      const ds = this._dragState;
      if (!ds || ds.pointerId !== e.pointerId) return;

      if (!ds.active) {
        const moved = Math.abs(e.clientX - ds.startX) > 4 || Math.abs(e.clientY - ds.startY) > 4;
        if (!moved) return;
        // Enter drag mode
        ds.active = true;
        ds.sourceEl.dataset['tabDragging'] = 'true';
        const line = document.createElement('div');
        line.className = 'sw-tab-insertion-line';
        document.body.appendChild(line);
        ds.insertionLine = line;
      }

      // Position insertion line
      if (ds.insertionLine) {
        const stripRect = this._stripEl.getBoundingClientRect();
        const tabEls = Array.from(
          this._stripEl.querySelectorAll('[data-tab-role="tab"]')
        ) as HTMLElement[];

        let insertX = stripRect.left;
        let insertHeight = stripRect.height;
        let insertTop = stripRect.top;

        // Find where the pointer falls among tab midpoints
        let insertIndex = 0;
        for (let i = 0; i < tabEls.length; i++) {
          const rect = tabEls[i]!.getBoundingClientRect();
          const midX = rect.left + rect.width / 2;
          if (e.clientX > midX) {
            insertIndex = i + 1;
            insertX = rect.right;
            insertHeight = rect.height;
            insertTop = rect.top;
          } else if (i === 0 && e.clientX <= midX) {
            insertX = rect.left;
            insertHeight = rect.height;
            insertTop = rect.top;
            break;
          }
        }

        // Clamp insertX within strip
        if (insertIndex === tabEls.length && tabEls.length > 0) {
          const lastRect = tabEls[tabEls.length - 1]!.getBoundingClientRect();
          insertX = lastRect.right;
          insertHeight = lastRect.height;
          insertTop = lastRect.top;
        }

        ds.insertionLine.style.display = 'block';
        ds.insertionLine.style.left = `${insertX - 1}px`;
        ds.insertionLine.style.top = `${insertTop}px`;
        ds.insertionLine.style.height = `${insertHeight}px`;
      }
    });

    // pointerup: commit drag or clean up
    this._stripEl.addEventListener('pointerup', (e: PointerEvent) => {
      const ds = this._dragState;
      if (!ds || ds.pointerId !== e.pointerId) return;

      if (ds.active) {
        // Calculate toIndex from pointer position
        const tabEls = Array.from(
          this._stripEl.querySelectorAll('[data-tab-role="tab"]')
        ) as HTMLElement[];
        let toIndex = 0;
        for (let i = 0; i < tabEls.length; i++) {
          const rect = tabEls[i]!.getBoundingClientRect();
          const midX = rect.left + rect.width / 2;
          if (e.clientX > midX) toIndex = i + 1;
        }
        // Clamp toIndex
        if (toIndex > tabEls.length) toIndex = tabEls.length;
        // Adjust for the removed source element
        const fromIndex = ds.sourceIndex;
        let adjustedTo = toIndex;
        if (toIndex > fromIndex) adjustedTo = toIndex - 1;
        if (adjustedTo !== fromIndex) {
          this._config.onReorder(fromIndex, adjustedTo);
        }
      }

      // Cleanup
      if (ds.insertionLine) {
        ds.insertionLine.remove();
      }
      delete ds.sourceEl.dataset['tabDragging'];
      this._dragState = null;
    });

    // Keyboard navigation: ArrowLeft/Right/Home/End (TABS-07)
    this._stripEl.addEventListener('keydown', (e: KeyboardEvent) => {
      const tabs = this._config.tabs;
      const currentIndex = tabs.findIndex((t) => t.tabId === this._config.activeTabId);
      let nextIndex: number | null = null;

      if (e.key === 'ArrowRight') nextIndex = (currentIndex + 1) % tabs.length;
      else if (e.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
      else if (e.key === 'Home') nextIndex = 0;
      else if (e.key === 'End') nextIndex = tabs.length - 1;

      if (nextIndex !== null && nextIndex !== currentIndex) {
        e.preventDefault();
        this._config.onSwitch(tabs[nextIndex]!.tabId);
        // Focus the new tab button directly
        const newTabBtn = this._stripEl.querySelector(
          `[data-tab-id="${tabs[nextIndex]!.tabId}"]`
        ) as HTMLButtonElement | null;
        newTabBtn?.focus();
      }
    });

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
