/**
 * Isometry v5 — Playwright Harness Helpers
 *
 * Provides programmatic control over the HarnessShell via the window.__harness API.
 * Use these helpers in E2E tests instead of DOM interactions for plugin toggling —
 * keeps tests stable across UI redesigns and avoids DOM coupling.
 *
 * Entry point: /?harness=1 (served by the same Vite dev server as the full app)
 * Ready signal: window.__harnessReady === true (set by HarnessShell.mount())
 */

import { type Page } from '@playwright/test';

// ---------------------------------------------------------------------------
// Bootstrap: wait for harness ready
// ---------------------------------------------------------------------------

/**
 * Navigate to the harness entry point and wait for HarnessShell to mount.
 * Uses window.__harnessReady flag (set by HarnessShell after mount).
 */
export async function waitForHarnessReady(page: Page): Promise<void> {
	await page.goto('/?harness=1');
	await page.waitForFunction(
		() => (window as any).__harnessReady === true,
		{ timeout: 15_000 },
	);
}

// ---------------------------------------------------------------------------
// Plugin control — all use window.__harness programmatic API (no DOM coupling)
// ---------------------------------------------------------------------------

/**
 * Toggle a plugin on if currently off, or off if currently on.
 * Uses window.__harness programmatic API (not DOM clicks).
 */
export async function togglePlugin(page: Page, pluginId: string): Promise<void> {
	await page.evaluate((id) => {
		const h = (window as any).__harness;
		if (h.isEnabled(id)) {
			h.disable(id);
		} else {
			h.enable(id);
		}
	}, pluginId);
}

/**
 * Enable a plugin (idempotent — no-op if already enabled).
 */
export async function enablePlugin(page: Page, pluginId: string): Promise<void> {
	await page.evaluate((id) => {
		const h = (window as any).__harness;
		if (!h.isEnabled(id)) {
			h.enable(id);
		}
	}, pluginId);
}

/**
 * Disable a plugin (idempotent — no-op if already disabled).
 */
export async function disablePlugin(page: Page, pluginId: string): Promise<void> {
	await page.evaluate((id) => {
		const h = (window as any).__harness;
		if (h.isEnabled(id)) {
			h.disable(id);
		}
	}, pluginId);
}

/**
 * Get list of currently enabled plugin IDs.
 */
export async function getEnabledPlugins(page: Page): Promise<string[]> {
	return page.evaluate(() => {
		const h = (window as any).__harness;
		return h.getEnabled().map((m: any) => m.id);
	});
}
