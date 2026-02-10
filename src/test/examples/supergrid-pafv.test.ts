/**
 * SuperGrid PAFV Projection Tests
 *
 * Tests the core PAFV (Planes → Axes → Facets → Values) system
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import type { Database } from 'sql.js-fts5';
import {
  createTestDB,
  cleanupTestDB,
  execTestQuery,
} from '../db-utils';
import { loadTestFixtures } from '../fixtures';

// Types for PAFV testing
interface PAFVProjection {
  planes: {
    x: 'L' | 'A' | 'T' | 'C' | 'H';
    y: 'L' | 'A' | 'T' | 'C' | 'H';
    z?: 'L' | 'A' | 'T' | 'C' | 'H';
  };
  facets: {
    [axis: string]: string; // axis -> facet mapping
  };
}

describe('SuperGrid PAFV Projection', () => {
  let db: Database;

  beforeEach(async () => {
    db = await createTestDB();
    await loadTestFixtures(db);
  });

  afterEach(async () => {
    await cleanupTestDB(db);
  });

  test('should map LATCH dimensions to grid axes', () => {
    // Arrange: Define PAFV projection
    const projection: PAFVProjection = {
      planes: { x: 'C', y: 'H' }, // Category × Hierarchy
      facets: { C: 'folder', H: 'priority' },
    };

    // Act: Query data grouped by projection axes
    const gridData = execTestQuery(db, `
      SELECT
        folder as x_value,
        priority as y_value,
        COUNT(*) as cell_count,
        GROUP_CONCAT(id) as node_ids,
        GROUP_CONCAT(name) as node_names
      FROM nodes
      WHERE deleted_at IS NULL
      GROUP BY folder, priority
      ORDER BY folder, priority DESC
    `);

    // Assert: Grid structure is correct
    expect(gridData.length).toBeGreaterThan(0);

    // Assert: Each cell has the expected structure
    gridData.forEach(cell => {
      expect(cell.x_value).toBeDefined(); // folder
      expect(cell.y_value).toBeGreaterThan(0); // priority
      expect(cell.cell_count).toBeGreaterThan(0);
      expect(cell.node_ids).toBeDefined();
    });

    // Assert: Verify specific projection properties
    const folders = [...new Set(gridData.map(cell => cell.x_value))];
    const priorities = [...new Set(gridData.map(cell => cell.y_value))];

    expect(folders).toContain('work');
    expect(folders).toContain('personal');
    expect(priorities).toContain(5); // High priority exists
  });

  test('should support axis remapping (view transitions)', () => {
    // Arrange: Original projection (Category × Hierarchy)
    const originalProjection = { x: 'folder', y: 'priority' };

    // Act: Query with original projection
    const originalData = execTestQuery(db, `
      SELECT folder, priority, COUNT(*) as count
      FROM nodes
      WHERE deleted_at IS NULL
      GROUP BY folder, priority
    `);

    // Arrange: New projection (Time × Category) - same data, different view
    const newProjection = { x: 'created_date', y: 'folder' };

    // Act: Query with new projection (view transition)
    const transitionedData = execTestQuery(db, `
      SELECT
        DATE(created_at) as created_date,
        folder,
        COUNT(*) as count
      FROM nodes
      WHERE deleted_at IS NULL
      GROUP BY DATE(created_at), folder
      ORDER BY created_date DESC, folder
    `);

    // Assert: Both projections contain the same underlying data
    const originalTotal = originalData.reduce((sum, row) => sum + (row.count as number), 0);
    const transitionedTotal = transitionedData.reduce((sum, row) => sum + (row.count as number), 0);

    expect(originalTotal).toBe(transitionedTotal);

    // Assert: Transition preserved all nodes, just reorganized them
    expect(transitionedData.length).toBeGreaterThan(0);
    transitionedData.forEach(cell => {
      expect(cell.created_date).toBeDefined();
      expect(cell.folder).toBeDefined();
      expect(cell.count).toBeGreaterThan(0);
    });
  });

  test('should handle three-dimensional PAFV projections', () => {
    // Arrange: 3D projection (Category × Hierarchy × Time)
    const projection3D: PAFVProjection = {
      planes: { x: 'C', y: 'H', z: 'T' },
      facets: { C: 'folder', H: 'priority', T: 'created_month' },
    };

    // Act: Query 3D projection data
    const grid3DData = execTestQuery(db, `
      SELECT
        folder as x_value,
        priority as y_value,
        strftime('%Y-%m', created_at) as z_value,
        COUNT(*) as cell_count,
        AVG(importance) as avg_importance,
        GROUP_CONCAT(id) as node_ids
      FROM nodes
      WHERE deleted_at IS NULL
      GROUP BY folder, priority, strftime('%Y-%m', created_at)
      ORDER BY folder, priority DESC, z_value DESC
    `);

    // Assert: 3D structure is valid
    expect(grid3DData.length).toBeGreaterThan(0);

    // Assert: Each cell has 3D coordinates
    grid3DData.forEach(cell => {
      expect(cell.x_value).toBeDefined(); // folder
      expect(cell.y_value).toBeGreaterThan(0); // priority
      expect(cell.z_value).toMatch(/^\d{4}-\d{2}$/); // YYYY-MM format
      expect(cell.cell_count).toBeGreaterThan(0);
    });

    // Assert: Z-axis (time) provides meaningful grouping
    const months = [...new Set(grid3DData.map(cell => cell.z_value))];
    expect(months.length).toBeGreaterThan(0);
  });
});
