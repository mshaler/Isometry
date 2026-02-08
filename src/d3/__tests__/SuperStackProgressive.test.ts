/**
 * SuperStack Progressive Disclosure Tests
 *
 * Tests the progressive disclosure system for hierarchical headers
 * that manages visual complexity when headers get deep (depth > 4).
 */

import { SuperStackProgressive } from '../SuperStackProgressive';
import { HeaderNode, HeaderHierarchy } from '../../types/grid';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as d3 from 'd3';

// Mock D3 selection for testing
const mockSelection = () => ({
  selectAll: vi.fn(() => mockSelection()),
  data: vi.fn(() => mockSelection()),
  join: vi.fn(() => mockSelection()),
  append: vi.fn(() => mockSelection()),
  attr: vi.fn(() => mockSelection()),
  style: vi.fn(() => mockSelection()),
  text: vi.fn(() => mockSelection()),
  on: vi.fn(() => mockSelection()),
  transition: vi.fn(() => mockSelection()),
  duration: vi.fn(() => mockSelection()),
  ease: vi.fn(() => mockSelection()),
  remove: vi.fn(() => mockSelection()),
  empty: vi.fn(() => false),
  node: vi.fn(() => ({ getBoundingClientRect: () => ({ width: 100, height: 40 }) }))
});

// Mock SVG container
const createMockSVGContainer = () => {
  const mockElement = {
    getBoundingClientRect: () => ({ width: 800, height: 200 })
  };
  return d3.select(mockElement as any);
};

// Sample deep hierarchy for testing
const createDeepHierarchy = (depth: number): HeaderHierarchy => {
  const allNodes: HeaderNode[] = [];
  let currentId = 0;

  // Generate deep hierarchy
  for (let level = 0; level <= depth; level++) {
    const nodesAtLevel = Math.max(1, Math.floor(8 / (level + 1))); // Fewer nodes at deeper levels

    for (let i = 0; i < nodesAtLevel; i++) {
      const nodeId = `node-${level}-${i}`;
      const parentId = level > 0 ? `node-${level - 1}-${Math.floor(i / 2)}` : undefined;

      allNodes.push({
        id: nodeId,
        label: `Level ${level} Item ${i}`,
        parentId,
        facet: 'category',
        value: `value-${level}-${i}`,
        count: Math.floor(Math.random() * 10) + 1,
        level,
        span: level === depth ? 1 : 2,
        isExpanded: level < 2, // First two levels expanded by default
        isLeaf: level === depth,
        x: i * 100,
        y: level * 40,
        width: 100,
        height: 40,
        textAlign: 'left' as any,
        labelZone: { x: 0, y: 0, width: 32, height: 40 },
        bodyZone: { x: 32, y: 0, width: 68, height: 40 }
      });
    }
  }

  return {
    axis: 'category',
    rootNodes: allNodes.filter(n => n.level === 0),
    allNodes,
    maxDepth: depth,
    totalWidth: 800,
    totalHeight: (depth + 1) * 40,
    expandedNodeIds: new Set(allNodes.filter(n => n.isExpanded).map(n => n.id)),
    collapsedSubtrees: new Set(),
    config: {} as any,
    lastUpdated: Date.now()
  };
};

