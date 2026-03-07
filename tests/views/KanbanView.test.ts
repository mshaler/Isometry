// @vitest-environment jsdom
// Isometry v5 — KanbanView Tests
// Tests for HTML-based kanban view with column grouping, drag-drop, and MutationManager integration.
//
// Requirements: VIEW-03, VIEW-12

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MutationManager } from '../../src/mutations/MutationManager';
import { KanbanView } from '../../src/views/KanbanView';
import type { CardDatum } from '../../src/views/types';

// ---------------------------------------------------------------------------
// jsdom DragEvent polyfill
// jsdom does not implement DragEvent natively. We create a minimal shim that
// inherits from MouseEvent so dispatchEvent works correctly with event bubbling.
// ---------------------------------------------------------------------------

if (typeof DragEvent === 'undefined') {
	class DragEventPolyfill extends MouseEvent {
		dataTransfer: DataTransfer | null;
		constructor(type: string, init?: DragEventInit) {
			super(type, init);
			this.dataTransfer = init?.dataTransfer ?? null;
		}
	}
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	(globalThis as any).DragEvent = DragEventPolyfill;
}

// ---------------------------------------------------------------------------
// Test data factories
// ---------------------------------------------------------------------------

function makeCard(overrides: Partial<CardDatum> = {}): CardDatum {
	return {
		id: crypto.randomUUID(),
		name: 'Test Card',
		folder: null,
		status: 'todo',
		card_type: 'task',
		created_at: '2026-01-01T00:00:00Z',
		modified_at: '2026-01-01T00:00:00Z',
		priority: 0,
		sort_order: 0,
		due_at: null,
		body_text: null,
		source: null,
		...overrides,
	};
}

function makeCards(): CardDatum[] {
	return [
		makeCard({ id: 'card-1', name: 'Card 1', status: 'todo' }),
		makeCard({ id: 'card-2', name: 'Card 2', status: 'todo' }),
		makeCard({ id: 'card-3', name: 'Card 3', status: 'in_progress' }),
		makeCard({ id: 'card-4', name: 'Card 4', status: 'in_progress' }),
		makeCard({ id: 'card-5', name: 'Card 5', status: 'done' }),
		makeCard({ id: 'card-6', name: 'Card 6', status: 'done' }),
		makeCard({ id: 'card-7', name: 'Card 7', status: null }),
	];
}

function makeMockMutationManager(): MutationManager {
	return {
		execute: vi.fn().mockResolvedValue(undefined),
		subscribe: vi.fn(() => vi.fn()),
		undo: vi.fn(),
		redo: vi.fn(),
		canUndo: vi.fn(() => false),
		canRedo: vi.fn(() => false),
		isDirty: vi.fn(() => false),
		clearDirty: vi.fn(),
		getHistory: vi.fn(() => []),
	} as unknown as MutationManager;
}

// ---------------------------------------------------------------------------
// Task 1: Column grouping and rendering tests
// ---------------------------------------------------------------------------

