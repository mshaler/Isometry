// @vitest-environment jsdom
// Isometry v5 — Phase 98 Plugin Registry Tests
// Unit tests for the composable SuperGrid feature registry.
//
// Design:
//   - Registry lifecycle: register, enable, disable, query
//   - Dependency auto-enforcement: enable deps, disable dependents
//   - Pipeline execution: transformData, transformLayout, afterRender
//   - Toggle state persistence
//
// Requirements: HAR-01, HAR-02, HAR-03, HAR-12

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
	CellPlacement,
	GridLayout,
	PluginFactory,
	PluginHook,
	PluginMeta,
	RenderContext,
} from '../../../src/views/pivot/plugins/PluginTypes';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMeta(overrides: Partial<PluginMeta> & { id: string }): PluginMeta {
	return {
		name: overrides.id,
		category: 'Test',
		description: '',
		dependencies: [],
		defaultEnabled: false,
		...overrides,
	};
}

function makeCtx(overrides?: Partial<RenderContext>): RenderContext {
	return {
		rowDimensions: [],
		colDimensions: [],
		visibleRows: [],
		allRows: [],
		visibleCols: [],
		data: new Map(),
		cells: [],
		rootEl: document.createElement('div'),
		scrollLeft: 0,
		scrollTop: 0,
		isPluginEnabled: () => false,
		...overrides,
	};
}

function noopFactory(): PluginHook {
	return {};
}

// ---------------------------------------------------------------------------
// HAR-01: Registry lifecycle
// ---------------------------------------------------------------------------

