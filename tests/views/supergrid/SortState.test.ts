// Isometry v5 — Phase 23 Plan 01 (Task 1) — TDD RED
// Tests for SortState: cycle/addOrCycle semantics, multi-sort, defensive copy, session restore.
//
// Requirements: SORT-01, SORT-02
// TDD Phase: RED → GREEN

import { describe, it, expect } from 'vitest';
import { SortState } from '../../../src/views/supergrid/SortState';
import type { SortEntry } from '../../../src/views/supergrid/SortState';

// ---------------------------------------------------------------------------
// SortState.cycle() — single-sort mode (plain click)
// ---------------------------------------------------------------------------

describe('SortState.cycle()', () => {
  it('cycle("name") on empty state -> sorts = [{ field: "name", direction: "asc" }]', () => {
    const s = new SortState();
    s.cycle('name');
    expect(s.getSorts()).toEqual([{ field: 'name', direction: 'asc' }]);
  });

  it('cycle("name") when "name" is asc -> sorts = [{ field: "name", direction: "desc" }]', () => {
    const s = new SortState();
    s.cycle('name');
    s.cycle('name');
    expect(s.getSorts()).toEqual([{ field: 'name', direction: 'desc' }]);
  });

  it('cycle("name") when "name" is desc -> sorts = [] (removed)', () => {
    const s = new SortState();
    s.cycle('name');
    s.cycle('name');
    s.cycle('name');
    expect(s.getSorts()).toEqual([]);
  });

  it('cycle("folder") when "name" is sorted -> sorts = [{ field: "folder", direction: "asc" }] (replaces)', () => {
    const s = new SortState();
    s.cycle('name');
    s.cycle('folder');
    expect(s.getSorts()).toEqual([{ field: 'folder', direction: 'asc' }]);
  });

  it('cycle() on empty state, then cycle different field replaces entirely', () => {
    const s = new SortState();
    s.cycle('created_at');
    s.cycle('created_at'); // asc -> desc
    s.cycle('folder');     // replaces with [folder asc]
    expect(s.getSorts()).toEqual([{ field: 'folder', direction: 'asc' }]);
  });
});

// ---------------------------------------------------------------------------
// SortState.addOrCycle() — multi-sort mode (cmd+click)
// ---------------------------------------------------------------------------

describe('SortState.addOrCycle()', () => {
  it('addOrCycle("name") on empty state -> sorts = [{ field: "name", direction: "asc" }]', () => {
    const s = new SortState();
    s.addOrCycle('name');
    expect(s.getSorts()).toEqual([{ field: 'name', direction: 'asc' }]);
  });

  it('addOrCycle("folder") when "name" sorted -> appends folder as asc', () => {
    const s = new SortState();
    s.addOrCycle('name');
    s.addOrCycle('folder');
    expect(s.getSorts()).toEqual([
      { field: 'name', direction: 'asc' },
      { field: 'folder', direction: 'asc' },
    ]);
  });

  it('addOrCycle("name") when "name" asc in chain -> "name" cycled to desc in-place', () => {
    const s = new SortState();
    s.addOrCycle('name');
    s.addOrCycle('folder');
    s.addOrCycle('name'); // cycle "name" to desc
    expect(s.getSorts()).toEqual([
      { field: 'name', direction: 'desc' },
      { field: 'folder', direction: 'asc' },
    ]);
  });

  it('addOrCycle("name") when "name" desc in chain -> removes "name" from chain', () => {
    const s = new SortState();
    s.addOrCycle('name');
    s.addOrCycle('folder');
    s.addOrCycle('name'); // cycle to desc
    s.addOrCycle('name'); // remove from chain
    expect(s.getSorts()).toEqual([{ field: 'folder', direction: 'asc' }]);
  });

  it('addOrCycle when at maxSorts (3) and new field -> no change (silently ignored)', () => {
    const s = new SortState();
    s.addOrCycle('name');
    s.addOrCycle('folder');
    s.addOrCycle('status');
    const before = s.getSorts();
    s.addOrCycle('priority'); // 4th new field — should be ignored
    expect(s.getSorts()).toEqual(before);
    expect(s.getSorts()).toHaveLength(3);
  });

  it('addOrCycle when at maxSorts (3) and EXISTING field -> still cycles (not blocked)', () => {
    const s = new SortState();
    s.addOrCycle('name');
    s.addOrCycle('folder');
    s.addOrCycle('status');
    s.addOrCycle('name'); // existing field — should cycle to desc
    const sorts = s.getSorts();
    const nameEntry = sorts.find(e => e.field === 'name');
    expect(nameEntry?.direction).toBe('desc');
  });

  it('addOrCycle with custom maxSorts=1 blocks adding second new field', () => {
    const s = new SortState([], 1);
    s.addOrCycle('name');
    s.addOrCycle('folder'); // would be 2nd — blocked
    expect(s.getSorts()).toEqual([{ field: 'name', direction: 'asc' }]);
  });
});

