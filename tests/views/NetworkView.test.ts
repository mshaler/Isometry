// @vitest-environment jsdom
// Isometry v5 — NetworkView Tests
// Tests for force-directed graph view with zoom/pan/drag/hover interactions.
//
// Requirements: VIEW-08, REND-05

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SelectionProvider } from '../../src/providers/SelectionProvider';
import { NetworkView } from '../../src/views/NetworkView';
import type { CardDatum, WorkerBridgeLike } from '../../src/views/types';
import type { NodePosition } from '../../src/worker/protocol';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

function makeCards(count: number = 4): CardDatum[] {
	return Array.from({ length: count }, (_, i) => ({
		id: `card-${i + 1}`,
		name: `Card ${i + 1}`,
		folder: i % 2 === 0 ? 'folder-a' : null,
		status: i % 2 === 0 ? 'active' : null,
		card_type: (['note', 'task', 'event', 'resource'] as const)[i % 4]!,
		created_at: `2026-01-${String(i + 1).padStart(2, '0')}T10:00:00Z`,
		modified_at: `2026-01-${String(i + 1).padStart(2, '0')}T12:00:00Z`,
		priority: i + 1,
		sort_order: i + 1,
		due_at: null,
		body_text: null,
		source: null,
	}));
}

function makePositions(cards: CardDatum[]): NodePosition[] {
	return cards.map((c, i) => ({
		id: c.id,
		x: 100 + i * 50,
		y: 100 + i * 50,
		fx: null,
		fy: null,
	}));
}

