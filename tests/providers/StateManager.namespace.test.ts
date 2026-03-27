// Isometry v10.0 — Phase 130 StateManager Namespace Tests
// Tests for per-dataset ui_state key namespacing, flat-key migration, preset prefix guard,
// and setActiveDataset() dataset switch behavior.
//
// Requirements: FNDX-01, FNDX-03

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StateManager } from '../../src/providers/StateManager';
import type { PersistableProvider } from '../../src/providers/types';
import type { WorkerBridge } from '../../src/worker/WorkerBridge';

// ---------------------------------------------------------------------------
// Mock factories (mirrors StateManager.test.ts patterns)
// ---------------------------------------------------------------------------

function makeBridgeMock(uiGetAllResult: Array<{ key: string; value: string; updated_at: string }> = []): {
	bridge: WorkerBridge;
	sendMock: ReturnType<typeof vi.fn>;
} {
	const sendMock = vi.fn().mockImplementation((type: string) => {
		if (type === 'ui:getAll') {
			return Promise.resolve(uiGetAllResult);
		}
		return Promise.resolve(undefined);
	});

	const bridge = { send: sendMock } as unknown as WorkerBridge;
	return { bridge, sendMock };
}

function makeProviderMock(jsonValue: string = '{"state":"default"}'): {
	provider: PersistableProvider;
	toJSONMock: ReturnType<typeof vi.fn>;
	setStateMock: ReturnType<typeof vi.fn>;
	resetToDefaultsMock: ReturnType<typeof vi.fn>;
} {
	const toJSONMock = vi.fn(() => jsonValue);
	const setStateMock = vi.fn();
	const resetToDefaultsMock = vi.fn();

	const provider: PersistableProvider = {
		toJSON: toJSONMock,
		setState: setStateMock,
		resetToDefaults: resetToDefaultsMock,
	};

	return { provider, toJSONMock, setStateMock, resetToDefaultsMock };
}

// ---------------------------------------------------------------------------
// registerProvider preset guard
// ---------------------------------------------------------------------------

describe('StateManager.registerProvider() — preset guard', () => {
	it('throws when key starts with "preset:"', () => {
		const { bridge } = makeBridgeMock();
		const { provider } = makeProviderMock();
		const sm = new StateManager(bridge);

		expect(() => sm.registerProvider('preset:foo', provider)).toThrow('preset:');
	});

	it('throws when key is exactly "preset:"', () => {
		const { bridge } = makeBridgeMock();
		const { provider } = makeProviderMock();
		const sm = new StateManager(bridge);

		expect(() => sm.registerProvider('preset:', provider)).toThrow('preset:');
	});

	it('does NOT throw for key "pafv" (no preset prefix)', () => {
		const { bridge } = makeBridgeMock();
		const { provider } = makeProviderMock();
		const sm = new StateManager(bridge);

		expect(() => sm.registerProvider('pafv', provider, { scoped: true })).not.toThrow();
	});
});

// ---------------------------------------------------------------------------
// registerProvider scoped/global distinction
// ---------------------------------------------------------------------------

describe('StateManager.registerProvider() — scoped vs global', () => {
	it('stores scoped provider when options.scoped = true', async () => {
		// scoped provider: persist key should include dataset id
		const { bridge, sendMock } = makeBridgeMock();
		const { provider, toJSONMock } = makeProviderMock('{"x":1}');
		const sm = new StateManager(bridge, 0);
		sm.registerProvider('pafv', provider, { scoped: true });
		sm.initActiveDataset('ds1');

		await sm.persist('pafv');

		expect(sendMock).toHaveBeenCalledWith('ui:set', { key: 'pafv:ds1', value: '{"x":1}' });
		expect(toJSONMock).toHaveBeenCalledTimes(1);
	});

	it('stores global provider when no options provided', async () => {
		// global provider: persist key should be flat (no dataset id)
		const { bridge, sendMock } = makeBridgeMock();
		const { provider, toJSONMock } = makeProviderMock('{"theme":"dark"}');
		const sm = new StateManager(bridge, 0);
		sm.registerProvider('theme', provider);
		sm.initActiveDataset('ds1');

		await sm.persist('theme');

		expect(sendMock).toHaveBeenCalledWith('ui:set', { key: 'theme', value: '{"theme":"dark"}' });
		expect(toJSONMock).toHaveBeenCalledTimes(1);
	});
});

