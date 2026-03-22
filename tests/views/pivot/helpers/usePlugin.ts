// Isometry v5 — Phase 104 Plan 01
// Auto-destroy test wrapper for plugin harness.
//
// usePlugin() enables a plugin and registers a Vitest afterEach hook that
// calls disable() (which triggers the plugin's destroy()) after each test.
// This eliminates manual afterEach boilerplate from every test file.
//
// Requirements: INFR-02

import { afterEach } from 'vitest';
import type { PluginHook } from '../../../../src/views/pivot/plugins/PluginTypes';
import type { PluginHarness } from './makePluginHarness';

/**
 * Enable a plugin for the current test and auto-destroy it after.
 *
 * Registers an afterEach hook that calls harness.disable(pluginId), which
 * in turn calls the plugin instance's destroy() via PluginRegistry._disableSingle.
 *
 * Returns the PluginHook instance so tests can spy on methods or call hooks
 * directly (e.g., hook.transformData(cells, ctx)).
 *
 * Uses bracket notation to access _plugins (test-only — avoids production
 * code change while exposing hook instance for direct inspection).
 */
export function usePlugin(harness: PluginHarness, pluginId: string): PluginHook {
	// Enable the plugin (creates a fresh instance from the factory)
	harness.enable(pluginId);

	// Get the instance from the private _plugins map (test-only internal access)
	// biome-ignore lint/suspicious/noExplicitAny: test-only internal access
	const entry = (harness.registry as any)._plugins.get(pluginId);
	const hook: PluginHook = entry?.instance ?? {};

	// Register auto-destroy afterEach cleanup
	afterEach(() => {
		harness.disable(pluginId);
	});

	return hook;
}
