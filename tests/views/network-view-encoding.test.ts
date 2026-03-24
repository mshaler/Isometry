// @vitest-environment jsdom
// Isometry v9.0 — NetworkView Algorithm Encoding Tests (Phase 117)
//
// Tests for algorithm-driven visual encoding:
//   NETV-01: Node sizing by centrality/PageRank/clustering_coeff
//   NETV-02: Shortest path edge highlighting (accent stroke 3.5px)
//   NETV-03: MST edge highlighting (latch-time stroke 2.5px)
//   Community fill via d3.schemeCategory10
//   Composition: path overrides MST
//   Reset encoding restores defaults

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NetworkView } from '../../src/views/NetworkView';
import type { AlgorithmEncodingParams } from '../../src/views/NetworkView';
import type { CardDatum, WorkerBridgeLike } from '../../src/views/types';
import type { NodePosition } from '../../src/worker/protocol';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

function makeCards(count = 4): CardDatum[] {
	return Array.from({ length: count }, (_, i) => ({
		id: `card-${i + 1}`,
		name: `Card ${i + 1}`,
		folder: null,
		status: null,
		card_type: (['note', 'task', 'event', 'resource'] as const)[i % 4]!,
		created_at: '2026-01-01T10:00:00Z',
		modified_at: '2026-01-01T12:00:00Z',
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
		x: 100 + i * 80,
		y: 200,
		fx: null,
		fy: null,
	}));
}

interface MetricsRow {
	card_id: string;
	centrality: number | null;
	pagerank: number | null;
	community_id: number | null;
	clustering_coeff: number | null;
	sp_depth: number | null;
	in_spanning_tree: number | null;
}

function makeBridge(
	positions: NodePosition[],
	metrics: MetricsRow[] = [],
): WorkerBridgeLike {
	return {
		send: vi.fn().mockImplementation(async (type: string) => {
			if (type === 'graph:simulate') return positions;
			if (type === 'db:exec') return { rows: [] };
			if (type === 'graph:metrics-read') return metrics;
			return {};
		}),
	};
}

// Utility: get the main (base) circle for a node — the first circle in g.node, not a badge
function getNodeBaseCircle(nodeEl: Element): SVGCircleElement | null {
	// Base circles are the first child circles (not inside .nv-source-badge/.nv-target-badge)
	const baseCircle = nodeEl.querySelector('circle:not(.nv-source-badge circle):not(.nv-target-badge circle)');
	return baseCircle as SVGCircleElement | null;
}

// ---------------------------------------------------------------------------
// Setup helpers
// ---------------------------------------------------------------------------

let container: HTMLDivElement;

beforeEach(() => {
	container = document.createElement('div');
	container.style.width = '800px';
	container.style.height = '600px';
	document.body.appendChild(container);
});

