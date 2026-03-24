// @vitest-environment jsdom
// Isometry v9.0 — NetworkView Legend + Picker Tests (Phase 117-02)
//
// Tests for:
//   NETV-04: Legend panel visibility and content
//   NETV-05: Shortest path two-click picker + dropdown sync

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
// Legend panel tests
// ---------------------------------------------------------------------------

describe('NetworkView legend panel', () => {
	it('legend panel is hidden by default (no nv-legend--visible)', () => {
		const cards = makeCards(2);
		const positions = makePositions(cards);
		const bridge = makeBridge(positions);
		const view = new NetworkView({ bridge });
		view.mount(container);

		const legend = container.querySelector('.nv-legend');
		expect(legend).toBeTruthy();
		expect(legend?.classList.contains('nv-legend--visible')).toBe(false);

		view.destroy();
	});

	it('legend panel shows nv-legend--visible after applyAlgorithmEncoding', async () => {
		const cards = makeCards(2);
		const positions = makePositions(cards);
		const metrics: MetricsRow[] = cards.map((c) => ({
			card_id: c.id, centrality: null, pagerank: null, community_id: 0,
			clustering_coeff: null, sp_depth: null, in_spanning_tree: null,
		}));
		const bridge = makeBridge(positions, metrics);
		const view = new NetworkView({ bridge });
		view.mount(container);
		await view.render(cards);

		await view.applyAlgorithmEncoding({ algorithm: 'community' });

		const legend = container.querySelector('.nv-legend');
		expect(legend?.classList.contains('nv-legend--visible')).toBe(true);

		view.destroy();
	});

	it('legend panel is hidden after resetEncoding', async () => {
		const cards = makeCards(2);
		const positions = makePositions(cards);
		const bridge = makeBridge(positions);
		const view = new NetworkView({ bridge });
		view.mount(container);
		await view.render(cards);

		await view.applyAlgorithmEncoding({ algorithm: 'pagerank' });
		view.resetEncoding();

		const legend = container.querySelector('.nv-legend');
		expect(legend?.classList.contains('nv-legend--visible')).toBe(false);

		view.destroy();
	});

	it('legend shows community color swatches for community algorithm', async () => {
		const cards = makeCards(3);
		const positions = makePositions(cards);
		const metrics: MetricsRow[] = [
			{ card_id: 'card-1', centrality: null, pagerank: null, community_id: 0, clustering_coeff: null, sp_depth: null, in_spanning_tree: null },
			{ card_id: 'card-2', centrality: null, pagerank: null, community_id: 1, clustering_coeff: null, sp_depth: null, in_spanning_tree: null },
			{ card_id: 'card-3', centrality: null, pagerank: null, community_id: 2, clustering_coeff: null, sp_depth: null, in_spanning_tree: null },
		];
		const bridge = makeBridge(positions, metrics);
		const view = new NetworkView({ bridge });
		view.mount(container);
		await view.render(cards);

		await view.applyAlgorithmEncoding({ algorithm: 'community' });

		const swatches = container.querySelectorAll('.nv-legend__swatch');
		expect(swatches.length).toBeGreaterThan(0);
		// Should have swatches for the 3 distinct community IDs
		expect(swatches.length).toBe(3);

		view.destroy();
	});

	it('legend shows size scale bar for centrality algorithm', async () => {
		const cards = makeCards(2);
		const positions = makePositions(cards);
		const metrics: MetricsRow[] = cards.map((c) => ({
			card_id: c.id, centrality: 0.5, pagerank: null, community_id: null,
			clustering_coeff: null, sp_depth: null, in_spanning_tree: null,
		}));
		const bridge = makeBridge(positions, metrics);
		const view = new NetworkView({ bridge });
		view.mount(container);
		await view.render(cards);

		await view.applyAlgorithmEncoding({ algorithm: 'centrality' });

		const scaleBar = container.querySelector('.nv-legend__scale-bar');
		expect(scaleBar).toBeTruthy();

		view.destroy();
	});

	it('legend shows path stroke preview for shortest_path algorithm', async () => {
		const cards = makeCards(2);
		const positions = makePositions(cards);
		const bridge = makeBridge(positions);
		const view = new NetworkView({ bridge });
		view.mount(container);
		await view.render(cards);

		await view.applyAlgorithmEncoding({
			algorithm: 'shortest_path',
			pathCardIds: ['card-1', 'card-2'],
		});

		const strokePreview = container.querySelector('.nv-legend__stroke-preview');
		expect(strokePreview).toBeTruthy();
		// Should contain a line with accent color
		const line = strokePreview?.querySelector('.nv-legend__stroke-line') as HTMLElement | null;
		expect(line).toBeTruthy();
		expect(line?.style.borderTop).toContain('var(--accent)');

		view.destroy();
	});

	it('legend shows MST stroke preview for spanning_tree algorithm', async () => {
		const cards = makeCards(2);
		const positions = makePositions(cards);
		const bridge = makeBridge(positions);
		const view = new NetworkView({ bridge });
		view.mount(container);
		await view.render(cards);

		await view.applyAlgorithmEncoding({
			algorithm: 'spanning_tree',
			mstEdges: [['card-1', 'card-2']],
		});

		const strokePreview = container.querySelector('.nv-legend__stroke-preview');
		expect(strokePreview).toBeTruthy();
		const line = strokePreview?.querySelector('.nv-legend__stroke-line') as HTMLElement | null;
		expect(line).toBeTruthy();
		expect(line?.style.borderTop).toContain('var(--latch-time)');

		view.destroy();
	});

	it('legend has role=region and aria-label for accessibility', () => {
		const bridge = makeBridge([]);
		const view = new NetworkView({ bridge });
		view.mount(container);

		const legend = container.querySelector('.nv-legend');
		expect(legend?.getAttribute('role')).toBe('region');
		expect(legend?.getAttribute('aria-label')).toBe('Graph encoding legend');

		view.destroy();
	});
});

