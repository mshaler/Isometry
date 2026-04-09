// Isometry v5 — Phase 145 Plan 01
// Regression tests for Cmd+1-9 keyboard shortcuts.
//
// Requirements: DOCK-06
// Coverage: Two levels per D-06 — unit (ShortcutRegistry dispatch) and integration (sidebar + view activation)
// D-07: All 9 bindings must have individual test cases at both levels.

import { type Mock, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ShortcutRegistry } from '../../src/shortcuts/ShortcutRegistry';
import { viewOrder } from '../../src/ui/section-defs';

// ---------------------------------------------------------------------------
// Document stub helpers (same pattern as ShortcutRegistry.test.ts)
// ---------------------------------------------------------------------------

function createDocumentStub() {
	const listeners = new Map<string, EventListener[]>();

	const addEventListenerMock = vi.fn((event: string, handler: EventListener) => {
		if (!listeners.has(event)) listeners.set(event, []);
		listeners.get(event)!.push(handler);
	});

	const removeEventListenerMock = vi.fn((event: string, handler: EventListener) => {
		const handlers = listeners.get(event) ?? [];
		const idx = handlers.indexOf(handler);
		if (idx !== -1) handlers.splice(idx, 1);
	});

	function dispatch(event: string, eventObj: unknown) {
		const handlers = listeners.get(event) ?? [];
		for (const h of handlers) h(eventObj as Event);
	}

	return { addEventListenerMock, removeEventListenerMock, dispatch, listeners };
}

// ---------------------------------------------------------------------------
// KeyboardEvent factory
// ---------------------------------------------------------------------------

function makeKeyEvent(
	overrides: Partial<Omit<KeyboardEvent, 'target'>> & {
		target?: { tagName?: string; isContentEditable?: boolean };
	} = {},
): KeyboardEvent {
	const { target, ...rest } = overrides;
	const defaultTarget = { tagName: 'BODY', isContentEditable: false };
	return {
		key: '',
		metaKey: false,
		ctrlKey: false,
		shiftKey: false,
		altKey: false,
		preventDefault: vi.fn(),
		target: { ...defaultTarget, ...target },
		...rest,
	} as unknown as KeyboardEvent;
}

// ---------------------------------------------------------------------------
// viewOrder alignment checks
// ---------------------------------------------------------------------------

describe('viewOrder alignment', () => {
	it('viewOrder has exactly 9 entries matching Cmd+1-9', () => {
		expect(viewOrder).toHaveLength(9);
	});

	it('viewOrder entries match expected view types in order', () => {
		expect([...viewOrder]).toEqual([
			'list', 'grid', 'kanban', 'calendar', 'timeline',
			'gallery', 'network', 'tree', 'supergrid',
		]);
	});
});

// ---------------------------------------------------------------------------
// Unit regression: ShortcutRegistry dispatch — Cmd+1-9
// ---------------------------------------------------------------------------

