// Isometry v8.5 — Phase 111 Plan 02
// Native adapter auto-connection synthesis seam tests.
//
// Verifies that handleETLImportNative creates correct connection rows for:
// 1. Calendar attendee-of person cards (NATV-04)
// 2. Notes internal link cards with bidirectional connections (NATV-05)
//
// Requirements: NATV-04, NATV-05

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
		name: 'Test Card',
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
		source: 'native_calendar',
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
// NATV-04: Calendar attendee-of auto-connections
// ---------------------------------------------------------------------------

describe('NATV-04: Calendar attendee-of auto-connections', () => {
	it('NATV-04a: attendee person card creates connection row linking person to event', async () => {
		const eventCard = makeCard({
			card_type: 'event',
			name: 'Team Standup',
			source: 'native_calendar',
			source_id: 'EVT-001',
			source_url: null,
			event_start: '2026-03-25T09:00:00Z',
			event_end: '2026-03-25T09:30:00Z',
		});
		const attendeeCard = makeCard({
			card_type: 'person',
			name: 'Alice Smith',
			source: 'native_calendar',
			source_id: 'ATT-001',
			source_url: 'attendee-of:EVT-001',
		});

		const result = await handleETLImportNative(db, {
			sourceType: 'native_calendar',
			cards: [eventCard, attendeeCard],
		});

		expect(result.connections_created).toBeGreaterThanOrEqual(1);

		// Verify connection row exists with correct topology
		const connections = db.exec(`
			SELECT source_id, target_id, label, weight
			FROM connections
			WHERE label = 'attendee'
		`);
		expect(connections[0]!.values).toHaveLength(1);
		const [srcId, tgtId, label, weight] = connections[0]!.values[0]!;
		expect(label).toBe('attendee');
		expect(weight).toBe(1);

		// Verify source is the attendee (person) and target is the event
		const personRow = db.exec("SELECT id FROM cards WHERE source_id = 'ATT-001'");
		const eventRow = db.exec("SELECT id FROM cards WHERE source_id = 'EVT-001'");
		expect(srcId).toBe(personRow[0]!.values[0]![0]);
		expect(tgtId).toBe(eventRow[0]!.values[0]![0]);
	});

	it('NATV-04b: multiple attendees create multiple connection rows to same event', async () => {
		const eventCard = makeCard({
			card_type: 'event',
			name: 'All Hands',
			source: 'native_calendar',
			source_id: 'EVT-002',
			source_url: null,
		});
		const att1 = makeCard({
			card_type: 'person',
			name: 'Alice',
			source: 'native_calendar',
			source_id: 'ATT-002',
			source_url: 'attendee-of:EVT-002',
		});
		const att2 = makeCard({
			card_type: 'person',
			name: 'Bob',
			source: 'native_calendar',
			source_id: 'ATT-003',
			source_url: 'attendee-of:EVT-002',
		});

		const result = await handleETLImportNative(db, {
			sourceType: 'native_calendar',
			cards: [eventCard, att1, att2],
		});

		const connections = db.exec("SELECT label FROM connections WHERE label = 'attendee'");
		expect(connections[0]!.values).toHaveLength(2);
		expect(result.connections_created).toBeGreaterThanOrEqual(2);
	});

	it('NATV-04c: attendee-of with non-existent event source_id creates no connection', async () => {
		const orphanAttendee = makeCard({
			card_type: 'person',
			name: 'Orphan',
			source: 'native_calendar',
			source_id: 'ATT-ORPHAN',
			source_url: 'attendee-of:NON-EXISTENT-EVENT',
		});

		await handleETLImportNative(db, {
			sourceType: 'native_calendar',
			cards: [orphanAttendee],
		});

		const connections = db.exec("SELECT count(*) FROM connections WHERE label = 'attendee'");
		expect(connections[0]!.values[0]![0]).toBe(0);
	});
});

// ---------------------------------------------------------------------------
// NATV-05: Notes internal link auto-connections
// ---------------------------------------------------------------------------

