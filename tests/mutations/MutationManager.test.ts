// Isometry v5 — Phase 4 MutationManager Tests
// Tests for execute, undo, redo, dirty flag, rAF batching, history depth cap.
//
// RESEARCH Pitfall 2: requestAnimationFrame not available in Node/Vitest.
// Stub globally in beforeEach so scheduleNotify() fires synchronously.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { batchMutation, createCardMutation } from '../../src/mutations/inverses';
import { MutationManager } from '../../src/mutations/MutationManager';
import type { Mutation } from '../../src/mutations/types';

// ---------------------------------------------------------------------------
// Mock WorkerBridge
// ---------------------------------------------------------------------------

function createMockBridge() {
	const calls: Array<{ type: string; payload: unknown }> = [];
	const bridge = {
		exec: vi.fn((_sql: string, _params: unknown[]) => {
			calls.push({ type: 'db:exec', payload: { sql: _sql, params: _params } });
			return Promise.resolve({ changes: 1 });
		}),
		getCalls: () => calls,
		resetCalls: () => calls.splice(0),
	};
	return bridge;
}

type MockBridge = ReturnType<typeof createMockBridge>;

// ---------------------------------------------------------------------------
// rAF stub helpers
// ---------------------------------------------------------------------------

beforeEach(() => {
	vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
		cb(performance.now());
		return 0;
	});
	vi.stubGlobal('cancelAnimationFrame', () => {});
});

afterEach(() => {
	vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
// Helper: make a simple mutation for testing
// ---------------------------------------------------------------------------

function makeMutation(name: string): Mutation {
	return createCardMutation({ name });
}

// ---------------------------------------------------------------------------
// execute()
// ---------------------------------------------------------------------------

describe('MutationManager.execute()', () => {
	it('calls bridge.exec for each forward command', async () => {
		const bridge = createMockBridge();
		const mm = new MutationManager(bridge as unknown as MockBridge);
		const m = makeMutation('Test Card');

		await mm.execute(m);

		expect(bridge.exec).toHaveBeenCalledTimes(1);
		const call = bridge.getCalls()[0]!;
		expect(call.payload).toMatchObject({ sql: expect.stringMatching(/INSERT INTO cards/i) });
	});

	it('adds mutation to history', async () => {
		const bridge = createMockBridge();
		const mm = new MutationManager(bridge as unknown as MockBridge);
		const m = makeMutation('Card');

		await mm.execute(m);

		expect(mm.getHistory()).toHaveLength(1);
		expect(mm.getHistory()[0]).toBe(m);
	});

	it('clears redo stack on execute', async () => {
		const bridge = createMockBridge();
		const mm = new MutationManager(bridge as unknown as MockBridge);

		const m1 = makeMutation('Card 1');
		const m2 = makeMutation('Card 2');
		const m3 = makeMutation('Card 3');

		await mm.execute(m1);
		await mm.undo();
		expect(mm.canRedo()).toBe(true);

		// New execute clears redo stack
		await mm.execute(m2);
		expect(mm.canRedo()).toBe(false);

		// Another execute still no redo
		await mm.execute(m3);
		expect(mm.canRedo()).toBe(false);
	});

	it('sets dirty = true', async () => {
		const bridge = createMockBridge();
		const mm = new MutationManager(bridge as unknown as MockBridge);
		expect(mm.isDirty()).toBe(false);

		await mm.execute(makeMutation('Card'));

		expect(mm.isDirty()).toBe(true);
	});

	it('schedules subscriber notification via requestAnimationFrame', async () => {
		const bridge = createMockBridge();
		const mm = new MutationManager(bridge as unknown as MockBridge);
		const cb = vi.fn();
		mm.subscribe(cb);

		await mm.execute(makeMutation('Card'));

		expect(cb).toHaveBeenCalledTimes(1);
	});

	it('two rapid execute() calls produce ONE subscriber notification', async () => {
		const rafCalls: FrameRequestCallback[] = [];
		vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
			rafCalls.push(cb);
			return rafCalls.length;
		});

		const bridge = createMockBridge();
		const mm = new MutationManager(bridge as unknown as MockBridge);
		const cb = vi.fn();
		mm.subscribe(cb);

		// Both execute() calls happen before rAF fires
		await mm.execute(makeMutation('Card 1'));
		await mm.execute(makeMutation('Card 2'));

		// rAF hasn't fired yet — subscriber not called
		expect(cb).not.toHaveBeenCalled();
		// Only ONE rAF was scheduled (pendingNotify guard)
		expect(rafCalls).toHaveLength(1);

		// Fire the rAF callback
		rafCalls[0]!(performance.now());
		expect(cb).toHaveBeenCalledTimes(1);
	});

	it('executes multiple forward commands in order for batch mutation', async () => {
		const bridge = createMockBridge();
		const mm = new MutationManager(bridge as unknown as MockBridge);

		const m1 = makeMutation('Card A');
		const m2 = makeMutation('Card B');
		const batch = batchMutation('Create A and B', m1, m2);

		await mm.execute(batch);

		// Both forward commands executed
		expect(bridge.exec).toHaveBeenCalledTimes(2);
	});
});

