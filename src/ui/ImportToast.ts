// Isometry v5 — Phase 10 ImportToast Component
// Toast notification for import progress, success, and error states.
//
// Pure TypeScript class using CSS class manipulation (no D3, no framework).
// Follows existing project patterns (design-tokens, .is-visible toggle from views.css).
//
// Requirements: ETL-19 (progress reporting UI)

import type { ImportResult, ParseError } from '../etl/types';

/**
 * ImportToast displays import progress, completion, and error states
 * as a fixed-position toast notification in the top-right corner.
 *
 * Lifecycle:
 *   showProgress(...)   -> during batch imports
 *   showFinalizing()    -> when processed === total (FTS optimize running)
 *   showSuccess(result) -> after importFile() resolves
 *   showError(message)  -> on import failure
 *   dismiss()           -> hide toast
 *   destroy()           -> remove from DOM
 */
export class ImportToast {
	private el: HTMLDivElement;
	private statusEl: HTMLDivElement;
	private progressEl: HTMLDivElement;
	private errorsEl: HTMLDivElement | null = null;
	private errorsDetailEl: HTMLDivElement | null = null;
	private dismissTimer: ReturnType<typeof setTimeout> | null = null;

	constructor(container: HTMLElement = document.body) {
		this.el = document.createElement('div');
		this.el.className = 'import-toast';
		this.el.setAttribute('aria-live', 'polite');

		this.statusEl = document.createElement('div');
		this.statusEl.className = 'import-toast-status';
		this.el.appendChild(this.statusEl);

		this.progressEl = document.createElement('div');
		this.progressEl.className = 'import-toast-progress';
		this.progressEl.style.width = '0%';
		this.el.appendChild(this.progressEl);

		container.appendChild(this.el);
	}

	/**
	 * Show import progress with card count and rate.
	 * Format: "Importing... 200/500 cards (48 cards/sec)"
	 * Or with filename: "Importing notes.md... 200/500 cards (48 cards/sec)"
	 */
	showProgress(processed: number, total: number, rate: number, filename?: string): void {
		this.clearDismissTimer();
		const pct = total > 0 ? Math.round((processed / total) * 100) : 0;
		const label = filename ? `Importing ${filename}...` : 'Importing...';
		this.statusEl.textContent = `${label} ${processed}/${total} cards (${rate} cards/sec)`;
		this.progressEl.style.width = `${pct}%`;
		this.show();
	}

	/**
	 * Show finalizing state — all cards written, FTS optimize running.
	 * Format: "Importing... 100% (finalizing)"
	 */
	showFinalizing(): void {
		this.clearDismissTimer();
		this.statusEl.textContent = 'Importing... 100% (finalizing)';
		this.progressEl.style.width = '100%';
		this.show();
	}

	/**
	 * Show import success summary with card count.
	 * Format: "Imported 523 cards" or "Imported 523 cards, 3 errors"
	 * Auto-dismisses after 5 seconds.
	 */
	showSuccess(result: ImportResult): void {
		this.clearDismissTimer();
		const cardCount = result.inserted + result.updated;
		let text = `Imported ${cardCount} cards`;
		if (result.errors > 0) {
			text += `, ${result.errors} errors`;
		}
		this.statusEl.textContent = text;
		this.progressEl.style.width = '100%';

		// Add error details if present
		if (result.errors > 0 && result.errors_detail.length > 0) {
			this.addErrorDetails(result.errors_detail);
		}

		this.show();
		this.dismissTimer = setTimeout(() => this.dismiss(), 5000);
	}

	/**
	 * Show error message.
	 * Auto-dismisses after 10 seconds.
	 */
	showError(message: string): void {
		this.clearDismissTimer();
		this.statusEl.textContent = message;
		this.progressEl.style.width = '0%';
		this.show();
		this.dismissTimer = setTimeout(() => this.dismiss(), 10000);
	}

	/**
	 * Hide the toast. Removes is-visible class and cleans up error details.
	 */
	dismiss(): void {
		this.clearDismissTimer();
		this.el.classList.remove('is-visible');
		this.removeErrorDetails();
	}

	/**
	 * Remove the toast element from the DOM entirely.
	 */
	destroy(): void {
		this.clearDismissTimer();
		this.el.remove();
	}

	// ---------------------------------------------------------------------------
	// Private helpers
	// ---------------------------------------------------------------------------

	private show(): void {
		this.el.classList.add('is-visible');
	}

	private clearDismissTimer(): void {
		if (this.dismissTimer !== null) {
			clearTimeout(this.dismissTimer);
			this.dismissTimer = null;
		}
	}

	private addErrorDetails(errors: ParseError[]): void {
		this.removeErrorDetails();

		this.errorsEl = document.createElement('div');
		this.errorsEl.className = 'import-toast-errors';
		this.errorsEl.textContent = `${errors.length} error${errors.length > 1 ? 's' : ''} — click to expand`;

		this.errorsDetailEl = document.createElement('div');
		this.errorsDetailEl.className = 'import-toast-errors-detail';
		this.errorsDetailEl.innerHTML = errors
			.map((e) => `<div>${e.source_id ? `[${e.source_id}] ` : ''}${e.message}</div>`)
			.join('');

		this.errorsEl.addEventListener('click', () => {
			this.errorsDetailEl?.classList.toggle('is-expanded');
		});

		this.el.appendChild(this.errorsEl);
		this.el.appendChild(this.errorsDetailEl);
	}

	private removeErrorDetails(): void {
		this.errorsEl?.remove();
		this.errorsDetailEl?.remove();
		this.errorsEl = null;
		this.errorsDetailEl = null;
	}
}
