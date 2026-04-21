// @vitest-environment jsdom
// Isometry v13.0 — Phase 164 Plan 02 commitProjection Tests
// Covers RNDR-01..05: validation, canvas lifecycle, slot-scoped renders,
// canvas type switch, zone theme label, and reference-equality bail-out.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SuperWidget } from '../../src/superwidget/SuperWidget';
import type { CanvasFactory } from '../../src/superwidget/SuperWidget';
import type { CanvasComponent, Projection } from '../../src/superwidget/projection';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeProjection(overrides: Partial<Projection> = {}): Projection {
  return {
    canvasType: 'Explorer',
    canvasBinding: 'Unbound',
    zoneRole: 'primary',
    canvasId: 'explorer-1',
    activeTabId: 'tab-1',
    enabledTabIds: ['tab-1', 'tab-2'],
    ...overrides,
  };
}

function mockCanvasComponent(): CanvasComponent & {
  mount: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
} {
  return {
    mount: vi.fn(),
    destroy: vi.fn(),
  };
}

// ---------------------------------------------------------------------------
// RNDR-01: Valid projection mounts canvas
// ---------------------------------------------------------------------------

describe('RNDR-01: commitProjection — valid projection mounts canvas', () => {
  let container: HTMLElement;
  let widget: SuperWidget;
  let canvas: ReturnType<typeof mockCanvasComponent>;
  let factory: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    canvas = mockCanvasComponent();
    factory = vi.fn().mockReturnValue(canvas);
    widget = new SuperWidget(factory as CanvasFactory);
    widget.mount(container);
  });

  afterEach(() => {
    widget.destroy();
    container.remove();
    vi.restoreAllMocks();
  });

  it('RNDR-01: calls canvasFactory with proj.canvasId', () => {
    const proj = makeProjection({ canvasId: 'explorer-1' });
    widget.commitProjection(proj);
    expect(factory).toHaveBeenCalledWith('explorer-1');
  });

  it('RNDR-01: calls CanvasComponent.mount with canvasEl', () => {
    const proj = makeProjection();
    widget.commitProjection(proj);
    expect(canvas.mount).toHaveBeenCalledWith(widget.canvasEl);
  });

  it('RNDR-01: canvasEl.dataset.renderCount is "1" after first commit', () => {
    const proj = makeProjection();
    widget.commitProjection(proj);
    expect(widget.canvasEl.dataset['renderCount']).toBe('1');
  });

  it('RNDR-01: initial commit sets headerEl.dataset.renderCount to "1"', () => {
    const proj = makeProjection();
    widget.commitProjection(proj);
    expect(widget.headerEl.dataset['renderCount']).toBe('1');
  });

  it('RNDR-01: initial commit leaves statusEl.dataset.renderCount at "0"', () => {
    const proj = makeProjection();
    widget.commitProjection(proj);
    expect(widget.statusEl.dataset['renderCount']).toBe('0');
  });

  it('RNDR-01: initial commit leaves tabsEl.dataset.renderCount at "0"', () => {
    const proj = makeProjection();
    widget.commitProjection(proj);
    expect(widget.tabsEl.dataset['renderCount']).toBe('0');
  });
});

// ---------------------------------------------------------------------------
// RNDR-02: Invalid projection rejected
// ---------------------------------------------------------------------------

describe('RNDR-02: commitProjection — invalid projection rejected', () => {
  let container: HTMLElement;
  let widget: SuperWidget;
  let factory: ReturnType<typeof vi.fn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    factory = vi.fn().mockReturnValue(mockCanvasComponent());
    widget = new SuperWidget(factory as CanvasFactory);
    widget.mount(container);
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    widget.destroy();
    container.remove();
    vi.restoreAllMocks();
  });

  it('RNDR-02: invalid projection (empty enabledTabIds) logs console.warn with prefix', () => {
    const proj = makeProjection({ enabledTabIds: [] });
    widget.commitProjection(proj);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringMatching(/\[SuperWidget\] commitProjection rejected:/)
    );
  });

  it('RNDR-02: invalid projection does NOT call canvasFactory', () => {
    const proj = makeProjection({ enabledTabIds: [] });
    widget.commitProjection(proj);
    expect(factory).not.toHaveBeenCalled();
  });

  it('RNDR-02: invalid projection leaves canvasEl with no children', () => {
    const proj = makeProjection({ enabledTabIds: [] });
    widget.commitProjection(proj);
    expect(widget.canvasEl.children.length).toBe(0);
  });

  it('RNDR-02: invalid projection leaves all data-render-count at "0"', () => {
    const proj = makeProjection({ enabledTabIds: [] });
    widget.commitProjection(proj);
    expect(widget.headerEl.dataset['renderCount']).toBe('0');
    expect(widget.canvasEl.dataset['renderCount']).toBe('0');
    expect(widget.statusEl.dataset['renderCount']).toBe('0');
    expect(widget.tabsEl.dataset['renderCount']).toBe('0');
  });

  it('RNDR-02: factory returns undefined — logs console.warn with canvasId reference', () => {
    const undefinedFactory = vi.fn().mockReturnValue(undefined);
    const widget2 = new SuperWidget(undefinedFactory as CanvasFactory);
    widget2.mount(container);

    const proj = makeProjection({ canvasId: 'unknown-canvas' });
    widget2.commitProjection(proj);

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringMatching(/canvasFactory returned undefined for canvasId:/)
    );
    expect(widget2.canvasEl.dataset['renderCount']).toBe('0');
    widget2.destroy();
  });
});

