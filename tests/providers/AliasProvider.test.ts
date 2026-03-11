// @vitest-environment jsdom
// Isometry v5 — Phase 55 Plan 01 (Task 1)
// Tests for AliasProvider: display alias persistence for AxisField values.
//
// Requirements: PROP-02
// TDD Phase: RED -> GREEN -> REFACTOR

import { describe, expect, it, vi } from 'vitest';
import { AliasProvider } from '../../src/providers/AliasProvider';

// ---------------------------------------------------------------------------
// getAlias — returns original field name when no alias set
// ---------------------------------------------------------------------------

describe('AliasProvider — getAlias', () => {
	it('returns the original field name when no alias is set', () => {
		const provider = new AliasProvider();
		expect(provider.getAlias('name')).toBe('name');
	});

	it('returns the original field name for time fields', () => {
		const provider = new AliasProvider();
		expect(provider.getAlias('created_at')).toBe('created_at');
		expect(provider.getAlias('modified_at')).toBe('modified_at');
		expect(provider.getAlias('due_at')).toBe('due_at');
	});
});

// ---------------------------------------------------------------------------
// setAlias / getAlias round-trip
// ---------------------------------------------------------------------------

describe('AliasProvider — setAlias', () => {
	it('setAlias then getAlias returns the alias', () => {
		const provider = new AliasProvider();
		provider.setAlias('folder', 'Project');
		expect(provider.getAlias('folder')).toBe('Project');
	});

	it('overwriting an alias updates it', () => {
		const provider = new AliasProvider();
		provider.setAlias('folder', 'Project');
		provider.setAlias('folder', 'Workspace');
		expect(provider.getAlias('folder')).toBe('Workspace');
	});

	it('aliases are independent per field', () => {
		const provider = new AliasProvider();
		provider.setAlias('folder', 'Project');
		provider.setAlias('status', 'State');
		expect(provider.getAlias('folder')).toBe('Project');
		expect(provider.getAlias('status')).toBe('State');
		expect(provider.getAlias('name')).toBe('name');
	});
});

// ---------------------------------------------------------------------------
// clearAlias — reverts to original field name
// ---------------------------------------------------------------------------

describe('AliasProvider — clearAlias', () => {
	it('clearAlias reverts to original field name', () => {
		const provider = new AliasProvider();
		provider.setAlias('folder', 'Project');
		expect(provider.getAlias('folder')).toBe('Project');

		provider.clearAlias('folder');
		expect(provider.getAlias('folder')).toBe('folder');
	});

	it('clearAlias on a field with no alias is a no-op', () => {
		const provider = new AliasProvider();
		provider.clearAlias('name'); // should not throw
		expect(provider.getAlias('name')).toBe('name');
	});
});

// ---------------------------------------------------------------------------
// toJSON / setState — PersistableProvider round-trip
// ---------------------------------------------------------------------------

describe('AliasProvider — toJSON / setState', () => {
	it('toJSON returns valid JSON string', () => {
		const provider = new AliasProvider();
		const json = provider.toJSON();
		expect(() => JSON.parse(json)).not.toThrow();
	});

	it('round-trip preserves aliases', () => {
		const provider = new AliasProvider();
		provider.setAlias('folder', 'Project');
		provider.setAlias('status', 'State');

		const json = provider.toJSON();
		const restored = new AliasProvider();
		restored.setState(JSON.parse(json));

		expect(restored.getAlias('folder')).toBe('Project');
		expect(restored.getAlias('status')).toBe('State');
		expect(restored.getAlias('name')).toBe('name');
	});

	it('setState with empty object clears all aliases', () => {
		const provider = new AliasProvider();
		provider.setAlias('folder', 'Project');
		provider.setState({});
		expect(provider.getAlias('folder')).toBe('folder');
	});

	it('setState preserves aliases for unknown fields (orphan preservation)', () => {
		const provider = new AliasProvider();
		provider.setState({ bogus_field: 'Bad', folder: 'Good' });
		expect(provider.getAlias('folder')).toBe('Good');
		expect(provider.getAlias('bogus_field' as any)).toBe('Bad');
	});

	it('orphan aliases survive toJSON/setState round-trip', () => {
		const provider = new AliasProvider();
		provider.setAlias('folder', 'Project');
		// Simulate orphan: set state with a field that exists + one that does not
		provider.setState({ folder: 'Project', vanished_column: 'Old Name' });

		const json = provider.toJSON();
		const restored = new AliasProvider();
		restored.setState(JSON.parse(json));

		expect(restored.getAlias('folder')).toBe('Project');
		expect(restored.getAlias('vanished_column' as any)).toBe('Old Name');
	});

	it('getAlias returns stored alias for fields not in schema', () => {
		const provider = new AliasProvider();
		provider.setState({ unknown_field: 'Custom Name' });
		expect(provider.getAlias('unknown_field' as any)).toBe('Custom Name');
	});

	it('setState ignores non-string values', () => {
		const provider = new AliasProvider();
		provider.setState({ folder: 123, status: 'Good' });
		expect(provider.getAlias('folder')).toBe('folder');
		expect(provider.getAlias('status')).toBe('Good');
	});
});

// ---------------------------------------------------------------------------
// resetToDefaults — clears all aliases
// ---------------------------------------------------------------------------

describe('AliasProvider — resetToDefaults', () => {
	it('clears all aliases', () => {
		const provider = new AliasProvider();
		provider.setAlias('folder', 'Project');
		provider.setAlias('status', 'State');

		provider.resetToDefaults();

		expect(provider.getAlias('folder')).toBe('folder');
		expect(provider.getAlias('status')).toBe('status');
	});
});

// ---------------------------------------------------------------------------
// subscribe — notification pattern
// ---------------------------------------------------------------------------

describe('AliasProvider — subscribe', () => {
	it('subscribe fires on setAlias', async () => {
		const provider = new AliasProvider();
		const callback = vi.fn();
		provider.subscribe(callback);

		provider.setAlias('folder', 'Project');

		// Batched via queueMicrotask — wait for microtask
		await Promise.resolve();
		expect(callback).toHaveBeenCalledTimes(1);
	});

	it('subscribe fires on clearAlias', async () => {
		const provider = new AliasProvider();
		provider.setAlias('folder', 'Project');

		// Flush the setAlias notification
		await Promise.resolve();

		const callback = vi.fn();
		provider.subscribe(callback);

		provider.clearAlias('folder');
		await Promise.resolve();
		expect(callback).toHaveBeenCalledTimes(1);
	});

	it('subscribe does NOT fire on setState (snap-to-state pattern)', async () => {
		const provider = new AliasProvider();
		const callback = vi.fn();
		provider.subscribe(callback);

		provider.setState({ folder: 'Project' });

		await Promise.resolve();
		expect(callback).not.toHaveBeenCalled();
	});

	it('unsubscribe prevents further notifications', async () => {
		const provider = new AliasProvider();
		const callback = vi.fn();
		const unsubscribe = provider.subscribe(callback);

		unsubscribe();

		provider.setAlias('folder', 'Project');
		await Promise.resolve();
		expect(callback).not.toHaveBeenCalled();
	});

	it('batches multiple mutations into a single notification', async () => {
		const provider = new AliasProvider();
		const callback = vi.fn();
		provider.subscribe(callback);

		provider.setAlias('folder', 'Project');
		provider.setAlias('status', 'State');
		provider.setAlias('name', 'Title');

		await Promise.resolve();
		expect(callback).toHaveBeenCalledTimes(1);
	});
});
