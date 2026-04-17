// @vitest-environment jsdom
// Seam tests: NotebookExplorer Cmd+N shortcut and Command Palette "New Card" action
// Phase 92 Plan 02 — CREA-01
//
// Tests:
// 1. ShortcutRegistry Cmd+N (not in input): document keydown triggers enterCreationMode
// 2. Component Cmd+N in textarea: auto-commits content buffer, enters buffering
// 3. Component Cmd+N in title input during buffering with non-empty name: commits + fresh buffering
// 4. Component Cmd+N in title input during buffering with empty name: fresh buffering (no mutation)
// 5. Component Cmd+N in title input while editing (not buffering): enters creation mode

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Card } from '../../../src/database/queries/types';
import type { MutationManager } from '../../../src/mutations/MutationManager';
import type { Mutation } from '../../../src/mutations/types';
import { ShortcutRegistry } from '../../../src/shortcuts/ShortcutRegistry';
import { NotebookExplorer } from '../../../src/ui/NotebookExplorer';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeCard(overrides: Partial<Card> = {}): Card {
	return {
		id: 'card-id-001',
		card_type: 'note',
		name: 'Existing Card',
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
	const selection = opts.selection ?? makeMockSelection(null);
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

	// Wait for initial selection load (will be idle since no card selected)
	await Promise.resolve();
	await Promise.resolve();

	return { explorer, bridge, mutationManager, selection, container };
}

// ---------------------------------------------------------------------------
// Helper: mount explorer with a card already selected (editing state)
// ---------------------------------------------------------------------------

async function mountExplorerEditing(
	opts: {
		card?: Card;
		mutationManager?: ReturnType<typeof makeMockMutationManager>;
		selection?: ReturnType<typeof makeMockSelection>;
		bridge?: ReturnType<typeof makeMockBridge>;
	} = {},
) {
	const card = opts.card ?? makeCard();
	const bridge = opts.bridge ?? makeMockBridge(card);
	const mutationManager = opts.mutationManager ?? makeMockMutationManager();
	const selection = opts.selection ?? makeMockSelection(card.id);
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

	// Wait for card load
	await Promise.resolve();
	await Promise.resolve();
	await Promise.resolve();

	return { explorer, bridge, mutationManager, selection, container };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('NotebookExplorer — Cmd+N shortcut and Command Palette "New Card"', () => {
	beforeEach(() => {
		document.body.innerHTML = '';
	});

	// -----------------------------------------------------------------------
	// Test 1: ShortcutRegistry Cmd+N — not in input field — triggers enterCreationMode
	// -----------------------------------------------------------------------
	it('Test 1 (ShortcutRegistry Cmd+N): dispatching Cmd+N on document (not in input) calls enterCreationMode', async () => {
		const { explorer } = await mountExplorerIdle();

		// Spy on enterCreationMode
		const enterCreationModeSpy = vi.spyOn(explorer, 'enterCreationMode');

		// Register shortcut pointing to the spy (simulating what main.ts does)
		const registry = new ShortcutRegistry();
		registry.register(
			'Cmd+N',
			() => {
				explorer.enterCreationMode();
			},
			{ category: 'Editing', description: 'New Card' },
		);

		// Dispatch Cmd+N on document (focus is NOT in input or textarea)
		// Ensure focus is on body
		document.body.focus();
		// ShortcutRegistry uses isMac detection (navigator.platform.includes('Mac')).
		// In jsdom the platform may be non-Mac, so set ctrlKey=true to cover both cases.
		// Also set metaKey=true to cover Mac jsdom environments.
		const isMac = typeof navigator !== 'undefined' && navigator.platform.includes('Mac');
		const event = new KeyboardEvent('keydown', {
			key: 'n',
			metaKey: isMac,
			ctrlKey: !isMac,
			bubbles: true,
			cancelable: true,
		});
		document.dispatchEvent(event);

		expect(enterCreationModeSpy).toHaveBeenCalledTimes(1);

		registry.destroy();
	});

	// -----------------------------------------------------------------------
	// Test 2: Cmd+N in textarea — auto-commits buffer, enters buffering
	// -----------------------------------------------------------------------
	it('Test 2 (textarea Cmd+N): pressing Cmd+N in textarea triggers enterCreationMode', async () => {
		const card = makeCard({ id: 'card-for-textarea-test', name: 'Card for Textarea' });
		const { explorer, container } = await mountExplorerEditing({ card });

		// Verify we are in editing state
		const rootEl = container.querySelector('.notebook-explorer') as HTMLElement;
		expect(rootEl.getAttribute('data-creation-state')).toBe('editing');

		// Spy on enterCreationMode
		const enterCreationModeSpy = vi.spyOn(explorer, 'enterCreationMode');

		// Focus the textarea
		const textarea = container.querySelector('.notebook-explorer__textarea') as HTMLTextAreaElement;
		expect(textarea).not.toBeNull();
		textarea.value = 'Some content I was typing';
		textarea.focus();

		// Dispatch Cmd+N on the textarea
		const event = new KeyboardEvent('keydown', {
			key: 'n',
			metaKey: true,
			bubbles: true,
			cancelable: true,
		});
		textarea.dispatchEvent(event);

		expect(enterCreationModeSpy).toHaveBeenCalledTimes(1);
	});

	// -----------------------------------------------------------------------
	// Test 3: Cmd+N in title input during buffering with non-empty name
	//         → commits current name → enters fresh buffering
	// -----------------------------------------------------------------------
	it('Test 3 (buffering Cmd+N with name): Cmd+N in title input during buffering commits current card and enters fresh buffering', async () => {
		const createdCard = makeCard({ id: 'new-card-from-rapid', name: 'Card A' });
		const mutationManager = makeMockMutationManager();
		const selection = makeMockSelection(null);
		const bridge = makeMockBridge(createdCard);
		const { container } = await mountExplorerIdle({ createdCard, mutationManager, selection, bridge });

		// Click New Card to enter buffering
		const newCardBtn = container.querySelector('.notebook-explorer__new-card-btn') as HTMLButtonElement;
		newCardBtn.click();

		const titleInput = container.querySelector('.notebook-explorer__title-input') as HTMLInputElement;
		expect(titleInput.style.display).not.toBe('none');

		// Type "Card A"
		titleInput.value = 'Card A';
		titleInput.focus();

		// Dispatch Cmd+N on the title input
		const event = new KeyboardEvent('keydown', {
			key: 'n',
			metaKey: true,
			bubbles: true,
			cancelable: true,
		});
		titleInput.dispatchEvent(event);

		// Wait for async commit
		await vi.waitFor(
			() => {
				expect(mutationManager.execute).toHaveBeenCalledTimes(1);
			},
			{ timeout: 500 },
		);

		// Verify createCardMutation was called with "Card A"
		const mutation = mutationManager._executedMutations[0];
		expect(mutation).toBeDefined();
		expect(mutation!.forward[0]!.sql).toMatch(/INSERT INTO cards/);
		expect(mutation!.forward[0]!.params).toContain('Card A');

		// Explorer should still be in buffering state for next card
		const rootEl = container.querySelector('.notebook-explorer') as HTMLElement;

		// Wait for buffering state to be established
		await vi.waitFor(
			() => {
				return rootEl.getAttribute('data-creation-state') === 'buffering';
			},
			{ timeout: 500 },
		);

		expect(rootEl.getAttribute('data-creation-state')).toBe('buffering');

		// Title input should be visible and cleared for next card
		expect(titleInput.style.display).not.toBe('none');
		expect(titleInput.value).toBe('');
	});

	// -----------------------------------------------------------------------
	// Test 4: Cmd+N in title input during buffering with empty name
	//         → no mutation → fresh buffering (no-op net effect)
	// -----------------------------------------------------------------------
	it('Test 4 (buffering Cmd+N empty): Cmd+N in title input during buffering with empty name restarts buffering without mutation', async () => {
		const mutationManager = makeMockMutationManager();
		const { container } = await mountExplorerIdle({ mutationManager });

		// Click New Card to enter buffering
		const newCardBtn = container.querySelector('.notebook-explorer__new-card-btn') as HTMLButtonElement;
		newCardBtn.click();

		const titleInput = container.querySelector('.notebook-explorer__title-input') as HTMLInputElement;
		expect(titleInput.style.display).not.toBe('none');

		// Leave empty
		titleInput.value = '';
		titleInput.focus();

		// Dispatch Cmd+N on the title input
		const event = new KeyboardEvent('keydown', {
			key: 'n',
			metaKey: true,
			bubbles: true,
			cancelable: true,
		});
		titleInput.dispatchEvent(event);

		// Wait a tick
		await Promise.resolve();
		await Promise.resolve();

		// No mutation should have been executed
		expect(mutationManager.execute).not.toHaveBeenCalled();

		// Still in buffering state (fresh buffer)
		const rootEl = container.querySelector('.notebook-explorer') as HTMLElement;
		expect(rootEl.getAttribute('data-creation-state')).toBe('buffering');

		// Title input still visible and empty
		expect(titleInput.style.display).not.toBe('none');
		expect(titleInput.value).toBe('');
	});

	// -----------------------------------------------------------------------
	// Test 5: enterCreationMode() public API from editing state
	//         transitions to buffering (auto-commits dirty content)
	// -----------------------------------------------------------------------
	it('Test 5 (editing Cmd+N): enterCreationMode() from editing state enters buffering state', async () => {
		const card = makeCard({ id: 'editing-card', name: 'Some Card' });
		const { explorer, container } = await mountExplorerEditing({ card });

		// Verify we are in editing state
		const rootEl = container.querySelector('.notebook-explorer') as HTMLElement;
		expect(rootEl.getAttribute('data-creation-state')).toBe('editing');

		// Call enterCreationMode directly (as would be called from Cmd+N)
		explorer.enterCreationMode();

		// Should now be in buffering state
		expect(rootEl.getAttribute('data-creation-state')).toBe('buffering');

		// Title input visible and empty (buffering)
		const titleInput = container.querySelector('.notebook-explorer__title-input') as HTMLInputElement;
		expect(titleInput.style.display).not.toBe('none');
		expect(titleInput.value).toBe('');

		// Idle panel hidden
		const idleEl = container.querySelector('.notebook-explorer__idle') as HTMLElement;
		expect(idleEl.style.display).toBe('none');
	});
});
