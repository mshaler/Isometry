// Isometry v5 — Phase 23 Plan 01 — SortState
// Typed data model for SuperGrid sort configuration with cycle/multi-sort semantics.
//
// Design:
//   - cycle(field): single-sort mode (plain click) — replaces any existing sort
//     asc -> desc -> none (removes all sorts if cycling through)
//   - addOrCycle(field): multi-sort mode (cmd+click) — appends or cycles in-place
//     if field not in list (and under maxSorts): appends as asc
//     if field exists and asc: cycles to desc
//     if field exists and desc: removes from chain
//   - getSorts(): defensive copy — callers cannot mutate internal state
//   - Constructor accepts initial entries for session restore
//
// Requirements: SORT-01, SORT-02

import type { AxisField } from '../../providers/types';

// ---------------------------------------------------------------------------
// SortEntry — exported type used by PAFVProvider and SuperGridProviderLike
// ---------------------------------------------------------------------------

/** A single sort entry in the sort chain. */
export interface SortEntry {
  field: AxisField;
  direction: 'asc' | 'desc';
}

// ---------------------------------------------------------------------------
// SortState class
// ---------------------------------------------------------------------------

/**
 * Manages sort configuration for SuperGrid with cycle and multi-sort semantics.
 *
 * Two interaction modes:
 *   - cycle(field): plain click — single sort, replaces existing sort
 *   - addOrCycle(field): cmd+click — multi-sort, appends or cycles existing
 */
export class SortState {
  private _sorts: SortEntry[];
  private readonly _maxSorts: number;

  /**
   * @param initial - Optional initial sort entries for session restore.
   *                  Stored as defensive copy — mutation of original array has no effect.
   * @param maxSorts - Maximum number of simultaneous sort fields (default 3).
   */
  constructor(initial: SortEntry[] = [], maxSorts = 3) {
    this._sorts = [...initial];
    this._maxSorts = maxSorts;
  }

  // ---------------------------------------------------------------------------
  // cycle() — single-sort mode (plain click)
  // ---------------------------------------------------------------------------

  /**
   * Plain-click cycle: single-sort mode. Replaces any existing sort.
   *
   * State machine per field:
   *   - field not sorted (or different field sorted) -> [{ field, direction: 'asc' }]
   *   - field sorted asc -> [{ field, direction: 'desc' }]
   *   - field sorted desc -> [] (unsorted)
   *
   * @param field - The axis field to cycle through
   */
  cycle(field: AxisField): void {
    const existing = this._sorts.find(s => s.field === field);

    if (!existing) {
      // Not sorted: replace all with this field asc
      this._sorts = [{ field, direction: 'asc' }];
    } else if (existing.direction === 'asc') {
      // Was asc: replace all with this field desc
      this._sorts = [{ field, direction: 'desc' }];
    } else {
      // Was desc: clear all sorts
      this._sorts = [];
    }
  }

  // ---------------------------------------------------------------------------
  // addOrCycle() — multi-sort mode (cmd+click)
  // ---------------------------------------------------------------------------

  /**
   * Cmd+click multi-sort cycle. Appends new fields or cycles existing in-place.
   *
   * State machine per field:
   *   - field not in chain AND chain length < maxSorts -> append { field, direction: 'asc' }
   *   - field not in chain AND chain length >= maxSorts -> silently ignored
   *   - field in chain and asc -> cycle to desc in-place (preserves position)
   *   - field in chain and desc -> remove from chain
   *
   * @param field - The axis field to add or cycle
   */
  addOrCycle(field: AxisField): void {
    const idx = this._sorts.findIndex(s => s.field === field);

    if (idx === -1) {
      // Field not in chain
      if (this._sorts.length >= this._maxSorts) {
        // At max capacity — silently ignore new field
        return;
      }
      this._sorts = [...this._sorts, { field, direction: 'asc' }];
    } else if (this._sorts[idx]!.direction === 'asc') {
      // Cycle to desc in-place
      this._sorts = this._sorts.map((s, i) =>
        i === idx ? { ...s, direction: 'desc' as const } : s
      );
    } else {
      // Was desc — remove from chain
      this._sorts = this._sorts.filter((_, i) => i !== idx);
    }
  }

  // ---------------------------------------------------------------------------
  // Read accessors
  // ---------------------------------------------------------------------------

  /**
   * Returns a defensive copy of the current sort entries.
   * Mutating the returned array does NOT affect internal state.
   */
  getSorts(): SortEntry[] {
    return [...this._sorts];
  }

  /**
   * Returns true when at least one sort is active.
   */
  hasActiveSorts(): boolean {
    return this._sorts.length > 0;
  }

  /**
   * Returns the 1-indexed priority of a field in the sort chain.
   * Returns 0 if the field is not currently sorted.
   *
   * Example: if sorts = [name, folder], getPriority('folder') === 2
   */
  getPriority(field: AxisField): number {
    const idx = this._sorts.findIndex(s => s.field === field);
    return idx === -1 ? 0 : idx + 1;
  }

  /**
   * Returns the sort direction for a field, or null if not sorted.
   */
  getDirection(field: AxisField): 'asc' | 'desc' | null {
    const entry = this._sorts.find(s => s.field === field);
    return entry ? entry.direction : null;
  }

  // ---------------------------------------------------------------------------
  // Mutation
  // ---------------------------------------------------------------------------

  /**
   * Clear all active sorts.
   */
  clear(): void {
    this._sorts = [];
  }
}
