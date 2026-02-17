/**
 * Tests for Apple Notes ETL Type Mapping
 *
 * These tests verify the canonical format → Isometry schema transformations
 * without requiring access to the actual NoteStore.sqlite database.
 */

import { describe, it, expect } from 'vitest';
import {
  canonicalNodeToIsometryNode,
  canonicalNodeToIsometryCard,
  canonicalEdgeToIsometryEdge,
  generateNodeUpsertSQL,
  generateEdgeUpsertSQL,
} from '../type-mapping';
import type { CanonicalNode, CanonicalEdge } from '../types';

describe('Apple Notes ETL Type Mapping', () => {
  // Sample canonical node matching the verified test case
  const sampleNote: CanonicalNode = {
    id: 'apple-notes:138083',
    source: 'apple-notes',
    sourceId: '138083',
    sourceUrl: 'x-coredata://note/138083',
    nodeType: 'note',
    name: 'Under stress, Stacey channels mean Cindy',
    content: '# Under stress, Stacey channels mean Cindy\n\nNote content here...',
    summary: 'Note about Stacey',
    time: {
      created: new Date('2025-11-29T10:00:00Z'),
      modified: new Date('2025-11-29T15:30:00Z'),
    },
    category: {
      hierarchy: ['Family', 'Stacey'],
      tags: ['stacey'],
      status: 'active',
    },
    hierarchy: {
      priority: 0,
      importance: 0,
      sortOrder: 0,
    },
    sourceMeta: {
      accountId: 1,
      folderId: 456,
    },
  };

  const sampleEdge: CanonicalEdge = {
    id: 'nest:apple-notes:folder:Family/Stacey:apple-notes:138083',
    edgeType: 'NEST',
    sourceId: 'apple-notes:folder:Family/Stacey',
    targetId: 'apple-notes:138083',
    weight: 1.0,
    directed: true,
  };

  describe('canonicalNodeToIsometryNode', () => {
    it('maps folder hierarchy correctly', () => {
      const node = canonicalNodeToIsometryNode(sampleNote);

      // This is the key test - folder path should be "Family/Stacey"
      // NOT "BairesDev/Operations" as alto-index.json incorrectly reported
      expect(node.folder).toBe('Family/Stacey');
    });

    it('maps source tracking fields', () => {
      const node = canonicalNodeToIsometryNode(sampleNote);

      expect(node.source).toBe('apple-notes');
      expect(node.source_id).toBe('138083');
      expect(node.source_url).toBe('x-coredata://note/138083');
    });

    it('maps LATCH time properties', () => {
      const node = canonicalNodeToIsometryNode(sampleNote);

      expect(node.created_at).toBe('2025-11-29T10:00:00.000Z');
      expect(node.modified_at).toBe('2025-11-29T15:30:00.000Z');
    });

    it('maps tags as JSON array', () => {
      const node = canonicalNodeToIsometryNode(sampleNote);

      expect(node.tags).toBe('["stacey"]');
    });

    it('maps node type and name', () => {
      const node = canonicalNodeToIsometryNode(sampleNote);

      expect(node.node_type).toBe('note');
      expect(node.name).toBe('Under stress, Stacey channels mean Cindy');
    });

    it('handles empty hierarchy', () => {
      const noteWithoutFolder: CanonicalNode = {
        ...sampleNote,
        category: { hierarchy: [], tags: [], status: 'active' },
      };
      const node = canonicalNodeToIsometryNode(noteWithoutFolder);

      expect(node.folder).toBeNull();
    });

    it('handles empty tags', () => {
      const noteWithoutTags: CanonicalNode = {
        ...sampleNote,
        category: { hierarchy: ['Family'], tags: [], status: 'active' },
      };
      const node = canonicalNodeToIsometryNode(noteWithoutTags);

      expect(node.tags).toBeNull();
    });
  });

  describe('canonicalNodeToIsometryCard', () => {
    it('maps to card schema with correct card_type', () => {
      const card = canonicalNodeToIsometryCard(sampleNote);

      expect(card.card_type).toBe('note');
      expect(card.folder).toBe('Family/Stacey');
      expect(card.source).toBe('apple-notes');
    });

    it('maps project nodeType to note card_type', () => {
      const folderNode: CanonicalNode = {
        ...sampleNote,
        nodeType: 'project',
        name: 'Family',
      };
      const card = canonicalNodeToIsometryCard(folderNode);

      expect(card.card_type).toBe('note');
    });

    it('maps contact nodeType to person card_type', () => {
      const contactNode: CanonicalNode = {
        ...sampleNote,
        nodeType: 'contact',
        name: 'John Doe',
      };
      const card = canonicalNodeToIsometryCard(contactNode);

      expect(card.card_type).toBe('person');
    });
  });

  describe('canonicalEdgeToIsometryEdge', () => {
    it('maps NEST edge correctly', () => {
      const edge = canonicalEdgeToIsometryEdge(sampleEdge);

      expect(edge.edge_type).toBe('NEST');
      expect(edge.source_id).toBe('apple-notes:folder:Family/Stacey');
      expect(edge.target_id).toBe('apple-notes:138083');
      expect(edge.weight).toBe(1.0);
      expect(edge.directed).toBe(1);
    });

    it('handles undirected edges', () => {
      const undirectedEdge: CanonicalEdge = {
        ...sampleEdge,
        edgeType: 'AFFINITY',
        directed: false,
      };
      const edge = canonicalEdgeToIsometryEdge(undirectedEdge);

      expect(edge.directed).toBe(0);
    });
  });

  describe('SQL generation', () => {
    it('generates valid node upsert SQL', () => {
      const node = canonicalNodeToIsometryNode(sampleNote);
      const { sql, params } = generateNodeUpsertSQL(node);

      expect(sql).toContain('INSERT OR REPLACE INTO nodes');
      expect(params).toHaveLength(26);
      expect(params[0]).toBe('apple-notes:138083'); // id
      expect(params[15]).toBe('Family/Stacey'); // folder (index 15)
      expect(params[16]).toBe('["stacey"]'); // tags (index 16)
    });

    it('generates valid edge upsert SQL', () => {
      const edge = canonicalEdgeToIsometryEdge(sampleEdge);
      const { sql, params } = generateEdgeUpsertSQL(edge);

      expect(sql).toContain('INSERT OR REPLACE INTO edges');
      expect(params).toHaveLength(12);
      expect(params[1]).toBe('NEST'); // edge_type
    });
  });
});