// ---------------------------------------------------------------------------
// S/T badge tests
// ---------------------------------------------------------------------------

describe('NetworkView S/T badges', () => {
	it('setPickedNodes renders nv-source-badge with aria-label "Source node"', async () => {
		const cards = makeCards(3);
		const positions = makePositions(cards);
		const bridge = makeBridge(positions);
		const view = new NetworkView({ bridge });
		view.mount(container);
		await view.render(cards);

		view.setPickedNodes('card-1', null);

		const sourceBadge = container.querySelector('.nv-source-badge');
		expect(sourceBadge).toBeTruthy();
		expect(sourceBadge?.getAttribute('aria-label')).toBe('Source node');

		view.destroy();
	});

	it('setPickedNodes renders nv-target-badge with aria-label "Target node"', async () => {
		const cards = makeCards(3);
		const positions = makePositions(cards);
		const bridge = makeBridge(positions);
		const view = new NetworkView({ bridge });
		view.mount(container);
		await view.render(cards);

		view.setPickedNodes(null, 'card-2');

		const targetBadge = container.querySelector('.nv-target-badge');
		expect(targetBadge).toBeTruthy();
		expect(targetBadge?.getAttribute('aria-label')).toBe('Target node');

		view.destroy();
	});

	it('setPickedNodes renders both source and target badges', async () => {
		const cards = makeCards(3);
		const positions = makePositions(cards);
		const bridge = makeBridge(positions);
		const view = new NetworkView({ bridge });
		view.mount(container);
		await view.render(cards);

		view.setPickedNodes('card-1', 'card-2');

		expect(container.querySelector('.nv-source-badge')).toBeTruthy();
		expect(container.querySelector('.nv-target-badge')).toBeTruthy();

		view.destroy();
	});

	it('setPickedNodes removes previous badges when called again', async () => {
		const cards = makeCards(3);
		const positions = makePositions(cards);
		const bridge = makeBridge(positions);
		const view = new NetworkView({ bridge });
		view.mount(container);
		await view.render(cards);

		view.setPickedNodes('card-1', 'card-2');
		// Clear with null
		view.setPickedNodes(null, null);

		expect(container.querySelector('.nv-source-badge')).toBeNull();
		expect(container.querySelector('.nv-target-badge')).toBeNull();

		view.destroy();
	});
});