// ---------------------------------------------------------------------------
// undo()
// ---------------------------------------------------------------------------

describe('MutationManager.undo()', () => {
	it('returns false when history is empty', async () => {
		const bridge = createMockBridge();
		const mm = new MutationManager(bridge as unknown as MockBridge);

		const result = await mm.undo();

		expect(result).toBe(false);
		expect(bridge.exec).not.toHaveBeenCalled();
	});

	it('sends inverse commands to bridge', async () => {
		const bridge = createMockBridge();
		const mm = new MutationManager(bridge as unknown as MockBridge);
		const m = makeMutation('Card');

		await mm.execute(m);
		bridge.resetCalls();
		bridge.exec.mockClear();

		await mm.undo();

		expect(bridge.exec).toHaveBeenCalledTimes(1);
		const call = bridge.getCalls()[0]!;
		expect(call.payload).toMatchObject({ sql: expect.stringMatching(/DELETE FROM cards WHERE id = \?/i) });
	});

	it('pops from history and pushes to redo stack', async () => {
		const bridge = createMockBridge();
		const mm = new MutationManager(bridge as unknown as MockBridge);
		const m = makeMutation('Card');

		await mm.execute(m);
		expect(mm.getHistory()).toHaveLength(1);
		expect(mm.canRedo()).toBe(false);

		await mm.undo();

		expect(mm.getHistory()).toHaveLength(0);
		expect(mm.canRedo()).toBe(true);
	});

	it('returns true when undo succeeds', async () => {
		const bridge = createMockBridge();
		const mm = new MutationManager(bridge as unknown as MockBridge);
		await mm.execute(makeMutation('Card'));

		const result = await mm.undo();

		expect(result).toBe(true);
	});

	it('sets dirty = true', async () => {
		const bridge = createMockBridge();
		const mm = new MutationManager(bridge as unknown as MockBridge);
		await mm.execute(makeMutation('Card'));
		mm.clearDirty();
		expect(mm.isDirty()).toBe(false);

		await mm.undo();

		expect(mm.isDirty()).toBe(true);
	});

	it('notifies subscribers', async () => {
		const bridge = createMockBridge();
		const mm = new MutationManager(bridge as unknown as MockBridge);
		await mm.execute(makeMutation('Card'));
		const cb = vi.fn();
		mm.subscribe(cb);

		await mm.undo();

		expect(cb).toHaveBeenCalledTimes(1);
	});

	it('undoes in LIFO order (last in, first out)', async () => {
		const bridge = createMockBridge();
		const mm = new MutationManager(bridge as unknown as MockBridge);
		const m1 = makeMutation('First');
		const m2 = makeMutation('Second');

		await mm.execute(m1);
		await mm.execute(m2);

		// Undo second mutation first
		const history = mm.getHistory();
		const lastMutation = history[history.length - 1];
		expect(lastMutation).toBe(m2);

		await mm.undo();
		// m2 undone, m1 still in history
		expect(mm.getHistory()).toHaveLength(1);
		expect(mm.getHistory()[0]).toBe(m1);
	});
});