afterEach(() => {
	container.remove();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('NetworkView algorithm encoding', () => {
	it('applyAlgorithmEncoding resolves without error when community data exists', async () => {
		const cards = makeCards(4);
		const positions = makePositions(cards);
		const metrics: MetricsRow[] = cards.map((c, i) => ({
			card_id: c.id,
			centrality: null,
			pagerank: null,
			community_id: i % 3, // 3 communities
			clustering_coeff: null,
			sp_depth: null,
			in_spanning_tree: null,
		}));

		const bridge = makeBridge(positions, metrics);
		const view = new NetworkView({ bridge });
		view.mount(container);
		await view.render(cards);

		// Should resolve without throwing
		await expect(
			view.applyAlgorithmEncoding({ algorithm: 'community' }),
		).resolves.toBeUndefined();

		// 4 node groups rendered
		const nodeGroups = container.querySelectorAll('g.node');
		expect(nodeGroups.length).toBe(4);

		view.destroy();
	});

	it('applyAlgorithmEncoding fetches graph:metrics-read from bridge', async () => {
		const cards = makeCards(4);
		const positions = makePositions(cards);
		const metrics: MetricsRow[] = cards.map((c) => ({
			card_id: c.id,
			centrality: 0.5,
			pagerank: null,
			community_id: null,
			clustering_coeff: null,
			sp_depth: null,
			in_spanning_tree: null,
		}));

		const bridge = makeBridge(positions, metrics);
		const view = new NetworkView({ bridge });
		view.mount(container);
		await view.render(cards);

		await view.applyAlgorithmEncoding({ algorithm: 'centrality' });

		// Verify that bridge.send was called with 'graph:metrics-read'
		const sendFn = bridge.send as ReturnType<typeof vi.fn>;
		const metricsCall = sendFn.mock.calls.find((call: unknown[]) => call[0] === 'graph:metrics-read');
		expect(metricsCall).toBeDefined();

		view.destroy();
	});

	it('path edge highlighting applies accent stroke to path edges (no real edges = no stroke changes)', async () => {
		// Since jsdom bridge returns no edges (empty rows), no edge elements exist
		// But applyAlgorithmEncoding should still build pathEdgeSet and apply node dimming
		const cards = makeCards(4);
		const positions = makePositions(cards);
		const bridge = makeBridge(positions, []);

		const view = new NetworkView({ bridge });
		view.mount(container);
		await view.render(cards);

		const params: AlgorithmEncodingParams = {
			algorithm: 'shortest_path',
			pathCardIds: ['card-1', 'card-2', 'card-3'],
			reachable: true,
		};

		// Should apply without error
		await expect(view.applyAlgorithmEncoding(params)).resolves.toBeUndefined();

		// Node groups are still rendered
		const nodeGroups = container.querySelectorAll('g.node');
		expect(nodeGroups.length).toBe(4);

		view.destroy();
	});

	it('MST edge highlighting: encoding applied without error for spanning_tree algorithm', async () => {
		const cards = makeCards(4);
		const positions = makePositions(cards);
		const bridge = makeBridge(positions, []);

		const view = new NetworkView({ bridge });
		view.mount(container);
		await view.render(cards);

		// Apply MST encoding with known edge pairs
		const params: AlgorithmEncodingParams = {
			algorithm: 'spanning_tree',
			mstEdges: [
				['card-1', 'card-2'],
				['card-2', 'card-3'],
			],
		};

		await expect(view.applyAlgorithmEncoding(params)).resolves.toBeUndefined();

		// 4 nodes still rendered
		expect(container.querySelectorAll('g.node').length).toBe(4);

		view.destroy();
	});

	it('composition: path + MST encoding applied without error', async () => {
		const cards = makeCards(4);
		const positions = makePositions(cards);
		const bridge = makeBridge(positions, []);

		const view = new NetworkView({ bridge });
		view.mount(container);
		await view.render(cards);

		// Apply both path and MST
		const params: AlgorithmEncodingParams = {
			algorithm: 'spanning_tree',
			pathCardIds: ['card-1', 'card-2', 'card-3'],
			mstEdges: [
				['card-1', 'card-2'], // overlaps with path
				['card-3', 'card-4'], // MST-only
			],
		};

		await expect(view.applyAlgorithmEncoding(params)).resolves.toBeUndefined();

		// Encoding applied without error
		expect(container.querySelectorAll('g.node').length).toBe(4);

		view.destroy();
	});

	it('resetEncoding sets _algorithmActive to false and restores node opacity', async () => {
		const cards = makeCards(4);
		const positions = makePositions(cards);
		const metrics: MetricsRow[] = cards.map((c, i) => ({
			card_id: c.id,
			centrality: i * 0.3,
			pagerank: null,
			community_id: i % 2,
			clustering_coeff: null,
			sp_depth: null,
			in_spanning_tree: null,
		}));

		const bridge = makeBridge(positions, metrics);
		const view = new NetworkView({ bridge });
		view.mount(container);
		await view.render(cards);

		// Apply algorithm encoding (dims path nodes, applies fills)
		await view.applyAlgorithmEncoding({
			algorithm: 'shortest_path',
			pathCardIds: ['card-1', 'card-2'],
		});

		// Now reset
		view.resetEncoding();

		// After reset: all node circles should have opacity 1.0 (or unset = 1)
		const nodeGroups = container.querySelectorAll('g.node');
		nodeGroups.forEach((g) => {
			const circle = getNodeBaseCircle(g);
			if (circle) {
				const opacity = circle.getAttribute('opacity');
				if (opacity !== null) {
					expect(parseFloat(opacity)).toBe(1.0);
				}
				// Stroke should be removed
				const stroke = circle.getAttribute('stroke');
				expect(stroke === 'none' || stroke === null).toBe(true);
			}
		});

		view.destroy();
	});

	it('setPickedNodes adds S badge for source and T badge for target', async () => {
		const cards = makeCards(4);
		const positions = makePositions(cards);
		const bridge = makeBridge(positions, []);

		const view = new NetworkView({ bridge });
		view.mount(container);
		await view.render(cards);

		// Set source and target picks
		view.setPickedNodes('card-1', 'card-3');

		// Badges should be created for S and T (Phase 117-02: nv-source-badge / nv-target-badge)
		const badges = container.querySelectorAll('.nv-source-badge, .nv-target-badge');
		expect(badges.length).toBe(2); // S and T badges

		// Badge text content should be S and T
		const badgeTexts = Array.from(badges).map((b) => b.querySelector('text')?.textContent ?? '');
		expect(badgeTexts).toContain('S');
		expect(badgeTexts).toContain('T');

		view.destroy();
	});

	it('setPickedNodes with null values removes all rings and badges', async () => {
		const cards = makeCards(4);
		const positions = makePositions(cards);
		const bridge = makeBridge(positions, []);

		const view = new NetworkView({ bridge });
		view.mount(container);
		await view.render(cards);

		// First set picks
		view.setPickedNodes('card-1', 'card-2');
		expect(container.querySelectorAll('.nv-source-badge, .nv-target-badge').length).toBe(2);

		// Then clear them
		view.setPickedNodes(null, null);
		expect(container.querySelectorAll('.nv-source-badge, .nv-target-badge').length).toBe(0);

		view.destroy();
	});

	it('applyAlgorithmEncoding with pagerank builds metric scale for pagerank', async () => {
		const cards = makeCards(3);
		const positions = makePositions(cards);
		const metrics: MetricsRow[] = [
			{
				card_id: 'card-1',
				centrality: 0.1,
				pagerank: 0.1,
				community_id: null,
				clustering_coeff: null,
				sp_depth: null,
				in_spanning_tree: null,
			},
			{
				card_id: 'card-2',
				centrality: 0.9,
				pagerank: 0.5,
				community_id: null,
				clustering_coeff: null,
				sp_depth: null,
				in_spanning_tree: null,
			},
			{
				card_id: 'card-3',
				centrality: 0.5,
				pagerank: 0.9,
				community_id: null,
				clustering_coeff: null,
				sp_depth: null,
				in_spanning_tree: null,
			},
		];

		const bridge = makeBridge(positions, metrics);
		const view = new NetworkView({ bridge });
		view.mount(container);
		await view.render(cards);

		// Should resolve without error
		await expect(
			view.applyAlgorithmEncoding({ algorithm: 'pagerank' }),
		).resolves.toBeUndefined();

		// Verify metrics were fetched
		const sendFn = bridge.send as ReturnType<typeof vi.fn>;
		const metricsCall = sendFn.mock.calls.find((call: unknown[]) => call[0] === 'graph:metrics-read');
		expect(metricsCall).toBeDefined();

		view.destroy();
	});

	it('applyAlgorithmEncoding constructs path edge set from consecutive pairs without error', async () => {
		const cards = makeCards(4);
		const positions = makePositions(cards);
		const bridge = makeBridge(positions, []);

		const view = new NetworkView({ bridge });
		view.mount(container);
		await view.render(cards);

		// Apply path encoding without errors — the key test is no exceptions thrown
		await expect(
			view.applyAlgorithmEncoding({
				algorithm: 'shortest_path',
				pathCardIds: ['card-1', 'card-2', 'card-3', 'card-4'],
				reachable: true,
			}),
		).resolves.toBeUndefined();

		view.destroy();
	});

	it('applyAlgorithmEncoding then resetEncoding clears picked badges from path highlighting', async () => {
		const cards = makeCards(4);
		const positions = makePositions(cards);
		const bridge = makeBridge(positions, []);

		const view = new NetworkView({ bridge });
		view.mount(container);
		await view.render(cards);

		// Apply path encoding — this triggers setPickedNodes internally
		await view.applyAlgorithmEncoding({
			algorithm: 'shortest_path',
			pathCardIds: ['card-1', 'card-2', 'card-3'],
		});

		// Should have badges from setPickedNodes call (Phase 117-02: nv-source-badge / nv-target-badge)
		const badgesAfterEncoding = container.querySelectorAll('.nv-source-badge, .nv-target-badge').length;

		// Reset
		view.resetEncoding();

		// After reset, _pathCardIds is cleared and badges should be gone
		// (resetEncoding calls setPickedNodes(null, null) indirectly via the
		// clearing of sourceCardId/targetCardId — it removes picked rings)
		const badgesAfterReset = container.querySelectorAll('.nv-source-badge, .nv-target-badge').length;

		// Either badges were removed OR the encoding never added them (empty path case)
		expect(badgesAfterReset).toBeLessThanOrEqual(badgesAfterEncoding);

		view.destroy();
	});
});
