// Isometry v5 — Phase 37 AuditState
// Session-only change tracking singleton with subscribe pattern.
//
// Tracks insertedIds, updatedIds, and deletedIds as in-memory Sets.
// NOT a provider registered with StateCoordinator -- audit toggle is
// pure CSS overlay, no Worker re-query needed.
//
// Session-only: clears on page reload. No persistence.
//
// Requirements: AUDIT-04, AUDIT-05

export type ChangeStatus = 'new' | 'modified' | 'deleted';

/**
 * Minimal import result shape consumed by AuditState.
 * Matches the subset of ImportResult needed for change tracking.
 */
export interface AuditImportResult {
  insertedIds: string[];
  updatedIds: string[];
  deletedIds: string[];
}

/**
 * Session-only change tracking for audit overlay rendering.
 *
 * Accumulates change sets across multiple imports (union, not replace).
 * Priority: deleted > modified > new when a card ID appears in multiple sets.
 *
 * Subscribe pattern matches SelectionProvider (Tier 3 ephemeral).
 */
export class AuditState {
  private _insertedIds = new Set<string>();
  private _updatedIds = new Set<string>();
  private _deletedIds = new Set<string>();
  private _enabled = false;
  private _listeners: Array<() => void> = [];
  private _cardSourceMap = new Map<string, string>();

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Whether audit overlay is currently visible.
   */
  get enabled(): boolean {
    return this._enabled;
  }

  /**
   * Toggle audit overlay on/off. Notifies all subscribers.
   */
  toggle(): void {
    this._enabled = !this._enabled;
    this._notify();
  }

  /**
   * Get the change status of a card ID.
   * Priority: deleted > modified > new.
   *
   * @returns 'new' | 'modified' | 'deleted' | null
   */
  getChangeStatus(id: string): ChangeStatus | null {
    if (this._deletedIds.has(id)) return 'deleted';
    if (this._updatedIds.has(id)) return 'modified';
    if (this._insertedIds.has(id)) return 'new';
    return null;
  }

  /**
   * Accumulate import result into change sets.
   * Union semantics: each call adds to existing sets, never replaces.
   * Also populates _cardSourceMap for inserted/updated IDs.
   */
  addImportResult(result: AuditImportResult, sourceType: string): void {
    for (const id of result.insertedIds) {
      this._insertedIds.add(id);
      this._cardSourceMap.set(id, sourceType);
    }
    for (const id of result.updatedIds) {
      this._updatedIds.add(id);
      this._cardSourceMap.set(id, sourceType);
    }
    for (const id of result.deletedIds) {
      this._deletedIds.add(id);
    }
    this._notify();
  }

  /**
   * Get the source type for a card ID.
   * @returns Source type string, or null if not tracked.
   */
  getCardSource(id: string): string | null {
    return this._cardSourceMap.get(id) ?? null;
  }

  /**
   * Get the most common source among given card IDs.
   * @returns Most frequent source string, or null if no IDs have a source.
   */
  getDominantSource(cardIds: string[]): string | null {
    if (cardIds.length === 0) return null;

    const counts = new Map<string, number>();
    for (const id of cardIds) {
      const source = this._cardSourceMap.get(id);
      if (source != null) {
        counts.set(source, (counts.get(source) ?? 0) + 1);
      }
    }

    if (counts.size === 0) return null;

    let maxSource: string | null = null;
    let maxCount = 0;
    for (const [source, count] of counts) {
      if (count > maxCount) {
        maxCount = count;
        maxSource = source;
      }
    }
    return maxSource;
  }

  /**
   * Get the highest-priority change status among given card IDs.
   * Priority: deleted > modified > new.
   *
   * @returns Highest-priority status found, or null if none have a status.
   */
  getDominantChangeStatus(cardIds: string[]): ChangeStatus | null {
    if (cardIds.length === 0) return null;

    let hasNew = false;
    let hasModified = false;

    for (const id of cardIds) {
      if (this._deletedIds.has(id)) return 'deleted'; // highest priority, short-circuit
      if (this._updatedIds.has(id)) hasModified = true;
      if (this._insertedIds.has(id)) hasNew = true;
    }

    if (hasModified) return 'modified';
    if (hasNew) return 'new';
    return null;
  }

  /**
   * Subscribe to audit state changes.
   * Callback fires on toggle() and addImportResult().
   *
   * @returns Unsubscribe function -- call in view destroy() to prevent leaks.
   */
  subscribe(cb: () => void): () => void {
    this._listeners.push(cb);
    return () => {
      const idx = this._listeners.indexOf(cb);
      if (idx >= 0) this._listeners.splice(idx, 1);
    };
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  private _notify(): void {
    for (const cb of this._listeners) {
      cb();
    }
  }
}
