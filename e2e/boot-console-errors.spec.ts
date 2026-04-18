/**
 * Isometry — E2E: Boot Console Error Guard
 *
 * Catches runtime errors that only appear in the production bundle:
 *   - TDZ (temporal dead zone) from bundler module reordering
 *   - Undefined lookups from stale persisted state
 *   - Init-ordering crashes (e.g., panelManager null during dock callback)
 *
 * Runs against the production build (`npm run build:native`) — the same bundle
 * that Xcode serves via WKWebView. Vitest dev mode uses ESM transforms with
 * different module init order, so these errors are invisible in unit tests.
 *
 * For each view type: boots the app, switches to that view, and asserts
 * zero console errors. This catches the class of bug where supergrid works
 * in dev but crashes in production due to a forward-declared variable TDZ.
 */

import { test, expect } from './fixtures';

const VIEW_TYPES = [
	'list',
	'gallery',
	'kanban',
	'grid',
	'supergrid',
	'timeline',
	'network',
	'tree',
	'calendar',
] as const;

test.describe('Boot console error guard: no JS errors during view switch', () => {
	for (const viewType of VIEW_TYPES) {
		test(`${viewType} — zero console errors on switch`, async ({ page, baselineCardCount }) => {
			expect(baselineCardCount).toBeGreaterThan(0);

			// Collect console errors during the view switch
			const errors: string[] = [];
			page.on('console', (msg) => {
				if (msg.type() === 'error') {
					errors.push(msg.text());
				}
			});
			page.on('pageerror', (err) => {
				errors.push(err.message);
			});

			// Switch to this view type
			await page.evaluate(
				async (vt) => {
					const { viewManager, viewFactory } = (window as any).__isometry;
					const factory = viewFactory[vt];
					if (!factory) throw new Error(`viewFactory["${vt}"] is undefined`);
					await viewManager.switchTo(vt, () => factory());
				},
				viewType,
			);

			// Wait for async rendering (fetchData, coordinator subscription, rAF)
			await page.waitForTimeout(1000);

			// Assert zero console errors
			const relevant = errors.filter(
				(e) =>
					// Ignore benign warnings that aren't bugs
					!e.includes('[vite]') &&
					!e.includes('favicon'),
			);
			expect(relevant, `Console errors during ${viewType} boot:\n${relevant.join('\n')}`).toHaveLength(0);
		});
	}
});
