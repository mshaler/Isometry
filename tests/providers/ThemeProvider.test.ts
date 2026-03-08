// Isometry v5 — Phase 49 Plan 02 (Task 1)
// Tests for ThemeProvider: theme state, persistence, matchMedia, FOWT prevention.
//
// Requirements: THME-01, THME-03, THME-04
// TDD Phase: RED -> GREEN -> REFACTOR

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider } from '../../src/providers/ThemeProvider';
import type { ThemeMode } from '../../src/providers/types';

// ---------------------------------------------------------------------------
// Mock setup for JSDOM environment
// ---------------------------------------------------------------------------

let setAttributeSpy: ReturnType<typeof vi.fn>;
let removeClassSpy: ReturnType<typeof vi.fn>;
let mockMediaQuery: {
	matches: boolean;
	addEventListener: ReturnType<typeof vi.fn>;
	removeEventListener: ReturnType<typeof vi.fn>;
};

beforeEach(() => {
	setAttributeSpy = vi.fn();
	removeClassSpy = vi.fn();

	// Mock document.documentElement (node environment has no DOM)
	vi.stubGlobal('document', {
		documentElement: {
			setAttribute: setAttributeSpy,
			classList: {
				remove: removeClassSpy,
			},
		},
	});

	// Mock requestAnimationFrame
	vi.stubGlobal('requestAnimationFrame', (cb: () => void) => cb());

	// Mock window.matchMedia via stubGlobal (node environment has no window)
	mockMediaQuery = {
		matches: false, // prefers-color-scheme: dark => matches=true means dark
		addEventListener: vi.fn(),
		removeEventListener: vi.fn(),
	};
	// In node environment, globalThis === global but there's no `window`.
	// ThemeProvider guards with `typeof window !== 'undefined' && window.matchMedia`.
	// vi.stubGlobal('window', ...) sets globalThis.window which makes `typeof window` work.
	vi.stubGlobal('window', {
		matchMedia: () => mockMediaQuery,
	});
});

