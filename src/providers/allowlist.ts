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

import type { FilterField, FilterOperator, AxisField } from './types';

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
  ])
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
  ])
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
  ])
);

// ---------------------------------------------------------------------------
// Type guards (return boolean — use in conditionals)
// ---------------------------------------------------------------------------

/**
 * Type guard: returns true if `field` is an allowlisted filter column.
 *
 * @example
 * if (isValidFilterField(someString)) {
 *   // someString is narrowed to FilterField here
 * }
 */
export function isValidFilterField(field: string): field is FilterField {
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
 * @example
 * if (isValidAxisField(someString)) {
 *   // someString is narrowed to AxisField here
 * }
 */
export function isValidAxisField(field: string): field is AxisField {
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
        `Allowed: ${[...ALLOWED_FILTER_FIELDS].join(', ')}`
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
        `Allowed: ${[...ALLOWED_OPERATORS].join(', ')}`
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
        `Allowed: ${[...ALLOWED_AXIS_FIELDS].join(', ')}`
    );
  }
}