describe('Schema Utilities', () => {
  describe('coreDataTimestampToDate', () => {
    it('converts Core Data timestamp correctly', async () => {
      const { coreDataTimestampToDate } = await import('../schema');

      // Core Data timestamp for 2025-11-29 (approximate)
      // Core Data epoch: 2001-01-01
      const timestamp = 783446400; // ~Nov 29, 2025
      const date = coreDataTimestampToDate(timestamp);

      expect(date).toBeInstanceOf(Date);
      expect(date?.getFullYear()).toBe(2025);
    });

    it('handles null timestamp', async () => {
      const { coreDataTimestampToDate } = await import('../schema');

      expect(coreDataTimestampToDate(null)).toBeUndefined();
    });
  });

  describe('buildFolderHierarchy', () => {
    it('builds hierarchy from parent and folder names', async () => {
      const { buildFolderHierarchy } = await import('../schema');

      const row = {
        id: 138083,
        title: 'Test Note',
        snippet: null,
        created_timestamp: null,
        modified_timestamp: null,
        folder_id: 456,
        folder_name: 'Stacey',
        parent_folder_id: 123,
        parent_folder_name: 'Family',
        account_id: 1,
        marked_for_deletion: null,
      };

      const hierarchy = buildFolderHierarchy(row);

      expect(hierarchy).toEqual(['Family', 'Stacey']);
    });

    it('handles missing parent folder', async () => {
      const { buildFolderHierarchy } = await import('../schema');

      const row = {
        id: 138083,
        title: 'Test Note',
        snippet: null,
        created_timestamp: null,
        modified_timestamp: null,
        folder_id: 456,
        folder_name: 'Unfiled',
        parent_folder_id: null,
        parent_folder_name: null,
        account_id: 1,
        marked_for_deletion: null,
      };

      const hierarchy = buildFolderHierarchy(row);

      expect(hierarchy).toEqual(['Unfiled']);
    });
  });
});
