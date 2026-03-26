// Isometry v5 — Phase 125 Plan 02
// DiffPreviewDialog: modal showing new/modified/deleted card diffs before re-import commit.
// Requirements: DSET-04

import '../styles/diff-preview.css';

export interface DiffPreviewData {
	datasetName: string;
	toInsert: Array<{ id: string; name: string }>;
	toUpdate: Array<{ id: string; name: string }>;
	deletedIds: string[];
	deletedNames: string[];
	unchanged: number;
}

export const DiffPreviewDialog = {
	/**
	 * Show diff preview modal. Resolves true if user clicks "Commit Changes",
	 * false if Cancel/Escape.
	 */
	show(data: DiffPreviewData): Promise<boolean> {
		return new Promise<boolean>((resolve) => {
			const dialog = document.createElement('dialog');
			dialog.className = 'dset-diff-modal';
			dialog.setAttribute('role', 'dialog');
			dialog.setAttribute('aria-labelledby', 'diff-modal-title');
			dialog.setAttribute('aria-modal', 'true');

			// Title
			const titleEl = document.createElement('h2');
			titleEl.id = 'diff-modal-title';
			titleEl.className = 'dset-diff-modal__title';
			titleEl.textContent = `Review Changes \u2014 ${data.datasetName}`;

			// Summary badges row
			const summaryEl = document.createElement('div');
			summaryEl.className = 'dset-diff-summary';

			const badges = [
				{ kind: 'new', count: data.toInsert.length, label: 'new' },
				{ kind: 'modified', count: data.toUpdate.length, label: 'modified' },
				{ kind: 'deleted', count: data.deletedIds.length, label: 'deleted' },
			];

			for (const b of badges) {
				const badge = document.createElement('span');
				badge.className = 'dset-diff-badge';
				badge.dataset['kind'] = b.kind;
				badge.textContent = `${b.count} ${b.label}`;
				if (b.count === 0) badge.classList.add('dset-diff-badge--zero');
				summaryEl.appendChild(badge);
			}

			// Collapsible sections
			const sectionsEl = document.createElement('div');
			sectionsEl.className = 'dset-diff-sections';

			const sections = [
				{ kind: 'new', label: 'New', count: data.toInsert.length, names: data.toInsert.map((c) => c.name) },
				{ kind: 'modified', label: 'Modified', count: data.toUpdate.length, names: data.toUpdate.map((c) => c.name) },
				{ kind: 'deleted', label: 'Deleted', count: data.deletedIds.length, names: data.deletedNames },
			];

			for (const sec of sections) {
				if (sec.count === 0) continue; // Skip empty sections entirely

				const sectionEl = document.createElement('div');
				sectionEl.className = 'dset-diff-section';
				sectionEl.dataset['kind'] = sec.kind;

				const bodyId = `diff-body-${sec.kind}`;
				const sectionId = `diff-section-${sec.kind}`;

				// Section header button
				const headerBtn = document.createElement('button');
				headerBtn.type = 'button';
				headerBtn.className = 'dset-diff-section__header';
				headerBtn.setAttribute('aria-expanded', 'false');
				headerBtn.setAttribute('aria-controls', bodyId);
				headerBtn.id = sectionId;

				const chevron = document.createElement('span');
				chevron.className = 'dset-diff-section__chevron';
				chevron.textContent = '\u25B6'; // ▶

				const labelSpan = document.createElement('span');
				labelSpan.textContent = `${sec.label} (${sec.count})`;

				headerBtn.appendChild(chevron);
				headerBtn.appendChild(labelSpan);

				// Section body (card name list)
				const bodyEl = document.createElement('ul');
				bodyEl.className = 'dset-diff-section__body';
				bodyEl.id = bodyId;
				bodyEl.setAttribute('role', 'list');

				for (const name of sec.names) {
					const li = document.createElement('li');
					li.textContent = name;
					bodyEl.appendChild(li);
				}

				// Toggle expand/collapse
				headerBtn.addEventListener('click', () => {
					const expanded = headerBtn.getAttribute('aria-expanded') === 'true';
					headerBtn.setAttribute('aria-expanded', String(!expanded));
					chevron.textContent = expanded ? '\u25B6' : '\u25BC'; // ▶ or ▼
					bodyEl.classList.toggle('is-expanded', !expanded);
				});

				sectionEl.appendChild(headerBtn);
				sectionEl.appendChild(bodyEl);
				sectionsEl.appendChild(sectionEl);
			}

			// Actions row (reuses app-dialog pattern)
			const actionsEl = document.createElement('div');
			actionsEl.className = 'app-dialog__actions';

			const cancelBtn = document.createElement('button');
			cancelBtn.type = 'button';
			cancelBtn.className = 'app-dialog__btn app-dialog__btn--cancel';
			cancelBtn.textContent = 'Cancel';

			const commitBtn = document.createElement('button');
			commitBtn.type = 'button';
			commitBtn.className = 'app-dialog__btn app-dialog__btn--confirm';
			commitBtn.textContent = 'Commit Changes';

			actionsEl.appendChild(cancelBtn);
			actionsEl.appendChild(commitBtn);

			// Assemble dialog
			dialog.appendChild(titleEl);
			dialog.appendChild(summaryEl);
			dialog.appendChild(sectionsEl);
			dialog.appendChild(actionsEl);
			document.body.appendChild(dialog);

			// Cleanup helper
			const cleanup = (result: boolean) => {
				dialog.close();
				dialog.remove();
				resolve(result);
			};

			commitBtn.addEventListener('click', () => cleanup(true));
			cancelBtn.addEventListener('click', () => cleanup(false));

			// Escape = cancel
			dialog.addEventListener('cancel', (e) => {
				e.preventDefault();
				cleanup(false);
			});

			// Backdrop click = cancel
			dialog.addEventListener('click', (e) => {
				if (e.target === dialog) cleanup(false);
			});

			dialog.showModal();

			// Focus cancel button first (safety — per UI-SPEC)
			cancelBtn.focus();
		});
	},
};
