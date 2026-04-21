// @vitest-environment jsdom
// Isometry v13.1 — Phase 167 Plan 01 ExplorerCanvas Tests
// Covers EXCV-01, EXCV-02, EXCV-03, EXCV-04

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Projection } from '../../src/superwidget/projection';
import { ExplorerCanvas } from '../../src/superwidget/ExplorerCanvas';
import type { DataExplorerPanelConfig } from '../../src/ui/DataExplorerPanel';

function makeConfig(): DataExplorerPanelConfig {
  return {
    onImportFile: () => {},
    onExport: () => {},
    onExportDatabase: () => {},
    onVacuum: async () => {},
    onFileDrop: () => {},
    onSelectCard: () => {},
    onPickAltoDirectory: () => {},
  };
}

describe('EXCV-01: ExplorerCanvas mount lifecycle', () => {
  let container: HTMLElement;
  let canvas: ExplorerCanvas;

  beforeEach(() => {
    container = document.createElement('div');
    canvas = new ExplorerCanvas(makeConfig(), () => {});
  });

  afterEach(() => {
    canvas.destroy();
  });

  it('mount() appends a .explorer-canvas wrapper div to container', () => {
    canvas.mount(container);
    const el = container.querySelector('.explorer-canvas');
    expect(el).not.toBeNull();
  });

  it('destroy() removes .explorer-canvas wrapper from container', () => {
    canvas.mount(container);
    canvas.destroy();
    expect(container.querySelector('.explorer-canvas')).toBeNull();
  });

  it('destroy() before mount() does not throw', () => {
    expect(() => canvas.destroy()).not.toThrow();
  });
});

