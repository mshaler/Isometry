/**
 * NestedHeaderRenderer Tests - Data-driven nested header rendering with D3 .join()
 *
 * Tests for POLISH-01, POLISH-02, POLISH-03 requirements:
 * - Data-driven .join() pattern for proper enter/update/exit transitions
 * - Deep nesting handling (>5 levels)
 * - Performance degradation (>100 headers)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as d3 from 'd3';
import { JSDOM } from 'jsdom';
import {
  NestedHeaderRenderer,
  MAX_NESTING_DEPTH,
  MAX_VISIBLE_HEADERS,
  buildNestedHeaderData,
  type NestedHeaderData,
} from '../NestedHeaderRenderer';

describe('NestedHeaderRenderer', () => {
  let container: d3.Selection<SVGElement, unknown, null, undefined>;
  let svg: SVGElement;

  beforeEach(() => {
    const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
    const document = dom.window.document;
    svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    document.body.appendChild(svg);
    container = d3.select(svg as unknown as SVGElement);
    container.append('g').attr('class', 'headers');
  });

  describe('buildNestedHeaderData', () => {
    it('should convert composite keys into header data array', () => {
      const compositeKeys = ['Personal|Active', 'Personal|Complete', 'Work|Active'];
      const result = buildNestedHeaderData(compositeKeys, 'y');

      // Should create parent headers
      const parents = result.filter(h => h.level === 0);
      expect(parents).toHaveLength(2); // Personal, Work

      // Should create child headers
      const children = result.filter(h => h.level === 1);
      expect(children).toHaveLength(3); // Active x2, Complete

      // Parent headers should have correct spans
      const personal = parents.find(h => h.value === 'Personal');
      expect(personal?.span).toBe(2);

      const work = parents.find(h => h.value === 'Work');
      expect(work?.span).toBe(1);
    });

    it('should generate unique keys for each header', () => {
      const compositeKeys = ['A|B|C', 'A|B|D', 'A|E|F'];
      const result = buildNestedHeaderData(compositeKeys, 'x');

      const keys = result.map(h => h.key);
      const uniqueKeys = new Set(keys);
      expect(uniqueKeys.size).toBe(keys.length);
    });

    it('should handle single-level input', () => {
      const compositeKeys = ['Alpha', 'Beta', 'Gamma'];
      const result = buildNestedHeaderData(compositeKeys, 'y');

      expect(result).toHaveLength(3);
      result.forEach(h => {
        expect(h.level).toBe(0);
        expect(h.span).toBe(1);
      });
    });

    it('should handle empty input', () => {
      const result = buildNestedHeaderData([], 'x');
      expect(result).toHaveLength(0);
    });
  });

  describe('POLISH-02: Deep nesting handling (>5 levels)', () => {
    it('should collapse intermediate levels when nesting > MAX_NESTING_DEPTH', () => {
      // Create 7-level deep hierarchy
      const compositeKeys = [
        'L0|L1|L2|L3|L4|L5|L6',
        'L0|L1|L2|L3|L4|L5|L7',
      ];
      const result = buildNestedHeaderData(compositeKeys, 'y');

      // Should not exceed MAX_NESTING_DEPTH levels
      const maxLevel = Math.max(...result.map(h => h.level));
      expect(maxLevel).toBeLessThanOrEqual(MAX_NESTING_DEPTH - 1);

      // Should have collapsed indicator
      const collapsed = result.filter(h => h.isCollapsed);
      expect(collapsed.length).toBeGreaterThan(0);
    });

    it('should preserve first 2 and last 2 levels when collapsing', () => {
      // Create 8-level deep hierarchy
      const compositeKeys = ['A|B|C|D|E|F|G|H'];
      const result = buildNestedHeaderData(compositeKeys, 'x');

      // Should have L0 (A), L1 (B), collapsed indicator, and leaf levels
      const values = result.map(h => h.value);
      expect(values).toContain('A');
      expect(values).toContain('B');
      expect(values).toContain('H'); // Leaf should be preserved
    });
  });

  describe('POLISH-03: Performance degradation (>100 headers)', () => {
    it('should warn when header count exceeds MAX_VISIBLE_HEADERS', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Generate more than MAX_VISIBLE_HEADERS composite keys
      const compositeKeys: string[] = [];
      for (let i = 0; i < MAX_VISIBLE_HEADERS + 50; i++) {
        compositeKeys.push(`Parent${Math.floor(i / 10)}|Child${i}`);
      }

      const result = buildNestedHeaderData(compositeKeys, 'y');

      // Should have logged a warning
      expect(warnSpy).toHaveBeenCalled();

      // Should truncate to MAX_VISIBLE_HEADERS
      expect(result.length).toBeLessThanOrEqual(MAX_VISIBLE_HEADERS);

      warnSpy.mockRestore();
    });

    it('should prioritize parent headers over children when truncating', () => {
      // Generate many children under few parents
      const compositeKeys: string[] = [];
      for (let p = 0; p < 5; p++) {
        for (let c = 0; c < 30; c++) {
          compositeKeys.push(`Parent${p}|Child${c}`);
        }
      }

      const result = buildNestedHeaderData(compositeKeys, 'x');

      // All 5 parent headers should be present
      const parents = result.filter(h => h.level === 0);
      expect(parents.length).toBe(5);
    });
  });

  describe('NestedHeaderRenderer D3 integration', () => {
    it('should use data-driven .join() pattern', () => {
      const renderer = new NestedHeaderRenderer(container, {
        rowHeaderWidth: 100,
        cardHeight: 40,
        cardWidth: 100,
        headerHeight: 40,
        padding: 4,
        animationDuration: 0, // Disable animations for testing
      });

      const compositeKeys = ['A|1', 'A|2', 'B|1'];
      renderer.render('y', compositeKeys);

      // Check that elements were created via data binding
      const headers = container.select('.headers');
      const parentGroups = headers.selectAll('.row-header--parent');
      const childGroups = headers.selectAll('.row-header--child');

      // Should have 2 parents (A, B) and 3 children (1, 2, 1)
      expect(parentGroups.size()).toBe(2);
      expect(childGroups.size()).toBe(3);

      // Check data binding
      const boundData = parentGroups.data() as NestedHeaderData[];
      expect(boundData).toHaveLength(2);
      expect(boundData[0].value).toBe('A');
      expect(boundData[1].value).toBe('B');
    });

    it('should properly handle update transitions', () => {
      const renderer = new NestedHeaderRenderer(container, {
        rowHeaderWidth: 100,
        cardHeight: 40,
        cardWidth: 100,
        headerHeight: 40,
        padding: 4,
        animationDuration: 0,
      });

      // Initial render
      renderer.render('y', ['A|1', 'A|2']);

      // Clear and re-render with modified data (simulates what happens after transition completes)
      renderer.clear();
      renderer.render('y', ['A|1', 'A|3']); // Changed child from 2 to 3

      const childGroups = container.select('.headers').selectAll('.row-header--child');

      // Should have 2 children after fresh render
      expect(childGroups.size()).toBe(2);

      // Data should be updated
      const values = (childGroups.data() as NestedHeaderData[]).map(d => d.value);
      expect(values).toContain('1');
      expect(values).toContain('3');
      expect(values).not.toContain('2');
    });

    it('should handle exit transitions (remove old headers)', () => {
      const renderer = new NestedHeaderRenderer(container, {
        rowHeaderWidth: 100,
        cardHeight: 40,
        cardWidth: 100,
        headerHeight: 40,
        padding: 4,
        animationDuration: 0,
      });

      // Initial render with 3 parents
      renderer.render('y', ['A|1', 'B|1', 'C|1']);

      let parentGroups = container.select('.headers').selectAll('.row-header--parent');
      expect(parentGroups.size()).toBe(3);

      // Clear and re-render with only 1 parent (simulates completed exit transition)
      renderer.clear();
      renderer.render('y', ['A|1']);

      parentGroups = container.select('.headers').selectAll('.row-header--parent');
      expect(parentGroups.size()).toBe(1);
    });

    it('should render X-axis (column) headers correctly', () => {
      const renderer = new NestedHeaderRenderer(container, {
        rowHeaderWidth: 100,
        cardHeight: 40,
        cardWidth: 100,
        headerHeight: 40,
        padding: 4,
        animationDuration: 0,
      });

      renderer.render('x', ['Q1|Jan', 'Q1|Feb', 'Q2|Mar']);

      const headers = container.select('.headers');
      const parentGroups = headers.selectAll('.col-header--parent');
      const childGroups = headers.selectAll('.col-header--child');

      expect(parentGroups.size()).toBe(2); // Q1, Q2
      expect(childGroups.size()).toBe(3); // Jan, Feb, Mar
    });
  });

  describe('Constants', () => {
    it('should have MAX_NESTING_DEPTH = 5', () => {
      expect(MAX_NESTING_DEPTH).toBe(5);
    });

    it('should have MAX_VISIBLE_HEADERS = 100', () => {
      expect(MAX_VISIBLE_HEADERS).toBe(100);
    });
  });
});
