// Isometry v5 — Phase 4 MutationManager
// Command log, execute/undo/redo, dirty flag, rAF-batched subscriber notifications.
//
// Requirements:
//   - MUT-01: MutationManager is the sole write gate for all entity writes
//   - MUT-03: Undo/redo work through full command log
//   - MUT-05: Dirty flag set on every write
//   - MUT-06: Subscriber notifications batched via requestAnimationFrame
//
// Architecture:
//   - execute() sends forward commands → pushes to history → clears redo
//   - undo() sends inverse commands → pops history → pushes to redo
//   - redo() sends forward commands → pops redo → pushes to history
//   - scheduleNotify() uses rAF deduplication: one notification per frame

import type { Mutation } from './types';

// ---------------------------------------------------------------------------
// Bridge interface
// ---------------------------------------------------------------------------

/**
 * Minimal interface for the bridge dependency.
 * Uses exec() (public wrapper around db:exec) — allows easy test mocking.
 */
export interface MutationBridge {
	exec(sql: string, params: unknown[]): Promise<{ changes: number }>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_HISTORY = 100;

// ---------------------------------------------------------------------------
// MutationManager
// ---------------------------------------------------------------------------

/**
 * Sole write gate for all entity mutations.
 *
 * All entity writes MUST go through execute() to:
 * 1. Ensure undo/redo history is maintained
 * 2. Set dirty flag for CloudKit sync
 * 3. Notify subscribers for re-render
 */
export class MutationManager {
	private history: Mutation[] = [];
	private redoStack: Mutation[] = [];
	private dirty = false;
	private pendingNotify = false;
	private subscribers = new Set<() => void>();

	constructor(private readonly bridge: MutationBridge) {}

	// ---------------------------------------------------------------------------
	// Core operations
	// ---------------------------------------------------------------------------

	/**
	 * Execute a mutation: send forward commands, push to history, clear redo.
	 *
	 * MUT-01: All entity writes go through here.
	 * MUT-05: Sets dirty flag.
	 * MUT-06: Schedules subscriber notification via rAF.
	 */
	async execute(mutation: Mutation): Promise<void> {
		// Send all forward commands in order
		for (const cmd of mutation.forward) {
			await this.bridge.exec(cmd.sql, cmd.params);
		}

		// Push to history, cap at MAX_HISTORY
		this.history.push(mutation);
		if (this.history.length > MAX_HISTORY) {
			this.history.shift();
			console.warn(`[MutationManager] History depth exceeded ${MAX_HISTORY}. Oldest entry removed.`);
		}

		// Clear redo stack — new action invalidates redo
		this.redoStack = [];

		// Set dirty flag for CloudKit sync
		this.dirty = true;

		// Batch notification via rAF
		this.scheduleNotify();
	}

	/**
	 * Undo the last mutation: send inverse commands, push to redo stack.
	 *
	 * MUT-03: Undo replays inverse SQL in the mutation's inverse array order.
	 * Note: inverse array is pre-ordered (reversed for batches at creation time).
	 *
	 * @returns true if undo succeeded, false if history was empty
	 */
	async undo(): Promise<boolean> {
		const mutation = this.history.pop();
		if (mutation === undefined) {
			return false;
		}

		// Send inverse commands in order (already reversed for batches in inverses.ts)
		for (const cmd of mutation.inverse) {
			await this.bridge.exec(cmd.sql, cmd.params);
		}

		// Push to redo stack
		this.redoStack.push(mutation);

		// Set dirty flag
		this.dirty = true;

		// Batch notification via rAF
		this.scheduleNotify();

		return true;
	}

	/**
	 * Redo the last undone mutation: send forward commands, push back to history.
	 *
	 * @returns true if redo succeeded, false if redo stack was empty
	 */
	async redo(): Promise<boolean> {
		const mutation = this.redoStack.pop();
		if (mutation === undefined) {
			return false;
		}

		// Send forward commands in order
		for (const cmd of mutation.forward) {
			await this.bridge.exec(cmd.sql, cmd.params);
		}

		// Push back to history
		this.history.push(mutation);

		// Set dirty flag
		this.dirty = true;

		// Batch notification via rAF
		this.scheduleNotify();

		return true;
	}

	// ---------------------------------------------------------------------------
	// State queries
	// ---------------------------------------------------------------------------

	/** Returns true if there are mutations in history to undo. */
	canUndo(): boolean {
		return this.history.length > 0;
	}

	/** Returns true if there are mutations in the redo stack. */
	canRedo(): boolean {
		return this.redoStack.length > 0;
	}

	/**
	 * Returns a readonly snapshot of the mutation history.
	 * Oldest mutation first, newest last.
	 */
	getHistory(): readonly Mutation[] {
		return this.history;
	}

	// ---------------------------------------------------------------------------
	// Dirty flag
	// ---------------------------------------------------------------------------

	/** Returns true if any write has occurred since the last clearDirty(). */
	isDirty(): boolean {
		return this.dirty;
	}

	/** Reset dirty flag (called after successful CloudKit sync). */
	clearDirty(): void {
		this.dirty = false;
	}

	// ---------------------------------------------------------------------------
	// Subscriber notifications
	// ---------------------------------------------------------------------------

	/**
	 * Subscribe to mutation state changes (execute/undo/redo).
	 * Notifications are batched per animation frame (MUT-06).
	 *
	 * @param callback - Called after each rAF batch
	 * @returns Unsubscribe function
	 */
	subscribe(callback: () => void): () => void {
		this.subscribers.add(callback);
		return () => {
			this.subscribers.delete(callback);
		};
	}

	// ---------------------------------------------------------------------------
	// Private: rAF batching
	// ---------------------------------------------------------------------------

	/**
	 * Schedule a subscriber notification on the next animation frame.
	 * Deduplication: if a notification is already pending, this is a no-op.
	 *
	 * MUT-06: Two rapid execute() calls produce ONE subscriber notification.
	 */
	private scheduleNotify(): void {
		if (this.pendingNotify) {
			return;
		}
		this.pendingNotify = true;
		requestAnimationFrame(() => {
			this.pendingNotify = false;
			this.subscribers.forEach((cb) => cb());
		});
	}
}
