// Isometry v5 — Phase 44 Plan 01 (Task 1)
// Tests for ShortcutRegistry: centralized keyboard shortcut management.
//
// Requirements: KEYS-04, KEYS-01
// TDD Phase: RED -> GREEN -> REFACTOR
//
// Note: Test environment is 'node' (not jsdom). We must stub document globally
// and simulate KeyboardEvent manually using plain objects.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ShortcutRegistry } from '../../src/shortcuts/ShortcutRegistry';

// ---------------------------------------------------------------------------
// Document stub helpers (same pattern as mutations/shortcuts.test.ts)
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
// Tests: Registration & lifecycle
// ---------------------------------------------------------------------------

describe('ShortcutRegistry — registration and lifecycle', () => {
	let documentStub: ReturnType<typeof createDocumentStub>;

	beforeEach(() => {
		documentStub = createDocumentStub();
		vi.stubGlobal('document', {
			addEventListener: documentStub.addEventListenerMock,
			removeEventListener: documentStub.removeEventListenerMock,
		});
		vi.stubGlobal('navigator', { platform: 'MacIntel' });
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('registers a keydown listener on construction', () => {
		const registry = new ShortcutRegistry();
		expect(documentStub.addEventListenerMock).toHaveBeenCalledWith('keydown', expect.any(Function));
		registry.destroy();
	});

	it('register adds a shortcut to the registry', () => {
		const registry = new ShortcutRegistry();
		const handler = vi.fn();
		registry.register('Cmd+Z', handler, { category: 'Editing', description: 'Undo' });
		const all = registry.getAll();
		expect(all).toHaveLength(1);
		expect(all[0]).toEqual({ shortcut: 'Cmd+Z', category: 'Editing', description: 'Undo' });
		registry.destroy();
	});

	it('register with Cmd+Shift+Z adds shortcut', () => {
		const registry = new ShortcutRegistry();
		const handler = vi.fn();
		registry.register('Cmd+Shift+Z', handler, { category: 'Editing', description: 'Redo' });
		const all = registry.getAll();
		expect(all).toHaveLength(1);
		expect(all[0]).toEqual({ shortcut: 'Cmd+Shift+Z', category: 'Editing', description: 'Redo' });
		registry.destroy();
	});

	it('register with Cmd+1 adds shortcut', () => {
		const registry = new ShortcutRegistry();
		const handler = vi.fn();
		registry.register('Cmd+1', handler, { category: 'Navigation', description: 'List view' });
		const all = registry.getAll();
		expect(all).toHaveLength(1);
		expect(all[0]).toEqual({ shortcut: 'Cmd+1', category: 'Navigation', description: 'List view' });
		registry.destroy();
	});

	it('getAll returns all registered shortcuts', () => {
		const registry = new ShortcutRegistry();
		registry.register('Cmd+Z', vi.fn(), { category: 'Editing', description: 'Undo' });
		registry.register('Cmd+Shift+Z', vi.fn(), { category: 'Editing', description: 'Redo' });
		registry.register('Cmd+1', vi.fn(), { category: 'Navigation', description: 'List view' });
		expect(registry.getAll()).toHaveLength(3);
		registry.destroy();
	});

	it('unregister removes a shortcut', () => {
		const registry = new ShortcutRegistry();
		registry.register('Cmd+Z', vi.fn(), { category: 'Editing', description: 'Undo' });
		registry.unregister('Cmd+Z');
		expect(registry.getAll()).toHaveLength(0);
		registry.destroy();
	});

	it('destroy removes keydown listener and clears all registrations', () => {
		const registry = new ShortcutRegistry();
		registry.register('Cmd+Z', vi.fn(), { category: 'Editing', description: 'Undo' });
		registry.destroy();
		expect(documentStub.removeEventListenerMock).toHaveBeenCalledWith('keydown', expect.any(Function));
		expect(registry.getAll()).toHaveLength(0);
	});

	it('duplicate register for same shortcut replaces the previous handler', () => {
		const registry = new ShortcutRegistry();
		const handler1 = vi.fn();
		const handler2 = vi.fn();
		registry.register('Cmd+Z', handler1, { category: 'Editing', description: 'Undo' });
		registry.register('Cmd+Z', handler2, { category: 'Editing', description: 'Undo v2' });
		expect(registry.getAll()).toHaveLength(1);
		expect(registry.getAll()[0]!.description).toBe('Undo v2');
		// Dispatch Cmd+Z — only handler2 should fire
		documentStub.dispatch('keydown', makeKeyEvent({ key: 'z', metaKey: true }));
		expect(handler1).not.toHaveBeenCalled();
		expect(handler2).toHaveBeenCalledTimes(1);
		registry.destroy();
	});
});

// ---------------------------------------------------------------------------
// Tests: Handler dispatch (Mac — metaKey)
// ---------------------------------------------------------------------------

describe('ShortcutRegistry — Mac handler dispatch', () => {
	let documentStub: ReturnType<typeof createDocumentStub>;

	beforeEach(() => {
		documentStub = createDocumentStub();
		vi.stubGlobal('document', {
			addEventListener: documentStub.addEventListenerMock,
			removeEventListener: documentStub.removeEventListenerMock,
		});
		vi.stubGlobal('navigator', { platform: 'MacIntel' });
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('Cmd+Z calls the registered handler on Mac', () => {
		const registry = new ShortcutRegistry();
		const handler = vi.fn();
		registry.register('Cmd+Z', handler, { category: 'Editing', description: 'Undo' });
		documentStub.dispatch('keydown', makeKeyEvent({ key: 'z', metaKey: true }));
		expect(handler).toHaveBeenCalledTimes(1);
		registry.destroy();
	});

	it('Cmd+Z calls preventDefault', () => {
		const registry = new ShortcutRegistry();
		registry.register('Cmd+Z', vi.fn(), { category: 'Editing', description: 'Undo' });
		const event = makeKeyEvent({ key: 'z', metaKey: true });
		documentStub.dispatch('keydown', event);
		expect(event.preventDefault).toHaveBeenCalled();
		registry.destroy();
	});

	it('Cmd+Shift+Z calls the registered handler on Mac', () => {
		const registry = new ShortcutRegistry();
		const handler = vi.fn();
		registry.register('Cmd+Shift+Z', handler, { category: 'Editing', description: 'Redo' });
		documentStub.dispatch('keydown', makeKeyEvent({ key: 'z', metaKey: true, shiftKey: true }));
		expect(handler).toHaveBeenCalledTimes(1);
		registry.destroy();
	});

	it('Cmd+1 calls the registered handler on Mac', () => {
		const registry = new ShortcutRegistry();
		const handler = vi.fn();
		registry.register('Cmd+1', handler, { category: 'Navigation', description: 'List view' });
		documentStub.dispatch('keydown', makeKeyEvent({ key: '1', metaKey: true }));
		expect(handler).toHaveBeenCalledTimes(1);
		registry.destroy();
	});

	it('Ctrl+Z on Mac does NOT fire Cmd+Z handler', () => {
		const registry = new ShortcutRegistry();
		const handler = vi.fn();
		registry.register('Cmd+Z', handler, { category: 'Editing', description: 'Undo' });
		documentStub.dispatch('keydown', makeKeyEvent({ key: 'z', ctrlKey: true }));
		expect(handler).not.toHaveBeenCalled();
		registry.destroy();
	});
});

// ---------------------------------------------------------------------------
// Tests: Handler dispatch (non-Mac — ctrlKey)
// ---------------------------------------------------------------------------

describe('ShortcutRegistry — non-Mac handler dispatch', () => {
	let documentStub: ReturnType<typeof createDocumentStub>;

	beforeEach(() => {
		documentStub = createDocumentStub();
		vi.stubGlobal('document', {
			addEventListener: documentStub.addEventListenerMock,
			removeEventListener: documentStub.removeEventListenerMock,
		});
		vi.stubGlobal('navigator', { platform: 'Win32' });
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('Ctrl+Z on non-Mac fires Cmd+Z handler', () => {
		const registry = new ShortcutRegistry();
		const handler = vi.fn();
		registry.register('Cmd+Z', handler, { category: 'Editing', description: 'Undo' });
		documentStub.dispatch('keydown', makeKeyEvent({ key: 'z', ctrlKey: true }));
		expect(handler).toHaveBeenCalledTimes(1);
		registry.destroy();
	});

	it('Meta+Z on non-Mac does NOT fire Cmd+Z handler', () => {
		const registry = new ShortcutRegistry();
		const handler = vi.fn();
		registry.register('Cmd+Z', handler, { category: 'Editing', description: 'Undo' });
		documentStub.dispatch('keydown', makeKeyEvent({ key: 'z', metaKey: true }));
		expect(handler).not.toHaveBeenCalled();
		registry.destroy();
	});

	it('Ctrl+1 on non-Mac fires Cmd+1 handler', () => {
		const registry = new ShortcutRegistry();
		const handler = vi.fn();
		registry.register('Cmd+1', handler, { category: 'Navigation', description: 'List view' });
		documentStub.dispatch('keydown', makeKeyEvent({ key: '1', ctrlKey: true }));
		expect(handler).toHaveBeenCalledTimes(1);
		registry.destroy();
	});
});

// ---------------------------------------------------------------------------
// Tests: Input field guard
// ---------------------------------------------------------------------------

describe('ShortcutRegistry — input field guard', () => {
	let documentStub: ReturnType<typeof createDocumentStub>;

	beforeEach(() => {
		documentStub = createDocumentStub();
		vi.stubGlobal('document', {
			addEventListener: documentStub.addEventListenerMock,
			removeEventListener: documentStub.removeEventListenerMock,
		});
		vi.stubGlobal('navigator', { platform: 'MacIntel' });
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('handler does NOT fire when target is INPUT element', () => {
		const registry = new ShortcutRegistry();
		const handler = vi.fn();
		registry.register('Cmd+Z', handler, { category: 'Editing', description: 'Undo' });
		documentStub.dispatch(
			'keydown',
			makeKeyEvent({ key: 'z', metaKey: true, target: { tagName: 'INPUT', isContentEditable: false } }),
		);
		expect(handler).not.toHaveBeenCalled();
		registry.destroy();
	});

	it('handler does NOT fire when target is TEXTAREA element', () => {
		const registry = new ShortcutRegistry();
		const handler = vi.fn();
		registry.register('Cmd+Z', handler, { category: 'Editing', description: 'Undo' });
		documentStub.dispatch(
			'keydown',
			makeKeyEvent({ key: 'z', metaKey: true, target: { tagName: 'TEXTAREA', isContentEditable: false } }),
		);
		expect(handler).not.toHaveBeenCalled();
		registry.destroy();
	});

	it('handler does NOT fire when target is contentEditable element', () => {
		const registry = new ShortcutRegistry();
		const handler = vi.fn();
		registry.register('Cmd+Z', handler, { category: 'Editing', description: 'Undo' });
		documentStub.dispatch(
			'keydown',
			makeKeyEvent({ key: 'z', metaKey: true, target: { tagName: 'DIV', isContentEditable: true } }),
		);
		expect(handler).not.toHaveBeenCalled();
		registry.destroy();
	});

	it('handler DOES fire when target is BODY element', () => {
		const registry = new ShortcutRegistry();
		const handler = vi.fn();
		registry.register('Cmd+Z', handler, { category: 'Editing', description: 'Undo' });
		documentStub.dispatch(
			'keydown',
			makeKeyEvent({ key: 'z', metaKey: true, target: { tagName: 'BODY', isContentEditable: false } }),
		);
		expect(handler).toHaveBeenCalledTimes(1);
		registry.destroy();
	});
});

// ---------------------------------------------------------------------------
// Tests: Plain key shortcuts (no modifier)
// ---------------------------------------------------------------------------

describe('ShortcutRegistry — plain key shortcuts', () => {
	let documentStub: ReturnType<typeof createDocumentStub>;

	beforeEach(() => {
		documentStub = createDocumentStub();
		vi.stubGlobal('document', {
			addEventListener: documentStub.addEventListenerMock,
			removeEventListener: documentStub.removeEventListenerMock,
		});
		vi.stubGlobal('navigator', { platform: 'MacIntel' });
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('? key (no modifier) fires handler for plain key shortcut', () => {
		const registry = new ShortcutRegistry();
		const handler = vi.fn();
		registry.register('?', handler, { category: 'Help', description: 'Show help' });
		documentStub.dispatch('keydown', makeKeyEvent({ key: '?' }));
		expect(handler).toHaveBeenCalledTimes(1);
		registry.destroy();
	});

	it('? key with shiftKey=true fires handler (RFIX-02: real browser sends shiftKey=true for ?)', () => {
		const registry = new ShortcutRegistry();
		const handler = vi.fn();
		registry.register('?', handler, { category: 'Help', description: 'Show help' });
		// Real browser event: pressing Shift+/ produces key='?' with shiftKey=true
		documentStub.dispatch('keydown', makeKeyEvent({ key: '?', shiftKey: true }));
		expect(handler).toHaveBeenCalledTimes(1);
		registry.destroy();
	});

	it('! key with shiftKey=true fires handler for registered ! shortcut (future-proof)', () => {
		const registry = new ShortcutRegistry();
		const handler = vi.fn();
		registry.register('!', handler, { category: 'Actions', description: 'Quick action' });
		// Real browser event: pressing Shift+1 produces key='!' with shiftKey=true
		documentStub.dispatch('keydown', makeKeyEvent({ key: '!', shiftKey: true }));
		expect(handler).toHaveBeenCalledTimes(1);
		registry.destroy();
	});

	it('Cmd+Z still requires exact shiftKey=false (modifier shortcuts unaffected)', () => {
		const registry = new ShortcutRegistry();
		const undoHandler = vi.fn();
		const redoHandler = vi.fn();
		registry.register('Cmd+Z', undoHandler, { category: 'Editing', description: 'Undo' });
		registry.register('Cmd+Shift+Z', redoHandler, { category: 'Editing', description: 'Redo' });

		// Cmd+Z without shift should fire undo, not redo
		documentStub.dispatch('keydown', makeKeyEvent({ key: 'z', metaKey: true, shiftKey: false }));
		expect(undoHandler).toHaveBeenCalledTimes(1);
		expect(redoHandler).not.toHaveBeenCalled();
		registry.destroy();
	});

	it('Cmd+Shift+Z still requires exact shiftKey=true (modifier shortcuts unaffected)', () => {
		const registry = new ShortcutRegistry();
		const undoHandler = vi.fn();
		const redoHandler = vi.fn();
		registry.register('Cmd+Z', undoHandler, { category: 'Editing', description: 'Undo' });
		registry.register('Cmd+Shift+Z', redoHandler, { category: 'Editing', description: 'Redo' });

		// Cmd+Shift+Z should fire redo, not undo
		documentStub.dispatch('keydown', makeKeyEvent({ key: 'z', metaKey: true, shiftKey: true }));
		expect(redoHandler).toHaveBeenCalledTimes(1);
		expect(undoHandler).not.toHaveBeenCalled();
		registry.destroy();
	});

	it('? with Cmd pressed does NOT fire plain ? handler', () => {
		const registry = new ShortcutRegistry();
		const handler = vi.fn();
		registry.register('?', handler, { category: 'Help', description: 'Show help' });
		documentStub.dispatch('keydown', makeKeyEvent({ key: '?', metaKey: true }));
		expect(handler).not.toHaveBeenCalled();
		registry.destroy();
	});

	it('plain key shortcut still respects input field guard', () => {
		const registry = new ShortcutRegistry();
		const handler = vi.fn();
		registry.register('?', handler, { category: 'Help', description: 'Show help' });
		documentStub.dispatch(
			'keydown',
			makeKeyEvent({ key: '?', target: { tagName: 'INPUT', isContentEditable: false } }),
		);
		expect(handler).not.toHaveBeenCalled();
		registry.destroy();
	});
});
