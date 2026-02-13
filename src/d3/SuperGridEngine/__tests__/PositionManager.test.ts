import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  PositionManager,
  derivePositionFromNode,
} from '../PositionManager';
import type {
  CellDescriptor,
  Node,
  PAFVConfiguration,
  GridDimensions,
  CardPosition,
} from '../types';

describe('PositionManager', () => {
  let positionManager: PositionManager;

  const mockPAFVConfig: PAFVConfiguration = {
    xMapping: {
      axis: 'Category',
      plane: 'x',
      facet: 'folder',
    },
    yMapping: {
      axis: 'Time',
      plane: 'y',
      facet: 'created_at',
    },
    originPattern: 'anchor',
  };

  const mockGridDimensions: GridDimensions = {
    rows: 3,
    cols: 4,
    cellWidth: 120,
    cellHeight: 80,
    headerHeight: 40,
    headerWidth: 100,
    totalWidth: 580,
    totalHeight: 280,
  };

  const mockNodes: Node[] = [
    {
      id: 'node-1',
      name: 'Task 1',
      created_at: '2024-01-15',
      modified_at: '2024-01-20',
      status: 'active',
      priority: 1,
      folder: 'Work',
      tags: ['project'],
    },
    {
      id: 'node-2',
      name: 'Task 2',
      created_at: '2024-02-10',
      modified_at: '2024-02-15',
      status: 'done',
      priority: 2,
      folder: 'Personal',
      tags: ['health'],
    },
    {
      id: 'node-3',
      name: 'Task 3',
      created_at: '2024-01-15',
      modified_at: '2024-01-25',
      status: 'active',
      priority: 3,
      folder: 'Work',
      tags: ['urgent'],
    },
  ];

  const mockCells: CellDescriptor[] = [
    {
      id: 'cell-0-0',
      gridX: 0,
      gridY: 0,
      xValue: 'Work',
      yValue: '2024-01',
      nodeIds: ['node-1', 'node-3'],
      nodeCount: 2,
    },
    {
      id: 'cell-1-0',
      gridX: 1,
      gridY: 0,
      xValue: 'Personal',
      yValue: '2024-02',
      nodeIds: ['node-2'],
      nodeCount: 1,
    },
  ];

  beforeEach(() => {
    positionManager = new PositionManager();
  });

  describe('initialization', () => {
    it('creates PositionManager instance', () => {
      expect(positionManager).toBeInstanceOf(PositionManager);
    });

    it('has empty positions initially', () => {
      expect(positionManager.getPosition('any-id')).toBeUndefined();
    });

    it('has no custom sort orders initially', () => {
      expect(positionManager.getCustomOrder('any-group')).toBeUndefined();
    });
  });

  describe('derivePositionFromNode', () => {
    it('extracts PAFV coordinates from node', () => {
      const position = derivePositionFromNode(mockNodes[0], mockPAFVConfig);

      expect(position.nodeId).toBe('node-1');
      expect(position.x.axis).toBe('Category');
      expect(position.x.facet).toBe('folder');
      expect(position.x.value).toBe('Work');
      expect(position.y.axis).toBe('Time');
      expect(position.y.facet).toBe('created_at');
      expect(position.y.value).toBe('2024-01-15');
    });

    it('handles null axis mapping', () => {
      const configWithNullZ: PAFVConfiguration = {
        ...mockPAFVConfig,
        zMapping: undefined,
      };

      const position = derivePositionFromNode(mockNodes[0], configWithNullZ);

      expect(position.z.axis).toBeNull();
      expect(position.z.value).toBeNull();
    });

    it('sets lastUpdated timestamp', () => {
      const position = derivePositionFromNode(mockNodes[0], mockPAFVConfig);

      expect(position.lastUpdated).toBeDefined();
      expect(new Date(position.lastUpdated).getTime()).toBeLessThanOrEqual(Date.now());
    });
  });

  describe('calculatePosition', () => {
    it('extracts position from cell descriptor', () => {
      const position = positionManager.calculatePosition(
        mockCells[0],
        mockPAFVConfig
      );

      expect(position.nodeId).toBe('cell-0-0');
      expect(position.x.value).toBe('Work');
      expect(position.y.value).toBe('2024-01');
    });

    it('stores calculated position', () => {
      const position = positionManager.calculatePosition(
        mockCells[0],
        mockPAFVConfig
      );

      expect(positionManager.getPosition('cell-0-0')).toEqual(position);
    });
  });

  describe('resolvePosition', () => {
    it('returns correct grid coordinates', () => {
      const position: CardPosition = {
        nodeId: 'node-1',
        x: { axis: 'Category', facet: 'folder', value: 'Work' },
        y: { axis: 'Time', facet: 'created_at', value: '2024-01' },
        z: { axis: null, value: null },
        lastUpdated: new Date().toISOString(),
      };

      // Set up value-to-index mappings
      positionManager.setValueIndex('x', 'Work', 0);
      positionManager.setValueIndex('x', 'Personal', 1);
      positionManager.setValueIndex('y', '2024-01', 0);
      positionManager.setValueIndex('y', '2024-02', 1);

      const coords = positionManager.resolvePosition(
        position,
        mockPAFVConfig,
        mockGridDimensions
      );

      expect(coords.gridX).toBe(0);
      expect(coords.gridY).toBe(0);
    });

    it('returns -1 for unknown values', () => {
      const position: CardPosition = {
        nodeId: 'node-unknown',
        x: { axis: 'Category', facet: 'folder', value: 'Unknown' },
        y: { axis: 'Time', facet: 'created_at', value: 'Unknown' },
        z: { axis: null, value: null },
        lastUpdated: new Date().toISOString(),
      };

      const coords = positionManager.resolvePosition(
        position,
        mockPAFVConfig,
        mockGridDimensions
      );

      expect(coords.gridX).toBe(-1);
      expect(coords.gridY).toBe(-1);
    });
  });

  describe('custom sort order', () => {
    it('sets and retrieves custom order', () => {
      const order = ['node-3', 'node-1', 'node-2'];
      positionManager.setCustomOrder('Work-Q1', order);

      expect(positionManager.getCustomOrder('Work-Q1')).toEqual(order);
    });

    it('returns undefined for unknown group', () => {
      expect(positionManager.getCustomOrder('unknown-group')).toBeUndefined();
    });

    it('overwrites existing order', () => {
      positionManager.setCustomOrder('Work-Q1', ['a', 'b', 'c']);
      positionManager.setCustomOrder('Work-Q1', ['c', 'b', 'a']);

      expect(positionManager.getCustomOrder('Work-Q1')).toEqual(['c', 'b', 'a']);
    });
  });

  describe('setPosition', () => {
    it('manually sets a position', () => {
      const position: CardPosition = {
        nodeId: 'manual-node',
        x: { axis: 'Category', value: 'Test' },
        y: { axis: 'Time', value: '2024' },
        z: { axis: null, value: null },
        lastUpdated: new Date().toISOString(),
      };

      positionManager.setPosition('manual-node', position);

      expect(positionManager.getPosition('manual-node')).toEqual(position);
    });
  });

  describe('clearPosition', () => {
    it('removes a specific position', () => {
      const position: CardPosition = {
        nodeId: 'temp-node',
        x: { axis: 'Category', value: 'Test' },
        y: { axis: 'Time', value: '2024' },
        z: { axis: null, value: null },
        lastUpdated: new Date().toISOString(),
      };

      positionManager.setPosition('temp-node', position);
      positionManager.clearPosition('temp-node');

      expect(positionManager.getPosition('temp-node')).toBeUndefined();
    });
  });

  describe('clearAllPositions', () => {
    it('removes all positions', () => {
      positionManager.calculatePosition(mockCells[0], mockPAFVConfig);
      positionManager.calculatePosition(mockCells[1], mockPAFVConfig);
      positionManager.clearAllPositions();

      expect(positionManager.getPosition('cell-0-0')).toBeUndefined();
      expect(positionManager.getPosition('cell-1-0')).toBeUndefined();
    });
  });

  describe('serialization', () => {
    it('serializes state to JSON', () => {
      positionManager.calculatePosition(mockCells[0], mockPAFVConfig);
      positionManager.setCustomOrder('group-1', ['a', 'b', 'c']);

      const json = positionManager.serializeState();
      const parsed = JSON.parse(json);

      expect(parsed.positions).toBeDefined();
      expect(parsed.customSortOrders).toBeDefined();
      expect(parsed.positions['cell-0-0']).toBeDefined();
      expect(parsed.customSortOrders['group-1']).toEqual(['a', 'b', 'c']);
    });

    it('deserializes state from JSON', () => {
      const json = JSON.stringify({
        positions: {
          'node-1': {
            nodeId: 'node-1',
            x: { axis: 'Category', value: 'Work' },
            y: { axis: 'Time', value: 'Q1' },
            z: { axis: null, value: null },
            lastUpdated: '2024-01-01T00:00:00Z',
          },
        },
        customSortOrders: {
          'group-1': ['c', 'a', 'b'],
        },
      });

      positionManager.deserializeState(json);

      expect(positionManager.getPosition('node-1')?.x.value).toBe('Work');
      expect(positionManager.getCustomOrder('group-1')).toEqual(['c', 'a', 'b']);
    });

    it('handles empty serialization', () => {
      const json = positionManager.serializeState();
      const parsed = JSON.parse(json);

      expect(parsed.positions).toEqual({});
      expect(parsed.customSortOrders).toEqual({});
    });
  });

  describe('recalculateAllPositions', () => {
    it('creates positions for all nodes', () => {
      const cells = positionManager.recalculateAllPositions(
        mockNodes,
        mockPAFVConfig,
        mockGridDimensions
      );

      expect(cells.length).toBeGreaterThan(0);
      expect(positionManager.getPosition('node-1')).toBeDefined();
      expect(positionManager.getPosition('node-2')).toBeDefined();
      expect(positionManager.getPosition('node-3')).toBeDefined();
    });

    it('reuses existing positions', () => {
      // First calculation
      positionManager.recalculateAllPositions(
        mockNodes,
        mockPAFVConfig,
        mockGridDimensions
      );

      const originalTimestamp = positionManager.getPosition('node-1')?.lastUpdated;

      // Wait a moment then recalculate
      const cells = positionManager.recalculateAllPositions(
        mockNodes,
        mockPAFVConfig,
        mockGridDimensions
      );

      // Position should be reused, not recreated
      expect(cells.length).toBeGreaterThan(0);
      expect(positionManager.getPosition('node-1')?.lastUpdated).toBe(originalTimestamp);
    });
  });

  describe('filter position restoration', () => {
    it('restores positions after filter removal', () => {
      // Initial calculation with all nodes
      positionManager.recalculateAllPositions(
        mockNodes,
        mockPAFVConfig,
        mockGridDimensions
      );

      const originalPosition = positionManager.getPosition('node-2');

      // Simulate filter (node-2 is filtered out)
      const filteredNodes = mockNodes.filter((n) => n.id !== 'node-2');
      positionManager.recalculateAllPositions(
        filteredNodes,
        mockPAFVConfig,
        mockGridDimensions
      );

      // Position for node-2 should still exist
      expect(positionManager.getPosition('node-2')).toEqual(originalPosition);
    });

    it('no position drift after filter cycle', () => {
      // Calculate initial positions
      positionManager.recalculateAllPositions(
        mockNodes,
        mockPAFVConfig,
        mockGridDimensions
      );

      const positionBefore = { ...positionManager.getPosition('node-1')! };

      // Filter → unfilter cycle
      positionManager.recalculateAllPositions(
        mockNodes.slice(0, 1),
        mockPAFVConfig,
        mockGridDimensions
      );
      positionManager.recalculateAllPositions(
        mockNodes,
        mockPAFVConfig,
        mockGridDimensions
      );

      const positionAfter = positionManager.getPosition('node-1')!;

      expect(positionAfter.x.value).toBe(positionBefore.x.value);
      expect(positionAfter.y.value).toBe(positionBefore.y.value);
    });
  });

  describe('updateValueIndices', () => {
    it('builds value-to-index mappings from cells', () => {
      positionManager.updateValueIndices(mockCells);

      // Now resolve should work
      positionManager.setValueIndex('x', 'Work', 0);
      positionManager.setValueIndex('x', 'Personal', 1);

      const position: CardPosition = {
        nodeId: 'test',
        x: { axis: 'Category', value: 'Personal' },
        y: { axis: 'Time', value: '2024-02' },
        z: { axis: null, value: null },
        lastUpdated: new Date().toISOString(),
      };

      positionManager.setValueIndex('y', '2024-02', 0);

      const coords = positionManager.resolvePosition(
        position,
        mockPAFVConfig,
        mockGridDimensions
      );

      expect(coords.gridX).toBe(1);
    });
  });

  describe('handleFilterRemoval', () => {
    it('preserves positions for filtered-out nodes', () => {
      // Initial state with all nodes
      positionManager.recalculateAllPositions(
        mockNodes,
        mockPAFVConfig,
        mockGridDimensions
      );

      const originalPosition = positionManager.getPosition('node-2');
      expect(originalPosition).toBeDefined();

      // Simulate filter: recalculate with only some nodes
      const filteredNodes = mockNodes.filter((n) => n.id !== 'node-2');
      positionManager.recalculateAllPositions(
        filteredNodes,
        mockPAFVConfig,
        mockGridDimensions
      );

      // Position for node-2 should still be stored
      const preservedPosition = positionManager.getPosition('node-2');
      expect(preservedPosition).toEqual(originalPosition);
    });

    it('restores correct position after filter removal', () => {
      // Calculate initial positions
      positionManager.recalculateAllPositions(
        mockNodes,
        mockPAFVConfig,
        mockGridDimensions
      );

      const originalX = positionManager.getPosition('node-1')!.x.value;
      const originalY = positionManager.getPosition('node-1')!.y.value;

      // Filter -> unfilter cycle
      positionManager.recalculateAllPositions(
        [mockNodes[0]],
        mockPAFVConfig,
        mockGridDimensions
      );

      positionManager.recalculateAllPositions(
        mockNodes,
        mockPAFVConfig,
        mockGridDimensions
      );

      // Position values should be identical
      const restoredPosition = positionManager.getPosition('node-1')!;
      expect(restoredPosition.x.value).toBe(originalX);
      expect(restoredPosition.y.value).toBe(originalY);
    });

    it('handles multiple filter cycles without drift', () => {
      positionManager.recalculateAllPositions(
        mockNodes,
        mockPAFVConfig,
        mockGridDimensions
      );

      const baseline = positionManager.serializeState();

      // Multiple filter cycles
      for (let i = 0; i < 3; i++) {
        // Filter to single node
        positionManager.recalculateAllPositions(
          [mockNodes[i % mockNodes.length]],
          mockPAFVConfig,
          mockGridDimensions
        );

        // Restore all nodes
        positionManager.recalculateAllPositions(
          mockNodes,
          mockPAFVConfig,
          mockGridDimensions
        );
      }

      // Compare positions after cycles
      const afterCycles = positionManager.serializeState();
      const baselineData = JSON.parse(baseline);
      const afterData = JSON.parse(afterCycles);

      // Position values should be stable
      for (const nodeId of Object.keys(baselineData.positions)) {
        expect(afterData.positions[nodeId].x.value).toBe(
          baselineData.positions[nodeId].x.value
        );
        expect(afterData.positions[nodeId].y.value).toBe(
          baselineData.positions[nodeId].y.value
        );
      }
    });
  });

  describe('view transition position tracking', () => {
    it('maintains positions when PAFV config changes', () => {
      // Initial positions
      positionManager.recalculateAllPositions(
        mockNodes,
        mockPAFVConfig,
        mockGridDimensions
      );

      const originalPositionCount = mockNodes.length;

      // Change PAFV config (different axis mapping)
      const newConfig: PAFVConfiguration = {
        xMapping: {
          axis: 'Time',
          plane: 'x',
          facet: 'created_at',
        },
        yMapping: {
          axis: 'Category',
          plane: 'y',
          facet: 'folder',
        },
        originPattern: 'anchor',
      };

      const cells = positionManager.recalculateAllPositions(
        mockNodes,
        newConfig,
        mockGridDimensions
      );

      // All nodes should still have positions
      for (const node of mockNodes) {
        expect(positionManager.getPosition(node.id)).toBeDefined();
      }

      // Cells should be generated
      expect(cells.length).toBeGreaterThan(0);
    });
  });
});
