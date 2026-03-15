// @vitest-environment jsdom
// Isometry v5 — Phase 84 Plan 05
// Tests for HistogramScrubber inline error state.
//
// Requirements: WA5

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock types
// ---------------------------------------------------------------------------

interface MockFilterProvider {
	compile: ReturnType<typeof vi.fn>;
	setRangeFilter: ReturnType<typeof vi.fn>;
	clearRangeFilter: ReturnType<typeof vi.fn>;
}

interface MockBridge {
	send: ReturnType<typeof vi.fn>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockFilter(): MockFilterProvider {
	return {
		compile: vi.fn().mockReturnValue({ where: 'deleted_at IS NULL', params: [] }),
		setRangeFilter: vi.fn(),
		clearRangeFilter: vi.fn(),
	};
}

function createMockBridge(bins: unknown[] = []): MockBridge {
	return {
		send: vi.fn().mockResolvedValue({ bins }),
	};
}

function createFailingBridge(error: Error): MockBridge {
	return {
		send: vi.fn().mockRejectedValue(error),
	};
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

let HistogramScrubber: typeof import('../../src/ui/HistogramScrubber').HistogramScrubber;

beforeEach(async () => {
	const mod = await import('../../src/ui/HistogramScrubber');
	HistogramScrubber = mod.HistogramScrubber;
});

describe('HistogramScrubber — inline error state', () => {
	let container: HTMLDivElement;
	let filter: MockFilterProvider;

	beforeEach(() => {
		container = document.createElement('div');
		document.body.appendChild(container);
		filter = createMockFilter();
	});

	afterEach(() => {
		container.remove();
		vi.restoreAllMocks();
	});

	it('shows inline error element when histogram fetch fails', async () => {
		const bridge = createFailingBridge(new Error('DB error'));
		const scrubber = new HistogramScrubber({
			field: 'amount',
			fieldType: 'numeric',
			filter: filter as any,
			bridge: bridge as any,
		});

		scrubber.mount(container);

		// Wait for the async _fetchAndRender to settle
		await vi.waitFor(() => {
			const errorEl = container.querySelector('.histogram-scrubber__error');
			expect(errorEl).not.toBeNull();
		});

		const errorEl = container.querySelector('.histogram-scrubber__error');
		expect(errorEl).not.toBeNull();

		const msgEl = container.querySelector('.histogram-scrubber__error-msg');
		expect(msgEl?.textContent).toBe('Failed to load data');

		const retryBtn = container.querySelector('.histogram-scrubber__retry');
		expect(retryBtn).not.toBeNull();

		scrubber.destroy();
	});

	it('retry button triggers re-fetch and hides error on success', async () => {
		// First call fails, second succeeds
		const bridge: MockBridge = {
			send: vi
				.fn()
				.mockRejectedValueOnce(new Error('temporary failure'))
				.mockResolvedValueOnce({ bins: [] }),
		};

		const scrubber = new HistogramScrubber({
			field: 'amount',
			fieldType: 'numeric',
			filter: filter as any,
			bridge: bridge as any,
		});

		scrubber.mount(container);

		// Wait for error state to appear
		await vi.waitFor(() => {
			expect(container.querySelector('.histogram-scrubber__error')).not.toBeNull();
		});

		const retryBtn = container.querySelector<HTMLButtonElement>('.histogram-scrubber__retry');
		expect(retryBtn).not.toBeNull();

		// Click retry
		retryBtn!.click();

		// Wait for error to be hidden after successful re-fetch
		await vi.waitFor(() => {
			const errorEl = container.querySelector<HTMLElement>('.histogram-scrubber__error');
			expect(errorEl?.style.display).toBe('none');
		});

		// bridge.send was called twice (initial + retry)
		expect(bridge.send).toHaveBeenCalledTimes(2);

		scrubber.destroy();
	});

	it('successful fetch clears any previous error state', async () => {
		// First call fails, second succeeds (triggered via update())
		const bridge: MockBridge = {
			send: vi
				.fn()
				.mockRejectedValueOnce(new Error('transient'))
				.mockResolvedValueOnce({ bins: [] }),
		};

		const scrubber = new HistogramScrubber({
			field: 'amount',
			fieldType: 'numeric',
			filter: filter as any,
			bridge: bridge as any,
		});

		scrubber.mount(container);

		// Wait for error state
		await vi.waitFor(() => {
			expect(container.querySelector('.histogram-scrubber__error')).not.toBeNull();
		});

		// Trigger update which will succeed this time
		scrubber.update();

		// Error element should be hidden after success
		await vi.waitFor(() => {
			const errorEl = container.querySelector<HTMLElement>('.histogram-scrubber__error');
			expect(errorEl?.style.display).toBe('none');
		});

		scrubber.destroy();
	});

	it('empty dataset (zero bins, no error) does not show error element', async () => {
		const bridge = createMockBridge([]); // succeeds with empty bins
		const scrubber = new HistogramScrubber({
			field: 'amount',
			fieldType: 'numeric',
			filter: filter as any,
			bridge: bridge as any,
		});

		scrubber.mount(container);

		// Wait for fetch to complete
		await vi.waitFor(() => {
			expect(bridge.send).toHaveBeenCalled();
		});

		// Give microtasks a tick to settle
		await Promise.resolve();

		const errorEl = container.querySelector('.histogram-scrubber__error');
		expect(errorEl).toBeNull();

		scrubber.destroy();
	});
});
