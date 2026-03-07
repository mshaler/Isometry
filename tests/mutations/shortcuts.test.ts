// Isometry v5 — Phase 4 Plan 07 (Task 1)
// Tests for setupMutationShortcuts: keyboard shortcut registration and cleanup.
//
// Requirements: MUT-07
// TDD Phase: RED → GREEN → REFACTOR
//
// Note: Test environment is 'node' (not jsdom). We must stub document globally
// and simulate KeyboardEvent manually using plain objects.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MutationManager } from '../../src/mutations/MutationManager';
import { setupMutationShortcuts } from '../../src/mutations/shortcuts';

// ---------------------------------------------------------------------------
// Mock MutationManager
// ---------------------------------------------------------------------------

function createMockManager(): {
	manager: Pick<MutationManager, 'undo' | 'redo'>;
	undoMock: ReturnType<typeof vi.fn>;
	redoMock: ReturnType<typeof vi.fn>;
} {
	const undoMock = vi.fn().mockResolvedValue(true);
	const redoMock = vi.fn().mockResolvedValue(true);

	const manager = {
		undo: undoMock,
		redo: redoMock,
	} as unknown as Pick<MutationManager, 'undo' | 'redo'>;

	return { manager, undoMock, redoMock };
}

// ---------------------------------------------------------------------------
// Document stub helpers
// ---------------------------------------------------------------------------

/**
 * Stub document.addEventListener/removeEventListener for Node environment.
 * Returns helpers to dispatch events and inspect registrations.
 */
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
		key: 'z',
		metaKey: false,
		ctrlKey: false,
		shiftKey: false,
		preventDefault: vi.fn(),
		target: { ...defaultTarget, ...target },
		...rest,
	} as unknown as KeyboardEvent;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('setupMutationShortcuts — listener registration', () => {
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

	it('registers a keydown listener on document', () => {
		const { manager } = createMockManager();
		setupMutationShortcuts(manager as MutationManager);
		expect(documentStub.addEventListenerMock).toHaveBeenCalledWith('keydown', expect.any(Function));
	});

	it('returns a cleanup function', () => {
		const { manager } = createMockManager();
		const cleanup = setupMutationShortcuts(manager as MutationManager);
		expect(typeof cleanup).toBe('function');
	});

	it('cleanup removes the keydown listener', () => {
		const { manager } = createMockManager();
		const cleanup = setupMutationShortcuts(manager as MutationManager);
		cleanup();
		expect(documentStub.removeEventListenerMock).toHaveBeenCalledWith('keydown', expect.any(Function));
	});

	it('after cleanup, no listeners remain for keydown', () => {
		const { manager } = createMockManager();
		const cleanup = setupMutationShortcuts(manager as MutationManager);
		cleanup();
		const remaining = documentStub.listeners.get('keydown') ?? [];
		expect(remaining).toHaveLength(0);
	});
});

describe('setupMutationShortcuts — Mac shortcuts (metaKey)', () => {
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

	it('Cmd+Z triggers undo()', () => {
		const { manager, undoMock } = createMockManager();
		setupMutationShortcuts(manager as MutationManager);
		documentStub.dispatch('keydown', makeKeyEvent({ key: 'z', metaKey: true, shiftKey: false }));
		expect(undoMock).toHaveBeenCalledTimes(1);
	});

	it('Cmd+Shift+Z triggers redo()', () => {
		const { manager, redoMock } = createMockManager();
		setupMutationShortcuts(manager as MutationManager);
		documentStub.dispatch('keydown', makeKeyEvent({ key: 'z', metaKey: true, shiftKey: true }));
		expect(redoMock).toHaveBeenCalledTimes(1);
	});

	it('Cmd+Z calls preventDefault()', () => {
		const { manager } = createMockManager();
		setupMutationShortcuts(manager as MutationManager);
		const event = makeKeyEvent({ key: 'z', metaKey: true, shiftKey: false });
		documentStub.dispatch('keydown', event);
		expect(event.preventDefault).toHaveBeenCalled();
	});

	it('Cmd+Shift+Z calls preventDefault()', () => {
		const { manager } = createMockManager();
		setupMutationShortcuts(manager as MutationManager);
		const event = makeKeyEvent({ key: 'z', metaKey: true, shiftKey: true });
		documentStub.dispatch('keydown', event);
		expect(event.preventDefault).toHaveBeenCalled();
	});

	it('Ctrl+Z on Mac does NOT trigger undo (metaKey required)', () => {
		const { manager, undoMock } = createMockManager();
		setupMutationShortcuts(manager as MutationManager);
		documentStub.dispatch('keydown', makeKeyEvent({ key: 'z', ctrlKey: true, shiftKey: false }));
		expect(undoMock).not.toHaveBeenCalled();
	});

	it('Ctrl+Y on Mac does NOT trigger redo (metaKey required)', () => {
		const { manager, redoMock } = createMockManager();
		setupMutationShortcuts(manager as MutationManager);
		documentStub.dispatch('keydown', makeKeyEvent({ key: 'y', ctrlKey: true }));
		expect(redoMock).not.toHaveBeenCalled();
	});
});

