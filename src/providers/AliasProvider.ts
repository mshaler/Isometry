// Isometry v5 — Phase 55 Plan 01
// AliasProvider: display alias persistence for AxisField values.
//
// Requirements: PROP-02
//
// Design:
//   - Implements PersistableProvider for Tier 2 persistence via ui_state table
//   - Display aliases are orthogonal to axis mapping state (PAFVProvider)
//   - Subscriber notifications batched via queueMicrotask (same pattern as PAFVProvider)
//   - setState() does NOT notify subscribers (snap-to-state pattern for persistence restore)

import { isValidAxisField } from './allowlist';
import type { AxisField, PersistableProvider } from './types';

/**
 * AliasProvider manages display aliases for AxisField values.
 *
 * Each AxisField can have a user-defined display name (alias) that
 * propagates to all downstream UI: property labels, projection well
 * chips, and SuperGrid headers. The underlying database column name
 * is never altered.
 *
 * Implements PersistableProvider for Tier 2 persistence.
 */
export class AliasProvider implements PersistableProvider {
	private _aliases: Map<AxisField, string> = new Map();
	private _subscribers: Set<() => void> = new Set();
	private _pendingNotify = false;

	// -----------------------------------------------------------------------
	// Public API
	// -----------------------------------------------------------------------

	/**
	 * Get the display alias for a field. Returns the original field name
	 * if no alias has been set.
	 */
	getAlias(field: AxisField): string {
		return this._aliases.get(field) ?? field;
	}

	/**
	 * Set a display alias for a field. Notifies subscribers.
	 */
	setAlias(field: AxisField, alias: string): void {
		this._aliases.set(field, alias);
		this._scheduleNotify();
	}

	/**
	 * Clear a display alias, reverting to the original field name.
	 * Notifies subscribers.
	 */
	clearAlias(field: AxisField): void {
		this._aliases.delete(field);
		this._scheduleNotify();
	}

	/**
	 * Subscribe to alias changes. Returns an unsubscribe function.
	 * Notifications are batched via queueMicrotask.
	 */
	subscribe(callback: () => void): () => void {
		this._subscribers.add(callback);
		return () => {
			this._subscribers.delete(callback);
		};
	}

	// -----------------------------------------------------------------------
	// PersistableProvider
	// -----------------------------------------------------------------------

	/**
	 * Serialize current aliases to JSON string for ui_state table.
	 */
	toJSON(): string {
		const obj: Record<string, string> = {};
		for (const [field, alias] of this._aliases) {
			obj[field] = alias;
		}
		return JSON.stringify(obj);
	}

	/**
	 * Restore aliases from a previously-serialized plain object.
	 * Does NOT notify subscribers (snap-to-state pattern).
	 */
	setState(state: unknown): void {
		this._aliases.clear();
		if (state != null && typeof state === 'object' && !Array.isArray(state)) {
			for (const [key, value] of Object.entries(state as Record<string, unknown>)) {
				if (isValidAxisField(key) && typeof value === 'string') {
					this._aliases.set(key, value);
				}
			}
		}
	}

	/**
	 * Reset all aliases to defaults (no aliases).
	 */
	resetToDefaults(): void {
		this._aliases.clear();
	}

	// -----------------------------------------------------------------------
	// Private
	// -----------------------------------------------------------------------

	/**
	 * Schedule subscriber notification via queueMicrotask.
	 * Multiple mutations within the same microtask are batched.
	 */
	private _scheduleNotify(): void {
		if (this._pendingNotify) return;
		this._pendingNotify = true;
		queueMicrotask(() => {
			this._pendingNotify = false;
			for (const callback of this._subscribers) {
				callback();
			}
		});
	}
}
