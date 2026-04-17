// @vitest-environment jsdom
// Seam tests: NotebookExplorer card creation state machine
// Phase 92 Plan 01 — CREA-01, CREA-02, CREA-03, CREA-04, CREA-05
//
// Tests the 6 creation-flow behaviors:
// 1. Happy path: click "New Card" → buffering → type name → blur → createCardMutation + select
// 2. Abandon on empty blur: buffering → blur empty → no mutation, returns to idle
// 3. Abandon on Escape: buffering → type → Escape → no mutation, returns to idle
// 4. IME guard: compositionstart → blur → no commit (deferred) → compositionend → evaluate
// 5. Whitespace-only abandon: buffering → type "   " → blur → no mutation, idle
// 6. data-creation-state attribute reflects state machine transitions

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
		id: 'new-card-id-123',
		card_type: 'note',
		name: 'My Card',
		content: null,
		summary: null,
		latitude: null,
		longitude: null,
		location_name: null,
		created_at: '2026-03-18T00:00:00.000Z',
		modified_at: '2026-03-18T00:00:00.000Z',
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

function makeMockBridge(createdCard: Card | null = makeCard()) {
	return {
		send: vi.fn(async (type: string, _payload?: unknown) => {
			if (type === 'card:get') return createdCard;
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
		_fireSubscriber() {
			_subscriber?.();
		},
		_executedMutations: executedMutations,
	};

	return manager;
}

function makeMockSelection(initialId: string | null = null) {
	let _currentId: string | null = initialId;
	let _subscriber: (() => void) | null = null;
	const selectedIds: string[] = [];

	return {
		getSelectedIds: vi.fn(() => (_currentId !== null ? [_currentId] : [])),
		subscribe: vi.fn((cb: () => void) => {
			_subscriber = cb;
			return () => {
				_subscriber = null;
			};
		}),
		select: vi.fn((id: string) => {
			selectedIds.push(id);
			_currentId = id;
			_subscriber?.();
		}),
		_selectCard(id: string | null) {
			_currentId = id;
			_subscriber?.();
		},
		_selectedIds: selectedIds,
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
// Helper: mount explorer in idle state (no initial card selected)
// ---------------------------------------------------------------------------

async function mountExplorerIdle(
	opts: {
		createdCard?: Card | null;
		mutationManager?: ReturnType<typeof makeMockMutationManager>;
		selection?: ReturnType<typeof makeMockSelection>;
		bridge?: ReturnType<typeof makeMockBridge>;
	} = {},
) {
	const createdCard = opts.createdCard !== undefined ? opts.createdCard : makeCard();
	const bridge = opts.bridge ?? makeMockBridge(createdCard);
	const mutationManager = opts.mutationManager ?? makeMockMutationManager();
	const selection = opts.selection ?? makeMockSelection(null); // No card selected initially
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

	// Wait a tick for initial selection load (will be idle since no card selected)
	await Promise.resolve();
	await Promise.resolve();

	return { explorer, bridge, mutationManager, selection, container };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('NotebookExplorer — card creation state machine', () => {
	beforeEach(() => {
		document.body.innerHTML = '';
	});

	// -----------------------------------------------------------------------
	// Test 1: Happy path — click New Card → buffering → type name → blur → createCardMutation
	// -----------------------------------------------------------------------
	it('Test 1 (happy path): clicking New Card enters buffering, blur with name creates card and selects it', async () => {
		const createdCard = makeCard({ id: 'generated-uuid-xyz', name: 'My Card' });
		const mutationManager = makeMockMutationManager();
		const selection = makeMockSelection(null);
		const bridge = makeMockBridge(createdCard);
		const { container } = await mountExplorerIdle({ createdCard, mutationManager, selection, bridge });

		// Idle state: "New Card" button should be visible
		const newCardBtn = container.querySelector('.notebook-explorer__new-card-btn') as HTMLButtonElement;
		expect(newCardBtn).not.toBeNull();
		expect(newCardBtn.textContent).toBe('New Card');

		// Click the New Card button
		newCardBtn.click();

		// Now in buffering state: title input should be visible and focused
		const titleInput = container.querySelector('.notebook-explorer__title-input') as HTMLInputElement;
		expect(titleInput).not.toBeNull();
		expect(titleInput.style.display).not.toBe('none');
		expect(titleInput.placeholder).toContain('Card name');

		// Segmented control, toolbar, body should be hidden in buffering
		const controlEl = container.querySelector('.notebook-explorer__segmented-control') as HTMLElement;
		const bodyEl = container.querySelector('.notebook-explorer__body') as HTMLElement;
		expect(controlEl.style.display).toBe('none');
		expect(bodyEl.style.display).toBe('none');

		// Type a name
		titleInput.value = 'My Card';

		// Blur to commit
		titleInput.dispatchEvent(new Event('blur'));

		// Wait for async commit
		await vi.waitFor(
			() => {
				expect(mutationManager.execute).toHaveBeenCalledTimes(1);
			},
			{ timeout: 500 },
		);

		// Verify createCardMutation was called (INSERT SQL)
		const mutation = mutationManager._executedMutations[0];
		expect(mutation).toBeDefined();
		expect(mutation!.forward).toHaveLength(1);
		expect(mutation!.forward[0]!.sql).toMatch(/INSERT INTO cards/);
		expect(mutation!.forward[0]!.params).toContain('My Card');
		expect(mutation!.forward[0]!.params).toContain('note'); // card_type

		// Verify SelectionProvider.select() was called with a UUID
		expect(selection.select).toHaveBeenCalledTimes(1);
		const selectedId = selection._selectedIds[0];
		expect(selectedId).toBeDefined();
		expect(typeof selectedId).toBe('string');
		expect(selectedId!.length).toBeGreaterThan(0);

		// After selection fires, card loads and transitions to editing
		await vi.waitFor(
			() => {
				const textarea = container.querySelector('.notebook-explorer__textarea') as HTMLTextAreaElement;
				return textarea && textarea.style.display !== 'none';
			},
			{ timeout: 500 },
		);
	});

	// -----------------------------------------------------------------------
	// Test 2: Abandon on empty blur — no mutation, returns to idle
	// -----------------------------------------------------------------------
	it('Test 2 (abandon empty): blur with empty title creates no card and returns to idle', async () => {
		const mutationManager = makeMockMutationManager();
		const { container } = await mountExplorerIdle({ mutationManager });

		// Click New Card button to enter buffering
		const newCardBtn = container.querySelector('.notebook-explorer__new-card-btn') as HTMLButtonElement;
		expect(newCardBtn).not.toBeNull();
		newCardBtn.click();

		// Title input should be visible
		const titleInput = container.querySelector('.notebook-explorer__title-input') as HTMLInputElement;
		expect(titleInput).not.toBeNull();
		expect(titleInput.style.display).not.toBe('none');

		// Leave title empty and blur
		titleInput.value = '';
		titleInput.dispatchEvent(new Event('blur'));

		// Wait a tick
		await Promise.resolve();
		await Promise.resolve();

		// No mutation should have been executed
		expect(mutationManager.execute).not.toHaveBeenCalled();

		// Should return to idle state — idle element visible, no segmented control/body
		const idleEl = container.querySelector('.notebook-explorer__idle') as HTMLElement;
		expect(idleEl).not.toBeNull();
		expect(idleEl.style.display).not.toBe('none');

		// New Card button should be visible again
		const newCardBtnAfter = container.querySelector('.notebook-explorer__new-card-btn') as HTMLButtonElement;
		expect(newCardBtnAfter).not.toBeNull();
	});

	// -----------------------------------------------------------------------
	// Test 3: Abandon on Escape — no mutation, returns to idle
	// -----------------------------------------------------------------------
	it('Test 3 (abandon Escape): pressing Escape during buffering cancels creation and returns to idle', async () => {
		const mutationManager = makeMockMutationManager();
		const { container } = await mountExplorerIdle({ mutationManager });

		// Enter buffering state
		const newCardBtn = container.querySelector('.notebook-explorer__new-card-btn') as HTMLButtonElement;
		newCardBtn.click();

		const titleInput = container.querySelector('.notebook-explorer__title-input') as HTMLInputElement;
		expect(titleInput.style.display).not.toBe('none');

		// Type something
		titleInput.value = 'Draft name';

		// Press Escape
		const escapeEvent = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
		titleInput.dispatchEvent(escapeEvent);

		// Wait a tick
		await Promise.resolve();

		// No mutation should have been executed
		expect(mutationManager.execute).not.toHaveBeenCalled();

		// Title input value should be cleared
		expect(titleInput.value).toBe('');

		// Returns to idle state
		const idleEl = container.querySelector('.notebook-explorer__idle') as HTMLElement;
		expect(idleEl.style.display).not.toBe('none');
	});

	// -----------------------------------------------------------------------
	// Test 4: IME guard — blur during composition is deferred
	// -----------------------------------------------------------------------
	it('Test 4 (IME guard): blur during compositionstart is deferred until compositionend fires', async () => {
		const mutationManager = makeMockMutationManager();
		const { container } = await mountExplorerIdle({ mutationManager });

		// Enter buffering state
		const newCardBtn = container.querySelector('.notebook-explorer__new-card-btn') as HTMLButtonElement;
		newCardBtn.click();

		const titleInput = container.querySelector('.notebook-explorer__title-input') as HTMLInputElement;
		expect(titleInput.style.display).not.toBe('none');

		// Start IME composition
		titleInput.dispatchEvent(new Event('compositionstart'));

		// Blur while composing — should NOT trigger commit/abandon
		titleInput.value = '日本語';
		titleInput.dispatchEvent(new Event('blur'));

		// Wait a tick — no mutation yet (deferred)
		await Promise.resolve();
		expect(mutationManager.execute).not.toHaveBeenCalled();

		// Should still be in buffering state (not idle yet)
		const idleEl = container.querySelector('.notebook-explorer__idle') as HTMLElement;
		// Idle should be hidden since we're in buffering state
		expect(idleEl.style.display).toBe('none');

		// compositionend fires — now evaluate
		titleInput.dispatchEvent(new Event('compositionend'));

		// Wait for async evaluation
		await vi.waitFor(
			() => {
				expect(mutationManager.execute).toHaveBeenCalledTimes(1);
			},
			{ timeout: 500 },
		);

		// Mutation should be createCardMutation with the typed name
		const mutation = mutationManager._executedMutations[0];
		expect(mutation!.forward[0]!.sql).toMatch(/INSERT INTO cards/);
		expect(mutation!.forward[0]!.params).toContain('日本語');
	});

	// -----------------------------------------------------------------------
	// Test 5: Whitespace-only name → abandon (no DB write)
	// -----------------------------------------------------------------------
	it('Test 5 (whitespace abandon): whitespace-only name on blur creates no card and returns to idle', async () => {
		const mutationManager = makeMockMutationManager();
		const { container } = await mountExplorerIdle({ mutationManager });

		// Enter buffering state
		const newCardBtn = container.querySelector('.notebook-explorer__new-card-btn') as HTMLButtonElement;
		newCardBtn.click();

		const titleInput = container.querySelector('.notebook-explorer__title-input') as HTMLInputElement;

		// Type whitespace only
		titleInput.value = '   ';
		titleInput.dispatchEvent(new Event('blur'));

		// Wait a tick
		await Promise.resolve();
		await Promise.resolve();

		// No mutation
		expect(mutationManager.execute).not.toHaveBeenCalled();

		// Returns to idle
		const idleEl = container.querySelector('.notebook-explorer__idle') as HTMLElement;
		expect(idleEl.style.display).not.toBe('none');
	});

	// -----------------------------------------------------------------------
	// Test 6: data-creation-state attribute reflects state transitions
	// -----------------------------------------------------------------------
	it('Test 6 (data attribute): root element data-creation-state reflects idle/buffering/editing transitions', async () => {
		const createdCard = makeCard({ id: 'test-card-for-attr' });
		const mutationManager = makeMockMutationManager();
		const selection = makeMockSelection(null);
		const bridge = makeMockBridge(createdCard);
		const { container } = await mountExplorerIdle({ createdCard, mutationManager, selection, bridge });

		// Initially idle
		const rootEl = container.querySelector('.notebook-explorer') as HTMLElement;
		expect(rootEl).not.toBeNull();
		expect(rootEl.getAttribute('data-creation-state')).toBe('idle');

		// Click New Card → buffering
		const newCardBtn = container.querySelector('.notebook-explorer__new-card-btn') as HTMLButtonElement;
		newCardBtn.click();
		expect(rootEl.getAttribute('data-creation-state')).toBe('buffering');

		// Type name and blur → editing
		const titleInput = container.querySelector('.notebook-explorer__title-input') as HTMLInputElement;
		titleInput.value = 'Test Card';
		titleInput.dispatchEvent(new Event('blur'));

		// Wait for creation and selection to fire
		await vi.waitFor(
			() => {
				expect(selection.select).toHaveBeenCalled();
			},
			{ timeout: 500 },
		);

		// After selection fires and card loads, state should be editing
		await vi.waitFor(
			() => {
				return rootEl.getAttribute('data-creation-state') === 'editing';
			},
			{ timeout: 500 },
		);

		expect(rootEl.getAttribute('data-creation-state')).toBe('editing');
	});
});
