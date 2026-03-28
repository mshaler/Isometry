// Isometry v10 — Phase 133 Plan 03
// PresetSuggestionToast: dataset-preset suggestion toast.
//
// Shown when switching to a dataset with a saved preset association.
// Provides an Apply button and auto-dismisses after 5 seconds.
//
// Requirements: PRST-05, PRST-06

import '../styles/preset-suggestion-toast.css';

export class PresetSuggestionToast {
	private el: HTMLDivElement;
	private textEl: HTMLSpanElement;
	private applyBtn: HTMLButtonElement;
	private dismissBtn: HTMLButtonElement;
	private dismissTimer: ReturnType<typeof setTimeout> | null = null;
	private _onApply: ((presetName: string) => void) | null = null;
	private _currentPreset: string | null = null;

	constructor(container: HTMLElement = document.body) {
		this.el = document.createElement('div');
		this.el.className = 'preset-suggestion-toast';
		this.el.setAttribute('role', 'status');
		this.el.setAttribute('aria-live', 'polite');

		this.textEl = document.createElement('span');
		this.textEl.className = 'preset-suggestion-toast__text';
		this.el.appendChild(this.textEl);

		this.applyBtn = document.createElement('button');
		this.applyBtn.className = 'preset-suggestion-toast__apply';
		this.applyBtn.type = 'button';
		this.applyBtn.textContent = 'Apply';
		this.applyBtn.addEventListener('click', () => {
			if (this._currentPreset && this._onApply) {
				this._onApply(this._currentPreset);
			}
			this.dismiss();
		});
		this.el.appendChild(this.applyBtn);

		this.dismissBtn = document.createElement('button');
		this.dismissBtn.className = 'preset-suggestion-toast__dismiss';
		this.dismissBtn.type = 'button';
		this.dismissBtn.textContent = '\u00D7';
		this.dismissBtn.setAttribute('aria-label', 'Dismiss');
		this.dismissBtn.addEventListener('click', () => this.dismiss());
		this.el.appendChild(this.dismissBtn);

		container.appendChild(this.el);
	}

	setOnApply(callback: (presetName: string) => void): void {
		this._onApply = callback;
	}

	show(presetName: string): void {
		this._currentPreset = presetName;
		this.textEl.textContent = `Layout preset \u201C${presetName}\u201D was last used here.`;
		this.applyBtn.setAttribute('aria-label', `Apply preset ${presetName}`);
		this.el.classList.add('is-visible');
		this.clearDismissTimer();
		this.dismissTimer = setTimeout(() => this.dismiss(), 5000);
	}

	dismiss(): void {
		this.clearDismissTimer();
		this.el.classList.remove('is-visible');
		this._currentPreset = null;
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
