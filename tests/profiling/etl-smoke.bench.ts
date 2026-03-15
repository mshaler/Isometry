// tests/profiling/etl-smoke.bench.ts
// ETL import timing measurement via vitest test (uses it, not bench, for console output).
// Outputs timing to console for BOTTLENECKS.md population.
//
// Run with: npx vitest run tests/profiling/etl-smoke.bench.ts

import { afterAll, beforeAll, describe, it } from 'vitest';
import { Database } from '../../src/database/Database';
import { ImportOrchestrator } from '../../src/etl/ImportOrchestrator';
import type { ParsedFile } from '../../src/etl/parsers/AppleNotesParser';
import type { SourceType } from '../../src/etl/types';
import { clearTraces } from '../../src/profiling/PerfTrace';

const CARD_TYPES = ['note', 'task', 'event', 'resource'];
const FOLDERS = ['work', 'personal', 'research', 'archive'];
const WORDS = ['knowledge', 'management', 'system', 'project', 'planning', 'data', 'analysis', 'design'];

function rw(): string {
	return WORDS[Math.floor(Math.random() * WORDS.length)]!;
}
function rs(n: number): string {
	return Array.from({ length: n }, () => rw()).join(' ');
}

function genAN(count: number): ParsedFile[] {
	return Array.from({ length: count }, (_, i) => ({
		path: `note-${i}-${Math.random().toString(36).slice(2)}.md`,
		content: `---\ntitle: Note ${i}\ncreated: 2026-01-01T00:00:00Z\n---\n\n${rs(20)}`,
	}));
}
function genCSV(count: number): ParsedFile[] {
	const rows = ['name,content,card_type,folder'];
	for (let i = 0; i < count; i++) {
		rows.push(`"${rw()} ${rw()} ${i} ${Date.now()}","${rs(10)}","${CARD_TYPES[i % 4]!}","${FOLDERS[i % 4]!}"`);
	}
	return [{ path: `import-${Date.now()}.csv`, content: rows.join('\n') }];
}
function genJSON(count: number): string {
	return JSON.stringify(
		Array.from({ length: count }, (_, i) => ({
			name: `${rw()} ${rw()} ${i} ${Date.now()}`,
			content: rs(15),
			card_type: CARD_TYPES[i % 4],
			folder: FOLDERS[i % 4],
		})),
	);
}
function genMD(count: number): ParsedFile[] {
	return Array.from({ length: count }, (_, i) => ({
		path: `doc-${i}-${Math.random().toString(36).slice(2)}.md`,
		content: `# ${rw()} ${rw()} ${i}\n\n${rs(20)}\n`,
	}));
}

async function timeImport(db: Database, type: SourceType, data: unknown): Promise<number> {
	const orch = new ImportOrchestrator(db);
	const t0 = performance.now();
	await orch.import(type, data as ParsedFile[]);
	const elapsed = performance.now() - t0;
	clearTraces();
	return elapsed;
}

describe('ETL Import Timing (for BOTTLENECKS.md)', () => {
	let db: Database;

	beforeAll(async () => {
		db = new Database();
		await db.initialize();
	}, 120_000);

	afterAll(() => {
		db.close();
	});

	it('apple_notes timing at 1K/5K/20K', async () => {
		const t1k = await timeImport(db, 'apple_notes', genAN(1_000));
		const t5k = await timeImport(db, 'apple_notes', genAN(5_000));
		const t20k = await timeImport(db, 'apple_notes', genAN(20_000));
		console.log(
			`apple_notes: 1K=${t1k.toFixed(0)}ms (${((1_000 / t1k) * 1000).toFixed(0)}/s), 5K=${t5k.toFixed(0)}ms (${((5_000 / t5k) * 1000).toFixed(0)}/s), 20K=${t20k.toFixed(0)}ms (${((20_000 / t20k) * 1000).toFixed(0)}/s)`,
		);
	}, 300_000);

	it('csv timing at 1K/5K/20K', async () => {
		const t1k = await timeImport(db, 'csv', genCSV(1_000));
		const t5k = await timeImport(db, 'csv', genCSV(5_000));
		const t20k = await timeImport(db, 'csv', genCSV(20_000));
		console.log(
			`csv: 1K=${t1k.toFixed(0)}ms (${((1_000 / t1k) * 1000).toFixed(0)}/s), 5K=${t5k.toFixed(0)}ms (${((5_000 / t5k) * 1000).toFixed(0)}/s), 20K=${t20k.toFixed(0)}ms (${((20_000 / t20k) * 1000).toFixed(0)}/s)`,
		);
	}, 300_000);

	it('json timing at 1K/5K/20K', async () => {
		const t1k = await timeImport(db, 'json', genJSON(1_000));
		const t5k = await timeImport(db, 'json', genJSON(5_000));
		const t20k = await timeImport(db, 'json', genJSON(20_000));
		console.log(
			`json: 1K=${t1k.toFixed(0)}ms (${((1_000 / t1k) * 1000).toFixed(0)}/s), 5K=${t5k.toFixed(0)}ms (${((5_000 / t5k) * 1000).toFixed(0)}/s), 20K=${t20k.toFixed(0)}ms (${((20_000 / t20k) * 1000).toFixed(0)}/s)`,
		);
	}, 300_000);

	it('markdown timing at 1K/5K/20K', async () => {
		const t1k = await timeImport(db, 'markdown', genMD(1_000));
		const t5k = await timeImport(db, 'markdown', genMD(5_000));
		const t20k = await timeImport(db, 'markdown', genMD(20_000));
		console.log(
			`markdown: 1K=${t1k.toFixed(0)}ms (${((1_000 / t1k) * 1000).toFixed(0)}/s), 5K=${t5k.toFixed(0)}ms (${((5_000 / t5k) * 1000).toFixed(0)}/s), 20K=${t20k.toFixed(0)}ms (${((20_000 / t20k) * 1000).toFixed(0)}/s)`,
		);
	}, 300_000);
});