describe('PluginRegistry — lifecycle', () => {
	it('registers a plugin and lists it', async () => {
		const { PluginRegistry } = await import('../../../src/views/pivot/plugins/PluginRegistry');
		const reg = new PluginRegistry();
		reg.register(makeMeta({ id: 'foo' }), noopFactory);

		expect(reg.getAll()).toHaveLength(1);
		expect(reg.getAll()[0]!.id).toBe('foo');
	});

	it('enable/disable toggles isEnabled', async () => {
		const { PluginRegistry } = await import('../../../src/views/pivot/plugins/PluginRegistry');
		const reg = new PluginRegistry();
		reg.register(makeMeta({ id: 'foo' }), noopFactory);

		expect(reg.isEnabled('foo')).toBe(false);
		reg.enable('foo');
		expect(reg.isEnabled('foo')).toBe(true);
		reg.disable('foo');
		expect(reg.isEnabled('foo')).toBe(false);
	});

	it('getEnabled returns only enabled plugins', async () => {
		const { PluginRegistry } = await import('../../../src/views/pivot/plugins/PluginRegistry');
		const reg = new PluginRegistry();
		reg.register(makeMeta({ id: 'a' }), noopFactory);
		reg.register(makeMeta({ id: 'b' }), noopFactory);
		reg.register(makeMeta({ id: 'c' }), noopFactory);
		reg.enable('a');
		reg.enable('c');

		const enabled = reg.getEnabled();
		expect(enabled.map((p) => p.id).sort()).toEqual(['a', 'c']);
	});

	it('getByCategory groups plugins', async () => {
		const { PluginRegistry } = await import('../../../src/views/pivot/plugins/PluginRegistry');
		const reg = new PluginRegistry();
		reg.register(makeMeta({ id: 'a', category: 'Stack' }), noopFactory);
		reg.register(makeMeta({ id: 'b', category: 'Stack' }), noopFactory);
		reg.register(makeMeta({ id: 'c', category: 'Zoom' }), noopFactory);

		const grouped = reg.getByCategory();
		expect(grouped.get('Stack')).toHaveLength(2);
		expect(grouped.get('Zoom')).toHaveLength(1);
	});

	it('defaultEnabled plugins start enabled', async () => {
		const { PluginRegistry } = await import('../../../src/views/pivot/plugins/PluginRegistry');
		const reg = new PluginRegistry();
		reg.register(makeMeta({ id: 'base', defaultEnabled: true }), noopFactory);
		reg.register(makeMeta({ id: 'extra', defaultEnabled: false }), noopFactory);

		expect(reg.isEnabled('base')).toBe(true);
		expect(reg.isEnabled('extra')).toBe(false);
	});

	it('enable on unknown id is a no-op', async () => {
		const { PluginRegistry } = await import('../../../src/views/pivot/plugins/PluginRegistry');
		const reg = new PluginRegistry();
		reg.enable('nonexistent'); // should not throw
		expect(reg.isEnabled('nonexistent')).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// HAR-02: Dependency enforcement
// ---------------------------------------------------------------------------

describe('PluginRegistry — dependencies', () => {
	it('enabling a plugin auto-enables its dependencies', async () => {
		const { PluginRegistry } = await import('../../../src/views/pivot/plugins/PluginRegistry');
		const reg = new PluginRegistry();
		reg.register(makeMeta({ id: 'parent' }), noopFactory);
		reg.register(makeMeta({ id: 'child', dependencies: ['parent'] }), noopFactory);

		reg.enable('child');
		expect(reg.isEnabled('parent')).toBe(true);
		expect(reg.isEnabled('child')).toBe(true);
	});

	it('disabling a plugin auto-disables its dependents', async () => {
		const { PluginRegistry } = await import('../../../src/views/pivot/plugins/PluginRegistry');
		const reg = new PluginRegistry();
		reg.register(makeMeta({ id: 'parent' }), noopFactory);
		reg.register(makeMeta({ id: 'child', dependencies: ['parent'] }), noopFactory);
		reg.register(makeMeta({ id: 'grandchild', dependencies: ['child'] }), noopFactory);

		reg.enable('grandchild');
		expect(reg.isEnabled('parent')).toBe(true);
		expect(reg.isEnabled('child')).toBe(true);
		expect(reg.isEnabled('grandchild')).toBe(true);

		reg.disable('parent');
		expect(reg.isEnabled('parent')).toBe(false);
		expect(reg.isEnabled('child')).toBe(false);
		expect(reg.isEnabled('grandchild')).toBe(false);
	});

	it('transitive dependency chain resolves correctly', async () => {
		const { PluginRegistry } = await import('../../../src/views/pivot/plugins/PluginRegistry');
		const reg = new PluginRegistry();
		reg.register(makeMeta({ id: 'a' }), noopFactory);
		reg.register(makeMeta({ id: 'b', dependencies: ['a'] }), noopFactory);
		reg.register(makeMeta({ id: 'c', dependencies: ['b'] }), noopFactory);

		reg.enable('c');
		expect(reg.isEnabled('a')).toBe(true);
		expect(reg.isEnabled('b')).toBe(true);
		expect(reg.isEnabled('c')).toBe(true);
	});

	it('disable does not affect unrelated plugins', async () => {
		const { PluginRegistry } = await import('../../../src/views/pivot/plugins/PluginRegistry');
		const reg = new PluginRegistry();
		reg.register(makeMeta({ id: 'a' }), noopFactory);
		reg.register(makeMeta({ id: 'b' }), noopFactory);
		reg.register(makeMeta({ id: 'c', dependencies: ['a'] }), noopFactory);

		reg.enable('b');
		reg.enable('c');
		reg.disable('a');

		expect(reg.isEnabled('b')).toBe(true); // unrelated — stays enabled
		expect(reg.isEnabled('c')).toBe(false); // dependent — auto-disabled
	});
});

// ---------------------------------------------------------------------------
// HAR-03: Pipeline execution
// ---------------------------------------------------------------------------

describe('PluginRegistry — pipeline', () => {
	it('runTransformData chains enabled plugins in order', async () => {
		const { PluginRegistry } = await import('../../../src/views/pivot/plugins/PluginRegistry');
		const reg = new PluginRegistry();
		const log: string[] = [];

		reg.register(makeMeta({ id: 'first', defaultEnabled: true }), () => ({
			transformData(cells) {
				log.push('first');
				return [...cells, { key: 'added-by-first', rowIdx: 0, colIdx: 0, value: 1 }];
			},
		}));

		reg.register(makeMeta({ id: 'second', defaultEnabled: true }), () => ({
			transformData(cells) {
				log.push('second');
				return cells;
			},
		}));

		reg.register(makeMeta({ id: 'disabled' }), () => ({
			transformData(cells) {
				log.push('disabled'); // should NOT run
				return cells;
			},
		}));

		const result = reg.runTransformData([], makeCtx());
		expect(log).toEqual(['first', 'second']); // disabled skipped
		expect(result).toHaveLength(1); // first added a cell
	});

	it('runTransformLayout chains layout transforms', async () => {
		const { PluginRegistry } = await import('../../../src/views/pivot/plugins/PluginRegistry');
		const reg = new PluginRegistry();

		reg.register(makeMeta({ id: 'zoom', defaultEnabled: true }), () => ({
			transformLayout(layout) {
				return { ...layout, zoom: 1.5 };
			},
		}));

		const baseLayout: GridLayout = {
			headerWidth: 120,
			headerHeight: 36,
			cellWidth: 72,
			cellHeight: 32,
			colWidths: new Map(),
			zoom: 1.0,
		};

		const result = reg.runTransformLayout(baseLayout, makeCtx());
		expect(result.zoom).toBe(1.5);
	});

	it('runAfterRender calls all enabled plugins', async () => {
		const { PluginRegistry } = await import('../../../src/views/pivot/plugins/PluginRegistry');
		const reg = new PluginRegistry();
		const root = document.createElement('div');
		const called: string[] = [];

		reg.register(makeMeta({ id: 'footer', defaultEnabled: true }), () => ({
			afterRender(el) {
				called.push('footer');
				el.appendChild(document.createElement('footer'));
			},
		}));

		reg.register(makeMeta({ id: 'overlay', defaultEnabled: true }), () => ({
			afterRender(el) {
				called.push('overlay');
			},
		}));

		reg.runAfterRender(root, makeCtx());
		expect(called).toEqual(['footer', 'overlay']);
		expect(root.querySelector('footer')).toBeTruthy();
	});

	it('disable calls destroy on the plugin instance', async () => {
		const { PluginRegistry } = await import('../../../src/views/pivot/plugins/PluginRegistry');
		const reg = new PluginRegistry();
		const destroyed = vi.fn();

		reg.register(makeMeta({ id: 'cleanup', defaultEnabled: true }), () => ({
			destroy: destroyed,
		}));

		expect(destroyed).not.toHaveBeenCalled();
		reg.disable('cleanup');
		expect(destroyed).toHaveBeenCalledOnce();
	});

	it('re-enabling creates a fresh plugin instance', async () => {
		const { PluginRegistry } = await import('../../../src/views/pivot/plugins/PluginRegistry');
		const reg = new PluginRegistry();
		let instanceCount = 0;

		reg.register(makeMeta({ id: 'stateful' }), () => {
			instanceCount++;
			return {};
		});

		reg.enable('stateful'); // instance 1
		reg.disable('stateful');
		reg.enable('stateful'); // instance 2
		expect(instanceCount).toBe(2);
	});
});

// ---------------------------------------------------------------------------
// HAR-09: Toggle state persistence
// ---------------------------------------------------------------------------

describe('PluginRegistry — persistence', () => {
	it('saveState returns current enabled set', async () => {
		const { PluginRegistry } = await import('../../../src/views/pivot/plugins/PluginRegistry');
		const reg = new PluginRegistry();
		reg.register(makeMeta({ id: 'a' }), noopFactory);
		reg.register(makeMeta({ id: 'b' }), noopFactory);
		reg.enable('a');

		const state = reg.saveState();
		expect(state.enabled).toEqual(['a']);
	});

	it('restoreState enables the saved set', async () => {
		const { PluginRegistry } = await import('../../../src/views/pivot/plugins/PluginRegistry');
		const reg = new PluginRegistry();
		reg.register(makeMeta({ id: 'a' }), noopFactory);
		reg.register(makeMeta({ id: 'b' }), noopFactory);

		reg.restoreState({ enabled: ['b'], dataSource: 'mock' });
		expect(reg.isEnabled('a')).toBe(false);
		expect(reg.isEnabled('b')).toBe(true);
	});

	it('onChange fires when toggles change', async () => {
		const { PluginRegistry } = await import('../../../src/views/pivot/plugins/PluginRegistry');
		const reg = new PluginRegistry();
		reg.register(makeMeta({ id: 'a' }), noopFactory);

		const listener = vi.fn();
		reg.onChange(listener);

		reg.enable('a');
		expect(listener).toHaveBeenCalledTimes(1);

		reg.disable('a');
		expect(listener).toHaveBeenCalledTimes(2);
	});
});
