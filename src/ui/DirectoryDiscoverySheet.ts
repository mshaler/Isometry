/*
 * Isometry v5 -- Phase 123
 * DirectoryDiscoverySheet: modal dialog showing discovered alto-index subdirectories.
 *
 * Requirements: DISC-03
 */

import '../styles/directory-discovery.css';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DiscoveredSubdirectory {
	name: string;
	cardType: string;
	path: string;
}

export interface AltoDiscoveryPayload {
	rootPath: string;
	rootName: string;
	subdirectories: DiscoveredSubdirectory[];
}

/** Badge color mapping: subdirectory name -> CSS data-type attribute value */
const BADGE_TYPE_MAP: Record<string, string> = {
	notes: 'notes',
	contacts: 'contacts',
	calendar: 'calendar',
	messages: 'messages',
	books: 'books',
	calls: 'calls',
	'safari-history': 'safari-history',
	kindle: 'kindle',
	reminders: 'reminders',
	'safari-bookmarks': 'safari-bookmarks',
	'voice-memos': 'voice-memos',
};

// ---------------------------------------------------------------------------
// DirectoryDiscoverySheet
// ---------------------------------------------------------------------------

/**
 * Modal dialog for alto-index directory discovery.
 * Opens via .open(payload), renders discovered subdirectories with checkboxes.
 * "Import Selected" resolves with selected subdirectories.
 * "Keep Folder" / Escape resolves with null.
 */
export class DirectoryDiscoverySheet {
	private _dialog: HTMLDialogElement | null = null;
	private _resolve: ((selected: DiscoveredSubdirectory[] | null) => void) | null = null;
	private _returnFocusEl: HTMLElement | null = null;

	/**
	 * Open the discovery sheet and return selected subdirectories, or null if dismissed.
	 */
	open(payload: AltoDiscoveryPayload, returnFocusEl?: HTMLElement): Promise<DiscoveredSubdirectory[] | null> {
		return new Promise((resolve) => {
			this._resolve = resolve;
			this._returnFocusEl = returnFocusEl ?? null;
			this._render(payload);
		});
	}

	/**
	 * Programmatically close the sheet (called by bridge on re-open).
	 */
	close(): void {
		this._finish(null);
	}

	// -----------------------------------------------------------------------
	// Private
	// -----------------------------------------------------------------------

