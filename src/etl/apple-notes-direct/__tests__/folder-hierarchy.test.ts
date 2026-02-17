/**
 * Folder Hierarchy Reconciliation Tests
 *
 * Integration tests verifying Apple Notes folder hierarchy is preserved
 * correctly through the ETL pipeline.
 *
 * PRIMARY SUCCESS CRITERION:
 *   Note "Under stress, Stacey channels mean Cindy" must be in "Family/Stacey"
 *   folder after sync — not "BairesDev/Operations" (the alto-index.json bug).
 *
 * Phase 117-03
 */

import { describe, it, expect } from 'vitest';
import { buildFolderHierarchy, buildFolderPath, RawNoteRow } from '../schema';
import { canonicalNodeToIsometryNode } from '../type-mapping';
import { CanonicalNode } from '../types';

// =============================================================================
// Test Fixtures
// =============================================================================

function makeRawNoteRow(overrides: Partial<RawNoteRow> = {}): RawNoteRow {
  return {
    id: 138083,
    title: 'Under stress, Stacey channels mean Cindy',
    snippet: null,
    created_timestamp: null,
    modified_timestamp: null,
    folder_id: 42,
    folder_name: 'Stacey',
    parent_folder_id: 10,
    parent_folder_name: 'Family',
    account_id: 1,
    marked_for_deletion: null,
    ...overrides,
  };
}

function makeCanonicalNode(overrides: Partial<CanonicalNode> = {}): CanonicalNode {
  return {
    id: 'apple-notes:138083',
    source: 'apple-notes',
    sourceId: '138083',
    sourceUrl: 'x-coredata://note/138083',
    nodeType: 'note',
    name: 'Under stress, Stacey channels mean Cindy',
    content: 'Note content here',
    summary: 'Note about stress response',
    time: {
      created: new Date('2024-01-15T10:00:00Z'),
      modified: new Date('2024-01-16T11:00:00Z'),
    },
    category: {
      hierarchy: ['Family', 'Stacey'],
      tags: [],
      status: 'active',
    },
    hierarchy: {
      priority: 0,
      importance: 0,
      sortOrder: 0,
    },
    ...overrides,
  };
}

// =============================================================================
// Tests: buildFolderHierarchy
// =============================================================================