describe('NATV-05: Notes internal link auto-connections', () => {
	it('NATV-05a: note-link card creates bidirectional connections (links_to + linked_from)', async () => {
		const sourceNote = makeCard({
			card_type: 'note',
			name: 'Source Note',
			source: 'native_notes',
			source_id: 'SRC-NOTE-001',
			content: 'Contains a link',
		});
		const targetNote = makeCard({
			card_type: 'note',
			name: 'Target Note',
			source: 'native_notes',
			source_id: 'TGT-NOTE-001',
			content: 'Linked to by source',
		});
		const linkCard = makeCard({
			card_type: 'note',
			name: 'Source Note',
			source: 'native_notes',
			source_id: 'notelink:SRC-NOTE-001:TGT-NOTE-001',
			source_url: 'note-link:TGT-NOTE-001',
			content: null,
		});

		await handleETLImportNative(db, {
			sourceType: 'native_notes',
			cards: [sourceNote, targetNote, linkCard],
		});

		// Forward connection: source note -> target note, label='links_to', weight=0.5
		const forward = db.exec("SELECT label, weight FROM connections WHERE label = 'links_to'");
		expect(forward[0]!.values).toHaveLength(1);
		expect(forward[0]!.values[0]![1]).toBe(0.5);

		// Backward connection: target note -> source note, label='linked_from', weight=0.3
		const backward = db.exec("SELECT label, weight FROM connections WHERE label = 'linked_from'");
		expect(backward[0]!.values).toHaveLength(1);
		expect(backward[0]!.values[0]![1]).toBe(0.3);
	});

	it('NATV-05b: forward connection source is the source note, target is the target note', async () => {
		const sourceNote = makeCard({
			card_type: 'note',
			name: 'Note A',
			source: 'native_notes',
			source_id: 'A-001',
			content: 'A links to B',
		});
		const targetNote = makeCard({
			card_type: 'note',
			name: 'Note B',
			source: 'native_notes',
			source_id: 'B-001',
			content: 'B is linked from A',
		});
		const linkCard = makeCard({
			card_type: 'note',
			name: 'Note A',
			source: 'native_notes',
			source_id: 'notelink:A-001:B-001',
			source_url: 'note-link:B-001',
			content: null,
		});

		await handleETLImportNative(db, {
			sourceType: 'native_notes',
			cards: [sourceNote, targetNote, linkCard],
		});

		// Get actual card UUIDs
		const noteA = db.exec("SELECT id FROM cards WHERE source_id = 'A-001'");
		const noteB = db.exec("SELECT id FROM cards WHERE source_id = 'B-001'");
		const aId = noteA[0]!.values[0]![0];
		const bId = noteB[0]!.values[0]![0];

		// Forward: A -> B
		const fwd = db.exec("SELECT source_id, target_id FROM connections WHERE label = 'links_to'");
		expect(fwd[0]!.values[0]![0]).toBe(aId);
		expect(fwd[0]!.values[0]![1]).toBe(bId);

		// Backward: B -> A
		const bwd = db.exec("SELECT source_id, target_id FROM connections WHERE label = 'linked_from'");
		expect(bwd[0]!.values[0]![0]).toBe(bId);
		expect(bwd[0]!.values[0]![1]).toBe(aId);
	});

	it('NATV-05c: note-link with unresolved target creates no connections', async () => {
		const sourceNote = makeCard({
			card_type: 'note',
			name: 'Lonely Note',
			source: 'native_notes',
			source_id: 'LONELY-001',
		});
		const linkCard = makeCard({
			card_type: 'note',
			name: 'Lonely Note',
			source: 'native_notes',
			source_id: 'notelink:LONELY-001:MISSING-TARGET',
			source_url: 'note-link:MISSING-TARGET',
			content: null,
		});

		await handleETLImportNative(db, {
			sourceType: 'native_notes',
			cards: [sourceNote, linkCard],
		});

		// No target note card -> sourceIdMap lookup fails -> no connections
		const links = db.exec("SELECT count(*) FROM connections WHERE label = 'links_to'");
		expect(links[0]!.values[0]![0]).toBe(0);
	});
});
