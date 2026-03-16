// Isometry v6.1 — Phase 79 Test Infrastructure
// makeProviders(): wired provider stack factory for seam tests.
//
// Design:
//   - Synchronous — all constructors are zero-arg, no async needed
//   - Initializes SchemaProvider from real PRAGMA table_info() data
//   - Wires module-level allowlist singleton via setSchemaProvider() (required for FilterProvider validation)
//   - Wires instance setters on PAFVProvider and SuperDensityProvider (v5.3 pattern)
//   - FilterProvider has NO setSchemaProvider() instance method — module singleton is the only path
//   - Registers all providers with StateCoordinator
//
// Critical init order:
//   1. Create SchemaProvider
//   2. Build ColumnInfo from PRAGMA table_info(cards) and PRAGMA table_info(connections)
//   3. schema.initialize({ cards, connections })
//   4. setSchemaProvider(schema) — wires allowlist module singleton
//   5. Create providers
//   6. pafv.setSchemaProvider(schema) and density.setSchemaProvider(schema)
//   7. Create coordinator and register providers
//
// Usage:
//   beforeEach(async () => {
//     vi.useFakeTimers();
//     db = await realDb();
//     providers = makeProviders(db);
//   });
//   afterEach(() => {
//     providers.coordinator.destroy();
//     db.close();
//     vi.useRealTimers();
//   });

import { FilterProvider } from '../../src/providers/FilterProvider';
import { PAFVProvider } from '../../src/providers/PAFVProvider';
import { SchemaProvider } from '../../src/providers/SchemaProvider';
import { SelectionProvider } from '../../src/providers/SelectionProvider';
import { StateCoordinator } from '../../src/providers/StateCoordinator';
import { SuperDensityProvider } from '../../src/providers/SuperDensityProvider';
import { setSchemaProvider } from '../../src/providers/allowlist';
import type { ColumnInfo, LatchFamily } from '../../src/worker/protocol';
import type { Database } from '../../src/database/Database';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * Named provider stack returned by makeProviders().
 * Destructure the fields you need in each seam test.
 */
export interface ProviderStack {
	filter: FilterProvider;
	pafv: PAFVProvider;
	density: SuperDensityProvider;
	selection: SelectionProvider;
	coordinator: StateCoordinator;
	schema: SchemaProvider;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create a fully-wired provider stack from a realDb() database instance.
 *
 * SchemaProvider is initialized from real PRAGMA table_info() data, ensuring
 * dynamic field validation behaves identically to production. The module-level
 * allowlist singleton and per-provider instance setters are both wired.
 *
 * @param db - An initialized Database instance from realDb()
 * @returns Named object with all 6 providers ready for seam testing
 */
export function makeProviders(db: Database): ProviderStack {
	// Step 1: Build SchemaProvider from real PRAGMA data
	const schema = new SchemaProvider();
	const cardCols = buildColumnInfo(db, 'cards');
	const connCols = buildColumnInfo(db, 'connections');
	schema.initialize({ cards: cardCols, connections: connCols });

	// Step 2: Wire module-level allowlist singleton
	// This is the ONLY way to inject schema into FilterProvider — it has no instance setter.
	setSchemaProvider(schema);

	// Step 3: Create providers (all zero-arg constructors)
	const filter = new FilterProvider();
	const pafv = new PAFVProvider();
	const density = new SuperDensityProvider();
	const selection = new SelectionProvider();

	// Step 4: Wire instance setters (v5.3 setter injection pattern)
	// FilterProvider: NO setSchemaProvider() instance method — module singleton handles it
	pafv.setSchemaProvider(schema);
	density.setSchemaProvider(schema);

	// Step 5: Create coordinator and register all providers
	const coordinator = new StateCoordinator();
	coordinator.registerProvider('filter', filter);
	coordinator.registerProvider('pafv', pafv);
	coordinator.registerProvider('density', density);
	coordinator.registerProvider('selection', selection);

	return { filter, pafv, density, selection, coordinator, schema };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Read PRAGMA table_info for a table and map rows to ColumnInfo objects.
 *
 * PRAGMA table_info columns: cid, name, type, notnull, dflt_value, pk
 * values[i] = [0, 'id', 'TEXT', 1, null, 1]
 */
function buildColumnInfo(db: Database, table: 'cards' | 'connections'): ColumnInfo[] {
	const rows = db.exec(`PRAGMA table_info(${table})`);
	const cols = rows[0]?.values ?? [];
	return cols.map((row) => {
		const name = row[1] as string;
		const rawType = (row[2] as string) ?? '';
		const type = rawType.toUpperCase();
		const notnull = (row[3] as number) === 1;
		const isNumeric = type === 'INTEGER' || type === 'REAL';
		return {
			name,
			type,
			notnull,
			latchFamily: classifyLatchFamily(name),
			isNumeric,
		} satisfies ColumnInfo;
	});
}

/**
 * Classify a column name into a LATCH information architecture family.
 * Replicates the heuristic used by classifyColumns() in the Worker.
 */
function classifyLatchFamily(name: string): LatchFamily {
	if (['latitude', 'longitude', 'location_name'].includes(name)) return 'Location';
	if (
		[
			'created_at',
			'modified_at',
			'due_at',
			'completed_at',
			'event_start',
			'event_end',
		].includes(name)
	)
		return 'Time';
	if (['folder', 'status', 'card_type', 'tags', 'source', 'mime_type'].includes(name))
		return 'Category';
	if (['priority', 'sort_order', 'is_collective'].includes(name)) return 'Hierarchy';
	// Default: Alphabet (covers id, name, content, summary, url, source_id, source_url, etc.)
	return 'Alphabet';
}
