// @vitest-environment jsdom
// Isometry v13.3 — Phase 174 Plan 03 SuperWidget Tests
// Verifies SLAT requirements + TABS-08 (Cmd+W), TABS-10 (onTabMetadataChange), reorder.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SuperWidget } from '../../src/superwidget/SuperWidget';
import type { CanvasFactory } from '../../src/superwidget/SuperWidget';
import type { CanvasComponent } from '../../src/superwidget/projection';

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

const stubFactory: CanvasFactory = () => ({
  mount: () => {},
  destroy: () => {},
});

const CSS_PATH = resolve(__dirname, '../../src/styles/superwidget.css');
const css = readFileSync(CSS_PATH, 'utf-8');

// ---------------------------------------------------------------------------
// SLAT-05: Lifecycle — mount/destroy/idempotency
// ---------------------------------------------------------------------------

describe('SuperWidget lifecycle (SLAT-05)', () => {
  let container: HTMLElement;
  let widget: SuperWidget;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    widget = new SuperWidget(stubFactory);
  });

  afterEach(() => {
    widget.destroy();
    container.remove();
  });

  it('SLAT-05: new SuperWidget(stubFactory) does not append to document before mount', () => {
    expect(container.children.length).toBe(0);
    expect(widget.mounted).toBe(false);
  });

  it('SLAT-05: mount(container) appends root to container and sets mounted=true', () => {
    widget.mount(container);
    expect(container.children.length).toBe(1);
    expect(container.firstElementChild).toBe(widget.rootEl);
    expect(widget.mounted).toBe(true);
  });

  it('SLAT-05: mount() is idempotent — calling twice only appends one child', () => {
    widget.mount(container);
    widget.mount(container);
    expect(container.children.length).toBe(1);
  });

  it('SLAT-05: destroy() removes root from DOM and sets mounted=false', () => {
    widget.mount(container);
    widget.destroy();
    expect(container.children.length).toBe(0);
    expect(widget.mounted).toBe(false);
  });

  it('SLAT-05: destroy() called when not mounted does not throw', () => {
    // widget is not mounted (beforeEach does not call mount)
    expect(() => widget.destroy()).not.toThrow();
    expect(widget.mounted).toBe(false);
  });

  it('all four slots have data-render-count="0" after construction', () => {
    expect(widget.headerEl.dataset['renderCount']).toBe('0');
    expect(widget.canvasEl.dataset['renderCount']).toBe('0');
    expect(widget.statusEl.dataset['renderCount']).toBe('0');
    expect(widget.tabsEl.dataset['renderCount']).toBe('0');
  });
});

// ---------------------------------------------------------------------------
// SLAT-01: Four named slots with correct data-slot attributes and DOM order
// ---------------------------------------------------------------------------

describe('SuperWidget slots (SLAT-01)', () => {
  let container: HTMLElement;
  let widget: SuperWidget;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    widget = new SuperWidget(stubFactory);
    widget.mount(container);
  });

  afterEach(() => {
    widget.destroy();
    container.remove();
  });

  it('SLAT-01: root element has data-component="superwidget"', () => {
    expect(widget.rootEl.dataset['component']).toBe('superwidget');
  });

  it('SLAT-01: root contains exactly 5 direct children with data-slot attributes', () => {
    const slottedChildren = Array.from(widget.rootEl.children).filter(
      (el) => el.hasAttribute('data-slot')
    );
    expect(slottedChildren.length).toBe(5);
  });

  it('SLAT-01: data-slot values are sidebar, header, tabs, canvas, status in DOM order', () => {
    const slots = Array.from(widget.rootEl.children)
      .filter((el) => el.hasAttribute('data-slot'))
      .map((el) => el.getAttribute('data-slot'));
    expect(slots).toEqual(['sidebar', 'header', 'tabs', 'canvas', 'status']);
  });

  it('SLAT-01: headerEl getter returns element with data-slot="header"', () => {
    expect(widget.headerEl.dataset['slot']).toBe('header');
  });

  it('SLAT-01: tabsEl getter returns element with data-slot="tabs"', () => {
    expect(widget.tabsEl.dataset['slot']).toBe('tabs');
  });

  it('SLAT-01: canvasEl getter returns element with data-slot="canvas"', () => {
    expect(widget.canvasEl.dataset['slot']).toBe('canvas');
  });

  it('SLAT-01: statusEl getter returns element with data-slot="status"', () => {
    expect(widget.statusEl.dataset['slot']).toBe('status');
  });
});

// ---------------------------------------------------------------------------
// SLAT-02: TabBar wired into tabs slot (Plan 174-02 replacement for config gear)
// ---------------------------------------------------------------------------

