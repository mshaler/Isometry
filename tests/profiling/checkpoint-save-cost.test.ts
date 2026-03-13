// tests/profiling/checkpoint-save-cost.test.ts
// Phase 77 Plan 02 — MMRY-03: Checkpoint save cost measurement at 20K cards.
//
// Measures the two expensive operations in the checkpoint save path:
//   1. db.export() — sql.js database serialization to Uint8Array
//   2. base64 encoding — Uint8Array to base64 string
//
// If total cost > 50ms, debouncing is recommended (per CONTEXT.md decision).
//
// Run with: npx vitest run tests/profiling/checkpoint-save-cost.test.ts

import { afterAll, beforeAll, it } from 'vitest';
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
// Base64 encoding helper (mirrors NativeBridge.ts uint8ArrayToBase64 path)
// ---------------------------------------------------------------------------

function uint8ArrayToBase64(bytes: Uint8Array): string {
	let binary = '';
	const len = bytes.byteLength;
	for (let i = 0; i < len; i++) {
		binary += String.fromCharCode(bytes[i] as number);
	}
	return btoa(binary);
}

// ---------------------------------------------------------------------------
// Shared DB instance (preloaded with 20K cards)
// ---------------------------------------------------------------------------

let db: Database;

beforeAll(async () => {
	db = new Database();
	await db.initialize();

	// Load 20K cards — this is the real-world checkpoint cost
	const orch = new ImportOrchestrator(db);
	await orch.import('json', genJSON(20_000));
	clearTraces();
}, 120_000);

afterAll(() => {
	db.close();
});

// ---------------------------------------------------------------------------
// MMRY-03: Checkpoint save cost measurement
// ---------------------------------------------------------------------------

const CHECKPOINT_BUDGET_MS = 50;

it(
	'MMRY-03: measures checkpoint save cost (export + base64) at 20K cards',
	() => {
		const runs = 3;
		const exportTimes: number[] = [];
		const base64Times: number[] = [];

		for (let run = 1; run <= runs; run++) {
			// Stage 1: sql.js db.export() — serialize entire database to Uint8Array
			const t0 = performance.now();
			const dbBytes = db.export();
			const exportMs = performance.now() - t0;
			exportTimes.push(exportMs);

			// Stage 2: base64 encode the Uint8Array
			const t1 = performance.now();
			const _base64 = uint8ArrayToBase64(dbBytes);
			const base64Ms = performance.now() - t1;
			base64Times.push(base64Ms);

			const totalMs = exportMs + base64Ms;
			console.log(
				`Checkpoint save run ${run}: export=${exportMs.toFixed(1)}ms base64=${base64Ms.toFixed(1)}ms total=${totalMs.toFixed(1)}ms (db size: ${(dbBytes.byteLength / 1024).toFixed(0)}KB)`,
			);
		}

		// Report mean across runs
		const meanExport = exportTimes.reduce((a, b) => a + b, 0) / runs;
		const meanBase64 = base64Times.reduce((a, b) => a + b, 0) / runs;
		const meanTotal = meanExport + meanBase64;

		const budgetStatus = meanTotal <= CHECKPOINT_BUDGET_MS ? `WITHIN ${CHECKPOINT_BUDGET_MS}ms budget` : `EXCEEDS ${CHECKPOINT_BUDGET_MS}ms budget — debouncing recommended`;
		console.log(
			`Checkpoint save at 20K cards: export=${meanExport.toFixed(1)}ms base64=${meanBase64.toFixed(1)}ms total=${meanTotal.toFixed(1)}ms (${budgetStatus})`,
		);

		// No pass/fail on timing — documentation only
		// The debouncing decision is made by the executor based on measured cost (see task 3 action)
	},
	120_000,
);
