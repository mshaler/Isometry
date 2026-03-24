// @vitest-environment jsdom
// Isometry v9.0 — Phase 116 Plan 02
// Tests for AlgorithmExplorer render, selection, params, Run dispatch, and destroy.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AlgorithmExplorer } from '../../src/ui/AlgorithmExplorer';

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

function makeMockBridge() {
	return {
		computeGraph: vi.fn().mockResolvedValue({
			cardCount: 10,
			edgeCount: 15,
			algorithmsComputed: ['pagerank'],
			durationMs: 42,
			renderToken: 1,
			componentCount: 1,
		}),
		send: vi.fn().mockResolvedValue({ columns: ['id'], rows: [] }),
	} as any;
}

function makeMockSchema() {
	return {
		addGraphMetricColumns: vi.fn(),
		hasGraphMetrics: vi.fn().mockReturnValue(false),
	} as any;
}

function makeMockFilter() {
	return {
		compile: vi.fn().mockReturnValue({ where: 'deleted_at IS NULL', params: [] }),
	} as any;
}

function makeMockCoordinator() {
	return {
		scheduleUpdate: vi.fn(),
	};
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AlgorithmExplorer', () => {
	let container: HTMLElement;
	let bridge: ReturnType<typeof makeMockBridge>;
	let schema: ReturnType<typeof makeMockSchema>;
	let filter: ReturnType<typeof makeMockFilter>;
	let coordinator: ReturnType<typeof makeMockCoordinator>;
	let explorer: AlgorithmExplorer;

	beforeEach(() => {
		container = document.createElement('div');
		document.body.appendChild(container);
		bridge = makeMockBridge();
		schema = makeMockSchema();
		filter = makeMockFilter();
		coordinator = makeMockCoordinator();

		explorer = new AlgorithmExplorer({
			bridge,
			schema,
			filter,
			container,
			coordinator,
		});
		explorer.mount();
	});

	afterEach(() => {
		explorer.destroy();
		container.remove();
	});

	// -----------------------------------------------------------------------
	// Render
	// -----------------------------------------------------------------------

	it('mount renders 6 radio inputs', () => {
		const radios = container.querySelectorAll('input[type=radio][name=algorithm]');
		expect(radios.length).toBe(6);
	});

	it('default selection is pagerank', () => {
		expect(explorer.getSelectedAlgorithm()).toBe('pagerank');
	});

	it('Run button has data-testid', () => {
		const btn = container.querySelector('[data-testid=algorithm-run]');
		expect(btn).not.toBeNull();
	});

	// -----------------------------------------------------------------------
	// Algorithm selection and parameter controls
	// -----------------------------------------------------------------------

	it('selecting community shows resolution slider', () => {
		const communityRadio = container.querySelector('input[value=community]') as HTMLInputElement;
		communityRadio.checked = true;
		communityRadio.dispatchEvent(new Event('change'));

		const slider = container.querySelector('[data-testid=louvain-resolution]');
		expect(slider).not.toBeNull();
	});

	it('selecting pagerank shows damping factor input', () => {
		const radio = container.querySelector('input[value=pagerank]') as HTMLInputElement;
		radio.checked = true;
		radio.dispatchEvent(new Event('change'));

		const input = container.querySelector('[data-testid=pagerank-alpha]');
		expect(input).not.toBeNull();
	});

	it('selecting centrality shows threshold input', () => {
		const radio = container.querySelector('input[value=centrality]') as HTMLInputElement;
		radio.checked = true;
		radio.dispatchEvent(new Event('change'));

		const input = container.querySelector('[data-testid=centrality-threshold]');
		expect(input).not.toBeNull();
	});

	it('selecting shortest_path shows pick instruction and dropdowns', () => {
		const radio = container.querySelector('input[value=shortest_path]') as HTMLInputElement;
		radio.checked = true;
		radio.dispatchEvent(new Event('change'));

		const paramsContainer = container.querySelector('.algorithm-explorer__params');
		// Phase 117-02: shortest_path now renders nv-pick-instruction + nv-pick-dropdowns
		expect(paramsContainer?.querySelector('.nv-pick-instruction')).not.toBeNull();
		expect(paramsContainer?.querySelector('.nv-pick-dropdowns')).not.toBeNull();
	});

	it('getSelectedAlgorithm updates when radio changes', () => {
		const radio = container.querySelector('input[value=community]') as HTMLInputElement;
		radio.checked = true;
		radio.dispatchEvent(new Event('change'));
		expect(explorer.getSelectedAlgorithm()).toBe('community');
	});

	// -----------------------------------------------------------------------
	// Run dispatch
	// -----------------------------------------------------------------------

	it('Run calls computeGraph with selected algorithm', async () => {
		// Select community
		const radio = container.querySelector('input[value=community]') as HTMLInputElement;
		radio.checked = true;
		radio.dispatchEvent(new Event('change'));

		// Click Run
		const runBtn = container.querySelector('[data-testid=algorithm-run]') as HTMLButtonElement;
		runBtn.click();

		// Wait for async
		await vi.waitFor(() => {
			expect(bridge.computeGraph).toHaveBeenCalledTimes(1);
		});

		const call = bridge.computeGraph.mock.calls[0]![0];
		expect(call.algorithms).toEqual(['community']);
		expect(call.params?.community?.resolution).toBe(1.0);
	});

	it('Run calls addGraphMetricColumns after successful compute', async () => {
		const runBtn = container.querySelector('[data-testid=algorithm-run]') as HTMLButtonElement;
		runBtn.click();

		await vi.waitFor(() => {
			expect(schema.addGraphMetricColumns).toHaveBeenCalledTimes(1);
		});
	});

	it('Run calls coordinator.scheduleUpdate after successful compute', async () => {
		const runBtn = container.querySelector('[data-testid=algorithm-run]') as HTMLButtonElement;
		runBtn.click();

		await vi.waitFor(() => {
			expect(coordinator.scheduleUpdate).toHaveBeenCalledTimes(1);
		});
	});

	// -----------------------------------------------------------------------
	// Destroy
	// -----------------------------------------------------------------------

	it('destroy removes the container content', () => {
		explorer.destroy();
		expect(container.children.length).toBe(0);
	});
});