// ---------------------------------------------------------------------------
// RNDR-03: Tab switch increments canvas render count only
// ---------------------------------------------------------------------------

describe('RNDR-03: commitProjection — tab switch only increments canvas slot', () => {
  let container: HTMLElement;
  let widget: SuperWidget;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    const canvas = mockCanvasComponent();
    const factory: CanvasFactory = vi.fn().mockReturnValue(canvas);
    widget = new SuperWidget(factory);
    widget.mount(container);
  });

  afterEach(() => {
    widget.destroy();
    container.remove();
  });

  it('RNDR-03: tab switch increments canvasEl.renderCount to "2"', () => {
    const proj1 = makeProjection({ activeTabId: 'tab-1' });
    const proj2 = makeProjection({ activeTabId: 'tab-2' });
    widget.commitProjection(proj1);
    widget.commitProjection(proj2);
    expect(widget.canvasEl.dataset['renderCount']).toBe('2');
  });

  it('RNDR-03: tab switch leaves headerEl.renderCount at "1" (unchanged after initial render)', () => {
    const proj1 = makeProjection({ activeTabId: 'tab-1' });
    const proj2 = makeProjection({ activeTabId: 'tab-2' });
    widget.commitProjection(proj1);
    widget.commitProjection(proj2);
    expect(widget.headerEl.dataset['renderCount']).toBe('1');
  });

  it('RNDR-03: tab switch leaves statusEl.renderCount at "0"', () => {
    const proj1 = makeProjection({ activeTabId: 'tab-1' });
    const proj2 = makeProjection({ activeTabId: 'tab-2' });
    widget.commitProjection(proj1);
    widget.commitProjection(proj2);
    expect(widget.statusEl.dataset['renderCount']).toBe('0');
  });

  it('RNDR-03: tab switch leaves tabsEl.renderCount at "0"', () => {
    const proj1 = makeProjection({ activeTabId: 'tab-1' });
    const proj2 = makeProjection({ activeTabId: 'tab-2' });
    widget.commitProjection(proj1);
    widget.commitProjection(proj2);
    expect(widget.tabsEl.dataset['renderCount']).toBe('0');
  });
});

// ---------------------------------------------------------------------------
// RNDR-04: Canvas type switch — destroy prior, mount new, reset count to 1
// ---------------------------------------------------------------------------