describe('TabBar in tabs slot (SLAT-02)', () => {
  let container: HTMLElement;
  let widget: SuperWidget;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    widget = new SuperWidget(stubFactory);
    widget.mount(container);
  });

  afterEach(() => {
    widget.destroy();
    container.remove();
  });

  it('SLAT-02: tabs slot contains .sw-tab-strip (TabBar rendered)', () => {
    const strip = widget.tabsEl.querySelector('.sw-tab-strip');
    expect(strip).not.toBeNull();
  });

  it('SLAT-02: tabs slot contains .sw-tab-strip__add button', () => {
    const addBtn = widget.tabsEl.querySelector('.sw-tab-strip__add');
    expect(addBtn).not.toBeNull();
  });

  it('SLAT-02: tabs slot does NOT contain config gear (data-tab-role="config" removed)', () => {
    const config = widget.tabsEl.querySelector('[data-tab-role="config"]');
    expect(config).toBeNull();
  });

  it('SLAT-02: tabs slot contains a tab button (data-tab-role="tab")', () => {
    const tabBtn = widget.tabsEl.querySelector('[data-tab-role="tab"]');
    expect(tabBtn).not.toBeNull();
  });

  it('SLAT-02: first tab has data-tab-active="true"', () => {
    const firstTab = widget.tabsEl.querySelector('[data-tab-role="tab"]');
    expect(firstTab?.getAttribute('data-tab-active')).toBe('true');
  });

  it('SLAT-02: .sw-tab-strip has role=tablist and aria-label="Workspace tabs"', () => {
    const strip = widget.tabsEl.querySelector('.sw-tab-strip');
    expect(strip?.getAttribute('role')).toBe('tablist');
    expect(strip?.getAttribute('aria-label')).toBe('Workspace tabs');
  });
});

// ---------------------------------------------------------------------------
// SLAT-03: Status slot is present in DOM and empty by default
// ---------------------------------------------------------------------------

describe('Status slot (SLAT-03)', () => {
  let container: HTMLElement;
  let widget: SuperWidget;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    widget = new SuperWidget(stubFactory);
    widget.mount(container);
  });

  afterEach(() => {
    widget.destroy();
    container.remove();
  });

  it('SLAT-03: status slot is present in DOM (not removed or display:none)', () => {
    const status = widget.rootEl.querySelector('[data-slot="status"]');
    expect(status).not.toBeNull();
  });

  it('SLAT-03: status slot has no children when empty (height governed by CSS min-height: 0)', () => {
    expect(widget.statusEl.children.length).toBe(0);
  });

  it('SLAT-03: CSS defines min-height: 0 on status slot (zero-height when empty)', () => {
    // SLAT-03: min-height: 0 on status slot prevents forced height when empty
    expect(css).toMatch(/\[data-slot="status"\][^{]*\{[^}]*min-height:\s*0/s);
  });
});

// ---------------------------------------------------------------------------
// SLAT-04: Tab overflow — chevron strip with scrollbar-width: none (Plan 174-02 D-09, D-10)
// ---------------------------------------------------------------------------

describe('Tab overflow chevrons (SLAT-04)', () => {
  it('SLAT-04: superwidget.css contains .sw-tab-strip (inner scrollable strip)', () => {
    expect(css).toContain('.sw-tab-strip');
  });

  it('SLAT-04: superwidget.css contains .sw-tab-strip__chevron (overflow buttons)', () => {
    expect(css).toContain('.sw-tab-strip__chevron');
  });

  it('SLAT-04: superwidget.css contains scrollbar-width: none on .sw-tab-strip', () => {
    expect(css).toContain('scrollbar-width: none');
  });

  it('SLAT-04: -webkit-scrollbar display: none is present for cross-browser support', () => {
    expect(css).toContain('::-webkit-scrollbar');
    expect(css).toContain('display: none');
  });

  it('SLAT-04: tabs slot does NOT use mask-image edge fade (replaced by chevrons)', () => {
    // Find the [data-slot="tabs"] rule block and verify it has no mask-image
    const tabsRuleMatch = css.match(/\[data-slot="tabs"\][^{]*\{[^}]*\}/s);
    expect(tabsRuleMatch).not.toBeNull();
    expect(tabsRuleMatch![0]).not.toContain('mask-image');
  });
});

// ---------------------------------------------------------------------------
// SLAT-06: CSS namespace — import in SuperWidget.ts, --sw-* only
// ---------------------------------------------------------------------------

