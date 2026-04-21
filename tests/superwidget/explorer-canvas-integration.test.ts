// @vitest-environment jsdom
// Isometry v13.1 — Phase 170 Plan 01 Cross-Seam Integration Tests
// Verifies full ExplorerCanvas path: registry-based mount, tab switching, status slot updates.
// Requirements: EINT-01, EINT-02, EINT-03

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SuperWidget } from '../../src/superwidget/SuperWidget';
import { clearRegistry, getCanvasFactory, register, registerAllStubs } from '../../src/superwidget/registry';
import { ExplorerCanvas } from '../../src/superwidget/ExplorerCanvas';
import { renderStatusSlot, updateStatusSlot } from '../../src/superwidget/statusSlot';
import type { Projection } from '../../src/superwidget/projection';
import type { DataExplorerPanelConfig } from '../../src/ui/DataExplorerPanel';

function makeConfig(): DataExplorerPanelConfig {
  return {
    onImportFile: () => {},
    onExport: () => {},
    onExportDatabase: async () => {},
    onVacuum: async () => {},
    onFileDrop: () => {},
    onSelectCard: () => {},
    onPickAltoDirectory: () => {},
  };
}

function makeExplorerProjection(overrides: Partial<Projection> = {}): Projection {
  return {
    canvasType: 'Explorer',
    canvasBinding: 'Unbound',
    zoneRole: 'primary',
    canvasId: 'explorer-1',
    activeTabId: 'import-export',
    enabledTabIds: ['import-export', 'catalog', 'db-utilities'],
    ...overrides,
  };
}

let container: HTMLElement;
let widget: SuperWidget;

beforeEach(() => {
  clearRegistry();
  registerAllStubs();
  register('explorer-1', {
    canvasType: 'Explorer',
    create: () => new ExplorerCanvas(makeConfig(), (proj) => widget.commitProjection(proj)),
  });
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
// EINT-01: ExplorerCanvas mount produces real DataExplorerPanel content
// ---------------------------------------------------------------------------

describe('EINT-01: ExplorerCanvas mount produces real DataExplorerPanel content', () => {
  it('EINT-01: registry mount renders explorer-canvas wrapper with tab bar', () => {
    widget.commitProjection(makeExplorerProjection());
    expect(widget.canvasEl.querySelector('.explorer-canvas')).not.toBeNull();
    expect(widget.canvasEl.querySelector('[data-slot="tab-bar"]')).not.toBeNull();
  });

  it('EINT-01: three tab buttons present with correct labels', () => {
    widget.commitProjection(makeExplorerProjection());
    expect(widget.canvasEl.querySelector('[data-tab-id="import-export"]')!.textContent).toBe('Import / Export');
    expect(widget.canvasEl.querySelector('[data-tab-id="catalog"]')!.textContent).toBe('Catalog');
    expect(widget.canvasEl.querySelector('[data-tab-id="db-utilities"]')!.textContent).toBe('DB Utilities');
  });

  it('EINT-01: DataExplorerPanel import button present, stub absent', () => {
    widget.commitProjection(makeExplorerProjection());
    expect(widget.canvasEl.querySelector('.data-explorer__import-btn')).not.toBeNull();
    expect(widget.canvasEl.querySelector('.explorer-canvas-stub')).toBeNull();
    expect(widget.canvasEl.textContent).not.toContain('[Explorer:');
  });
});

// ---------------------------------------------------------------------------
// EINT-02: Tab switching via commitProjection
// ---------------------------------------------------------------------------

describe('EINT-02: tab switching via commitProjection', () => {
  it('EINT-02: initial projection activates import-export tab', () => {
    widget.commitProjection(makeExplorerProjection());
    expect(widget.canvasEl.querySelector('[data-tab-container="import-export"]')!.classList.contains('active')).toBe(true);
    expect(widget.canvasEl.querySelector('[data-tab-id="import-export"][data-tab-active="true"]')).not.toBeNull();
  });

  it('EINT-02: switching to catalog deactivates import-export', () => {
    widget.commitProjection(makeExplorerProjection());
    widget.commitProjection(makeExplorerProjection({ activeTabId: 'catalog' }));
    expect(widget.canvasEl.querySelector('[data-tab-container="catalog"]')!.classList.contains('active')).toBe(true);
    expect(widget.canvasEl.querySelector('[data-tab-container="import-export"]')!.classList.contains('active')).toBe(false);
    expect(widget.canvasEl.querySelector('[data-tab-id="catalog"][data-tab-active="true"]')).not.toBeNull();
  });

  it('EINT-02: switching to db-utilities deactivates catalog', () => {
    widget.commitProjection(makeExplorerProjection());
    widget.commitProjection(makeExplorerProjection({ activeTabId: 'catalog' }));
    widget.commitProjection(makeExplorerProjection({ activeTabId: 'db-utilities' }));
    expect(widget.canvasEl.querySelector('[data-tab-container="db-utilities"]')!.classList.contains('active')).toBe(true);
    expect(widget.canvasEl.querySelector('[data-tab-container="catalog"]')!.classList.contains('active')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// EINT-03: Status slot updates without canvas re-render
// ---------------------------------------------------------------------------

describe('EINT-03: status slot updates without canvas re-render', () => {
  it('EINT-03: status slot shows updated card and connection counts', () => {
    widget.commitProjection(makeExplorerProjection());
    renderStatusSlot(widget.statusEl);
    updateStatusSlot(widget.statusEl, { card_count: 42, connection_count: 7, last_import_at: new Date().toISOString() });
    expect(widget.statusEl.querySelector('[data-stat="cards"]')!.textContent).toBe('42 cards');
    expect(widget.statusEl.querySelector('[data-stat="connections"]')!.textContent).toBe('7 connections');
    expect(widget.statusEl.querySelector('[data-stat="last-import"]')!.textContent).toMatch(/^Imported /);
  });

  it('EINT-03: status slot update does not increment canvasEl renderCount', () => {
    widget.commitProjection(makeExplorerProjection());
    renderStatusSlot(widget.statusEl);
    const before = widget.canvasEl.dataset['renderCount'];
    updateStatusSlot(widget.statusEl, { card_count: 10, connection_count: 3, last_import_at: null });
    expect(widget.canvasEl.dataset['renderCount']).toBe(before);
  });
});
