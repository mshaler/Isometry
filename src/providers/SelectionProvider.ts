// Isometry v5 — SelectionProvider
// Tier 3 ephemeral selection state — lives in memory only, never persisted.
//
// Design decisions:
//   - DOES NOT implement PersistableProvider (D-005, PROV-05)
//   - No toJSON(), setState(), resetToDefaults() — omission is intentional
//   - toggle() and range() support Cmd+click / Shift+click patterns (PROV-06)
//   - Subscribers notified via queueMicrotask (batches rapid changes into one notification)
//   - range(id, allIds) accepts the ordered list as parameter — views pass their current sort order

/**
 * SelectionProvider manages ephemeral card selection state.
 *
 * This is a Tier 3 provider — selection is NEVER persisted to any storage.
 * It intentionally has no toJSON, setState, or resetToDefaults methods.
 */
export class SelectionProvider {
  private readonly selectedIds = new Set<string>();
  private lastSelectedId: string | null = null;
  private readonly subscribers = new Set<() => void>();
  private pendingNotify = false;

  // ---------------------------------------------------------------------------
  // Selection mutators
  // ---------------------------------------------------------------------------

  /**
   * Select a single id, replacing any existing selection.
   * (Standard click with no modifier key)
   */
  select(id: string): void {
    this.selectedIds.clear();
    this.selectedIds.add(id);
    this.lastSelectedId = id;
    this.scheduleNotify();
  }

  /**
   * Toggle a single id's selection state.
   * If absent, adds it (Cmd+click adds). If present, removes it.
   * Updates lastSelectedId for future range() calls.
   */
  toggle(id: string): void {
    if (this.selectedIds.has(id)) {
      this.selectedIds.delete(id);
    } else {
      this.selectedIds.add(id);
    }
    this.lastSelectedId = id;
    this.scheduleNotify();
  }

  /**
   * Shift+click range selection.
   * Selects all ids between lastSelectedId and the target id (inclusive).
   * If lastSelectedId is not found in allIds, falls back to select(id).
   *
   * @param id - The target id clicked with Shift
   * @param allIds - Ordered list of all visible ids (from the view's current sort)
   */
  range(id: string, allIds: string[]): void {
    const targetIdx = allIds.indexOf(id);
    const lastIdx = this.lastSelectedId != null ? allIds.indexOf(this.lastSelectedId) : -1;

    if (lastIdx === -1) {
      // lastSelectedId not in list — fall back to simple select
      this.select(id);
      return;
    }

    const start = Math.min(lastIdx, targetIdx);
    const end = Math.max(lastIdx, targetIdx);

    this.selectedIds.clear();
    for (let i = start; i <= end; i++) {
      this.selectedIds.add(allIds[i]);
    }

    this.scheduleNotify();
  }

  /**
   * Replace entire selection with the provided ids.
   * Passing an empty array clears the selection.
   */
  selectAll(ids: string[]): void {
    this.selectedIds.clear();
    for (const id of ids) {
      this.selectedIds.add(id);
    }
    this.scheduleNotify();
  }

  /**
   * Clear all selections.
   */
  clear(): void {
    this.selectedIds.clear();
    this.lastSelectedId = null;
    this.scheduleNotify();
  }

  // ---------------------------------------------------------------------------
  // Readers
  // ---------------------------------------------------------------------------

  /** Returns true if the given id is currently selected. */
  isSelected(id: string): boolean {
    return this.selectedIds.has(id);
  }

  /** Returns a snapshot array of all currently selected ids. */
  getSelectedIds(): string[] {
    return [...this.selectedIds];
  }

  /** Returns the count of currently selected ids. */
  getSelectionCount(): number {
    return this.selectedIds.size;
  }

  // ---------------------------------------------------------------------------
  // Subscription
  // ---------------------------------------------------------------------------

  /**
   * Subscribe to selection changes.
   * The callback fires asynchronously via queueMicrotask after any mutation.
   * Multiple mutations in the same synchronous frame produce ONE notification.
   *
   * @returns An unsubscribe function — call it in view destroy() to prevent leaks.
   */
  subscribe(cb: () => void): () => void {
    this.subscribers.add(cb);
    return () => this.subscribers.delete(cb);
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  private scheduleNotify(): void {
    if (this.pendingNotify) return;
    this.pendingNotify = true;
    queueMicrotask(() => {
      this.pendingNotify = false;
      for (const cb of this.subscribers) {
        cb();
      }
    });
  }
}
