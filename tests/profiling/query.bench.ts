// tests/profiling/query.bench.ts
// PROF-04: SQL query throughput benchmarks at 1K/5K/20K card scale.
//
// Measures the GROUP BY queries and FTS searches that SuperGrid actually runs,
// across three dataset sizes to capture throughput at each scale tier.
//
// p99 values from these runs populate BOTTLENECKS.md.
//
// Run with: npx vitest bench tests/profiling/query.bench.ts --run

import { afterAll, beforeAll, bench, describe } from 'vitest';
import { Database } from '../../src/database/Database';
import { seedDatabase } from '../database/seed';

// ---------------------------------------------------------------------------
// 1K cards
// ---------------------------------------------------------------------------

describe('1K cards', () => {
	let db: Database;

	beforeAll(async () => {
		db = new Database();
		await db.initialize();
		seedDatabase(db, { cardCount: 1_000 });
	}, 120_000);

	afterAll(() => {
		db.close();
	});

	bench(
		'supergrid:query GROUP BY folder, card_type',
		() => {
			db.exec('SELECT folder, card_type, COUNT(*) as cnt FROM cards WHERE deleted_at IS NULL GROUP BY folder, card_type');
		},
		{ iterations: 200, time: 10_000 },
	);

	bench(
		'supergrid:query GROUP BY status',
		() => {
			db.exec('SELECT status, COUNT(*) as cnt FROM cards WHERE deleted_at IS NULL GROUP BY status');
		},
		{ iterations: 200, time: 10_000 },
	);

	bench(
		'supergrid:query GROUP BY created_at (month)',
		() => {
			db.exec("SELECT strftime('%Y-%m', created_at) as month, COUNT(*) FROM cards WHERE deleted_at IS NULL GROUP BY month");
		},
		{ iterations: 200, time: 10_000 },
	);

	bench(
		'FTS search 3-word query',
		() => {
			db.exec("SELECT rowid FROM cards_fts WHERE cards_fts MATCH 'knowledge management system'");
		},
		{ iterations: 200, time: 10_000 },
	);
});

// ---------------------------------------------------------------------------
// 5K cards
// ---------------------------------------------------------------------------

describe('5K cards', () => {
	let db: Database;

	beforeAll(async () => {
		db = new Database();
		await db.initialize();
		seedDatabase(db, { cardCount: 5_000 });
	}, 120_000);

	afterAll(() => {
		db.close();
	});

	bench(
		'supergrid:query GROUP BY folder, card_type',
		() => {
			db.exec('SELECT folder, card_type, COUNT(*) as cnt FROM cards WHERE deleted_at IS NULL GROUP BY folder, card_type');
		},
		{ iterations: 100, time: 10_000 },
	);

	bench(
		'supergrid:query GROUP BY status',
		() => {
			db.exec('SELECT status, COUNT(*) as cnt FROM cards WHERE deleted_at IS NULL GROUP BY status');
		},
		{ iterations: 100, time: 10_000 },
	);

	bench(
		'supergrid:query GROUP BY created_at (month)',
		() => {
			db.exec("SELECT strftime('%Y-%m', created_at) as month, COUNT(*) FROM cards WHERE deleted_at IS NULL GROUP BY month");
		},
		{ iterations: 100, time: 10_000 },
	);

	bench(
		'FTS search 3-word query',
		() => {
			db.exec("SELECT rowid FROM cards_fts WHERE cards_fts MATCH 'knowledge management system'");
		},
		{ iterations: 100, time: 10_000 },
	);
});

// ---------------------------------------------------------------------------
// 20K cards
// ---------------------------------------------------------------------------

describe('20K cards', () => {
	let db: Database;

	beforeAll(async () => {
		db = new Database();
		await db.initialize();
		seedDatabase(db, { cardCount: 20_000 });
	}, 120_000);

	afterAll(() => {
		db.close();
	});

	bench(
		'supergrid:query GROUP BY folder, card_type',
		() => {
			db.exec('SELECT folder, card_type, COUNT(*) as cnt FROM cards WHERE deleted_at IS NULL GROUP BY folder, card_type');
		},
		{ iterations: 50, time: 10_000 },
	);

	bench(
		'supergrid:query GROUP BY status',
		() => {
			db.exec('SELECT status, COUNT(*) as cnt FROM cards WHERE deleted_at IS NULL GROUP BY status');
		},
		{ iterations: 50, time: 10_000 },
	);

	bench(
		'supergrid:query GROUP BY created_at (month)',
		() => {
			db.exec("SELECT strftime('%Y-%m', created_at) as month, COUNT(*) FROM cards WHERE deleted_at IS NULL GROUP BY month");
		},
		{ iterations: 50, time: 10_000 },
	);

	bench(
		'FTS search 3-word query',
		() => {
			db.exec("SELECT rowid FROM cards_fts WHERE cards_fts MATCH 'knowledge management system'");
		},
		{ iterations: 50, time: 10_000 },
	);
});
