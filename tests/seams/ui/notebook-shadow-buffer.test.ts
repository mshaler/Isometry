// @vitest-environment jsdom
// Seam tests: NotebookExplorer shadow-buffer architecture with MutationManager integration
// Phase 91 Plan 01 — EDIT-01, EDIT-02, EDIT-03, EDIT-04, EDIT-06, EDIT-07
//
// Tests the 6 shadow-buffer behaviors:
// 1. Title blur with changed value calls MutationManager.execute()
// 2. Content blur with changed value calls MutationManager.execute()
// 3. Title blur with UNCHANGED value does NOT call MutationManager.execute()
// 4. Card switch flushes pending buffer changes before loading new card snapshot
// 5. MutationManager subscriber fires, card:get returns null → reset to idle
// 6. Snapshot loaded via bridge.send('card:get') stored as _snapshot: Card

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Card } from '../../../src/database/queries/types';
import type { MutationManager } from '../../../src/mutations/MutationManager';
import type { Mutation } from '../../../src/mutations/types';
import { NotebookExplorer } from '../../../src/ui/NotebookExplorer';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeCard(overrides: Partial<Card> = {}): Card {
	return {
		id: 'card-abc-123',
		card_type: 'note',
		name: 'My Test Card',
		content: 'Initial content',
		summary: null,
		latitude: null,
		longitude: null,
		location_name: null,
		created_at: '2026-01-01T00:00:00.000Z',
		modified_at: '2026-01-01T00:00:00.000Z',
		due_at: null,
		completed_at: null,
		event_start: null,
		event_end: null,
		folder: null,
		tags: [],
		status: null,
		priority: 0,
		sort_order: 0,
		url: null,
		mime_type: null,
		is_collective: false,
		source: null,
		source_id: null,
		source_url: null,
		deleted_at: null,
		...overrides,
	};
}

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

function makeMockBridge(cardOrNull: Card | null = makeCard()) {
	return {
		send: vi.fn(async (type: string, _payload?: unknown) => {
			if (type === 'card:get') return cardOrNull;
			if (type === 'ui:get') return { value: null };
			if (type === 'ui:set') return undefined;
			return undefined;
		}),
		exec: vi.fn(async () => ({ changes: 1 })),
	};
}

function makeMockMutationManager() {
	let _subscriber: (() => void) | null = null;
	const executedMutations: Mutation[] = [];

	const manager = {
		execute: vi.fn(async (mutation: Mutation) => {
			executedMutations.push(mutation);
		}),
		subscribe: vi.fn((cb: () => void) => {
			_subscriber = cb;
			return () => {
				_subscriber = null;
			};
		}),
		isDirty: vi.fn(() => false),
		// Test helper: fire the subscriber
		_fireSubscriber() {
			_subscriber?.();
		},
		_executedMutations: executedMutations,
	};

	return manager;
}

function makeMockSelection(initialId: string | null = 'card-abc-123') {
	let _currentId: string | null = initialId;
	let _subscriber: (() => void) | null = null;

	return {
		getSelectedIds: vi.fn(() => (_currentId !== null ? [_currentId] : [])),
		subscribe: vi.fn((cb: () => void) => {
			_subscriber = cb;
			return () => {
				_subscriber = null;
			};
		}),
		// Test helper: change selection and fire
		_selectCard(id: string | null) {
			_currentId = id;
			_subscriber?.();
		},
	};
}

function makeMockFilter() {
	return {
		subscribe: vi.fn(() => () => {}),
		getFilterState: vi.fn(() => ({})),
	};
}

function makeMockAlias() {
	return {
		resolve: vi.fn((field: string) => field),
	};
}

// ---------------------------------------------------------------------------
// Helper: mount explorer and wait for initial selection load
// ---------------------------------------------------------------------------

