/**
 * SortManager - Multi-level sort management for SuperSort
 *
 * Features:
 * - Single click sorts ascending, second click descending, third clears
 * - Shift+click adds secondary sort levels (up to maxLevels)
 * - Compiles sort state to SQL ORDER BY clause
 * - Tracks sort priority for visual indicators
 */

import type { LATCHAxis, SortLevel, MultiSortState } from './types';

// Re-export types for convenience
export type { SortLevel, MultiSortState };

/**
 * SortManager handles multi-level sorting for SuperGrid headers.
 *
 * Usage:
 * - Call handleHeaderClick() on header click events
 * - Use getSortLevel() to check if a header is sorted (for indicators)
 * - Use compileToSQL() to generate ORDER BY clause
 */
export class SortManager {
  private state: MultiSortState;

  constructor(maxLevels: number = 3) {
    this.state = {
      levels: [],
      maxLevels,
    };
  }

  /**
   * Handle header click for sort operations.
   *
   * Behavior:
   * - Click without Shift: replaces all sorts with new ascending sort
   * - Click on already-sorted header: toggles asc -> desc -> clear
   * - Shift+click on new header: adds secondary sort level
   * - Shift+click on sorted header: toggles direction
   *
   * @param headerId Unique header identifier
   * @param axis LATCH axis of the header
   * @param facet Database column to sort by
   * @param isShiftHeld Whether Shift key was held during click
   * @returns Updated sort state
   */
  handleHeaderClick(
    headerId: string,
    axis: LATCHAxis,
    facet: string,
    isShiftHeld: boolean
  ): MultiSortState {
    const existingIndex = this.state.levels.findIndex(
      (l) => l.headerId === headerId
    );

    if (existingIndex !== -1) {
      // Header is already sorted - toggle or remove
      const existing = this.state.levels[existingIndex];

      if (existing.direction === 'asc') {
        // Toggle to descending
        this.state.levels[existingIndex] = {
          ...existing,
          direction: 'desc',
        };
      } else {
        // Already descending, remove this sort level
        this.state.levels.splice(existingIndex, 1);
        this.renumberPriorities();
      }
    } else if (isShiftHeld && this.state.levels.length < this.state.maxLevels) {
      // Add new secondary sort level
      this.state.levels.push({
        headerId,
        axis,
        facet,
        direction: 'asc',
        priority: this.state.levels.length + 1,
      });
    } else if (isShiftHeld && this.state.levels.length >= this.state.maxLevels) {
      // At max levels with Shift held - do nothing (keep existing sorts)
      // Intentionally no-op
    } else {
      // Replace all with new primary sort
      this.state.levels = [
        {
          headerId,
          axis,
          facet,
          direction: 'asc',
          priority: 1,
        },
      ];
    }

    return this.getState();
  }

  /**
   * Renumber priorities after a sort level is removed.
   * Ensures priorities are always sequential (1, 2, 3).
   */
  private renumberPriorities(): void {
    this.state.levels.forEach((level, index) => {
      level.priority = index + 1;
    });
  }

  /**
   * Compile current sort state to SQL ORDER BY clause.
   *
   * @returns SQL ORDER BY clause (e.g., "ORDER BY status ASC, date DESC")
   *          or empty string if no sorts active
   */
  compileToSQL(): string {
    if (this.state.levels.length === 0) {
      return '';
    }

    // Sort by priority (should already be in order, but be safe)
    const sorted = [...this.state.levels].sort(
      (a, b) => a.priority - b.priority
    );

    const clauses = sorted.map(
      (level) => `${level.facet} ${level.direction.toUpperCase()}`
    );

    return `ORDER BY ${clauses.join(', ')}`;
  }

  /**
   * Get sort level for a specific header.
   * Used by renderer to display sort indicators.
   *
   * @param headerId Header ID to look up
   * @returns SortLevel if header is sorted, undefined otherwise
   */
  getSortLevel(headerId: string): SortLevel | undefined {
    return this.state.levels.find((l) => l.headerId === headerId);
  }

  /**
   * Get current state (immutable copy).
   */
  getState(): MultiSortState {
    return {
      levels: this.state.levels.map((l) => ({ ...l })),
      maxLevels: this.state.maxLevels,
    };
  }

  /**
   * Set state from serialized form.
   * Used for restoring state from persistence.
   */
  setState(state: MultiSortState): void {
    this.state = {
      levels: state.levels.map((l) => ({ ...l })),
      maxLevels: state.maxLevels,
    };
  }

  /**
   * Clear all sort levels.
   */
  clearAll(): void {
    this.state.levels = [];
  }

  /**
   * Check if any sorts are active.
   */
  hasActiveSorts(): boolean {
    return this.state.levels.length > 0;
  }

  /**
   * Get the number of active sort levels.
   */
  getSortCount(): number {
    return this.state.levels.length;
  }
}
