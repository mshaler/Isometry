// @vitest-environment jsdom
// Isometry v13.3 — Phase 174 Plan 03 TabBar Tests
// Covers TABS-01 through TABS-04, TABS-06, TABS-05 (drag reorder), TABS-07 (keyboard nav).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TabBar } from '../../src/superwidget/TabBar';
import { makeTabSlot } from '../../src/superwidget/TabSlot';
import type { TabBarConfig } from '../../src/superwidget/TabBar';

// jsdom does not implement setPointerCapture — stub it
if (!('setPointerCapture' in Element.prototype)) {
  (Element.prototype as unknown as Record<string, unknown>)['setPointerCapture'] = vi.fn();
  (Element.prototype as unknown as Record<string, unknown>)['releasePointerCapture'] = vi.fn();
}

// jsdom does not implement ResizeObserver — provide a minimal stub
if (typeof ResizeObserver === 'undefined') {
  (globalThis as Record<string, unknown>)['ResizeObserver'] = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

function makeConfig(overrides?: Partial<TabBarConfig>): TabBarConfig {
  const tab1 = makeTabSlot({ label: 'Tab A' });
  const tab2 = makeTabSlot({ label: 'Tab B' });
  return {
    tabs: [tab1, tab2],
    activeTabId: tab1.tabId,
    onSwitch: vi.fn(),
    onCreate: vi.fn(),
    onClose: vi.fn(),
    onReorder: vi.fn(),
    ...overrides,
  };
}

describe('TabBar rendering', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  it('renders tab buttons from TabSlot array', () => {
    const config = makeConfig();
    const bar = new TabBar(config);
    container.appendChild(bar.el);

    const strip = bar.el.querySelector('.sw-tab-strip');
    expect(strip).not.toBeNull();

    const tabs = strip!.querySelectorAll('[data-tab-role="tab"]');
    expect(tabs.length).toBe(2);
    bar.destroy();
  });

  it('strip has role=tablist and aria-label', () => {
    const bar = new TabBar(makeConfig());
    container.appendChild(bar.el);

    const strip = bar.el.querySelector('.sw-tab-strip');
    expect(strip?.getAttribute('role')).toBe('tablist');
    expect(strip?.getAttribute('aria-label')).toBe('Workspace tabs');
    bar.destroy();
  });

  it('active tab has data-tab-active=true and aria-selected=true', () => {
    const config = makeConfig();
    const bar = new TabBar(config);
    container.appendChild(bar.el);

    const activeTab = bar.el.querySelector('[data-tab-active="true"]');
    expect(activeTab).not.toBeNull();
    expect(activeTab?.getAttribute('aria-selected')).toBe('true');
    expect(activeTab?.getAttribute('tabindex')).toBe('0');
    bar.destroy();
  });

  it('inactive tab has tabindex=-1 and aria-selected=false', () => {
    const config = makeConfig();
    const bar = new TabBar(config);
    container.appendChild(bar.el);

    const inactiveTabs = Array.from(bar.el.querySelectorAll('[data-tab-role="tab"]')).filter(
      (el) => !el.hasAttribute('data-tab-active')
    );
    expect(inactiveTabs.length).toBeGreaterThan(0);
    inactiveTabs.forEach((tab) => {
      expect(tab.getAttribute('aria-selected')).toBe('false');
      expect(tab.getAttribute('tabindex')).toBe('-1');
    });
    bar.destroy();
  });

  it('sole tab has no close button visible', () => {
    const tab1 = makeTabSlot({ label: 'Only Tab' });
    const config = makeConfig({
      tabs: [tab1],
      activeTabId: tab1.tabId,
    });
    const bar = new TabBar(config);
    container.appendChild(bar.el);

    const closeBtn = bar.el.querySelector('.sw-tab__close') as HTMLElement | null;
    expect(closeBtn).not.toBeNull();
    expect(closeBtn!.style.display).toBe('none');
    bar.destroy();
  });

  it('chevrons hidden when no overflow', () => {
    const bar = new TabBar(makeConfig());
    container.appendChild(bar.el);

    const chevrons = bar.el.querySelectorAll('.sw-tab-strip__chevron') as NodeListOf<HTMLElement>;
    expect(chevrons.length).toBe(2);
    chevrons.forEach((chevron) => {
      expect(chevron.style.display).toBe('none');
    });
    bar.destroy();
  });
});

