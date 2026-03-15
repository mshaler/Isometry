// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CommandBarConfig } from '../../src/ui/CommandBar';
import { WorkbenchShell } from '../../src/ui/WorkbenchShell';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createShellConfig(): { commandBarConfig: CommandBarConfig } {
	return {
		commandBarConfig: {
			onOpenPalette: vi.fn(),
			onCycleTheme: vi.fn(),
			onCycleDensity: vi.fn(),
			onToggleHelp: vi.fn(),
			getThemeLabel: () => 'Dark',
			getDensityLabel: () => 'Month',
		},
	};
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('WorkbenchShell', () => {
	let root: HTMLElement;

	beforeEach(() => {
		root = document.createElement('div');
		document.body.appendChild(root);
		localStorage.clear();
	});

	afterEach(() => {
		document.body.removeChild(root);
	});

	// -----------------------------------------------------------------------
	// DOM hierarchy
	// -----------------------------------------------------------------------

	it('creates .workbench-shell as child of root', () => {
		const shell = new WorkbenchShell(root, createShellConfig());
		const shellEl = root.querySelector('.workbench-shell');
		expect(shellEl).not.toBeNull();
		expect(shellEl!.parentElement).toBe(root);
		shell.destroy();
	});

	it('creates DOM in correct order: command-bar, tab-bar-slot, panel-rail, view-content', () => {
		const shell = new WorkbenchShell(root, createShellConfig());
		const shellEl = root.querySelector('.workbench-shell')!;
		const children = Array.from(shellEl.children);

		// CommandBar mounts as first child (.workbench-command-bar)
		expect(children[0]!.classList.contains('workbench-command-bar')).toBe(true);
		// Tab bar slot
		expect(children[1]!.classList.contains('workbench-tab-bar-slot')).toBe(true);
		// Panel rail
		expect(children[2]!.classList.contains('workbench-panel-rail')).toBe(true);
		// View content
		expect(children[3]!.classList.contains('workbench-view-content')).toBe(true);

		shell.destroy();
	});

	// -----------------------------------------------------------------------
	// getViewContentEl / getTabBarSlot
	// -----------------------------------------------------------------------

	it('getViewContentEl() returns the .workbench-view-content element', () => {
		const shell = new WorkbenchShell(root, createShellConfig());
		const viewContent = shell.getViewContentEl();
		expect(viewContent.classList.contains('workbench-view-content')).toBe(true);
		shell.destroy();
	});

	it('getTabBarSlot() returns the .workbench-tab-bar-slot element', () => {
		const shell = new WorkbenchShell(root, createShellConfig());
		const slot = shell.getTabBarSlot();
		expect(slot.classList.contains('workbench-tab-bar-slot')).toBe(true);
		shell.destroy();
	});

	// -----------------------------------------------------------------------
	// CollapsibleSection instances
	// -----------------------------------------------------------------------

	it('creates 5 sections in the panel rail with correct titles', () => {
		const shell = new WorkbenchShell(root, createShellConfig());
		const panelRail = root.querySelector('.workbench-panel-rail')!;
		const sections = panelRail.querySelectorAll('.collapsible-section');
		expect(sections.length).toBe(5);

		// Check section titles via data-section attribute
		const keys = Array.from(sections).map((s) => s.getAttribute('data-section'));
		expect(keys).toEqual(['notebook', 'properties', 'projection', 'latch', 'calc']);

		shell.destroy();
	});

	it('explorer-backed sections (Properties/Projection/LATCH) have no stub text', () => {
		const shell = new WorkbenchShell(root, createShellConfig());
		// No 'coming soon' stub text — explorer sections use explicit state model
		const stubs = root.querySelectorAll('.collapsible-section__stub-text');
		expect(stubs.length).toBe(0);

		const stubTexts = root.querySelectorAll('.collapsible-section__stub');
		expect(stubTexts.length).toBe(0);

		shell.destroy();
	});

	it('explorer-backed sections start in loading state (data-section-state=loading)', () => {
		const shell = new WorkbenchShell(root, createShellConfig());
		const explorerKeys = ['properties', 'projection', 'latch'];
		for (const key of explorerKeys) {
			const sectionEl = root.querySelector(`[data-section="${key}"]`);
			expect(sectionEl).not.toBeNull();
			expect(sectionEl!.getAttribute('data-section-state')).toBe('loading');
		}
		shell.destroy();
	});

	// -----------------------------------------------------------------------
	// collapseAll / getSectionStates / restoreSectionStates
	// -----------------------------------------------------------------------

	it('collapseAll() collapses all 5 sections', () => {
		const shell = new WorkbenchShell(root, createShellConfig());

		// Notebook and Calc start collapsed (defaultCollapsed: true), others expanded
		const collapsedBefore = root.querySelectorAll('.collapsible-section--collapsed');
		expect(collapsedBefore.length).toBe(2);

		shell.collapseAll();

		const collapsedAfter = root.querySelectorAll('.collapsible-section--collapsed');
		expect(collapsedAfter.length).toBe(5);

		shell.destroy();
	});

	it('getSectionStates() returns a Map of storageKey to collapsed boolean', () => {
		const shell = new WorkbenchShell(root, createShellConfig());
		const states = shell.getSectionStates();

		expect(states).toBeInstanceOf(Map);
		expect(states.size).toBe(5);
		// Notebook and Calc default to collapsed; others expanded
		expect(states.get('notebook')).toBe(true);
		expect(states.get('properties')).toBe(false);
		expect(states.get('projection')).toBe(false);
		expect(states.get('latch')).toBe(false);
		expect(states.get('calc')).toBe(true);

		shell.destroy();
	});

	it('restoreSectionStates() restores previously saved state', () => {
		const shell = new WorkbenchShell(root, createShellConfig());

		// Save default state (notebook+calc collapsed, others expanded), collapse all, restore
		const saved = shell.getSectionStates();
		shell.collapseAll();

		// Verify all collapsed
		expect(root.querySelectorAll('.collapsible-section--collapsed').length).toBe(5);

		shell.restoreSectionStates(saved);

		// Verify restored to default: notebook+calc collapsed, others expanded
		expect(root.querySelectorAll('.collapsible-section--collapsed').length).toBe(2);

		shell.destroy();
	});

	it('collapseAll/restore round-trip preserves mixed states', () => {
		const shell = new WorkbenchShell(root, createShellConfig());

		// Notebook and Calc start collapsed (defaultCollapsed: true)
		// Toggle notebook (expand it) and collapse projection via header clicks
		const sections = root.querySelectorAll('.collapsible-section__header');
		// Click notebook header to expand it (starts collapsed -> toggles to expanded)
		(sections[0] as HTMLElement).click();
		// Click projection header to collapse it (starts expanded -> toggles to collapsed)
		(sections[2] as HTMLElement).click();

		// Save mixed state: notebook expanded, properties expanded, projection collapsed, latch expanded, calc collapsed
		const mixedState = shell.getSectionStates();
		expect(mixedState.get('notebook')).toBe(false);
		expect(mixedState.get('properties')).toBe(false);
		expect(mixedState.get('projection')).toBe(true);
		expect(mixedState.get('latch')).toBe(false);
		expect(mixedState.get('calc')).toBe(true);

		// Collapse all
		shell.collapseAll();
		expect(root.querySelectorAll('.collapsible-section--collapsed').length).toBe(5);

		// Restore
		shell.restoreSectionStates(mixedState);
		const restored = shell.getSectionStates();
		expect(restored.get('notebook')).toBe(false);
		expect(restored.get('properties')).toBe(false);
		expect(restored.get('projection')).toBe(true);
		expect(restored.get('latch')).toBe(false);
		expect(restored.get('calc')).toBe(true);

		shell.destroy();
	});

	// -----------------------------------------------------------------------
	// Section state model (Phase 84-06)
	// -----------------------------------------------------------------------

	it('Properties section shows loading state (no stub text) before explorer mounts', () => {
		const shell = new WorkbenchShell(root, createShellConfig());

		// No stub text should exist — explorer sections use state model
		const allText = root.querySelector('[data-section="properties"]')?.textContent ?? '';
		expect(allText).not.toContain('coming soon');

		// Section must be in loading state
		const sectionEl = root.querySelector('[data-section="properties"]');
		expect(sectionEl?.getAttribute('data-section-state')).toBe('loading');

		// Body must NOT have the has-explorer class yet
		const body = shell.getSectionBody('properties');
		expect(body?.classList.contains('collapsible-section__body--has-explorer')).toBe(false);

		shell.destroy();
	});

	it('Properties section transitions to ready state after explorer mount', () => {
		const shell = new WorkbenchShell(root, createShellConfig());

		// Simulate explorer mounting: append element then signal ready
		const mockExplorer = document.createElement('div');
		mockExplorer.className = 'properties-explorer';
		const body = shell.getSectionBody('properties');
		body!.appendChild(mockExplorer);
		shell.setSectionState('properties', 'ready');

		// Section must reflect ready state
		const sectionEl = root.querySelector('[data-section="properties"]');
		expect(sectionEl?.getAttribute('data-section-state')).toBe('ready');

		// Body must now carry the has-explorer class
		expect(body?.classList.contains('collapsible-section__body--has-explorer')).toBe(true);

		shell.destroy();
	});

	it('ready state is stable after repeated provider notifications', () => {
		const shell = new WorkbenchShell(root, createShellConfig());

		// Transition to ready
		shell.setSectionState('properties', 'ready');

		// Call setState('ready') multiple more times (provider notifications)
		shell.setSectionState('properties', 'ready');
		shell.setSectionState('properties', 'ready');
		shell.setSectionState('properties', 'ready');

		// State must still be ready, class must still be present
		const sectionEl = root.querySelector('[data-section="properties"]');
		expect(sectionEl?.getAttribute('data-section-state')).toBe('ready');

		const body = shell.getSectionBody('properties');
		expect(body?.classList.contains('collapsible-section__body--has-explorer')).toBe(true);

		// Only one has-explorer class (not duplicated)
		const classList = Array.from(body?.classList ?? []);
		const hasExplorerCount = classList.filter((c) => c === 'collapsible-section__body--has-explorer').length;
		expect(hasExplorerCount).toBe(1);

		shell.destroy();
	});

	// -----------------------------------------------------------------------
	// getSectionBody (Phase 55)
	// -----------------------------------------------------------------------

	it('getSectionBody("properties") returns a valid HTMLElement', () => {
		const shell = new WorkbenchShell(root, createShellConfig());
		const body = shell.getSectionBody('properties');
		expect(body).not.toBeNull();
		expect(body).toBeInstanceOf(HTMLElement);
		expect(body!.classList.contains('collapsible-section__body')).toBe(true);
		shell.destroy();
	});

	it('getSectionBody("projection") returns a valid HTMLElement', () => {
		const shell = new WorkbenchShell(root, createShellConfig());
		const body = shell.getSectionBody('projection');
		expect(body).not.toBeNull();
		expect(body).toBeInstanceOf(HTMLElement);
		shell.destroy();
	});

	it('getSectionBody("nonexistent") returns null', () => {
		const shell = new WorkbenchShell(root, createShellConfig());
		const body = shell.getSectionBody('nonexistent');
		expect(body).toBeNull();
		shell.destroy();
	});

	it('getSectionBody returns different elements for different keys', () => {
		const shell = new WorkbenchShell(root, createShellConfig());
		const properties = shell.getSectionBody('properties');
		const projection = shell.getSectionBody('projection');
		expect(properties).not.toBeNull();
		expect(projection).not.toBeNull();
		expect(properties).not.toBe(projection);
		shell.destroy();
	});

	// -----------------------------------------------------------------------
	// destroy
	// -----------------------------------------------------------------------

	it('destroy() removes .workbench-shell from the DOM', () => {
		const shell = new WorkbenchShell(root, createShellConfig());
		expect(root.querySelector('.workbench-shell')).not.toBeNull();

		shell.destroy();

		expect(root.querySelector('.workbench-shell')).toBeNull();
	});

	it('destroy() cleans up all child sections', () => {
		const shell = new WorkbenchShell(root, createShellConfig());
		expect(root.querySelectorAll('.collapsible-section').length).toBe(5);

		shell.destroy();

		expect(root.querySelectorAll('.collapsible-section').length).toBe(0);
	});
});
