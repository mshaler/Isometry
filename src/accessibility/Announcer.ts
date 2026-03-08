// Isometry v5 -- Phase 50 Announcer
// Centralized aria-live polite region for screen reader announcements.
//
// Design:
//   - Creates a visually-hidden div with aria-live="polite" and aria-atomic="true"
//   - announce() clears textContent then sets new text in requestAnimationFrame
//     (clearing first ensures the screen reader re-announces even if the text is identical)
//   - destroy() removes the element from the DOM
//
// Requirements: A11Y-05

/**
 * Centralized screen reader announcement region.
 *
 * Creates a visually-hidden element with `aria-live="polite"` that
 * screen readers monitor for content changes. When `announce()` is called,
 * the message is set after a `requestAnimationFrame` delay to ensure
 * the browser's accessibility tree processes the change.
 */
export class Announcer {
	private el: HTMLDivElement;

	constructor(container: HTMLElement) {
		this.el = document.createElement('div');
		this.el.className = 'sr-only';
		this.el.setAttribute('aria-live', 'polite');
		this.el.setAttribute('aria-atomic', 'true');
		container.appendChild(this.el);
	}

	/**
	 * Announce a message to screen readers.
	 *
	 * Clears existing text first (empty string), then sets new text
	 * inside a requestAnimationFrame callback. The two-step clear+set
	 * ensures re-announcement even when the new message is identical
	 * to the previous one.
	 */
	announce(message: string): void {
		// Clear first — ensures screen reader sees a change even for repeated messages
		this.el.textContent = '';
		requestAnimationFrame(() => {
			this.el.textContent = message;
		});
	}

	/**
	 * Remove the announcer element from the DOM.
	 */
	destroy(): void {
		this.el.remove();
	}
}
