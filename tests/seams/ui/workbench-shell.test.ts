// @vitest-environment jsdom
/**
 * Isometry — Phase 135.2 Plan 02 (updated from Phase 86 Plan 01)
 * WorkbenchShell mount and destroy seam tests.
 *
 * Updated for panel drawer architecture:
 *   - Constructor creates .workbench-shell with correct DOM hierarchy
 *   - Shell has flat layout: .workbench-body > sidebar + panel-icon-strip + panel-drawer + ...
 *   - No panel rail — panels live in PanelDrawer
 *   - getSectionStates/restoreSectionStates are stubs for LayoutPresetManager compat
 *   - destroy() removes .workbench-shell from DOM
 *
 * Requirements: WBSH-01, WBSH-02
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CommandBarConfig } from '../../../src/ui/CommandBar';
import { PanelRegistry } from '../../../src/ui/panels/PanelRegistry';
import { WorkbenchShell } from '../../../src/ui/WorkbenchShell';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCommandBarConfig(overrides?: Partial<CommandBarConfig>): CommandBarConfig {
	return {
		onOpenPalette: vi.fn(),
		onSetTheme: vi.fn(),
		onCycleDensity: vi.fn(),
		onToggleHelp: vi.fn(),
		getTheme: () => 'dark',
		getDensityLabel: () => 'Compact',
		...overrides,
	};
}

function makeConfig() {
	return {
		commandBarConfig: makeCommandBarConfig(),
		panelRegistry: new PanelRegistry(),
		bridge: { send: (_cmd: string, _payload: unknown): Promise<unknown> => Promise.resolve(null) },
	};
}

// ---------------------------------------------------------------------------
// WBSH-01: Constructor creates correct DOM structure
// ---------------------------------------------------------------------------

describe('WBSH-01: constructor creates correct DOM structure', () => {
	let root: HTMLElement;
	let shell: WorkbenchShell;

	beforeEach(() => {
		root = document.createElement('div');
		document.body.appendChild(root);
		shell = new WorkbenchShell(root, makeConfig());
	});

	afterEach(() => {
		shell.destroy();
		root.remove();
	});

	it('WBSH-01a: creates .workbench-shell element under root', () => {
		expect(root.querySelector('.workbench-shell')).not.toBeNull();
	});

	it('WBSH-01b: shell contains command-bar, body with sidebar, panel-icon-strip, panel-drawer, view-content', () => {
		const shellEl = root.querySelector('.workbench-shell') as HTMLElement;
		expect(shellEl.querySelector('.workbench-command-bar')).not.toBeNull();
		expect(shellEl.querySelector('.workbench-body')).not.toBeNull();
		expect(shellEl.querySelector('.workbench-sidebar')).not.toBeNull();
		expect(shellEl.querySelector('.panel-icon-strip')).not.toBeNull();
		expect(shellEl.querySelector('.panel-drawer')).not.toBeNull();
		expect(shellEl.querySelector('.workbench-view-content')).not.toBeNull();
	});

	it('WBSH-01c: NO panel-rail in DOM (replaced by PanelDrawer)', () => {
		expect(root.querySelector('.workbench-panel-rail')).toBeNull();
	});

	it('WBSH-01d: data-explorer container exists and is hidden by default', () => {
		const el = shell.getDataExplorerEl();
		expect(el).not.toBeNull();
		expect(el.classList.contains('workbench-data-explorer')).toBe(true);
		expect(el.style.display).toBe('none');
	});

	it('WBSH-01e: getViewContentEl() and getSidebarEl() return distinct non-null elements inside shell', () => {
		const viewContent = shell.getViewContentEl();
		const sidebarEl = shell.getSidebarEl();

		expect(viewContent).not.toBeNull();
		expect(sidebarEl).not.toBeNull();
		expect(viewContent).not.toBe(sidebarEl);

		const shellEl = root.querySelector('.workbench-shell') as HTMLElement;
		expect(shellEl.contains(viewContent)).toBe(true);
		expect(shellEl.contains(sidebarEl)).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// WBSH-02: destroy and section state management
// ---------------------------------------------------------------------------

describe('WBSH-02: destroy and section state management', () => {
	let root: HTMLElement;

	beforeEach(() => {
		root = document.createElement('div');
		document.body.appendChild(root);
	});

	afterEach(() => {
		root.remove();
	});

	it('WBSH-02a: after destroy(), .workbench-shell is removed from root', () => {
		const shell = new WorkbenchShell(root, makeConfig());
		expect(root.querySelector('.workbench-shell')).not.toBeNull();

		shell.destroy();

		expect(root.querySelector('.workbench-shell')).toBeNull();
	});

	it('WBSH-02b: after destroy(), panel icon strip is removed from DOM', () => {
		const shell = new WorkbenchShell(root, makeConfig());
		expect(root.querySelector('.panel-icon-strip')).not.toBeNull();

		shell.destroy();

		expect(root.querySelector('.panel-icon-strip')).toBeNull();
	});

	it('WBSH-02c: getSectionStates() returns empty Map (stub for LayoutPresetManager)', () => {
		const shell = new WorkbenchShell(root, makeConfig());
		const states = shell.getSectionStates();
		expect(states).toBeInstanceOf(Map);
		expect(states.size).toBe(0);
		shell.destroy();
	});

	it('WBSH-02d: restoreSectionStates() is a no-op (does not throw)', () => {
		const shell = new WorkbenchShell(root, makeConfig());
		expect(() =>
			shell.restoreSectionStates(
				new Map([
					['calc', false],
					['notebook', false],
				]),
			),
		).not.toThrow();
		shell.destroy();
	});
});
