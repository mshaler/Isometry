// tests/database/seed.ts
// Reusable database seeding utility for performance benchmarks.
// Seeds 10K cards + 50K connections for realistic benchmark datasets.
//
// Design decisions:
//   - BEGIN/COMMIT wraps each batch (cards, connections) for speed
//   - INSERT OR IGNORE handles UNIQUE constraint collisions on random pairs
//   - Hub card gets 200 direct connections, ensuring rich graph for PERF-04
//   - WORDS array provides FTS-searchable vocabulary for PERF-03

import type { Database } from '../../src/database/Database';

// ---------------------------------------------------------------------------
// Seed configuration
// ---------------------------------------------------------------------------

export const SEED_CONFIG = {
	cardCount: 10_000,
	connectionCount: 50_000,
	avgContentLength: 500,
} as const;

// ---------------------------------------------------------------------------
// Word lists for generating realistic content and names
// ---------------------------------------------------------------------------

const WORDS = [
	'knowledge',
	'management',
	'system',
	'project',
	'planning',
	'data',
	'analysis',
	'design',
	'implementation',
	'testing',
	'deployment',
	'architecture',
	'interface',
	'database',
	'query',
	'performance',
	'optimization',
	'algorithm',
	'structure',
	'pattern',
	'framework',
	'component',
	'module',
	'service',
	'layer',
	'abstraction',
	'protocol',
	'integration',
	'workflow',
	'pipeline',
	'transformation',
	'validation',
	'authentication',
	'authorization',
	'security',
	'network',
	'storage',
	'cache',
	'index',
	'schema',
	'migration',
	'transaction',
	'replication',
	'synchronization',
	'monitoring',
	'logging',
	'metrics',
	'dashboard',
	'visualization',
	'rendering',
	'layout',
	'navigation',
	'interaction',
	'collaboration',
	'document',
	'annotation',
	'reference',
	'citation',
	'research',
	'review',
	'report',
	'summary',
	'overview',
	'detail',
	'feature',
	'requirement',
	'specification',
	'constraint',
	'dependency',
	'version',
	'release',
	'deployment',
	'rollback',
	'migration',
	'upgrade',
	'configuration',
	'environment',
	'variable',
	'parameter',
	'argument',
	'function',
	'method',
	'class',
	'interface',
	'type',
	'generic',
	'async',
	'await',
	'promise',
	'callback',
	'event',
	'listener',
	'state',
	'mutation',
	'action',
	'reducer',
	'selector',
	'subscription',
	'provider',
	'consumer',
	'context',
	'hook',
	'effect',
	'memo',
	'filter',
	'sort',
	'group',
	'aggregate',
	'join',
	'union',
	'projection',
	'selection',
	'insertion',
	'deletion',
	'update',
] as const;

const CARD_TYPES = ['note', 'task', 'event', 'resource', 'person'] as const;
const FOLDERS = ['work', 'personal', 'research', 'archive', null] as const;
const STATUSES = ['active', 'pending', 'completed', 'archived', null] as const;
const LABELS = ['mentions', 'contains', 'references', 'depends_on', 'related_to'] as const;

// ---------------------------------------------------------------------------
// Random helpers
// ---------------------------------------------------------------------------

function randomElement<T>(arr: readonly T[]): T {
	return arr[Math.floor(Math.random() * arr.length)]!;
}

/**
 * Generate random text of approximately avgLength characters using WORDS for FTS content.
 * Each word is ~10 chars, so we need avgLength / 10 words on average.
 */
function randomContent(avgLength: number): string {
	const wordCount = Math.max(10, Math.floor(avgLength / 10) + Math.floor(Math.random() * 20) - 10);
	const words: string[] = [];
	for (let i = 0; i < wordCount; i++) {
		words.push(randomElement(WORDS));
	}
	return words.join(' ');
}

// ---------------------------------------------------------------------------
// SeedResult interface
// ---------------------------------------------------------------------------