describe('ShortcutRegistry — Cmd+1-9 unit regression', () => {
	let documentStub: ReturnType<typeof createDocumentStub>;
	let registry: ShortcutRegistry;
	const handlers = new Map<string, ReturnType<typeof vi.fn>>();

	beforeEach(() => {
		documentStub = createDocumentStub();
		vi.stubGlobal('document', {
			addEventListener: documentStub.addEventListenerMock,
			removeEventListener: documentStub.removeEventListenerMock,
		});
		vi.stubGlobal('navigator', { platform: 'MacIntel' });

		registry = new ShortcutRegistry();

		// Register all 9 shortcuts with individual mock handlers
		viewOrder.forEach((viewType, index) => {
			const handler = vi.fn();
			handlers.set(viewType, handler);
			registry.register(
				`Cmd+${index + 1}`,
				handler,
				{ category: 'Navigation', description: `${viewType} view` },
			);
		});
	});

	afterEach(() => {
		registry.destroy();
		vi.unstubAllGlobals();
		handlers.clear();
	});

	it('Cmd+1 fires handler for list view', () => {
		documentStub.dispatch('keydown', makeKeyEvent({ key: '1', metaKey: true }));
		expect(handlers.get('list')).toHaveBeenCalledTimes(1);
		expect(handlers.get('grid')).not.toHaveBeenCalled();
		expect(handlers.get('kanban')).not.toHaveBeenCalled();
		expect(handlers.get('calendar')).not.toHaveBeenCalled();
		expect(handlers.get('timeline')).not.toHaveBeenCalled();
		expect(handlers.get('gallery')).not.toHaveBeenCalled();
		expect(handlers.get('network')).not.toHaveBeenCalled();
		expect(handlers.get('tree')).not.toHaveBeenCalled();
		expect(handlers.get('supergrid')).not.toHaveBeenCalled();
	});

	it('Cmd+2 fires handler for grid view', () => {
		documentStub.dispatch('keydown', makeKeyEvent({ key: '2', metaKey: true }));
		expect(handlers.get('list')).not.toHaveBeenCalled();
		expect(handlers.get('grid')).toHaveBeenCalledTimes(1);
		expect(handlers.get('kanban')).not.toHaveBeenCalled();
		expect(handlers.get('calendar')).not.toHaveBeenCalled();
		expect(handlers.get('timeline')).not.toHaveBeenCalled();
		expect(handlers.get('gallery')).not.toHaveBeenCalled();
		expect(handlers.get('network')).not.toHaveBeenCalled();
		expect(handlers.get('tree')).not.toHaveBeenCalled();
		expect(handlers.get('supergrid')).not.toHaveBeenCalled();
	});

	it('Cmd+3 fires handler for kanban view', () => {
		documentStub.dispatch('keydown', makeKeyEvent({ key: '3', metaKey: true }));
		expect(handlers.get('list')).not.toHaveBeenCalled();
		expect(handlers.get('grid')).not.toHaveBeenCalled();
		expect(handlers.get('kanban')).toHaveBeenCalledTimes(1);
		expect(handlers.get('calendar')).not.toHaveBeenCalled();
		expect(handlers.get('timeline')).not.toHaveBeenCalled();
		expect(handlers.get('gallery')).not.toHaveBeenCalled();
		expect(handlers.get('network')).not.toHaveBeenCalled();
		expect(handlers.get('tree')).not.toHaveBeenCalled();
		expect(handlers.get('supergrid')).not.toHaveBeenCalled();
	});

	it('Cmd+4 fires handler for calendar view', () => {
		documentStub.dispatch('keydown', makeKeyEvent({ key: '4', metaKey: true }));
		expect(handlers.get('list')).not.toHaveBeenCalled();
		expect(handlers.get('grid')).not.toHaveBeenCalled();
		expect(handlers.get('kanban')).not.toHaveBeenCalled();
		expect(handlers.get('calendar')).toHaveBeenCalledTimes(1);
		expect(handlers.get('timeline')).not.toHaveBeenCalled();
		expect(handlers.get('gallery')).not.toHaveBeenCalled();
		expect(handlers.get('network')).not.toHaveBeenCalled();
		expect(handlers.get('tree')).not.toHaveBeenCalled();
		expect(handlers.get('supergrid')).not.toHaveBeenCalled();
	});

	it('Cmd+5 fires handler for timeline view', () => {
		documentStub.dispatch('keydown', makeKeyEvent({ key: '5', metaKey: true }));
		expect(handlers.get('list')).not.toHaveBeenCalled();
		expect(handlers.get('grid')).not.toHaveBeenCalled();
		expect(handlers.get('kanban')).not.toHaveBeenCalled();
		expect(handlers.get('calendar')).not.toHaveBeenCalled();
		expect(handlers.get('timeline')).toHaveBeenCalledTimes(1);
		expect(handlers.get('gallery')).not.toHaveBeenCalled();
		expect(handlers.get('network')).not.toHaveBeenCalled();
		expect(handlers.get('tree')).not.toHaveBeenCalled();
		expect(handlers.get('supergrid')).not.toHaveBeenCalled();
	});

	it('Cmd+6 fires handler for gallery view', () => {
		documentStub.dispatch('keydown', makeKeyEvent({ key: '6', metaKey: true }));
		expect(handlers.get('list')).not.toHaveBeenCalled();
		expect(handlers.get('grid')).not.toHaveBeenCalled();
		expect(handlers.get('kanban')).not.toHaveBeenCalled();
		expect(handlers.get('calendar')).not.toHaveBeenCalled();
		expect(handlers.get('timeline')).not.toHaveBeenCalled();
		expect(handlers.get('gallery')).toHaveBeenCalledTimes(1);
		expect(handlers.get('network')).not.toHaveBeenCalled();
		expect(handlers.get('tree')).not.toHaveBeenCalled();
		expect(handlers.get('supergrid')).not.toHaveBeenCalled();
	});

	it('Cmd+7 fires handler for network view', () => {
		documentStub.dispatch('keydown', makeKeyEvent({ key: '7', metaKey: true }));
		expect(handlers.get('list')).not.toHaveBeenCalled();
		expect(handlers.get('grid')).not.toHaveBeenCalled();
		expect(handlers.get('kanban')).not.toHaveBeenCalled();
		expect(handlers.get('calendar')).not.toHaveBeenCalled();
		expect(handlers.get('timeline')).not.toHaveBeenCalled();
		expect(handlers.get('gallery')).not.toHaveBeenCalled();
		expect(handlers.get('network')).toHaveBeenCalledTimes(1);
		expect(handlers.get('tree')).not.toHaveBeenCalled();
		expect(handlers.get('supergrid')).not.toHaveBeenCalled();
	});

	it('Cmd+8 fires handler for tree view', () => {
		documentStub.dispatch('keydown', makeKeyEvent({ key: '8', metaKey: true }));
		expect(handlers.get('list')).not.toHaveBeenCalled();
		expect(handlers.get('grid')).not.toHaveBeenCalled();
		expect(handlers.get('kanban')).not.toHaveBeenCalled();
		expect(handlers.get('calendar')).not.toHaveBeenCalled();
		expect(handlers.get('timeline')).not.toHaveBeenCalled();
		expect(handlers.get('gallery')).not.toHaveBeenCalled();
		expect(handlers.get('network')).not.toHaveBeenCalled();
		expect(handlers.get('tree')).toHaveBeenCalledTimes(1);
		expect(handlers.get('supergrid')).not.toHaveBeenCalled();
	});

	it('Cmd+9 fires handler for supergrid view', () => {
		documentStub.dispatch('keydown', makeKeyEvent({ key: '9', metaKey: true }));
		expect(handlers.get('list')).not.toHaveBeenCalled();
		expect(handlers.get('grid')).not.toHaveBeenCalled();
		expect(handlers.get('kanban')).not.toHaveBeenCalled();
		expect(handlers.get('calendar')).not.toHaveBeenCalled();
		expect(handlers.get('timeline')).not.toHaveBeenCalled();
		expect(handlers.get('gallery')).not.toHaveBeenCalled();
		expect(handlers.get('network')).not.toHaveBeenCalled();
		expect(handlers.get('tree')).not.toHaveBeenCalled();
		expect(handlers.get('supergrid')).toHaveBeenCalledTimes(1);
	});
});

