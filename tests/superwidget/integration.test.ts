// @vitest-environment jsdom
// Isometry v13.0 — Phase 166 Plan 01 Cross-Seam Integration Tests
// Verifies the full projection-to-DOM path with real stubs and binding-aware factory.
// Requirements: INTG-01, INTG-02, INTG-03, INTG-04, INTG-05, INTG-06

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SuperWidget } from '../../src/superwidget/SuperWidget';
import { registerAllStubs, getCanvasFactory, clearRegistry } from '../../src/superwidget/registry';
import { switchTab } from '../../src/superwidget/projection';
import type { Projection } from '../../src/superwidget/projection';

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
// Setup / teardown
// ---------------------------------------------------------------------------

let container: HTMLElement;
let widget: SuperWidget;

beforeEach(() => {
  clearRegistry();
  registerAllStubs();
  container = document.createElement('div');
  document.body.appendChild(container);
  widget = new SuperWidget(getCanvasFactory());
  widget.mount(container);
});

afterEach(() => {
  widget.destroy();
  clearRegistry();
  container.remove();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// INTG-01: Explorer to View/Bound — sidecar appears + zone label updates
// ---------------------------------------------------------------------------

describe('INTG-01: Explorer to View/Bound — sidecar appears + zone label updates', () => {
  it('INTG-01: after Explorer commit no sidecar present', () => {
    widget.commitProjection(makeProjection({ canvasId: 'explorer-1', canvasType: 'Explorer', zoneRole: 'primary' }));
    expect(widget.canvasEl.querySelector('[data-canvas-type="Explorer"]')).not.toBeNull();
    expect(widget.canvasEl.querySelector('[data-sidecar]')).toBeNull();
  });

  it('INTG-01: after View/Bound commit Explorer canvas gone, View canvas present with sidecar', () => {
    widget.commitProjection(makeProjection({ canvasId: 'explorer-1', canvasType: 'Explorer', zoneRole: 'primary' }));
    widget.commitProjection(makeProjection({ canvasId: 'view-1', canvasType: 'View', canvasBinding: 'Bound', zoneRole: 'secondary' }));

    expect(widget.canvasEl.querySelector('[data-canvas-type="Explorer"]')).toBeNull();
    expect(widget.canvasEl.querySelector('[data-canvas-type="View"]')).not.toBeNull();
    expect(widget.canvasEl.querySelector('[data-sidecar]')).not.toBeNull();
  });

  it('INTG-01: after View/Bound commit headerEl.textContent is "Secondary"', () => {
    widget.commitProjection(makeProjection({ canvasId: 'explorer-1', canvasType: 'Explorer', zoneRole: 'primary' }));
    widget.commitProjection(makeProjection({ canvasId: 'view-1', canvasType: 'View', canvasBinding: 'Bound', zoneRole: 'secondary' }));
    expect(widget.headerEl.textContent).toBe('Secondary');
  });
});

// ---------------------------------------------------------------------------
// INTG-02: View/Bound to View/Unbound — sidecar removed, canvas stays View
// ---------------------------------------------------------------------------

describe('INTG-02: View/Bound to View/Unbound — sidecar removed, canvas stays View', () => {
  it('INTG-02: View/Bound has sidecar', () => {
    widget.commitProjection(makeProjection({ canvasId: 'view-1', canvasType: 'View', canvasBinding: 'Bound' }));
    expect(widget.canvasEl.querySelector('[data-sidecar]')).not.toBeNull();
  });

  it('INTG-02: after switching to View/Unbound canvas type still present, sidecar absent', () => {
    widget.commitProjection(makeProjection({ canvasId: 'view-1', canvasType: 'View', canvasBinding: 'Bound' }));
    widget.commitProjection(makeProjection({ canvasId: 'view-1', canvasType: 'View', canvasBinding: 'Unbound' }));

    expect(widget.canvasEl.querySelector('[data-canvas-type="View"]')).not.toBeNull();
    expect(widget.canvasEl.querySelector('[data-sidecar]')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// INTG-03: View to Editor — zone label updates, no View trace
// ---------------------------------------------------------------------------

describe('INTG-03: View to Editor — zone label updates, no View trace', () => {
  it('INTG-03: after Editor commit View canvas gone, Editor canvas present', () => {
    widget.commitProjection(makeProjection({ canvasId: 'view-1', canvasType: 'View', zoneRole: 'primary' }));
    widget.commitProjection(makeProjection({ canvasId: 'editor-1', canvasType: 'Editor', zoneRole: 'tertiary' }));

    expect(widget.canvasEl.querySelector('[data-canvas-type="View"]')).toBeNull();
    expect(widget.canvasEl.querySelector('[data-canvas-type="Editor"]')).not.toBeNull();
  });

  it('INTG-03: after Editor commit headerEl.textContent is "Tertiary"', () => {
    widget.commitProjection(makeProjection({ canvasId: 'view-1', canvasType: 'View', zoneRole: 'primary' }));
    widget.commitProjection(makeProjection({ canvasId: 'editor-1', canvasType: 'Editor', zoneRole: 'tertiary' }));
    expect(widget.headerEl.textContent).toBe('Tertiary');
  });
});

// ---------------------------------------------------------------------------
// INTG-04: Invalid projection (Bound on Editor) — no DOM change, console.warn
// ---------------------------------------------------------------------------

describe('INTG-04: Invalid projection (Bound on Editor) — no DOM change, console.warn', () => {
  it('INTG-04: console.warn called with commitProjection rejected and prior canvas unchanged', () => {
    widget.commitProjection(makeProjection({ canvasId: 'explorer-1', canvasType: 'Explorer' }));

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    widget.commitProjection(makeProjection({
      canvasId: 'editor-1',
      canvasType: 'Editor',
      canvasBinding: 'Bound',
      enabledTabIds: ['tab-1'],
      activeTabId: 'tab-1',
    }));

    expect(warnSpy).toHaveBeenCalledWith(expect.stringMatching(/commitProjection rejected/));
    expect(widget.canvasEl.querySelector('[data-canvas-type="Explorer"]')).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// INTG-05: switchTab to disabled tabId preserves reference
// ---------------------------------------------------------------------------

describe('INTG-05: switchTab to disabled tabId preserves reference', () => {
  it('INTG-05: switchTab with tabId not in enabledTabIds returns exact same reference', () => {
    const proj = makeProjection({ enabledTabIds: ['tab-1', 'tab-2'], activeTabId: 'tab-1' });
    const result = switchTab(proj, 'tab-disabled');
    expect(result === proj).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// INTG-06: Rapid 10 commitProjection calls — only final state
// ---------------------------------------------------------------------------

describe('INTG-06: Rapid 10 commitProjection calls — only final state', () => {
  it('INTG-06: after 10 synchronous commits only final canvas remains', () => {
    const projections: Projection[] = [
      makeProjection({ canvasId: 'explorer-1', canvasType: 'Explorer' }),
      makeProjection({ canvasId: 'view-1', canvasType: 'View', canvasBinding: 'Unbound' }),
      makeProjection({ canvasId: 'editor-1', canvasType: 'Editor' }),
      makeProjection({ canvasId: 'explorer-1', canvasType: 'Explorer' }),
      makeProjection({ canvasId: 'view-1', canvasType: 'View', canvasBinding: 'Bound' }),
      makeProjection({ canvasId: 'editor-1', canvasType: 'Editor' }),
      makeProjection({ canvasId: 'explorer-1', canvasType: 'Explorer' }),
      makeProjection({ canvasId: 'view-1', canvasType: 'View', canvasBinding: 'Unbound' }),
      makeProjection({ canvasId: 'view-1', canvasType: 'View', canvasBinding: 'Bound' }),
      makeProjection({ canvasId: 'editor-1', canvasType: 'Editor' }),
    ];

    for (const p of projections) {
      widget.commitProjection(p);
    }

    expect(widget.canvasEl.children.length).toBe(1);
    expect((widget.canvasEl.children[0] as HTMLElement).dataset['canvasType']).toBe('Editor');
    expect(widget.canvasEl.querySelector('[data-canvas-type="Explorer"]')).toBeNull();
    expect(widget.canvasEl.querySelector('[data-canvas-type="View"]')).toBeNull();
  });
});