// ---------------------------------------------------------------------------
// Pick mode tests
// ---------------------------------------------------------------------------

describe('NetworkView pick mode', () => {
	it('setPickMode sets pick mode active', () => {
		const bridge = makeBridge([]);
		const view = new NetworkView({ bridge });
		view.mount(container);

		// Should not throw
		expect(() => view.setPickMode(true)).not.toThrow();
		expect(() => view.setPickMode(false)).not.toThrow();

		view.destroy();
	});

	it('setPickClickCallback can be registered', () => {
		const bridge = makeBridge([]);
		const view = new NetworkView({ bridge });
		view.mount(container);

		const cb = vi.fn();
		expect(() => view.setPickClickCallback(cb)).not.toThrow();

		view.destroy();
	});
});

// ---------------------------------------------------------------------------
// AlgorithmExplorer pick mode integration tests
// ---------------------------------------------------------------------------

import { AlgorithmExplorer } from '../../src/ui/AlgorithmExplorer';
import type { AlgorithmExplorerConfig } from '../../src/ui/AlgorithmExplorer';
import type { WorkerBridge } from '../../src/worker/WorkerBridge';
import type { FilterProvider } from '../../src/providers/FilterProvider';
import type { SchemaProvider } from '../../src/providers/SchemaProvider';

function makeExplorerConfig(): AlgorithmExplorerConfig {
	const explorerContainer = document.createElement('div');
	document.body.appendChild(explorerContainer);

	return {
		bridge: {
			send: vi.fn().mockResolvedValue({}),
			computeGraph: vi.fn().mockResolvedValue({
				cardCount: 0, edgeCount: 0, algorithmsComputed: [], durationMs: 0,
				renderToken: 0, componentCount: 0,
			}),
			searchCards: vi.fn().mockResolvedValue([]),
			sendWithTransfer: vi.fn().mockResolvedValue({}),
		} as unknown as WorkerBridge,
		schema: {
			addGraphMetricColumns: vi.fn(),
		} as unknown as SchemaProvider,
		filter: {
			compile: vi.fn().mockReturnValue({ where: 'deleted_at IS NULL', params: [] }),
		} as unknown as FilterProvider,
		container: explorerContainer,
		coordinator: { scheduleUpdate: vi.fn() },
	};
}