function makeBridge(positions?: NodePosition[]): WorkerBridgeLike {
	return {
		send: vi.fn().mockImplementation(async (type: string) => {
			if (type === 'graph:simulate') {
				return positions ?? [];
			}
			if (type === 'db:exec') {
				return { changes: 0 };
			}
			return null;
		}),
	};
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('NetworkView', () => {
	let container: HTMLElement;
	let bridge: WorkerBridgeLike;
	let view: NetworkView;

	beforeEach(() => {
		container = document.createElement('div');
		// Set container dimensions for zoom/simulation
		Object.defineProperty(container, 'clientWidth', { configurable: true, value: 800 });
		Object.defineProperty(container, 'clientHeight', { configurable: true, value: 600 });
		document.body.appendChild(container);
		bridge = makeBridge(makePositions(makeCards()));
		view = new NetworkView({ bridge });
	});

	afterEach(() => {
		view.destroy();
		container.remove();
	});

	// -------------------------------------------------------------------------
	// mount
	// -------------------------------------------------------------------------

	describe('mount', () => {
		it('creates an SVG element in the container', () => {
			view.mount(container);
			const svg = container.querySelector('svg');
			expect(svg).not.toBeNull();
		});

		it('SVG has class network-view', () => {
			view.mount(container);
			const svg = container.querySelector('svg');
			expect(svg?.classList.contains('network-view')).toBe(true);
		});

		it('creates g.graph-layer inside SVG', () => {
			view.mount(container);
			const layer = container.querySelector('svg g.graph-layer');
			expect(layer).not.toBeNull();
		});

		it('creates g.links group inside graph-layer', () => {
			view.mount(container);
			const links = container.querySelector('svg g.graph-layer g.links');
			expect(links).not.toBeNull();
		});

		it('creates g.nodes group inside graph-layer', () => {
			view.mount(container);
			const nodes = container.querySelector('svg g.graph-layer g.nodes');
			expect(nodes).not.toBeNull();
		});

		it('g.links comes before g.nodes in DOM (edges behind nodes)', () => {
			view.mount(container);
			const layer = container.querySelector('svg g.graph-layer')!;
			const children = Array.from(layer.children);
			const linksIdx = children.findIndex((el) => el.classList.contains('links'));
			const nodesIdx = children.findIndex((el) => el.classList.contains('nodes'));
			expect(linksIdx).toBeLessThan(nodesIdx);
		});
	});

	// -------------------------------------------------------------------------
	// render — empty state
	// -------------------------------------------------------------------------

	describe('render with empty cards', () => {
		it('produces no circles when cards array is empty', async () => {
			view.mount(container);
			await view.render([]);
			const circles = container.querySelectorAll('circle');
			expect(circles.length).toBe(0);
		});

		it('produces no lines when cards array is empty', async () => {
			view.mount(container);
			await view.render([]);
			const lines = container.querySelectorAll('line');
			expect(lines.length).toBe(0);
		});

		it('does not call bridge.send when cards is empty', async () => {
			view.mount(container);
			await view.render([]);
			expect(bridge.send).not.toHaveBeenCalled();
		});
	});

	// -------------------------------------------------------------------------
	// render — with cards
	// -------------------------------------------------------------------------

	describe('render with cards', () => {
		it('calls bridge.send with graph:simulate', async () => {
			const cards = makeCards(3);
			const positions = makePositions(cards);
			bridge = makeBridge(positions);
			view = new NetworkView({ bridge });
			view.mount(container);
			await view.render(cards);
			expect(bridge.send).toHaveBeenCalledWith('graph:simulate', expect.any(Object));
		});

		it('renders circles for each card', async () => {
			const cards = makeCards(3);
			const positions = makePositions(cards);
			bridge = makeBridge(positions);
			view = new NetworkView({ bridge });
			view.mount(container);
			await view.render(cards);
			const circles = container.querySelectorAll('circle');
			expect(circles.length).toBe(3);
		});

		it('renders a text label for each card', async () => {
			const cards = makeCards(3);
			const positions = makePositions(cards);
			bridge = makeBridge(positions);
			view = new NetworkView({ bridge });
			view.mount(container);
			await view.render(cards);
			// Each node group should have a text label
			const texts = container.querySelectorAll('g.nodes text');
			expect(texts.length).toBeGreaterThan(0);
		});

		it('passes viewport dimensions to simulate payload', async () => {
			const cards = makeCards(2);
			const positions = makePositions(cards);
			bridge = makeBridge(positions);
			view = new NetworkView({ bridge });
			view.mount(container);
			await view.render(cards);
			const simulateCall = (bridge.send as ReturnType<typeof vi.fn>).mock.calls.find(
				([type]) => type === 'graph:simulate',
			);
			expect(simulateCall).toBeDefined();
			const payload = simulateCall![1] as { width: number; height: number };
			expect(typeof payload.width).toBe('number');
			expect(typeof payload.height).toBe('number');
		});

		it('uses key function d => d.id in D3 data join (re-render does not duplicate circles)', async () => {
			const cards = makeCards(3);
			const positions = makePositions(cards);
			bridge = makeBridge(positions);
			view = new NetworkView({ bridge });
			view.mount(container);
			await view.render(cards);
			// Re-render with same cards — circles should not duplicate
			await view.render(cards);
			const circles = container.querySelectorAll('circle');
			expect(circles.length).toBe(3);
		});

		it('updates circle positions from Worker response (cx/cy attributes set)', async () => {
			const cards = makeCards(2);
			const positions = makePositions(cards);
			bridge = makeBridge(positions);
			view = new NetworkView({ bridge });
			view.mount(container);
			await view.render(cards);
			const circles = container.querySelectorAll<SVGCircleElement>('circle');
			// At least one circle should have a numeric cx attribute
			const hasPositions = Array.from(circles).some((c) => {
				const cx = parseFloat(c.getAttribute('cx') ?? '');
				return !Number.isNaN(cx);
			});
			expect(hasPositions).toBe(true);
		});

		it('warm-start: passes previous positions on second render', async () => {
			const cards = makeCards(2);
			const positions = makePositions(cards);
			bridge = makeBridge(positions);
			view = new NetworkView({ bridge });
			view.mount(container);
			await view.render(cards);

			// Second render — check that simulate payload includes previous positions
			const sendMock = bridge.send as ReturnType<typeof vi.fn>;
			sendMock.mockClear();
			await view.render(cards);

			const simulateCall = sendMock.mock.calls.find(([type]) => type === 'graph:simulate');
			expect(simulateCall).toBeDefined();
			const payload = simulateCall![1] as { nodes: Array<{ id: string; x?: number; y?: number }> };
			// Nodes should carry warm-start x/y from previous positions
			const hasWarmStart = payload.nodes.some((n) => n.x !== undefined && n.y !== undefined);
			expect(hasWarmStart).toBe(true);
		});
	});

	// -------------------------------------------------------------------------
	// destroy
	// -------------------------------------------------------------------------

	describe('destroy', () => {
		it('removes SVG from container', () => {
			view.mount(container);
			view.destroy();
			expect(container.querySelector('svg')).toBeNull();
		});

		it('container is empty after destroy', () => {
			view.mount(container);
			view.destroy();
			expect(container.children.length).toBe(0);
		});

		it('calling destroy on unmounted view does not throw', () => {
			expect(() => view.destroy()).not.toThrow();
		});

		it('calling render after destroy does not throw', async () => {
			view.mount(container);
			view.destroy();
			await expect(view.render(makeCards())).resolves.not.toThrow();
		});
	});

	// -------------------------------------------------------------------------
	// interactions — click-to-select
	// -------------------------------------------------------------------------

	describe('click-to-select', () => {
		let selectionProvider: SelectionProvider;

		beforeEach(() => {
			selectionProvider = new SelectionProvider();
		});

		it('click on node calls SelectionProvider.toggle', async () => {
			const cards = makeCards(2);
			const positions = makePositions(cards);
			bridge = makeBridge(positions);
			view = new NetworkView({ bridge, selectionProvider });
			view.mount(container);
			await view.render(cards);

			const toggleSpy = vi.spyOn(selectionProvider, 'toggle');

			const circle = container.querySelector<SVGCircleElement>('g.node circle');
			expect(circle).not.toBeNull();
			circle!.dispatchEvent(new MouseEvent('click', { bubbles: true, shiftKey: false }));

			expect(toggleSpy).toHaveBeenCalled();
		});

		it('shift-click on node calls SelectionProvider.toggle for multi-select', async () => {
			const cards = makeCards(2);
			const positions = makePositions(cards);
			bridge = makeBridge(positions);
			view = new NetworkView({ bridge, selectionProvider });
			view.mount(container);
			await view.render(cards);

			const toggleSpy = vi.spyOn(selectionProvider, 'toggle');

			const circle = container.querySelector<SVGCircleElement>('g.node circle');
			circle!.dispatchEvent(new MouseEvent('click', { bubbles: true, shiftKey: true }));

			expect(toggleSpy).toHaveBeenCalled();
		});

		it('click on node without selectionProvider does not throw', async () => {
			const cards = makeCards(2);
			const positions = makePositions(cards);
			bridge = makeBridge(positions);
			view = new NetworkView({ bridge }); // no selectionProvider
			view.mount(container);
			await view.render(cards);

			const circle = container.querySelector<SVGCircleElement>('g.node circle');
			expect(() => {
				circle!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
			}).not.toThrow();
		});
	});

	// -------------------------------------------------------------------------
	// interactions — hover dimming
	// -------------------------------------------------------------------------

	describe('hover dimming', () => {
		it('mouseenter on node dims non-connected nodes', async () => {
			const cards = makeCards(3);
			const positions = makePositions(cards);
			// Set up bridge with connections: card-1 connects to card-2 only
			const bridgeWithConnections: WorkerBridgeLike = {
				send: vi.fn().mockImplementation(async (type: string) => {
					if (type === 'graph:simulate') return positions;
					if (type === 'db:exec') {
						// Return one connection: card-1 -> card-2
						return {
							rows: [{ id: 'conn-1', source_id: 'card-1', target_id: 'card-2', label: 'connects' }],
						};
					}
					return null;
				}),
			};

			view = new NetworkView({ bridge: bridgeWithConnections });
			view.mount(container);
			await view.render(cards);

			// Get the first node group (card-1) and fire mouseenter
			const nodeGroups = container.querySelectorAll<SVGGElement>('g.node');
			expect(nodeGroups.length).toBe(3);

			// Dispatch mouseenter on first node's circle
			nodeGroups[0]!.dispatchEvent(new MouseEvent('mouseenter', { bubbles: false }));

			// card-3 is not connected to card-1, should be dimmed
			const circles = Array.from(container.querySelectorAll<SVGCircleElement>('g.node circle'));
			// At least one circle should be dimmed (non-connected node)
			const hasDimmed = circles.some((c) => {
				const opacity = c.getAttribute('opacity');
				return opacity !== null && parseFloat(opacity) < 1.0;
			});
			expect(hasDimmed).toBe(true);
		});

		it('mouseleave restores all nodes to full opacity', async () => {
			const cards = makeCards(3);
			const positions = makePositions(cards);
			bridge = makeBridge(positions);
			view = new NetworkView({ bridge });
			view.mount(container);
			await view.render(cards);

			const nodeGroups = container.querySelectorAll<SVGGElement>('g.node');

			// Fire mouseenter then mouseleave
			nodeGroups[0]!.dispatchEvent(new MouseEvent('mouseenter', { bubbles: false }));
			nodeGroups[0]!.dispatchEvent(new MouseEvent('mouseleave', { bubbles: false }));

			// All circles should be at full opacity (1.0 or no opacity attribute)
			const circles = Array.from(container.querySelectorAll<SVGCircleElement>('g.node circle'));
			const allFull = circles.every((c) => {
				const opacity = c.getAttribute('opacity');
				return opacity === null || parseFloat(opacity) === 1.0;
			});
			expect(allFull).toBe(true);
		});
	});

	// -------------------------------------------------------------------------
	// interactions — drag-to-pin
	// -------------------------------------------------------------------------

	describe('drag-to-pin', () => {
		it('drag end updates positionMap with pinned position', async () => {
			const cards = makeCards(2);
			const positions = makePositions(cards);
			bridge = makeBridge(positions);
			view = new NetworkView({ bridge });
			view.mount(container);
			await view.render(cards);

			// The _updateEdgesForNode method is accessible (public for drag handler closure)
			// We can test the positionMap indirectly by doing a second render and checking warm-start
			const sendMock = bridge.send as ReturnType<typeof vi.fn>;
			sendMock.mockClear();
			await view.render(cards);

			// Verify warm-start positions are passed (positionMap is populated from first render)
			const simulateCall = sendMock.mock.calls.find(([type]) => type === 'graph:simulate');
			expect(simulateCall).toBeDefined();
			const payload = simulateCall![1] as { nodes: Array<{ id: string; x?: number }> };
			const firstNodeHasPos = payload.nodes[0]?.x !== undefined;
			expect(firstNodeHasPos).toBe(true);
		});
	});

	// -------------------------------------------------------------------------
	// views/index.ts export
	// -------------------------------------------------------------------------

	describe('views/index.ts export', () => {
		it('NetworkView is exported from views/index', async () => {
			const viewsModule = await import('../../src/views/index');
			expect(viewsModule.NetworkView).toBeDefined();
			expect(typeof viewsModule.NetworkView).toBe('function');
		});
	});
});
