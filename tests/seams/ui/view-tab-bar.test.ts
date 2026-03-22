/**
 * Isometry v6.1 — Phase 82 Seam: ViewTabBar -> PAFVProvider
 *
 * Tests that ViewTabBar click events correctly propagate through the onSwitch
 * callback to PAFVProvider.setViewType(), that ARIA attributes update correctly,
 * and that LATCH-GRAPH family round-trips preserve axis state via structuredClone
 * suspension. SuperGrid round-trips restore schema-aware defaults.
 *
 * Requirements: VTAB-01, VTAB-02
 */

import { JSDOM } from 'jsdom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Database } from '../../../src/database/Database';
import type { ViewType } from '../../../src/providers/types';
import { ViewTabBar } from '../../../src/ui/ViewTabBar';
import { makeProviders, type ProviderStack } from '../../harness/makeProviders';
import { realDb } from '../../harness/realDb';

// ---------------------------------------------------------------------------
// Utility: flush coordinator cycle
// ---------------------------------------------------------------------------

/**
 * Flush microtasks (provider self-notify via queueMicrotask) then advance
 * timers past the coordinator's 16ms setTimeout.
 */
async function flushCoordinatorCycle(): Promise<void> {
	await Promise.resolve();
	await Promise.resolve();
	vi.advanceTimersByTime(20);
	await Promise.resolve();
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Phase 82 ViewTabBar -> PAFVProvider Seam', () => {
	let db: Database;
	let providers: ProviderStack;
	let container: HTMLElement;

	beforeEach(async () => {
		vi.useFakeTimers();
		db = await realDb();
		providers = makeProviders(db);
		const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
		global.document = dom.window.document as unknown as Document;
		container = document.createElement('div');
		document.body.appendChild(container);
	});

	afterEach(() => {
		providers.coordinator.destroy();
		db.close();
		vi.useRealTimers();
		container.remove();
		delete (global as any).document;
	});

	// -------------------------------------------------------------------------
	// VTAB-01: Tab click sets PAFVProvider viewType and fires coordinator
	// -------------------------------------------------------------------------

	describe('VTAB-01: tab click sets PAFVProvider viewType and fires coordinator', () => {
		it('tab click triggers PAFVProvider.setViewType', () => {
			new ViewTabBar({
				container,
				onSwitch: (vt: ViewType) => providers.pafv.setViewType(vt),
				mountTarget: container,
			});

			// Find the Grid button by textContent
			const nav = container.querySelector('nav.view-tab-bar');
			expect(nav).toBeTruthy();
			const buttons = Array.from(nav!.querySelectorAll('button[role="tab"]'));
			const gridBtn = buttons.find((b) => b.textContent?.trim() === 'Grid') as HTMLButtonElement;
			expect(gridBtn).toBeTruthy();

			gridBtn.click();

			expect(providers.pafv.getState().viewType).toBe('grid');
		});

		it('coordinator fires notification after tab click', async () => {
			const coordinatorSpy = vi.fn();
			providers.coordinator.subscribe(coordinatorSpy);

			new ViewTabBar({
				container,
				onSwitch: (vt: ViewType) => providers.pafv.setViewType(vt),
				mountTarget: container,
			});

			const nav = container.querySelector('nav.view-tab-bar');
			const buttons = Array.from(nav!.querySelectorAll('button[role="tab"]'));
			const networkBtn = buttons.find((b) => b.textContent?.trim() === 'Network') as HTMLButtonElement;
			networkBtn.click();

			await flushCoordinatorCycle();

			expect(coordinatorSpy).toHaveBeenCalled();
		});

		it('multiple tab clicks update viewType correctly', () => {
			new ViewTabBar({
				container,
				onSwitch: (vt: ViewType) => providers.pafv.setViewType(vt),
				mountTarget: container,
			});

			const nav = container.querySelector('nav.view-tab-bar')!;
			const buttons = Array.from(nav.querySelectorAll('button[role="tab"]'));

			const calendarBtn = buttons.find((b) => b.textContent?.trim() === 'Calendar') as HTMLButtonElement;
			calendarBtn.click();
			expect(providers.pafv.getState().viewType).toBe('calendar');

			const timelineBtn = buttons.find((b) => b.textContent?.trim() === 'Timeline') as HTMLButtonElement;
			timelineBtn.click();
			expect(providers.pafv.getState().viewType).toBe('timeline');

			const listBtn = buttons.find((b) => b.textContent?.trim() === 'List') as HTMLButtonElement;
			listBtn.click();
			expect(providers.pafv.getState().viewType).toBe('list');
		});
	});

	// -------------------------------------------------------------------------
	// VTAB-02: ARIA attributes and family round-trip
	// -------------------------------------------------------------------------

	describe('VTAB-02: ARIA attributes and family round-trip', () => {
		it('active tab has aria-selected=true, others have aria-selected=false', () => {
			const tabBar = new ViewTabBar({
				container,
				onSwitch: (vt: ViewType) => providers.pafv.setViewType(vt),
				mountTarget: container,
			});

			tabBar.setActive('grid');

			const nav = container.querySelector('nav.view-tab-bar')!;
			const buttons = Array.from(nav.querySelectorAll('button[role="tab"]'));

			const gridBtn = buttons.find((b) => b.textContent?.trim() === 'Grid');
			expect(gridBtn?.getAttribute('aria-selected')).toBe('true');

			// All other tabs must have aria-selected='false'
			const otherBtns = buttons.filter((b) => b.textContent?.trim() !== 'Grid');
			for (const btn of otherBtns) {
				expect(btn.getAttribute('aria-selected')).toBe('false');
			}
		});

		it('setActive updates roving tabindex', () => {
			const tabBar = new ViewTabBar({
				container,
				onSwitch: (vt: ViewType) => providers.pafv.setViewType(vt),
				mountTarget: container,
			});

			tabBar.setActive('kanban');

			const nav = container.querySelector('nav.view-tab-bar')!;
			const buttons = Array.from(nav.querySelectorAll('button[role="tab"]'));

			const kanbanBtn = buttons.find((b) => b.textContent?.trim() === 'Kanban');
			const listBtn = buttons.find((b) => b.textContent?.trim() === 'List');

			expect(kanbanBtn?.getAttribute('tabindex')).toBe('0');
			expect(listBtn?.getAttribute('tabindex')).toBe('-1');
		});

		it('LATCH-to-GRAPH round-trip preserves axis state via suspension', () => {
			// Start on 'list' (LATCH family)
			providers.pafv.setViewType('list');
			providers.pafv.setXAxis({ field: 'name', direction: 'desc' });

			// Capture state before GRAPH transition
			const before = providers.pafv.getState();
			expect(before.xAxis).toEqual({ field: 'name', direction: 'desc' });

			// Switch to 'network' (GRAPH family)
			providers.pafv.setViewType('network');
			const graphState = providers.pafv.getState();
			expect(graphState.viewType).toBe('network');
			// GRAPH defaults have no xAxis — confirm it differs from LATCH state
			expect(graphState.xAxis).toBeNull();

			// Switch back to 'list' (LATCH family)
			providers.pafv.setViewType('list');
			const restored = providers.pafv.getState();

			// Axis state must be restored from suspension
			expect(restored.xAxis).toEqual(before.xAxis);
		});

		it('grid-to-tree-to-grid round-trip restores groupBy', () => {
			// Start on 'grid' (LATCH family)
			providers.pafv.setViewType('grid');
			providers.pafv.setGroupBy({ field: 'status', direction: 'asc' });

			const before = providers.pafv.getState();
			expect(before.groupBy).toEqual({ field: 'status', direction: 'asc' });

			// Switch to 'tree' (GRAPH family)
			providers.pafv.setViewType('tree');
			expect(providers.pafv.getState().viewType).toBe('tree');

			// Switch back to 'grid' (LATCH family)
			providers.pafv.setViewType('grid');
			const restored = providers.pafv.getState();

			// groupBy must be restored from suspension
			expect(restored.groupBy).toEqual(before.groupBy);
		});

		it('SuperGrid-to-GRAPH-to-SuperGrid round-trip restores colAxes and rowAxes', () => {
			// Start on 'supergrid' (LATCH family) — activates _getSupergridDefaults()
			providers.pafv.setViewType('supergrid');

			const before = providers.pafv.getState();
			// SuperGrid defaults: colAxes = [card_type asc], rowAxes = [folder asc]
			expect(before.colAxes.length).toBeGreaterThan(0);
			expect(before.rowAxes.length).toBeGreaterThan(0);

			// Switch to 'network' (GRAPH family)
			providers.pafv.setViewType('network');
			expect(providers.pafv.getState().viewType).toBe('network');

			// Switch back to 'supergrid' (LATCH family)
			providers.pafv.setViewType('supergrid');
			const restored = providers.pafv.getState();

			// colAxes and rowAxes must be restored from suspension
			expect(restored.colAxes).toEqual(before.colAxes);
			expect(restored.rowAxes).toEqual(before.rowAxes);
		});
	});
});