describe('CSS namespace (SLAT-06)', () => {
  it('SLAT-06: SuperWidget.ts contains import of superwidget.css (no link tag injection)', () => {
    const srcPath = resolve(__dirname, '../../src/superwidget/SuperWidget.ts');
    const src = readFileSync(srcPath, 'utf-8');
    expect(src).toContain("import '../styles/superwidget.css'");
  });

  it('SLAT-06: superwidget.css only declares --sw-* custom properties (no --sg-* or --pv-* declarations)', () => {
    // Match custom property declarations: --sg- or --pv- at start of line (with whitespace)
    expect(css).not.toMatch(/^\s*--sg-/m);
    expect(css).not.toMatch(/^\s*--pv-/m);
  });

  it('SLAT-06: superwidget.css declares at least one --sw-* custom property', () => {
    expect(css).toMatch(/--sw-/);
  });
});

// ---------------------------------------------------------------------------
// SLAT-07: Root element has flex: 1 1 auto and min-height: 0
// ---------------------------------------------------------------------------

describe('Root flex (SLAT-07)', () => {
  it('SLAT-07: superwidget.css contains flex: 1 1 auto on root selector', () => {
    expect(css).toContain('flex: 1 1 auto');
  });

  it('SLAT-07: superwidget.css contains min-height: 0 on root selector block', () => {
    // Check that min-height: 0 appears in the root [data-component="superwidget"] rule block
    expect(css).toMatch(
      /\[data-component="superwidget"\][^{]*\{[^}]*min-height:\s*0/s
    );
  });

  it('SLAT-07: root element uses CSS Grid layout', () => {
    expect(css).toMatch(
      /\[data-component="superwidget"\][^{]*\{[^}]*display:\s*grid/s
    );
  });
});

// ---------------------------------------------------------------------------
// TABS-08: Cmd+W shortcut via ShortcutRegistry
// ---------------------------------------------------------------------------

describe('SuperWidget Cmd+W shortcut (TABS-08)', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  function makeMockShortcuts() {
    const handlers = new Map<string, () => void>();
    return {
      register: vi.fn((shortcut: string, handler: () => void) => { handlers.set(shortcut, handler); }),
      unregister: vi.fn(),
      _trigger: (shortcut: string) => { handlers.get(shortcut)?.(); },
    };
  }

  it('registers Cmd+W with ShortcutRegistry on construction', () => {
    const shortcuts = makeMockShortcuts();
    const widget = new SuperWidget(stubFactory, shortcuts as never);
    widget.mount(container);
    expect(shortcuts.register).toHaveBeenCalledWith('Cmd+W', expect.any(Function), expect.objectContaining({ category: 'Tabs' }));
    widget.destroy();
  });

  it('Cmd+W closes the active tab when multiple tabs exist', () => {
    const shortcuts = makeMockShortcuts();
    const widget = new SuperWidget(stubFactory, shortcuts as never);
    widget.mount(container);

    // Add a second tab via the + button
    const addBtn = container.querySelector('.sw-tab-strip__add') as HTMLElement;
    addBtn.click();
    expect(widget.tabs.length).toBe(2);

    shortcuts._trigger('Cmd+W');
    expect(widget.tabs.length).toBe(1);
    widget.destroy();
  });

  it('Cmd+W is no-op when only one tab remains', () => {
    const shortcuts = makeMockShortcuts();
    const widget = new SuperWidget(stubFactory, shortcuts as never);
    widget.mount(container);

    expect(widget.tabs.length).toBe(1);
    shortcuts._trigger('Cmd+W');
    expect(widget.tabs.length).toBe(1);
    widget.destroy();
  });

  it('unregisters Cmd+W on destroy()', () => {
    const shortcuts = makeMockShortcuts();
    const widget = new SuperWidget(stubFactory, shortcuts as never);
    widget.mount(container);
    widget.destroy();
    expect(shortcuts.unregister).toHaveBeenCalledWith('Cmd+W');
  });
});

// ---------------------------------------------------------------------------
// TABS-10: onTabMetadataChange injected after canvas mount
// ---------------------------------------------------------------------------

describe('SuperWidget onTabMetadataChange (TABS-10)', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  it('injects onTabMetadataChange onto canvas after mount', () => {
    let mountedCanvas: CanvasComponent | undefined;
    const factory: CanvasFactory = () => {
      const canvas: CanvasComponent = { mount: () => {}, destroy: () => {} };
      mountedCanvas = canvas;
      return canvas;
    };
    const widget = new SuperWidget(factory);
    widget.mount(container);
    widget.commitProjection({
      canvasType: 'View',
      canvasBinding: 'Bound',
      zoneRole: 'primary',
      canvasId: 'view-canvas',
      activeTabId: widget.activeTabSlotId,
      enabledTabIds: [widget.activeTabSlotId],
    });
    expect(mountedCanvas).toBeDefined();
    expect(typeof mountedCanvas!.onTabMetadataChange).toBe('function');
    widget.destroy();
  });

  it('calling onTabMetadataChange updates tab badge in TabBar', () => {
    let mountedCanvas: CanvasComponent | undefined;
    const factory: CanvasFactory = () => {
      const canvas: CanvasComponent = { mount: () => {}, destroy: () => {} };
      mountedCanvas = canvas;
      return canvas;
    };
    const widget = new SuperWidget(factory);
    widget.mount(container);
    const tabId = widget.activeTabSlotId;
    widget.commitProjection({
      canvasType: 'View',
      canvasBinding: 'Bound',
      zoneRole: 'primary',
      canvasId: 'view-canvas',
      activeTabId: tabId,
      enabledTabIds: [tabId],
    });

    // Canvas calls the injected callback to update badge
    mountedCanvas!.onTabMetadataChange!({ badge: '42' });

    // Verify the badge appeared in the tab bar
    const badgeEl = container.querySelector('.sw-tab__badge');
    expect(badgeEl?.textContent).toBe('42');
    widget.destroy();
  });

  it('calling onTabMetadataChange does NOT trigger canvas re-render (render count unchanged)', () => {
    let mountedCanvas: CanvasComponent | undefined;
    const factory: CanvasFactory = () => {
      const canvas: CanvasComponent = { mount: () => {}, destroy: () => {} };
      mountedCanvas = canvas;
      return canvas;
    };
    const widget = new SuperWidget(factory);
    widget.mount(container);
    const tabId = widget.activeTabSlotId;
    widget.commitProjection({
      canvasType: 'View',
      canvasBinding: 'Bound',
      zoneRole: 'primary',
      canvasId: 'view-canvas',
      activeTabId: tabId,
      enabledTabIds: [tabId],
    });
    const renderCountBefore = widget.canvasEl.dataset['renderCount'];

    mountedCanvas!.onTabMetadataChange!({ label: 'Updated Label' });

    expect(widget.canvasEl.dataset['renderCount']).toBe(renderCountBefore);
    widget.destroy();
  });
});

