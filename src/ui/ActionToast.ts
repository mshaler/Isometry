// Isometry v5 — Phase 46 Plan 02
// ActionToast: brief bottom-center toast for undo/redo feedback.
//
// Requirements: STAB-04
//
// Lifecycle:
//   show(message)  -> display message, auto-dismiss after 2s
//   dismiss()      -> hide immediately
//   destroy()      -> remove element from DOM

/**
 * ActionToast displays a brief bottom-center notification confirming
 * undo/redo actions. Auto-dismisses after 2 seconds.
 *
 * Follows ImportToast pattern: CSS class toggle (.is-visible),
 * aria-live="polite" for screen readers, timer-based auto-dismiss.
 */
export class ActionToast {
	private el: HTMLDivElement;
	private dismissTimer: ReturnType<typeof setTimeout> | null = null;

	constructor(container: HTMLElement = document.body) {
		this.el = document.createElement('div');
		this.el.className = 'action-toast';
		this.el.setAttribute('aria-live', 'polite');
		container.appendChild(this.el);
	}

	/**
	 * Show a message in the toast. If already visible, resets the
	 * dismiss timer and updates the text.
	 */
	show(message: string): void {
		this.el.textContent = message;
		this.el.classList.add('is-visible');

		// Clear any existing dismiss timer
		this.clearDismissTimer();

		// Auto-dismiss after 2 seconds
		this.dismissTimer = setTimeout(() => this.dismiss(), 2000);
	}

	/** Hide the toast immediately. */
	dismiss(): void {
		this.clearDismissTimer();
		this.el.classList.remove('is-visible');
	}

	/** Remove the toast element from the DOM entirely. */
	destroy(): void {
		this.clearDismissTimer();
		this.el.remove();
	}

	// ---------------------------------------------------------------------------
	// Private helpers
	// ---------------------------------------------------------------------------

	private clearDismissTimer(): void {
		if (this.dismissTimer !== null) {
			clearTimeout(this.dismissTimer);
			this.dismissTimer = null;
		}
	}
}
