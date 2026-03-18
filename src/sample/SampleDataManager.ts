// Isometry v5 -- Phase 52 SampleDataManager (SQL seed edition)
// Loads curated SQL seed files into the Isometry database via the Worker bridge.
//
// Strategy: Seeds use LPG terminology (nodes/edges). We stage them into temp
// tables, then INSERT SELECT into the real schema (cards/connections) with
// column mapping and source='sample' tagging.
//
// Requirements:
//   SMPL-06: Curated datasets with connections for visual impact
//   SMPL-02: Sample data visually identifiable in audit overlay (source='sample')

import type { WorkerBridgeLike } from '../views/types';
import type { SampleDataset } from './types';

// -- Temp table DDL --------------------------------------------------------
// Accommodates all column variants across seed files.

const CREATE_SEED_NODES = `CREATE TEMP TABLE IF NOT EXISTS _seed_nodes (
	id TEXT PRIMARY KEY,
	node_type TEXT,
	name TEXT,
	folder TEXT,
	tags TEXT,
	priority INTEGER DEFAULT 0,
	source TEXT,
	source_id TEXT,
	content TEXT
)`;

const CREATE_SEED_EDGES = `CREATE TEMP TABLE IF NOT EXISTS _seed_edges (
	id TEXT PRIMARY KEY,
	edge_type TEXT,
	source_id TEXT,
	target_id TEXT,
	weight REAL DEFAULT 1.0,
	label TEXT,
	directed INTEGER DEFAULT 1,
	channel TEXT,
	subject TEXT,
	sequence_order INTEGER
)`;

// -- INSERT SELECT: temp → real tables ------------------------------------
// Maps LPG node_type to valid card_type CHECK constraint values.
// Forces source='sample' for clear/filter/sync boundary.

const COPY_NODES_TO_CARDS = `INSERT OR REPLACE INTO cards (
	id, card_type, name, folder, tags, priority, content,
	source, source_id, created_at, modified_at
)
SELECT
	id,
	CASE node_type
		WHEN 'film' THEN 'resource'
		WHEN 'award' THEN 'resource'
		ELSE node_type
	END,
	name, folder, tags, priority, content,
	'sample',
	id,
	strftime('%Y-%m-%dT%H:%M:%SZ', 'now'),
	strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
FROM _seed_nodes`;

const COPY_EDGES_TO_CONNECTIONS = `INSERT OR IGNORE INTO connections (
	id, source_id, target_id, label, weight, created_at
)
SELECT
	id, source_id, target_id, label, weight,
	strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
FROM _seed_edges`;

export class SampleDataManager {
	private bridge: WorkerBridgeLike;
	private datasets: SampleDataset[];

	constructor(bridge: WorkerBridgeLike, datasets: SampleDataset[]) {
		this.bridge = bridge;
		this.datasets = datasets;
	}

	/**
	 * Load a dataset by ID. Clears existing sample data first (idempotent).
	 * Stages SQL seed into temp tables, then copies to real schema.
	 */
	async load(datasetId: string): Promise<void> {
		const dataset = this.datasets.find((d) => d.id === datasetId);
		if (!dataset) throw new Error(`Unknown dataset: ${datasetId}`);

		// Clear existing sample data first (idempotent reload)
		await this.clear();

		// Parse the SQL seed into individual statements
		const statements = splitSQLStatements(dataset.sql);

		// Separate node INSERTs, edge INSERTs, and settings
		const nodeStmts: string[] = [];
		const edgeStmts: string[] = [];

		for (const stmt of statements) {
			// Strip leading comment lines so startsWith() matches the actual SQL keyword
			const stripped = stmt
				.split('\n')
				.filter((line) => !line.trim().startsWith('--'))
				.join('\n')
				.trim();
			if (stripped.startsWith('INSERT INTO nodes')) {
				// Retarget to temp table (use stripped version with comments removed)
				nodeStmts.push(stripped.replace('INSERT INTO nodes', 'INSERT INTO _seed_nodes'));
			} else if (stripped.startsWith('INSERT INTO edges')) {
				edgeStmts.push(stripped.replace('INSERT INTO edges', 'INSERT INTO _seed_edges'));
			}
			// Settings rows are skipped — demo metadata not needed at runtime
		}

		// Stage 1: Load nodes into temp table → copy to cards
		await this._exec(CREATE_SEED_NODES);
		for (const s of nodeStmts) {
			await this._exec(s);
		}
		await this._exec(COPY_NODES_TO_CARDS);
		await this._exec('DROP TABLE IF EXISTS _seed_nodes');

		// Stage 2: Load edges into temp table → copy to connections
		await this._exec(CREATE_SEED_EDGES);
		for (const s of edgeStmts) {
			await this._exec(s);
		}
		await this._exec(COPY_EDGES_TO_CONNECTIONS);
		await this._exec('DROP TABLE IF EXISTS _seed_edges');
	}

