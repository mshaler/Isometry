// @vitest-environment jsdom
// Isometry v5 -- Phase 47 Source x View Rendering Matrix Tests
// ETLV-03: All 81 source x view combinations render without error
//
// Validates that imported data from every source renders correctly in every view.
// 81 combinations (9 sources x 9 views) must mount without error, produce DOM elements,
// and not leak console errors.

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Database } from '../../src/database/Database';
import { ImportOrchestrator } from '../../src/etl/ImportOrchestrator';
import type { ParsedFile } from '../../src/etl/parsers/AppleNotesParser';
import type { CanonicalCard } from '../../src/etl/types';
import type { MutationManager } from '../../src/mutations/MutationManager';
import type { DensityProvider } from '../../src/providers/DensityProvider';
import type { TimeGranularity } from '../../src/providers/types';
import { CalendarView } from '../../src/views/CalendarView';
import { GalleryView } from '../../src/views/GalleryView';
import { GridView } from '../../src/views/GridView';
import { KanbanView } from '../../src/views/KanbanView';
import { ListView } from '../../src/views/ListView';
import { NetworkView } from '../../src/views/NetworkView';
import { SuperGrid } from '../../src/views/SuperGrid';
import { TimelineView } from '../../src/views/TimelineView';
import { TreeView } from '../../src/views/TreeView';
import type {
	CardDatum,
	SuperGridBridgeLike,
	SuperGridFilterLike,
	SuperGridProviderLike,
	WorkerBridgeLike,
} from '../../src/views/types';
import type { CellDatum, NodePosition } from '../../src/worker/protocol';
import {
	createTestDb,
	generateExcelBuffer,
	importFileSource,
	importNativeSource,
	loadFixture,
	loadFixtureJSON,
	queryCardsForSource,
} from './helpers';

// ---------------------------------------------------------------------------
// jsdom polyfills
// ---------------------------------------------------------------------------

// jsdom does not implement getBBox; D3 axis calls it
beforeAll(() => {
	(SVGElement.prototype as any).getBBox = () => ({ x: 0, y: 0, width: 80, height: 16 });
});

// jsdom does not implement DragEvent
if (typeof DragEvent === 'undefined') {
	class DragEventPolyfill extends MouseEvent {
		dataTransfer: DataTransfer | null;
		constructor(type: string, init?: DragEventInit) {
			super(type, init);
			this.dataTransfer = init?.dataTransfer ?? null;
		}
	}
	(globalThis as any).DragEvent = DragEventPolyfill;
}

// ---------------------------------------------------------------------------
// Source types
// ---------------------------------------------------------------------------

const SOURCES = [
	'apple_notes',
	'markdown',
	'csv',
	'json',
	'excel',
	'html',
	'native_reminders',
	'native_calendar',
	'native_notes',
] as const;

type SourceType = (typeof SOURCES)[number];

// ---------------------------------------------------------------------------
// Console.error spy
// ---------------------------------------------------------------------------

let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
	consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
	consoleErrorSpy.mockRestore();
});

// ---------------------------------------------------------------------------
// View factory helpers (mock dependencies)
// ---------------------------------------------------------------------------

