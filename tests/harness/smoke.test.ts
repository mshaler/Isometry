/**
 * Isometry v6.1 — Phase 79 Test Infrastructure
 * Smoke tests for realDb() and makeProviders() factories.
 *
 * These tests prove the harness infrastructure works correctly before
 * any seam tests (Phases 80-83) depend on it.
 *
 * Test lifecycle:
 *   beforeEach: vi.useFakeTimers(), db = await realDb(), providers = makeProviders(db)
 *   afterEach:  providers.coordinator.destroy(), db.close(), vi.useRealTimers()
 *
 * Coordinator flush pattern (from seam-coordinator-batch.test.ts):
 *   await Promise.resolve() x2 → vi.advanceTimersByTime(20) → await Promise.resolve()
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Database } from '../../src/database/Database';
import { FilterProvider } from '../../src/providers/FilterProvider';
import { PAFVProvider } from '../../src/providers/PAFVProvider';
import { SchemaProvider } from '../../src/providers/SchemaProvider';
import { SelectionProvider } from '../../src/providers/SelectionProvider';
import { StateCoordinator } from '../../src/providers/StateCoordinator';
import { SuperDensityProvider } from '../../src/providers/SuperDensityProvider';
import { makeProviders, type ProviderStack } from './makeProviders';
import { realDb } from './realDb';
import { seedCards } from './seedCards';

// ---------------------------------------------------------------------------
// Flush helper (established pattern from seam-coordinator-batch.test.ts)
// ---------------------------------------------------------------------------

async function flushCoordinatorCycle(): Promise<void> {
	// Flush microtasks (provider self-notify via queueMicrotask)
	await Promise.resolve();
	await Promise.resolve();
	// Advance past the coordinator's 16ms setTimeout
	vi.advanceTimersByTime(20);
	// Flush remaining microtasks from coordinator callback
	await Promise.resolve();
}

// ---------------------------------------------------------------------------
// Test state
// ---------------------------------------------------------------------------

let db: Database;
let providers: ProviderStack;

beforeEach(async () => {
	vi.useFakeTimers();
	db = await realDb();
	providers = makeProviders(db);
});

afterEach(() => {
	providers.coordinator.destroy();
	db.close();
	vi.useRealTimers();
});

// ---------------------------------------------------------------------------
// describe: realDb() smoke
// ---------------------------------------------------------------------------

describe('realDb() smoke', () => {
	it('INSERT/SELECT round-trip — inserted card is retrievable by id', () => {
		const ids = seedCards(db, [{ name: 'Test Card', folder: 'Inbox' }]);
		const id = ids[0] as string;
		const rows = db.exec('SELECT id, name, folder FROM cards WHERE id = ?', [id]);
		expect(rows).toHaveLength(1);
		const row = rows[0]?.values[0];
		expect(row?.[0]).toBe(id);
		expect(row?.[1]).toBe('Test Card');
		expect(row?.[2]).toBe('Inbox');
	});

	it('FTS5 round-trip — FTS MATCH returns inserted card by name token', () => {
		seedCards(db, [{ name: 'Quantum Physics', content: 'Wave-particle duality' }]);
		const rows = db.exec("SELECT name FROM cards_fts WHERE cards_fts MATCH 'Quantum'");
		expect(rows).toHaveLength(1);
		expect(rows[0]?.values[0]?.[0]).toBe('Quantum Physics');
	});

	it('all required tables exist in sqlite_master', () => {
		const rows = db.exec("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
		const tables = (rows[0]?.values ?? []).map((r) => r[0] as string);
		expect(tables).toContain('cards');
		expect(tables).toContain('connections');
		expect(tables).toContain('cards_fts');
		expect(tables).toContain('ui_state');
	});

	it('all 6 Phase 76 covering/expression indexes exist', () => {
		const rows = db.exec(
			"SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_cards_sg_%' ORDER BY name",
		);
		const indexNames = rows[0]?.values.map((r) => r[0] as string) ?? [];
		expect(indexNames).toContain('idx_cards_sg_folder_type');
		expect(indexNames).toContain('idx_cards_sg_created_day');
		expect(indexNames).toContain('idx_cards_sg_created_week');
		expect(indexNames).toContain('idx_cards_sg_created_month');
		expect(indexNames).toContain('idx_cards_sg_created_quarter');
		expect(indexNames).toContain('idx_cards_sg_created_year');
		expect(indexNames).toHaveLength(6);
	});
});

// ---------------------------------------------------------------------------
// describe: makeProviders() smoke
// ---------------------------------------------------------------------------

describe('makeProviders() smoke', () => {
	it('all 6 providers are present and instances of correct classes', () => {
		const { filter, pafv, density, selection, coordinator, schema } = providers;
		expect(filter).toBeInstanceOf(FilterProvider);
		expect(pafv).toBeInstanceOf(PAFVProvider);
		expect(density).toBeInstanceOf(SuperDensityProvider);
		expect(selection).toBeInstanceOf(SelectionProvider);
		expect(coordinator).toBeInstanceOf(StateCoordinator);
		expect(schema).toBeInstanceOf(SchemaProvider);
	});

	it('SchemaProvider is initialized after makeProviders()', () => {
		expect(providers.schema.initialized).toBe(true);
	});

	it('filter change fires coordinator notification', async () => {
		const viewCallback = vi.fn();
		providers.coordinator.subscribe(viewCallback);

		// setAxisFilter uses a field that exists in the real PRAGMA schema
		providers.filter.setAxisFilter('folder', ['Inbox']);

		expect(viewCallback).not.toHaveBeenCalled();

		await flushCoordinatorCycle();

		expect(viewCallback).toHaveBeenCalledTimes(1);
	});

	it('coordinator.destroy() stops notifications after cleanup', async () => {
		const viewCallback = vi.fn();
		providers.coordinator.subscribe(viewCallback);

		// Destroy before the filter change
		providers.coordinator.destroy();

		providers.filter.setAxisFilter('folder', ['Inbox']);
		await flushCoordinatorCycle();

		// Coordinator was destroyed — callback should not fire
		expect(viewCallback).not.toHaveBeenCalled();
	});
});
