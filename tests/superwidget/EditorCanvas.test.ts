// @vitest-environment jsdom
// Isometry v13.2 — Phase 172 EditorCanvas Tests
// Requirements: ECNV-01, ECNV-02, ECNV-03, ECNV-04

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EditorCanvasConfig } from '../../src/superwidget/EditorCanvas';
import { EditorCanvas } from '../../src/superwidget/EditorCanvas';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const makeMockNotebookExplorer = () => ({
  mount: vi.fn(),
  destroy: vi.fn(),
});

let mockNotebookExplorerInstance = makeMockNotebookExplorer();

vi.mock('../../src/ui/NotebookExplorer', () => {
  const MockNotebookExplorer = vi.fn().mockImplementation(function (this: unknown) {
    Object.assign(this as object, mockNotebookExplorerInstance);
    return mockNotebookExplorerInstance;
  });
  return { NotebookExplorer: MockNotebookExplorer };
});

// ---------------------------------------------------------------------------
// Config factory
// ---------------------------------------------------------------------------

let mockUnsubscribeFn: ReturnType<typeof vi.fn>;
let mockSelectionCb: (() => void) | null = null;

function makeConfig(overrides: Partial<EditorCanvasConfig> = {}): EditorCanvasConfig {
  mockUnsubscribeFn = vi.fn();
  const selection = {
    subscribe: vi.fn().mockImplementation((cb: () => void) => {
      mockSelectionCb = cb;
      return mockUnsubscribeFn;
    }),
    getSelectedIds: vi.fn().mockReturnValue([]),
    select: vi.fn(),
  };

  return {
    canvasId: 'editor-1',
    bridge: {
      send: vi.fn().mockResolvedValue({ name: 'Test Card' }),
    } as unknown as EditorCanvasConfig['bridge'],
    selection: selection as unknown as EditorCanvasConfig['selection'],
    filter: {} as EditorCanvasConfig['filter'],
    alias: {} as EditorCanvasConfig['alias'],
    mutations: {} as EditorCanvasConfig['mutations'],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeContainerWithStatusSlot(): { root: HTMLElement; container: HTMLElement; statusSlot: HTMLElement } {
  const root = document.createElement('div');
  const container = document.createElement('div');
  const statusSlot = document.createElement('div');
  statusSlot.dataset['slot'] = 'status';
  root.appendChild(container);
  root.appendChild(statusSlot);
  document.body.appendChild(root);
  return { root, container, statusSlot };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('EditorCanvas', () => {
  beforeEach(() => {
    mockNotebookExplorerInstance = makeMockNotebookExplorer();
    mockSelectionCb = null;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // ECNV-01: mount + NE rendering
  // -------------------------------------------------------------------------

  describe('ECNV-01: mount + NE rendering', () => {
    it('constructor does not throw', () => {
      expect(() => new EditorCanvas(makeConfig())).not.toThrow();
    });

    it('mount() creates div.editor-canvas child in container', () => {
      const container = document.createElement('div');
      const ec = new EditorCanvas(makeConfig());
      ec.mount(container);
      const wrapper = container.querySelector('.editor-canvas');
      expect(wrapper).not.toBeNull();
    });

    it('wrapper is a direct child of container, not container itself', () => {
      const container = document.createElement('div');
      const ec = new EditorCanvas(makeConfig());
      ec.mount(container);
      expect(container.children).toHaveLength(1);
      expect(container.firstElementChild?.className).toBe('editor-canvas');
    });

    it('mount() instantiates NotebookExplorer with config fields', async () => {
      const { NotebookExplorer } = await import('../../src/ui/NotebookExplorer');
      const container = document.createElement('div');
      const config = makeConfig();
      const ec = new EditorCanvas(config);
      ec.mount(container);
      expect(NotebookExplorer).toHaveBeenCalled();
      const callArg = (NotebookExplorer as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
      expect(callArg).toMatchObject({
        bridge: config.bridge,
        selection: config.selection,
        filter: config.filter,
        alias: config.alias,
        mutations: config.mutations,
      });
    });

    it('mount() calls NE.mount() with wrapper div, not raw container', () => {
      const container = document.createElement('div');
      const ec = new EditorCanvas(makeConfig());
      ec.mount(container);
      expect(mockNotebookExplorerInstance.mount).toHaveBeenCalledOnce();
      const mountArg = mockNotebookExplorerInstance.mount.mock.calls[0]?.[0] as HTMLElement;
      expect(mountArg).not.toBe(container);
      expect(mountArg?.className).toBe('editor-canvas');
    });
  });

  // -------------------------------------------------------------------------
  // ECNV-02: status slot
  // -------------------------------------------------------------------------

  describe('ECNV-02: status slot', () => {
    it('status shows "No card selected" when getSelectedIds returns []', () => {
      const { root, container } = makeContainerWithStatusSlot();
      const config = makeConfig();
      (config.selection.getSelectedIds as ReturnType<typeof vi.fn>).mockReturnValue([]);
      const ec = new EditorCanvas(config);
      ec.mount(container);
      const span = root.querySelector('[data-stat="card-title"]') as HTMLElement | null;
      expect(span?.textContent).toBe('No card selected');
      root.remove();
    });

    it('status shows card title when a card is selected', async () => {
      const { root, container } = makeContainerWithStatusSlot();
      const config = makeConfig();
      const mockBridgeSend = vi.fn().mockResolvedValue({ name: 'My Card Title' });
      (config.bridge as { send: ReturnType<typeof vi.fn> }).send = mockBridgeSend;
      (config.selection.getSelectedIds as ReturnType<typeof vi.fn>).mockReturnValue(['card-1']);
      const ec = new EditorCanvas(config);
      ec.mount(container);
      // Wait for the async bridge.send to resolve
      await vi.runAllTimersAsync().catch(() => {});
      await Promise.resolve(); // flush microtasks
      await Promise.resolve();
      const span = root.querySelector('[data-stat="card-title"]') as HTMLElement | null;
      expect(mockBridgeSend).toHaveBeenCalledWith('card:get', { id: 'card-1' });
      expect(span?.textContent).toBe('My Card Title');
      root.remove();
    });

    it('idempotent DOM setup: calling _updateStatus twice does not duplicate DOM', () => {
      const { root, container } = makeContainerWithStatusSlot();
      const config = makeConfig();
      const ec = new EditorCanvas(config);
      ec.mount(container);
      // Trigger selection change to call _updateStatus again
      if (mockSelectionCb) mockSelectionCb();
      const bars = root.querySelectorAll('.sw-editor-status-bar');
      expect(bars).toHaveLength(1);
      root.remove();
    });

    it('data-stat="card-title" span exists inside sw-editor-status-bar', () => {
      const { root, container } = makeContainerWithStatusSlot();
      const ec = new EditorCanvas(makeConfig());
      ec.mount(container);
      const bar = root.querySelector('.sw-editor-status-bar');
      expect(bar).not.toBeNull();
      const span = bar?.querySelector('[data-stat="card-title"]');
      expect(span).not.toBeNull();
      root.remove();
    });

    it('subscribes to SelectionProvider on mount', () => {
      const container = document.createElement('div');
      const config = makeConfig();
      const ec = new EditorCanvas(config);
      ec.mount(container);
      expect(config.selection.subscribe).toHaveBeenCalledOnce();
    });
  });

  // -------------------------------------------------------------------------
  // ECNV-03: destroy safety
  // -------------------------------------------------------------------------

  describe('ECNV-03: destroy safety', () => {
    it('destroy() calls NE.destroy()', () => {
      const container = document.createElement('div');
      const ec = new EditorCanvas(makeConfig());
      ec.mount(container);
      ec.destroy();
      expect(mockNotebookExplorerInstance.destroy).toHaveBeenCalledOnce();
    });

    it('destroy() removes wrapper from DOM', () => {
      const container = document.createElement('div');
      const ec = new EditorCanvas(makeConfig());
      ec.mount(container);
      expect(container.querySelector('.editor-canvas')).not.toBeNull();
      ec.destroy();
      expect(container.querySelector('.editor-canvas')).toBeNull();
    });

    it('destroy() calls selectionUnsub', () => {
      const container = document.createElement('div');
      const ec = new EditorCanvas(makeConfig());
      ec.mount(container);
      ec.destroy();
      expect(mockUnsubscribeFn).toHaveBeenCalledOnce();
    });

    it('destroy() before mount() does not throw', () => {
      const ec = new EditorCanvas(makeConfig());
      expect(() => ec.destroy()).not.toThrow();
    });

    it('double destroy() does not throw', () => {
      const container = document.createElement('div');
      const ec = new EditorCanvas(makeConfig());
      ec.mount(container);
      ec.destroy();
      expect(() => ec.destroy()).not.toThrow();
    });

    it('no bridge.send after destroy: destroy then trigger selection cb', async () => {
      const { root, container } = makeContainerWithStatusSlot();
      const config = makeConfig();
      const mockBridgeSend = vi.fn().mockResolvedValue({ name: 'Card' });
      (config.bridge as { send: ReturnType<typeof vi.fn> }).send = mockBridgeSend;
      (config.selection.getSelectedIds as ReturnType<typeof vi.fn>).mockReturnValue(['card-1']);

      const ec = new EditorCanvas(config);
      ec.mount(container);
      // Wait for initial async send
      await Promise.resolve();
      await Promise.resolve();
      const initialCallCount = mockBridgeSend.mock.calls.length;

      ec.destroy();

      // Force selection callback — should not trigger new bridge.send
      if (mockSelectionCb) mockSelectionCb();
      await Promise.resolve();
      await Promise.resolve();

      expect(mockBridgeSend.mock.calls.length).toBe(initialCallCount);
      root.remove();
    });
  });

  // -------------------------------------------------------------------------
  // ECNV-04: cross-canvas selection propagation
  // -------------------------------------------------------------------------

  describe('ECNV-04: cross-canvas selection propagation', () => {
    it('EditorCanvas shows card title from shared SelectionProvider on mount', async () => {
      const { root, container } = makeContainerWithStatusSlot();
      const config = makeConfig();
      const mockBridgeSend = vi.fn().mockResolvedValue({ name: 'Selected Card' });
      (config.bridge as { send: ReturnType<typeof vi.fn> }).send = mockBridgeSend;
      // Simulate ViewCanvas having called selection.select('card-42') already
      (config.selection.getSelectedIds as ReturnType<typeof vi.fn>).mockReturnValue(['card-42']);

      const ec = new EditorCanvas(config);
      ec.mount(container);
      await Promise.resolve();
      await Promise.resolve();

      expect(mockBridgeSend).toHaveBeenCalledWith('card:get', { id: 'card-42' });
      const span = root.querySelector('[data-stat="card-title"]') as HTMLElement | null;
      expect(span?.textContent).toBe('Selected Card');
      root.remove();
    });
  });
});
