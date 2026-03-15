// tests/profiling/heap-cycle.test.ts
// Phase 77 Plan 02 — MMRY-01, MMRY-02: Heap measurement and import-delete-reimport cycle test.
//
// MMRY-01: Measure RSS at baseline, peak (20K import), and steady-state (after delete).
//          NO assertion — this is baseline documentation.
// MMRY-02: Run 3 import-delete-reimport cycles. Assert < 20% RSS growth across cycles.
//
// Key constraints:
//   - Single shared DB instance (never close + new SQL.Database() within Worker lifetime — D-011)
//   - RSS is the primary metric (captures WASM heap; V8 heapUsed misses WASM memory)
//   - DELETE FROM cards (not DB recreation) to respect WASM heap constraint
//   - clearTraces() between cycles to prevent performance.mark accumulation (Research pitfall 3)
//
// Run with: npx vitest run tests/profiling/heap-cycle.test.ts

import { afterAll, beforeAll, expect, it } from 'vitest';
import { Database } from '../../src/database/Database';
import { ImportOrchestrator } from '../../src/etl/ImportOrchestrator';
import { clearTraces } from '../../src/profiling/PerfTrace';

// ---------------------------------------------------------------------------
// Card generator (mirrors budget.test.ts genJSON pattern)
// ---------------------------------------------------------------------------

const CARD_TYPES = ['note', 'task', 'event', 'resource'];
const FOLDERS = ['work', 'personal', 'research', 'archive'];
const WORDS = ['knowledge', 'management', 'system', 'project', 'planning', 'data', 'analysis', 'design'];

function rw(): string {
	return WORDS[Math.floor(Math.random() * WORDS.length)] ?? 'knowledge';
}
function rs(n: number): string {
	return Array.from({ length: n }, () => rw()).join(' ');
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

// ---------------------------------------------------------------------------
// Snapshot helper
// ---------------------------------------------------------------------------

function snapshot(label: string): number {
	const mem = process.memoryUsage();
	const rssMB = mem.rss / 1024 / 1024;
	const heapUsedMB = mem.heapUsed / 1024 / 1024;
	const heapTotalMB = mem.heapTotal / 1024 / 1024;
	console.log(
		`[${label}] rss=${rssMB.toFixed(1)}MB heapUsed=${heapUsedMB.toFixed(1)}MB heapTotal=${heapTotalMB.toFixed(1)}MB`,
	);
	return rssMB;
}

// ---------------------------------------------------------------------------
// Shared DB instance (never recreate within test suite — D-011 WASM heap fragmentation)
// ---------------------------------------------------------------------------

let db: Database;

beforeAll(async () => {
	db = new Database();
	await db.initialize();
	clearTraces();
}, 30_000);

afterAll(() => {
	db.close();
});

// ---------------------------------------------------------------------------
// MMRY-01: 20K import peak + steady-state
// ---------------------------------------------------------------------------

it('MMRY-01: measures RSS at baseline, peak (20K import), and steady-state (after delete)', async () => {
	const baseline = snapshot('baseline');
	console.log(`RSS baseline: ${baseline.toFixed(1)}MB`);

	// Import 20K cards
	const orch = new ImportOrchestrator(db);
	await orch.import('json', genJSON(20_000));
	clearTraces();

	const peak = snapshot('peak-after-20K-import');

	// Delete all cards (steady-state recovery)
	db.run('DELETE FROM cards WHERE 1=1');

	// Wait for GC settle
	await new Promise((r) => setTimeout(r, 200));
	const steady = snapshot('steady-state-after-delete');

	console.log(
		`MMRY-01 summary: baseline=${baseline.toFixed(1)}MB peak=${peak.toFixed(1)}MB steady=${steady.toFixed(1)}MB growth-over-baseline=${(((peak - baseline) / baseline) * 100).toFixed(1)}%`,
	);
	// No assertion — documentation only
}, 120_000);

// ---------------------------------------------------------------------------
// MMRY-02: 3 import-delete-reimport cycles — RSS growth must be < 20%
// ---------------------------------------------------------------------------

it('MMRY-02: 3 import-delete-reimport cycles show < 20% RSS growth', async () => {
	const cycleRssAtImport: number[] = [];

	for (let cycle = 1; cycle <= 3; cycle++) {
		// Import 20K cards
		const orch = new ImportOrchestrator(db);
		await orch.import('json', genJSON(20_000));
		clearTraces(); // Prevent performance.mark accumulation (Research pitfall 3)

		await new Promise((r) => setTimeout(r, 200));
		const rssAtImport = snapshot(`cycle${cycle}-import`);
		cycleRssAtImport.push(rssAtImport);

		// Delete all cards (reuse same DB instance — no close/new SQL.Database())
		db.run('DELETE FROM cards WHERE 1=1');
		await new Promise((r) => setTimeout(r, 200));
		snapshot(`cycle${cycle}-after-delete`);
	}

	const rss1 = cycleRssAtImport[0] ?? 0;
	const rss3 = cycleRssAtImport[2] ?? 0;

	if (rss1 > 0) {
		const growth = (rss3 - rss1) / rss1;
		console.log(
			`MMRY-02 cycle RSS: cycle1=${rss1.toFixed(1)}MB cycle2=${cycleRssAtImport[1]?.toFixed(1) ?? '?'}MB cycle3=${rss3.toFixed(1)}MB growth=${(growth * 100).toFixed(1)}%`,
		);

		// < 20% growth threshold (CONTEXT.md)
		expect(growth).toBeLessThan(0.2);
	}
}, 300_000);
