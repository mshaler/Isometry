// Isometry v8.5 — Phase 111 Plan 02
// NoteStore schema branching and protobuf 3-tier fallback seam tests.
//
// NATV-06: Verifies that cards produced by macOS 13 (ZTITLE1) and macOS 14+
// (ZTITLE2) schema variants are correctly preserved through the handler.
// The handler receives pre-parsed CanonicalCard[] — schema detection is Swift-side.
// These tests verify the boundary contract: if Swift extracts the correct title,
// the handler preserves it in the cards table.
//
// NATV-07: Verifies that the three tiers of protobuf body extraction
// (ZDATA body, ZSNIPPET fallback, null content) are preserved through the handler.
// The handler stores content as-is — extraction is Swift-side.
// These tests verify no content mutation or crash at the boundary.
//
// Requirements: NATV-06, NATV-07

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Database } from '../../../src/database/Database';
import type { CanonicalCard } from '../../../src/etl/types';
import { realDb } from '../../harness/realDb';

// Mock Worker self.postMessage — handler uses it for progress notifications
const mockPostMessage = vi.fn();
(globalThis as any).self = { postMessage: mockPostMessage };

// Must import AFTER self mock is established
const { handleETLImportNative } = await import('../../../src/worker/handlers/etl-import-native.handler');

// ---------------------------------------------------------------------------
// CanonicalCard factory helper
// ---------------------------------------------------------------------------

function makeCard(overrides: Partial<CanonicalCard>): CanonicalCard {
	return {
		id: crypto.randomUUID(),
		card_type: 'note',
		name: 'Test Note',
		content: null,
		summary: null,
		latitude: null,
		longitude: null,
		location_name: null,
		created_at: '2026-03-20T12:00:00Z',
		modified_at: '2026-03-20T12:00:00Z',
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
		source: 'native_notes',
		source_id: crypto.randomUUID(),
		source_url: null,
		deleted_at: null,
		...overrides,
	};
}

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
// NATV-06: NoteStore schema branching — macOS 13 vs 14+ title preservation
// ---------------------------------------------------------------------------

describe('NATV-06: NoteStore schema branching — macOS 13 vs 14+ title preservation', () => {
	it('NATV-06a: card from macOS 13 (ZTITLE1) variant preserves title through handler', async () => {
		// Simulates NotesAdapter output when reading from ZTITLE1 column (macOS 13)
		const card = makeCard({
			name: 'macOS 13 Note Title via ZTITLE1',
			source_id: 'V13-NOTE-001',
			content: 'Body text extracted on macOS 13',
		});

		await handleETLImportNative(db, { sourceType: 'native_notes', cards: [card] });

		const rows = db.exec("SELECT name FROM cards WHERE source_id = 'V13-NOTE-001'");
		expect(rows[0]!.values[0]![0]).toBe('macOS 13 Note Title via ZTITLE1');
	});

	it('NATV-06b: card from macOS 14+ (ZTITLE2) variant preserves title through handler', async () => {
		// Simulates NotesAdapter output when reading from ZTITLE2 column (macOS 14+)
		const card = makeCard({
			name: 'macOS 14 Note Title via ZTITLE2',
			source_id: 'V14-NOTE-001',
			content: 'Body text extracted on macOS 14',
		});

		await handleETLImportNative(db, { sourceType: 'native_notes', cards: [card] });

		const rows = db.exec("SELECT name FROM cards WHERE source_id = 'V14-NOTE-001'");
		expect(rows[0]!.values[0]![0]).toBe('macOS 14 Note Title via ZTITLE2');
	});

	it('NATV-06c: both schema variants in same batch preserve distinct titles', async () => {
		const v13Card = makeCard({
			name: 'Title from ZTITLE1',
			source_id: 'V13-BATCH-001',
		});
		const v14Card = makeCard({
			name: 'Title from ZTITLE2',
			source_id: 'V14-BATCH-001',
		});

		await handleETLImportNative(db, {
			sourceType: 'native_notes',
			cards: [v13Card, v14Card],
		});

		const v13Row = db.exec("SELECT name FROM cards WHERE source_id = 'V13-BATCH-001'");
		const v14Row = db.exec("SELECT name FROM cards WHERE source_id = 'V14-BATCH-001'");
		expect(v13Row[0]!.values[0]![0]).toBe('Title from ZTITLE1');
		expect(v14Row[0]!.values[0]![0]).toBe('Title from ZTITLE2');
	});
});

// ---------------------------------------------------------------------------
// NATV-07: Protobuf three-tier fallback content preservation
// ---------------------------------------------------------------------------

describe('NATV-07: Protobuf three-tier fallback content preservation', () => {
	it('NATV-07a: tier 1 — full ZDATA body text preserved in content field', async () => {
		const card = makeCard({
			name: 'Research Paper',
			source_id: 'PROTO-TIER1-001',
			content: 'Full protobuf-extracted body text about quantum computing with detailed formulas and references',
		});

		await handleETLImportNative(db, { sourceType: 'native_notes', cards: [card] });

		const rows = db.exec("SELECT content FROM cards WHERE source_id = 'PROTO-TIER1-001'");
		expect(rows[0]!.values[0]![0]).toBe(
			'Full protobuf-extracted body text about quantum computing with detailed formulas and references',
		);
	});

	it('NATV-07b: tier 2 — ZSNIPPET fallback text preserved when ZDATA absent', async () => {
		const card = makeCard({
			name: 'Quick Thought',
			source_id: 'PROTO-TIER2-001',
			content: 'Short snippet fallback text from ZSNIPPET column',
		});

		await handleETLImportNative(db, { sourceType: 'native_notes', cards: [card] });

		const rows = db.exec("SELECT content FROM cards WHERE source_id = 'PROTO-TIER2-001'");
		expect(rows[0]!.values[0]![0]).toBe('Short snippet fallback text from ZSNIPPET column');
	});

	it('NATV-07c: tier 3 — empty content when both ZDATA and ZSNIPPET absent (no crash)', async () => {
		const card = makeCard({
			name: 'Empty Note',
			source_id: 'PROTO-TIER3-001',
			content: '',
		});

		await handleETLImportNative(db, { sourceType: 'native_notes', cards: [card] });

		const rows = db.exec("SELECT content FROM cards WHERE source_id = 'PROTO-TIER3-001'");
		// Empty string is stored — not null, not crash
		expect(rows[0]!.values[0]![0]).toBe('');
	});

	it('NATV-07d: tier 3 with null content — stored as null, no crash', async () => {
		const card = makeCard({
			name: 'Truly Empty Note',
			source_id: 'PROTO-TIER3-NULL',
			content: null,
		});

		await handleETLImportNative(db, { sourceType: 'native_notes', cards: [card] });

		const rows = db.exec("SELECT content FROM cards WHERE source_id = 'PROTO-TIER3-NULL'");
		expect(rows[0]!.values[0]![0]).toBeNull();
	});
});