async function mountExplorer(opts: {
	card?: Card | null;
	mutationManager?: ReturnType<typeof makeMockMutationManager>;
	selection?: ReturnType<typeof makeMockSelection>;
	bridge?: ReturnType<typeof makeMockBridge>;
}) {
	const card = opts.card !== undefined ? opts.card : makeCard();
	const bridge = opts.bridge ?? makeMockBridge(card);
	const mutationManager = opts.mutationManager ?? makeMockMutationManager();
	const selection = opts.selection ?? makeMockSelection('card-abc-123');
	const filter = makeMockFilter();
	const alias = makeMockAlias();

	const container = document.createElement('div');
	document.body.appendChild(container);

	const explorer = new NotebookExplorer({
		bridge: bridge as unknown as import('../../../src/worker/WorkerBridge').WorkerBridge,
		selection: selection as unknown as import('../../../src/providers/SelectionProvider').SelectionProvider,
		filter: filter as unknown as import('../../../src/providers/FilterProvider').FilterProvider,
		alias: alias as unknown as import('../../../src/providers/AliasProvider').AliasProvider,
		mutations: mutationManager as unknown as MutationManager,
	});

	explorer.mount(container);

	// Wait for the initial async selection load to complete
	await vi.waitFor(
		() => {
			// bridge.send('card:get') should have been called at least once
			expect(bridge.send).toHaveBeenCalledWith('card:get', { id: 'card-abc-123' });
		},
		{ timeout: 500 },
	);

	// Additional tick to allow async work to settle
	await Promise.resolve();

	return { explorer, bridge, mutationManager, selection, container };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('NotebookExplorer — shadow-buffer architecture', () => {
	beforeEach(() => {
		// Clean up DOM between tests
		document.body.innerHTML = '';
	});

	// -----------------------------------------------------------------------
	// Test 1: Title blur with changed value calls MutationManager.execute()
	// -----------------------------------------------------------------------
	it('Test 1: title blur with changed value calls MutationManager.execute() with updateCardMutation', async () => {
		const mutationManager = makeMockMutationManager();
		const { container } = await mountExplorer({ mutationManager });

		// Find the title input
		const titleInput = container.querySelector('.notebook-explorer__title-input') as HTMLInputElement;
		expect(titleInput).not.toBeNull();
		expect(titleInput.value).toBe('My Test Card');

		// Change the title
		titleInput.value = 'New Title';
		titleInput.dispatchEvent(new Event('blur'));

		// Wait for async commit
		await vi.waitFor(
			() => {
				expect(mutationManager.execute).toHaveBeenCalledTimes(1);
			},
			{ timeout: 500 },
		);

		// Verify the mutation's forward SQL contains UPDATE cards SET name = ?
		const mutation = mutationManager._executedMutations[0];
		expect(mutation).toBeDefined();
		expect(mutation!.forward).toHaveLength(1);
		expect(mutation!.forward[0]!.sql).toMatch(/UPDATE cards SET name = \?/);
		expect(mutation!.forward[0]!.params).toContain('New Title');
	});

	// -----------------------------------------------------------------------
	// Test 2: Content blur with changed value calls MutationManager.execute()
	// -----------------------------------------------------------------------
	it('Test 2: content blur with changed value calls MutationManager.execute() with updateCardMutation', async () => {
		const mutationManager = makeMockMutationManager();
		const { container } = await mountExplorer({ mutationManager });

		// Find the textarea
		const textarea = container.querySelector('.notebook-explorer__textarea') as HTMLTextAreaElement;
		expect(textarea).not.toBeNull();
		expect(textarea.value).toBe('Initial content');

		// Change the content
		textarea.value = 'New content here';
		textarea.dispatchEvent(new Event('blur'));

		// Wait for async commit
		await vi.waitFor(
			() => {
				expect(mutationManager.execute).toHaveBeenCalledTimes(1);
			},
			{ timeout: 500 },
		);

		// Verify the mutation's forward SQL contains UPDATE cards SET content = ?
		const mutation = mutationManager._executedMutations[0];
		expect(mutation).toBeDefined();
		expect(mutation!.forward).toHaveLength(1);
		expect(mutation!.forward[0]!.sql).toMatch(/UPDATE cards SET content = \?/);
		expect(mutation!.forward[0]!.params).toContain('New content here');
	});

	// -----------------------------------------------------------------------
	// Test 3: Title blur with UNCHANGED value does NOT call MutationManager.execute()
	// -----------------------------------------------------------------------
	it('Test 3: title blur with unchanged value is a no-op (MutationManager.execute NOT called)', async () => {
		const mutationManager = makeMockMutationManager();
		const { container } = await mountExplorer({ mutationManager });

		// Find title input — value should match snapshot name
		const titleInput = container.querySelector('.notebook-explorer__title-input') as HTMLInputElement;
		expect(titleInput.value).toBe('My Test Card');

		// Blur WITHOUT changing the value
		titleInput.dispatchEvent(new Event('blur'));

		// Short wait — execute should NOT be called
		await new Promise((r) => setTimeout(r, 50));
		expect(mutationManager.execute).not.toHaveBeenCalled();
	});

	// -----------------------------------------------------------------------
	// Test 4: Card switch flushes pending buffer changes before loading new card
	// -----------------------------------------------------------------------
	it('Test 4: card switch commits pending title change before loading new card snapshot', async () => {
		const card1 = makeCard({ id: 'card-1', name: 'Card One', content: 'Content one' });
		const card2 = makeCard({ id: 'card-2', name: 'Card Two', content: 'Content two' });

		const mutationManager = makeMockMutationManager();
		const selection = makeMockSelection('card-1');

		// Bridge: return different cards based on which card is selected
		const bridge = {
			send: vi.fn(async (type: string, payload?: unknown) => {
				if (type === 'card:get') {
					const p = payload as { id: string };
					if (p.id === 'card-1') return card1;
					if (p.id === 'card-2') return card2;
					return null;
				}
				return null;
			}),
			exec: vi.fn(async () => ({ changes: 1 })),
		};

		const filter = makeMockFilter();
		const alias = makeMockAlias();
		const container = document.createElement('div');
		document.body.appendChild(container);

		const explorer = new NotebookExplorer({
			bridge: bridge as unknown as import('../../../src/worker/WorkerBridge').WorkerBridge,
			selection: selection as unknown as import('../../../src/providers/SelectionProvider').SelectionProvider,
			filter: filter as unknown as import('../../../src/providers/FilterProvider').FilterProvider,
			alias: alias as unknown as import('../../../src/providers/AliasProvider').AliasProvider,
			mutations: mutationManager as unknown as MutationManager,
		});

		explorer.mount(container);

		// Wait for card-1 to load
		await vi.waitFor(
			() => {
				expect(bridge.send).toHaveBeenCalledWith('card:get', { id: 'card-1' });
			},
			{ timeout: 500 },
		);
		await Promise.resolve();

		// Modify title in the buffer (without blurring)
		const titleInput = container.querySelector('.notebook-explorer__title-input') as HTMLInputElement;
		expect(titleInput.value).toBe('Card One');
		titleInput.value = 'Modified Card One';
		// Note: no blur event — buffer changed but not committed

		// Switch to card-2 — this should trigger flush of card-1's pending changes
		selection._selectCard('card-2');

		// Wait for card-2 to load and flush to complete
		await vi.waitFor(
			() => {
				expect(bridge.send).toHaveBeenCalledWith('card:get', { id: 'card-2' });
			},
			{ timeout: 500 },
		);
		await Promise.resolve();
		await Promise.resolve();

		// execute() should have been called with the title change for card-1
		expect(mutationManager.execute).toHaveBeenCalledTimes(1);
		const mutation = mutationManager._executedMutations[0];
		expect(mutation!.forward[0]!.sql).toMatch(/UPDATE cards SET name = \?/);
		expect(mutation!.forward[0]!.params).toContain('Modified Card One');

		// title input should now show card-2's name
		await vi.waitFor(
			() => {
				expect(titleInput.value).toBe('Card Two');
			},
			{ timeout: 500 },
		);
	});

	// -----------------------------------------------------------------------
	// Test 5: MutationManager subscriber fires, card:get returns null → idle state
	// -----------------------------------------------------------------------
	it('Test 5: MutationManager subscriber fires + card:get returns null → reset to idle state', async () => {
		const mutationManager = makeMockMutationManager();

		// First call returns the card (initial load), subsequent calls return null (card deleted)
		let callCount = 0;
		const bridge = {
			send: vi.fn(async (type: string, _payload?: unknown) => {
				if (type === 'card:get') {
					callCount++;
					if (callCount === 1) return makeCard(); // Initial load succeeds
					return null; // Card deleted
				}
				return null;
			}),
			exec: vi.fn(async () => ({ changes: 1 })),
		};

		const selection = makeMockSelection('card-abc-123');
		const filter = makeMockFilter();
		const alias = makeMockAlias();
		const container = document.createElement('div');
		document.body.appendChild(container);

		const explorer = new NotebookExplorer({
			bridge: bridge as unknown as import('../../../src/worker/WorkerBridge').WorkerBridge,
			selection: selection as unknown as import('../../../src/providers/SelectionProvider').SelectionProvider,
			filter: filter as unknown as import('../../../src/providers/FilterProvider').FilterProvider,
			alias: alias as unknown as import('../../../src/providers/AliasProvider').AliasProvider,
			mutations: mutationManager as unknown as MutationManager,
		});

		explorer.mount(container);

		// Wait for initial load
		await vi.waitFor(
			() => {
				expect(bridge.send).toHaveBeenCalledWith('card:get', { id: 'card-abc-123' });
			},
			{ timeout: 500 },
		);
		await Promise.resolve();

		// Confirm title input is visible (editor mode)
		const titleInput = container.querySelector('.notebook-explorer__title-input') as HTMLInputElement;
		expect(titleInput).not.toBeNull();

		// Fire the MutationManager subscriber (simulating an undo that deleted the card)
		mutationManager._fireSubscriber();

		// Wait for _onMutationChange to complete (calls card:get which returns null → idle)
		await vi.waitFor(
			() => {
				const idleEl = container.querySelector('.notebook-explorer__idle');
				expect(idleEl).not.toBeNull();
				expect((idleEl as HTMLElement).style.display).not.toBe('none');
			},
			{ timeout: 500 },
		);

		// Idle panel should contain the hint text and "New Card" button (Phase 92)
		const idleEl = container.querySelector('.notebook-explorer__idle') as HTMLElement;
		const hintEl = idleEl.querySelector('.notebook-explorer__idle-hint');
		expect(hintEl).not.toBeNull();
		expect(hintEl!.textContent).toBe('Select a card or create a new one');
		expect(idleEl.querySelector('.notebook-explorer__new-card-btn')).not.toBeNull();
	});

	// -----------------------------------------------------------------------
	// Test 6: Snapshot loaded via bridge.send('card:get'), stored as _snapshot
	// -----------------------------------------------------------------------
	it('Test 6: snapshot loaded via card:get on selection and populates title input + textarea', async () => {
		const card = makeCard({
			name: 'Snapshot Card',
			content: 'Snapshot content',
		});

		const bridge = makeMockBridge(card);
		const mutationManager = makeMockMutationManager();
		const { container } = await mountExplorer({ card, mutationManager, bridge });

		// Title input should be populated from snapshot
		const titleInput = container.querySelector('.notebook-explorer__title-input') as HTMLInputElement;
		expect(titleInput).not.toBeNull();
		expect(titleInput.value).toBe('Snapshot Card');

		// Textarea should be populated from snapshot content
		const textarea = container.querySelector('.notebook-explorer__textarea') as HTMLTextAreaElement;
		expect(textarea).not.toBeNull();
		expect(textarea.value).toBe('Snapshot content');

		// bridge.send('card:get') should have been called with the card's id
		expect(bridge.send).toHaveBeenCalledWith('card:get', { id: 'card-abc-123' });
	});
});
