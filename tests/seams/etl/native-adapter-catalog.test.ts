// Isometry v8.5 — Phase 111 Plan 01
// Native adapter CatalogWriter provenance seam tests.
//
// Verifies that handleETLImportNative creates correct import_sources,
// import_runs, and datasets rows for each of the 3 native adapters.
//
// Requirements: NATV-01, NATV-02, NATV-03

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Database } from '../../../src/database/Database';
import type { CanonicalCard } from '../../../src/etl/types';
import calendarFixture from '../../fixtures/native-adapter/calendar.json';
import notesFixture from '../../fixtures/native-adapter/notes.json';
import remindersFixture from '../../fixtures/native-adapter/reminders.json';
import { realDb } from '../../harness/realDb';

// Mock Worker self.postMessage — handler uses it for progress notifications
const mockPostMessage = vi.fn();
(globalThis as any).self = { postMessage: mockPostMessage };

// Must import AFTER self mock is established
const { handleETLImportNative } = await import('../../../src/worker/handlers/etl-import-native.handler');

// ---------------------------------------------------------------------------
// Test state
// ---------------------------------------------------------------------------

let db: Database;

beforeEach(async () => {
	mockPostMessage.mockClear();
	db = await realDb();
});

afterEach(() => {
	db.close();
});

// ---------------------------------------------------------------------------
// NATV-01: Native Notes CatalogWriter provenance
// ---------------------------------------------------------------------------

describe('NATV-01: Native Notes CatalogWriter provenance', () => {
	it('NATV-01a: import_sources row created with source_type=native_notes and name=Native Notes', async () => {
		await handleETLImportNative(db, { sourceType: 'native_notes', cards: notesFixture as CanonicalCard[] });

		const sources = db.exec("SELECT source_type, name FROM import_sources WHERE source_type = 'native_notes'");
		expect(sources[0]!.values).toHaveLength(1);
		expect(sources[0]!.values[0]![0]).toBe('native_notes');
		expect(sources[0]!.values[0]![1]).toBe('Native Notes');
	});

	it('NATV-01b: import_runs row has correct cards_inserted count', async () => {
		const result = await handleETLImportNative(db, {
			sourceType: 'native_notes',
			cards: notesFixture as CanonicalCard[],
		});

		const runs = db.exec(`
			SELECT r.cards_inserted FROM import_runs r
			JOIN import_sources s ON r.source_id = s.id
			WHERE s.source_type = 'native_notes'
		`);
		expect(runs[0]!.values).toHaveLength(1);
		expect(runs[0]!.values[0]![0]).toBe(result.inserted);
	});

	it('NATV-01c: datasets row created with name=Native Notes and source_type=native_notes', async () => {
		await handleETLImportNative(db, { sourceType: 'native_notes', cards: notesFixture as CanonicalCard[] });

		const datasets = db.exec("SELECT name, source_type, is_active FROM datasets WHERE source_type = 'native_notes'");
		expect(datasets[0]!.values).toHaveLength(1);
		expect(datasets[0]!.values[0]![0]).toBe('Native Notes');
		expect(datasets[0]!.values[0]![1]).toBe('native_notes');
		expect(datasets[0]!.values[0]![2]).toBe(1); // is_active
	});
});

// ---------------------------------------------------------------------------
// NATV-02: Native Reminders CatalogWriter provenance
// ---------------------------------------------------------------------------

describe('NATV-02: Native Reminders CatalogWriter provenance', () => {
	it('NATV-02a: import_sources row created with source_type=native_reminders and name=Native Reminders', async () => {
		await handleETLImportNative(db, { sourceType: 'native_reminders', cards: remindersFixture as CanonicalCard[] });

		const sources = db.exec("SELECT source_type, name FROM import_sources WHERE source_type = 'native_reminders'");
		expect(sources[0]!.values).toHaveLength(1);
		expect(sources[0]!.values[0]![0]).toBe('native_reminders');
		expect(sources[0]!.values[0]![1]).toBe('Native Reminders');
	});

	it('NATV-02b: import_runs row has correct cards_inserted count', async () => {
		const result = await handleETLImportNative(db, {
			sourceType: 'native_reminders',
			cards: remindersFixture as CanonicalCard[],
		});

		const runs = db.exec(`
			SELECT r.cards_inserted FROM import_runs r
			JOIN import_sources s ON r.source_id = s.id
			WHERE s.source_type = 'native_reminders'
		`);
		expect(runs[0]!.values).toHaveLength(1);
		expect(runs[0]!.values[0]![0]).toBe(result.inserted);
	});

	it('NATV-02c: datasets row created with name=Native Reminders and source_type=native_reminders', async () => {
		await handleETLImportNative(db, { sourceType: 'native_reminders', cards: remindersFixture as CanonicalCard[] });

		const datasets = db.exec(
			"SELECT name, source_type, is_active FROM datasets WHERE source_type = 'native_reminders'",
		);
		expect(datasets[0]!.values).toHaveLength(1);
		expect(datasets[0]!.values[0]![0]).toBe('Native Reminders');
		expect(datasets[0]!.values[0]![1]).toBe('native_reminders');
		expect(datasets[0]!.values[0]![2]).toBe(1);
	});
});

// ---------------------------------------------------------------------------
// NATV-03: Native Calendar CatalogWriter provenance
// ---------------------------------------------------------------------------

describe('NATV-03: Native Calendar CatalogWriter provenance', () => {
	it('NATV-03a: import_sources row created with source_type=native_calendar and name=Native Calendar', async () => {
		await handleETLImportNative(db, { sourceType: 'native_calendar', cards: calendarFixture as CanonicalCard[] });

		const sources = db.exec("SELECT source_type, name FROM import_sources WHERE source_type = 'native_calendar'");
		expect(sources[0]!.values).toHaveLength(1);
		expect(sources[0]!.values[0]![0]).toBe('native_calendar');
		expect(sources[0]!.values[0]![1]).toBe('Native Calendar');
	});

	it('NATV-03b: import_runs row has correct cards_inserted count', async () => {
		const result = await handleETLImportNative(db, {
			sourceType: 'native_calendar',
			cards: calendarFixture as CanonicalCard[],
		});

		const runs = db.exec(`
			SELECT r.cards_inserted FROM import_runs r
			JOIN import_sources s ON r.source_id = s.id
			WHERE s.source_type = 'native_calendar'
		`);
		expect(runs[0]!.values).toHaveLength(1);
		expect(runs[0]!.values[0]![0]).toBe(result.inserted);
	});

	it('NATV-03c: datasets row created with name=Native Calendar and source_type=native_calendar', async () => {
		await handleETLImportNative(db, { sourceType: 'native_calendar', cards: calendarFixture as CanonicalCard[] });

		const datasets = db.exec("SELECT name, source_type, is_active FROM datasets WHERE source_type = 'native_calendar'");
		expect(datasets[0]!.values).toHaveLength(1);
		expect(datasets[0]!.values[0]![0]).toBe('Native Calendar');
		expect(datasets[0]!.values[0]![1]).toBe('native_calendar');
		expect(datasets[0]!.values[0]![2]).toBe(1);
	});

	it('NATV-03d: import result includes correct inserted and connections_created counts', async () => {
		const result = await handleETLImportNative(db, {
			sourceType: 'native_calendar',
			cards: calendarFixture as CanonicalCard[],
		});
		expect(result.inserted).toBe(calendarFixture.length);
		expect(result.errors).toBe(0);
		// Calendar fixture has 2 attendee cards with source_url 'attendee-of:...'
		// Each creates 1 connection
		expect(result.connections_created).toBeGreaterThanOrEqual(2);
	});
});