// ---------------------------------------------------------------------------
// markDirty — namespaced storage key
// ---------------------------------------------------------------------------

describe('StateManager.markDirty() — namespace-aware storage keys', () => {
	beforeEach(() => vi.useFakeTimers());
	afterEach(() => vi.useRealTimers());

	it('uses namespaced key for scoped provider', async () => {
		const { bridge, sendMock } = makeBridgeMock();
		const { provider } = makeProviderMock('{"data":42}');
		const sm = new StateManager(bridge, 100);
		sm.registerProvider('pafv', provider, { scoped: true });
		sm.initActiveDataset('ds1');

		sm.markDirty('pafv');
		await vi.runAllTimersAsync();

		expect(sendMock).toHaveBeenCalledWith('ui:set', { key: 'pafv:ds1', value: '{"data":42}' });
	});

	it('uses flat key for global provider', async () => {
		const { bridge, sendMock } = makeBridgeMock();
		const { provider } = makeProviderMock('{"theme":"light"}');
		const sm = new StateManager(bridge, 100);
		sm.registerProvider('theme', provider);
		sm.initActiveDataset('ds1');

		sm.markDirty('theme');
		await vi.runAllTimersAsync();

		expect(sendMock).toHaveBeenCalledWith('ui:set', { key: 'theme', value: '{"theme":"light"}' });
	});
});

// ---------------------------------------------------------------------------
// restore() — namespace-aware matching
// ---------------------------------------------------------------------------

describe('StateManager.restore() — scoped provider matches namespaced rows', () => {
	it('restores scoped provider from namespaced row matching active dataset', async () => {
		const rows = [
			{ key: 'pafv:ds1', value: '{"x":1}', updated_at: '' },
			{ key: 'pafv:ds2', value: '{"x":2}', updated_at: '' },
		];
		const { bridge } = makeBridgeMock(rows);
		const { provider, setStateMock } = makeProviderMock();
		const sm = new StateManager(bridge);
		sm.registerProvider('pafv', provider, { scoped: true });
		sm.initActiveDataset('ds1');

		await sm.restore();

		expect(setStateMock).toHaveBeenCalledTimes(1);
		expect(setStateMock).toHaveBeenCalledWith({ x: 1 });
	});

	it('does NOT restore scoped provider from another dataset row', async () => {
		const rows = [{ key: 'pafv:ds2', value: '{"x":2}', updated_at: '' }];
		const { bridge } = makeBridgeMock(rows);
		const { provider, setStateMock } = makeProviderMock();
		const sm = new StateManager(bridge);
		sm.registerProvider('pafv', provider, { scoped: true });
		sm.initActiveDataset('ds1');

		await sm.restore();

		expect(setStateMock).not.toHaveBeenCalled();
	});

	it('restores global provider from flat key row regardless of active dataset', async () => {
		const rows = [{ key: 'theme', value: '{"theme":"dark"}', updated_at: '' }];
		const { bridge } = makeBridgeMock(rows);
		const { provider, setStateMock } = makeProviderMock();
		const sm = new StateManager(bridge);
		sm.registerProvider('theme', provider);
		sm.initActiveDataset('ds1');

		await sm.restore();

		expect(setStateMock).toHaveBeenCalledTimes(1);
		expect(setStateMock).toHaveBeenCalledWith({ theme: 'dark' });
	});
});

// ---------------------------------------------------------------------------
// restore() — flat key migration
// ---------------------------------------------------------------------------