	private _render(payload: AltoDiscoveryPayload): void {
		// Clean up any existing dialog
		if (this._dialog) {
			this._dialog.remove();
			this._dialog = null;
		}

		const dialog = document.createElement('dialog');
		dialog.className = 'disc-sheet';
		dialog.setAttribute('aria-modal', 'true');

		const titleId = 'disc-sheet-title';
		const subtitleId = 'disc-sheet-subtitle';
		dialog.setAttribute('aria-labelledby', titleId);
		dialog.setAttribute('aria-describedby', subtitleId);

		// Title
		const titleEl = document.createElement('h2');
		titleEl.id = titleId;
		titleEl.className = 'disc-sheet__title';
		titleEl.textContent = 'Import Alto-Index Directory';
		dialog.appendChild(titleEl);

		// Subtitle
		const subtitleEl = document.createElement('p');
		subtitleEl.id = subtitleId;
		subtitleEl.className = 'disc-sheet__subtitle';
		subtitleEl.textContent = `${payload.subdirectories.length} sources found in ${payload.rootName}`;
		subtitleEl.title = payload.rootPath; // Full path on hover
		dialog.appendChild(subtitleEl);

		// Track checkbox state
		const checkedState = new Map<string, boolean>();

		// Actions row
		const actionsEl = document.createElement('div');
		actionsEl.className = 'app-dialog__actions';

		// Keep Folder button (cancel)
		const cancelBtn = document.createElement('button');
		cancelBtn.type = 'button';
		cancelBtn.className = 'app-dialog__btn app-dialog__btn--cancel';
		cancelBtn.textContent = 'Keep Folder';
		cancelBtn.addEventListener('click', () => this._finish(null));

		// Import Selected button (confirm)
		const confirmBtn = document.createElement('button');
		confirmBtn.type = 'button';
		confirmBtn.className = 'app-dialog__btn app-dialog__btn--confirm';
		confirmBtn.textContent = 'Import Selected';

		if (payload.subdirectories.length === 0) {
			// Empty state
			const emptyEl = document.createElement('div');
			emptyEl.className = 'disc-sheet__empty';

			const emptyHeading = document.createElement('h3');
			emptyHeading.className = 'disc-sheet__empty-heading';
			emptyHeading.textContent = 'No Sources Found';
			emptyEl.appendChild(emptyHeading);

			const emptyBody = document.createElement('p');
			emptyBody.textContent =
				'The selected folder contains no recognized alto-index subdirectories. Choose a different folder.';
			emptyEl.appendChild(emptyBody);

			dialog.appendChild(emptyEl);

			// Disable Import Selected
			confirmBtn.disabled = true;
			confirmBtn.setAttribute('aria-disabled', 'true');
			confirmBtn.style.opacity = '0.5';
			confirmBtn.style.cursor = 'not-allowed';
		} else {
			// Directory list
			const listEl = document.createElement('ul');
			listEl.className = 'disc-sheet__list';

			for (const sub of payload.subdirectories) {
				checkedState.set(sub.name, true); // Pre-checked

				const li = document.createElement('li');
				li.className = 'disc-row';

				// Checkbox
				const checkbox = document.createElement('input');
				checkbox.type = 'checkbox';
				checkbox.checked = true;
				checkbox.id = `disc-check-${sub.name}`;

				// Label wraps name for accessibility
				const label = document.createElement('label');
				label.setAttribute('for', checkbox.id);
				label.className = 'disc-row__name';
				label.textContent = sub.name;

				// Badge
				const badge = document.createElement('span');
				badge.className = 'disc-row__badge';
				badge.setAttribute('data-type', BADGE_TYPE_MAP[sub.name] ?? sub.name);
				badge.textContent = sub.name;

				checkbox.addEventListener('change', () => {
					checkedState.set(sub.name, checkbox.checked);
					updateConfirmState();
				});

				// Click on row toggles checkbox (excluding direct checkbox clicks)
				li.addEventListener('click', (e) => {
					if (e.target !== checkbox) {
						checkbox.checked = !checkbox.checked;
						checkedState.set(sub.name, checkbox.checked);
						updateConfirmState();
					}
				});

				li.appendChild(checkbox);
				li.appendChild(label);
				li.appendChild(badge);
				listEl.appendChild(li);
			}

			dialog.appendChild(listEl);
		}

		// Update confirm button state based on checked rows
		const updateConfirmState = () => {
			const anyChecked = Array.from(checkedState.values()).some(Boolean);
			confirmBtn.disabled = !anyChecked;
			confirmBtn.setAttribute('aria-disabled', String(!anyChecked));
			confirmBtn.style.opacity = anyChecked ? '1' : '0.5';
			confirmBtn.style.cursor = anyChecked ? 'pointer' : 'not-allowed';
		};

		confirmBtn.addEventListener('click', () => {
			if (confirmBtn.disabled) return;
			const selected = payload.subdirectories.filter((sub) => checkedState.get(sub.name) === true);
			this._finish(selected);
		});

		actionsEl.appendChild(cancelBtn);
		actionsEl.appendChild(confirmBtn);
		dialog.appendChild(actionsEl);

		// Keyboard: Escape closes
		dialog.addEventListener('keydown', (e) => {
			if (e.key === 'Escape') {
				e.preventDefault();
				this._finish(null);
			}
		});

		// Backdrop click closes
		dialog.addEventListener('click', (e) => {
			if (e.target === dialog) {
				this._finish(null);
			}
		});

		this._dialog = dialog;
		document.body.appendChild(dialog);
		dialog.showModal();

		// Focus the confirm button (or cancel if disabled)
		if (confirmBtn.disabled) {
			cancelBtn.focus();
		} else {
			confirmBtn.focus();
		}
	}

	private _finish(result: DiscoveredSubdirectory[] | null): void {
		if (this._dialog) {
			this._dialog.close();
			this._dialog.remove();
			this._dialog = null;
		}
		// Return focus to the CTA that opened the sheet
		if (this._returnFocusEl) {
			this._returnFocusEl.focus();
			this._returnFocusEl = null;
		}
		if (this._resolve) {
			this._resolve(result);
			this._resolve = null;
		}
	}
}
