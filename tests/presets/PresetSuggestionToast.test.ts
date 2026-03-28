// @vitest-environment jsdom
// Tests for PresetSuggestionToast — Phase 133 Plan 03
// Covers show/dismiss lifecycle, auto-dismiss, Apply button callback, accessibility.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PresetSuggestionToast } from '../../src/presets/PresetSuggestionToast';

describe('PresetSuggestionToast', () => {
	let container: HTMLDivElement;
	let toast: PresetSuggestionToast;

	beforeEach(() => {
		vi.useFakeTimers();
		container = document.createElement('div');
		document.body.appendChild(container);
		toast = new PresetSuggestionToast(container);
	});

	afterEach(() => {
		toast.destroy();
		container.remove();
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	it('creates element with preset-suggestion-toast class in container', () => {
		const el = container.querySelector('.preset-suggestion-toast');
		expect(el).not.toBeNull();
	});

	it('has role="status" for accessibility', () => {
		const el = container.querySelector('.preset-suggestion-toast');
		expect(el!.getAttribute('role')).toBe('status');
	});

	it('has aria-live="polite"', () => {
		const el = container.querySelector('.preset-suggestion-toast');
		expect(el!.getAttribute('aria-live')).toBe('polite');
	});

	it('show() adds is-visible class', () => {
		toast.show('Writing');
		const el = container.querySelector('.preset-suggestion-toast')!;
		expect(el.classList.contains('is-visible')).toBe(true);
	});

	it('show() sets text matching UI-SPEC copy', () => {
		toast.show('Writing');
		const el = container.querySelector('.preset-suggestion-toast')!;
		expect(el.textContent).toContain('Layout preset');
		expect(el.textContent).toContain('Writing');
		expect(el.textContent).toContain('was last used here');
	});

	it('show() sets aria-label on Apply button', () => {
		toast.show('LATCH Analytics');
		const applyBtn = container.querySelector('.preset-suggestion-toast__apply');
		expect(applyBtn!.getAttribute('aria-label')).toContain('LATCH Analytics');
	});

	it('dismiss() removes is-visible class', () => {
		toast.show('Writing');
		toast.dismiss();
		const el = container.querySelector('.preset-suggestion-toast')!;
		expect(el.classList.contains('is-visible')).toBe(false);
	});

	it('auto-dismisses after 5000ms', () => {
		toast.show('Writing');
		const el = container.querySelector('.preset-suggestion-toast')!;
		expect(el.classList.contains('is-visible')).toBe(true);

		vi.advanceTimersByTime(5000);

		expect(el.classList.contains('is-visible')).toBe(false);
	});

	it('does not dismiss before 5000ms', () => {
		toast.show('Writing');
		vi.advanceTimersByTime(4999);
		const el = container.querySelector('.preset-suggestion-toast')!;
		expect(el.classList.contains('is-visible')).toBe(true);
	});

	it('clicking Apply button calls onApply callback with preset name', () => {
		const onApply = vi.fn();
		toast.setOnApply(onApply);
		toast.show('Writing');

		const applyBtn = container.querySelector('.preset-suggestion-toast__apply') as HTMLButtonElement;
		applyBtn.click();

		expect(onApply).toHaveBeenCalledTimes(1);
		expect(onApply).toHaveBeenCalledWith('Writing');
	});

	it('clicking Apply button dismisses the toast', () => {
		toast.setOnApply(vi.fn());
		toast.show('Writing');
		const applyBtn = container.querySelector('.preset-suggestion-toast__apply') as HTMLButtonElement;
		applyBtn.click();

		const el = container.querySelector('.preset-suggestion-toast')!;
		expect(el.classList.contains('is-visible')).toBe(false);
	});

	it('clicking dismiss button hides toast immediately', () => {
		toast.show('Writing');
		const dismissBtn = container.querySelector('.preset-suggestion-toast__dismiss') as HTMLButtonElement;
		dismissBtn.click();

		const el = container.querySelector('.preset-suggestion-toast')!;
		expect(el.classList.contains('is-visible')).toBe(false);
	});

	it('show() with new preset name replaces previous name', () => {
		toast.show('Writing');
		toast.show('LATCH Analytics');
		const el = container.querySelector('.preset-suggestion-toast')!;
		expect(el.textContent).toContain('LATCH Analytics');
		expect(el.textContent).not.toContain('Writing');
	});

	it('show() resets auto-dismiss timer', () => {
		toast.show('Writing');
		vi.advanceTimersByTime(3000);
		toast.show('LATCH Analytics'); // resets timer
		vi.advanceTimersByTime(3000);
		// Only 3s since second show() — should still be visible
		const el = container.querySelector('.preset-suggestion-toast')!;
		expect(el.classList.contains('is-visible')).toBe(true);
	});

	it('destroy() removes element from DOM', () => {
		toast.destroy();
		const el = container.querySelector('.preset-suggestion-toast');
		expect(el).toBeNull();
	});
});
