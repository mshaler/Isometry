// tests/profiling/etl-import.bench.ts
// PROF-06: ETL import throughput benchmarks per source type at 1K/5K/20K scale.
//
// Measures ImportOrchestrator.import() end-to-end pipeline (parse -> dedup -> write -> FTS)
// for four source types: apple_notes, csv, json, markdown.
//
// Design: single Database instance shared across all benches (one describe block).
// This avoids loading 4 WASM runtimes simultaneously in a single Node worker process,
// which causes OOM crashes. Benches run sequentially; cumulative inserts into the same
// DB are acceptable for throughput measurement (dedup engine handles duplicates).
//
// Synthetic data is generated in beforeAll to avoid contaminating timing with
// data generation overhead.
//
// p99 values and cards/second throughput from these runs populate BOTTLENECKS.md.
//
// Run with: npx vitest bench tests/profiling/etl-import.bench.ts --run

import { afterAll, beforeAll, bench, describe } from 'vitest';
import { Database } from '../../src/database/Database';
import { ImportOrchestrator } from '../../src/etl/ImportOrchestrator';
import type { ParsedFile } from '../../src/etl/parsers/AppleNotesParser';
import { clearTraces } from '../../src/profiling/PerfTrace';

// ---------------------------------------------------------------------------
// Synthetic data generators
// ---------------------------------------------------------------------------

const WORDS = [
	'knowledge', 'management', 'system', 'project', 'planning', 'data', 'analysis',
	'design', 'implementation', 'testing', 'deployment', 'architecture', 'interface',
	'database', 'query', 'performance', 'optimization', 'workflow', 'research', 'review',
];

const CARD_TYPES = ['note', 'task', 'event', 'resource'];
const FOLDERS = ['work', 'personal', 'research', 'archive'];

function randomWord(): string {
	return WORDS[Math.floor(Math.random() * WORDS.length)]!;
}

function randomSentence(wordCount: number): string {
	return Array.from({ length: wordCount }, () => randomWord()).join(' ');
}

/**
 * Generate synthetic apple_notes ParsedFile array.
 * Each file is a Markdown note with minimal YAML frontmatter.
 */
function generateAppleNotesData(count: number): ParsedFile[] {
	return Array.from({ length: count }, (_, i) => ({
		path: `note-${i}-${Math.random().toString(36).slice(2)}.md`,
		content: `---\ntitle: Note ${i}\ncreated: 2026-01-01T00:00:00Z\n---\n\n${randomSentence(20)}`,
	}));
}

/**
 * Generate synthetic CSV data as a ParsedFile array.
 * Single file with headers + N rows.
 */
function generateCSVData(count: number): ParsedFile[] {
	const rows = ['name,content,card_type,folder'];
	for (let i = 0; i < count; i++) {
		const name = `${randomWord()} ${randomWord()} ${i}`;
		const content = randomSentence(15);
		const cardType = CARD_TYPES[i % CARD_TYPES.length]!;
		const folder = FOLDERS[i % FOLDERS.length]!;
		rows.push(`"${name}","${content}","${cardType}","${folder}"`);
	}
	return [{ path: `import-${Math.random().toString(36).slice(2)}.csv`, content: rows.join('\n') }];
}

/**
 * Generate synthetic JSON card array as a string.
 */
function generateJSONData(count: number): string {
	const cards = Array.from({ length: count }, (_, i) => ({
		name: `${randomWord()} ${randomWord()} ${i}`,
		content: randomSentence(15),
		card_type: CARD_TYPES[i % CARD_TYPES.length],
		folder: FOLDERS[i % FOLDERS.length],
	}));
	return JSON.stringify(cards);
}

/**
 * Generate synthetic markdown ParsedFile array.
 * Each file is a Markdown document without YAML frontmatter.
 */
function generateMarkdownData(count: number): ParsedFile[] {
	return Array.from({ length: count }, (_, i) => ({
		path: `doc-${i}-${Math.random().toString(36).slice(2)}.md`,
		content: `# ${randomWord()} ${randomWord()} ${i}\n\n${randomSentence(20)}\n`,
	}));
}

// ---------------------------------------------------------------------------
// ETL Import Throughput Benchmarks
// Single shared Database instance across all benches to avoid WASM OOM in
// the Node worker process (forks pool mode, one process per file).
// ---------------------------------------------------------------------------

