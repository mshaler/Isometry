// @vitest-environment jsdom
// Isometry v5 — Phase 46 Plan 02 (Task 1)
// Tests for ActionToast: brief bottom-center feedback notifications for undo/redo.
//
// Requirements: STAB-04
// TDD Phase: RED → GREEN → REFACTOR

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ActionToast } from '../../src/ui/ActionToast';

describe('ActionToast', () => {
	let container: HTMLDivElement;
	let toast: ActionToast;

	beforeEach(() => {
		vi.useFakeTimers();
		container = document.createElement('div');
		document.body.appendChild(container);
		toast = new ActionToast(container);
	});

	afterEach(() => {
		toast.destroy();
		container.remove();
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	it('creates element with action-toast class and aria-live polite', () => {
		const el = container.querySelector('.action-toast');
		expect(el).not.toBeNull();
		expect(el!.getAttribute('aria-live')).toBe('polite');
	});

	it('show() adds is-visible class and sets text', () => {
		toast.show('Undid: Move card to Done');

		const el = container.querySelector('.action-toast')!;
		expect(el.classList.contains('is-visible')).toBe(true);
		expect(el.textContent).toBe('Undid: Move card to Done');
	});

	it('auto-dismisses after 2 seconds', () => {
		toast.show('Undid: Delete card');

		const el = container.querySelector('.action-toast')!;
		expect(el.classList.contains('is-visible')).toBe(true);

		vi.advanceTimersByTime(2000);
		expect(el.classList.contains('is-visible')).toBe(false);
	});

	it('show() while visible resets timer and updates text', () => {
		toast.show('Undid: Move card');

		const el = container.querySelector('.action-toast')!;

		// Advance 1500ms (not yet dismissed)
		vi.advanceTimersByTime(1500);
		expect(el.classList.contains('is-visible')).toBe(true);

		// Show again — resets timer
		toast.show('Undid: Rename card');

		// Advance another 1500ms (3000ms total, but only 1500ms since second show)
		vi.advanceTimersByTime(1500);
		expect(el.classList.contains('is-visible')).toBe(true);
		expect(el.textContent).toBe('Undid: Rename card');

		// Advance past the second timer
		vi.advanceTimersByTime(501);
		expect(el.classList.contains('is-visible')).toBe(false);
	});

	it('dismiss() removes is-visible immediately', () => {
		toast.show('Undid: Move card');

		const el = container.querySelector('.action-toast')!;
		expect(el.classList.contains('is-visible')).toBe(true);

		toast.dismiss();
		expect(el.classList.contains('is-visible')).toBe(false);
	});

	it('destroy() removes element from DOM', () => {
		expect(container.querySelector('.action-toast')).not.toBeNull();

		toast.destroy();
		expect(container.querySelector('.action-toast')).toBeNull();
	});
});
