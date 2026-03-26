/*
 * Isometry v5 -- Phase 123 + 124
 * DirectoryDiscoverySheet: modal dialog showing discovered alto-index subdirectories.
 * Phase 124: Full import state machine (selection -> importing -> complete).
 *
 * Requirements: DISC-03, IMPT-01, IMPT-04
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

/** Progress event dispatched by NativeBridge when Swift sends native:alto-import-progress */
export interface AltoImportProgressEvent {
	dir: string;
	status: 'started' | 'complete' | 'error' | 'all-complete';
	index: number;
	total: number;
	cardCount: number;
	error?: string;
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
 * Modal dialog for alto-index directory discovery and import.
 *
 * State machine:
 *   idle -> selecting (on open) -> importing (on Import Selected click) -> complete (on all-complete)
 *
 * "Import Selected" resolves the promise with selected subdirectories, then sheet stays
 * open in importing state. updateProgress() is called by main.ts as directories complete.
 * "Keep Folder" / Escape (in selecting state) resolves with null.
 */
export class DirectoryDiscoverySheet {
	private _dialog: HTMLDialogElement | null = null;
	private _resolve: ((selected: DiscoveredSubdirectory[] | null) => void) | null = null;
	private _returnFocusEl: HTMLElement | null = null;

	// Import state machine
	private _state: 'idle' | 'selecting' | 'importing' | 'complete' = 'idle';
	private _importRows: Map<string, HTMLElement> = new Map();
	private _progressBarFill: HTMLElement | null = null;
	private _progressBar: HTMLElement | null = null;
	private _titleEl: HTMLElement | null = null;
	private _subtitleEl: HTMLElement | null = null;
	private _actionsEl: HTMLElement | null = null;
	private _completedCount = 0;
	private _totalDirs = 0;
	private _totalCards = 0;

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
	 * Update import progress. Called by main.ts when native:alto-import-progress arrives.
	 */
	updateProgress(event: AltoImportProgressEvent): void {
		if (this._state !== 'importing' && this._state !== 'complete') return;
		if (!this._dialog) return;

		if (event.status === 'all-complete') {
			this._state = 'complete';
			// Update title
			if (this._titleEl) {
				this._titleEl.textContent = 'Import Complete';
			}
			// Update subtitle
			const totalDirs = event.total > 0 ? event.total : this._totalDirs;
			if (this._subtitleEl) {
				this._subtitleEl.textContent = `${this._totalCards} cards imported from ${totalDirs} directories`;
			}
			// Fill progress bar to 100%
			if (this._progressBarFill) {
				this._progressBarFill.style.width = '100%';
			}
			if (this._progressBar) {
				this._progressBar.setAttribute('aria-valuenow', '100');
			}
			// Update close button
			if (this._actionsEl) {
				const closeBtn = this._actionsEl.querySelector('.disc-sheet__close-btn') as HTMLButtonElement | null;
				if (closeBtn) {
					closeBtn.textContent = 'Close';
					closeBtn.removeAttribute('aria-label');
				}
			}
			// Screen reader announcement
			window.dispatchEvent(
				new CustomEvent('isometry:announce', {
					detail: { message: `Import complete. ${this._totalCards} cards imported.` },
				}),
			);
			return;
		}

		const row = this._importRows.get(event.dir);
		if (!row) return;

		const statusEl = row.querySelector('.disc-import-row__status');
		const countEl = row.querySelector('.disc-import-row__count');

		if (event.status === 'started') {
			row.className = 'disc-import-row disc-import-row--active';
			row.setAttribute('aria-label', `${event.dir}: processing`);
			if (statusEl) {
				const spinner = document.createElement('span');
				spinner.className = 'disc-import-spinner';
				spinner.setAttribute('role', 'status');
				spinner.setAttribute('aria-label', 'processing');
				statusEl.replaceChildren(spinner);
			}
			if (countEl) {
				countEl.textContent = 'processing...';
			}
		} else if (event.status === 'complete') {
			this._completedCount++;
			this._totalCards += event.cardCount;
			row.className = 'disc-import-row disc-import-row--done';
			row.setAttribute('aria-label', `${event.dir}: complete, ${event.cardCount} cards`);
			if (statusEl) statusEl.textContent = '✓';
			if (countEl) countEl.textContent = `${event.cardCount} cards`;

			// Update subtitle
			if (this._subtitleEl) {
				this._subtitleEl.textContent = `${this._completedCount} of ${this._totalDirs} directories complete`;
			}
			// Update progress bar
			const pct = Math.round((this._completedCount / this._totalDirs) * 100);
			if (this._progressBarFill) {
				this._progressBarFill.style.width = `${pct}%`;
			}
			if (this._progressBar) {
				this._progressBar.setAttribute('aria-valuenow', String(pct));
			}
		} else if (event.status === 'error') {
			this._completedCount++;
			row.className = 'disc-import-row disc-import-row--error';
			row.setAttribute('aria-label', `${event.dir}: error`);
			if (statusEl) statusEl.textContent = '✗';
			if (countEl) countEl.textContent = `Failed — ${event.error ?? 'unknown error'}`;

			// Update subtitle
			if (this._subtitleEl) {
				this._subtitleEl.textContent = `${this._completedCount} of ${this._totalDirs} directories complete`;
			}
			// Update progress bar (count errors toward progress)
			const pct = Math.round((this._completedCount / this._totalDirs) * 100);
			if (this._progressBarFill) {
				this._progressBarFill.style.width = `${pct}%`;
			}
			if (this._progressBar) {
				this._progressBar.setAttribute('aria-valuenow', String(pct));
			}
		}
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

		// Reset import state
		this._state = 'selecting';
		this._importRows = new Map();
		this._progressBarFill = null;
		this._progressBar = null;
		this._titleEl = null;
		this._subtitleEl = null;
		this._actionsEl = null;
		this._completedCount = 0;
		this._totalDirs = 0;
		this._totalCards = 0;

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
		this._titleEl = titleEl;

		// Subtitle
		const subtitleEl = document.createElement('p');
		subtitleEl.id = subtitleId;
		subtitleEl.className = 'disc-sheet__subtitle';
		subtitleEl.textContent = `${payload.subdirectories.length} sources found in ${payload.rootName}`;
		subtitleEl.title = payload.rootPath; // Full path on hover
		dialog.appendChild(subtitleEl);
		this._subtitleEl = subtitleEl;

		// Track checkbox state
		const checkedState = new Map<string, boolean>();

		// Actions row
		const actionsEl = document.createElement('div');
		actionsEl.className = 'app-dialog__actions';
		this._actionsEl = actionsEl;

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
			// Toggle all button
			const toggleAllBtn = document.createElement('button');
			toggleAllBtn.type = 'button';
			toggleAllBtn.className = 'disc-sheet__toggle-all';
			toggleAllBtn.textContent = 'Deselect All'; // Default: all pre-checked
			dialog.appendChild(toggleAllBtn);

			// Directory list
			const listEl = document.createElement('ul');
			listEl.className = 'disc-sheet__list';

			// Map from name -> checkbox element for toggle all
			const checkboxMap = new Map<string, HTMLInputElement>();

			for (const sub of payload.subdirectories) {
				checkedState.set(sub.name, true); // Pre-checked

				const li = document.createElement('li');
				li.className = 'disc-row';

				// Checkbox
				const checkbox = document.createElement('input');
				checkbox.type = 'checkbox';
				checkbox.checked = true;
				checkbox.id = `disc-check-${sub.name}`;
				checkboxMap.set(sub.name, checkbox);

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

				const updateToggleAllLabel = () => {
					const allChecked = Array.from(checkedState.values()).every(Boolean);
					toggleAllBtn.textContent = allChecked ? 'Deselect All' : 'Select All';
				};

				checkbox.addEventListener('change', () => {
					checkedState.set(sub.name, checkbox.checked);
					updateConfirmState();
					updateToggleAllLabel();
				});

				// Click on row toggles checkbox (excluding direct checkbox clicks)
				li.addEventListener('click', (e) => {
					if (e.target !== checkbox) {
						checkbox.checked = !checkbox.checked;
						checkedState.set(sub.name, checkbox.checked);
						updateConfirmState();
						updateToggleAllLabel();
					}
				});

				li.appendChild(checkbox);
				li.appendChild(label);
				li.appendChild(badge);
				listEl.appendChild(li);
			}

			// Toggle all click handler
			toggleAllBtn.addEventListener('click', () => {
				const allChecked = Array.from(checkedState.values()).every(Boolean);
				const newState = !allChecked; // Deselect All -> false, Select All -> true
				for (const [name, checkbox] of checkboxMap) {
					checkbox.checked = newState;
					checkedState.set(name, newState);
				}
				toggleAllBtn.textContent = newState ? 'Deselect All' : 'Select All';
				updateConfirmState();
			});

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

			// Transition to importing state
			this._state = 'importing';
			this._totalDirs = selected.length;

			// Update title to "Importing Alto-Index Directory"
			if (this._titleEl) {
				this._titleEl.textContent = 'Importing Alto-Index Directory';
			}

			// Update subtitle with aria-live
			if (this._subtitleEl) {
				this._subtitleEl.setAttribute('aria-live', 'polite');
				this._subtitleEl.textContent = `0 of ${selected.length} directories complete`;
			}

			// Hide toggle-all button if present
			const toggleAllBtn = dialog.querySelector('.disc-sheet__toggle-all') as HTMLElement | null;
			if (toggleAllBtn) toggleAllBtn.style.display = 'none';

			// Hide directory list (checkboxes)
			const listEl = dialog.querySelector('.disc-sheet__list') as HTMLElement | null;
			if (listEl) listEl.style.display = 'none';

			// Add progress bar
			const progressBar = document.createElement('div');
			progressBar.className = 'disc-import-progress-bar';
			progressBar.setAttribute('role', 'progressbar');
			progressBar.setAttribute('aria-valuenow', '0');
			progressBar.setAttribute('aria-valuemin', '0');
			progressBar.setAttribute('aria-valuemax', '100');
			progressBar.setAttribute('aria-label', 'Import progress');
			const progressFill = document.createElement('div');
			progressFill.className = 'disc-import-progress-bar__fill';
			progressFill.style.width = '0%';
			progressBar.appendChild(progressFill);
			this._progressBar = progressBar;
			this._progressBarFill = progressFill;

			// Add import progress rows container
			const importListEl = document.createElement('div');
			importListEl.className = 'disc-import-list';

			for (const sub of selected) {
				const row = document.createElement('div');
				row.className = 'disc-import-row disc-import-row--pending';
				row.setAttribute('aria-label', `${sub.name}: pending`);

				const statusEl = document.createElement('span');
				statusEl.className = 'disc-import-row__status';
				statusEl.textContent = '·';

				const nameEl = document.createElement('span');
				nameEl.className = 'disc-import-row__name';
				nameEl.textContent = sub.name;

				const countEl = document.createElement('span');
				countEl.className = 'disc-import-row__count';
				countEl.textContent = '';

				row.appendChild(statusEl);
				row.appendChild(nameEl);
				row.appendChild(countEl);
				importListEl.appendChild(row);

				this._importRows.set(sub.name, row);
			}

			// Replace actions row content: remove cancel/confirm, add Close button
			actionsEl.innerHTML = '';
			const closeBtn = document.createElement('button');
			closeBtn.type = 'button';
			closeBtn.className = 'app-dialog__btn app-dialog__btn--confirm disc-sheet__close-btn';
			closeBtn.textContent = 'Close (import in progress)';
			closeBtn.setAttribute('aria-label', 'Close (import in progress)');
			closeBtn.addEventListener('click', () => {
				this._dialog?.close();
				this._dialog?.remove();
				this._dialog = null;
				if (this._returnFocusEl) {
					this._returnFocusEl.focus();
					this._returnFocusEl = null;
				}
			});
			actionsEl.appendChild(closeBtn);

			// Insert progress bar and import rows into dialog (before actionsEl)
			dialog.insertBefore(progressBar, actionsEl);
			dialog.insertBefore(importListEl, actionsEl);

			// Resolve the promise with selected dirs — import begins
			if (this._resolve) {
				this._resolve(selected);
				this._resolve = null;
			}
		});

		actionsEl.appendChild(cancelBtn);
		actionsEl.appendChild(confirmBtn);
		dialog.appendChild(actionsEl);

		// Keyboard: Escape closes only in selecting state
		dialog.addEventListener('keydown', (e) => {
			if (e.key === 'Escape') {
				e.preventDefault();
				if (this._state === 'selecting') {
					this._finish(null);
				}
				// Escape is ignored during importing/complete states (UI-SPEC accessibility contract)
			}
		});

		// Backdrop click closes only in selecting state
		dialog.addEventListener('click', (e) => {
			if (e.target === dialog && this._state === 'selecting') {
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
		this._state = 'idle';
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
