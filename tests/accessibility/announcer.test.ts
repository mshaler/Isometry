// @vitest-environment jsdom
// Tests for Announcer — ARIA live region for screen reader announcements
// Phase 50 Plan 02 Task 1 (TDD RED)

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Announcer } from '../../src/accessibility/Announcer';

describe('Announcer', () => {
	let container: HTMLElement;

	beforeEach(() => {
		container = document.createElement('div');
		document.body.appendChild(container);
	});

	afterEach(() => {
		container.remove();
	});

	it('creates an element with aria-live="polite" and aria-atomic="true"', () => {
		const announcer = new Announcer(container);
		const el = container.querySelector('[aria-live="polite"]');
		expect(el).not.toBeNull();
		expect(el!.getAttribute('aria-atomic')).toBe('true');
		announcer.destroy();
	});

	it('element has sr-only class for screen-reader-only visibility', () => {
		const announcer = new Announcer(container);
		const el = container.querySelector('[aria-live="polite"]');
		expect(el!.classList.contains('sr-only')).toBe(true);
		announcer.destroy();
	});

	it('announce() clears then sets textContent via requestAnimationFrame', async () => {
		const announcer = new Announcer(container);
		const el = container.querySelector('[aria-live="polite"]') as HTMLElement;

		// Mock requestAnimationFrame to execute synchronously
		const rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
			cb(0);
			return 0;
		});

		announcer.announce('Switched to Network view, 42 cards');

		// After RAF fires, text should be set
		expect(el.textContent).toBe('Switched to Network view, 42 cards');

		rafSpy.mockRestore();
		announcer.destroy();
	});

	it('announce() clears text before setting new text (ensures re-announcement)', () => {
		const announcer = new Announcer(container);
		const el = container.querySelector('[aria-live="polite"]') as HTMLElement;

		// Track textContent changes
		const textChanges: string[] = [];
		const originalDescriptor = Object.getOwnPropertyDescriptor(Node.prototype, 'textContent')!;
		Object.defineProperty(el, 'textContent', {
			set(value: string) {
				textChanges.push(value);
				originalDescriptor.set!.call(this, value);
			},
			get() {
				return originalDescriptor.get!.call(this);
			},
			configurable: true,
		});

		const rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
			cb(0);
			return 0;
		});

		announcer.announce('First message');

		// Should have cleared first (empty string), then set new text
		expect(textChanges).toContain('');
		expect(textChanges[textChanges.length - 1]).toBe('First message');

		rafSpy.mockRestore();
		announcer.destroy();
	});

	it('destroy() removes the element from the DOM', () => {
		const announcer = new Announcer(container);
		expect(container.querySelector('[aria-live="polite"]')).not.toBeNull();

		announcer.destroy();
		expect(container.querySelector('[aria-live="polite"]')).toBeNull();
	});
});
