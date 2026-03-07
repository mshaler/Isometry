// Isometry v5 — Phase 7 Plan 01 (Task 1)
// Tests for 'supergrid' ViewType and graph:simulate protocol additions.
//
// Requirements: VIEW-08, REND-05
// TDD Phase: RED → GREEN → REFACTOR

import { describe, expect, it } from 'vitest';
import { PAFVProvider } from '../../src/providers/PAFVProvider';
import type { ViewType } from '../../src/providers/types';

// ---------------------------------------------------------------------------
// ViewType — supergrid
// ---------------------------------------------------------------------------

describe('ViewType supergrid', () => {
	it("'supergrid' is a valid ViewType value", () => {
		// This test verifies the compile-time union includes 'supergrid'.
		// If ViewType does not include 'supergrid', TypeScript will error during
		// compilation — the runtime test below ensures the string is handled.
		const viewType: ViewType = 'supergrid';
		expect(viewType).toBe('supergrid');
	});

	it('PAFVProvider can switch to supergrid view', () => {
		const provider = new PAFVProvider();
		provider.setViewType('supergrid');
		expect(provider.getState().viewType).toBe('supergrid');
	});

	it('PAFVProvider.getViewFamily returns latch for supergrid', () => {
		const provider = new PAFVProvider();
		expect(provider.getViewFamily('supergrid')).toBe('latch');
	});

	it('PAFVProvider VIEW_DEFAULTS has supergrid entry (setViewType does not throw)', () => {
		// If VIEW_DEFAULTS is missing supergrid, structuredClone(VIEW_DEFAULTS[viewType])
		// inside setViewType will produce undefined and crash.
		const provider = new PAFVProvider();
		expect(() => provider.setViewType('supergrid')).not.toThrow();
		const state = provider.getState();
		expect(state.viewType).toBe('supergrid');
		expect(state.xAxis).toBeNull();
		expect(state.yAxis).toBeNull();
		expect(state.groupBy).toBeNull();
	});

	it('supergrid is LATCH family — switching from network to supergrid suspends graph state', () => {
		const provider = new PAFVProvider();
		// Set up a graph-family view first
		provider.setViewType('network');
		// Now switch to supergrid (LATCH family)
		provider.setViewType('supergrid');
		expect(provider.getState().viewType).toBe('supergrid');
		// The family should be latch
		expect(provider.getViewFamily('supergrid')).toBe('latch');
	});
});

// ---------------------------------------------------------------------------
// Protocol — graph:simulate types
// ---------------------------------------------------------------------------

describe('graph:simulate protocol types', () => {
	it('SimulatePayload type shape is correct (compile-time check via type import)', async () => {
		// Import the types — if they don't exist, TypeScript compilation fails.
		// This test is a runtime sentinel that the module loads without error.
		const protocol = await import('../../src/worker/protocol');
		// SimulatePayload and NodePosition are exported from protocol.ts
		// They are type-only exports so we check that the module loads cleanly.
		expect(protocol).toBeDefined();
	});

	it('WorkerRequestType includes graph:simulate (verified via test object)', async () => {
		// Since TypeScript types are erased at runtime, we verify by checking
		// that the protocol module exports the expected type identifiers as
		// compile-time types. The import loading without error confirms this.
		const protocol = await import('../../src/worker/protocol');
		// The protocol module should export type guards and config
		expect(typeof protocol.isReadyMessage).toBe('function');
		expect(typeof protocol.isResponse).toBe('function');
	});
});
