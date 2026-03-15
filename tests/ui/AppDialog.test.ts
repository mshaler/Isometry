// @vitest-environment jsdom
// Isometry v5 — Phase 84 Plan 03
// Behavioral tests for AppDialog: non-blocking in-app dialog primitive.
//
// Requirements: WA3

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AppDialog } from '../../src/ui/AppDialog';

// jsdom does not implement HTMLDialogElement.showModal() — polyfill it so the
// dialog is visible (open attribute) and focusable in the test environment.
function polyfillDialog(el: HTMLElement): void {
	if (typeof (el as HTMLDialogElement).showModal !== 'function') {
		(el as HTMLDialogElement).showModal = function () {
			this.setAttribute('open', '');
		};
	}
	if (typeof (el as HTMLDialogElement).close !== 'function') {
		(el as HTMLDialogElement).close = function () {
			this.removeAttribute('open');
		};
	}
}

// Patch document.createElement to auto-polyfill <dialog> elements in jsdom
const originalCreateElement = document.createElement.bind(document);
beforeEach(() => {
	document.createElement = function <K extends keyof HTMLElementTagNameMap>(
		tagName: K,
		options?: ElementCreationOptions,
	): HTMLElementTagNameMap[K] {
		const el = originalCreateElement(tagName, options);
		if (tagName === 'dialog') {
			polyfillDialog(el as HTMLElement);
		}
		return el;
	} as typeof document.createElement;
});

afterEach(() => {
	document.createElement = originalCreateElement;
	// Remove any leftover dialogs from the body
	document.body.querySelectorAll('dialog').forEach((d) => d.remove());
});

describe('AppDialog', () => {
	it('resolves true when Confirm button is clicked', async () => {
		const promise = AppDialog.show({
			variant: 'confirm',
			title: 'Test',
			message: 'Are you sure?',
		});

		const confirmBtn = document.body.querySelector<HTMLButtonElement>(
			'.app-dialog__btn--confirm',
		);
		expect(confirmBtn).not.toBeNull();
		confirmBtn!.click();

		const result = await promise;
		expect(result).toBe(true);
	});

	it('resolves false when Cancel button is clicked', async () => {
		const promise = AppDialog.show({
			variant: 'confirm',
			title: 'Test',
			message: 'Are you sure?',
		});

		const cancelBtn = document.body.querySelector<HTMLButtonElement>(
			'.app-dialog__btn--cancel',
		);
		expect(cancelBtn).not.toBeNull();
		cancelBtn!.click();

		const result = await promise;
		expect(result).toBe(false);
	});

	it('resolves false when Escape key is pressed', async () => {
		const promise = AppDialog.show({
			variant: 'confirm',
			title: 'Test',
			message: 'Are you sure?',
		});

		const dialog = document.body.querySelector<HTMLDialogElement>('dialog.app-dialog');
		expect(dialog).not.toBeNull();

		const escapeEvent = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
		dialog!.dispatchEvent(escapeEvent);

		const result = await promise;
		expect(result).toBe(false);
	});

	it('removes dialog element from DOM after resolution', async () => {
		const promise = AppDialog.show({
			variant: 'info',
			title: 'Notice',
			message: 'FYI.',
		});

		// Should be in DOM while pending
		expect(document.body.querySelector('.app-dialog')).not.toBeNull();

		const confirmBtn = document.body.querySelector<HTMLButtonElement>(
			'.app-dialog__btn--confirm',
		);
		confirmBtn!.click();
		await promise;

		// Should be gone after resolution
		expect(document.body.querySelector('.app-dialog')).toBeNull();
	});
});
