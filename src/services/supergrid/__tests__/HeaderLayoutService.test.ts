/**
 * HeaderLayoutService tests - Stacked hierarchy generation
 *
 * Tests for multi-facet (stacked) axis hierarchies that produce
 * Excel-style pivot table headers with correct parent-child spanning.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { HeaderLayoutService } from '../HeaderLayoutService';
import type { StackedAxisConfig } from '../../../types/pafv';

describe('HeaderLayoutService.generateStackedHierarchy', () => {
  let service: HeaderLayoutService;

  beforeEach(() => {
    service = new HeaderLayoutService();
  });

  it('generates two-level hierarchy from Year -> Quarter facets', () => {
    const cards = [
      { year: '2024', quarter: 'Q1' },
      { year: '2024', quarter: 'Q2' },
      { year: '2023', quarter: 'Q4' },
    ];

    const config: StackedAxisConfig = {
      axis: 'time',
      facets: ['year', 'quarter']
    };

    const hierarchy = service.generateStackedHierarchy(cards, config);

    // Root + 2 years + 3 quarters = 6 nodes
    expect(hierarchy.allNodes.length).toBe(6);
    expect(hierarchy.maxDepth).toBe(2);

    // 2024 should have span of 2 (Q1 + Q2)
    const year2024 = hierarchy.allNodes.find(n => n.id.includes('year-2024'));
    expect(year2024?.span).toBe(2);

    // 2023 should have span of 1 (Q4 only)
    const year2023 = hierarchy.allNodes.find(n => n.id.includes('year-2023'));
    expect(year2023?.span).toBe(1);
  });

  // STACK-02 VERIFICATION: Parent header cells visually span across their child headers
  it('verifies STACK-02: parent span equals sum of child spans', () => {
    const cards = [
      { category: 'A', subcategory: 'A1' },
      { category: 'A', subcategory: 'A2' },
      { category: 'A', subcategory: 'A3' },
      { category: 'B', subcategory: 'B1' },
    ];

    const config: StackedAxisConfig = {
      axis: 'category',
      facets: ['category', 'subcategory']
    };

    const hierarchy = service.generateStackedHierarchy(cards, config);

    // Find parent nodes (level 1) and verify their spans
    const parentNodes = hierarchy.allNodes.filter(n => n.level === 1);

    parentNodes.forEach(parent => {
      // Find children of this parent
      const children = hierarchy.allNodes.filter(n => n.parentId === parent.id);
      const sumOfChildSpans = children.reduce((sum, child) => sum + (child.span || 0), 0);

      // STACK-02 REQUIREMENT: parent.span === sum(child.span)
      expect(parent.span).toBe(sumOfChildSpans);
    });

    // Explicit assertions for clarity
    const catA = hierarchy.allNodes.find(n => n.id.includes('category-A'));
    const catB = hierarchy.allNodes.find(n => n.id.includes('category-B'));

    expect(catA?.span).toBe(3); // A1(1) + A2(1) + A3(1) = 3
    expect(catB?.span).toBe(1); // B1(1) = 1
  });

  it('handles single-facet gracefully (backwards compatible)', () => {
    const cards = [{ status: 'todo' }, { status: 'done' }];

    const config: StackedAxisConfig = {
      axis: 'category',
      facets: ['status'] // Single facet
    };

    const hierarchy = service.generateStackedHierarchy(cards, config);

    expect(hierarchy.maxDepth).toBe(1);
    expect(hierarchy.allNodes.filter(n => n.level === 1).length).toBe(2);
  });

  it('generates three-level hierarchy from Year -> Quarter -> Month', () => {
    const cards = [
      { year: '2024', quarter: 'Q1', month: 'Jan' },
      { year: '2024', quarter: 'Q1', month: 'Feb' },
      { year: '2024', quarter: 'Q1', month: 'Mar' },
      { year: '2024', quarter: 'Q2', month: 'Apr' },
    ];

    const config: StackedAxisConfig = {
      axis: 'time',
      facets: ['year', 'quarter', 'month']
    };

    const hierarchy = service.generateStackedHierarchy(cards, config);

    // Root + 1 year + 2 quarters + 4 months = 8 nodes
    expect(hierarchy.allNodes.length).toBe(8);
    expect(hierarchy.maxDepth).toBe(3);

    // Year 2024 should have span of 4 (all 4 months)
    const year2024 = hierarchy.allNodes.find(n => n.id.includes('year-2024'));
    expect(year2024?.span).toBe(4);

    // Q1 should have span of 3 (Jan, Feb, Mar)
    const q1 = hierarchy.allNodes.find(n => n.id.includes('quarter-Q1'));
    expect(q1?.span).toBe(3);

    // Q2 should have span of 1 (Apr only)
    const q2 = hierarchy.allNodes.find(n => n.id.includes('quarter-Q2'));
    expect(q2?.span).toBe(1);
  });

  it('handles null/undefined facet values gracefully', () => {
    const cards = [
      { category: 'A', subcategory: 'A1' },
      { category: 'A', subcategory: null },
      { category: 'B' }, // subcategory undefined
    ];

    const config: StackedAxisConfig = {
      axis: 'category',
      facets: ['category', 'subcategory']
    };

    const hierarchy = service.generateStackedHierarchy(cards, config);

    // Should have root + 2 categories + 1 subcategory (A1)
    // Null/undefined values are excluded from unique values
    expect(hierarchy.allNodes.length).toBe(4);

    const catA = hierarchy.allNodes.find(n => n.id.includes('category-A'));
    expect(catA).toBeDefined();
    expect(catA?.span).toBe(1); // Only A1 as child
  });

  it('produces correct rootNodes (direct children of root)', () => {
    const cards = [
      { region: 'North', city: 'NYC' },
      { region: 'South', city: 'Miami' },
    ];

    const config: StackedAxisConfig = {
      axis: 'location',
      facets: ['region', 'city']
    };

    const hierarchy = service.generateStackedHierarchy(cards, config);

    // rootNodes should be the two regions (level 1)
    expect(hierarchy.rootNodes.length).toBe(2);
    expect(hierarchy.rootNodes.every(n => n.level === 1)).toBe(true);
    expect(hierarchy.rootNodes.map(n => n.label).sort()).toEqual(['North', 'South']);
  });

  it('assigns correct parentId to each node', () => {
    const cards = [
      { dept: 'Engineering', team: 'Frontend' },
      { dept: 'Engineering', team: 'Backend' },
      { dept: 'Design', team: 'UX' },
    ];

    const config: StackedAxisConfig = {
      axis: 'hierarchy',
      facets: ['dept', 'team']
    };

    const hierarchy = service.generateStackedHierarchy(cards, config);

    // Check Frontend's parent is Engineering
    const frontend = hierarchy.allNodes.find(n => n.id.includes('team-Frontend'));
    expect(frontend?.parentId).toBe('hierarchy-dept-Engineering');

    // Check Engineering's parent is root
    const engineering = hierarchy.allNodes.find(n => n.id.includes('dept-Engineering'));
    expect(engineering?.parentId).toBe('hierarchy-root');

    // Check UX's parent is Design
    const ux = hierarchy.allNodes.find(n => n.id.includes('team-UX'));
    expect(ux?.parentId).toBe('hierarchy-dept-Design');
  });

  it('sets correct facet field on each node', () => {
    const cards = [
      { status: 'active', priority: 'high' },
      { status: 'active', priority: 'low' },
    ];

    const config: StackedAxisConfig = {
      axis: 'category',
      facets: ['status', 'priority']
    };

    const hierarchy = service.generateStackedHierarchy(cards, config);

    // Level 1 nodes should have facet = 'status'
    const statusNodes = hierarchy.allNodes.filter(n => n.level === 1);
    expect(statusNodes.every(n => n.facet === 'status')).toBe(true);

    // Level 2 nodes should have facet = 'priority'
    const priorityNodes = hierarchy.allNodes.filter(n => n.level === 2);
    expect(priorityNodes.every(n => n.facet === 'priority')).toBe(true);
  });
});
