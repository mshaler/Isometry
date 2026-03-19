// Isometry v5 — Phase 93 Coercion Utility
// Pure function to convert raw input values to correct SQL types before updateCardMutation.

// ---------------------------------------------------------------------------
// Field classification constants
// ---------------------------------------------------------------------------

const NULLABLE_TEXT_FIELDS = [
	'content',
	'summary',
	'folder',
	'status',
	'url',
	'mime_type',
	'source',
	'source_id',
	'source_url',
	'location_name',
] as const;

const DATE_FIELDS = ['due_at', 'completed_at', 'event_start', 'event_end'] as const;

const NULLABLE_NUMBER_FIELDS = ['latitude', 'longitude'] as const;

const NON_NULLABLE_NUMBER_FIELDS = ['priority', 'sort_order'] as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CoercionResult = unknown | { error: string };

// ---------------------------------------------------------------------------
// coerceFieldValue
// ---------------------------------------------------------------------------

/**
 * Converts a raw input value to the correct SQL type for a given card field.
 *
 * Returns `{ error: string }` for validation failures (only 'name' can fail).
 * Returns null for empty nullable fields.
 * Returns the numeric value for number fields.
 * Returns passthrough for booleans, card_type, tags, and unknown fields.
 */
export function coerceFieldValue(field: string, rawValue: unknown): CoercionResult {
	// 1. name: required — reject empty/whitespace-only
	if (field === 'name') {
		const str = typeof rawValue === 'string' ? rawValue.trim() : '';
		if (str.length === 0) {
			return { error: 'Name is required' };
		}
		return str;
	}

	// 2. Nullable text fields: empty string → null
	if ((NULLABLE_TEXT_FIELDS as readonly string[]).includes(field)) {
		return rawValue === '' ? null : rawValue;
	}

	// 3. Date fields: empty string → null, otherwise ISO string passthrough
	if ((DATE_FIELDS as readonly string[]).includes(field)) {
		return rawValue === '' ? null : rawValue;
	}

	// 4. Nullable number fields: empty string → null, otherwise Number()
	if ((NULLABLE_NUMBER_FIELDS as readonly string[]).includes(field)) {
		return rawValue === '' ? null : Number(rawValue);
	}

	// 5. Non-nullable number fields: empty string → 0, otherwise Number()
	if ((NON_NULLABLE_NUMBER_FIELDS as readonly string[]).includes(field)) {
		return rawValue === '' ? 0 : Number(rawValue);
	}

	// 6. Boolean passthrough
	if (field === 'is_collective') {
		return rawValue;
	}

	// 7. CardType string passthrough
	if (field === 'card_type') {
		return rawValue;
	}

	// 8. Tags array passthrough
	if (field === 'tags') {
		return rawValue;
	}

	// 9. Default: passthrough (id, created_at, modified_at, deleted_at, etc.)
	return rawValue;
}

// ---------------------------------------------------------------------------
// isCoercionError type guard
// ---------------------------------------------------------------------------

/**
 * Type guard — returns true if result is a validation error object.
 */
export function isCoercionError(result: CoercionResult): result is { error: string } {
	return typeof result === 'object' && result !== null && !Array.isArray(result) && 'error' in (result as object);
}