export interface SeedResult {
	/** A well-connected card (200 direct connections) for graph traversal benchmarks */
	hubCardId: string;
	/** First 100 card IDs for reference */
	sampleCardIds: string[];
}

// ---------------------------------------------------------------------------
// SeedOptions interface
// ---------------------------------------------------------------------------

export interface SeedOptions {
	/** Number of cards to seed. Defaults to SEED_CONFIG.cardCount (10,000). */
	cardCount?: number;
}

// ---------------------------------------------------------------------------
// seedDatabase()
// ---------------------------------------------------------------------------

/**
 * Seed the database with cards and connections for performance benchmarks.
 *
 * Seeding is done in two batch transactions (cards, connections) for maximum speed.
 * Returns the hub card ID (well-connected) and a sample of card IDs.
 *
 * @param db - Database instance to seed
 * @param options - Optional seeding options. `cardCount` defaults to SEED_CONFIG.cardCount.
 *                  Connection count scales proportionally at 5:1 ratio.
 *
 * Performance: should complete in under 30 seconds on a modern machine.
 */
export function seedDatabase(db: Database, options?: SeedOptions): SeedResult {
	const cardCount = options?.cardCount ?? SEED_CONFIG.cardCount;
	const connectionCount = Math.floor(cardCount * 5);
	const cardIds: string[] = [];
	const now = new Date().toISOString();

	// ------------------------------------------------------------------
	// Seed cards in a single transaction (Pitfall 6: always batch with BEGIN/COMMIT)
	// ------------------------------------------------------------------
	db.run('BEGIN');
	for (let i = 0; i < cardCount; i++) {
		const id = crypto.randomUUID();
		cardIds.push(id);

		const cardType = randomElement(CARD_TYPES);
		const folder = randomElement(FOLDERS);
		const status = randomElement(STATUSES);
		const tags = JSON.stringify(Array.from({ length: Math.floor(Math.random() * 4) }, () => randomElement(WORDS)));

		db.run(
			`INSERT INTO cards(id, card_type, name, content, folder, tags, status, priority, created_at, modified_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			[
				id,
				cardType,
				`Card ${i}: ${randomElement(WORDS)} ${randomElement(WORDS)}`,
				randomContent(SEED_CONFIG.avgContentLength),
				folder,
				tags,
				status,
				Math.floor(Math.random() * 5),
				now,
				now,
			],
		);
	}
	db.run('COMMIT');

	// ------------------------------------------------------------------
	// Seed connections in a single transaction
	// Hub card (cardIds[0]) gets 200 direct connections for graph benchmarks
	// ------------------------------------------------------------------
	const hubCardId = cardIds[0]!;

	db.run('BEGIN');

	// First 200 connections: hub card to random cards (ensures hub is well-connected)
	const hubCount = Math.min(200, connectionCount);
	for (let i = 0; i < hubCount; i++) {
		const targetIdx = 1 + Math.floor(Math.random() * (cardIds.length - 1));
		db.run(
			`INSERT OR IGNORE INTO connections(id, source_id, target_id, label, weight)
       VALUES (?, ?, ?, ?, ?)`,
			[crypto.randomUUID(), hubCardId, cardIds[targetIdx]!, randomElement(LABELS), Math.random()],
		);
	}

	// Remaining connections: random pairs
	for (let i = hubCount; i < connectionCount; i++) {
		const srcIdx = Math.floor(Math.random() * cardIds.length);
		let tgtIdx = Math.floor(Math.random() * cardIds.length);
		if (tgtIdx === srcIdx) tgtIdx = (tgtIdx + 1) % cardIds.length;
		db.run(
			`INSERT OR IGNORE INTO connections(id, source_id, target_id, label, weight)
       VALUES (?, ?, ?, ?, ?)`,
			[crypto.randomUUID(), cardIds[srcIdx]!, cardIds[tgtIdx]!, randomElement(LABELS), Math.random()],
		);
	}

	db.run('COMMIT');

	return {
		hubCardId,
		sampleCardIds: cardIds.slice(0, 100),
	};
}
