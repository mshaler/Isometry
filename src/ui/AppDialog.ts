/*
 * Isometry v5 — Phase 84 Plan 03
 * AppDialog: lightweight non-blocking in-app dialog using native <dialog>.
 *
 * Replaces native alert()/confirm() calls with a keyboard-accessible,
 * theme-aware alternative that does not block the JS thread.
 *
 * Requirements: WA3
 */

import '../styles/app-dialog.css';

export interface AppDialogOptions {
	title: string;
	message: string;
	variant: 'info' | 'confirm';
	confirmLabel?: string;
	cancelLabel?: string;
	/** Optional variant for the confirm button. 'danger' renders the button in red. */
	confirmVariant?: 'default' | 'danger';
}

export const AppDialog = {
	/**
	 * Show an in-app dialog and resolve with the user's choice.
	 * Resolves true when the confirm/OK button is clicked.
	 * Resolves false when Cancel, Escape, or the backdrop is clicked.
	 */
	show(options: AppDialogOptions): Promise<boolean> {
		return new Promise<boolean>((resolve) => {
			const { title, message, variant, confirmLabel = 'Confirm', cancelLabel = 'Cancel', confirmVariant = 'default' } =
				options;

			// Build dialog element
			const dialog = document.createElement('dialog');
			dialog.className = 'app-dialog';
			dialog.setAttribute('aria-modal', 'true');
			dialog.setAttribute('aria-labelledby', 'app-dialog-title');
			dialog.setAttribute('aria-describedby', 'app-dialog-message');

			// Title
			const titleEl = document.createElement('h2');
			titleEl.id = 'app-dialog-title';
			titleEl.className = 'app-dialog__title';
			titleEl.textContent = title;

			// Message
			const messageEl = document.createElement('p');
			messageEl.id = 'app-dialog-message';
			messageEl.className = 'app-dialog__message';
			messageEl.textContent = message;

			// Actions row
			const actionsEl = document.createElement('div');
			actionsEl.className = 'app-dialog__actions';

			// Confirm button
			const confirmBtn = document.createElement('button');
			confirmBtn.type = 'button';
			confirmBtn.className = 'app-dialog__btn app-dialog__btn--confirm';
			if (confirmVariant === 'danger') {
				confirmBtn.classList.add('app-dialog__btn--delete');
			}
			confirmBtn.textContent = variant === 'info' ? 'OK' : confirmLabel;

			const buttons: HTMLButtonElement[] = [confirmBtn];

			// Cancel button (only for confirm variant)
			let cancelBtn: HTMLButtonElement | null = null;
			if (variant === 'confirm') {
				cancelBtn = document.createElement('button');
				cancelBtn.type = 'button';
				cancelBtn.className = 'app-dialog__btn app-dialog__btn--cancel';
				cancelBtn.textContent = cancelLabel;
				// Cancel comes first visually (left side), confirm is the primary action
				actionsEl.appendChild(cancelBtn);
				buttons.push(cancelBtn);
			}

			actionsEl.appendChild(confirmBtn);

			dialog.appendChild(titleEl);
			dialog.appendChild(messageEl);
			dialog.appendChild(actionsEl);
			document.body.appendChild(dialog);

			// Resolution helper — removes dialog and resolves promise
			const finish = (result: boolean): void => {
				cleanup();
				dialog.remove();
				resolve(result);
			};

			// Focus trap: cycle Tab/Shift-Tab between interactive elements only
			const onKeydown = (e: KeyboardEvent): void => {
				if (e.key === 'Escape') {
					e.preventDefault();
					finish(false);
					return;
				}
				if (e.key === 'Tab') {
					const focusable = buttons.filter((b) => !b.disabled);
					if (focusable.length === 0) return;
					const first: HTMLButtonElement | undefined = focusable[0];
					const last: HTMLButtonElement | undefined = focusable[focusable.length - 1];
					if (first == null || last == null) return;
					if (e.shiftKey) {
						if (document.activeElement === first) {
							e.preventDefault();
							last.focus();
						}
					} else {
						if (document.activeElement === last) {
							e.preventDefault();
							first.focus();
						}
					}
				}
			};

			// Backdrop click: click on <dialog> element itself (not its children)
			const onDialogClick = (e: MouseEvent): void => {
				if (e.target === dialog) {
					finish(false);
				}
			};

			const cleanup = (): void => {
				dialog.removeEventListener('keydown', onKeydown);
				dialog.removeEventListener('click', onDialogClick);
			};

			dialog.addEventListener('keydown', onKeydown);
			dialog.addEventListener('click', onDialogClick);

			confirmBtn.addEventListener('click', () => finish(true));
			if (cancelBtn) {
				cancelBtn.addEventListener('click', () => finish(false));
			}

			// Show the dialog and focus the primary action
			dialog.showModal();
			confirmBtn.focus();
		});
	},
};