// ---------------------------------------------------------------------------
// TABS-05 (reorder via SuperWidget): _reorderTabs wired through TabBar config
// ---------------------------------------------------------------------------

describe('SuperWidget reorderTabs (TABS-05 integration)', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  it('tab order changes after drag reorder callback fires', () => {
    const widget = new SuperWidget(stubFactory);
    widget.mount(container);

    // Add a second tab
    const addBtn = container.querySelector('.sw-tab-strip__add') as HTMLElement;
    addBtn.click();
    expect(widget.tabs.length).toBe(2);

    const originalFirstId = widget.tabs[0]!.tabId;
    const originalSecondId = widget.tabs[1]!.tabId;

    // Simulate drag: trigger the strip's pointerdown/pointermove/pointerup on first tab
    const strip = container.querySelector('.sw-tab-strip') as HTMLElement;
    const firstTabEl = strip.querySelectorAll('[data-tab-role="tab"]')[0] as HTMLElement;
    const secondTabEl = strip.querySelectorAll('[data-tab-role="tab"]')[1] as HTMLElement;

    firstTabEl.getBoundingClientRect = () => ({ left: 10, right: 110, top: 0, bottom: 28, width: 100, height: 28 } as DOMRect);
    secondTabEl.getBoundingClientRect = () => ({ left: 114, right: 214, top: 0, bottom: 28, width: 100, height: 28 } as DOMRect);
    strip.getBoundingClientRect = () => ({ left: 0, right: 500, top: 0, bottom: 28, width: 500, height: 28 } as DOMRect);

    firstTabEl.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: 50, clientY: 10, pointerId: 1 }));
    strip.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: 180, clientY: 10, pointerId: 1 }));
    strip.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: 180, clientY: 10, pointerId: 1 }));

    // After drag, tab order should have changed
    expect(widget.tabs[0]!.tabId).toBe(originalSecondId);
    expect(widget.tabs[1]!.tabId).toBe(originalFirstId);

    // Clean up insertion line
    document.querySelectorAll('.sw-tab-insertion-line').forEach((el) => el.remove());
    widget.destroy();
  });
});

// ---------------------------------------------------------------------------
// SHEL-01/02: Sidebar slot — 5th grid slot spanning all rows
// ---------------------------------------------------------------------------