// ---------------------------------------------------------------------------
// SortState.getPriority()
// ---------------------------------------------------------------------------

describe('SortState.getPriority()', () => {
  it('getPriority("name") returns 1 when "name" is first sort', () => {
    const s = new SortState();
    s.addOrCycle('name');
    expect(s.getPriority('name')).toBe(1);
  });

  it('getPriority("folder") returns 2 when "folder" is second sort', () => {
    const s = new SortState();
    s.addOrCycle('name');
    s.addOrCycle('folder');
    expect(s.getPriority('folder')).toBe(2);
  });

  it('getPriority("status") returns 0 if "status" is not in sorts', () => {
    const s = new SortState();
    s.addOrCycle('name');
    expect(s.getPriority('status')).toBe(0);
  });

  it('getPriority returns 0 on empty state', () => {
    const s = new SortState();
    expect(s.getPriority('name')).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// SortState.getDirection()
// ---------------------------------------------------------------------------

describe('SortState.getDirection()', () => {
  it('getDirection("name") returns "asc" after cycle("name")', () => {
    const s = new SortState();
    s.cycle('name');
    expect(s.getDirection('name')).toBe('asc');
  });

  it('getDirection("name") returns "desc" after second cycle("name")', () => {
    const s = new SortState();
    s.cycle('name');
    s.cycle('name');
    expect(s.getDirection('name')).toBe('desc');
  });

  it('getDirection("folder") returns null if "folder" is not sorted', () => {
    const s = new SortState();
    s.cycle('name');
    expect(s.getDirection('folder')).toBeNull();
  });

  it('getDirection returns null on empty state', () => {
    const s = new SortState();
    expect(s.getDirection('name')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// SortState.clear()
// ---------------------------------------------------------------------------

describe('SortState.clear()', () => {
  it('clear() removes all sorts', () => {
    const s = new SortState();
    s.addOrCycle('name');
    s.addOrCycle('folder');
    s.clear();
    expect(s.getSorts()).toEqual([]);
  });

  it('clear() on empty state does not throw', () => {
    const s = new SortState();
    expect(() => s.clear()).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// SortState.hasActiveSorts()
// ---------------------------------------------------------------------------

describe('SortState.hasActiveSorts()', () => {
  it('returns false on empty state', () => {
    const s = new SortState();
    expect(s.hasActiveSorts()).toBe(false);
  });

  it('returns true after adding a sort', () => {
    const s = new SortState();
    s.cycle('name');
    expect(s.hasActiveSorts()).toBe(true);
  });

  it('returns false after clearing all sorts', () => {
    const s = new SortState();
    s.cycle('name');
    s.clear();
    expect(s.hasActiveSorts()).toBe(false);
  });

  it('returns false after cycling through to empty (asc->desc->none)', () => {
    const s = new SortState();
    s.cycle('name'); // asc
    s.cycle('name'); // desc
    s.cycle('name'); // none
    expect(s.hasActiveSorts()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// SortState.getSorts() — defensive copy
// ---------------------------------------------------------------------------

describe('SortState.getSorts() — defensive copy', () => {
  it('mutating returned array does not affect internal state', () => {
    const s = new SortState();
    s.addOrCycle('name');
    const sorts = s.getSorts();
    sorts.push({ field: 'folder', direction: 'asc' });
    expect(s.getSorts()).toHaveLength(1);
  });

  it('returns new array reference on each call', () => {
    const s = new SortState();
    s.cycle('name');
    expect(s.getSorts()).not.toBe(s.getSorts());
  });
});

// ---------------------------------------------------------------------------
// SortState constructor — session restore
// ---------------------------------------------------------------------------

describe('SortState constructor — session restore', () => {
  it('constructor with initial entries restores state', () => {
    const initial: SortEntry[] = [
      { field: 'name', direction: 'asc' },
      { field: 'folder', direction: 'desc' },
    ];
    const s = new SortState(initial);
    expect(s.getSorts()).toEqual(initial);
  });

  it('constructor with initial entries does not share reference with initial array', () => {
    const initial: SortEntry[] = [{ field: 'name', direction: 'asc' }];
    const s = new SortState(initial);
    initial.push({ field: 'folder', direction: 'asc' });
    expect(s.getSorts()).toHaveLength(1);
  });

  it('constructor with no args creates empty state', () => {
    const s = new SortState();
    expect(s.getSorts()).toEqual([]);
  });

  it('constructor with custom maxSorts=2 applies the limit', () => {
    const s = new SortState([], 2);
    s.addOrCycle('name');
    s.addOrCycle('folder');
    s.addOrCycle('status'); // 3rd — should be blocked
    expect(s.getSorts()).toHaveLength(2);
  });

  it('constructor with initial entries and custom maxSorts sets both', () => {
    const initial: SortEntry[] = [{ field: 'name', direction: 'asc' }];
    const s = new SortState(initial, 1);
    s.addOrCycle('folder'); // at max — should be blocked
    expect(s.getSorts()).toEqual(initial);
  });
});
