// @vitest-environment jsdom
// Isometry v13.0 — Phase 165 Plan 01 ViewCanvasStub Tests
// Covers CANV-02, CANV-07

import { readFileSync } from 'fs';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ViewCanvasStub } from '../../src/superwidget/ViewCanvasStub';

describe('CANV-02: ViewCanvasStub — mount lifecycle', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
  });

  it('mounts a child with data-canvas-type="View"', () => {
    const stub = new ViewCanvasStub('canvas-1', 'Unbound');
    stub.mount(container);
    const el = container.querySelector('[data-canvas-type="View"]');
    expect(el).not.toBeNull();
    stub.destroy();
  });

  it('sets textContent to "[View: canvas-1]"', () => {
    const stub = new ViewCanvasStub('canvas-1', 'Unbound');
    stub.mount(container);
    const el = container.querySelector('[data-canvas-type="View"]') as HTMLElement;
    expect(el.textContent).toBe('[View: canvas-1]');
    stub.destroy();
  });

  it('sets data-render-count="1" after first mount', () => {
    const stub = new ViewCanvasStub('canvas-1', 'Unbound');
    stub.mount(container);
    const el = container.querySelector('[data-canvas-type="View"]') as HTMLElement;
    expect(el.dataset['renderCount']).toBe('1');
    stub.destroy();
  });

  it('increments data-render-count to "2" after destroy + remount', () => {
    const stub = new ViewCanvasStub('canvas-1', 'Unbound');
    stub.mount(container);
    stub.destroy();
    stub.mount(container);
    const el = container.querySelector('[data-canvas-type="View"]') as HTMLElement;
    expect(el.dataset['renderCount']).toBe('2');
    stub.destroy();
  });

  it('destroy() removes the element from DOM', () => {
    const stub = new ViewCanvasStub('canvas-1', 'Unbound');
    stub.mount(container);
    stub.destroy();
    expect(container.querySelector('[data-canvas-type="View"]')).toBeNull();
  });

  it('Bound mode creates a child with data-sidecar', () => {
    const stub = new ViewCanvasStub('canvas-1', 'Bound');
    stub.mount(container);
    const el = container.querySelector('[data-canvas-type="View"]') as HTMLElement;
    const sidecar = el.querySelector('[data-sidecar]');
    expect(sidecar).not.toBeNull();
    stub.destroy();
  });

  it('Unbound mode has no data-sidecar child', () => {
    const stub = new ViewCanvasStub('canvas-1', 'Unbound');
    stub.mount(container);
    const el = container.querySelector('[data-canvas-type="View"]') as HTMLElement;
    const sidecar = el.querySelector('[data-sidecar]');
    expect(sidecar).toBeNull();
    stub.destroy();
  });
});

describe('CANV-07: ViewCanvasStub — stub file label', () => {
  it('file starts with "// STUB"', () => {
    const src = readFileSync(
      join(__dirname, '../../src/superwidget/ViewCanvasStub.ts'),
      'utf-8'
    );
    expect(src.startsWith('// STUB')).toBe(true);
  });
});