afterEach(() => {
	vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
// Default state
// ---------------------------------------------------------------------------

describe('ThemeProvider — default state', () => {
	it('default theme is "dark"', () => {
		const provider = new ThemeProvider();
		expect(provider.theme).toBe('dark');
	});
});

// ---------------------------------------------------------------------------
// setTheme() — attribute application
// ---------------------------------------------------------------------------

describe('ThemeProvider.setTheme()', () => {
	it('setTheme("light") sets data-theme attribute to "light"', () => {
		const provider = new ThemeProvider();
		provider.setTheme('light');
		expect(setAttributeSpy).toHaveBeenCalledWith('data-theme', 'light');
	});

	it('setTheme("dark") sets data-theme attribute to "dark"', () => {
		const provider = new ThemeProvider();
		provider.setTheme('light'); // change away from default first
		setAttributeSpy.mockClear();
		provider.setTheme('dark');
		expect(setAttributeSpy).toHaveBeenCalledWith('data-theme', 'dark');
	});

	it('setTheme("system") sets data-theme attribute to "system"', () => {
		const provider = new ThemeProvider();
		provider.setTheme('system');
		expect(setAttributeSpy).toHaveBeenCalledWith('data-theme', 'system');
	});

	it('setTheme with same value is a no-op (no notification)', () => {
		const provider = new ThemeProvider();
		const cb = vi.fn();
		provider.subscribe(cb);
		// Default is 'dark', setting 'dark' again should be a no-op
		provider.setTheme('dark');
		expect(cb).not.toHaveBeenCalled();
		expect(setAttributeSpy).not.toHaveBeenCalled();
	});
});

// ---------------------------------------------------------------------------
// FOWT prevention — no-theme-transition removal
// ---------------------------------------------------------------------------

describe('ThemeProvider — FOWT prevention', () => {
	it('removes no-theme-transition class after first theme application', () => {
		const provider = new ThemeProvider();
		provider.setTheme('light');
		expect(removeClassSpy).toHaveBeenCalledWith('no-theme-transition');
	});
});

// ---------------------------------------------------------------------------
// Serialization (toJSON / setState / resetToDefaults)
// ---------------------------------------------------------------------------

describe('ThemeProvider serialization', () => {
	it('toJSON() serializes current theme', () => {
		const provider = new ThemeProvider();
		provider.setTheme('light');
		const json = provider.toJSON();
		expect(JSON.parse(json)).toEqual({ theme: 'light' });
	});

	it('setState() restores theme from serialized state', () => {
		const provider = new ThemeProvider();
		provider.setState({ theme: 'system' });
		expect(provider.theme).toBe('system');
		expect(setAttributeSpy).toHaveBeenCalledWith('data-theme', 'system');
	});

	it('setState() with invalid value resets to default (ignores)', () => {
		const provider = new ThemeProvider();
		provider.setTheme('light');
		setAttributeSpy.mockClear();
		// Invalid theme value — setState should ignore it, keeping current state
		provider.setState({ theme: 'invalid' });
		expect(provider.theme).toBe('light'); // unchanged
	});

	it('setState() with missing theme property ignores', () => {
		const provider = new ThemeProvider();
		provider.setTheme('light');
		provider.setState({});
		expect(provider.theme).toBe('light'); // unchanged
	});

	it('toJSON/setState round-trips correctly', () => {
		const provider = new ThemeProvider();
		provider.setTheme('system');
		const json = provider.toJSON();

		const provider2 = new ThemeProvider();
		provider2.setState(JSON.parse(json));
		expect(provider2.theme).toBe('system');
	});

	it('resetToDefaults() sets theme back to "dark"', () => {
		const provider = new ThemeProvider();
		provider.setTheme('light');
		setAttributeSpy.mockClear();
		provider.resetToDefaults();
		expect(provider.theme).toBe('dark');
		expect(setAttributeSpy).toHaveBeenCalledWith('data-theme', 'dark');
	});
});

// ---------------------------------------------------------------------------
// subscribe() pattern
// ---------------------------------------------------------------------------

describe('ThemeProvider.subscribe()', () => {
	it('notifies subscriber on theme change', () => {
		const provider = new ThemeProvider();
		const cb = vi.fn();
		provider.subscribe(cb);
		provider.setTheme('light');
		expect(cb).toHaveBeenCalledTimes(1);
	});

	it('returns unsubscribe function that works', () => {
		const provider = new ThemeProvider();
		const cb = vi.fn();
		const unsub = provider.subscribe(cb);
		unsub();
		provider.setTheme('light');
		expect(cb).not.toHaveBeenCalled();
	});

	it('multiple subscribers all notified', () => {
		const provider = new ThemeProvider();
		const cb1 = vi.fn();
		const cb2 = vi.fn();
		provider.subscribe(cb1);
		provider.subscribe(cb2);
		provider.setTheme('light');
		expect(cb1).toHaveBeenCalledTimes(1);
		expect(cb2).toHaveBeenCalledTimes(1);
	});
});

// ---------------------------------------------------------------------------
// resolvedTheme — matchMedia resolution
// ---------------------------------------------------------------------------

describe('ThemeProvider.resolvedTheme', () => {
	it('returns "dark" when theme is "dark"', () => {
		const provider = new ThemeProvider();
		expect(provider.resolvedTheme).toBe('dark');
	});

	it('returns "light" when theme is "light"', () => {
		const provider = new ThemeProvider();
		provider.setTheme('light');
		expect(provider.resolvedTheme).toBe('light');
	});

	it('returns "dark" when theme is "system" and matchMedia matches dark', () => {
		mockMediaQuery.matches = true; // prefers-color-scheme: dark
		const provider = new ThemeProvider();
		provider.setTheme('system');
		expect(provider.resolvedTheme).toBe('dark');
	});

	it('returns "light" when theme is "system" and matchMedia does not match dark', () => {
		mockMediaQuery.matches = false; // prefers-color-scheme: light
		const provider = new ThemeProvider();
		provider.setTheme('system');
		expect(provider.resolvedTheme).toBe('light');
	});
});

// ---------------------------------------------------------------------------
// matchMedia system change listener
// ---------------------------------------------------------------------------

describe('ThemeProvider — system theme changes', () => {
	it('registers matchMedia change listener on construction', () => {
		const _provider = new ThemeProvider();
		expect(mockMediaQuery.addEventListener).toHaveBeenCalledWith('change', expect.any(Function));
	});

	it('notifies subscribers on system change when theme is "system"', () => {
		const provider = new ThemeProvider();
		provider.setTheme('system');
		const cb = vi.fn();
		provider.subscribe(cb);

		// Simulate system theme change by calling the listener
		const changeHandler = mockMediaQuery.addEventListener.mock.calls[0][1] as () => void;
		cb.mockClear(); // clear notification from setTheme
		changeHandler();
		expect(cb).toHaveBeenCalledTimes(1);
	});

	it('does NOT notify subscribers on system change when theme is NOT "system"', () => {
		const provider = new ThemeProvider();
		// theme is 'dark' (default), not 'system'
		const cb = vi.fn();
		provider.subscribe(cb);

		const changeHandler = mockMediaQuery.addEventListener.mock.calls[0][1] as () => void;
		changeHandler();
		expect(cb).not.toHaveBeenCalled();
	});

	it('destroy() removes matchMedia listener', () => {
		const provider = new ThemeProvider();
		provider.destroy();
		expect(mockMediaQuery.removeEventListener).toHaveBeenCalledWith('change', expect.any(Function));
	});
});
