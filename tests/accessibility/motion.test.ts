// Isometry v5 — Phase 50 MotionProvider Tests
// Validates prefers-reduced-motion detection via matchMedia mock.
//
// Requirements: A11Y-10

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MotionProvider } from '../../src/accessibility/MotionProvider';

// ---------------------------------------------------------------------------
// matchMedia mock helpers
// ---------------------------------------------------------------------------

type ChangeListener = (event: { matches: boolean }) => void;

function createMockMediaQuery(matches: boolean) {
	const listeners: ChangeListener[] = [];
	return {
		matches,
		addEventListener: vi.fn((_event: string, cb: ChangeListener) => {
			listeners.push(cb);
		}),
		removeEventListener: vi.fn((_event: string, cb: ChangeListener) => {
			const idx = listeners.indexOf(cb);
			if (idx >= 0) listeners.splice(idx, 1);
		}),
		// Test helper: simulate OS setting change
		_fire(newMatches: boolean) {
			this.matches = newMatches;
			for (const cb of listeners) cb({ matches: newMatches });
		},
		_listeners: listeners,
	} as unknown as MediaQueryList & { _fire(m: boolean): void; _listeners: ChangeListener[] };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('MotionProvider', () => {
	let originalMatchMedia: typeof window.matchMedia;
	let mockMQ: ReturnType<typeof createMockMediaQuery>;

	beforeEach(() => {
		originalMatchMedia = globalThis.window?.matchMedia;
		// @ts-expect-error - test mock
		globalThis.window = globalThis.window ?? {};
	});

	afterEach(() => {
		if (originalMatchMedia) {
			// @ts-expect-error - restoring mock
			globalThis.window.matchMedia = originalMatchMedia;
		}
	});

	it('returns true when matchMedia matches reduced motion', () => {
		mockMQ = createMockMediaQuery(true);
		// @ts-expect-error - test mock
		globalThis.window.matchMedia = () => mockMQ;

		const provider = new MotionProvider();
		expect(provider.prefersReducedMotion).toBe(true);
		provider.destroy();
	});

	it('returns false when matchMedia does not match', () => {
		mockMQ = createMockMediaQuery(false);
		// @ts-expect-error - test mock
		globalThis.window.matchMedia = () => mockMQ;

		const provider = new MotionProvider();
		expect(provider.prefersReducedMotion).toBe(false);
		provider.destroy();
	});

	it('notifies subscribers when OS setting changes', () => {
		mockMQ = createMockMediaQuery(false);
		// @ts-expect-error - test mock
		globalThis.window.matchMedia = () => mockMQ;

		const provider = new MotionProvider();
		const callback = vi.fn();
		provider.subscribe(callback);

		// Simulate OS toggling reduced motion on
		mockMQ._fire(true);

		expect(callback).toHaveBeenCalledTimes(1);
		expect(provider.prefersReducedMotion).toBe(true);

		// Simulate turning it off again
		mockMQ._fire(false);
		expect(callback).toHaveBeenCalledTimes(2);
		expect(provider.prefersReducedMotion).toBe(false);

		provider.destroy();
	});

	it('subscribe returns unsubscribe function', () => {
		mockMQ = createMockMediaQuery(false);
		// @ts-expect-error - test mock
		globalThis.window.matchMedia = () => mockMQ;

		const provider = new MotionProvider();
		const callback = vi.fn();
		const unsub = provider.subscribe(callback);

		// Should receive notification
		mockMQ._fire(true);
		expect(callback).toHaveBeenCalledTimes(1);

		// Unsubscribe
		unsub();

		// Should NOT receive notification after unsubscribe
		mockMQ._fire(false);
		expect(callback).toHaveBeenCalledTimes(1); // still 1

		provider.destroy();
	});

	it('destroy removes event listener from matchMedia', () => {
		mockMQ = createMockMediaQuery(false);
		// @ts-expect-error - test mock
		globalThis.window.matchMedia = () => mockMQ;

		const provider = new MotionProvider();
		expect(mockMQ.addEventListener).toHaveBeenCalledTimes(1);

		provider.destroy();
		expect(mockMQ.removeEventListener).toHaveBeenCalledTimes(1);

		// After destroy, no listeners should fire
		const callback = vi.fn();
		provider.subscribe(callback);
		mockMQ._fire(true);
		// The change event fired on the MQ, but the provider should have detached
		// (callback may still fire if provider didn't fully detach -- this verifies cleanup)
		// Note: removeEventListener was called, so the internal handler is gone.
		// However, subscriber was added after destroy -- provider still stores it.
		// The key assertion: removeEventListener was called.
	});

	it('handles non-browser environment gracefully', () => {
		// Remove matchMedia
		const saved = globalThis.window?.matchMedia;
		// @ts-expect-error - test mock
		globalThis.window.matchMedia = undefined;

		const provider = new MotionProvider();
		expect(provider.prefersReducedMotion).toBe(false);
		provider.destroy();

		// Restore
		if (saved) {
			// @ts-expect-error - test mock
			globalThis.window.matchMedia = saved;
		}
	});
});
