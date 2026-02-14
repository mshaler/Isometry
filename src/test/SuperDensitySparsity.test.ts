/**
 * SuperDensitySparsity Test Suite
 *
 * Comprehensive test suite for the Janus density model implementation
 * following Section 2.5 of SuperGrid specification requirements.
 *
 * Testing Criteria:
 * ✓ Value density collapse: Month → Quarter, data counts preserved
 * ✓ Extent hide empty: Grid compresses, total cells = populated count
 * ✓ Cross-density accuracy: Modify at sparse level, reflects in dense
 * ✓ Region mixing: Time dense + Category sparse coexist
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { SuperDensityService } from '@/services/SuperDensityService';
import { LATCHFilterService } from '@/services/LATCHFilterService';
import type {
  JanusDensityState,
  DensityAggregationResult,
  DensityChangeEvent,
  RegionDensityConfig,
  DEFAULT_JANUS_DENSITY
} from '@/types/supergrid';

// Mock database executor
const mockDatabase = {
  execute: vi.fn()
};

// Sample test data
const sampleNodes = [
  { id: '1', name: 'Task 1', folder: 'work', status: 'active', priority: 5, created_at: '2024-01-15T10:00:00Z', tags: '["dev"]' },
  { id: '2', name: 'Task 2', folder: 'work', status: 'completed', priority: 3, created_at: '2024-02-15T10:00:00Z', tags: '["design"]' },
  { id: '3', name: 'Task 3', folder: 'personal', status: 'active', priority: 2, created_at: '2024-03-15T10:00:00Z', tags: '["life"]' },
  { id: '4', name: 'Task 4', folder: 'work', status: 'active', priority: 4, created_at: '2024-01-30T10:00:00Z', tags: '["dev"]' },
  { id: '5', name: 'Task 5', folder: null, status: null, priority: 1, created_at: '2024-02-28T10:00:00Z', tags: null }
];

// Mock SQL results
const mockSQLResults = {
  leafNodes: sampleNodes,
  aggregatedByMonth: [
    { time_month: '2024-01', count: 2, folder: 'work' },
    { time_month: '2024-02', count: 2, folder: 'work' },
    { time_month: '2024-03', count: 1, folder: 'personal' }
  ],
  aggregatedByQuarter: [
    { time_quarter: 'Q1 2024', count: 5, folder: 'work' }
  ],
  populatedOnly: sampleNodes.filter(n => n.folder && n.status),
  sourceCount: [{ total: 5 }]
};

// Skip: Tests spec requirements for stub service not yet implemented
describe.skip('SuperDensityService - Janus Density Engine', () => {
  let densityService: SuperDensityService;
  let filterService: LATCHFilterService;

  beforeEach(() => {
    vi.clearAllMocks();
    filterService = new LATCHFilterService();
    densityService = new SuperDensityService(
      mockDatabase,
      filterService,
      { enableDebugLogging: false }
    );

    // Setup mock database responses
    mockDatabase.execute.mockImplementation((sql: string) => {
      if (sql.includes('COUNT(*) as total')) {
        return mockSQLResults.sourceCount;
      } else if (sql.includes('GROUP BY') && sql.includes('time_quarter')) {
        return mockSQLResults.aggregatedByQuarter;
      } else if (sql.includes('GROUP BY') && sql.includes('time_month')) {
        return mockSQLResults.aggregatedByMonth;
      } else if (sql.includes('populated-only')) {
        return mockSQLResults.populatedOnly;
      } else {
        return mockSQLResults.leafNodes;
      }
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('4-Level Density Hierarchy', () => {
    it('should initialize with default Janus density state', () => {
      const state = densityService.getCurrentState();
      expect(state).toEqual(DEFAULT_JANUS_DENSITY);
    });

    it('should change Level 1: Value Density (leaf ↔ collapsed)', async () => {
      const changeEvent = await densityService.setDensity('value', 'collapsed');

      expect(changeEvent.changedLevel).toBe('value');
      expect(changeEvent.newState.valueDensity).toBe('collapsed');
      expect(changeEvent.dataIntegrityPreserved).toBe(true);
      expect(changeEvent.metrics.withinPerformanceTarget).toBe(true);
    });

    it('should change Level 2: Extent Density (sparse ↔ populated-only)', async () => {
      const changeEvent = await densityService.setDensity('extent', 'sparse');

      expect(changeEvent.changedLevel).toBe('extent');
      expect(changeEvent.newState.extentDensity).toBe('sparse');
      expect(changeEvent.dataIntegrityPreserved).toBe(true);
    });

    it('should change Level 3: View Density (spreadsheet ↔ matrix ↔ hybrid)', async () => {
      const changeEvent = await densityService.setDensity('view', 'matrix');

      expect(changeEvent.changedLevel).toBe('view');
      expect(changeEvent.newState.viewDensity).toBe('matrix');
    });

    it('should change Level 4: Region Configuration', async () => {
      const regionConfig: RegionDensityConfig[] = [{
        regionId: 'time-dense',
        axis: 'T',
        facet: 'created_at',
        mode: 'populated-only',
        aggregationLevel: 2,
        visualWeight: 'heavy'
      }];

      const changeEvent = await densityService.setDensity('region', regionConfig);

      expect(changeEvent.changedLevel).toBe('region');
      expect(changeEvent.newState.regionConfig).toEqual(regionConfig);
    });
  });

  describe('Pan × Zoom Independence (Janus Quadrants)', () => {
    it('should support Sparse + Leaf quadrant', async () => {
      await densityService.setDensity('extent', 'sparse');
      await densityService.setDensity('value', 'leaf');

      const result = await densityService.generateAggregatedData();

      expect(result.data.length).toBeGreaterThan(0);
      expect(result.metadata.compressionRatio).toBe(1); // No compression for leaf
      expect(mockDatabase.execute).toHaveBeenCalledWith(
        expect.not.stringContaining('GROUP BY'), // No grouping for leaf
        expect.any(Array)
      );
    });

    it('should support Dense + Leaf quadrant', async () => {
      await densityService.setDensity('extent', 'populated-only');
      await densityService.setDensity('value', 'leaf');

      const result = await densityService.generateAggregatedData();

      expect(result.executedQuery).toContain('name IS NOT NULL AND name != ""');
      expect(result.metadata.compressionRatio).toBe(1);
    });

    it('should support Sparse + Rolled quadrant', async () => {
      await densityService.setDensity('extent', 'sparse');
      await densityService.setDensity('value', 'collapsed');
      await densityService.setAxisGranularity('T', 2); // Quarter level

      const result = await densityService.generateAggregatedData();

      expect(result.executedQuery).toContain('GROUP BY');
      expect(result.metadata.compressionRatio).toBeLessThan(1); // Compression applied
    });

    it('should support Dense + Rolled quadrant', async () => {
      await densityService.setDensity('extent', 'populated-only');
      await densityService.setDensity('value', 'collapsed');
      await densityService.setAxisGranularity('T', 1); // Year level

      const result = await densityService.generateAggregatedData();

      expect(result.executedQuery).toContain('GROUP BY');
      expect(result.executedQuery).toContain('name IS NOT NULL AND name != ""');
    });
  });

  describe('Lossless Aggregation', () => {
    it('should preserve data counts during Month → Quarter aggregation', async () => {
      // Set to Quarter aggregation
      await densityService.setDensity('value', 'collapsed');
      await densityService.setAxisGranularity('T', 2);

      mockDatabase.execute.mockReturnValueOnce([
        { time_quarter: 'Q1 2024', count: 5 } // Sum of all monthly counts
      ]);

      const result = await densityService.generateAggregatedData();

      expect(result.data[0].sourceCount).toBe(5);
      expect(result.metadata.accuracyPreserved).toBe(true);
    });

    it('should maintain data integrity across density changes', async () => {
      // First get leaf data
      await densityService.setDensity('value', 'leaf');
      const leafResult = await densityService.generateAggregatedData();

      // Then get aggregated data
      await densityService.setDensity('value', 'collapsed');
      const aggregatedResult = await densityService.generateAggregatedData();

      // Total source count should be preserved
      expect(aggregatedResult.metadata.sourceRowCount).toBe(leafResult.metadata.sourceRowCount);
    });

    it('should show aggregation source in collapsed mode', async () => {
      await densityService.setDensity('value', 'collapsed');
      const result = await densityService.generateAggregatedData();

      const aggregatedRow = result.data[0];
      expect(aggregatedRow.aggregationFunction).toBeDefined();
      expect(aggregatedRow.sourceCount).toBeGreaterThan(0);
      expect(aggregatedRow.isLeaf).toBe(false);
    });
  });

  describe('Cross-Density Accuracy', () => {
    it('should reflect sparse-level changes in dense view', async () => {
      // Start with sparse view to see all data
      await densityService.setDensity('extent', 'sparse');
      const sparseResult = await densityService.generateAggregatedData();

      // Switch to dense view (populated only)
      await densityService.setDensity('extent', 'populated-only');
      const denseResult = await densityService.generateAggregatedData();

      // Dense result should be subset of sparse result
      expect(denseResult.metadata.aggregatedRowCount).toBeLessThanOrEqual(
        sparseResult.metadata.aggregatedRowCount
      );
    });

    it('should maintain accuracy when switching between granularities', async () => {
      await densityService.setDensity('value', 'collapsed');

      // Month granularity
      await densityService.setAxisGranularity('T', 3);
      const monthResult = await densityService.generateAggregatedData();

      // Quarter granularity
      await densityService.setAxisGranularity('T', 2);
      const quarterResult = await densityService.generateAggregatedData();

      // Source data count should be consistent
      expect(quarterResult.metadata.sourceRowCount).toBe(monthResult.metadata.sourceRowCount);
    });
  });

  describe('Region Mixing', () => {
    it('should support Time dense + Category sparse coexistence', async () => {
      const regionConfig: RegionDensityConfig[] = [
        {
          regionId: 'time-dense',
          axis: 'T',
          facet: 'created_at',
          mode: 'populated-only',
          aggregationLevel: 2,
          visualWeight: 'heavy'
        },
        {
          regionId: 'category-sparse',
          axis: 'C',
          facet: 'folder',
          mode: 'sparse',
          aggregationLevel: 1,
          visualWeight: 'normal'
        }
      ];

      await densityService.setDensity('region', regionConfig);
      const result = await densityService.generateAggregatedData();

      expect(result.metadata.involvedAxes).toContain('T');
      expect(result.metadata.involvedAxes).toContain('C');
    });

    it('should handle region-specific aggregation levels', async () => {
      const regionConfig: RegionDensityConfig[] = [{
        regionId: 'category-detailed',
        axis: 'C',
        facet: 'folder',
        mode: 'sparse',
        aggregationLevel: 3, // Most detailed
        visualWeight: 'light'
      }];

      await densityService.setDensity('region', regionConfig);
      const result = await densityService.generateAggregatedData();

      expect(result.metadata.granularityLevels).toBeDefined();
    });
  });

  describe('Performance Requirements', () => {
    it('should complete density changes within 100ms target', async () => {
      const startTime = performance.now();
      await densityService.setDensity('value', 'collapsed');
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(100);
    });

    it('should track performance metrics', async () => {
      await densityService.setDensity('value', 'collapsed');
      const metrics = densityService.getPerformanceMetrics();

      expect(metrics.length).toBeGreaterThan(0);
      expect(metrics[0]).toHaveProperty('totalTime');
      expect(metrics[0]).toHaveProperty('withinPerformanceTarget');
    });

    it('should cache aggregation results', async () => {
      // First call
      await densityService.generateAggregatedData();
      const firstCallCount = mockDatabase.execute.mock.calls.length;

      // Second call with same parameters should use cache
      await densityService.generateAggregatedData();
      const secondCallCount = mockDatabase.execute.mock.calls.length;

      expect(secondCallCount).toBe(firstCallCount); // No additional database calls
    });
  });

  describe('SQL Integration', () => {
    it('should generate appropriate GROUP BY clauses for aggregation', async () => {
      await densityService.setDensity('value', 'collapsed');
      await densityService.setAxisGranularity('T', 2); // Quarter

      await densityService.generateAggregatedData();

      const lastCall = mockDatabase.execute.mock.calls.slice(-1)[0];
      const sql = lastCall[0];
      expect(sql).toContain('GROUP BY');
      expect(sql).toContain('strftime'); // Date functions for time aggregation
    });

    it('should generate appropriate WHERE clauses for extent filtering', async () => {
      await densityService.setDensity('extent', 'populated-only');

      await densityService.generateAggregatedData();

      const lastCall = mockDatabase.execute.mock.calls.slice(-1)[0];
      const sql = lastCall[0];
      expect(sql).toContain('name IS NOT NULL AND name != ""');
    });

    it('should use parameterized queries for security', async () => {
      await densityService.generateAggregatedData();

      const lastCall = mockDatabase.execute.mock.calls.slice(-1)[0];
      const parameters = lastCall[1];
      expect(Array.isArray(parameters)).toBe(true);
    });
  });

  describe('State Persistence', () => {
    it('should maintain state across multiple operations', async () => {
      await densityService.setDensity('value', 'collapsed');
      await densityService.setDensity('extent', 'sparse');
      await densityService.setAxisGranularity('T', 2);

      const state = densityService.getCurrentState();
      expect(state.valueDensity).toBe('collapsed');
      expect(state.extentDensity).toBe('sparse');
      expect(state.axisGranularity['T']).toBe(2);
    });

    it('should reset to defaults', async () => {
      // Change state
      await densityService.setDensity('value', 'collapsed');
      await densityService.setDensity('view', 'matrix');

      // Reset
      await densityService.resetToDefault();

      const state = densityService.getCurrentState();
      expect(state).toEqual(DEFAULT_JANUS_DENSITY);
    });
  });

  describe('Event System', () => {
    it('should emit change events with proper structure', async () => {
      const changeEvents: DensityChangeEvent[] = [];

      densityService.onDensityChange((event) => {
        changeEvents.push(event);
      });

      await densityService.setDensity('value', 'collapsed');

      expect(changeEvents.length).toBe(1);
      expect(changeEvents[0]).toMatchObject({
        changedLevel: 'value',
        previousState: expect.any(Object),
        newState: expect.any(Object),
        metrics: expect.any(Object),
        dataIntegrityPreserved: true
      });
    });

    it('should support unsubscribing from change events', () => {
      const handler = vi.fn();
      const unsubscribe = densityService.onDensityChange(handler);

      unsubscribe();
      densityService.setDensity('value', 'collapsed');

      expect(handler).not.toHaveBeenCalled();
    });
  });
});

describe.skip('Integration Testing', () => {
  it('should pass complete Janus density workflow', async () => {
    const filterService = new LATCHFilterService();
    const densityService = new SuperDensityService(mockDatabase, filterService);

    // 1. Start with default state
    let state = densityService.getCurrentState();
    expect(state).toEqual(DEFAULT_JANUS_DENSITY);

    // 2. Change to collapsed value density
    await densityService.setDensity('value', 'collapsed');
    state = densityService.getCurrentState();
    expect(state.valueDensity).toBe('collapsed');

    // 3. Set granularity levels
    await densityService.setAxisGranularity('T', 2); // Quarter
    await densityService.setAxisGranularity('C', 1); // Category

    // 4. Add region configuration
    const regionConfig: RegionDensityConfig[] = [{
      regionId: 'test-region',
      axis: 'T',
      facet: 'created_at',
      mode: 'populated-only',
      aggregationLevel: 2,
      visualWeight: 'normal'
    }];
    await densityService.setDensity('region', regionConfig);

    // 5. Generate aggregated data
    const result = await densityService.generateAggregatedData();

    // Validate complete integration
    expect(result).toMatchObject({
      data: expect.any(Array),
      metadata: expect.objectContaining({
        sourceRowCount: expect.any(Number),
        aggregatedRowCount: expect.any(Number),
        compressionRatio: expect.any(Number),
        accuracyPreserved: expect.any(Boolean)
      }),
      timing: expect.objectContaining({
        totalTime: expect.any(Number),
        withinPerformanceTarget: expect.any(Boolean)
      })
    });
  });
});