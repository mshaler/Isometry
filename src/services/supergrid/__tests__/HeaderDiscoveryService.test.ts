/**
 * HeaderDiscoveryService Tests
 *
 * Tests for path expansion and header discovery functionality.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HeaderDiscoveryService } from '../HeaderDiscoveryService';
import { buildHeaderTree } from '../../../superstack/builders/header-tree-builder';
import { headerTreeToAxisConfig } from '../../../components/supergrid/adapters/headerTreeAdapter';
import { computeTreeMetrics, getHeaderNodes } from '../../../components/supergrid/utils/treeMetrics';
import type { FacetConfig, QueryRow } from '../../../superstack/types/superstack';

// Mock the logger to avoid import.meta.env issues
vi.mock('../../../utils/dev-logger', () => ({
  superGridLogger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('HeaderDiscoveryService', () => {
  let service: HeaderDiscoveryService;

  beforeEach(() => {
    service = new HeaderDiscoveryService();
  });

  describe('expandPathsInRows', () => {
    it('should split path values into separate level columns', () => {
      const facets: FacetConfig[] = [{
        id: 'folder',
        name: 'Folder',
        axis: 'C',
        sourceColumn: 'folder',
        dataType: 'select',
        pathSeparator: '/',
        sortOrder: 'asc',
      }];

      const rows: QueryRow[] = [
        { folder: 'BairesDev/MSFT', card_count: 5 },
        { folder: 'BairesDev/Google', card_count: 3 },
        { folder: 'Personal', card_count: 2 },
      ];

      // Access private method for testing
      const expansion = (service as unknown as {
        expandPathsInRows: (rows: QueryRow[], facets: FacetConfig[], pathFacetIndex: number) => {
          facets: FacetConfig[];
          rows: QueryRow[];
        };
      }).expandPathsInRows(rows, facets, 0);

      // Should create 2 synthetic facets for max path depth of 2
      expect(expansion.facets).toHaveLength(2);
      expect(expansion.facets[0].id).toBe('folder_level_0');
      expect(expansion.facets[1].id).toBe('folder_level_1');

      // Should have same number of rows
      expect(expansion.rows).toHaveLength(3);

      // Check first row
      expect(expansion.rows[0].folder_level_0).toBe('BairesDev');
      expect(expansion.rows[0].folder_level_1).toBe('MSFT');
      expect(expansion.rows[0].card_count).toBe(5);

      // Check second row
      expect(expansion.rows[1].folder_level_0).toBe('BairesDev');
      expect(expansion.rows[1].folder_level_1).toBe('Google');
      expect(expansion.rows[1].card_count).toBe(3);

      // Check third row (single level path)
      expect(expansion.rows[2].folder_level_0).toBe('Personal');
      expect(expansion.rows[2].folder_level_1).toBe(''); // Empty for missing level
      expect(expansion.rows[2].card_count).toBe(2);
    });

    it('should preserve other facet columns during expansion', () => {
      const facets: FacetConfig[] = [
        {
          id: 'folder',
          name: 'Folder',
          axis: 'C',
          sourceColumn: 'folder',
          dataType: 'select',
          pathSeparator: '/',
          sortOrder: 'asc',
        },
        {
          id: 'tags',
          name: 'Tags',
          axis: 'C',
          sourceColumn: 'tags',
          dataType: 'multi_select',
          sortOrder: 'asc',
        },
      ];

      const rows: QueryRow[] = [
        { folder: 'BairesDev/MSFT', tags: 'work', card_count: 5 },
      ];

      const expansion = (service as unknown as {
        expandPathsInRows: (rows: QueryRow[], facets: FacetConfig[], pathFacetIndex: number) => {
          facets: FacetConfig[];
          rows: QueryRow[];
        };
      }).expandPathsInRows(rows, facets, 0);

      // Should have 3 facets now (folder_level_0, folder_level_1, tags)
      expect(expansion.facets).toHaveLength(3);
      expect(expansion.facets[0].id).toBe('folder_level_0');
      expect(expansion.facets[1].id).toBe('folder_level_1');
      expect(expansion.facets[2].id).toBe('tags');

      // Row should preserve tags
      expect(expansion.rows[0].tags).toBe('work');
      expect(expansion.rows[0].folder_level_0).toBe('BairesDev');
      expect(expansion.rows[0].folder_level_1).toBe('MSFT');
    });

    it('should handle paths with more than 2 levels', () => {
      const facets: FacetConfig[] = [{
        id: 'folder',
        name: 'Folder',
        axis: 'C',
        sourceColumn: 'folder',
        dataType: 'select',
        pathSeparator: '/',
        sortOrder: 'asc',
      }];

      const rows: QueryRow[] = [
        { folder: 'Work/Clients/BairesDev/Projects', card_count: 5 },
      ];

      const expansion = (service as unknown as {
        expandPathsInRows: (rows: QueryRow[], facets: FacetConfig[], pathFacetIndex: number) => {
          facets: FacetConfig[];
          rows: QueryRow[];
        };
      }).expandPathsInRows(rows, facets, 0);

      // Should create 4 synthetic facets
      expect(expansion.facets).toHaveLength(4);
      expect(expansion.facets.map((f: FacetConfig) => f.id)).toEqual([
        'folder_level_0',
        'folder_level_1',
        'folder_level_2',
        'folder_level_3',
      ]);

      expect(expansion.rows[0].folder_level_0).toBe('Work');
      expect(expansion.rows[0].folder_level_1).toBe('Clients');
      expect(expansion.rows[0].folder_level_2).toBe('BairesDev');
      expect(expansion.rows[0].folder_level_3).toBe('Projects');
    });
  });

  describe('buildHeaderTree integration', () => {
    it('should build nested tree from expanded path rows', () => {
      const facets: FacetConfig[] = [{
        id: 'folder',
        name: 'Folder',
        axis: 'C',
        sourceColumn: 'folder',
        dataType: 'select',
        pathSeparator: '/',
        sortOrder: 'asc',
      }];

      const rows: QueryRow[] = [
        { folder: 'BairesDev/MSFT', card_count: 5 },
        { folder: 'BairesDev/Google', card_count: 3 },
        { folder: 'Personal', card_count: 2 },
      ];

      // Expand paths
      const expansion = (service as unknown as {
        expandPathsInRows: (rows: QueryRow[], facets: FacetConfig[], pathFacetIndex: number) => {
          facets: FacetConfig[];
          rows: QueryRow[];
        };
      }).expandPathsInRows(rows, facets, 0);

      // Build tree with expanded facets and rows
      const tree = buildHeaderTree(expansion.rows, expansion.facets, 'row');

      // Tree should have nested structure
      expect(tree.maxDepth).toBe(2);
      expect(tree.roots).toHaveLength(2); // "BairesDev" and "Personal"

      // Find BairesDev root
      const bairesDev = tree.roots.find(r => r.value === 'BairesDev');
      expect(bairesDev).toBeDefined();
      expect(bairesDev!.children).toHaveLength(2); // MSFT and Google
      expect(bairesDev!.children.map(c => c.value).sort()).toEqual(['Google', 'MSFT']);

      // Find Personal root (leaf node)
      const personal = tree.roots.find(r => r.value === 'Personal');
      expect(personal).toBeDefined();
      // Personal has no children at level 1, but the tree builder fills empty strings
      // Actually, Personal only has folder_level_0="Personal", folder_level_1=""
      // The tree builder should stop traversing when it hits empty values
    });

    it('should produce correct tree metrics for grid rendering', () => {
      const facets: FacetConfig[] = [{
        id: 'folder',
        name: 'Folder',
        axis: 'C',
        sourceColumn: 'folder',
        dataType: 'select',
        pathSeparator: '/',
        sortOrder: 'asc',
      }];

      const rows: QueryRow[] = [
        { folder: 'BairesDev/MSFT', card_count: 5 },
        { folder: 'BairesDev/Google', card_count: 3 },
        { folder: 'Personal', card_count: 2 },
      ];

      // Expand paths
      const expansion = (service as unknown as {
        expandPathsInRows: (rows: QueryRow[], facets: FacetConfig[], pathFacetIndex: number) => {
          facets: FacetConfig[];
          rows: QueryRow[];
        };
      }).expandPathsInRows(rows, facets, 0);

      // Build tree
      const tree = buildHeaderTree(expansion.rows, expansion.facets, 'row');

      // Convert to AxisConfig (what SuperGridCSS receives)
      const axisConfig = headerTreeToAxisConfig(tree);

      // Compute tree metrics (what useGridLayout does)
      const metrics = computeTreeMetrics(axisConfig.tree);

      // Verify depth is 2 (folder_level_0, folder_level_1)
      expect(metrics.depth).toBe(2);

      // Get header nodes
      const headers = getHeaderNodes(metrics);

      // Should have 5 headers total:
      // depth 0: BairesDev (internal), Personal (leaf)
      // depth 1: MSFT (leaf under BairesDev), Google (leaf under BairesDev)
      // Wait, actually Personal only has depth 0 as a leaf
      const headerLabels = headers.map(h => ({ label: h.node.label, depth: h.depth, isLeaf: h.isLeaf }));
      console.log('Header labels:', JSON.stringify(headerLabels, null, 2));

      // Should have nested structure
      const depth0Headers = headers.filter(h => h.depth === 0);
      const depth1Headers = headers.filter(h => h.depth === 1);

      expect(depth0Headers.length).toBeGreaterThanOrEqual(2); // BairesDev and Personal
      expect(depth1Headers.length).toBe(2); // MSFT and Google under BairesDev
    });
  });
});
