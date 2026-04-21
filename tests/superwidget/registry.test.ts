// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearRegistry,
  getCanvasFactory,
  getRegistryEntry,
  register,
  registerAllStubs,
} from '../../src/superwidget/registry';
import type { CanvasRegistryEntry } from '../../src/superwidget/registry';

beforeEach(() => {
  clearRegistry();
});

describe('CANV-04: registry lookup', () => {
  it('getRegistryEntry returns entry for known canvasId', () => {
    const entry: CanvasRegistryEntry = {
      canvasType: 'Explorer',
      create: () => ({ mount: () => {}, destroy: () => {} }),
    };
    register('test-canvas', entry);
    expect(getRegistryEntry('test-canvas')).toBe(entry);
  });

  it('getRegistryEntry returns undefined for unknown canvasId without throwing', () => {
    expect(() => getRegistryEntry('nonexistent')).not.toThrow();
    expect(getRegistryEntry('nonexistent')).toBeUndefined();
  });

  it('getCanvasFactory returns a function', () => {
    expect(typeof getCanvasFactory()).toBe('function');
  });

  it('factory returns undefined for unknown canvasId without throwing', () => {
    const factory = getCanvasFactory();
    expect(() => factory('nonexistent', 'Unbound')).not.toThrow();
    expect(factory('nonexistent', 'Unbound')).toBeUndefined();
  });
});

describe('CANV-04: factory creates CanvasComponent', () => {
  it('factory calls entry.create() and returns CanvasComponent for known canvasId', () => {
    const stub = { mount: () => {}, destroy: () => {} };
    const entry: CanvasRegistryEntry = {
      canvasType: 'Editor',
      create: () => stub,
    };
    register('editor-test', entry);
    const factory = getCanvasFactory();
    const result = factory('editor-test', 'Unbound');
    expect(result).toBe(stub);
    expect(typeof result?.mount).toBe('function');
    expect(typeof result?.destroy).toBe('function');
  });
});

describe('CANV-05: View defaultExplorerId', () => {
  it('view-1 defaultExplorerId is "explorer-1" when registered directly', () => {
    // view-1 is now registered with real ViewCanvas in main.ts, not via registerAllStubs()
    // Test the register() API directly instead
    register('view-1', {
      canvasType: 'View',
      create: () => ({ mount: () => {}, destroy: () => {} }),
      defaultExplorerId: 'explorer-1',
    });
    expect(getRegistryEntry('view-1')?.defaultExplorerId).toBe('explorer-1');
  });

  it('explorer-1 entry has defaultExplorerId undefined after registerAllStubs()', () => {
    registerAllStubs();
    expect(getRegistryEntry('explorer-1')?.defaultExplorerId).toBeUndefined();
  });

  it('editor-1 entry has defaultExplorerId undefined when registered directly', () => {
    // editor-1 is now registered with real EditorCanvas in main.ts, not via registerAllStubs()
    register('editor-1', {
      canvasType: 'Editor',
      create: () => ({ mount: () => {}, destroy: () => {} }),
    });
    expect(getRegistryEntry('editor-1')?.defaultExplorerId).toBeUndefined();
  });
});

describe('D-03: registerAllStubs()', () => {
  it('registers explorer-1 with canvasType Explorer', () => {
    registerAllStubs();
    expect(getRegistryEntry('explorer-1')?.canvasType).toBe('Explorer');
  });

  it('does NOT register view-1 (real ViewCanvas registered in main.ts — CANV-06)', () => {
    registerAllStubs();
    expect(getRegistryEntry('view-1')).toBeUndefined();
  });

  it('does NOT register editor-1 (real EditorCanvas registered in main.ts — CANV-06)', () => {
    registerAllStubs();
    expect(getRegistryEntry('editor-1')).toBeUndefined();
  });

  it('factory returns CanvasComponent for explorer-1', () => {
    registerAllStubs();
    const factory = getCanvasFactory();
    const canvas = factory('explorer-1', 'Unbound');
    expect(canvas).toBeDefined();
    expect(typeof canvas?.mount).toBe('function');
    expect(typeof canvas?.destroy).toBe('function');
  });

  it('factory returns undefined for view-1 via registerAllStubs (must be registered via main.ts)', () => {
    registerAllStubs();
    const factory = getCanvasFactory();
    const canvas = factory('view-1', 'Unbound');
    expect(canvas).toBeUndefined();
  });

  it('factory returns undefined for editor-1 via registerAllStubs (must be registered via main.ts)', () => {
    registerAllStubs();
    const factory = getCanvasFactory();
    const canvas = factory('editor-1', 'Unbound');
    expect(canvas).toBeUndefined();
  });
});

describe('CANV-06: SuperWidget.ts has no concrete stub references', () => {
  it('SuperWidget.ts does NOT contain ExplorerCanvasStub', () => {
    const src = readFileSync(
      resolve(__dirname, '../../src/superwidget/SuperWidget.ts'),
      'utf-8'
    );
    expect(src).not.toContain('ExplorerCanvasStub');
  });

  it('SuperWidget.ts does NOT contain ViewCanvasStub', () => {
    const src = readFileSync(
      resolve(__dirname, '../../src/superwidget/SuperWidget.ts'),
      'utf-8'
    );
    expect(src).not.toContain('ViewCanvasStub');
  });

  it('SuperWidget.ts does NOT contain EditorCanvasStub', () => {
    const src = readFileSync(
      resolve(__dirname, '../../src/superwidget/SuperWidget.ts'),
      'utf-8'
    );
    expect(src).not.toContain('EditorCanvasStub');
  });
});
