// Isometry v5 — Phase 50 MotionProvider
// Detects prefers-reduced-motion OS setting via matchMedia.
//
// Design:
//   - Mirrors ThemeProvider's matchMedia pattern
//   - Constructor queries window.matchMedia('(prefers-reduced-motion: reduce)')
//   - Safe fallback for non-browser environments (SSR, tests)
//   - Subscribers notified on OS setting change
//   - Singleton exported from accessibility/index.ts for use in transitions.ts
//
// Requirements: A11Y-10

/**
 * Detects the OS prefers-reduced-motion setting and notifies subscribers
 * when it changes. Used by transitions.ts to skip D3 animation durations.
 *
 * Pattern mirrors ThemeProvider's matchMedia approach.
 */
export class MotionProvider {
	private _reducedMotion: boolean;
	private _subscribers: Set<() => void> = new Set();
	private _mediaQuery: MediaQueryList;
	private _onChange: () => void;

	constructor() {
		// Safe fallback for non-browser environments
		if (typeof window === 'undefined' || !window.matchMedia) {
			this._mediaQuery = {
				matches: false,
				addEventListener: () => {},
				removeEventListener: () => {},
			} as unknown as MediaQueryList;
			this._reducedMotion = false;
			this._onChange = () => {};
			return;
		}

		this._mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
		this._reducedMotion = this._mediaQuery.matches;
		this._onChange = () => {
			this._reducedMotion = this._mediaQuery.matches;
			for (const cb of this._subscribers) cb();
		};
		this._mediaQuery.addEventListener('change', this._onChange);
	}

	/** Whether the user has enabled reduced motion in OS settings. */
	get prefersReducedMotion(): boolean {
		return this._reducedMotion;
	}

	/**
	 * Subscribe to reduced motion preference changes.
	 * @returns Unsubscribe function.
	 */
	subscribe(cb: () => void): () => void {
		this._subscribers.add(cb);
		return () => this._subscribers.delete(cb);
	}

	/** Clean up matchMedia listener. Call on app teardown. */
	destroy(): void {
		this._mediaQuery.removeEventListener('change', this._onChange);
	}
}
