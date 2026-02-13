/**
 * SortManager Tests - TDD for SuperSort multi-level sorting
 *
 * Tests cover:
 * - Single click replaces all sorts with new primary
 * - Shift+click adds secondary sort level
 * - Third click on sorted header clears it
 * - Max 3 sort levels enforced
 * - compileToSQL generates correct ORDER BY clause
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  SortManager,
  type SortLevel,
  type MultiSortState,
} from '../SortManager';

describe('SortManager', () => {
  let sortManager: SortManager;

  beforeEach(() => {
    sortManager = new SortManager();
  });

  describe('handleHeaderClick', () => {
    it('should add ascending sort on first click', () => {
      const result = sortManager.handleHeaderClick(
        'header-status',
        'Category',
        'status',
        false
      );

      expect(result.levels).toHaveLength(1);
      expect(result.levels[0]).toEqual({
        headerId: 'header-status',
        axis: 'Category',
        facet: 'status',
        direction: 'asc',
        priority: 1,
      });
    });

    it('should toggle to descending on second click', () => {
      sortManager.handleHeaderClick('header-status', 'Category', 'status', false);
      const result = sortManager.handleHeaderClick(
        'header-status',
        'Category',
        'status',
        false
      );

      expect(result.levels).toHaveLength(1);
      expect(result.levels[0].direction).toBe('desc');
    });

    it('should clear sort on third click', () => {
      sortManager.handleHeaderClick('header-status', 'Category', 'status', false);
      sortManager.handleHeaderClick('header-status', 'Category', 'status', false);
      const result = sortManager.handleHeaderClick(
        'header-status',
        'Category',
        'status',
        false
      );

      expect(result.levels).toHaveLength(0);
    });

    it('should replace all sorts when clicking new header without Shift', () => {
      sortManager.handleHeaderClick('header-status', 'Category', 'status', false);
      const result = sortManager.handleHeaderClick(
        'header-date',
        'Time',
        'created_at',
        false
      );

      expect(result.levels).toHaveLength(1);
      expect(result.levels[0].headerId).toBe('header-date');
      expect(result.levels[0].facet).toBe('created_at');
    });

    it('should add secondary sort with Shift+click', () => {
      sortManager.handleHeaderClick('header-status', 'Category', 'status', false);
      const result = sortManager.handleHeaderClick(
        'header-date',
        'Time',
        'created_at',
        true // Shift held
      );

      expect(result.levels).toHaveLength(2);
      expect(result.levels[0].headerId).toBe('header-status');
      expect(result.levels[0].priority).toBe(1);
      expect(result.levels[1].headerId).toBe('header-date');
      expect(result.levels[1].priority).toBe(2);
    });

    it('should enforce maxLevels (default 3)', () => {
      sortManager.handleHeaderClick('header-1', 'Category', 'status', false);
      sortManager.handleHeaderClick('header-2', 'Time', 'created_at', true);
      sortManager.handleHeaderClick('header-3', 'Hierarchy', 'priority', true);
      const result = sortManager.handleHeaderClick(
        'header-4',
        'Alphabet',
        'name',
        true
      );

      // Should not add 4th level
      expect(result.levels).toHaveLength(3);
      expect(result.levels.find(l => l.headerId === 'header-4')).toBeUndefined();
    });

    it('should toggle existing level when Shift+clicking already-sorted header', () => {
      sortManager.handleHeaderClick('header-status', 'Category', 'status', false);
      sortManager.handleHeaderClick('header-date', 'Time', 'created_at', true);

      // Shift+click on existing sorted header should toggle it
      const result = sortManager.handleHeaderClick(
        'header-status',
        'Category',
        'status',
        true
      );

      expect(result.levels).toHaveLength(2);
      expect(result.levels[0].direction).toBe('desc');
    });

    it('should renumber priorities when middle sort is removed', () => {
      sortManager.handleHeaderClick('header-1', 'Category', 'status', false);
      sortManager.handleHeaderClick('header-2', 'Time', 'created_at', true);
      sortManager.handleHeaderClick('header-3', 'Hierarchy', 'priority', true);

      // Remove header-2 by clicking twice (asc -> desc -> clear)
      sortManager.handleHeaderClick('header-2', 'Time', 'created_at', true);
      const result = sortManager.handleHeaderClick(
        'header-2',
        'Time',
        'created_at',
        true
      );

      expect(result.levels).toHaveLength(2);
      expect(result.levels[0].headerId).toBe('header-1');
      expect(result.levels[0].priority).toBe(1);
      expect(result.levels[1].headerId).toBe('header-3');
      expect(result.levels[1].priority).toBe(2);
    });
  });

  describe('compileToSQL', () => {
    it('should return empty string when no sorts', () => {
      expect(sortManager.compileToSQL()).toBe('');
    });

    it('should generate single ORDER BY clause', () => {
      sortManager.handleHeaderClick('header-status', 'Category', 'status', false);
      expect(sortManager.compileToSQL()).toBe('ORDER BY status ASC');
    });

    it('should generate multi-column ORDER BY clause', () => {
      sortManager.handleHeaderClick('header-status', 'Category', 'status', false);
      sortManager.handleHeaderClick('header-date', 'Time', 'created_at', true);

      expect(sortManager.compileToSQL()).toBe('ORDER BY status ASC, created_at ASC');
    });

    it('should respect sort direction in ORDER BY', () => {
      sortManager.handleHeaderClick('header-status', 'Category', 'status', false);
      sortManager.handleHeaderClick('header-status', 'Category', 'status', false); // Toggle to desc

      expect(sortManager.compileToSQL()).toBe('ORDER BY status DESC');
    });

    it('should order by priority in multi-sort', () => {
      sortManager.handleHeaderClick('header-status', 'Category', 'status', false);
      sortManager.handleHeaderClick('header-date', 'Time', 'created_at', true);
      sortManager.handleHeaderClick('header-date', 'Time', 'created_at', true); // Toggle date to desc

      expect(sortManager.compileToSQL()).toBe('ORDER BY status ASC, created_at DESC');
    });
  });

  describe('getSortLevel', () => {
    it('should return undefined for unsorted header', () => {
      expect(sortManager.getSortLevel('header-nonexistent')).toBeUndefined();
    });

    it('should return sort level for sorted header', () => {
      sortManager.handleHeaderClick('header-status', 'Category', 'status', false);

      const level = sortManager.getSortLevel('header-status');
      expect(level).toBeDefined();
      expect(level?.direction).toBe('asc');
      expect(level?.priority).toBe(1);
    });
  });

  describe('getState', () => {
    it('should return current state', () => {
      const state = sortManager.getState();
      expect(state.levels).toEqual([]);
      expect(state.maxLevels).toBe(3);
    });

    it('should return immutable state (copy)', () => {
      const state1 = sortManager.getState();
      sortManager.handleHeaderClick('header-status', 'Category', 'status', false);
      const state2 = sortManager.getState();

      expect(state1.levels).toHaveLength(0);
      expect(state2.levels).toHaveLength(1);
    });
  });

  describe('clearAll', () => {
    it('should clear all sort levels', () => {
      sortManager.handleHeaderClick('header-status', 'Category', 'status', false);
      sortManager.handleHeaderClick('header-date', 'Time', 'created_at', true);

      sortManager.clearAll();

      expect(sortManager.getState().levels).toHaveLength(0);
    });
  });

  describe('setState', () => {
    it('should restore state from serialized form', () => {
      const state: MultiSortState = {
        levels: [
          { headerId: 'h1', axis: 'Category', facet: 'status', direction: 'asc', priority: 1 },
          { headerId: 'h2', axis: 'Time', facet: 'date', direction: 'desc', priority: 2 },
        ],
        maxLevels: 3,
      };

      sortManager.setState(state);

      expect(sortManager.getState().levels).toHaveLength(2);
      expect(sortManager.compileToSQL()).toBe('ORDER BY status ASC, date DESC');
    });
  });
});
