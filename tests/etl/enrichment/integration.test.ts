// Isometry v5 — Enrichment Integration Test
// End-to-end: parse Apple Notes → enrich → dedup → write → verify DB columns.
//
// Tests real multi-level folder hierarchies including the user's actual
// Work/BairesDev/MSFT structure and edge cases.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Database } from '../../../src/database/Database';
import { ImportOrchestrator } from '../../../src/etl/ImportOrchestrator';
import type { ParsedFile } from '../../../src/etl/parsers/AppleNotesParser';

function makeNote(id: number, folder: string, title?: string): ParsedFile {
	const t = title ?? `Note ${id}`;
	return {
		path: `${folder}/${t.replace(/\s+/g, '-')}.md`,
		content: `---
title: "${t}"
id: ${id}
created: "2026-01-15T10:00:00Z"
modified: "2026-01-15T10:00:00Z"
folder: ${folder}
source: "notes://showNote?identifier=${id}"
---

# ${t}

Content for ${t}.
`,
	};
}

describe('Enrichment Integration — Apple Notes with folder hierarchy', () => {
	let db: Database;
	let orchestrator: ImportOrchestrator;

	beforeEach(async () => {
		db = new Database();
		await db.initialize();
		orchestrator = new ImportOrchestrator(db);
	});

	afterEach(() => {
		db.close();
	});

	it('splits Work/BairesDev/MSFT into 3 hierarchy levels', async () => {
		const notes = [makeNote(1, 'Work/BairesDev/MSFT', 'Sprint Planning')];
		const result = await orchestrator.import('apple_notes', JSON.stringify(notes));

		expect(result.inserted).toBe(1);

		const rows = db
			.prepare<{ folder: string; folder_l1: string; folder_l2: string; folder_l3: string; folder_l4: string | null }>(
				`SELECT folder, folder_l1, folder_l2, folder_l3, folder_l4
				 FROM cards WHERE source_id = '1' AND card_type = 'note'`,
			)
			.all();

		expect(rows).toHaveLength(1);
		expect(rows[0]!.folder).toBe('Work/BairesDev/MSFT');
		expect(rows[0]!.folder_l1).toBe('Work');
		expect(rows[0]!.folder_l2).toBe('BairesDev');
		expect(rows[0]!.folder_l3).toBe('MSFT');
		expect(rows[0]!.folder_l4).toBeNull();
	});

	it('handles 4-level deep hierarchy', async () => {
		const notes = [makeNote(2, 'Work/BairesDev/MSFT/Teams', 'Channel Setup')];
		await orchestrator.import('apple_notes', JSON.stringify(notes));

		const rows = db
			.prepare<{ folder_l1: string; folder_l2: string; folder_l3: string; folder_l4: string }>(
				`SELECT folder_l1, folder_l2, folder_l3, folder_l4
				 FROM cards WHERE source_id = '2' AND card_type = 'note'`,
			)
			.all();

		expect(rows[0]!.folder_l1).toBe('Work');
		expect(rows[0]!.folder_l2).toBe('BairesDev');
		expect(rows[0]!.folder_l3).toBe('MSFT');
		expect(rows[0]!.folder_l4).toBe('Teams');
	});

	it('joins depth > 4 into folder_l4', async () => {
		const notes = [makeNote(3, 'A/B/C/D/E/F', 'Deep Note')];
		await orchestrator.import('apple_notes', JSON.stringify(notes));

		const rows = db
			.prepare<{ folder_l3: string; folder_l4: string }>(
				`SELECT folder_l3, folder_l4
				 FROM cards WHERE source_id = '3' AND card_type = 'note'`,
			)
			.all();

		expect(rows[0]!.folder_l3).toBe('C');
		expect(rows[0]!.folder_l4).toBe('D/E/F');
	});

	it('handles single-level folder (legacy pattern)', async () => {
		const notes = [makeNote(4, 'Personal', 'Journal')];
		await orchestrator.import('apple_notes', JSON.stringify(notes));

		const rows = db
			.prepare<{ folder_l1: string; folder_l2: string | null }>(
				`SELECT folder_l1, folder_l2
				 FROM cards WHERE source_id = '4' AND card_type = 'note'`,
			)
			.all();

		expect(rows[0]!.folder_l1).toBe('Personal');
		expect(rows[0]!.folder_l2).toBeNull();
	});

	it('multiple cards across different hierarchy depths', async () => {
		const notes = [
			makeNote(10, 'Work/BairesDev/MSFT', 'Sprint 1'),
			makeNote(11, 'Work/BairesDev/Google', 'Sprint 2'),
			makeNote(12, 'Personal', 'Journal'),
			makeNote(13, 'Work/BairesDev/MSFT/Teams/General', 'Deep thread'),
		];
		const result = await orchestrator.import('apple_notes', JSON.stringify(notes));

		expect(result.inserted).toBe(4);

		// Verify we can GROUP BY folder_l1 — the whole point of the feature
		const grouped = db
			.prepare<{ folder_l1: string; cnt: number }>(
				`SELECT folder_l1, COUNT(*) as cnt
				 FROM cards
				 WHERE card_type = 'note' AND deleted_at IS NULL
				 GROUP BY folder_l1
				 ORDER BY folder_l1`,
			)
			.all();

		expect(grouped).toEqual([
			{ folder_l1: 'Personal', cnt: 1 },
			{ folder_l1: 'Work', cnt: 3 },
		]);

		// Verify folder_l2 grouping within Work
		const l2 = db
			.prepare<{ folder_l2: string; cnt: number }>(
				`SELECT folder_l2, COUNT(*) as cnt
				 FROM cards
				 WHERE folder_l1 = 'Work' AND card_type = 'note' AND deleted_at IS NULL
				 GROUP BY folder_l2`,
			)
			.all();

		expect(l2).toEqual([{ folder_l2: 'BairesDev', cnt: 3 }]);

		// Verify folder_l3 breakdown
		const l3 = db
			.prepare<{ folder_l3: string; cnt: number }>(
				`SELECT folder_l3, COUNT(*) as cnt
				 FROM cards
				 WHERE folder_l2 = 'BairesDev' AND card_type = 'note' AND deleted_at IS NULL
				 GROUP BY folder_l3
				 ORDER BY folder_l3`,
			)
			.all();

		expect(l3).toEqual([
			{ folder_l3: 'Google', cnt: 1 },
			{ folder_l3: 'MSFT', cnt: 2 },
		]);
	});

	it('retroactive backfill updates cards imported without enrichment', async () => {
		// Simulate pre-enrichment data: insert directly via SQL (bypassing enrichment)
		db.run(
			`INSERT INTO cards (id, card_type, name, folder, source, source_id, created_at, modified_at, priority, sort_order, is_collective)
			 VALUES ('legacy-1', 'note', 'Old Note', 'Archive/2024/Q1', 'test', 'legacy-1',
			         '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z', 0, 0, 0)`,
		);

		// Verify folder_l1 is null (no enrichment ran)
		const before = db
			.prepare<{ folder_l1: string | null }>(`SELECT folder_l1 FROM cards WHERE id = 'legacy-1'`)
			.all();
		expect(before[0]!.folder_l1).toBeNull();

		// Run backfill
		const { handleEnrichBackfill } = await import('../../../src/worker/handlers/enrich-backfill.handler');
		const result = await handleEnrichBackfill(db);

		expect(result.updated).toBe(1);

		// Verify enriched
		const after = db
			.prepare<{ folder_l1: string; folder_l2: string; folder_l3: string; folder_l4: string | null }>(
				`SELECT folder_l1, folder_l2, folder_l3, folder_l4 FROM cards WHERE id = 'legacy-1'`,
			)
			.all();

		expect(after[0]!.folder_l1).toBe('Archive');
		expect(after[0]!.folder_l2).toBe('2024');
		expect(after[0]!.folder_l3).toBe('Q1');
		expect(after[0]!.folder_l4).toBeNull();
	});

	it('re-import updates enriched columns when folder changes', async () => {
		// First import
		const notes1 = [makeNote(20, 'Work/BairesDev', 'Moving Note')];
		await orchestrator.import('apple_notes', JSON.stringify(notes1));

		const before = db
			.prepare<{ folder_l2: string }>(`SELECT folder_l2 FROM cards WHERE source_id = '20' AND card_type = 'note'`)
			.all();
		expect(before[0]!.folder_l2).toBe('BairesDev');

		// Re-import with changed folder (simulates user moved note in Apple Notes)
		const notes2 = [
			{
				path: 'Work/Google/Moving-Note.md',
				content: `---
title: "Moving Note"
id: 20
created: "2026-01-15T10:00:00Z"
modified: "2026-01-16T10:00:00Z"
folder: Work/Google
source: "notes://showNote?identifier=20"
---

# Moving Note

Content moved.
`,
			},
		];
		const result2 = await orchestrator.import('apple_notes', JSON.stringify(notes2));
		expect(result2.updated).toBe(1);

		const after = db
			.prepare<{ folder: string; folder_l2: string }>(`SELECT folder, folder_l2 FROM cards WHERE source_id = '20' AND card_type = 'note'`)
			.all();
		expect(after[0]!.folder).toBe('Work/Google');
		expect(after[0]!.folder_l2).toBe('Google');
	});
});
