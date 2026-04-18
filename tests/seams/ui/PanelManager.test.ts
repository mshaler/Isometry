// @vitest-environment jsdom
/**
 * Isometry v12.0 — Phase 156 Plan 01
 * PanelManager unit tests: show/hide/toggle/group/syncSlots behaviors.
 *
 * Covers:
 *   - Test 1: show() on unshown panel calls registry.enable() + mounts into container
 *   - Test 2: show() on already-visible panel is a no-op (no re-mount)
 *   - Test 3: hide() sets display='none' but does NOT call registry.disable()
 *   - Test 4: toggle() flips visibility state
 *   - Test 5: showGroup() shows all panels in group
 *   - Test 6: hideGroup() hides all panels in group
 *   - Test 7: syncSlots callback fires after every show/hide
 *   - Test 8: isVisible() returns correct boolean
 *
 * Strategy: Use a real PanelRegistry + mock PanelHook factories to verify
 * mount-once semantics, visibility toggle, group coupling, and syncSlots.
 *
 * Requirements: BEHV-01, BEHV-02
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PanelRegistry } from '../../../src/ui/panels/PanelRegistry';
import { PanelManager } from '../../../src/ui/panels/PanelManager';
import type { PanelHook, SlotConfig, CouplingGroup } from '../../../src/ui/panels';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMockHook(): PanelHook & { mountCalls: number; destroyCalls: number } {
	return {
		mountCalls: 0,
		destroyCalls: 0,
		mount(_container: HTMLElement) {
			this.mountCalls++;
		},
		destroy() {
			this.destroyCalls++;
		},
	};
}

function makeContainer(): HTMLElement {
	const el = document.createElement('div');
	el.style.display = 'none';
	return el;
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('PanelManager', () => {
	let registry: PanelRegistry;
	let syncSlotsSpy: ReturnType<typeof vi.fn>;
	let containerA: HTMLElement;
	let containerB: HTMLElement;
	let hookA: ReturnType<typeof makeMockHook>;
	let hookB: ReturnType<typeof makeMockHook>;
	let manager: PanelManager;

	beforeEach(() => {
		registry = new PanelRegistry();
		syncSlotsSpy = vi.fn();

		containerA = makeContainer();
		containerB = makeContainer();
		hookA = makeMockHook();
		hookB = makeMockHook();

		// Register two panels
		registry.register(
			{ id: 'panel-a', name: 'Panel A', icon: '', description: '', dependencies: [], defaultEnabled: false },
			() => hookA,
		);
		registry.register(
			{ id: 'panel-b', name: 'Panel B', icon: '', description: '', dependencies: [], defaultEnabled: false },
			() => hookB,
		);

		const slots: SlotConfig[] = [
			{ id: 'panel-a', container: containerA, slot: 'top' },
			{ id: 'panel-b', container: containerB, slot: 'top' },
		];

		const groups: CouplingGroup[] = [
			{ name: 'integrate', panelIds: ['panel-a', 'panel-b'] },
		];

		manager = new PanelManager({ registry, slots, groups, syncSlots: syncSlotsSpy as () => void });
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	// -----------------------------------------------------------------------
	// Test 1: show() on unshown panel calls registry.enable() + mounts
	// -----------------------------------------------------------------------
	it('show() enables panel in registry and mounts into container on first call', () => {
		expect(registry.isEnabled('panel-a')).toBe(false);
		manager.show('panel-a');
		expect(registry.isEnabled('panel-a')).toBe(true);
		expect(hookA.mountCalls).toBe(1);
		expect(containerA.style.display).toBe('');
	});

	// -----------------------------------------------------------------------
	// Test 2: show() on already-visible panel is a no-op
	// -----------------------------------------------------------------------
	it('show() on already-visible panel does not re-mount', () => {
		manager.show('panel-a');
		expect(hookA.mountCalls).toBe(1);

		manager.show('panel-a'); // second call
		expect(hookA.mountCalls).toBe(1); // still 1 — no re-mount
	});

	// -----------------------------------------------------------------------
	// Test 3: hide() sets display='none' but does NOT call registry.disable()
	// -----------------------------------------------------------------------
	it('hide() sets display=none without calling registry.disable()', () => {
		manager.show('panel-a');
		expect(containerA.style.display).toBe('');

		const disableSpy = vi.spyOn(registry, 'disable');
		manager.hide('panel-a');

		expect(containerA.style.display).toBe('none');
		expect(disableSpy).not.toHaveBeenCalled();
		// Panel remains enabled (mounted) in registry
		expect(registry.isEnabled('panel-a')).toBe(true);
	});

	// -----------------------------------------------------------------------
	// Test 4: toggle() flips visibility state
	// -----------------------------------------------------------------------
	it('toggle() shows a hidden panel then hides it on next call', () => {
		expect(manager.isVisible('panel-a')).toBe(false);

		manager.toggle('panel-a');
		expect(manager.isVisible('panel-a')).toBe(true);
		expect(containerA.style.display).toBe('');

		manager.toggle('panel-a');
		expect(manager.isVisible('panel-a')).toBe(false);
		expect(containerA.style.display).toBe('none');
	});

	// -----------------------------------------------------------------------
	// Test 5: showGroup() shows all panels in group
	// -----------------------------------------------------------------------
	it('showGroup("integrate") shows both panel-a and panel-b', () => {
		expect(manager.isVisible('panel-a')).toBe(false);
		expect(manager.isVisible('panel-b')).toBe(false);

		manager.showGroup('integrate');

		expect(manager.isVisible('panel-a')).toBe(true);
		expect(manager.isVisible('panel-b')).toBe(true);
		expect(containerA.style.display).toBe('');
		expect(containerB.style.display).toBe('');
	});

	// -----------------------------------------------------------------------
	// Test 6: hideGroup() hides all panels in group
	// -----------------------------------------------------------------------
	it('hideGroup("integrate") hides both panel-a and panel-b', () => {
		manager.showGroup('integrate');
		manager.hideGroup('integrate');

		expect(manager.isVisible('panel-a')).toBe(false);
		expect(manager.isVisible('panel-b')).toBe(false);
		expect(containerA.style.display).toBe('none');
		expect(containerB.style.display).toBe('none');
	});

	// -----------------------------------------------------------------------
	// Test 7: syncSlots callback fires after every show/hide
	// -----------------------------------------------------------------------
	it('syncSlots callback fires after show() and hide()', () => {
		expect(syncSlotsSpy).toHaveBeenCalledTimes(0);

		manager.show('panel-a');
		expect(syncSlotsSpy).toHaveBeenCalledTimes(1);

		manager.hide('panel-a');
		expect(syncSlotsSpy).toHaveBeenCalledTimes(2);
	});

	// -----------------------------------------------------------------------
	// Test 8: isVisible() returns correct boolean
	// -----------------------------------------------------------------------
	it('isVisible() returns false initially and true after show()', () => {
		expect(manager.isVisible('panel-a')).toBe(false);
		manager.show('panel-a');
		expect(manager.isVisible('panel-a')).toBe(true);
		manager.hide('panel-a');
		expect(manager.isVisible('panel-a')).toBe(false);
	});

	// -----------------------------------------------------------------------
	// Bonus: isGroupVisible() returns true if ANY panel in group is visible
	// -----------------------------------------------------------------------
	it('isGroupVisible() returns true when at least one panel in the group is visible', () => {
		expect(manager.isGroupVisible('integrate')).toBe(false);
		manager.show('panel-a');
		expect(manager.isGroupVisible('integrate')).toBe(true);
		manager.hide('panel-a');
		expect(manager.isGroupVisible('integrate')).toBe(false);
	});

	// -----------------------------------------------------------------------
	// hide() on not-yet-shown panel is a no-op
	// -----------------------------------------------------------------------
	it('hide() on never-shown panel does not call syncSlots', () => {
		manager.hide('panel-a'); // never shown
		expect(syncSlotsSpy).not.toHaveBeenCalled();
	});

	// -----------------------------------------------------------------------
	// Phase 161 — Dismiss bar injection (LAYT-03)
	// -----------------------------------------------------------------------
	it('show() injects exactly one .panel-dismiss-bar on first mount', () => {
		manager.show('panel-a');
		const bars = containerA.querySelectorAll('.panel-dismiss-bar');
		expect(bars.length).toBe(1);
	});

	it('show() called twice does NOT inject a second dismiss bar', () => {
		manager.show('panel-a');
		manager.hide('panel-a');
		manager.show('panel-a');
		const bars = containerA.querySelectorAll('.panel-dismiss-bar');
		expect(bars.length).toBe(1);
	});

	it('clicking dismiss bar close button calls hide(id)', () => {
		manager.show('panel-a');
		expect(manager.isVisible('panel-a')).toBe(true);
		const closeBtn = containerA.querySelector('.panel-dismiss-bar__close') as HTMLElement;
		expect(closeBtn).not.toBeNull();
		closeBtn.click();
		expect(manager.isVisible('panel-a')).toBe(false);
	});
});
