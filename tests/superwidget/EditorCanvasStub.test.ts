// @vitest-environment jsdom
// Isometry v13.0 — Phase 165 Plan 01 EditorCanvasStub Tests
// Covers CANV-03, CANV-07

import { readFileSync } from 'fs';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { EditorCanvasStub } from '../../src/superwidget/EditorCanvasStub';

describe('CANV-03: EditorCanvasStub — mount lifecycle', () => {
  let container: HTMLElement;
  let stub: EditorCanvasStub;

  beforeEach(() => {
    container = document.createElement('div');
    stub = new EditorCanvasStub('canvas-1');
  });

  afterEach(() => {
    stub.destroy();
  });

  it('mounts a child with data-canvas-type="Editor"', () => {
    stub.mount(container);
    const el = container.querySelector('[data-canvas-type="Editor"]');
    expect(el).not.toBeNull();
  });

  it('sets textContent to "[Editor: canvas-1]"', () => {
    stub.mount(container);
    const el = container.querySelector('[data-canvas-type="Editor"]') as HTMLElement;
    expect(el.textContent).toBe('[Editor: canvas-1]');
  });

  it('sets data-render-count="1" after first mount', () => {
    stub.mount(container);
    const el = container.querySelector('[data-canvas-type="Editor"]') as HTMLElement;
    expect(el.dataset['renderCount']).toBe('1');
  });

  it('increments data-render-count to "2" after destroy + remount', () => {
    stub.mount(container);
    stub.destroy();
    stub.mount(container);
    const el = container.querySelector('[data-canvas-type="Editor"]') as HTMLElement;
    expect(el.dataset['renderCount']).toBe('2');
  });

  it('destroy() removes the element from DOM', () => {
    stub.mount(container);
    stub.destroy();
    expect(container.querySelector('[data-canvas-type="Editor"]')).toBeNull();
  });

  it('destroy() before mount() does not throw', () => {
    expect(() => stub.destroy()).not.toThrow();
  });

  it('no data-sidecar child exists after mount', () => {
    stub.mount(container);
    const el = container.querySelector('[data-canvas-type="Editor"]') as HTMLElement;
    expect(el.querySelector('[data-sidecar]')).toBeNull();
  });
});

describe('CANV-07: EditorCanvasStub — stub file label', () => {
  it('file starts with "// STUB"', () => {
    const src = readFileSync(
      join(__dirname, '../../src/superwidget/EditorCanvasStub.ts'),
      'utf-8'
    );
    expect(src.startsWith('// STUB')).toBe(true);
  });
});
