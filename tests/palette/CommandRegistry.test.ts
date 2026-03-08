import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PaletteCommand } from '../../src/palette/CommandRegistry';
import {
	CommandRegistry,
	getRecentCommands,
	getRecents,
	MAX_RECENTS,
	pushRecent,
	RECENTS_KEY,
} from '../../src/palette/CommandRegistry';
import { fuzzyMatch } from '../../src/palette/fuzzy';

// ---------------------------------------------------------------------------
// localStorage stub (Vitest runs in Node, no DOM APIs)
// ---------------------------------------------------------------------------
const localStorageMap = new Map<string, string>();
const localStorageStub = {
	getItem: (key: string) => localStorageMap.get(key) ?? null,
	setItem: (key: string, value: string) => localStorageMap.set(key, value),
	removeItem: (key: string) => localStorageMap.delete(key),
	clear: () => localStorageMap.clear(),
	get length() {
		return localStorageMap.size;
	},
	key: (_index: number) => null as string | null,
};

beforeEach(() => {
	vi.stubGlobal('localStorage', localStorageStub);
});

afterEach(() => {
	localStorageMap.clear();
	vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeCommand(overrides: Partial<PaletteCommand> & { id: string; label: string }): PaletteCommand {
	return {
		category: 'Actions',
		execute: () => {},
		...overrides,
	};
}

// ===========================================================================
// fuzzyMatch
// ===========================================================================
describe('fuzzyMatch', () => {
	it("matches 'lv' to 'List View' with a positive score", () => {
		const score = fuzzyMatch('lv', 'List View');
		expect(score).not.toBeNull();
		expect(score).toBeGreaterThan(0);
	});

	it("returns null for 'lv' against 'Calendar View' (no match)", () => {
		expect(fuzzyMatch('lv', 'Calendar View')).toBeNull();
	});

	it("scores substring match ('list') higher than scattered match ('lv')", () => {
		const substringScore = fuzzyMatch('list', 'List View');
		const scatteredScore = fuzzyMatch('lv', 'List View');
		expect(substringScore).not.toBeNull();
		expect(scatteredScore).not.toBeNull();
		expect(substringScore!).toBeGreaterThan(scatteredScore!);
	});

	it('returns null for empty query', () => {
		expect(fuzzyMatch('', 'anything')).toBeNull();
	});

	it("returns highest score for exact substring match ('list view')", () => {
		const exactScore = fuzzyMatch('list view', 'List View');
		const partialScore = fuzzyMatch('list', 'List View');
		expect(exactScore).not.toBeNull();
		expect(partialScore).not.toBeNull();
		expect(exactScore!).toBeGreaterThan(partialScore!);
	});

	it('is case-insensitive', () => {
		const score = fuzzyMatch('LIST', 'List View');
		expect(score).not.toBeNull();
		expect(score).toBeGreaterThan(0);
	});
});

// ===========================================================================
// CommandRegistry
// ===========================================================================
describe('CommandRegistry', () => {
	let registry: CommandRegistry;

	beforeEach(() => {
		registry = new CommandRegistry();
	});

	describe('register / getById', () => {
		it('adds a command retrievable by getById()', () => {
			const cmd = makeCommand({ id: 'view:list', label: 'List View' });
			registry.register(cmd);
			expect(registry.getById('view:list')).toBe(cmd);
		});

		it('returns undefined for unknown ID', () => {
			expect(registry.getById('nope')).toBeUndefined();
		});
	});

	describe('search', () => {
		it('returns commands matching query, sorted by score descending', () => {
			registry.registerAll([
				makeCommand({ id: 'view:list', label: 'List View', category: 'Views' }),
				makeCommand({
					id: 'view:calendar',
					label: 'Calendar View',
					category: 'Views',
				}),
				makeCommand({
					id: 'view:network',
					label: 'Network View',
					category: 'Views',
				}),
			]);

			const results = registry.search('lv');
			// 'lv' matches 'List View' but not 'Calendar View' or 'Network View'
			expect(results.length).toBe(1);
			expect(results[0]!.id).toBe('view:list');
		});

		it('excludes commands with visible() returning false', () => {
			registry.registerAll([
				makeCommand({
					id: 'action:clear',
					label: 'Clear Filters',
					visible: () => false,
				}),
				makeCommand({
					id: 'action:refresh',
					label: 'Refresh',
					visible: () => true,
				}),
			]);

			const results = registry.search('r');
			// 'Clear Filters' is hidden; 'Refresh' is visible and matches 'r'
			expect(results.some((c) => c.id === 'action:clear')).toBe(false);
			expect(results.some((c) => c.id === 'action:refresh')).toBe(true);
		});
	});

	describe('getVisible', () => {
		it('returns commands without a visible predicate', () => {
			const cmd = makeCommand({ id: 'a', label: 'Alpha' });
			registry.register(cmd);
			expect(registry.getVisible()).toContain(cmd);
		});

		it('returns commands whose visible() returns true', () => {
			const cmd = makeCommand({
				id: 'b',
				label: 'Beta',
				visible: () => true,
			});
			registry.register(cmd);
			expect(registry.getVisible()).toContain(cmd);
		});

		it('excludes commands whose visible() returns false', () => {
			const cmd = makeCommand({
				id: 'c',
				label: 'Gamma',
				visible: () => false,
			});
			registry.register(cmd);
			expect(registry.getVisible()).not.toContain(cmd);
		});
	});
});

// ===========================================================================
// Recents (localStorage persistence)
// ===========================================================================
describe('Recents', () => {
	it('pushRecent stores ID retrievable by getRecents()', () => {
		pushRecent('view:list');
		const recents = getRecents();
		expect(recents).toContain('view:list');
	});

	it('getRecents returns most-recent-first order', () => {
		pushRecent('view:list');
		pushRecent('view:network');
		const recents = getRecents();
		expect(recents[0]).toBe('view:network');
		expect(recents[1]).toBe('view:list');
	});

	it('pushRecent deduplicates -- pushing existing ID moves it to front', () => {
		pushRecent('a');
		pushRecent('b');
		pushRecent('a'); // move 'a' to front
		const recents = getRecents();
		expect(recents).toEqual(['a', 'b']);
	});

	it('pushRecent caps at MAX_RECENTS (5) entries', () => {
		for (let i = 0; i < 10; i++) {
			pushRecent(`cmd:${i}`);
		}
		const recents = getRecents();
		expect(recents.length).toBe(MAX_RECENTS);
		// Most recent should be last pushed
		expect(recents[0]).toBe('cmd:9');
	});

	it('persists under the correct localStorage key', () => {
		pushRecent('view:list');
		const raw = localStorage.getItem(RECENTS_KEY);
		expect(raw).not.toBeNull();
		expect(JSON.parse(raw!)).toContain('view:list');
	});

	it('getRecents returns empty array on parse failure', () => {
		localStorage.setItem(RECENTS_KEY, 'not-json!!!');
		expect(getRecents()).toEqual([]);
	});

	describe('getRecentCommands', () => {
		it('resolves recent IDs against registry', () => {
			const registry = new CommandRegistry();
			const cmd = makeCommand({ id: 'view:list', label: 'List View' });
			registry.register(cmd);

			pushRecent('view:list');
			const commands = getRecentCommands(registry);
			expect(commands.length).toBe(1);
			expect(commands[0]).toBe(cmd);
		});

		it('skips IDs no longer registered', () => {
			const registry = new CommandRegistry();
			registry.register(makeCommand({ id: 'view:list', label: 'List View' }));

			pushRecent('view:list');
			pushRecent('view:deleted'); // not registered
			const commands = getRecentCommands(registry);
			expect(commands.length).toBe(1);
			expect(commands[0]!.id).toBe('view:list');
		});
	});
});
