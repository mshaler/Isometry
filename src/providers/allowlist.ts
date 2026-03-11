// Isometry v5 — Phase 4 Provider Allowlist
// Runtime SQL safety: frozen sets + dual validation pattern (type guard + assertion).
//
// ALL error messages MUST start with "SQL safety violation:" for grep-ability.
//
// Design:
//   - ReadonlySet<T> gives compile-time narrowing on .has() checks
//   - Object.freeze() prevents accidental mutation at runtime
//   - isValid*() functions are type guards (boolean return, used in conditionals)
//   - validate*() functions are assertion functions (throw on failure, narrow the type)
//
// Phase 70: SchemaProvider delegation
//   - setSchemaProvider() wires runtime schema-derived validation
//   - isValidFilterField/isValidAxisField delegate to SchemaProvider when wired
//   - Falls back to frozen sets when SchemaProvider is not wired (test isolation, early boot)
//
// DYNM-13 Audit (Phase 71):
//   All 18 hardcoded field-list locations migrated to SchemaProvider delegation.
//   Frozen sets below serve as boot-time fallbacks only (before SchemaProvider initializes).
//   Direct iteration of these sets in UI/view code replaced with SchemaProvider reads.

import type { SchemaProvider } from './SchemaProvider';
import type { AxisField, FilterField, FilterOperator } from './types';

// ---------------------------------------------------------------------------
// Phase 70: SchemaProvider delegation (module-level singleton reference)
// ---------------------------------------------------------------------------

/** Module-level SchemaProvider reference. Null until setSchemaProvider() is called. */
let _schemaProvider: SchemaProvider | null = null;

/**
 * Wire SchemaProvider for runtime schema-derived column validation.
 * Called from main.ts after `await bridge.isReady` ensures schema is populated.
 *
 * When wired:
 *   - isValidFilterField delegates to SchemaProvider.isValidColumn(field, 'cards')
 *   - isValidAxisField delegates to SchemaProvider.isValidColumn(field, 'cards')
 *
 * When NOT wired (null):
 *   - isValidFilterField falls back to ALLOWED_FILTER_FIELDS frozen set
 *   - isValidAxisField falls back to ALLOWED_AXIS_FIELDS frozen set
 *
 * Passing null resets delegation (used in tests for cleanup).
 */
export function setSchemaProvider(sp: SchemaProvider | null): void {
	_schemaProvider = sp;
}

// ---------------------------------------------------------------------------
// Frozen allowlist sets
// ---------------------------------------------------------------------------

/**
 * Columns allowed in SQL WHERE clauses.
 * See types.ts FilterField for the corresponding compile-time union.
 */
export const ALLOWED_FILTER_FIELDS: ReadonlySet<FilterField> = Object.freeze(
	new Set<FilterField>([
		'card_type',
		'name',
		'folder',
		'status',
		'source',
		'created_at',
		'modified_at',
		'due_at',
		'completed_at',
		'event_start',
		'event_end',
		'latitude',
		'longitude',
		'location_name',
		'priority',
		'sort_order',
	]),
);

/**
 * Symbolic operator names allowed in filter conditions.
 * See types.ts FilterOperator for the corresponding compile-time union.
 */
export const ALLOWED_OPERATORS: ReadonlySet<FilterOperator> = Object.freeze(
	new Set<FilterOperator>([
		'eq',
		'neq',
		'gt',
		'gte',
		'lt',
		'lte',
		'contains',
		'startsWith',
		'in',
		'isNull',
		'isNotNull',
	]),
);

/**
 * Columns allowed in ORDER BY and GROUP BY clauses.
 * See types.ts AxisField for the corresponding compile-time union.
 */
export const ALLOWED_AXIS_FIELDS: ReadonlySet<AxisField> = Object.freeze(
	new Set<AxisField>([
		'created_at',
		'modified_at',
		'due_at',
		'folder',
		'status',
		'card_type',
		'priority',
		'sort_order',
		'name',
	]),
);

// ---------------------------------------------------------------------------
// Type guards (return boolean — use in conditionals)
// ---------------------------------------------------------------------------

/**
 * Type guard: returns true if `field` is an allowlisted filter column.
 *
 * Phase 70: When SchemaProvider is wired via setSchemaProvider(), delegates to
 * SchemaProvider.isValidColumn(field, 'cards') for dynamic schema validation.
 * Falls back to ALLOWED_FILTER_FIELDS frozen set when SchemaProvider is not wired.
 *
 * @example
 * if (isValidFilterField(someString)) {
 *   // someString is narrowed to FilterField here
 * }
 */
export function isValidFilterField(field: string): field is FilterField {
	if (_schemaProvider) {
		return _schemaProvider.isValidColumn(field, 'cards');
	}
	return (ALLOWED_FILTER_FIELDS as Set<string>).has(field);
}

/**
 * Type guard: returns true if `op` is an allowlisted filter operator.
 *
 * @example
 * if (isValidOperator(someString)) {
 *   // someString is narrowed to FilterOperator here
 * }
 */
export function isValidOperator(op: string): op is FilterOperator {
	return (ALLOWED_OPERATORS as Set<string>).has(op);
}

/**
 * Type guard: returns true if `field` is an allowlisted axis column.
 *
 * Phase 70: When SchemaProvider is wired via setSchemaProvider(), delegates to
 * SchemaProvider.isValidColumn(field, 'cards') for dynamic schema validation.
 * Falls back to ALLOWED_AXIS_FIELDS frozen set when SchemaProvider is not wired.
 *
 * @example
 * if (isValidAxisField(someString)) {
 *   // someString is narrowed to AxisField here
 * }
 */
export function isValidAxisField(field: string): field is AxisField {
	if (_schemaProvider) {
		return _schemaProvider.isValidColumn(field, 'cards');
	}
	return (ALLOWED_AXIS_FIELDS as Set<string>).has(field);
}

// ---------------------------------------------------------------------------
// Assertion functions (throw on invalid — narrow the type in calling scope)
// ---------------------------------------------------------------------------

/**
 * Assertion: narrows `field` to FilterField or throws.
 * Used in compile() to guard JSON-restored or dynamic field values.
 *
 * @throws {Error} "SQL safety violation: ..." if field is not allowlisted
 */
export function validateFilterField(field: string): asserts field is FilterField {
	if (!isValidFilterField(field)) {
		throw new Error(
			`SQL safety violation: "${field}" is not an allowed filter field. ` +
				`Allowed: ${[...ALLOWED_FILTER_FIELDS].join(', ')}`,
		);
	}
}

/**
 * Assertion: narrows `op` to FilterOperator or throws.
 * Used in compile() to guard JSON-restored or dynamic operator values.
 *
 * @throws {Error} "SQL safety violation: ..." if op is not allowlisted
 */
export function validateOperator(op: string): asserts op is FilterOperator {
	if (!isValidOperator(op)) {
		throw new Error(
			`SQL safety violation: "${op}" is not an allowed filter operator. ` +
				`Allowed: ${[...ALLOWED_OPERATORS].join(', ')}`,
		);
	}
}

/**
 * Assertion: narrows `field` to AxisField or throws.
 * Used in compile() to guard JSON-restored or dynamic axis field values.
 *
 * @throws {Error} "SQL safety violation: ..." if field is not allowlisted
 */
export function validateAxisField(field: string): asserts field is AxisField {
	if (!isValidAxisField(field)) {
		throw new Error(
			`SQL safety violation: "${field}" is not an allowed axis field. ` +
				`Allowed: ${[...ALLOWED_AXIS_FIELDS].join(', ')}`,
		);
	}
}