describe('SuperWidget sidebar slot (SHEL-01/02)', () => {
  let container: HTMLElement;
  let widget: SuperWidget;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    widget = new SuperWidget(stubFactory);
    widget.mount(container);
  });

  afterEach(() => {
    widget.destroy();
    container.remove();
  });

  it('root contains a [data-slot="sidebar"] child element', () => {
    const sidebar = widget.rootEl.querySelector('[data-slot="sidebar"]');
    expect(sidebar).not.toBeNull();
  });

  it('sidebarEl getter returns the sidebar slot element', () => {
    expect(widget.sidebarEl.dataset['slot']).toBe('sidebar');
  });

  it('sidebar slot has data-render-count="0" after construction', () => {
    expect(widget.sidebarEl.dataset['renderCount']).toBe('0');
  });
});

// ---------------------------------------------------------------------------
// SHEL-03: CommandBar injection via constructor
// ---------------------------------------------------------------------------

describe('SuperWidget CommandBar injection (SHEL-03)', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  function makeMockCommandBar() {
    return {
      mount: vi.fn(),
      destroy: vi.fn(),
      setSubtitle: vi.fn(),
    };
  }

  it('constructor without commandBar still works (backward compat)', () => {
    const widget = new SuperWidget(stubFactory);
    widget.mount(container);
    expect(widget.mounted).toBe(true);
    widget.destroy();
  });

  it('getCommandBar() returns undefined when no commandBar injected', () => {
    const widget = new SuperWidget(stubFactory);
    expect(widget.getCommandBar()).toBeUndefined();
    widget.destroy();
  });

  it('when commandBar provided, commandBar.mount() is called with headerEl', () => {
    const cb = makeMockCommandBar();
    const widget = new SuperWidget(stubFactory, undefined, cb as never);
    widget.mount(container);
    expect(cb.mount).toHaveBeenCalledWith(widget.headerEl);
    widget.destroy();
  });

  it('getCommandBar() returns the injected CommandBar instance', () => {
    const cb = makeMockCommandBar();
    const widget = new SuperWidget(stubFactory, undefined, cb as never);
    expect(widget.getCommandBar()).toBe(cb);
    widget.destroy();
  });

  it('headerEl has no "Zone" textContent when commandBar is provided', () => {
    const cb = makeMockCommandBar();
    const widget = new SuperWidget(stubFactory, undefined, cb as never);
    expect(widget.headerEl.textContent).not.toBe('Zone');
    widget.destroy();
  });

  it('destroy() calls commandBar.destroy() when commandBar was injected', () => {
    const cb = makeMockCommandBar();
    const widget = new SuperWidget(stubFactory, undefined, cb as never);
    widget.mount(container);
    widget.destroy();
    expect(cb.destroy).toHaveBeenCalled();
  });

  it('commitProjection does NOT overwrite headerEl.textContent when commandBar present', () => {
    const cb = makeMockCommandBar();
    const widget = new SuperWidget(stubFactory, undefined, cb as never);
    widget.mount(container);
    widget.commitProjection({
      canvasType: 'View',
      canvasBinding: 'Bound',
      zoneRole: 'primary',
      canvasId: 'view-canvas',
      activeTabId: widget.activeTabSlotId,
      enabledTabIds: [widget.activeTabSlotId],
    });
    // commandBar owns header — textContent should not be "Primary"
    expect(widget.headerEl.textContent).not.toBe('Primary');
    widget.destroy();
  });
});

// ---------------------------------------------------------------------------
// SHEL-02: Explorer passthrough accessors
// ---------------------------------------------------------------------------

describe('SuperWidget explorer passthrough (SHEL-02)', () => {
  let widget: SuperWidget;

  beforeEach(() => {
    widget = new SuperWidget(stubFactory);
  });

  afterEach(() => {
    widget.destroy();
  });

  it('getTopSlotEl() returns an HTMLElement with class sw-explorer-slot-top', () => {
    const el = widget.getTopSlotEl();
    expect(el).toBeInstanceOf(HTMLElement);
    expect(el.classList.contains('sw-explorer-slot-top')).toBe(true);
  });

  it('getBottomSlotEl() returns an HTMLElement with class sw-explorer-slot-bottom', () => {
    const el = widget.getBottomSlotEl();
    expect(el).toBeInstanceOf(HTMLElement);
    expect(el.classList.contains('sw-explorer-slot-bottom')).toBe(true);
  });

  it('getTopSlotEl() returns the same element on repeated calls', () => {
    expect(widget.getTopSlotEl()).toBe(widget.getTopSlotEl());
  });

  it('getBottomSlotEl() returns the same element on repeated calls', () => {
    expect(widget.getBottomSlotEl()).toBe(widget.getBottomSlotEl());
  });
});
