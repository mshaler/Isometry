// @vitest-environment jsdom
// Isometry v5 — TreeView Tests
// Tests for collapsible hierarchy view using d3-hierarchy.
//
// Requirements: REND-01, REND-05

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TreeView } from '../../src/views/TreeView';
import type { CardDatum, WorkerBridgeLike } from '../../src/views/types';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

function makeCard(id: string, name: string): CardDatum {
	return {
		id,
		name,
		folder: null,
		status: null,
		card_type: 'note',
		created_at: '2026-01-01T10:00:00Z',
		modified_at: '2026-01-01T12:00:00Z',
		priority: 0,
		sort_order: 0,
		due_at: null,
		body_text: null,
		source: null,
	};
}

/**
 * Connection row shape returned by the worker bridge:
 *   { source_id, target_id, label }
 */
function makeBridgeMock(connections: Array<{ source_id: string; target_id: string; label: string }>): WorkerBridgeLike {
	return {
		send: vi.fn().mockResolvedValue(connections),
	};
}

// ---------------------------------------------------------------------------
// SelectionProvider mock
// ---------------------------------------------------------------------------

function makeSelectionProvider() {
	const selected = new Set<string>();
	const subscribers: Array<() => void> = [];
	return {
		toggle: vi.fn((id: string) => {
			if (selected.has(id)) {
				selected.delete(id);
			} else {
				selected.add(id);
			}
			subscribers.forEach((cb) => cb());
		}),
		addToSelection: vi.fn((id: string) => {
			selected.add(id);
			subscribers.forEach((cb) => cb());
		}),
		getSelected: () => new Set(selected) as ReadonlySet<string>,
		subscribe: vi.fn((cb: () => void) => {
			subscribers.push(cb);
			return () => {
				const idx = subscribers.indexOf(cb);
				if (idx >= 0) subscribers.splice(idx, 1);
			};
		}),
	};
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function mountAndRender(view: TreeView, container: HTMLElement, cards: CardDatum[]): Promise<void> {
	view.mount(container);
	await view.render(cards);
}

// ---------------------------------------------------------------------------
// Tests — Task 1: basic layout and rendering
// ---------------------------------------------------------------------------

describe('TreeView — mount and structure', () => {
	let container: HTMLElement;
	let view: TreeView;

	beforeEach(() => {
		container = document.createElement('div');
		document.body.appendChild(container);
	});

	afterEach(() => {
		view?.destroy();
		document.body.removeChild(container);
	});

	it('mount creates SVG with class tree-view', () => {
		const bridge = makeBridgeMock([]);
		view = new TreeView({ bridge });
		view.mount(container);

		const svg = container.querySelector('svg.tree-view');
		expect(svg).not.toBeNull();
	});

	it('mount creates g.tree-layer inside the SVG', () => {
		const bridge = makeBridgeMock([]);
		view = new TreeView({ bridge });
		view.mount(container);

		const layer = container.querySelector('svg g.tree-layer');
		expect(layer).not.toBeNull();
	});

	it('mount creates div.orphan-list below the SVG', () => {
		const bridge = makeBridgeMock([]);
		view = new TreeView({ bridge });
		view.mount(container);

		const orphanList = container.querySelector('div.orphan-list');
		expect(orphanList).not.toBeNull();
	});

	it('SVG comes before orphan-list in the DOM', () => {
		const bridge = makeBridgeMock([]);
		view = new TreeView({ bridge });
		view.mount(container);

		const children = Array.from(container.children);
		const svgIdx = children.findIndex((c) => c.tagName === 'svg' || c.tagName === 'SVG');
		const orphanIdx = children.findIndex((c) => (c as HTMLElement).classList.contains('orphan-list'));
		expect(svgIdx).toBeGreaterThanOrEqual(0);
		expect(orphanIdx).toBeGreaterThanOrEqual(0);
		expect(svgIdx).toBeLessThan(orphanIdx);
	});
});

describe('TreeView — render with empty cards', () => {
	let container: HTMLElement;
	let view: TreeView;

	beforeEach(() => {
		container = document.createElement('div');
		document.body.appendChild(container);
		const bridge = makeBridgeMock([]);
		view = new TreeView({ bridge });
	});

	afterEach(() => {
		view?.destroy();
		document.body.removeChild(container);
	});

	it('render with empty cards shows no tree nodes', async () => {
		await mountAndRender(view, container, []);
		const nodes = container.querySelectorAll('circle.tree-node');
		expect(nodes.length).toBe(0);
	});

	it('render with empty cards shows no links', async () => {
		await mountAndRender(view, container, []);
		const links = container.querySelectorAll('path.tree-link');
		expect(links.length).toBe(0);
	});

	it('render with empty cards shows no orphans', async () => {
		await mountAndRender(view, container, []);
		const orphanItems = container.querySelectorAll('.orphan-item');
		expect(orphanItems.length).toBe(0);
	});
});

describe('TreeView — hierarchical data rendering', () => {
	let container: HTMLElement;
	let view: TreeView;

	beforeEach(() => {
		container = document.createElement('div');
		document.body.appendChild(container);
	});

	afterEach(() => {
		view?.destroy();
		document.body.removeChild(container);
	});

	it('renders tree nodes for cards connected by treeLabel', async () => {
		// parent → child via 'contains'
		const bridge = makeBridgeMock([{ source_id: 'parent', target_id: 'child', label: 'contains' }]);
		view = new TreeView({ bridge });
		const cards = [makeCard('parent', 'Parent'), makeCard('child', 'Child')];
		await mountAndRender(view, container, cards);

		// 2 tree nodes (parent + child — no synthetic root needed for single root)
		const nodes = container.querySelectorAll('g.tree-node-group');
		expect(nodes.length).toBe(2);
	});

	it('renders a link between parent and child', async () => {
		const bridge = makeBridgeMock([{ source_id: 'parent', target_id: 'child', label: 'contains' }]);
		view = new TreeView({ bridge });
		const cards = [makeCard('parent', 'Parent'), makeCard('child', 'Child')];
		await mountAndRender(view, container, cards);

		const links = container.querySelectorAll('path.tree-link');
		expect(links.length).toBeGreaterThanOrEqual(1);
	});

	it('cards not in any connection go to orphan-list', async () => {
		const bridge = makeBridgeMock([{ source_id: 'parent', target_id: 'child', label: 'contains' }]);
		view = new TreeView({ bridge });
		const cards = [makeCard('parent', 'Parent'), makeCard('child', 'Child'), makeCard('orphan', 'Orphan')];
		await mountAndRender(view, container, cards);

		const orphanItems = container.querySelectorAll('.orphan-item');
		expect(orphanItems.length).toBe(1);
		expect(orphanItems[0]!.textContent).toContain('Orphan');
	});

	it('filters connections by treeLabel — other labels do not define hierarchy', async () => {
		const bridge = makeBridgeMock([
			{ source_id: 'parent', target_id: 'child', label: 'contains' },
			{ source_id: 'a', target_id: 'b', label: 'related' }, // different label
		]);
		// default treeLabel is 'contains' — 'related' should not create tree edges
		view = new TreeView({ bridge });
		const cards = [makeCard('parent', 'Parent'), makeCard('child', 'Child'), makeCard('a', 'A'), makeCard('b', 'B')];
		await mountAndRender(view, container, cards);

		const orphanItems = container.querySelectorAll('.orphan-item');
		// a and b are not in 'contains' hierarchy → orphans
		expect(orphanItems.length).toBe(2);
	});

	it('respects custom treeLabel option', async () => {
		const bridge = makeBridgeMock([{ source_id: 'parent', target_id: 'child', label: 'parent' }]);
		view = new TreeView({ bridge, treeLabel: 'parent' });
		const cards = [makeCard('parent', 'Parent'), makeCard('child', 'Child')];
		await mountAndRender(view, container, cards);

		const nodes = container.querySelectorAll('g.tree-node-group');
		expect(nodes.length).toBe(2);
	});
});

describe('TreeView — multi-root (forest) handling', () => {
	let container: HTMLElement;
	let view: TreeView;

	beforeEach(() => {
		container = document.createElement('div');
		document.body.appendChild(container);
	});

	afterEach(() => {
		view?.destroy();
		document.body.removeChild(container);
	});

	it('multi-root case creates invisible synthetic root node', async () => {
		const bridge = makeBridgeMock([
			{ source_id: 'root1', target_id: 'child1', label: 'contains' },
			{ source_id: 'root2', target_id: 'child2', label: 'contains' },
		]);
		view = new TreeView({ bridge });
		const cards = [
			makeCard('root1', 'Root1'),
			makeCard('child1', 'Child1'),
			makeCard('root2', 'Root2'),
			makeCard('child2', 'Child2'),
		];
		await mountAndRender(view, container, cards);

		// Synthetic root '__forest_root__' should NOT appear as a visible node
		const nodeGroups = container.querySelectorAll('g.tree-node-group');
		const ids = Array.from(nodeGroups).map((g) => g.getAttribute('data-id'));
		expect(ids).not.toContain('__forest_root__');

		// But the 4 real cards should appear as nodes
		expect(nodeGroups.length).toBe(4);
	});

	it('single root case does not create synthetic root', async () => {
		const bridge = makeBridgeMock([{ source_id: 'parent', target_id: 'child', label: 'contains' }]);
		view = new TreeView({ bridge });
		const cards = [makeCard('parent', 'Parent'), makeCard('child', 'Child')];
		await mountAndRender(view, container, cards);

		// No synthetic root
		const nodeGroups = container.querySelectorAll('g.tree-node-group');
		const ids = Array.from(nodeGroups).map((g) => g.getAttribute('data-id'));
		expect(ids).not.toContain('__forest_root__');
		expect(nodeGroups.length).toBe(2);
	});
});

describe('TreeView — D3 data join key function', () => {
	let container: HTMLElement;
	let view: TreeView;

	beforeEach(() => {
		container = document.createElement('div');
		document.body.appendChild(container);
	});

	afterEach(() => {
		view?.destroy();
		document.body.removeChild(container);
	});

	it('re-render preserves existing DOM elements (key function ensures correct matching)', async () => {
		const bridge = makeBridgeMock([{ source_id: 'parent', target_id: 'child1', label: 'contains' }]);
		view = new TreeView({ bridge });
		const cards = [makeCard('parent', 'Parent'), makeCard('child1', 'Child1')];
		await mountAndRender(view, container, cards);

		const firstNode = container.querySelector('g.tree-node-group[data-id="parent"]');
		expect(firstNode).not.toBeNull();

		// Re-render with same data
		await view.render(cards);

		// Same node still present (D3 key function preserves it)
		const sameNode = container.querySelector('g.tree-node-group[data-id="parent"]');
		expect(sameNode).not.toBeNull();
	});
});

describe('TreeView — destroy', () => {
	let container: HTMLElement;
	let view: TreeView;

	beforeEach(() => {
		container = document.createElement('div');
		document.body.appendChild(container);
	});

	afterEach(() => {
		document.body.removeChild(container);
	});

	it('destroy removes SVG from container', async () => {
		const bridge = makeBridgeMock([]);
		view = new TreeView({ bridge });
		await mountAndRender(view, container, [makeCard('a', 'A')]);

		view.destroy();
		expect(container.querySelector('svg')).toBeNull();
	});

	it('destroy removes orphan-list from container', async () => {
		const bridge = makeBridgeMock([]);
		view = new TreeView({ bridge });
		await mountAndRender(view, container, [makeCard('a', 'A')]);

		view.destroy();
		expect(container.querySelector('.orphan-list')).toBeNull();
	});

	it('destroy sets root to null (cleared state)', async () => {
		const bridge = makeBridgeMock([{ source_id: 'parent', target_id: 'child', label: 'contains' }]);
		view = new TreeView({ bridge });
		await mountAndRender(view, container, [makeCard('parent', 'P'), makeCard('child', 'C')]);

		view.destroy();
		// After destroy, calling mount+render again should work (no stale root)
		view.mount(container);
		await view.render([makeCard('a', 'A')]);
		const nodes = container.querySelectorAll('g.tree-node-group');
		// 'a' has no connections, so it's an orphan — no tree nodes
		expect(nodes.length).toBe(0);
	});

	it('destroy on unmounted view does not throw', () => {
		const bridge = makeBridgeMock([]);
		view = new TreeView({ bridge });
		expect(() => view.destroy()).not.toThrow();
	});
});

// ---------------------------------------------------------------------------
// Tests — Task 2: expand/collapse, selection, index export
// ---------------------------------------------------------------------------

describe('TreeView — expand/collapse', () => {
	let container: HTMLElement;
	let view: TreeView;

	beforeEach(() => {
		container = document.createElement('div');
		document.body.appendChild(container);
	});

	afterEach(() => {
		view?.destroy();
		document.body.removeChild(container);
	});

	it('click on a parent node collapses its children', async () => {
		const bridge = makeBridgeMock([
			{ source_id: 'parent', target_id: 'child1', label: 'contains' },
			{ source_id: 'parent', target_id: 'child2', label: 'contains' },
		]);
		view = new TreeView({ bridge });
		const cards = [makeCard('parent', 'Parent'), makeCard('child1', 'Child1'), makeCard('child2', 'Child2')];
		await mountAndRender(view, container, cards);

		// Initially 3 nodes
		expect(container.querySelectorAll('g.tree-node-group').length).toBe(3);

		// Click parent node to collapse (SVG elements in jsdom use dispatchEvent)
		const parentNode = container.querySelector('g.tree-node-group[data-id="parent"]');
		expect(parentNode).not.toBeNull();
		parentNode!.dispatchEvent(new MouseEvent('click', { bubbles: true }));

		// After collapse: only parent visible (children removed from DOM)
		expect(container.querySelectorAll('g.tree-node-group').length).toBe(1);
	});

	it('click on collapsed parent expands it again', async () => {
		const bridge = makeBridgeMock([{ source_id: 'parent', target_id: 'child1', label: 'contains' }]);
		view = new TreeView({ bridge });
		const cards = [makeCard('parent', 'Parent'), makeCard('child1', 'Child1')];
		await mountAndRender(view, container, cards);

		// Collapse
		const parentNode = container.querySelector('g.tree-node-group[data-id="parent"]')!;
		parentNode.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(container.querySelectorAll('g.tree-node-group').length).toBe(1);

		// Expand
		const collapsedParent = container.querySelector('g.tree-node-group[data-id="parent"]')!;
		collapsedParent.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(container.querySelectorAll('g.tree-node-group').length).toBe(2);
	});

	it('expand/collapse does NOT re-stratify — root reference is the same object', async () => {
		const bridge = makeBridgeMock([{ source_id: 'parent', target_id: 'child1', label: 'contains' }]);
		view = new TreeView({ bridge });
		const cards = [makeCard('parent', 'Parent'), makeCard('child1', 'Child1')];
		await mountAndRender(view, container, cards);

		// Capture the root reference (internal) via a spy on stratify
		// We verify this by checking the bridge was called only once (during render)
		const bridgeMock = bridge.send as ReturnType<typeof vi.fn>;
		const callsAfterRender = bridgeMock.mock.calls.length;

		// Click to collapse
		const parentNode = container.querySelector('g.tree-node-group[data-id="parent"]')!;
		parentNode.dispatchEvent(new MouseEvent('click', { bubbles: true }));

		// Bridge should NOT be called again (no re-stratify = no new DB query)
		expect(bridgeMock.mock.calls.length).toBe(callsAfterRender);
	});

	it('collapsed node has data-collapsed attribute set to true', async () => {
		const bridge = makeBridgeMock([{ source_id: 'parent', target_id: 'child1', label: 'contains' }]);
		view = new TreeView({ bridge });
		const cards = [makeCard('parent', 'Parent'), makeCard('child1', 'Child1')];
		await mountAndRender(view, container, cards);

		// Click to collapse
		const parentNode = container.querySelector('g.tree-node-group[data-id="parent"]')!;
		parentNode.dispatchEvent(new MouseEvent('click', { bubbles: true }));

		// Parent now shows as collapsed
		const collapsedNode = container.querySelector('g.tree-node-group[data-id="parent"]');
		expect(collapsedNode?.getAttribute('data-collapsed')).toBe('true');
	});

	it('expanded node does NOT have data-collapsed attribute', async () => {
		const bridge = makeBridgeMock([{ source_id: 'parent', target_id: 'child1', label: 'contains' }]);
		view = new TreeView({ bridge });
		const cards = [makeCard('parent', 'Parent'), makeCard('child1', 'Child1')];
		await mountAndRender(view, container, cards);

		// Initially expanded
		const parentNode = container.querySelector('g.tree-node-group[data-id="parent"]');
		expect(parentNode?.getAttribute('data-collapsed')).not.toBe('true');
	});
});

describe('TreeView — selection integration', () => {
	let container: HTMLElement;
	let view: TreeView;

	beforeEach(() => {
		container = document.createElement('div');
		document.body.appendChild(container);
	});

	afterEach(() => {
		view?.destroy();
		document.body.removeChild(container);
	});

	it('click on a node calls selectionProvider.toggle with node id', async () => {
		const bridge = makeBridgeMock([{ source_id: 'parent', target_id: 'child', label: 'contains' }]);
		const selection = makeSelectionProvider();
		view = new TreeView({ bridge, selectionProvider: selection });
		const cards = [makeCard('parent', 'Parent'), makeCard('child', 'Child')];
		await mountAndRender(view, container, cards);

		const parentNode = container.querySelector('g.tree-node-group[data-id="parent"]')!;
		parentNode.dispatchEvent(new MouseEvent('click', { bubbles: true }));

		expect(selection.toggle).toHaveBeenCalledWith('parent');
	});

	it('shift-click calls selectionProvider.addToSelection without toggling collapse', async () => {
		const bridge = makeBridgeMock([{ source_id: 'parent', target_id: 'child', label: 'contains' }]);
		const selection = makeSelectionProvider();
		view = new TreeView({ bridge, selectionProvider: selection });
		const cards = [makeCard('parent', 'Parent'), makeCard('child', 'Child')];
		await mountAndRender(view, container, cards);

		const parentNode = container.querySelector<HTMLElement>('g.tree-node-group[data-id="parent"]')!;

		// Simulate shift-click
		const shiftClickEvent = new MouseEvent('click', { bubbles: true, shiftKey: true });
		parentNode.dispatchEvent(shiftClickEvent);

		// addToSelection called, NOT toggle
		expect(selection.addToSelection).toHaveBeenCalledWith('parent');
		expect(selection.toggle).not.toHaveBeenCalled();

		// Collapse should NOT have happened — children still visible
		expect(container.querySelectorAll('g.tree-node-group').length).toBe(2);
	});

	it('selected node gets data-selected attribute', async () => {
		const bridge = makeBridgeMock([{ source_id: 'parent', target_id: 'child', label: 'contains' }]);
		const selection = makeSelectionProvider();
		view = new TreeView({ bridge, selectionProvider: selection });
		const cards = [makeCard('parent', 'Parent'), makeCard('child', 'Child')];
		await mountAndRender(view, container, cards);

		// Click to select
		const parentNode = container.querySelector('g.tree-node-group[data-id="parent"]')!;
		parentNode.dispatchEvent(new MouseEvent('click', { bubbles: true }));

		// After selection toggle, node should have data-selected="true"
		const selectedNode = container.querySelector('g.tree-node-group[data-id="parent"]');
		expect(selectedNode?.getAttribute('data-selected')).toBe('true');
	});
});

describe('TreeView — index export', () => {
	it('exports TreeView from views/index.ts', async () => {
		const mod = await import('../../src/views/index');
		expect(mod).toHaveProperty('TreeView');
	});
});