describe('ETL Import Throughput', () => {
	let db: Database;

	// Pre-generated data sets for each source type + scale tier
	let appleNotes1K: ParsedFile[];
	let appleNotes5K: ParsedFile[];
	let appleNotes20K: ParsedFile[];
	let csv1K: ParsedFile[];
	let csv5K: ParsedFile[];
	let csv20K: ParsedFile[];
	let json1K: string;
	let json5K: string;
	let json20K: string;
	let markdown1K: ParsedFile[];
	let markdown5K: ParsedFile[];
	let markdown20K: ParsedFile[];

	beforeAll(async () => {
		db = new Database();
		await db.initialize();

		// Generate all data sets before any bench runs
		appleNotes1K = generateAppleNotesData(1_000);
		appleNotes5K = generateAppleNotesData(5_000);
		appleNotes20K = generateAppleNotesData(20_000);

		csv1K = generateCSVData(1_000);
		csv5K = generateCSVData(5_000);
		csv20K = generateCSVData(20_000);

		json1K = generateJSONData(1_000);
		json5K = generateJSONData(5_000);
		json20K = generateJSONData(20_000);

		markdown1K = generateMarkdownData(1_000);
		markdown5K = generateMarkdownData(5_000);
		markdown20K = generateMarkdownData(20_000);
	}, 120_000);

	afterAll(() => {
		db.close();
	});

	// -------------------------------------------------------------------------
	// apple_notes
	// -------------------------------------------------------------------------

	bench(
		'apple_notes — 1K cards',
		async () => {
			const orch = new ImportOrchestrator(db);
			await orch.import('apple_notes', appleNotes1K);
			clearTraces();
		},
		{ iterations: 5, time: 120_000 },
	);

	bench(
		'apple_notes — 5K cards',
		async () => {
			const orch = new ImportOrchestrator(db);
			await orch.import('apple_notes', appleNotes5K);
			clearTraces();
		},
		{ iterations: 3, time: 120_000 },
	);

	bench(
		'apple_notes — 20K cards',
		async () => {
			const orch = new ImportOrchestrator(db);
			await orch.import('apple_notes', appleNotes20K);
			clearTraces();
		},
		{ iterations: 1, time: 120_000 },
	);

	// -------------------------------------------------------------------------
	// csv
	// -------------------------------------------------------------------------

	bench(
		'csv — 1K cards',
		async () => {
			const orch = new ImportOrchestrator(db);
			await orch.import('csv', csv1K);
			clearTraces();
		},
		{ iterations: 5, time: 120_000 },
	);

	bench(
		'csv — 5K cards',
		async () => {
			const orch = new ImportOrchestrator(db);
			await orch.import('csv', csv5K);
			clearTraces();
		},
		{ iterations: 3, time: 120_000 },
	);

	bench(
		'csv — 20K cards',
		async () => {
			const orch = new ImportOrchestrator(db);
			await orch.import('csv', csv20K);
			clearTraces();
		},
		{ iterations: 1, time: 120_000 },
	);

	// -------------------------------------------------------------------------
	// json
	// -------------------------------------------------------------------------

	bench(
		'json — 1K cards',
		async () => {
			const orch = new ImportOrchestrator(db);
			await orch.import('json', json1K);
			clearTraces();
		},
		{ iterations: 5, time: 120_000 },
	);

	bench(
		'json — 5K cards',
		async () => {
			const orch = new ImportOrchestrator(db);
			await orch.import('json', json5K);
			clearTraces();
		},
		{ iterations: 3, time: 120_000 },
	);

	bench(
		'json — 20K cards',
		async () => {
			const orch = new ImportOrchestrator(db);
			await orch.import('json', json20K);
			clearTraces();
		},
		{ iterations: 1, time: 120_000 },
	);

	// -------------------------------------------------------------------------
	// markdown
	// -------------------------------------------------------------------------

	bench(
		'markdown — 1K cards',
		async () => {
			const orch = new ImportOrchestrator(db);
			await orch.import('markdown', markdown1K);
			clearTraces();
		},
		{ iterations: 5, time: 120_000 },
	);

	bench(
		'markdown — 5K cards',
		async () => {
			const orch = new ImportOrchestrator(db);
			await orch.import('markdown', markdown5K);
			clearTraces();
		},
		{ iterations: 3, time: 120_000 },
	);

	bench(
		'markdown — 20K cards',
		async () => {
			const orch = new ImportOrchestrator(db);
			await orch.import('markdown', markdown20K);
			clearTraces();
		},
		{ iterations: 1, time: 120_000 },
	);
});
