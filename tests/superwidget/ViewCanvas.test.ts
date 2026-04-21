// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ViewCanvasConfig } from '../../src/superwidget/ViewCanvas';
import { VIEW_DISPLAY_NAMES, ViewCanvas } from '../../src/superwidget/ViewCanvas';
import type { Projection } from '../../src/superwidget/projection';
import type { ViewType } from '../../src/providers/types';
import type { IView } from '../../src/views/types';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const makeMockView = (): IView => ({
  mount: vi.fn(),
  destroy: vi.fn(),
  render: vi.fn().mockResolvedValue(undefined),
  viewType: 'list' as ViewType,
});

const makeMockViewManager = () => ({
  onViewSwitch: null as ((viewType: ViewType) => void) | null,
  switchTo: vi.fn().mockImplementation(async function (
    this: { onViewSwitch: ((v: ViewType) => void) | null },
    viewType: ViewType,
  ) {
    if (this.onViewSwitch) this.onViewSwitch(viewType);
  }),
  destroy: vi.fn(),
  getLastCards: vi.fn().mockReturnValue([]),
});

let mockViewManagerInstance = makeMockViewManager();

vi.mock('../../src/views/ViewManager', () => {
  const MockViewManager = vi.fn().mockImplementation(function (this: unknown) {
    Object.assign(this as object, mockViewManagerInstance);
    (this as { _ref: typeof mockViewManagerInstance })._ref = mockViewManagerInstance;
    // Make property assignments on the mock instance also update the reference object
    return mockViewManagerInstance;
  });
  return { ViewManager: MockViewManager };
});