describe('KanbanView — column grouping and rendering', () => {
	let container: HTMLElement;
	let mockMutationManager: MutationManager;

	beforeEach(() => {
		container = document.createElement('div');
		document.body.appendChild(container);
		mockMutationManager = makeMockMutationManager();
	});

	afterEach(() => {
		document.body.removeChild(container);
	});

	it('mount creates div.kanban-board in container', () => {
		const view = new KanbanView({ mutationManager: mockMutationManager });
		view.mount(container);

		const board = container.querySelector('.kanban-board');
		expect(board).not.toBeNull();
		expect(board?.tagName).toBe('DIV');
	});

	it('render creates columns for each unique status value in alphabetical order', () => {
		const view = new KanbanView({ mutationManager: mockMutationManager });
		view.mount(container);
		view.render(makeCards());

		const columns = container.querySelectorAll('.kanban-column');
		// Should have: done, in_progress, none, todo (alphabetical + 'none' for null)
		expect(columns.length).toBe(4);

		const headers = container.querySelectorAll('.kanban-column-header');
		const headerTexts = Array.from(headers).map((h) => {
			// Extract the column value text (first text content before the badge)
			return h.querySelector('.kanban-column-title')?.textContent ?? '';
		});
		expect(headerTexts).toEqual(['done', 'in_progress', 'none', 'todo']);
	});

	it('cards are grouped correctly into their status columns', () => {
		const view = new KanbanView({ mutationManager: mockMutationManager });
		view.mount(container);
		view.render(makeCards());

		const columns = container.querySelectorAll('.kanban-column');
		const columnMap = new Map<string, Element>();
		columns.forEach((col) => {
			const title = col.querySelector('.kanban-column-title')?.textContent ?? '';
			columnMap.set(title, col);
		});

		// todo: 2 cards
		const todoCards = columnMap.get('todo')?.querySelectorAll('.card');
		expect(todoCards?.length).toBe(2);

		// in_progress: 2 cards
		const inProgressCards = columnMap.get('in_progress')?.querySelectorAll('.card');
		expect(inProgressCards?.length).toBe(2);

		// done: 2 cards
		const doneCards = columnMap.get('done')?.querySelectorAll('.card');
		expect(doneCards?.length).toBe(2);

		// none: 1 card (null status)
		const noneCards = columnMap.get('none')?.querySelectorAll('.card');
		expect(noneCards?.length).toBe(1);
	});

	it('each card element has correct data binding', () => {
		const view = new KanbanView({ mutationManager: mockMutationManager });
		view.mount(container);

		const cards = [
			makeCard({ id: 'card-a', name: 'Alpha Card', status: 'todo' }),
			makeCard({ id: 'card-b', name: 'Beta Card', status: 'todo' }),
		];
		view.render(cards);

		const cardEls = container.querySelectorAll('.card');
		const names = Array.from(cardEls).map((el) => el.querySelector('.card-name')?.textContent ?? '');
		expect(names).toContain('Alpha Card');
		expect(names).toContain('Beta Card');
	});

	it('empty columns show with header + empty state text', () => {
		const view = new KanbanView({
			mutationManager: mockMutationManager,
			columnDomain: ['todo', 'in_progress', 'done'],
		});
		view.mount(container);

		// Only provide todo and done cards — in_progress should still show as empty
		const cards = [
			makeCard({ id: 'card-a', name: 'Alpha', status: 'todo' }),
			makeCard({ id: 'card-b', name: 'Beta', status: 'done' }),
		];
		view.render(cards);

		const columns = container.querySelectorAll('.kanban-column');
		// Should have all 3 columns from the domain
		expect(columns.length).toBe(3);

		// Find the in_progress column
		let inProgressColumn: Element | undefined;
		columns.forEach((col) => {
			if (col.querySelector('.kanban-column-title')?.textContent === 'in_progress') {
				inProgressColumn = col;
			}
		});
		expect(inProgressColumn).not.toBeUndefined();

		// It should show empty state
		const emptyState = inProgressColumn?.querySelector('.kanban-empty');
		expect(emptyState).not.toBeNull();
		expect(emptyState?.textContent).toBe('No cards');
	});

	it('null status cards appear in the "none" column', () => {
		const view = new KanbanView({ mutationManager: mockMutationManager });
		view.mount(container);

		const cards = [makeCard({ id: 'card-null', name: 'Null Status Card', status: null })];
		view.render(cards);

		// Find the 'none' column
		const columns = container.querySelectorAll('.kanban-column');
		let noneColumn: Element | undefined;
		columns.forEach((col) => {
			if (col.querySelector('.kanban-column-title')?.textContent === 'none') {
				noneColumn = col;
			}
		});
		expect(noneColumn).not.toBeUndefined();

		const cardEls = noneColumn?.querySelectorAll('.card');
		expect(cardEls?.length).toBe(1);
		expect(cardEls?.[0]?.querySelector('.card-name')?.textContent).toBe('Null Status Card');
	});

	it('cards use D3 data join with key function d => d.id — DOM stability on re-render', () => {
		const view = new KanbanView({ mutationManager: mockMutationManager });
		view.mount(container);

		const cards = [
			makeCard({ id: 'stable-1', name: 'Stable One', status: 'todo' }),
			makeCard({ id: 'stable-2', name: 'Stable Two', status: 'todo' }),
		];
		view.render(cards);

		// Capture the DOM elements after first render
		const firstRenderEls = Array.from(container.querySelectorAll('.card[data-id="stable-1"]'));
		expect(firstRenderEls.length).toBe(1);
		const domNode = firstRenderEls[0];

		// Re-render with reversed order — DOM node for 'stable-1' should be same reference
		const reorderedCards = [...cards].reverse();
		view.render(reorderedCards);

		const afterReorderEl = container.querySelector('.card[data-id="stable-1"]');
		expect(afterReorderEl).toBe(domNode);
	});

	it('column body has overflow-y style for vertical scroll', () => {
		const view = new KanbanView({ mutationManager: mockMutationManager });
		view.mount(container);
		view.render([makeCard({ id: 'c1', status: 'todo' })]);

		const columnBody = container.querySelector('.kanban-column-body') as HTMLElement | null;
		expect(columnBody).not.toBeNull();
		expect(columnBody?.style.overflowY).toBe('auto');
	});

	it('destroy removes board from container', () => {
		const view = new KanbanView({ mutationManager: mockMutationManager });
		view.mount(container);
		view.render(makeCards());

		expect(container.querySelector('.kanban-board')).not.toBeNull();
		view.destroy();
		expect(container.querySelector('.kanban-board')).toBeNull();
	});

	it('supports configurable groupBy field — group by folder', () => {
		const view = new KanbanView({
			mutationManager: mockMutationManager,
			groupByField: 'folder',
		});
		view.mount(container);

		const cards = [
			makeCard({ id: 'f1', name: 'Folder A Card 1', folder: 'alpha', status: 'todo' }),
			makeCard({ id: 'f2', name: 'Folder A Card 2', folder: 'alpha', status: 'done' }),
			makeCard({ id: 'f3', name: 'Folder B Card', folder: 'beta', status: 'todo' }),
		];
		view.render(cards);

		const headers = container.querySelectorAll('.kanban-column-title');
		const headerTexts = Array.from(headers).map((h) => h.textContent ?? '');
		// Should group by folder: alpha, beta (alphabetical)
		expect(headerTexts).toEqual(['alpha', 'beta']);

		// alpha has 2 cards, beta has 1
		const columns = container.querySelectorAll('.kanban-column');
		let alphaColumn: Element | undefined;
		columns.forEach((col) => {
			if (col.querySelector('.kanban-column-title')?.textContent === 'alpha') {
				alphaColumn = col;
			}
		});
		expect(alphaColumn?.querySelectorAll('.card').length).toBe(2);
	});
});