describe('Folder Hierarchy Reconciliation', () => {
  describe('buildFolderHierarchy', () => {
    it('returns empty array when no folder', () => {
      const row = makeRawNoteRow({ folder_name: null, parent_folder_name: null });
      expect(buildFolderHierarchy(row)).toEqual([]);
    });

    it('returns single-element array for root-level folder', () => {
      const row = makeRawNoteRow({ folder_name: 'Work', parent_folder_name: null });
      expect(buildFolderHierarchy(row)).toEqual(['Work']);
    });

    it('returns two-element array for nested folder', () => {
      const row = makeRawNoteRow({ folder_name: 'Projects', parent_folder_name: 'Work' });
      expect(buildFolderHierarchy(row)).toEqual(['Work', 'Projects']);
    });

    it('preserves special characters in folder names', () => {
      const row = makeRawNoteRow({
        folder_name: 'Q1 & Q2',
        parent_folder_name: '2024 (Archive)',
      });
      expect(buildFolderHierarchy(row)).toEqual(['2024 (Archive)', 'Q1 & Q2']);
    });
  });

  // ---------------------------------------------------------------------------
  // Stacey Success Criterion (PRIMARY)
  // ---------------------------------------------------------------------------

  describe('Stacey Success Criterion', () => {
    it('maps Stacey note to Family/Stacey hierarchy', () => {
      const row = makeRawNoteRow({
        id: 138083,
        title: 'Under stress, Stacey channels mean Cindy',
        folder_name: 'Stacey',
        parent_folder_name: 'Family',
      });

      const hierarchy = buildFolderHierarchy(row);
      expect(hierarchy).toEqual(['Family', 'Stacey']);
    });

    it('builds Family/Stacey path string for Stacey note', () => {
      const row = makeRawNoteRow({
        id: 138083,
        title: 'Under stress, Stacey channels mean Cindy',
        folder_name: 'Stacey',
        parent_folder_name: 'Family',
      });

      const path = buildFolderPath(row);
      expect(path).toBe('Family/Stacey');
    });

    it('does NOT map Stacey note to BairesDev/Operations (alto-index bug)', () => {
      const row = makeRawNoteRow({
        id: 138083,
        folder_name: 'Stacey',
        parent_folder_name: 'Family',
      });

      const path = buildFolderPath(row);
      expect(path).not.toBe('BairesDev/Operations');
      expect(path).not.toContain('BairesDev');
    });
  });

  // ---------------------------------------------------------------------------
  // Nested Folder Edge Cases
  // ---------------------------------------------------------------------------

  describe('Nested Folder Edge Cases', () => {
    it('returns Unfiled for note with no folder', () => {
      const row = makeRawNoteRow({ folder_name: null, parent_folder_name: null, folder_id: null });
      const path = buildFolderPath(row);
      expect(path).toBe('Unfiled');
    });

    it('returns single folder name for root note', () => {
      const row = makeRawNoteRow({ folder_name: 'Personal', parent_folder_name: null });
      const path = buildFolderPath(row);
      expect(path).toBe('Personal');
    });

    it('handles parent folder with no grandparent (2-level depth)', () => {
      const row = makeRawNoteRow({
        folder_name: 'Operations',
        parent_folder_name: 'BairesDev',
      });
      const hierarchy = buildFolderHierarchy(row);
      expect(hierarchy).toEqual(['BairesDev', 'Operations']);
      expect(buildFolderPath(row)).toBe('BairesDev/Operations');
    });

    it('handles Unicode folder names', () => {
      const row = makeRawNoteRow({
        folder_name: '日本語',
        parent_folder_name: '日記',
      });
      expect(buildFolderHierarchy(row)).toEqual(['日記', '日本語']);
      expect(buildFolderPath(row)).toBe('日記/日本語');
    });

    it('handles empty string folder_name gracefully', () => {
      // Technically shouldn't happen, but defensive check
      const row = makeRawNoteRow({ folder_name: '', parent_folder_name: null });
      // Empty string is falsy — treated as no folder
      const hierarchy = buildFolderHierarchy(row);
      // '' is falsy, so it won't be pushed
      expect(hierarchy).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------
  // CanonicalNode → IsometryNode Mapping
  // ---------------------------------------------------------------------------

  describe('CanonicalNode → IsometryNode Mapping', () => {
    it('joins hierarchy array to folder path with slash separator', () => {
      const node = makeCanonicalNode({
        category: {
          hierarchy: ['Family', 'Stacey'],
          tags: [],
          status: 'active',
        },
      });

      const isometryNode = canonicalNodeToIsometryNode(node);
      expect(isometryNode.folder).toBe('Family/Stacey');
    });

    it('sets folder to null for empty hierarchy', () => {
      const node = makeCanonicalNode({
        category: {
          hierarchy: [],
          tags: [],
          status: 'active',
        },
      });

      const isometryNode = canonicalNodeToIsometryNode(node);
      expect(isometryNode.folder).toBeNull();
    });

    it('maps single-level hierarchy correctly', () => {
      const node = makeCanonicalNode({
        category: {
          hierarchy: ['Work'],
          tags: [],
          status: 'active',
        },
      });

      const isometryNode = canonicalNodeToIsometryNode(node);
      expect(isometryNode.folder).toBe('Work');
    });

    it('preserves source and source_id in mapping', () => {
      const node = makeCanonicalNode({
        id: 'apple-notes:138083',
        source: 'apple-notes',
        sourceId: '138083',
      });

      const isometryNode = canonicalNodeToIsometryNode(node);
      expect(isometryNode.source).toBe('apple-notes');
      expect(isometryNode.source_id).toBe('138083');
    });

    it('Stacey note: full mapping from CanonicalNode to IsometryNode', () => {
      const staceyNode = makeCanonicalNode({
        id: 'apple-notes:138083',
        source: 'apple-notes',
        sourceId: '138083',
        name: 'Under stress, Stacey channels mean Cindy',
        category: {
          hierarchy: ['Family', 'Stacey'],
          tags: [],
          status: 'active',
        },
      });

      const isometryNode = canonicalNodeToIsometryNode(staceyNode);

      // THE critical assertion: folder must be Family/Stacey
      expect(isometryNode.folder).toBe('Family/Stacey');
      expect(isometryNode.name).toBe('Under stress, Stacey channels mean Cindy');
      expect(isometryNode.source).toBe('apple-notes');
      expect(isometryNode.source_id).toBe('138083');
    });
  });
});
