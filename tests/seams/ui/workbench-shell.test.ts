// @vitest-environment jsdom
/**
 * Isometry v6.1 — Phase 83 Plan 02
 * WorkbenchShell mount and destroy seam tests.
 *
 * Verifies that:
 *   - Constructor creates .workbench-shell with correct DOM hierarchy
 *   - Panel rail contains 5 collapsible sections
 *   - Explorer-backed sections (properties, projection, latch) start in loading state
 *   - getSectionBody(), getViewContentEl(), getTabBarSlot() return correct elements
 *   - destroy() removes .workbench-shell from DOM
 *   - collapseAll() and restoreSectionStates() correctly manage section collapse state
 *
 * Requirements: WBSH-01, WBSH-02
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CommandBarConfig } from '../../../src/ui/CommandBar';
import { WorkbenchShell } from '../../../src/ui/WorkbenchShell';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCommandBarConfig(overrides?: Partial<CommandBarConfig>): CommandBarConfig {
	return {
		onOpenPalette: vi.fn(),
		onCycleTheme: vi.fn(),
		onCycleDensity: vi.fn(),
		onToggleHelp: vi.fn(),
		getThemeLabel: () => 'Dark',
		getDensityLabel: () => 'Compact',
		...overrides,
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
		shell = new WorkbenchShell(root, { commandBarConfig: makeCommandBarConfig() });
	});

	afterEach(() => {
		shell.destroy();
		root.remove();
	});

	it('WBSH-01a: creates .workbench-shell element under root', () => {
		expect(root.querySelector('.workbench-shell')).not.toBeNull();
	});

	it('WBSH-01b: shell contains command-bar, tab-bar-slot, panel-rail, view-content', () => {
		const shellEl = root.querySelector('.workbench-shell') as HTMLElement;
		expect(shellEl.querySelector('.workbench-command-bar')).not.toBeNull();
		expect(shellEl.querySelector('.workbench-tab-bar-slot')).not.toBeNull();
		expect(shellEl.querySelector('.workbench-panel-rail')).not.toBeNull();
		expect(shellEl.querySelector('.workbench-view-content')).not.toBeNull();
	});

	it('WBSH-01c: panel rail contains exactly 5 collapsible sections', () => {
		const rail = root.querySelector('.workbench-panel-rail') as HTMLElement;
		const sections = rail.querySelectorAll('.collapsible-section');
		expect(sections).toHaveLength(5);
	});

	it('WBSH-01d: explorer-backed sections (properties, projection, latch) start in loading state', () => {
		const explorerKeys = ['properties', 'projection', 'latch'];
		for (const key of explorerKeys) {
			const sectionEl = root.querySelector(`[data-section="${key}"]`) as HTMLElement;
			expect(sectionEl, `Expected section with data-section="${key}" to exist`).not.toBeNull();
			expect(
				sectionEl.getAttribute('data-section-state'),
				`Expected section "${key}" to be in loading state`,
			).toBe('loading');
		}
	});

	it('WBSH-01e: getSectionBody("calc") returns a non-null HTMLElement', () => {
		const calcBody = shell.getSectionBody('calc');
		expect(calcBody).not.toBeNull();
		expect(calcBody).toBeInstanceOf(HTMLElement);
	});

	it('WBSH-01f: getViewContentEl() and getTabBarSlot() return distinct non-null elements inside shell', () => {
		const viewContent = shell.getViewContentEl();
		const tabBarSlot = shell.getTabBarSlot();

		expect(viewContent).not.toBeNull();
		expect(tabBarSlot).not.toBeNull();
		expect(viewContent).not.toBe(tabBarSlot);

		const shellEl = root.querySelector('.workbench-shell') as HTMLElement;
		expect(shellEl.contains(viewContent)).toBe(true);
		expect(shellEl.contains(tabBarSlot)).toBe(true);
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
		const shell = new WorkbenchShell(root, { commandBarConfig: makeCommandBarConfig() });
		expect(root.querySelector('.workbench-shell')).not.toBeNull();

		shell.destroy();

		expect(root.querySelector('.workbench-shell')).toBeNull();
	});

	it('WBSH-02b: after destroy(), saved section body reference is disconnected from document', () => {
		const shell = new WorkbenchShell(root, { commandBarConfig: makeCommandBarConfig() });
		const calcBody = shell.getSectionBody('calc');
		expect(calcBody).not.toBeNull();
		expect((calcBody as HTMLElement).isConnected).toBe(true);

		shell.destroy();

		// After destroy, the root element is removed from DOM — body is disconnected.
		// parentElement is still the (now-detached) section root, but isConnected is false.
		expect((calcBody as HTMLElement).isConnected).toBe(false);
	});

	it('WBSH-02c: collapseAll() collapses all 5 sections; getSectionStates() reports all true', () => {
		const shell = new WorkbenchShell(root, { commandBarConfig: makeCommandBarConfig() });

		shell.collapseAll();
		const states = shell.getSectionStates();

		expect(states.size).toBe(5);
		for (const [key, collapsed] of states) {
			expect(collapsed, `Expected section "${key}" to be collapsed`).toBe(true);
		}

		shell.destroy();
	});

	it('WBSH-02d: restoreSectionStates() restores specific sections; others remain unchanged', () => {
		const shell = new WorkbenchShell(root, { commandBarConfig: makeCommandBarConfig() });

		// First collapse all
		shell.collapseAll();

		// Restore calc and notebook to expanded (false = not collapsed)
		shell.restoreSectionStates(new Map([['calc', false], ['notebook', false]]));

		const states = shell.getSectionStates();

		// calc and notebook should be expanded (false)
		expect(states.get('calc')).toBe(false);
		expect(states.get('notebook')).toBe(false);

		// Others remain collapsed (true)
		expect(states.get('properties')).toBe(true);
		expect(states.get('projection')).toBe(true);
		expect(states.get('latch')).toBe(true);

		shell.destroy();
	});
});
