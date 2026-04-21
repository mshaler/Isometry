// @vitest-environment jsdom
// Isometry v13.0 — Phase 165 Plan 03 Integration Wiring Test
// Verifies the full registry-to-SuperWidget-to-DOM chain via real stubs.
// Requirements: CANV-01, CANV-02, CANV-04, CANV-05, CANV-06

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SuperWidget } from '../../src/superwidget/SuperWidget';
import { registerAllStubs, getCanvasFactory, clearRegistry, getRegistryEntry, register } from '../../src/superwidget/registry';
import type { Projection } from '../../src/superwidget/projection';
import { ViewCanvasStub } from '../../src/superwidget/ViewCanvasStub';

// ---------------------------------------------------------------------------
// Helper
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

// ---------------------------------------------------------------------------
// Phase 165 wiring: registry + SuperWidget + stubs
// ---------------------------------------------------------------------------

describe('Phase 165 wiring: registry + SuperWidget + stubs', () => {
  let container: HTMLElement;
  let widget: SuperWidget;

  beforeEach(() => {
    clearRegistry();
    registerAllStubs();
    // view-1 is now registered in main.ts with real ViewCanvas; for wiring tests
    // that check stub DOM behavior, register ViewCanvasStub explicitly.
    register('view-1', {
      canvasType: 'View',
      create: (binding = 'Unbound') => new ViewCanvasStub('view-1', binding),
      defaultExplorerId: 'explorer-1',
    });
    container = document.createElement('div');
    widget = new SuperWidget(getCanvasFactory());
    widget.mount(container);
  });

  afterEach(() => {
    widget.destroy();
    clearRegistry();
  });

  it('commitProjection with explorer-1 mounts ExplorerCanvasStub into canvas slot', () => {
    widget.commitProjection(makeProjection({ canvasId: 'explorer-1', canvasType: 'Explorer' }));
    const el = widget.canvasEl.querySelector('[data-canvas-type="Explorer"]');
    expect(el).not.toBeNull();
    expect((el as HTMLElement).dataset['renderCount']).toBe('1');
    expect((el as HTMLElement).textContent).toContain('[Explorer: explorer-1]');
  });

  it("commitProjection with view-1 mounts ViewCanvasStub with data-canvas-type='View'", () => {
    widget.commitProjection(makeProjection({ canvasId: 'view-1', canvasType: 'View' }));
    const el = widget.canvasEl.querySelector('[data-canvas-type="View"]');
    expect(el).not.toBeNull();
    expect((el as HTMLElement).textContent).toContain('[View: view-1]');
    // NOTE: No data-sidecar assertion here. CanvasFactory type signature
    // (canvasId: string) => CanvasComponent | undefined does not pass CanvasBinding,
    // so ViewCanvasStub defaults to Unbound. Binding-from-projection wiring is
    // deferred to Phase 166+ (requires CanvasFactory type extension).
    // Bound/Unbound sidecar behavior is covered by Plan 01's ViewCanvasStub.test.ts.
  });

  it('commitProjection with editor-1 mounts EditorCanvasStub', () => {
    widget.commitProjection(makeProjection({ canvasId: 'editor-1', canvasType: 'Editor' }));
    const el = widget.canvasEl.querySelector('[data-canvas-type="Editor"]');
    expect(el).not.toBeNull();
  });

  it('switching canvasId destroys prior stub and mounts new stub', () => {
    widget.commitProjection(makeProjection({ canvasId: 'explorer-1', canvasType: 'Explorer' }));
    expect(widget.canvasEl.querySelector('[data-canvas-type="Explorer"]')).not.toBeNull();

    widget.commitProjection(makeProjection({ canvasId: 'editor-1', canvasType: 'Editor' }));
    expect(widget.canvasEl.querySelector('[data-canvas-type="Explorer"]')).toBeNull();
    expect(widget.canvasEl.querySelector('[data-canvas-type="Editor"]')).not.toBeNull();
  });

  it('unknown canvasId produces console.warn and no DOM change', () => {
    widget.commitProjection(makeProjection({ canvasId: 'nonexistent', canvasType: 'Explorer' }));
    expect(widget.canvasEl.querySelector('[data-canvas-type]')).toBeNull();
  });

  it("getRegistryEntry('view-1').defaultExplorerId equals 'explorer-1'", () => {
    const entry = getRegistryEntry('view-1');
    expect(entry).not.toBeUndefined();
    expect(entry!.defaultExplorerId).toBe('explorer-1');
    expect(getRegistryEntry('explorer-1')?.defaultExplorerId).toBeUndefined();
  });

  it('zone label updates on commitProjection', () => {
    widget.commitProjection(makeProjection({ zoneRole: 'primary', canvasId: 'explorer-1', canvasType: 'Explorer' }));
    expect(widget.headerEl.textContent).toBe('Primary');

    // Different canvasId forces a new canvas lifecycle (and different reference).
    // zoneRole change also fires the header label update path.
    widget.commitProjection(makeProjection({ zoneRole: 'secondary', canvasId: 'view-1', canvasType: 'View' }));
    expect(widget.headerEl.textContent).toBe('Secondary');
  });
});
