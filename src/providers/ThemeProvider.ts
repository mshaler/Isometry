// Isometry v5 — Phase 49 ThemeProvider
// PersistableProvider for theme state with matchMedia listener.
//
// Design:
//   - Tier 2 PersistableProvider: persists via StateManager + ui_state table
//   - 3-way toggle: 'light' | 'dark' | 'system'
//   - System mode delegates to CSS @media (prefers-color-scheme) via [data-theme="system"]
//   - matchMedia listener notifies subscribers when OS appearance changes (for system mode)
//   - FOWT prevention: removes .no-theme-transition class after first theme application
//   - resolvedTheme getter resolves 'system' to actual 'dark' or 'light' via matchMedia
//
// Requirements: THME-01, THME-03, THME-04

import type { PersistableProvider, ThemeMode } from './types';

export class ThemeProvider implements PersistableProvider {
	private _theme: ThemeMode = 'dark';
	private _subscribers: Set<() => void> = new Set();
	private _mediaQuery: MediaQueryList;
	private _onSystemChange: () => void;

	constructor() {
		this._mediaQuery =
			typeof window !== 'undefined' && window.matchMedia
				? window.matchMedia('(prefers-color-scheme: dark)')
				: ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} } as unknown as MediaQueryList);
		this._onSystemChange = () => {
			if (this._theme === 'system') {
				// CSS handles recoloring via @media block — just notify subscribers
				this._notify();
			}
		};
		this._mediaQuery.addEventListener('change', this._onSystemChange);
	}

	get theme(): ThemeMode {
		return this._theme;
	}

	/** Returns the effective visual theme ('dark' or 'light'), resolving 'system' via matchMedia. */
	get resolvedTheme(): 'dark' | 'light' {
		if (this._theme === 'system') {
			return this._mediaQuery.matches ? 'dark' : 'light';
		}
		return this._theme;
	}

	setTheme(mode: ThemeMode): void {
		if (this._theme === mode) return;
		this._theme = mode;
		this._applyTheme();
		this._notify();
	}

	private _applyTheme(): void {
		document.documentElement.setAttribute('data-theme', this._theme);
		// Remove no-theme-transition class after first theme application
		// (class was set on <html> to prevent FOWT animation)
		requestAnimationFrame(() => {
			document.documentElement.classList.remove('no-theme-transition');
		});
	}

	// PersistableProvider interface
	toJSON(): string {
		return JSON.stringify({ theme: this._theme });
	}

	setState(state: unknown): void {
		const s = state as { theme?: string };
		if (s.theme === 'light' || s.theme === 'dark' || s.theme === 'system') {
			this._theme = s.theme;
			this._applyTheme();
		}
	}

	resetToDefaults(): void {
		this._theme = 'dark';
		this._applyTheme();
	}

	// Subscribable interface
	subscribe(cb: () => void): () => void {
		this._subscribers.add(cb);
		return () => this._subscribers.delete(cb);
	}

	private _notify(): void {
		for (const cb of this._subscribers) cb();
	}

	/** Clean up matchMedia listener. Call on app teardown. */
	destroy(): void {
		this._mediaQuery.removeEventListener('change', this._onSystemChange);
	}
}