	/**
	 * Remove all sample data. Connections cascade via FK ON DELETE CASCADE.
	 */
	async clear(): Promise<void> {
		await this._exec("DELETE FROM cards WHERE source = 'sample'");
	}

	/**
	 * Evict ALL data from the database (not just sample data).
	 * Used for full dataset replacement — Command-K, Catalog selection, etc.
	 * Connections deleted first for explicit FK ordering.
	 */
	async evictAll(): Promise<void> {
		await this._exec('DELETE FROM connections');
		await this._exec('DELETE FROM cards');
	}

	/**
	 * Check if any sample data is currently loaded.
	 */
	async hasSampleData(): Promise<boolean> {
		const result = (await this.bridge.send('db:query', {
			sql: "SELECT COUNT(*) as count FROM cards WHERE source = 'sample'",
			params: [],
		})) as { columns: string[]; rows: Array<{ count: number }> };
		const firstRow = result.rows[0];
		return result.rows.length > 0 && firstRow !== undefined && firstRow.count > 0;
	}

	/**
	 * Returns the full dataset registry.
	 */
	getDatasets(): SampleDataset[] {
		return this.datasets;
	}

	/**
	 * Returns a dataset based on day-of-year rotation.
	 */
	getDefaultDataset(): SampleDataset {
		const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86_400_000);
		// Non-null assertion safe: datasets.length > 0 is a constructor invariant
		return this.datasets[dayOfYear % this.datasets.length]!;
	}

	// -----------------------------------------------------------------------
	// Private helpers
	// -----------------------------------------------------------------------

	private async _exec(sql: string): Promise<void> {
		await this.bridge.send('db:exec', { sql, params: [] });
	}
}

// ---------------------------------------------------------------------------
// SQL Statement Splitter
// ---------------------------------------------------------------------------
// Splits a SQL seed file into individual statements.
// Handles: multi-row INSERTs, inline comments, SQL strings with semicolons.

/**
 * Split SQL text into individual executable statements.
 * Semicolons inside single-quoted strings are NOT treated as delimiters.
 */
export function splitSQLStatements(sql: string): string[] {
	const results: string[] = [];
	let current = '';
	let inString = false;

	for (let i = 0; i < sql.length; i++) {
		const ch = sql[i]!;

		// Skip SQL line comments (-- to end of line) when outside strings
		if (!inString && ch === '-' && i + 1 < sql.length && sql[i + 1] === '-') {
			// Consume everything until newline (semicolons in comments are NOT delimiters)
			while (i < sql.length && sql[i] !== '\n') {
				current += sql[i]!;
				i++;
			}
			if (i < sql.length) {
				current += '\n'; // Keep the newline
			}
			continue;
		}

		if (ch === "'") {
			if (inString && i + 1 < sql.length && sql[i + 1] === "'") {
				// Escaped quote inside string ('') — consume both, stay in string
				current += "''";
				i++;
				continue;
			}
			// Toggle string context
			inString = !inString;
		}

		if (ch === ';' && !inString) {
			const trimmed = current.trim();
			if (trimmed.length > 0) {
				results.push(trimmed);
			}
			current = '';
		} else {
			current += ch;
		}
	}

	// Remaining text after last semicolon
	const remaining = current.trim();
	if (remaining.length > 0 && !remaining.startsWith('--')) {
		results.push(remaining);
	}

	// Filter out comment-only statements
	return results.filter((s) => {
		const withoutComments = s
			.split('\n')
			.filter((line) => !line.trim().startsWith('--'))
			.join('\n')
			.trim();
		return withoutComments.length > 0;
	});
}