vi.mock('../../src/superwidget/registry', () => ({
  getRegistryEntry: vi.fn().mockImplementation((canvasId: string) => {
    if (canvasId === 'view-1') {
      return { canvasType: 'View', defaultExplorerId: 'explorer-1' };
    }
    return undefined;
  }),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_VIEW_TYPES: ViewType[] = [
  'list', 'grid', 'kanban', 'calendar', 'timeline', 'gallery', 'network', 'tree', 'supergrid',
];

function makeViewFactory(): Record<ViewType, () => IView> {
  const factory: Partial<Record<ViewType, () => IView>> = {};
  for (const vt of VALID_VIEW_TYPES) {
    factory[vt] = () => makeMockView();
  }
  return factory as Record<ViewType, () => IView>;
}

function makeConfig(overrides: Partial<ViewCanvasConfig> = {}): ViewCanvasConfig {
  return {
    canvasId: 'view-1',
    coordinator: {} as ViewCanvasConfig['coordinator'],
    queryBuilder: {} as ViewCanvasConfig['queryBuilder'],
    bridge: {} as ViewCanvasConfig['bridge'],
    pafv: {} as ViewCanvasConfig['pafv'],
    filter: {} as ViewCanvasConfig['filter'],
    viewFactory: makeViewFactory(),
    onSidecarChange: vi.fn(),
    ...overrides,
  };
}

function makeProjection(activeTabId: string): Projection {
  return {
    canvasType: 'View',
    canvasBinding: 'Unbound',
    zoneRole: 'primary',
    canvasId: 'view-1',
    activeTabId,
    enabledTabIds: [activeTabId],
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('VIEW_DISPLAY_NAMES', () => {
  it('has exactly 9 entries', () => {
    expect(Object.keys(VIEW_DISPLAY_NAMES)).toHaveLength(9);
  });

  it('maps all 9 ViewType literals', () => {
    for (const vt of VALID_VIEW_TYPES) {
      expect(VIEW_DISPLAY_NAMES[vt]).toBeTruthy();
    }
  });

  it('uses "Network Graph" for network view', () => {
    expect(VIEW_DISPLAY_NAMES['network']).toBe('Network Graph');
  });

  it('distinguishes grid from gallery', () => {
    expect(VIEW_DISPLAY_NAMES['grid']).toBe('Grid');
    expect(VIEW_DISPLAY_NAMES['gallery']).toBe('Gallery');
  });
});

describe('ViewCanvas', () => {
  let container: HTMLElement;

  beforeEach(() => {
    mockViewManagerInstance = makeMockViewManager();
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  describe('constructor', () => {
    it('accepts ViewCanvasConfig and does not throw', () => {
      expect(() => new ViewCanvas(makeConfig())).not.toThrow();
    });
  });

  describe('mount()', () => {
    it('creates a wrapper div.view-canvas inside container', () => {
      const vc = new ViewCanvas(makeConfig());
      vc.mount(container);
      const wrapper = container.querySelector('.view-canvas');
      expect(wrapper).not.toBeNull();
    });

    it('creates wrapper as child of container, not container itself', () => {
      const vc = new ViewCanvas(makeConfig());
      vc.mount(container);
      expect(container.children).toHaveLength(1);
      expect(container.firstElementChild?.className).toBe('view-canvas');
    });

    it('creates a ViewManager with a wrapper div (not container directly) as container', async () => {
      const { ViewManager } = await import('../../src/views/ViewManager');
      const vc = new ViewCanvas(makeConfig());
      vc.mount(container);
      expect(ViewManager).toHaveBeenCalled();
      // The container arg passed to ViewManager should be a div.view-canvas, not the raw container
      const callArg = (ViewManager as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
      expect(callArg?.container).not.toBe(container);
      expect((callArg?.container as HTMLElement)?.className).toBe('view-canvas');
    });

    it('wires onViewSwitch callback on ViewManager', () => {
      const vc = new ViewCanvas(makeConfig());
      vc.mount(container);
      expect(mockViewManagerInstance.onViewSwitch).toBeTypeOf('function');
    });
  });

  describe('onProjectionChange()', () => {
    it('calls ViewManager.switchTo with valid ViewType', () => {
      const vc = new ViewCanvas(makeConfig());
      vc.mount(container);
      const proj = makeProjection('list');
      vc.onProjectionChange(proj);
      expect(mockViewManagerInstance.switchTo).toHaveBeenCalledWith('list', expect.any(Function));
    });

    it('logs error and does not call switchTo for invalid tabId', () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const vc = new ViewCanvas(makeConfig());
      vc.mount(container);
      const proj = makeProjection('invalid-tab-id');
      vc.onProjectionChange(proj);
      expect(mockViewManagerInstance.switchTo).not.toHaveBeenCalled();
      expect(spy).toHaveBeenCalledWith(expect.stringContaining('invalid-tab-id'));
      spy.mockRestore();
    });

    it('is a no-op if same ViewType is already active', () => {
      const vc = new ViewCanvas(makeConfig());
      vc.mount(container);
      const proj = makeProjection('list');
      vc.onProjectionChange(proj);
      // Trigger onViewSwitch to set _currentViewType
      if (mockViewManagerInstance.onViewSwitch) {
        mockViewManagerInstance.onViewSwitch('list');
      }
      vc.onProjectionChange(proj);
      // switchTo should only have been called once
      expect(mockViewManagerInstance.switchTo).toHaveBeenCalledTimes(1);
    });
  });

  describe('destroy()', () => {
    it('calls ViewManager.destroy()', () => {
      const vc = new ViewCanvas(makeConfig());
      vc.mount(container);
      vc.destroy();
      expect(mockViewManagerInstance.destroy).toHaveBeenCalled();
    });

    it('removes the wrapper element from the DOM', () => {
      const vc = new ViewCanvas(makeConfig());
      vc.mount(container);
      expect(container.querySelector('.view-canvas')).not.toBeNull();
      vc.destroy();
      expect(container.querySelector('.view-canvas')).toBeNull();
    });

    it('is safe to call on an already-destroyed instance (idempotent)', () => {
      const vc = new ViewCanvas(makeConfig());
      vc.mount(container);
      vc.destroy();
      expect(() => vc.destroy()).not.toThrow();
    });
  });

  describe('status slot', () => {
    it('updates view name in status slot after switchTo callback', () => {
      const statusEl = document.createElement('div');
      const vc = new ViewCanvas(makeConfig());
      vc.mount(container);
      vc.setStatusEl(statusEl);
      if (mockViewManagerInstance.onViewSwitch) {
        mockViewManagerInstance.onViewSwitch('list');
      }
      expect(statusEl.querySelector('[data-stat="view-name"]')?.textContent).toBe('List');
    });

    it('updates card count in status slot after switchTo callback', () => {
      mockViewManagerInstance.getLastCards.mockReturnValue(new Array(42).fill({}));
      const statusEl = document.createElement('div');
      const vc = new ViewCanvas(makeConfig());
      vc.mount(container);
      vc.setStatusEl(statusEl);
      if (mockViewManagerInstance.onViewSwitch) {
        mockViewManagerInstance.onViewSwitch('supergrid');
      }
      expect(statusEl.querySelector('[data-stat="card-count"]')?.textContent).toBe('42 cards');
    });

    it('renders "1 card" for singular card count', () => {
      mockViewManagerInstance.getLastCards.mockReturnValue([{}]);
      const statusEl = document.createElement('div');
      const vc = new ViewCanvas(makeConfig());
      vc.mount(container);
      vc.setStatusEl(statusEl);
      if (mockViewManagerInstance.onViewSwitch) {
        mockViewManagerInstance.onViewSwitch('list');
      }
      expect(statusEl.querySelector('[data-stat="card-count"]')?.textContent).toBe('1 card');
    });

    it('setStatusEl populates immediately if a view is already active', () => {
      const vc = new ViewCanvas(makeConfig());
      vc.mount(container);
      if (mockViewManagerInstance.onViewSwitch) {
        mockViewManagerInstance.onViewSwitch('grid');
      }
      const statusEl = document.createElement('div');
      vc.setStatusEl(statusEl);
      expect(statusEl.querySelector('[data-stat="view-name"]')?.textContent).toBe('Grid');
    });
  });

  describe('sidecar signaling', () => {
    it('fires onSidecarChange with "explorer-1" for supergrid view', () => {
      const onSidecarChange = vi.fn();
      const vc = new ViewCanvas(makeConfig({ onSidecarChange }));
      vc.mount(container);
      if (mockViewManagerInstance.onViewSwitch) {
        mockViewManagerInstance.onViewSwitch('supergrid');
      }
      expect(onSidecarChange).toHaveBeenCalledWith('explorer-1');
    });

    it('fires onSidecarChange with null for views without sidecar', () => {
      const onSidecarChange = vi.fn();
      const vc = new ViewCanvas(makeConfig({ onSidecarChange }));
      vc.mount(container);
      if (mockViewManagerInstance.onViewSwitch) {
        mockViewManagerInstance.onViewSwitch('list');
      }
      expect(onSidecarChange).toHaveBeenCalledWith(null);
    });

    it('fires onSidecarChange with null for grid view', () => {
      const onSidecarChange = vi.fn();
      const vc = new ViewCanvas(makeConfig({ onSidecarChange }));
      vc.mount(container);
      if (mockViewManagerInstance.onViewSwitch) {
        mockViewManagerInstance.onViewSwitch('grid');
      }
      expect(onSidecarChange).toHaveBeenCalledWith(null);
    });
  });
});