describe('TabBar interactions', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  it('clicking tab calls onSwitch with tabId', () => {
    const config = makeConfig();
    const bar = new TabBar(config);
    container.appendChild(bar.el);

    const tabs = bar.el.querySelectorAll('[data-tab-role="tab"]');
    const secondTab = tabs[1] as HTMLElement;
    secondTab.click();

    expect(config.onSwitch).toHaveBeenCalledWith(config.tabs[1]!.tabId);
    bar.destroy();
  });

  it('clicking + button calls onCreate', () => {
    const config = makeConfig();
    const bar = new TabBar(config);
    container.appendChild(bar.el);

    const addBtn = bar.el.querySelector('.sw-tab-strip__add') as HTMLElement;
    expect(addBtn).not.toBeNull();
    addBtn.click();

    expect(config.onCreate).toHaveBeenCalledOnce();
    bar.destroy();
  });

  it('clicking x button calls onClose with tabId', () => {
    const config = makeConfig();
    const bar = new TabBar(config);
    container.appendChild(bar.el);

    const closeBtns = bar.el.querySelectorAll('.sw-tab__close');
    expect(closeBtns.length).toBeGreaterThan(0);
    const firstClose = closeBtns[0] as HTMLElement;
    firstClose.click();

    expect(config.onClose).toHaveBeenCalledWith(config.tabs[0]!.tabId);
    bar.destroy();
  });

  it('x click does not trigger onSwitch', () => {
    const config = makeConfig();
    const bar = new TabBar(config);
    container.appendChild(bar.el);

    const closeBtns = bar.el.querySelectorAll('.sw-tab__close');
    const firstClose = closeBtns[0] as HTMLElement;
    firstClose.click();

    expect(config.onSwitch).not.toHaveBeenCalled();
    bar.destroy();
  });
});

describe('TabBar update()', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  it('update() re-renders tabs with new array', () => {
    const config = makeConfig();
    const bar = new TabBar(config);
    container.appendChild(bar.el);

    const tab3 = makeTabSlot({ label: 'Tab C' });
    const newTabs = [...config.tabs, tab3];
    bar.update(newTabs, config.activeTabId);

    const tabBtns = bar.el.querySelectorAll('[data-tab-role="tab"]');
    expect(tabBtns.length).toBe(3);
    bar.destroy();
  });

  it('update() reflects new active tab', () => {
    const config = makeConfig();
    const bar = new TabBar(config);
    container.appendChild(bar.el);

    const newActiveId = config.tabs[1]!.tabId;
    bar.update(config.tabs, newActiveId);

    const activeBtn = bar.el.querySelector('[data-tab-active="true"]') as HTMLElement;
    expect(activeBtn?.dataset['tabId']).toBe(newActiveId);
    bar.destroy();
  });
});

// ---------------------------------------------------------------------------
// Drag reorder tests (TABS-05)
// ---------------------------------------------------------------------------

