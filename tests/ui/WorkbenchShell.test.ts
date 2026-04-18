// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CommandBarConfig } from '../../src/ui/CommandBar';
import { PanelRegistry } from '../../src/ui/panels/PanelRegistry';
import { WorkbenchShell } from '../../src/ui/WorkbenchShell';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createShellConfig(registry?: PanelRegistry): {
	commandBarConfig: CommandBarConfig;
	panelRegistry: PanelRegistry;
	bridge: { send(cmd: string, payload: unknown): Promise<unknown> };
} {
	return {
		commandBarConfig: {
			onMenuAction: vi.fn(),
		},
		panelRegistry: registry ?? new PanelRegistry(),
		bridge: { send: (_cmd: string, _payload: unknown) => Promise.resolve(null) },
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

	it('creates DOM in correct order: command-bar, workbench-body (sidebar + main wrapper)', () => {
		const shell = new WorkbenchShell(root, createShellConfig());
		const shellEl = root.querySelector('.workbench-shell')!;
		const children = Array.from(shellEl.children);

		// CommandBar mounts as first child (.workbench-command-bar)
		expect(children[0]!.classList.contains('workbench-command-bar')).toBe(true);
		// Body wrapper
		expect(children[1]!.classList.contains('workbench-body')).toBe(true);

		// Body contains sidebar and more columns
		const body = shellEl.querySelector('.workbench-body')!;
		const bodyChildren = Array.from(body.children);
		expect(bodyChildren[0]!.classList.contains('workbench-sidebar')).toBe(true);

		shell.destroy();
	});

	// -----------------------------------------------------------------------
	// getViewContentEl / getSidebarEl
	// -----------------------------------------------------------------------

	it('getViewContentEl() returns the .workbench-view-content element', () => {
		const shell = new WorkbenchShell(root, createShellConfig());
		const viewContent = shell.getViewContentEl();
		expect(viewContent.classList.contains('workbench-view-content')).toBe(true);
		shell.destroy();
	});

	it('getSidebarEl() returns the .workbench-sidebar element', () => {
		const shell = new WorkbenchShell(root, createShellConfig());
		const sidebar = shell.getSidebarEl();
		expect(sidebar.classList.contains('workbench-sidebar')).toBe(true);
		shell.destroy();
	});

	// -----------------------------------------------------------------------
	// Inline slot containers
	// -----------------------------------------------------------------------

	it('getTopSlotEl() returns a hidden .workbench-slot-top element', () => {
		const shell = new WorkbenchShell(root, createShellConfig());
		const el = shell.getTopSlotEl();
		expect(el).not.toBeNull();
		expect(el.classList.contains('workbench-slot-top')).toBe(true);
		expect(el.style.display).toBe('none');
		shell.destroy();
	});

	it('getBottomSlotEl() returns a hidden .workbench-slot-bottom element', () => {
		const shell = new WorkbenchShell(root, createShellConfig());
		const el = shell.getBottomSlotEl();
		expect(el).not.toBeNull();
		expect(el.classList.contains('workbench-slot-bottom')).toBe(true);
		expect(el.style.display).toBe('none');
		shell.destroy();
	});

	it('getPanelRegistry() returns the PanelRegistry instance', () => {
		const registry = new PanelRegistry();
		const shell = new WorkbenchShell(root, createShellConfig(registry));
		expect(shell.getPanelRegistry()).toBe(registry);
		shell.destroy();
	});

	// -----------------------------------------------------------------------
	// getSectionStates / restoreSectionStates (stubs for LayoutPresetManager)
	// -----------------------------------------------------------------------

	it('getSectionStates() returns an empty Map (stub for LayoutPresetManager)', () => {
		const shell = new WorkbenchShell(root, createShellConfig());
		const states = shell.getSectionStates();
		expect(states).toBeInstanceOf(Map);
		expect(states.size).toBe(0);
		shell.destroy();
	});

	it('restoreSectionStates() is a no-op (does not throw)', () => {
		const shell = new WorkbenchShell(root, createShellConfig());
		expect(() => shell.restoreSectionStates(new Map([['calc', false]]))).not.toThrow();
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

	it('destroy() removes slot containers from DOM', () => {
		const shell = new WorkbenchShell(root, createShellConfig());
		expect(root.querySelector('.workbench-slot-top')).not.toBeNull();

		shell.destroy();

		expect(root.querySelector('.workbench-slot-top')).toBeNull();
	});
});