// ---------------------------------------------------------------------------
// redo()
// ---------------------------------------------------------------------------

describe('MutationManager.redo()', () => {
	it('returns false when redo stack is empty', async () => {
		const bridge = createMockBridge();
		const mm = new MutationManager(bridge as unknown as MockBridge);

		const result = await mm.redo();

		expect(result).toBe(false);
	});

	it('resends forward commands after undo', async () => {
		const bridge = createMockBridge();
		const mm = new MutationManager(bridge as unknown as MockBridge);
		const m = makeMutation('Card');

		await mm.execute(m);
		await mm.undo();
		bridge.exec.mockClear();
		bridge.resetCalls();

		await mm.redo();

		expect(bridge.exec).toHaveBeenCalledTimes(1);
		const call = bridge.getCalls()[0]!;
		expect(call.payload).toMatchObject({ sql: expect.stringMatching(/INSERT INTO cards/i) });
	});

	it('pops from redo stack and pushes back to history', async () => {
		const bridge = createMockBridge();
		const mm = new MutationManager(bridge as unknown as MockBridge);
		await mm.execute(makeMutation('Card'));
		await mm.undo();

		expect(mm.canRedo()).toBe(true);
		expect(mm.getHistory()).toHaveLength(0);

		await mm.redo();

		expect(mm.canRedo()).toBe(false);
		expect(mm.getHistory()).toHaveLength(1);
	});

	it('returns true when redo succeeds', async () => {
		const bridge = createMockBridge();
		const mm = new MutationManager(bridge as unknown as MockBridge);
		await mm.execute(makeMutation('Card'));
		await mm.undo();

		const result = await mm.redo();

		expect(result).toBe(true);
	});

	it('sets dirty = true', async () => {
		const bridge = createMockBridge();
		const mm = new MutationManager(bridge as unknown as MockBridge);
		await mm.execute(makeMutation('Card'));
		await mm.undo();
		mm.clearDirty();

		await mm.redo();

		expect(mm.isDirty()).toBe(true);
	});

	it('notifies subscribers', async () => {
		const bridge = createMockBridge();
		const mm = new MutationManager(bridge as unknown as MockBridge);
		await mm.execute(makeMutation('Card'));
		await mm.undo();
		const cb = vi.fn();
		mm.subscribe(cb);

		await mm.redo();

		expect(cb).toHaveBeenCalledTimes(1);
	});
});

// ---------------------------------------------------------------------------
// canUndo() / canRedo()
// ---------------------------------------------------------------------------