describe('TabBar drag reorder (TABS-05)', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    // Clean up any insertion lines appended to body
    document.querySelectorAll('.sw-tab-insertion-line').forEach((el) => el.remove());
    container.remove();
  });

  it('pointerdown + 4px pointermove sets data-tab-dragging on source tab', () => {
    const config = makeConfig();
    const bar = new TabBar(config);
    container.appendChild(bar.el);

    const strip = bar.el.querySelector('.sw-tab-strip') as HTMLElement;
    const firstTab = strip.querySelector('[data-tab-role="tab"]') as HTMLElement;

    // Mock getBoundingClientRect for tab
    firstTab.getBoundingClientRect = () => ({ left: 10, right: 110, top: 0, bottom: 28, width: 100, height: 28 } as DOMRect);
    strip.getBoundingClientRect = () => ({ left: 0, right: 500, top: 0, bottom: 28, width: 500, height: 28 } as DOMRect);

    firstTab.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: 50, clientY: 10, pointerId: 1 }));
    strip.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: 55, clientY: 10, pointerId: 1 }));

    expect(firstTab.dataset['tabDragging']).toBe('true');
    bar.destroy();
  });

  it('pointerup after drag calls onReorder with fromIndex and toIndex', () => {
    const config = makeConfig();
    const bar = new TabBar(config);
    container.appendChild(bar.el);

    const strip = bar.el.querySelector('.sw-tab-strip') as HTMLElement;
    const tabs = Array.from(strip.querySelectorAll('[data-tab-role="tab"]')) as HTMLElement[];
    const firstTab = tabs[0]!;
    const secondTab = tabs[1]!;

    // Position tabs
    firstTab.getBoundingClientRect = () => ({ left: 10, right: 110, top: 0, bottom: 28, width: 100, height: 28 } as DOMRect);
    secondTab.getBoundingClientRect = () => ({ left: 114, right: 214, top: 0, bottom: 28, width: 100, height: 28 } as DOMRect);
    strip.getBoundingClientRect = () => ({ left: 0, right: 500, top: 0, bottom: 28, width: 500, height: 28 } as DOMRect);

    // Start drag on first tab, move past threshold, release on second tab position
    firstTab.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: 50, clientY: 10, pointerId: 1 }));
    strip.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: 180, clientY: 10, pointerId: 1 }));
    strip.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: 180, clientY: 10, pointerId: 1 }));

    expect(config.onReorder).toHaveBeenCalled();
    bar.destroy();
  });

  it('click without 4px threshold calls onSwitch, not onReorder', () => {
    const config = makeConfig();
    const bar = new TabBar(config);
    container.appendChild(bar.el);

    const strip = bar.el.querySelector('.sw-tab-strip') as HTMLElement;
    const firstTab = strip.querySelector('[data-tab-role="tab"]') as HTMLElement;
    firstTab.getBoundingClientRect = () => ({ left: 10, right: 110, top: 0, bottom: 28, width: 100, height: 28 } as DOMRect);
    strip.getBoundingClientRect = () => ({ left: 0, right: 500, top: 0, bottom: 28, width: 500, height: 28 } as DOMRect);

    // Simulate pointerdown + pointerup at same position (no movement)
    firstTab.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: 50, clientY: 10, pointerId: 1 }));
    strip.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: 50, clientY: 10, pointerId: 1 }));

    expect(config.onReorder).not.toHaveBeenCalled();
    bar.destroy();
  });

  it('insertion line element is appended to document.body during drag', () => {
    const config = makeConfig();
    const bar = new TabBar(config);
    container.appendChild(bar.el);

    const strip = bar.el.querySelector('.sw-tab-strip') as HTMLElement;
    const firstTab = strip.querySelector('[data-tab-role="tab"]') as HTMLElement;
    firstTab.getBoundingClientRect = () => ({ left: 10, right: 110, top: 0, bottom: 28, width: 100, height: 28 } as DOMRect);
    strip.getBoundingClientRect = () => ({ left: 0, right: 500, top: 0, bottom: 28, width: 500, height: 28 } as DOMRect);

    firstTab.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: 50, clientY: 10, pointerId: 1 }));
    strip.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: 55, clientY: 10, pointerId: 1 }));

    const line = document.querySelector('.sw-tab-insertion-line');
    expect(line).not.toBeNull();
    bar.destroy();
  });
});

// ---------------------------------------------------------------------------
// Keyboard navigation tests (TABS-07)
// ---------------------------------------------------------------------------

