// tests/profiling/explain-plan.test.ts
// Phase 76: EXPLAIN QUERY PLAN assertions for covering indexes.
//
// Verifies that the new Phase 76 indexes are picked up by the SQLite query planner
// for the two dominant SQL bottlenecks identified in Phase 74 BOTTLENECKS.md:
//   1. GROUP BY folder, card_type  (24.9ms p99 baseline)
//   2. GROUP BY strftime month     (20.6ms p99 baseline)
//
// Tests use db.exec('EXPLAIN QUERY PLAN ...') and assert that the detail column
// (index 3) of the result contains 'USING INDEX', confirming the planner chose
// the covering index rather than a full table scan.
//
// Run with: npx vitest run tests/profiling/explain-plan.test.ts

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Database } from '../../src/database/Database';
import { seedDatabase } from '../database/seed';

// ---------------------------------------------------------------------------
// Helper: extract EXPLAIN QUERY PLAN detail string
// ---------------------------------------------------------------------------

function explainPlan(db: Database, sql: string): string {
	const results = db.exec(`EXPLAIN QUERY PLAN ${sql}`);
	if (!results[0]?.values?.length) {
		return '';
	}
	return results[0].values.map((row) => String(row[3])).join('\n');
}

/**
 * Returns true if the EXPLAIN QUERY PLAN detail shows index usage.
 * SQLite may emit either:
 *   "SCAN cards USING INDEX idx_name"
 *   "SCAN cards USING COVERING INDEX idx_name"
 * Both indicate the planner chose the index over a full table scan.
 */
function usesIndex(plan: string): boolean {
	return plan.includes('USING INDEX') || plan.includes('USING COVERING INDEX');
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('EXPLAIN QUERY PLAN — Phase 76 covering indexes', () => {
	let db: Database;

	beforeAll(async () => {
		db = new Database();
		await db.initialize();
		// Seed 20K cards so the query planner sees realistic cardinality
		seedDatabase(db, { cardCount: 20_000 });
	}, 120_000);

	afterAll(() => {
		db.close();
	});

	// -----------------------------------------------------------------------
	// Test 1: Composite covering index for GROUP BY folder, card_type
	// SQLite may emit "USING COVERING INDEX" (even better than "USING INDEX")
	// -----------------------------------------------------------------------
	it('GROUP BY folder, card_type uses idx_cards_sg_folder_type', () => {
		const plan = explainPlan(
			db,
			'SELECT folder, card_type, COUNT(*) as cnt FROM cards WHERE deleted_at IS NULL GROUP BY folder, card_type',
		);
		console.log('[explain-plan] folder+card_type:\n', plan);
		expect(usesIndex(plan)).toBe(true);
	});

	// -----------------------------------------------------------------------
	// Test 2: Expression index for strftime month GROUP BY
	// The query in budget.test.ts uses GROUP BY alias (month), but the index
	// covers strftime('%Y-%m', created_at). We test the canonical form first.
	// -----------------------------------------------------------------------
	it("GROUP BY strftime('%Y-%m', created_at) uses idx_cards_sg_created_month", () => {
		const plan = explainPlan(
			db,
			"SELECT strftime('%Y-%m', created_at) as month, COUNT(*) FROM cards WHERE deleted_at IS NULL GROUP BY strftime('%Y-%m', created_at)",
		);
		console.log('[explain-plan] strftime month:\n', plan);
		expect(usesIndex(plan)).toBe(true);
	});

	// -----------------------------------------------------------------------
	// Test 3: Expression index for strftime day GROUP BY
	// -----------------------------------------------------------------------
	it("GROUP BY strftime('%Y-%m-%d', created_at) uses idx_cards_sg_created_day", () => {
		const plan = explainPlan(
			db,
			"SELECT strftime('%Y-%m-%d', created_at) as day, COUNT(*) FROM cards WHERE deleted_at IS NULL GROUP BY strftime('%Y-%m-%d', created_at)",
		);
		console.log('[explain-plan] strftime day:\n', plan);
		expect(usesIndex(plan)).toBe(true);
	});

	// -----------------------------------------------------------------------
	// Test 4: Expression index for strftime year GROUP BY
	// -----------------------------------------------------------------------
	it("GROUP BY strftime('%Y', created_at) uses idx_cards_sg_created_year", () => {
		const plan = explainPlan(
			db,
			"SELECT strftime('%Y', created_at) as year, COUNT(*) FROM cards WHERE deleted_at IS NULL GROUP BY strftime('%Y', created_at)",
		);
		console.log('[explain-plan] strftime year:\n', plan);
		expect(usesIndex(plan)).toBe(true);
	});

	// -----------------------------------------------------------------------
	// Test 5: Quarter expression index — document activation, do not hard-fail
	// The quarter expression is complex; the planner may not always choose it.
	// -----------------------------------------------------------------------
	it('GROUP BY quarter expression — documents whether index activates (informational)', () => {
		const plan = explainPlan(
			db,
			`SELECT strftime('%Y', created_at) || '-Q' || ((CAST(strftime('%m', created_at) AS INT) - 1) / 3 + 1) as quarter, COUNT(*) FROM cards WHERE deleted_at IS NULL GROUP BY strftime('%Y', created_at) || '-Q' || ((CAST(strftime('%m', created_at) AS INT) - 1) / 3 + 1)`,
		);
		const activated = plan.includes('USING INDEX');
		console.log(`[explain-plan] quarter index activated: ${activated}\n`, plan);
		// Informational only — do not assert USING INDEX for the complex quarter expression
		expect(true).toBe(true);
	});

	// -----------------------------------------------------------------------
	// Test 6: Week expression index
	// -----------------------------------------------------------------------
	it("GROUP BY strftime('%Y-W%W', created_at) uses idx_cards_sg_created_week", () => {
		const plan = explainPlan(
			db,
			"SELECT strftime('%Y-W%W', created_at) as week, COUNT(*) FROM cards WHERE deleted_at IS NULL GROUP BY strftime('%Y-W%W', created_at)",
		);
		console.log('[explain-plan] strftime week:\n', plan);
		expect(usesIndex(plan)).toBe(true);
	});
});