describe('EXCV-04: ExplorerCanvas re-uses DataExplorerPanel', () => {
  let container: HTMLElement;
  let canvas: ExplorerCanvas;

  beforeEach(() => {
    container = document.createElement('div');
    canvas = new ExplorerCanvas(makeConfig(), () => {});
  });

  afterEach(() => {
    canvas.destroy();
  });

  it('mount() produces real DataExplorerPanel DOM (no stub text "[Explorer:")', () => {
    canvas.mount(container);
    expect(container.textContent).not.toContain('[Explorer:');
  });

  it('mount() produces tab containers (sections extracted from DataExplorerPanel)', () => {
    canvas.mount(container);
    const el = container.querySelector('[data-tab-container]');
    expect(el).not.toBeNull();
  });

  it('getPanel() returns DataExplorerPanel instance after mount', () => {
    canvas.mount(container);
    expect(canvas.getPanel()).not.toBeNull();
  });

  it('getPanel() returns null before mount', () => {
    expect(canvas.getPanel()).toBeNull();
  });

  it('getPanel() returns null after destroy', () => {
    canvas.mount(container);
    canvas.destroy();
    expect(canvas.getPanel()).toBeNull();
  });

  it('getCatalogBodyEl() is non-null after mount (via getPanel())', () => {
    canvas.mount(container);
    const panel = canvas.getPanel();
    expect(panel).not.toBeNull();
    expect(panel!.getCatalogBodyEl()).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// EXCV-02 / EXCV-03: Tab system tests (Phase 168 Plan 02)
// ---------------------------------------------------------------------------

const baseProj: Projection = {
  canvasType: 'Explorer',
  canvasBinding: 'Unbound',
  zoneRole: 'primary',
  canvasId: 'explorer-1',
  activeTabId: 'import-export',
  enabledTabIds: ['import-export', 'catalog', 'db-utilities'],
};

describe('tab system', () => {
  let container: HTMLElement;
  let canvas: ExplorerCanvas;
  let commitSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    container = document.createElement('div');
    commitSpy = vi.fn();
    canvas = new ExplorerCanvas(makeConfig(), commitSpy);
    canvas.mount(container);
  });

  afterEach(() => {
    canvas.destroy();
  });

  it('mount() creates exactly 3 elements with [data-tab-container] attribute', () => {
    const containers = container.querySelectorAll('[data-tab-container]');
    expect(containers.length).toBe(3);
  });

  it('mount() creates [data-slot="tab-bar"] with 3 button children having [data-tab-id]', () => {
    const tabBar = container.querySelector('[data-slot="tab-bar"]');
    expect(tabBar).not.toBeNull();
    const buttons = tabBar!.querySelectorAll('[data-tab-id]');
    expect(buttons.length).toBe(3);
  });

  it('onProjectionChange sets import-export container as active by default', () => {
    canvas.onProjectionChange(baseProj);
    const ieContainer = container.querySelector('[data-tab-container="import-export"]');
    expect(ieContainer!.classList.contains('active')).toBe(true);
  });

  it('onProjectionChange with default proj hides catalog and db-utilities containers', () => {
    canvas.onProjectionChange(baseProj);
    const catalogContainer = container.querySelector('[data-tab-container="catalog"]');
    const dbContainer = container.querySelector('[data-tab-container="db-utilities"]');
    expect(catalogContainer!.classList.contains('active')).toBe(false);
    expect(dbContainer!.classList.contains('active')).toBe(false);
  });

  it('onProjectionChange with activeTabId="catalog" shows catalog and hides others', () => {
    canvas.onProjectionChange({ ...baseProj, activeTabId: 'catalog' });
    const ieContainer = container.querySelector('[data-tab-container="import-export"]');
    const catalogContainer = container.querySelector('[data-tab-container="catalog"]');
    const dbContainer = container.querySelector('[data-tab-container="db-utilities"]');
    expect(catalogContainer!.classList.contains('active')).toBe(true);
    expect(ieContainer!.classList.contains('active')).toBe(false);
    expect(dbContainer!.classList.contains('active')).toBe(false);
  });

  it('onProjectionChange with activeTabId="db-utilities" shows db-utilities and hides others', () => {
    canvas.onProjectionChange({ ...baseProj, activeTabId: 'db-utilities' });
    const ieContainer = container.querySelector('[data-tab-container="import-export"]');
    const catalogContainer = container.querySelector('[data-tab-container="catalog"]');
    const dbContainer = container.querySelector('[data-tab-container="db-utilities"]');
    expect(dbContainer!.classList.contains('active')).toBe(true);
    expect(ieContainer!.classList.contains('active')).toBe(false);
    expect(catalogContainer!.classList.contains('active')).toBe(false);
  });

  it('onProjectionChange updates data-tab-active attribute on correct button', () => {
    canvas.onProjectionChange({ ...baseProj, activeTabId: 'catalog' });
    const tabBar = container.querySelector('[data-slot="tab-bar"]')!;
    const catalogBtn = tabBar.querySelector('[data-tab-id="catalog"]') as HTMLElement;
    const ieBtn = tabBar.querySelector('[data-tab-id="import-export"]') as HTMLElement;
    expect(catalogBtn.dataset['tabActive']).toBe('true');
    expect(ieBtn.dataset['tabActive']).toBeUndefined();
  });

  it('clicking a tab button calls commitProjection with new projection containing the clicked tabId', () => {
    canvas.onProjectionChange(baseProj);
    const tabBar = container.querySelector('[data-slot="tab-bar"]')!;
    const catalogBtn = tabBar.querySelector('[data-tab-id="catalog"]') as HTMLElement;
    catalogBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(commitSpy).toHaveBeenCalledTimes(1);
    const calledWith = commitSpy.mock.calls[0]![0] as Projection;
    expect(calledWith.activeTabId).toBe('catalog');
  });

  it('clicking the already-active tab does NOT call commitProjection', () => {
    canvas.onProjectionChange(baseProj);
    const tabBar = container.querySelector('[data-slot="tab-bar"]')!;
    const ieBtn = tabBar.querySelector('[data-tab-id="import-export"]') as HTMLElement;
    ieBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(commitSpy).not.toHaveBeenCalled();
  });

  it('import-export container has at least 2 collapsible-section children (Import/Export + Apps)', () => {
    const ieContainer = container.querySelector('[data-tab-container="import-export"]');
    const sections = ieContainer!.querySelectorAll('.collapsible-section');
    expect(sections.length).toBeGreaterThanOrEqual(2);
  });

  it('destroy() removes all DOM (wrapper, tab bar, containers)', () => {
    canvas.destroy();
    expect(container.querySelector('.explorer-canvas')).toBeNull();
    expect(container.querySelector('[data-slot="tab-bar"]')).toBeNull();
    expect(container.querySelector('[data-tab-container]')).toBeNull();
  });
});