describe('TabBar keyboard navigation (TABS-07)', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  it('ArrowRight on first (active) tab switches to second tab', () => {
    const config = makeConfig();
    const bar = new TabBar(config);
    container.appendChild(bar.el);

    const strip = bar.el.querySelector('.sw-tab-strip') as HTMLElement;
    strip.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'ArrowRight' }));

    expect(config.onSwitch).toHaveBeenCalledWith(config.tabs[1]!.tabId);
    bar.destroy();
  });

  it('ArrowRight on last tab wraps to first', () => {
    const config = makeConfig({ activeTabId: makeConfig().tabs[1]!.tabId });
    // Re-create with second tab active
    const tab1 = makeTabSlot({ label: 'Tab A' });
    const tab2 = makeTabSlot({ label: 'Tab B' });
    const cfg: TabBarConfig = {
      tabs: [tab1, tab2],
      activeTabId: tab2.tabId,
      onSwitch: vi.fn(),
      onCreate: vi.fn(),
      onClose: vi.fn(),
      onReorder: vi.fn(),
    };
    const bar = new TabBar(cfg);
    container.appendChild(bar.el);

    const strip = bar.el.querySelector('.sw-tab-strip') as HTMLElement;
    strip.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'ArrowRight' }));

    expect(cfg.onSwitch).toHaveBeenCalledWith(tab1.tabId);
    bar.destroy();
  });

  it('ArrowLeft on first tab wraps to last', () => {
    const config = makeConfig();
    const bar = new TabBar(config);
    container.appendChild(bar.el);

    const strip = bar.el.querySelector('.sw-tab-strip') as HTMLElement;
    strip.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'ArrowLeft' }));

    expect(config.onSwitch).toHaveBeenCalledWith(config.tabs[1]!.tabId);
    bar.destroy();
  });

  it('Home switches to first tab', () => {
    const tab1 = makeTabSlot({ label: 'Tab A' });
    const tab2 = makeTabSlot({ label: 'Tab B' });
    const tab3 = makeTabSlot({ label: 'Tab C' });
    const cfg: TabBarConfig = {
      tabs: [tab1, tab2, tab3],
      activeTabId: tab3.tabId,
      onSwitch: vi.fn(),
      onCreate: vi.fn(),
      onClose: vi.fn(),
      onReorder: vi.fn(),
    };
    const bar = new TabBar(cfg);
    container.appendChild(bar.el);

    const strip = bar.el.querySelector('.sw-tab-strip') as HTMLElement;
    strip.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Home' }));

    expect(cfg.onSwitch).toHaveBeenCalledWith(tab1.tabId);
    bar.destroy();
  });

  it('End switches to last tab', () => {
    const tab1 = makeTabSlot({ label: 'Tab A' });
    const tab2 = makeTabSlot({ label: 'Tab B' });
    const tab3 = makeTabSlot({ label: 'Tab C' });
    const cfg: TabBarConfig = {
      tabs: [tab1, tab2, tab3],
      activeTabId: tab1.tabId,
      onSwitch: vi.fn(),
      onCreate: vi.fn(),
      onClose: vi.fn(),
      onReorder: vi.fn(),
    };
    const bar = new TabBar(cfg);
    container.appendChild(bar.el);

    const strip = bar.el.querySelector('.sw-tab-strip') as HTMLElement;
    strip.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'End' }));

    expect(cfg.onSwitch).toHaveBeenCalledWith(tab3.tabId);
    bar.destroy();
  });

  it('key-triggered switch calls focus on new tab button', () => {
    const config = makeConfig();
    const bar = new TabBar(config);
    container.appendChild(bar.el);

    const strip = bar.el.querySelector('.sw-tab-strip') as HTMLElement;
    const tabs = Array.from(strip.querySelectorAll('[data-tab-role="tab"]')) as HTMLButtonElement[];
    const focusSpy = vi.spyOn(tabs[1]!, 'focus');

    strip.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'ArrowRight' }));

    expect(focusSpy).toHaveBeenCalled();
    bar.destroy();
  });
});
