/**
 * Header Tree Builder Tests
 *
 * Tests for building hierarchical header trees from flat query data.
 * Focus on:
 * - Tree structure correctness
 * - Span calculations (parent spans children)
 * - Index calculations (positioning)
 * - Count accumulation
 */

import { describe, it, expect } from 'vitest';
import { buildHeaderTree, recalculateTree, findNodeById } from '../builders/header-tree-builder';
import type { FacetConfig, QueryRow } from '../types/superstack';
import { COMMON_FACETS } from '../config/superstack-defaults';

// Test fixtures
const folderFacet: FacetConfig = COMMON_FACETS.folder;
const tagsFacet: FacetConfig = {
  id: 'tags',
  name: 'Tags',
  axis: 'C',
  sourceColumn: 'tags',
  dataType: 'multi_select',
  sortOrder: 'asc',
};
const yearFacet: FacetConfig = COMMON_FACETS.year;
const monthFacet: FacetConfig = COMMON_FACETS.month;

describe('HeaderTreeBuilder', () => {
  describe('buildHeaderTree', () => {
    it('creates roots for each unique first-level value', () => {
      const rows: QueryRow[] = [
        { folder: 'Work', tags: '#meetings', card_count: 5 },
        { folder: 'Work', tags: '#planning', card_count: 3 },
        { folder: 'Personal', tags: '#journal', card_count: 31 },
      ];

      const tree = buildHeaderTree(rows, [folderFacet, tagsFacet], 'row');

      expect(tree.roots).toHaveLength(2);
      // Sorted alphabetically by default
      expect(tree.roots[0].value).toBe('Personal');
      expect(tree.roots[1].value).toBe('Work');
    });

    it('calculates spans correctly for nested hierarchy', () => {
      const rows: QueryRow[] = [
        { folder: 'Work', tags: '#a', card_count: 1 },
        { folder: 'Work', tags: '#b', card_count: 1 },
        { folder: 'Work', tags: '#c', card_count: 1 },
      ];

      const tree = buildHeaderTree(rows, [folderFacet, tagsFacet], 'row');

      // Work folder should span all 3 tags
      expect(tree.roots[0].span).toBe(3);
      // Each tag is a leaf with span 1
      expect(tree.roots[0].children[0].span).toBe(1);
      expect(tree.roots[0].children[1].span).toBe(1);
      expect(tree.roots[0].children[2].span).toBe(1);
    });

    it('calculates column spans for time hierarchy (Year → Month)', () => {
      const rows: QueryRow[] = [
        { year: '2024', month: '01', card_count: 5 },
        { year: '2024', month: '02', card_count: 3 },
        { year: '2024', month: '03', card_count: 8 },
        { year: '2024', month: '04', card_count: 2 },
        { year: '2024', month: '05', card_count: 6 },
        { year: '2024', month: '06', card_count: 4 },
        { year: '2024', month: '07', card_count: 7 },
        { year: '2024', month: '08', card_count: 9 },
        { year: '2024', month: '09', card_count: 1 },
        { year: '2024', month: '10', card_count: 4 },
        { year: '2024', month: '11', card_count: 3 },
        { year: '2024', month: '12', card_count: 5 },
      ];

      const tree = buildHeaderTree(rows, [yearFacet, monthFacet], 'column');

      // Year 2024 should span all 12 months
      expect(tree.roots[0].span).toBe(12);
      expect(tree.roots[0].children).toHaveLength(12);
    });

    it('accumulates counts up the tree', () => {
      const rows: QueryRow[] = [
        { folder: 'Work', tags: '#a', card_count: 10 },
        { folder: 'Work', tags: '#b', card_count: 20 },
        { folder: 'Personal', tags: '#c', card_count: 15 },
      ];

      const tree = buildHeaderTree(rows, [folderFacet, tagsFacet], 'row');

      // Personal folder: 15 cards
      expect(tree.roots[0].aggregate?.count).toBe(15);
      // Work folder: 10 + 20 = 30 cards
      expect(tree.roots[1].aggregate?.count).toBe(30);
    });

    it('calculates correct startIndices', () => {
      const rows: QueryRow[] = [
        { folder: 'A', tags: '#1', card_count: 1 },
        { folder: 'A', tags: '#2', card_count: 1 },
        { folder: 'B', tags: '#3', card_count: 1 },
        { folder: 'B', tags: '#4', card_count: 1 },
        { folder: 'B', tags: '#5', card_count: 1 },
      ];

      const tree = buildHeaderTree(rows, [folderFacet, tagsFacet], 'row');

      // A starts at 0, spans 2
      expect(tree.roots[0].startIndex).toBe(0);
      expect(tree.roots[0].span).toBe(2);
      // A's children: #1 at 0, #2 at 1
      expect(tree.roots[0].children[0].startIndex).toBe(0);
      expect(tree.roots[0].children[1].startIndex).toBe(1);

      // B starts at 2, spans 3
      expect(tree.roots[1].startIndex).toBe(2);
      expect(tree.roots[1].span).toBe(3);
      // B's children: #3 at 2, #4 at 3, #5 at 4
      expect(tree.roots[1].children[0].startIndex).toBe(2);
      expect(tree.roots[1].children[1].startIndex).toBe(3);
      expect(tree.roots[1].children[2].startIndex).toBe(4);
    });

    it('populates leaf array correctly', () => {
      const rows: QueryRow[] = [
        { folder: 'Work', tags: '#a', card_count: 1 },
        { folder: 'Work', tags: '#b', card_count: 1 },
        { folder: 'Personal', tags: '#c', card_count: 1 },
      ];

      const tree = buildHeaderTree(rows, [folderFacet, tagsFacet], 'row');

      expect(tree.leaves).toHaveLength(3);
      expect(tree.leafCount).toBe(3);
      expect(tree.leaves.map((l) => l.value)).toEqual(['#c', '#a', '#b']);
    });

    it('sets maxDepth correctly', () => {
      const rows: QueryRow[] = [
        { folder: 'Work', tags: '#a', card_count: 1 },
      ];

      const tree = buildHeaderTree(rows, [folderFacet, tagsFacet], 'row');

      expect(tree.maxDepth).toBe(2);
    });

    it('creates proper parent references', () => {
      const rows: QueryRow[] = [
        { folder: 'Work', tags: '#a', card_count: 1 },
      ];

      const tree = buildHeaderTree(rows, [folderFacet, tagsFacet], 'row');

      const workNode = tree.roots[0];
      const tagNode = workNode.children[0];

      expect(workNode.parent).toBeNull();
      expect(tagNode.parent).toBe(workNode);
    });

    it('builds correct path for filtering', () => {
      const rows: QueryRow[] = [
        { folder: 'Work', tags: '#meetings', card_count: 5 },
      ];

      const tree = buildHeaderTree(rows, [folderFacet, tagsFacet], 'row');

      const workNode = tree.roots[0];
      const meetingsNode = workNode.children[0];

      expect(workNode.path).toEqual(['Work']);
      expect(meetingsNode.path).toEqual(['Work', '#meetings']);
    });
  });

  describe('recalculateTree', () => {
    it('updates spans when a node is collapsed', () => {
      const rows: QueryRow[] = [
        { folder: 'Work', tags: '#a', card_count: 1 },
        { folder: 'Work', tags: '#b', card_count: 1 },
        { folder: 'Work', tags: '#c', card_count: 1 },
        { folder: 'Personal', tags: '#d', card_count: 1 },
      ];

      const tree = buildHeaderTree(rows, [folderFacet, tagsFacet], 'row');

      expect(tree.leafCount).toBe(4);
      expect(tree.roots[1].span).toBe(3); // Work has 3 tags

      // Collapse Work folder
      tree.roots[1].collapsed = true;
      recalculateTree(tree);

      // Collapsed node becomes a leaf with span 1
      expect(tree.roots[1].span).toBe(1);
      expect(tree.leafCount).toBe(2); // Personal + collapsed Work
    });

    it('restores spans when a node is expanded', () => {
      const rows: QueryRow[] = [
        { folder: 'Work', tags: '#a', card_count: 1 },
        { folder: 'Work', tags: '#b', card_count: 1 },
      ];

      const tree = buildHeaderTree(rows, [folderFacet, tagsFacet], 'row');

      // Collapse then expand
      tree.roots[0].collapsed = true;
      recalculateTree(tree);
      expect(tree.roots[0].span).toBe(1);

      tree.roots[0].collapsed = false;
      recalculateTree(tree);
      expect(tree.roots[0].span).toBe(2);
    });
  });

  describe('findNodeById', () => {
    it('finds node by id', () => {
      const rows: QueryRow[] = [
        { folder: 'Work', tags: '#a', card_count: 1 },
        { folder: 'Work', tags: '#b', card_count: 1 },
      ];

      const tree = buildHeaderTree(rows, [folderFacet, tagsFacet], 'row');

      const found = findNodeById(tree, 'Work|#b');
      expect(found).not.toBeNull();
      expect(found?.value).toBe('#b');
    });

    it('returns null for non-existent id', () => {
      const rows: QueryRow[] = [
        { folder: 'Work', tags: '#a', card_count: 1 },
      ];

      const tree = buildHeaderTree(rows, [folderFacet, tagsFacet], 'row');

      const found = findNodeById(tree, 'NonExistent');
      expect(found).toBeNull();
    });
  });

  describe('formatLabel', () => {
    it('formats month numbers to names', () => {
      const rows: QueryRow[] = [
        { year: '2024', month: '01', card_count: 1 },
        { year: '2024', month: '07', card_count: 1 },
        { year: '2024', month: '12', card_count: 1 },
      ];

      const tree = buildHeaderTree(rows, [yearFacet, monthFacet], 'column');

      const months = tree.roots[0].children;
      expect(months[0].label).toBe('Jan');
      expect(months[1].label).toBe('Jul');
      expect(months[2].label).toBe('Dec');
    });
  });
});
