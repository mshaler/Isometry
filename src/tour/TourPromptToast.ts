// Isometry v5 — Phase 134 Plan 02
// TourPromptToast: opt-in tour prompt toast shown after first-ever import.
//
// Requirements: TOUR-06

import '../styles/tour.css';

export class TourPromptToast {
	private el: HTMLDivElement;
	private dismissTimer: ReturnType<typeof setTimeout> | null = null;
	private _onStartTour: (() => void) | null = null;

	constructor(container: HTMLElement = document.body) {
		this.el = document.createElement('div');
		this.el.className = 'tour-prompt-toast';
		this.el.setAttribute('role', 'status');
		this.el.setAttribute('aria-live', 'polite');

		const textEl = document.createElement('span');
		textEl.className = 'tour-prompt-toast__text';
		textEl.textContent = 'New here? Take a quick tour.';
		this.el.appendChild(textEl);

		const startBtn = document.createElement('button');
		startBtn.className = 'tour-prompt-toast__action--start';
		startBtn.type = 'button';
		startBtn.textContent = 'Start Tour';
		startBtn.addEventListener('click', () => {
			this._onStartTour?.();
			this.dismiss();
		});
		this.el.appendChild(startBtn);

		const dismissBtn = document.createElement('button');
		dismissBtn.className = 'tour-prompt-toast__action--dismiss';
		dismissBtn.type = 'button';
		dismissBtn.textContent = 'Dismiss';
		dismissBtn.addEventListener('click', () => this.dismiss());
		this.el.appendChild(dismissBtn);

		container.appendChild(this.el);
	}

	setOnStartTour(callback: () => void): void {
		this._onStartTour = callback;
	}

	show(): void {
		this.el.classList.add('is-visible');
		this.clearDismissTimer();
		this.dismissTimer = setTimeout(() => this.dismiss(), 8000);
	}

	dismiss(): void {
		this.clearDismissTimer();
		this.el.classList.remove('is-visible');
	}

	destroy(): void {
		this.clearDismissTimer();
		this.el.remove();
	}

	private clearDismissTimer(): void {
		if (this.dismissTimer !== null) {
			clearTimeout(this.dismissTimer);
			this.dismissTimer = null;
		}
	}
}