describe('RNDR-04: commitProjection — canvas type switch lifecycle', () => {
  let container: HTMLElement;
  let widget: SuperWidget;
  let firstCanvas: ReturnType<typeof mockCanvasComponent>;
  let secondCanvas: ReturnType<typeof mockCanvasComponent>;
  let factory: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    firstCanvas = mockCanvasComponent();
    secondCanvas = mockCanvasComponent();
    factory = vi.fn()
      .mockReturnValueOnce(firstCanvas)
      .mockReturnValueOnce(secondCanvas);
    widget = new SuperWidget(factory as CanvasFactory);
    widget.mount(container);
  });

  afterEach(() => {
    widget.destroy();
    container.remove();
  });

  it('RNDR-04: prior canvas.destroy() called before new canvas.mount()', () => {
    const destroyOrder: string[] = [];
    firstCanvas.destroy.mockImplementation(() => destroyOrder.push('destroy'));
    secondCanvas.mount.mockImplementation(() => destroyOrder.push('mount'));

    widget.commitProjection(makeProjection({ canvasType: 'Explorer', canvasId: 'explorer-1' }));
    widget.commitProjection(makeProjection({ canvasType: 'View', canvasId: 'view-1' }));

    expect(destroyOrder).toEqual(['destroy', 'mount']);
  });

  it('RNDR-04: first canvas destroy() is called on canvas type switch', () => {
    widget.commitProjection(makeProjection({ canvasType: 'Explorer', canvasId: 'explorer-1' }));
    widget.commitProjection(makeProjection({ canvasType: 'View', canvasId: 'view-1' }));
    expect(firstCanvas.destroy).toHaveBeenCalledTimes(1);
  });

  it('RNDR-04: canvasFactory called with new canvasId on switch', () => {
    widget.commitProjection(makeProjection({ canvasType: 'Explorer', canvasId: 'explorer-1' }));
    widget.commitProjection(makeProjection({ canvasType: 'View', canvasId: 'view-1' }));
    expect(factory).toHaveBeenCalledWith('view-1');
  });

  it('RNDR-04: new canvas.mount() called with canvasEl on switch', () => {
    widget.commitProjection(makeProjection({ canvasType: 'Explorer', canvasId: 'explorer-1' }));
    widget.commitProjection(makeProjection({ canvasType: 'View', canvasId: 'view-1' }));
    expect(secondCanvas.mount).toHaveBeenCalledWith(widget.canvasEl);
  });

  it('RNDR-04: canvasEl.renderCount is reset to "1" after canvas type switch (not "2")', () => {
    widget.commitProjection(makeProjection({ canvasType: 'Explorer', canvasId: 'explorer-1' }));
    widget.commitProjection(makeProjection({ canvasType: 'View', canvasId: 'view-1' }));
    expect(widget.canvasEl.dataset['renderCount']).toBe('1');
  });
});

// ---------------------------------------------------------------------------
// RNDR-05: Zone theme label (header textContent)
// ---------------------------------------------------------------------------

describe('RNDR-05: commitProjection — zone theme header label', () => {
  let container: HTMLElement;
  let widget: SuperWidget;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    const factory: CanvasFactory = () => mockCanvasComponent();
    widget = new SuperWidget(factory);
    widget.mount(container);
  });

  afterEach(() => {
    widget.destroy();
    container.remove();
  });

  it('RNDR-05: zoneRole="primary" sets headerEl.textContent to "Primary"', () => {
    widget.commitProjection(makeProjection({ zoneRole: 'primary' }));
    expect(widget.headerEl.textContent).toBe('Primary');
  });

  it('RNDR-05: zoneRole="secondary" sets headerEl.textContent to "Secondary"', () => {
    widget.commitProjection(makeProjection({ zoneRole: 'secondary' }));
    expect(widget.headerEl.textContent).toBe('Secondary');
  });

  it('RNDR-05: zoneRole="tertiary" sets headerEl.textContent to "Tertiary"', () => {
    widget.commitProjection(makeProjection({ zoneRole: 'tertiary' }));
    expect(widget.headerEl.textContent).toBe('Tertiary');
  });

  it('RNDR-05: zoneRole change increments headerEl.renderCount', () => {
    widget.commitProjection(makeProjection({ zoneRole: 'primary' }));
    widget.commitProjection(makeProjection({ zoneRole: 'secondary' }));
    expect(widget.headerEl.dataset['renderCount']).toBe('2');
  });

  it('RNDR-05: zoneRole="secondary" (second commit) sets correct textContent', () => {
    widget.commitProjection(makeProjection({ zoneRole: 'primary' }));
    widget.commitProjection(makeProjection({ zoneRole: 'secondary' }));
    expect(widget.headerEl.textContent).toBe('Secondary');
  });
});

// ---------------------------------------------------------------------------
// Bail-out: reference equality skips all rendering
// ---------------------------------------------------------------------------

describe('Bail-out: reference-equal Projection skips rendering', () => {
  let container: HTMLElement;
  let widget: SuperWidget;
  let factory: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    factory = vi.fn().mockReturnValue(mockCanvasComponent());
    widget = new SuperWidget(factory as CanvasFactory);
    widget.mount(container);
  });

  afterEach(() => {
    widget.destroy();
    container.remove();
  });

  it('bail-out: canvasFactory called only once when same reference committed twice', () => {
    const proj = makeProjection();
    widget.commitProjection(proj);
    widget.commitProjection(proj);
    expect(factory).toHaveBeenCalledTimes(1);
  });

  it('bail-out: canvasEl.renderCount stays "1" when same reference committed twice', () => {
    const proj = makeProjection();
    widget.commitProjection(proj);
    widget.commitProjection(proj);
    expect(widget.canvasEl.dataset['renderCount']).toBe('1');
  });

  it('bail-out: headerEl.renderCount stays "1" when same reference committed twice', () => {
    const proj = makeProjection();
    widget.commitProjection(proj);
    widget.commitProjection(proj);
    expect(widget.headerEl.dataset['renderCount']).toBe('1');
  });
});