describe('MutationManager.canUndo() / canRedo()', () => {
	it('canUndo() returns false when history is empty', () => {
		const bridge = createMockBridge();
		const mm = new MutationManager(bridge as unknown as MockBridge);
		expect(mm.canUndo()).toBe(false);
	});

	it('canUndo() returns true after execute()', async () => {
		const bridge = createMockBridge();
		const mm = new MutationManager(bridge as unknown as MockBridge);
		await mm.execute(makeMutation('Card'));
		expect(mm.canUndo()).toBe(true);
	});

	it('canRedo() returns false initially', () => {
		const bridge = createMockBridge();
		const mm = new MutationManager(bridge as unknown as MockBridge);
		expect(mm.canRedo()).toBe(false);
	});

	it('canRedo() returns true after undo', async () => {
		const bridge = createMockBridge();
		const mm = new MutationManager(bridge as unknown as MockBridge);
		await mm.execute(makeMutation('Card'));
		await mm.undo();
		expect(mm.canRedo()).toBe(true);
	});

	it('canRedo() returns false after new execute clears redo stack', async () => {
		const bridge = createMockBridge();
		const mm = new MutationManager(bridge as unknown as MockBridge);
		await mm.execute(makeMutation('Card A'));
		await mm.undo();
		expect(mm.canRedo()).toBe(true);

		await mm.execute(makeMutation('Card B'));
		expect(mm.canRedo()).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// isDirty() / clearDirty()
// ---------------------------------------------------------------------------

describe('MutationManager.isDirty() / clearDirty()', () => {
	it('isDirty() returns false initially', () => {
		const bridge = createMockBridge();
		const mm = new MutationManager(bridge as unknown as MockBridge);
		expect(mm.isDirty()).toBe(false);
	});

	it('clearDirty() resets dirty to false', async () => {
		const bridge = createMockBridge();
		const mm = new MutationManager(bridge as unknown as MockBridge);
		await mm.execute(makeMutation('Card'));
		expect(mm.isDirty()).toBe(true);

		mm.clearDirty();

		expect(mm.isDirty()).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// subscribe() / unsubscribe
// ---------------------------------------------------------------------------

describe('MutationManager.subscribe()', () => {
	it('returns unsubscribe function', async () => {
		const bridge = createMockBridge();
		const mm = new MutationManager(bridge as unknown as MockBridge);
		const cb = vi.fn();
		const unsub = mm.subscribe(cb);

		expect(typeof unsub).toBe('function');
	});

	it('unsubscribed callback is not called', async () => {
		const bridge = createMockBridge();
		const mm = new MutationManager(bridge as unknown as MockBridge);
		const cb = vi.fn();
		const unsub = mm.subscribe(cb);

		unsub();
		await mm.execute(makeMutation('Card'));

		expect(cb).not.toHaveBeenCalled();
	});

	it('multiple subscribers all get notified', async () => {
		const bridge = createMockBridge();
		const mm = new MutationManager(bridge as unknown as MockBridge);
		const cb1 = vi.fn();
		const cb2 = vi.fn();
		mm.subscribe(cb1);
		mm.subscribe(cb2);

		await mm.execute(makeMutation('Card'));

		expect(cb1).toHaveBeenCalledTimes(1);
		expect(cb2).toHaveBeenCalledTimes(1);
	});
});

// ---------------------------------------------------------------------------
// getHistory()
// ---------------------------------------------------------------------------

describe('MutationManager.getHistory()', () => {
	it('returns empty readonly array initially', () => {
		const bridge = createMockBridge();
		const mm = new MutationManager(bridge as unknown as MockBridge);
		const history = mm.getHistory();
		expect(history).toHaveLength(0);
		expect(Object.isFrozen(history) || Array.isArray(history)).toBe(true);
	});

	it('returns snapshot of current history', async () => {
		const bridge = createMockBridge();
		const mm = new MutationManager(bridge as unknown as MockBridge);
		const m1 = makeMutation('Card 1');
		const m2 = makeMutation('Card 2');

		await mm.execute(m1);
		await mm.execute(m2);

		const history = mm.getHistory();
		expect(history).toHaveLength(2);
		expect(history[0]).toBe(m1);
		expect(history[1]).toBe(m2);
	});
});

// ---------------------------------------------------------------------------
// History depth cap
// ---------------------------------------------------------------------------

describe('History depth cap', () => {
	it('caps history at 100 entries', async () => {
		const bridge = createMockBridge();
		const mm = new MutationManager(bridge as unknown as MockBridge);

		// Execute 101 mutations
		for (let i = 0; i < 101; i++) {
			await mm.execute(makeMutation(`Card ${i}`));
		}

		expect(mm.getHistory()).toHaveLength(100);
	});

	it('removes oldest entry when at capacity', async () => {
		const bridge = createMockBridge();
		const mm = new MutationManager(bridge as unknown as MockBridge);
		const firstMutation = makeMutation('First Card');
		await mm.execute(firstMutation);

		// Fill to 100 total
		for (let i = 1; i < 100; i++) {
			await mm.execute(makeMutation(`Card ${i}`));
		}
		expect(mm.getHistory()[0]).toBe(firstMutation);

		// 101st mutation pushes out the first
		await mm.execute(makeMutation('Card 100'));

		expect(mm.getHistory()).toHaveLength(100);
		expect(mm.getHistory()[0]).not.toBe(firstMutation);
	});

	it('logs console.warn when history overflows', async () => {
		const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const bridge = createMockBridge();
		const mm = new MutationManager(bridge as unknown as MockBridge);

		for (let i = 0; i <= 100; i++) {
			await mm.execute(makeMutation(`Card ${i}`));
		}

		expect(warnSpy).toHaveBeenCalled();
		warnSpy.mockRestore();
	});
});
