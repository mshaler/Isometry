// @vitest-environment jsdom
// Isometry v13.1 — Phase 167 Plan 01 ExplorerCanvas Tests
// Covers EXCV-01, EXCV-04

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
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
    canvas = new ExplorerCanvas(makeConfig());
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
    canvas = new ExplorerCanvas(makeConfig());
  });

  afterEach(() => {
    canvas.destroy();
  });

  it('mount() produces real DataExplorerPanel DOM (no stub text "[Explorer:")', () => {
    canvas.mount(container);
    expect(container.textContent).not.toContain('[Explorer:');
  });

  it('mount() produces .data-explorer root element', () => {
    canvas.mount(container);
    const el = container.querySelector('.data-explorer');
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