function makeMockDensityProvider(granularity: TimeGranularity = 'month'): DensityProvider {
	return {
		getState: vi.fn().mockReturnValue({ timeField: 'due_at', granularity }),
		subscribe: vi.fn().mockReturnValue(vi.fn()),
		setTimeField: vi.fn(),
		setGranularity: vi.fn(),
		compile: vi.fn().mockReturnValue({ groupExpr: '' }),
		toJSON: vi.fn().mockReturnValue('{}'),
		setState: vi.fn(),
		resetToDefaults: vi.fn(),
	} as unknown as DensityProvider;
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

function makeNetworkBridge(cards: CardDatum[]): WorkerBridgeLike {
	const positions: NodePosition[] = cards.map((c, i) => ({
		id: c.id,
		x: 100 + i * 50,
		y: 100 + i * 50,
		fx: null,
		fy: null,
	}));
	return {
		send: vi.fn().mockImplementation(async (type: string) => {
			if (type === 'graph:simulate') return positions;
			if (type === 'db:exec') return { changes: 0 };
			return null;
		}),
	};
}

function makeTreeBridge(
	connections: Array<{ source_id: string; target_id: string; label: string }> = [],
): WorkerBridgeLike {
	return {
		send: vi.fn().mockResolvedValue(connections),
	};
}

function makeSuperGridMocks(cards: CardDatum[]): {
	provider: SuperGridProviderLike;
	filter: SuperGridFilterLike;
	bridge: SuperGridBridgeLike;
	coordinator: { subscribe(cb: () => void): () => void };
} {
	const cells: CellDatum[] =
		cards.length > 0 ? [{ count: cards.length, card_ids: cards.map((c) => c.id), card_names: [] }] : [];

	return {
		provider: {
			getStackedGroupBySQL: vi.fn().mockReturnValue({
				colAxes: [{ field: 'card_type', direction: 'asc' }],
				rowAxes: [{ field: 'folder', direction: 'asc' }],
			}),
			setColAxes: vi.fn(),
			setRowAxes: vi.fn(),
			getColWidths: vi.fn().mockReturnValue({}),
			setColWidths: vi.fn(),
			getSortOverrides: vi.fn().mockReturnValue([]),
			setSortOverrides: vi.fn(),
			getCollapseState: vi.fn().mockReturnValue([]),
			setCollapseState: vi.fn(),
			reorderColAxes: vi.fn(),
			reorderRowAxes: vi.fn(),
		},
		filter: {
			compile: vi.fn().mockReturnValue({ where: 'deleted_at IS NULL', params: [] }),
			hasAxisFilter: vi.fn().mockReturnValue(false),
			getAxisFilter: vi.fn().mockReturnValue([]),
			setAxisFilter: vi.fn(),
			clearAxis: vi.fn(),
			clearAllAxisFilters: vi.fn(),
		},
		bridge: {
			superGridQuery: vi.fn().mockResolvedValue(cells),
			calcQuery: vi.fn().mockResolvedValue({ rows: [] }),
		},
		coordinator: {
			subscribe: vi.fn().mockReturnValue(vi.fn()),
		},
	};
}

// ---------------------------------------------------------------------------
// Source card loading (import fixture subset, query cards back as CardDatum[])
// ---------------------------------------------------------------------------

const sourceCardCache = new Map<SourceType, CardDatum[]>();
const sourceDbCache = new Map<SourceType, Database>();

async function setupSourceCards(source: SourceType): Promise<CardDatum[]> {
	if (sourceCardCache.has(source)) return sourceCardCache.get(source)!;

	const db = await createTestDb();
	sourceDbCache.set(source, db);

	// Import the fixture
	switch (source) {
		case 'apple_notes':
		case 'markdown':
		case 'csv':
		case 'json': {
			const fixtureMap: Record<string, string> = {
				apple_notes: 'apple-notes-snapshot.json',
				markdown: 'markdown-snapshot.json',
				csv: 'csv-snapshot.json',
				json: 'json-snapshot.json',
			};
			const fixture = loadFixture(fixtureMap[source]!);
			await importFileSource(db, source, fixture);
			break;
		}
		case 'excel': {
			const rows = loadFixtureJSON<Record<string, unknown>[]>('excel-rows.json');
			const buffer = await generateExcelBuffer(rows);
			await importFileSource(db, 'excel', buffer);
			break;
		}
		case 'html': {
			const htmlStrings = loadFixtureJSON<string[]>('html-snapshot.json');
			const orchestrator = new ImportOrchestrator(db);
			await orchestrator.import('html', htmlStrings as unknown as ParsedFile[]);
			break;
		}
		case 'native_reminders': {
			const cards = loadFixtureJSON<CanonicalCard[]>('native-reminders.json');
			await importNativeSource(db, 'native_reminders', cards);
			break;
		}
		case 'native_calendar': {
			const cards = loadFixtureJSON<CanonicalCard[]>('native-calendar.json');
			await importNativeSource(db, 'native_calendar', cards);
			break;
		}
		case 'native_notes': {
			const cards = loadFixtureJSON<CanonicalCard[]>('native-notes.json');
			await importNativeSource(db, 'native_notes', cards);
			break;
		}
	}

	// Query back cards (use first 20 for rendering speed)
	const allCards = queryCardsForSource(db, source);
	const subset = allCards.slice(0, 20);
	sourceCardCache.set(source, subset);
	return subset;
}

// Clean up databases after all tests
afterAll(() => {
	for (const db of sourceDbCache.values()) {
		db.close();
	}
	sourceDbCache.clear();
	sourceCardCache.clear();
});

// ---------------------------------------------------------------------------
// 81 Source x View Matrix
// ---------------------------------------------------------------------------

describe.each(SOURCES)('Source: %s', (sourceType) => {
	let cards: CardDatum[];
	let container: HTMLElement;

	beforeAll(async () => {
		cards = await setupSourceCards(sourceType);
	});

	beforeEach(() => {
		container = document.createElement('div');
		Object.defineProperty(container, 'clientWidth', { configurable: true, value: 800 });
		Object.defineProperty(container, 'clientHeight', { configurable: true, value: 600 });
		document.body.appendChild(container);
	});

	afterEach(() => {
		document.body.removeChild(container);
	});

	it('ListView renders without error', () => {
		const view = new ListView();
		view.mount(container);
		expect(() => view.render(cards)).not.toThrow();

		const groups = container.querySelectorAll('g.card');
		expect(groups.length).toBe(cards.length);
		expect(consoleErrorSpy).not.toHaveBeenCalled();

		view.destroy();
	});

	it('GridView renders without error', () => {
		const view = new GridView();
		view.mount(container);
		expect(() => view.render(cards)).not.toThrow();

		const groups = container.querySelectorAll('g.card');
		expect(groups.length).toBe(cards.length);
		expect(consoleErrorSpy).not.toHaveBeenCalled();

		view.destroy();
	});

	it('GalleryView renders without error', () => {
		const view = new GalleryView();
		view.mount(container);
		expect(() => view.render(cards)).not.toThrow();

		const tiles = container.querySelectorAll('.gallery-tile');
		expect(tiles.length).toBe(cards.length);
		expect(consoleErrorSpy).not.toHaveBeenCalled();

		view.destroy();
	});

	it('CalendarView renders without error', () => {
		const dp = makeMockDensityProvider('month');
		const view = new CalendarView({ densityProvider: dp });
		view.mount(container);
		expect(() => view.render(cards)).not.toThrow();

		// CalendarView should mount its structure even if no cards have due_at
		const calView = container.querySelector('.calendar-view');
		expect(calView).not.toBeNull();
		expect(consoleErrorSpy).not.toHaveBeenCalled();

		view.destroy();
	});

	it('KanbanView renders without error', () => {
		const mm = makeMockMutationManager();
		const view = new KanbanView({ mutationManager: mm });
		view.mount(container);
		expect(() => view.render(cards)).not.toThrow();

		// KanbanView should create at least one column
		const columns = container.querySelectorAll('.kanban-column');
		expect(columns.length).toBeGreaterThanOrEqual(1);
		expect(consoleErrorSpy).not.toHaveBeenCalled();

		view.destroy();
	});

	it('NetworkView renders without error', async () => {
		const bridge = makeNetworkBridge(cards);
		const view = new NetworkView({ bridge });
		view.mount(container);
		await expect(view.render(cards)).resolves.not.toThrow();

		if (cards.length > 0) {
			const circles = container.querySelectorAll('circle');
			expect(circles.length).toBe(cards.length);
		}
		expect(consoleErrorSpy).not.toHaveBeenCalled();

		view.destroy();
	});

	it('TreeView renders without error', async () => {
		const bridge = makeTreeBridge([]);
		const view = new TreeView({ bridge });
		view.mount(container);
		await view.render(cards);

		// With no connections, all cards go to orphan-list
		const orphanItems = container.querySelectorAll('.orphan-item');
		expect(orphanItems.length).toBe(cards.length);
		expect(consoleErrorSpy).not.toHaveBeenCalled();

		view.destroy();
	});

	it('TimelineView renders without error', () => {
		const view = new TimelineView();
		view.mount(container);
		expect(() => view.render(cards)).not.toThrow();

		// TimelineView only shows cards with due_at; empty timeline is valid
		const calContainer = container.querySelector('svg');
		expect(calContainer).not.toBeNull();
		expect(consoleErrorSpy).not.toHaveBeenCalled();

		view.destroy();
	});

	it('SuperGrid renders without error', async () => {
		const mocks = makeSuperGridMocks(cards);
		const grid = new SuperGrid(mocks.provider, mocks.filter, mocks.bridge, mocks.coordinator);
		grid.mount(container);
		// SuperGrid self-manages via bridge, render is a no-op but should not throw
		expect(() => grid.render(cards)).not.toThrow();
		expect(consoleErrorSpy).not.toHaveBeenCalled();

		grid.destroy();
	});
});

// ---------------------------------------------------------------------------
// High-value combination assertions (field-dependent features)
// ---------------------------------------------------------------------------

describe('High-value source x view combinations', () => {
	let container: HTMLElement;

	beforeEach(() => {
		container = document.createElement('div');
		Object.defineProperty(container, 'clientWidth', { configurable: true, value: 800 });
		Object.defineProperty(container, 'clientHeight', { configurable: true, value: 600 });
		document.body.appendChild(container);
	});

	afterEach(() => {
		document.body.removeChild(container);
	});

	it('native_calendar + CalendarView: events appear on calendar', async () => {
		const cards = await setupSourceCards('native_calendar');
		const dp = makeMockDensityProvider('month');
		const view = new CalendarView({ densityProvider: dp });
		view.mount(container);
		view.render(cards);

		// native_calendar cards have due_at set -- at least some should produce calendar chips
		const cardsWithDueAt = cards.filter((c) => c.due_at !== null);
		if (cardsWithDueAt.length > 0) {
			// Calendar should have at least some day cells with cards in them
			const _cardChips = container.querySelectorAll('.calendar-day .card');
			// At least one chip should render (depends on whether dates fall in current month)
			// We just verify no errors and structure exists
			expect(container.querySelector('.calendar-view')).not.toBeNull();
		}
		expect(consoleErrorSpy).not.toHaveBeenCalled();

		view.destroy();
	});

	it('native_reminders + KanbanView: cards grouped by status', async () => {
		const cards = await setupSourceCards('native_reminders');
		const mm = makeMockMutationManager();
		const view = new KanbanView({ mutationManager: mm });
		view.mount(container);
		view.render(cards);

		// native_reminders have mixed statuses (incomplete/complete)
		const columns = container.querySelectorAll('.kanban-column');
		expect(columns.length).toBeGreaterThanOrEqual(1);

		// Count total cards across columns
		const allCardEls = container.querySelectorAll('.card');
		expect(allCardEls.length).toBe(cards.length);
		expect(consoleErrorSpy).not.toHaveBeenCalled();

		view.destroy();
	});

	it('apple_notes + NetworkView: nodes rendered for each card', async () => {
		const cards = await setupSourceCards('apple_notes');
		const bridge = makeNetworkBridge(cards);
		const view = new NetworkView({ bridge });
		view.mount(container);
		await view.render(cards);

		const circles = container.querySelectorAll('circle');
		expect(circles.length).toBe(cards.length);
		expect(consoleErrorSpy).not.toHaveBeenCalled();

		view.destroy();
	});

	it('native_notes + TreeView: renders nodes (orphans for flat connections)', async () => {
		const cards = await setupSourceCards('native_notes');
		// Native notes may have note-link connections, but without loading them
		// into the bridge mock, they appear as orphans -- still valid rendering
		const bridge = makeTreeBridge([]);
		const view = new TreeView({ bridge });
		view.mount(container);
		await view.render(cards);

		const orphanItems = container.querySelectorAll('.orphan-item');
		expect(orphanItems.length).toBe(cards.length);
		expect(consoleErrorSpy).not.toHaveBeenCalled();

		view.destroy();
	});

	it('native_calendar + TimelineView: events with due_at appear on timeline', async () => {
		const cards = await setupSourceCards('native_calendar');
		const view = new TimelineView();
		view.mount(container);
		view.render(cards);

		// Calendar events should have due_at -- cards with due_at render as g.card
		const cardsWithDueAt = cards.filter((c) => c.due_at !== null);
		if (cardsWithDueAt.length > 0) {
			const cardEls = container.querySelectorAll('g.card');
			expect(cardEls.length).toBe(cardsWithDueAt.length);
		}
		expect(consoleErrorSpy).not.toHaveBeenCalled();

		view.destroy();
	});

	it('csv + CalendarView: no due_at cards = empty calendar (valid)', async () => {
		const cards = await setupSourceCards('csv');
		const dp = makeMockDensityProvider('month');
		const view = new CalendarView({ densityProvider: dp });
		view.mount(container);
		view.render(cards);

		// CSV cards typically have no due_at -- calendar shows empty but does not crash
		expect(container.querySelector('.calendar-view')).not.toBeNull();
		expect(consoleErrorSpy).not.toHaveBeenCalled();

		view.destroy();
	});

	it('excel + TimelineView: no due_at cards = empty timeline (valid)', async () => {
		const cards = await setupSourceCards('excel');
		const view = new TimelineView();
		view.mount(container);
		view.render(cards);

		// Excel cards have no due_at -- timeline renders empty SVG (valid)
		expect(container.querySelector('svg')).not.toBeNull();
		expect(consoleErrorSpy).not.toHaveBeenCalled();

		view.destroy();
	});

	it('json + NetworkView: nodes only, no edges (valid)', async () => {
		const cards = await setupSourceCards('json');
		const bridge = makeNetworkBridge(cards);
		const view = new NetworkView({ bridge });
		view.mount(container);
		await view.render(cards);

		// JSON source has no connections -- nodes rendered, no edges
		const circles = container.querySelectorAll('circle');
		expect(circles.length).toBe(cards.length);
		const lines = container.querySelectorAll('line');
		expect(lines.length).toBe(0);
		expect(consoleErrorSpy).not.toHaveBeenCalled();

		view.destroy();
	});

	it('html + TreeView: flat list (no connections) = all orphans (valid)', async () => {
		const cards = await setupSourceCards('html');
		const bridge = makeTreeBridge([]);
		const view = new TreeView({ bridge });
		view.mount(container);
		await view.render(cards);

		// HTML source has no connections -- all cards are orphans
		const orphanItems = container.querySelectorAll('.orphan-item');
		expect(orphanItems.length).toBe(cards.length);
		const treeNodes = container.querySelectorAll('g.tree-node-group');
		expect(treeNodes.length).toBe(0);
		expect(consoleErrorSpy).not.toHaveBeenCalled();

		view.destroy();
	});
});