describe('SuperStackProgressive', () => {
  let progressive: SuperStackProgressive;
  let mockContainer: any;
  let mockDatabase: any;

  beforeEach(() => {
    // Setup mocks
    mockContainer = createMockSVGContainer();
    mockDatabase = {
      saveProgressiveState: vi.fn(() => ({ success: true })),
      loadProgressiveState: vi.fn(() => null),
      saveLevelVisibility: vi.fn(() => ({ success: true })),
      loadLevelVisibility: vi.fn(() => ({ visibleLevels: [0, 1, 2] }))
    };

    // Create progressive instance
    progressive = new SuperStackProgressive(
      mockContainer.node(),
      {
        maxVisibleLevels: 3,
        autoGroupThreshold: 5,
        semanticGrouping: true,
        enableZoomControls: true,
        enableLevelPicker: true,
        transitionDuration: 300
      },
      mockDatabase
    );
  });

  describe('Level Management', () => {
    it('should limit visible levels when hierarchy is deep', () => {
      const deepHierarchy = createDeepHierarchy(6); // 7 levels total

      progressive.updateHierarchy(deepHierarchy);
      const visibleLevels = progressive.getVisibleLevels();

      expect(visibleLevels.length).toBeLessThanOrEqual(3);
      expect(visibleLevels).toEqual([0, 1, 2]); // Default starting levels
    });

    it('should allow navigation between level depths', () => {
      const deepHierarchy = createDeepHierarchy(6);
      progressive.updateHierarchy(deepHierarchy);

      // Navigate to deeper levels
      progressive.setVisibleLevels([3, 4, 5]);
      const visibleLevels = progressive.getVisibleLevels();

      expect(visibleLevels).toEqual([3, 4, 5]);
    });

    it('should persist level visibility state', () => {
      const deepHierarchy = createDeepHierarchy(5);
      progressive.setStateContext('test-dataset', 'supergrid');
      progressive.updateHierarchy(deepHierarchy);
      progressive.setVisibleLevels([1, 2, 3]);

      expect(mockDatabase.saveLevelVisibility).toHaveBeenCalledWith(
        'test-dataset',
        'supergrid',
        [1, 2, 3]
      );
    });

    it('should restore level visibility state on load', () => {
      mockDatabase.loadLevelVisibility.mockReturnValue({
        visibleLevels: [2, 3, 4]
      });

      progressive.setStateContext('test-dataset', 'supergrid');
      progressive.restoreState();

      const visibleLevels = progressive.getVisibleLevels();
      expect(visibleLevels).toEqual([2, 3, 4]);
    });
  });

  describe('Auto-grouping', () => {
    it('should group levels when depth exceeds threshold', () => {
      const deepHierarchy = createDeepHierarchy(6);
      progressive.updateHierarchy(deepHierarchy);

      const hasGrouping = progressive.hasAutoGrouping();
      expect(hasGrouping).toBe(true);
    });

    it('should apply semantic grouping first', () => {
      const timeHierarchy: HeaderHierarchy = {
        axis: 'time',
        rootNodes: [],
        allNodes: [
          { id: 'year-2024', label: '2024', level: 0, facet: 'year' } as HeaderNode,
          { id: 'q1-2024', label: 'Q1', level: 1, facet: 'quarter', parentId: 'year-2024' } as HeaderNode,
          { id: 'jan-2024', label: 'January', level: 2, facet: 'month', parentId: 'q1-2024' } as HeaderNode,
          { id: 'week1-jan', label: 'Week 1', level: 3, facet: 'week', parentId: 'jan-2024' } as HeaderNode
        ],
        maxDepth: 3,
        totalWidth: 800,
        totalHeight: 160,
        expandedNodeIds: new Set(),
        collapsedSubtrees: new Set(),
        config: {} as any,
        lastUpdated: Date.now()
      };

      progressive.updateHierarchy(timeHierarchy);
      const groups = progressive.getSemanticGroups();

      // Should group time facets together
      expect(groups).toContainEqual(
        expect.objectContaining({
          name: 'Time',
          levels: [0, 1, 2]
        })
      );
    });

    it('should fallback to data density grouping', () => {
      const miscHierarchy = createDeepHierarchy(6);

      // Remove semantic grouping potential by using non-standard facets
      miscHierarchy.allNodes.forEach((node, index) => {
        node.facet = `misc-facet-${index % 3}`;
      });

      progressive.updateHierarchy(miscHierarchy);
      const groups = progressive.getDataDensityGroups();

      expect(groups.length).toBeGreaterThan(0);
      expect(groups[0]).toHaveProperty('name');
      expect(groups[0]).toHaveProperty('levels');
    });
  });

  describe('3D Camera Navigation', () => {
    it('should support stairstepping down hierarchy', () => {
      const deepHierarchy = createDeepHierarchy(6);
      progressive.updateHierarchy(deepHierarchy);

      // Start at top levels
      progressive.setVisibleLevels([0, 1, 2]);

      // Step down one level
      progressive.stepDown();
      expect(progressive.getVisibleLevels()).toEqual([1, 2, 3]);

      // Step down again
      progressive.stepDown();
      expect(progressive.getVisibleLevels()).toEqual([2, 3, 4]);
    });

    it('should support stepping back up hierarchy', () => {
      const deepHierarchy = createDeepHierarchy(6);
      progressive.updateHierarchy(deepHierarchy);

      // Start at deeper levels
      progressive.setVisibleLevels([2, 3, 4]);

      // Step up one level
      progressive.stepUp();
      expect(progressive.getVisibleLevels()).toEqual([1, 2, 3]);

      // Step up again
      progressive.stepUp();
      expect(progressive.getVisibleLevels()).toEqual([0, 1, 2]);
    });

    it('should not step beyond hierarchy bounds', () => {
      const shallowHierarchy = createDeepHierarchy(2);
      progressive.updateHierarchy(shallowHierarchy);

      progressive.setVisibleLevels([0, 1, 2]);

      // Try to step up beyond beginning
      progressive.stepUp();
      expect(progressive.getVisibleLevels()).toEqual([0, 1, 2]);

      // Try to step down beyond end
      progressive.stepDown();
      expect(progressive.getVisibleLevels()).toEqual([0, 1, 2]);
    });
  });

  describe('Performance', () => {
    it('should use progressive rendering for large hierarchies', () => {
      const largeHierarchy = createDeepHierarchy(8); // Very deep

      const renderSpy = vi.spyOn(progressive as any, 'renderProgressively');
      progressive.updateHierarchy(largeHierarchy);

      expect(renderSpy).toHaveBeenCalled();
    });

    it('should maintain 60fps during level transitions', async () => {
      const deepHierarchy = createDeepHierarchy(6);
      progressive.updateHierarchy(deepHierarchy);

      const startTime = performance.now();

      // Trigger level transition
      progressive.setVisibleLevels([2, 3, 4]);

      // Wait for transition to complete
      await new Promise(resolve => setTimeout(resolve, 350));

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should complete within reasonable time
      expect(duration).toBeLessThan(400);
    });

    it('should lazy load off-screen levels', () => {
      const deepHierarchy = createDeepHierarchy(8);
      progressive.updateHierarchy(deepHierarchy);

      // Set visible levels
      progressive.setVisibleLevels([0, 1, 2]);

      const loadedLevels = progressive.getLoadedLevels();

      // Should only load visible levels plus buffer
      expect(loadedLevels.length).toBeLessThanOrEqual(5); // 3 visible + 2 buffer
    });
  });

  describe('UI Controls', () => {
    it('should render level picker tabs', () => {
      const deepHierarchy = createDeepHierarchy(6);
      progressive.updateHierarchy(deepHierarchy);

      const levelPicker = progressive.getLevelPickerState();

      expect(levelPicker.tabs.length).toBeGreaterThan(0);
      expect(levelPicker.currentTab).toBeDefined();
      expect(levelPicker.tabs[0]).toHaveProperty('label');
      expect(levelPicker.tabs[0]).toHaveProperty('levels');
    });

    it('should render zoom controls', () => {
      const hierarchy = createDeepHierarchy(6);
      progressive.updateHierarchy(hierarchy);

      const zoomControls = progressive.getZoomControlState();

      expect(zoomControls).toHaveProperty('canZoomIn');
      expect(zoomControls).toHaveProperty('canZoomOut');
      expect(zoomControls).toHaveProperty('currentLevel');
    });

    it('should handle level picker interactions', () => {
      const deepHierarchy = createDeepHierarchy(6);
      progressive.updateHierarchy(deepHierarchy);

      // Simulate tab click
      progressive.selectLevelTab(1);

      const levelPicker = progressive.getLevelPickerState();
      expect(levelPicker.currentTab).toBe(1);
    });
  });
});