// ---------------------------------------------------------------------------
// Integration regression: sidebar + view activation — Cmd+1-9
// ---------------------------------------------------------------------------

describe('ShortcutRegistry — Cmd+1-9 integration regression', () => {
	let documentStub: ReturnType<typeof createDocumentStub>;
	let registry: ShortcutRegistry;
	let mockSetActiveItem: Mock<(a: string, b: string) => void>;
	let mockSwitchTo: Mock<(v: string) => Promise<void>>;
	let mockGetViewContentEl: Mock<() => { style: { opacity: string } }>;

	beforeEach(() => {
		documentStub = createDocumentStub();
		vi.stubGlobal('document', {
			addEventListener: documentStub.addEventListenerMock,
			removeEventListener: documentStub.removeEventListenerMock,
		});
		vi.stubGlobal('navigator', { platform: 'MacIntel' });

		registry = new ShortcutRegistry();

		mockSetActiveItem = vi.fn();
		mockSwitchTo = vi.fn(() => Promise.resolve());
		mockGetViewContentEl = vi.fn(() => ({ style: { opacity: '1' } }));

		// Register all 9 shortcuts mimicking the main.ts pattern
		viewOrder.forEach((viewType, index) => {
			const num = index + 1;
			registry.register(
				`Cmd+${num}`,
				() => {
					mockSetActiveItem('visualization', viewType);
					const el = mockGetViewContentEl();
					el.style.opacity = '0';
					void mockSwitchTo(viewType).then(() => {
						el.style.opacity = '1';
					});
				},
				{ category: 'Navigation', description: `${viewType.charAt(0).toUpperCase() + viewType.slice(1)} view` },
			);
		});
	});

	afterEach(() => {
		registry.destroy();
		vi.unstubAllGlobals();
		vi.clearAllMocks();
	});

	it('Cmd+1 activates list in sidebar and switches view', () => {
		documentStub.dispatch('keydown', makeKeyEvent({ key: '1', metaKey: true }));
		expect(mockSetActiveItem).toHaveBeenCalledWith('visualization', 'list');
		expect(mockSwitchTo).toHaveBeenCalledWith('list');
	});

	it('Cmd+2 activates grid in sidebar and switches view', () => {
		documentStub.dispatch('keydown', makeKeyEvent({ key: '2', metaKey: true }));
		expect(mockSetActiveItem).toHaveBeenCalledWith('visualization', 'grid');
		expect(mockSwitchTo).toHaveBeenCalledWith('grid');
	});

	it('Cmd+3 activates kanban in sidebar and switches view', () => {
		documentStub.dispatch('keydown', makeKeyEvent({ key: '3', metaKey: true }));
		expect(mockSetActiveItem).toHaveBeenCalledWith('visualization', 'kanban');
		expect(mockSwitchTo).toHaveBeenCalledWith('kanban');
	});

	it('Cmd+4 activates calendar in sidebar and switches view', () => {
		documentStub.dispatch('keydown', makeKeyEvent({ key: '4', metaKey: true }));
		expect(mockSetActiveItem).toHaveBeenCalledWith('visualization', 'calendar');
		expect(mockSwitchTo).toHaveBeenCalledWith('calendar');
	});

	it('Cmd+5 activates timeline in sidebar and switches view', () => {
		documentStub.dispatch('keydown', makeKeyEvent({ key: '5', metaKey: true }));
		expect(mockSetActiveItem).toHaveBeenCalledWith('visualization', 'timeline');
		expect(mockSwitchTo).toHaveBeenCalledWith('timeline');
	});

	it('Cmd+6 activates gallery in sidebar and switches view', () => {
		documentStub.dispatch('keydown', makeKeyEvent({ key: '6', metaKey: true }));
		expect(mockSetActiveItem).toHaveBeenCalledWith('visualization', 'gallery');
		expect(mockSwitchTo).toHaveBeenCalledWith('gallery');
	});

	it('Cmd+7 activates network in sidebar and switches view', () => {
		documentStub.dispatch('keydown', makeKeyEvent({ key: '7', metaKey: true }));
		expect(mockSetActiveItem).toHaveBeenCalledWith('visualization', 'network');
		expect(mockSwitchTo).toHaveBeenCalledWith('network');
	});

	it('Cmd+8 activates tree in sidebar and switches view', () => {
		documentStub.dispatch('keydown', makeKeyEvent({ key: '8', metaKey: true }));
		expect(mockSetActiveItem).toHaveBeenCalledWith('visualization', 'tree');
		expect(mockSwitchTo).toHaveBeenCalledWith('tree');
	});

	it('Cmd+9 activates supergrid in sidebar and switches view', () => {
		documentStub.dispatch('keydown', makeKeyEvent({ key: '9', metaKey: true }));
		expect(mockSetActiveItem).toHaveBeenCalledWith('visualization', 'supergrid');
		expect(mockSwitchTo).toHaveBeenCalledWith('supergrid');
	});
});