describe('AlgorithmExplorer shortest path pick mode', () => {
	let explorerEl: HTMLElement;

	beforeEach(() => {
		explorerEl = document.createElement('div');
		document.body.appendChild(explorerEl);
	});

	afterEach(() => {
		explorerEl.remove();
	});

	it('renders source/target dropdowns when shortest_path selected', () => {
		const config = makeExplorerConfig();
		const explorer = new AlgorithmExplorer(config);
		explorer.mount();

		// Switch to shortest_path
		const radios = config.container.querySelectorAll<HTMLInputElement>('input[type="radio"]');
		const spRadio = Array.from(radios).find((r) => r.value === 'shortest_path');
		expect(spRadio).toBeTruthy();
		spRadio!.checked = true;
		spRadio!.dispatchEvent(new Event('change'));

		const dropdowns = config.container.querySelector('.nv-pick-dropdowns');
		expect(dropdowns).toBeTruthy();
		const sourceSelect = config.container.querySelector<HTMLSelectElement>('#sp-source');
		const targetSelect = config.container.querySelector<HTMLSelectElement>('#sp-target');
		expect(sourceSelect).toBeTruthy();
		expect(targetSelect).toBeTruthy();

		explorer.destroy();
		config.container.remove();
	});

	it('pick instruction has role=status and aria-live=polite', () => {
		const config = makeExplorerConfig();
		const explorer = new AlgorithmExplorer(config);
		explorer.mount();

		// Switch to shortest_path
		const radios = config.container.querySelectorAll<HTMLInputElement>('input[type="radio"]');
		const spRadio = Array.from(radios).find((r) => r.value === 'shortest_path');
		spRadio!.checked = true;
		spRadio!.dispatchEvent(new Event('change'));

		const instruction = config.container.querySelector('.nv-pick-instruction');
		expect(instruction?.getAttribute('role')).toBe('status');
		expect(instruction?.getAttribute('aria-live')).toBe('polite');

		explorer.destroy();
		config.container.remove();
	});

	it('nodeClicked updates pick mode to pick-target and sets source dropdown', () => {
		const config = makeExplorerConfig();
		const explorer = new AlgorithmExplorer(config);
		explorer.mount();

		// Switch to shortest_path
		const radios = config.container.querySelectorAll<HTMLInputElement>('input[type="radio"]');
		const spRadio = Array.from(radios).find((r) => r.value === 'shortest_path');
		spRadio!.checked = true;
		spRadio!.dispatchEvent(new Event('change'));

		// Set card names so dropdowns have options
		explorer.setCardNames([
			{ id: 'card-1', name: 'Card 1' },
			{ id: 'card-2', name: 'Card 2' },
		]);

		const pickModeCb = vi.fn();
		explorer.onPickModeChange(pickModeCb);

		explorer.nodeClicked('card-1', 'Card 1');

		expect(pickModeCb).toHaveBeenCalled();
		const [mode, sourceId] = pickModeCb.mock.calls[0] as [string, string | null, string | null];
		expect(sourceId).toBe('card-1');
		// After first click, should be in pick-target
		expect(mode).toBe('pick-target');

		explorer.destroy();
		config.container.remove();
	});

	it('nodeClicked sets target and enters ready state when both nodes selected', () => {
		const config = makeExplorerConfig();
		const explorer = new AlgorithmExplorer(config);
		explorer.mount();

		// Switch to shortest_path
		const radios = config.container.querySelectorAll<HTMLInputElement>('input[type="radio"]');
		const spRadio = Array.from(radios).find((r) => r.value === 'shortest_path');
		spRadio!.checked = true;
		spRadio!.dispatchEvent(new Event('change'));

		explorer.setCardNames([
			{ id: 'card-1', name: 'Card 1' },
			{ id: 'card-2', name: 'Card 2' },
		]);

		const pickModeCb = vi.fn();
		explorer.onPickModeChange(pickModeCb);

		explorer.nodeClicked('card-1', 'Card 1'); // source
		explorer.nodeClicked('card-2', 'Card 2'); // target

		// Second call should be 'ready'
		const lastCall = pickModeCb.mock.calls[pickModeCb.mock.calls.length - 1] as [string, string | null, string | null];
		expect(lastCall[0]).toBe('ready');
		expect(lastCall[1]).toBe('card-1');
		expect(lastCall[2]).toBe('card-2');

		explorer.destroy();
		config.container.remove();
	});

	it('Reset button clears pick state and invokes onReset callback', () => {
		const config = makeExplorerConfig();
		const explorer = new AlgorithmExplorer(config);
		explorer.mount();

		// Switch to shortest_path
		const radios = config.container.querySelectorAll<HTMLInputElement>('input[type="radio"]');
		const spRadio = Array.from(radios).find((r) => r.value === 'shortest_path');
		spRadio!.checked = true;
		spRadio!.dispatchEvent(new Event('change'));

		const resetCb = vi.fn();
		explorer.onReset(resetCb);
		const pickModeCb = vi.fn();
		explorer.onPickModeChange(pickModeCb);

		// Set source
		explorer.nodeClicked('card-1', 'Card 1');

		// Click Reset
		const resetBtn = config.container.querySelector<HTMLButtonElement>('[data-testid="algorithm-reset"]');
		expect(resetBtn).toBeTruthy();
		resetBtn!.click();

		expect(resetCb).toHaveBeenCalled();
		// pick mode should be idle after reset
		const lastPickCall = pickModeCb.mock.calls[pickModeCb.mock.calls.length - 1] as [string, string | null, string | null];
		expect(lastPickCall[0]).toBe('idle');
		expect(lastPickCall[1]).toBeNull();
		expect(lastPickCall[2]).toBeNull();

		explorer.destroy();
		config.container.remove();
	});
});
