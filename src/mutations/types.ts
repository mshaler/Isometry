// Isometry v5 — Phase 4 Mutation Types
// Defines the command pattern types for the MutationManager.
//
// Design:
//   - MutationCommand: a single SQL statement + params, executable via db:exec
//   - Mutation: a user action captured as forward + inverse command arrays
//   - Inverse is computed at creation time (RESEARCH Pitfall 3) — never at undo time

// ---------------------------------------------------------------------------
// Core types
// ---------------------------------------------------------------------------

/**
 * A single executable SQL statement with bound parameters.
 * Sent to the Worker via bridge.send('db:exec', cmd).
 */
export interface MutationCommand {
	/** Parameterized SQL statement */
	sql: string;
	/** Bound parameters (positional, matching ? placeholders) */
	params: unknown[];
}

/**
 * A user action captured as forward + inverse SQL commands.
 *
 * Invariants:
 *   - forward: commands to execute the action
 *   - inverse: commands to undo the action (reversed for batches — RESEARCH Pitfall 4)
 *   - Both computed at creation time, not at undo/redo time
 */
export interface Mutation {
	/** UUID identifying this mutation in the history log */
	id: string;
	/** Unix timestamp (Date.now()) when the mutation was created */
	timestamp: number;
	/** Human-readable description for debugging and UI display */
	description: string;
	/** Commands to apply the mutation — executed in order */
	forward: MutationCommand[];
	/** Commands to reverse the mutation — executed in order (batches are pre-reversed) */
	inverse: MutationCommand[];
}

/**
 * A UI-only mutation using JS callbacks for forward/inverse.
 * Used for operations like preset apply that don't involve SQL
 * but still need undo/redo through MutationManager.
 *
 * Callback mutations do NOT set the dirty flag (no CloudKit sync needed).
 */
export interface CallbackMutation {
	/** UUID identifying this mutation in the history log */
	id: string;
	/** Unix timestamp (Date.now()) when the mutation was created */
	timestamp: number;
	/** Human-readable description for debugging and UI display */
	description: string;
	/** Callback to apply the mutation */
	forward: () => void;
	/** Callback to reverse the mutation */
	inverse: () => void;
}

/** Any mutation type that MutationManager can handle. */
export type AnyMutation = Mutation | CallbackMutation;

/** Type guard: returns true if mutation uses SQL commands, false if callbacks. */
export function isSqlMutation(m: AnyMutation): m is Mutation {
	return Array.isArray((m as Mutation).forward);
}