describe('StateManager.restore() — flat key migration', () => {
	it('migrates flat key to namespaced key when flat key found for scoped provider', async () => {
		const rows = [{ key: 'pafv', value: '{"rowAxes":[]}', updated_at: '' }];
		const { bridge, sendMock } = makeBridgeMock(rows);
		const { provider, setStateMock } = makeProviderMock();
		const sm = new StateManager(bridge);
		sm.registerProvider('pafv', provider, { scoped: true });
		sm.initActiveDataset('ds1');

		await sm.restore();

		// Should write namespaced key
		expect(sendMock).toHaveBeenCalledWith('ui:set', { key: 'pafv:ds1', value: '{"rowAxes":[]}' });
		// Should delete flat key
		expect(sendMock).toHaveBeenCalledWith('ui:delete', { key: 'pafv' });
		// Should restore the state
		expect(setStateMock).toHaveBeenCalledTimes(1);
		expect(setStateMock).toHaveBeenCalledWith({ rowAxes: [] });
	});

	it('does NOT re-migrate when namespaced key already exists', async () => {
		const rows = [{ key: 'pafv:ds1', value: '{"rowAxes":[]}', updated_at: '' }];
		const { bridge, sendMock } = makeBridgeMock(rows);
		const { provider } = makeProviderMock();
		const sm = new StateManager(bridge);
		sm.registerProvider('pafv', provider, { scoped: true });
		sm.initActiveDataset('ds1');

		await sm.restore();

		// No ui:set (migration write) or ui:delete calls
		expect(sendMock).not.toHaveBeenCalledWith(
			'ui:set',
			expect.objectContaining({ key: 'pafv:ds1' }),
		);
		expect(sendMock).not.toHaveBeenCalledWith('ui:delete', expect.anything());
	});
});

// ---------------------------------------------------------------------------
// setActiveDataset()
// ---------------------------------------------------------------------------

describe('StateManager.setActiveDataset()', () => {
	it('persists scoped provider state for old dataset before switching', async () => {
		const rows = [
			{ key: 'pafv:ds1', value: '{"x":1}', updated_at: '' },
			{ key: 'pafv:ds2', value: '{"x":2}', updated_at: '' },
		];
		const { bridge, sendMock } = makeBridgeMock(rows);
		const { provider, toJSONMock } = makeProviderMock('{"x":99}');
		const sm = new StateManager(bridge);
		sm.registerProvider('pafv', provider, { scoped: true });
		sm.initActiveDataset('ds1');

		// Switch dataset
		await sm.setActiveDataset('ds2');

		// Should persist ds1 state
		expect(sendMock).toHaveBeenCalledWith('ui:set', { key: 'pafv:ds1', value: '{"x":99}' });
		expect(toJSONMock).toHaveBeenCalled();
	});

	it('resets scoped providers before restoring new dataset state', async () => {
		const rows = [{ key: 'pafv:ds2', value: '{"x":2}', updated_at: '' }];
		const { bridge } = makeBridgeMock(rows);
		const { provider, setStateMock, resetToDefaultsMock } = makeProviderMock('{"x":1}');
		const sm = new StateManager(bridge);
		sm.registerProvider('pafv', provider, { scoped: true });
		sm.initActiveDataset('ds1');

		await sm.setActiveDataset('ds2');

		// resetToDefaults called before setState
		expect(resetToDefaultsMock).toHaveBeenCalled();
		expect(setStateMock).toHaveBeenCalledWith({ x: 2 });

		// Verify order: reset before set
		const resetOrder = resetToDefaultsMock.mock.invocationCallOrder[0]!;
		const setOrder = setStateMock.mock.invocationCallOrder[0]!;
		expect(resetOrder).toBeLessThan(setOrder);
	});

	it('does NOT persist/restore global provider state during dataset switch', async () => {
		const rows: Array<{ key: string; value: string; updated_at: string }> = [];
		const { bridge, sendMock } = makeBridgeMock(rows);
		const { provider: globalProvider, toJSONMock, setStateMock, resetToDefaultsMock } = makeProviderMock('{"theme":"dark"}');
		const sm = new StateManager(bridge);
		sm.registerProvider('theme', globalProvider); // global
		sm.initActiveDataset('ds1');

		await sm.setActiveDataset('ds2');

		// global provider should not be persisted, reset, or restored during switch
		expect(toJSONMock).not.toHaveBeenCalled();
		expect(resetToDefaultsMock).not.toHaveBeenCalled();
		expect(setStateMock).not.toHaveBeenCalled();
	});

	it('does not persist when switching from null (initial dataset set)', async () => {
		const rows: Array<{ key: string; value: string; updated_at: string }> = [];
		const { bridge, sendMock } = makeBridgeMock(rows);
		const { provider, toJSONMock } = makeProviderMock('{"x":1}');
		const sm = new StateManager(bridge);
		sm.registerProvider('pafv', provider, { scoped: true });
		// No initActiveDataset — _activeDatasetId is null

		await sm.setActiveDataset('ds1');

		// No persist (no prior dataset)
		expect(toJSONMock).not.toHaveBeenCalled();
	});
});
