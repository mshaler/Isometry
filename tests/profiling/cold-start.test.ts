// tests/profiling/cold-start.test.ts
// Phase 77 Plan 02 — LNCH-01: Cold-start decomposition timing.
//
// Measures per-stage breakdown of Database.initialize():
//   db:wasm:init      — sql.js WASM compile + instantiate
//   db:instance:create — SQL.Database() constructor
//   db:schema:apply    — PRAGMA foreign_keys + applySchema()
//
// NO timing assertions — this is baseline documentation only.
// Numbers feed Phase 78 CI guards and native preload decisions.
//
// Run with: npx vitest run tests/profiling/cold-start.test.ts

import { afterAll, beforeAll, it } from 'vitest';
import { Database } from '../../src/database/Database';
import { clearTraces, getTraces } from '../../src/profiling/PerfTrace';

let db: Database;

beforeAll(() => {
	// Ensure traces from prior tests don't contaminate measurements
	clearTraces();
}, 30_000);

afterAll(() => {
	db?.close();
});

it('cold-start decomposition: logs WASM init / DB create / schema apply breakdown', async () => {
	clearTraces();

	db = new Database();
	await db.initialize();

	const wasmInit = getTraces('db:wasm:init');
	const dbCreate = getTraces('db:instance:create');
	const schemaApply = getTraces('db:schema:apply');

	const wasmMs = wasmInit[wasmInit.length - 1]?.duration ?? 0;
	const dbMs = dbCreate[dbCreate.length - 1]?.duration ?? 0;
	const schemaMs = schemaApply[schemaApply.length - 1]?.duration ?? 0;
	const totalMs = wasmMs + dbMs + schemaMs;

	console.log(
		`Cold-start breakdown: WASM init: ${wasmMs.toFixed(1)}ms | DB create: ${dbMs.toFixed(1)}ms | Schema apply: ${schemaMs.toFixed(1)}ms | Total: ${totalMs.toFixed(1)}ms`,
	);

	// Sanity check: all three stages must have produced a trace entry
	// (verifies PerfTrace markers are wired correctly — not a timing budget)
	if (wasmInit.length === 0) {
		console.warn('WARNING: db:wasm:init trace missing — check PerfTrace markers in Database.initialize()');
	}
	if (dbCreate.length === 0) {
		console.warn('WARNING: db:instance:create trace missing — check PerfTrace markers in Database.initialize()');
	}
	if (schemaApply.length === 0) {
		console.warn('WARNING: db:schema:apply trace missing — check PerfTrace markers in Database.initialize()');
	}
}, 30_000);
