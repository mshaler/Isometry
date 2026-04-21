// @vitest-environment jsdom
// Isometry v13.0 — Phase 165 Plan 01 ExplorerCanvasStub Tests
// Covers CANV-01, CANV-07

import { readFileSync } from 'fs';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ExplorerCanvasStub } from '../../src/superwidget/ExplorerCanvasStub';

describe('CANV-01: ExplorerCanvasStub — mount lifecycle', () => {
  let container: HTMLElement;
  let stub: ExplorerCanvasStub;

  beforeEach(() => {
    container = document.createElement('div');
    stub = new ExplorerCanvasStub('canvas-1');
  });

  afterEach(() => {
    stub.destroy();
  });

  it('mounts a child with data-canvas-type="Explorer"', () => {
    stub.mount(container);
    const el = container.querySelector('[data-canvas-type="Explorer"]');
    expect(el).not.toBeNull();
  });

  it('sets textContent to "[Explorer: canvas-1]"', () => {
    stub.mount(container);
    const el = container.querySelector('[data-canvas-type="Explorer"]') as HTMLElement;
    expect(el.textContent).toBe('[Explorer: canvas-1]');
  });

  it('sets data-render-count="1" after first mount', () => {
    stub.mount(container);
    const el = container.querySelector('[data-canvas-type="Explorer"]') as HTMLElement;
    expect(el.dataset['renderCount']).toBe('1');
  });

  it('increments data-render-count to "2" after destroy + remount', () => {
    stub.mount(container);
    stub.destroy();
    stub.mount(container);
    const el = container.querySelector('[data-canvas-type="Explorer"]') as HTMLElement;
    expect(el.dataset['renderCount']).toBe('2');
  });

  it('destroy() removes the element from DOM', () => {
    stub.mount(container);
    stub.destroy();
    expect(container.querySelector('[data-canvas-type="Explorer"]')).toBeNull();
  });

  it('destroy() before mount() does not throw', () => {
    expect(() => stub.destroy()).not.toThrow();
  });
});

describe('CANV-07: ExplorerCanvasStub — stub file label', () => {
  it('file starts with "// STUB"', () => {
    const src = readFileSync(
      join(__dirname, '../../src/superwidget/ExplorerCanvasStub.ts'),
      'utf-8'
    );
    expect(src.startsWith('// STUB')).toBe(true);
  });
});
