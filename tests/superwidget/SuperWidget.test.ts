// @vitest-environment jsdom
// Isometry v13.0 — Phase 162 SuperWidget Substrate Tests
// Verifies all 7 SLAT requirements: DOM structure, lifecycle, slot attributes,
// config gear positioning, status zero-height, tab overflow mask, root flex.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SuperWidget } from '../../src/superwidget/SuperWidget';
import type { CanvasFactory } from '../../src/superwidget/SuperWidget';

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

  it('SLAT-01: root contains exactly 4 direct children with data-slot attributes', () => {
    const slottedChildren = Array.from(widget.rootEl.children).filter(
      (el) => el.hasAttribute('data-slot')
    );
    expect(slottedChildren.length).toBe(4);
  });

  it('SLAT-01: data-slot values are header, tabs, canvas, status in DOM order', () => {
    const slots = Array.from(widget.rootEl.children)
      .filter((el) => el.hasAttribute('data-slot'))
      .map((el) => el.getAttribute('data-slot'));
    expect(slots).toEqual(['header', 'tabs', 'canvas', 'status']);
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
