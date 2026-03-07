// @vitest-environment jsdom
// Isometry v5 — Phase 37 AuditOverlay Tests
// Validates toggle button, keyboard shortcut, .audit-mode class management

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
// We test AuditOverlay against a fresh AuditState per test.
// The module-level singleton is used in production; tests use DI via constructor.
import { AuditOverlay } from '../../src/audit/AuditOverlay';
import { AuditState } from '../../src/audit/AuditState';

describe('AuditOverlay', () => {
	let container: HTMLDivElement;
	let auditState: AuditState;
	let overlay: AuditOverlay;

	beforeEach(() => {
		container = document.createElement('div');
		container.id = 'app';
		document.body.appendChild(container);
		auditState = new AuditState();
		overlay = new AuditOverlay(auditState);
	});

	afterEach(() => {
		overlay.destroy();
		container.remove();
	});

	describe('mount', () => {
		it('creates a toggle button in the container', () => {
			overlay.mount(container);
			const btn = container.querySelector('.audit-toggle-btn');
			expect(btn).not.toBeNull();
			expect(btn).toBeInstanceOf(HTMLButtonElement);
		});

		it('toggle button has correct title attribute', () => {
			overlay.mount(container);
			const btn = container.querySelector('.audit-toggle-btn') as HTMLButtonElement;
			expect(btn.title).toBe('Toggle Audit Mode (Shift+A)');
		});
	});

	describe('click toggle', () => {
		it('clicking button toggles auditState.enabled', () => {
			overlay.mount(container);
			const btn = container.querySelector('.audit-toggle-btn') as HTMLButtonElement;

			expect(auditState.enabled).toBe(false);
			btn.click();
			expect(auditState.enabled).toBe(true);
			btn.click();
			expect(auditState.enabled).toBe(false);
		});

		it('container gets audit-mode class when enabled', () => {
			overlay.mount(container);
			const btn = container.querySelector('.audit-toggle-btn') as HTMLButtonElement;

			btn.click();
			expect(container.classList.contains('audit-mode')).toBe(true);
		});

		it('container loses audit-mode class when disabled', () => {
			overlay.mount(container);
			const btn = container.querySelector('.audit-toggle-btn') as HTMLButtonElement;

			btn.click(); // enable
			btn.click(); // disable
			expect(container.classList.contains('audit-mode')).toBe(false);
		});

		it('toggle button gets active class when enabled', () => {
			overlay.mount(container);
			const btn = container.querySelector('.audit-toggle-btn') as HTMLButtonElement;

			btn.click();
			expect(btn.classList.contains('active')).toBe(true);

			btn.click();
			expect(btn.classList.contains('active')).toBe(false);
		});
	});

	describe('keyboard shortcut', () => {
		it('Shift+A toggles audit mode', () => {
			overlay.mount(container);

			const event = new KeyboardEvent('keydown', {
				key: 'A',
				shiftKey: true,
				bubbles: true,
			});
			document.dispatchEvent(event);

			expect(auditState.enabled).toBe(true);
		});

		it('does not fire when target is an input element', () => {
			overlay.mount(container);

			const input = document.createElement('input');
			container.appendChild(input);

			const event = new KeyboardEvent('keydown', {
				key: 'A',
				shiftKey: true,
				bubbles: true,
			});
			// Simulate event dispatched from input
			Object.defineProperty(event, 'target', { value: input, writable: false });
			document.dispatchEvent(event);

			expect(auditState.enabled).toBe(false);
		});

		it('does not fire when target is a textarea element', () => {
			overlay.mount(container);

			const textarea = document.createElement('textarea');
			container.appendChild(textarea);

			const event = new KeyboardEvent('keydown', {
				key: 'A',
				shiftKey: true,
				bubbles: true,
			});
			Object.defineProperty(event, 'target', { value: textarea, writable: false });
			document.dispatchEvent(event);

			expect(auditState.enabled).toBe(false);
		});

		it('does not fire for lowercase a without shift', () => {
			overlay.mount(container);

			const event = new KeyboardEvent('keydown', {
				key: 'a',
				shiftKey: false,
				bubbles: true,
			});
			document.dispatchEvent(event);

			expect(auditState.enabled).toBe(false);
		});
	});

	describe('destroy', () => {
		it('removes button from DOM', () => {
			overlay.mount(container);
			expect(container.querySelector('.audit-toggle-btn')).not.toBeNull();

			overlay.destroy();
			expect(container.querySelector('.audit-toggle-btn')).toBeNull();
		});

		it('removes keyboard listener after destroy', () => {
			overlay.mount(container);
			overlay.destroy();

			const event = new KeyboardEvent('keydown', {
				key: 'A',
				shiftKey: true,
				bubbles: true,
			});
			document.dispatchEvent(event);

			expect(auditState.enabled).toBe(false);
		});
	});

	describe('state subscription', () => {
		it('updates button visual when auditState changes externally', () => {
			overlay.mount(container);
			const btn = container.querySelector('.audit-toggle-btn') as HTMLButtonElement;

			// Toggle auditState directly (not via button click)
			auditState.toggle();
			expect(btn.classList.contains('active')).toBe(true);
			expect(container.classList.contains('audit-mode')).toBe(true);

			auditState.toggle();
			expect(btn.classList.contains('active')).toBe(false);
			expect(container.classList.contains('audit-mode')).toBe(false);
		});
	});
});