// ---------------------------------------------------------------------------
// Task 2: Drag-drop tests
// ---------------------------------------------------------------------------

describe('KanbanView — drag-drop and MutationManager integration', () => {
	let container: HTMLElement;
	let mockMutationManager: MutationManager;

	beforeEach(() => {
		container = document.createElement('div');
		document.body.appendChild(container);
		mockMutationManager = makeMockMutationManager();
	});

	afterEach(() => {
		document.body.removeChild(container);
	});

	function renderBasicKanban(onMutation?: (cardId: string, newValue: string) => Promise<void>) {
		const view = new KanbanView({
			mutationManager: mockMutationManager,
			...(onMutation ? { onMutation } : {}),
		});
		view.mount(container);

		const cards = [
			makeCard({ id: 'drag-card-1', name: 'Draggable Card', status: 'todo' }),
			makeCard({ id: 'drag-card-2', name: 'Done Card', status: 'done' }),
		];
		view.render(cards);
		return { view, cards };
	}

	it('cards have draggable=true attribute', () => {
		renderBasicKanban();
		const cardEls = container.querySelectorAll('.card');
		cardEls.forEach((card) => {
			expect(card.getAttribute('draggable')).toBe('true');
		});
	});

	it('dragstart sets dataTransfer with card ID', () => {
		renderBasicKanban();

		const card = container.querySelector('.card[data-id="drag-card-1"]') as HTMLElement;
		expect(card).not.toBeNull();

		const mockDataTransfer = {
			setData: vi.fn(),
			getData: vi.fn(() => 'drag-card-1'),
			types: [] as string[],
			effectAllowed: 'none' as string,
		};

		const dragstartEvent = new DragEvent('dragstart', { bubbles: true });
		Object.defineProperty(dragstartEvent, 'dataTransfer', { value: mockDataTransfer });
		card.dispatchEvent(dragstartEvent);

		expect(mockDataTransfer.setData).toHaveBeenCalledWith('text/x-kanban-card-id', 'drag-card-1');
	});

	it('dragging card gets "dragging" class on dragstart', () => {
		renderBasicKanban();

		const card = container.querySelector('.card[data-id="drag-card-1"]') as HTMLElement;
		const mockDataTransfer = {
			setData: vi.fn(),
			getData: vi.fn(),
			types: [] as string[],
			effectAllowed: 'none' as string,
		};

		const dragstartEvent = new DragEvent('dragstart', { bubbles: true });
		Object.defineProperty(dragstartEvent, 'dataTransfer', { value: mockDataTransfer });
		card.dispatchEvent(dragstartEvent);

		expect(card.classList.contains('dragging')).toBe(true);
	});

	it('dragend removes "dragging" class', () => {
		renderBasicKanban();

		const card = container.querySelector('.card[data-id="drag-card-1"]') as HTMLElement;
		const mockDataTransfer = {
			setData: vi.fn(),
			getData: vi.fn(),
			types: [] as string[],
			effectAllowed: 'none' as string,
		};

		// First dragstart
		const dragstartEvent = new DragEvent('dragstart', { bubbles: true });
		Object.defineProperty(dragstartEvent, 'dataTransfer', { value: mockDataTransfer });
		card.dispatchEvent(dragstartEvent);
		expect(card.classList.contains('dragging')).toBe(true);

		// Then dragend
		const dragendEvent = new DragEvent('dragend', { bubbles: true });
		card.dispatchEvent(dragendEvent);
		expect(card.classList.contains('dragging')).toBe(false);
	});

	it('column accepts drop — dragover prevents default', () => {
		renderBasicKanban();

		const doneColumn = Array.from(container.querySelectorAll('.kanban-column')).find(
			(col) => col.querySelector('.kanban-column-title')?.textContent === 'done',
		);
		const columnBody = doneColumn?.querySelector('.kanban-column-body') as HTMLElement | null;
		expect(columnBody).not.toBeNull();

		const mockDataTransfer = {
			setData: vi.fn(),
			getData: vi.fn(),
			types: ['text/x-kanban-card-id'],
			effectAllowed: 'move' as string,
		};

		let preventDefaultCalled = false;
		const dragoverEvent = new DragEvent('dragover', { bubbles: true, cancelable: true });
		Object.defineProperty(dragoverEvent, 'dataTransfer', { value: mockDataTransfer });
		Object.defineProperty(dragoverEvent, 'preventDefault', {
			value: () => {
				preventDefaultCalled = true;
			},
		});

		columnBody!.dispatchEvent(dragoverEvent);
		expect(preventDefaultCalled).toBe(true);
	});

	it('column shows "drag-over" class on dragover', () => {
		renderBasicKanban();

		const doneColumn = Array.from(container.querySelectorAll('.kanban-column')).find(
			(col) => col.querySelector('.kanban-column-title')?.textContent === 'done',
		);
		const columnBody = doneColumn?.querySelector('.kanban-column-body') as HTMLElement | null;
		expect(columnBody).not.toBeNull();

		const mockDataTransfer = {
			types: ['text/x-kanban-card-id'],
		};

		const dragoverEvent = new DragEvent('dragover', { bubbles: true, cancelable: true });
		Object.defineProperty(dragoverEvent, 'dataTransfer', { value: mockDataTransfer });
		Object.defineProperty(dragoverEvent, 'preventDefault', { value: vi.fn() });
		columnBody!.dispatchEvent(dragoverEvent);

		expect(columnBody?.classList.contains('drag-over')).toBe(true);
	});

	it('dragleave removes "drag-over" class', () => {
		renderBasicKanban();

		const doneColumn = Array.from(container.querySelectorAll('.kanban-column')).find(
			(col) => col.querySelector('.kanban-column-title')?.textContent === 'done',
		);
		const columnBody = doneColumn?.querySelector('.kanban-column-body') as HTMLElement | null;
		expect(columnBody).not.toBeNull();

		// Add drag-over class first
		columnBody!.classList.add('drag-over');

		const dragleaveEvent = new DragEvent('dragleave', { bubbles: true });
		columnBody!.dispatchEvent(dragleaveEvent);

		expect(columnBody?.classList.contains('drag-over')).toBe(false);
	});

	it('drop calls onMutation with card ID and target column value', async () => {
		const onMutation = vi.fn().mockResolvedValue(undefined);
		renderBasicKanban(onMutation);

		// Drag card-1 (todo) onto 'done' column
		const doneColumn = Array.from(container.querySelectorAll('.kanban-column')).find(
			(col) => col.querySelector('.kanban-column-title')?.textContent === 'done',
		);
		const columnBody = doneColumn?.querySelector('.kanban-column-body') as HTMLElement | null;
		expect(columnBody).not.toBeNull();

		const mockDataTransfer = {
			getData: vi.fn(() => 'drag-card-1'),
			types: ['text/x-kanban-card-id'],
		};

		const dropEvent = new DragEvent('drop', { bubbles: true, cancelable: true });
		Object.defineProperty(dropEvent, 'dataTransfer', { value: mockDataTransfer });
		Object.defineProperty(dropEvent, 'preventDefault', { value: vi.fn() });
		columnBody!.dispatchEvent(dropEvent);

		// Allow microtasks to settle
		await Promise.resolve();

		expect(onMutation).toHaveBeenCalledWith('drag-card-1', 'done');
	});

	it('same-column drop does not fire mutation', async () => {
		const onMutation = vi.fn().mockResolvedValue(undefined);
		renderBasicKanban(onMutation);

		// Drag card-1 (todo) onto its own 'todo' column
		const todoColumn = Array.from(container.querySelectorAll('.kanban-column')).find(
			(col) => col.querySelector('.kanban-column-title')?.textContent === 'todo',
		);
		const columnBody = todoColumn?.querySelector('.kanban-column-body') as HTMLElement | null;
		expect(columnBody).not.toBeNull();

		const mockDataTransfer = {
			getData: vi.fn(() => 'drag-card-1'),
			types: ['text/x-kanban-card-id'],
		};

		const dropEvent = new DragEvent('drop', { bubbles: true, cancelable: true });
		Object.defineProperty(dropEvent, 'dataTransfer', { value: mockDataTransfer });
		Object.defineProperty(dropEvent, 'preventDefault', { value: vi.fn() });
		columnBody!.dispatchEvent(dropEvent);

		await Promise.resolve();

		expect(onMutation).not.toHaveBeenCalled();
	});

	it('mutation uses updateCardMutation for undo support — verifies mutation shape', async () => {
		// Use the real onMutation which calls updateCardMutation via mutationManager.execute
		// We verify that mutationManager.execute was called with a Mutation that has forward/inverse
		const view = new KanbanView({ mutationManager: mockMutationManager });
		view.mount(container);

		const cards = [
			makeCard({ id: 'shape-card-1', name: 'Shape Card', status: 'todo' }),
			makeCard({ id: 'shape-card-2', name: 'Done Card', status: 'done' }),
		];
		view.render(cards);

		// Simulate drop of shape-card-1 onto 'done' column
		const doneColumn = Array.from(container.querySelectorAll('.kanban-column')).find(
			(col) => col.querySelector('.kanban-column-title')?.textContent === 'done',
		);
		const columnBody = doneColumn?.querySelector('.kanban-column-body') as HTMLElement | null;

		const mockDataTransfer = {
			getData: vi.fn(() => 'shape-card-1'),
			types: ['text/x-kanban-card-id'],
		};

		const dropEvent = new DragEvent('drop', { bubbles: true, cancelable: true });
		Object.defineProperty(dropEvent, 'dataTransfer', { value: mockDataTransfer });
		Object.defineProperty(dropEvent, 'preventDefault', { value: vi.fn() });
		columnBody!.dispatchEvent(dropEvent);

		await Promise.resolve();

		expect(mockMutationManager.execute).toHaveBeenCalledOnce();
		const executeMock = mockMutationManager.execute as ReturnType<typeof vi.fn>;
		const calledMutation = executeMock.mock.calls[0]?.[0] as Record<string, unknown>;
		expect(calledMutation).toMatchObject({
			forward: expect.arrayContaining([expect.objectContaining({ sql: expect.stringContaining('UPDATE cards SET') })]),
			inverse: expect.arrayContaining([expect.objectContaining({ sql: expect.stringContaining('UPDATE cards SET') })]),
		});
	});
});