describe('setupMutationShortcuts — non-Mac shortcuts (ctrlKey)', () => {
	let documentStub: ReturnType<typeof createDocumentStub>;

	beforeEach(() => {
		documentStub = createDocumentStub();
		vi.stubGlobal('document', {
			addEventListener: documentStub.addEventListenerMock,
			removeEventListener: documentStub.removeEventListenerMock,
		});
		// Non-Mac: platform is 'Win32'
		vi.stubGlobal('navigator', { platform: 'Win32' });
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('Ctrl+Z triggers undo()', () => {
		const { manager, undoMock } = createMockManager();
		setupMutationShortcuts(manager as MutationManager);
		documentStub.dispatch('keydown', makeKeyEvent({ key: 'z', ctrlKey: true, shiftKey: false }));
		expect(undoMock).toHaveBeenCalledTimes(1);
	});

	it('Ctrl+Shift+Z triggers redo()', () => {
		const { manager, redoMock } = createMockManager();
		setupMutationShortcuts(manager as MutationManager);
		documentStub.dispatch('keydown', makeKeyEvent({ key: 'z', ctrlKey: true, shiftKey: true }));
		expect(redoMock).toHaveBeenCalledTimes(1);
	});

	it('Ctrl+Y triggers redo()', () => {
		const { manager, redoMock } = createMockManager();
		setupMutationShortcuts(manager as MutationManager);
		documentStub.dispatch('keydown', makeKeyEvent({ key: 'y', ctrlKey: true }));
		expect(redoMock).toHaveBeenCalledTimes(1);
	});

	it('Ctrl+Z calls preventDefault()', () => {
		const { manager } = createMockManager();
		setupMutationShortcuts(manager as MutationManager);
		const event = makeKeyEvent({ key: 'z', ctrlKey: true, shiftKey: false });
		documentStub.dispatch('keydown', event);
		expect(event.preventDefault).toHaveBeenCalled();
	});

	it('Ctrl+Y calls preventDefault()', () => {
		const { manager } = createMockManager();
		setupMutationShortcuts(manager as MutationManager);
		const event = makeKeyEvent({ key: 'y', ctrlKey: true });
		documentStub.dispatch('keydown', event);
		expect(event.preventDefault).toHaveBeenCalled();
	});

	it('Meta+Z on non-Mac does NOT trigger undo', () => {
		const { manager, undoMock } = createMockManager();
		setupMutationShortcuts(manager as MutationManager);
		documentStub.dispatch('keydown', makeKeyEvent({ key: 'z', metaKey: true, shiftKey: false }));
		expect(undoMock).not.toHaveBeenCalled();
	});
});

describe('setupMutationShortcuts — input field guard', () => {
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

	it('Cmd+Z in INPUT element does NOT trigger undo()', () => {
		const { manager, undoMock } = createMockManager();
		setupMutationShortcuts(manager as MutationManager);
		documentStub.dispatch(
			'keydown',
			makeKeyEvent({ key: 'z', metaKey: true, target: { tagName: 'INPUT', isContentEditable: false } }),
		);
		expect(undoMock).not.toHaveBeenCalled();
	});

	it('Cmd+Z in TEXTAREA element does NOT trigger undo()', () => {
		const { manager, undoMock } = createMockManager();
		setupMutationShortcuts(manager as MutationManager);
		documentStub.dispatch(
			'keydown',
			makeKeyEvent({ key: 'z', metaKey: true, target: { tagName: 'TEXTAREA', isContentEditable: false } }),
		);
		expect(undoMock).not.toHaveBeenCalled();
	});

	it('Cmd+Z in contentEditable element does NOT trigger undo()', () => {
		const { manager, undoMock } = createMockManager();
		setupMutationShortcuts(manager as MutationManager);
		documentStub.dispatch(
			'keydown',
			makeKeyEvent({ key: 'z', metaKey: true, target: { tagName: 'DIV', isContentEditable: true } }),
		);
		expect(undoMock).not.toHaveBeenCalled();
	});

	it('Cmd+Z on BODY element DOES trigger undo()', () => {
		const { manager, undoMock } = createMockManager();
		setupMutationShortcuts(manager as MutationManager);
		documentStub.dispatch(
			'keydown',
			makeKeyEvent({ key: 'z', metaKey: true, target: { tagName: 'BODY', isContentEditable: false } }),
		);
		expect(undoMock).toHaveBeenCalledTimes(1);
	});
});

describe('setupMutationShortcuts — unrelated keys', () => {
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

	it('Cmd+S does not trigger undo or redo', () => {
		const { manager, undoMock, redoMock } = createMockManager();
		setupMutationShortcuts(manager as MutationManager);
		documentStub.dispatch('keydown', makeKeyEvent({ key: 's', metaKey: true }));
		expect(undoMock).not.toHaveBeenCalled();
		expect(redoMock).not.toHaveBeenCalled();
	});

	it('plain Z without modifier does not trigger undo or redo', () => {
		const { manager, undoMock, redoMock } = createMockManager();
		setupMutationShortcuts(manager as MutationManager);
		documentStub.dispatch('keydown', makeKeyEvent({ key: 'z' }));
		expect(undoMock).not.toHaveBeenCalled();
		expect(redoMock).not.toHaveBeenCalled();
	});
});
