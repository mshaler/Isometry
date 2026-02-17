/**
 * ForceSimulationManager Tests
 *
 * Unit tests for force simulation lifecycle management.
 * Tests state transitions, cleanup, and callback behavior.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ForceSimulationManager } from '../visualizations/network/ForceSimulationManager';
import type { GraphNode, GraphLink, ForceGraphConfig } from '../visualizations/network/types';
import { DEFAULT_FORCE_CONFIG } from '../visualizations/network/types';

// ============================================================================
// Test Data
// ============================================================================

const createTestNodes = (): GraphNode[] => [
  { id: 'a', label: 'Node A', group: 'test' },
  { id: 'b', label: 'Node B', group: 'test' },
  { id: 'c', label: 'Node C', group: 'test' },
];

const createTestLinks = (): GraphLink[] => [
  { source: 'a', target: 'b', type: 'LINK', weight: 1 },
  { source: 'b', target: 'c', type: 'NEST', weight: 1 },
];

const createTestConfig = (overrides: Partial<ForceGraphConfig> = {}): ForceGraphConfig => ({
  ...DEFAULT_FORCE_CONFIG,
  width: 400,
  height: 300,
  ...overrides,
});

// ============================================================================
// Test Setup
// ============================================================================

let svg: SVGSVGElement;
let container: SVGGElement;
let manager: ForceSimulationManager;

beforeEach(() => {
  // Create SVG container in JSDOM
  svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  container = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  svg.appendChild(container);
  document.body.appendChild(svg);

  // Create fresh manager
  manager = new ForceSimulationManager();
});

afterEach(() => {
  // Cleanup
  manager.destroy();
  document.body.removeChild(svg);
});

// ============================================================================
// Tests
// ============================================================================

describe('ForceSimulationManager', () => {
  describe('initial state', () => {
    it('starts with stopped state', () => {
      expect(manager.getState()).toBe('stopped');
    });
  });

  describe('start()', () => {
    it('transitions to running on start()', () => {
      const nodes = createTestNodes();
      const links = createTestLinks();
      const config = createTestConfig();

      manager.start(container, nodes, links, config);

      expect(manager.getState()).toBe('running');
    });

    it('accepts empty links array', () => {
      const nodes = createTestNodes();
      const config = createTestConfig();

      manager.start(container, nodes, [], config);

      expect(manager.getState()).toBe('running');
    });

    it('destroys previous simulation before starting new one', () => {
      const nodes1 = createTestNodes();
      const nodes2 = [{ id: 'x', label: 'Node X', group: 'other' }];
      const config = createTestConfig();

      manager.start(container, nodes1, [], config);
      expect(manager.getState()).toBe('running');

      // Start new simulation should not throw
      manager.start(container, nodes2, [], config);
      expect(manager.getState()).toBe('running');
    });
  });

  describe('stop()', () => {
    it('transitions to stopped on stop()', () => {
      const nodes = createTestNodes();
      const config = createTestConfig();

      manager.start(container, nodes, [], config);
      expect(manager.getState()).toBe('running');

      manager.stop();
      expect(manager.getState()).toBe('stopped');
    });

    it('is idempotent (multiple stops are safe)', () => {
      const nodes = createTestNodes();
      const config = createTestConfig();

      manager.start(container, nodes, [], config);
      manager.stop();
      manager.stop();
      manager.stop();

      expect(manager.getState()).toBe('stopped');
    });
  });

  describe('reheat()', () => {
    it('reheats simulation with default alpha', () => {
      const nodes = createTestNodes();
      const config = createTestConfig();

      manager.start(container, nodes, [], config);
      manager.stop();

      // After stop, state should be stopped
      expect(manager.getState()).toBe('stopped');

      // Restart and then stop to test reheat
      manager.start(container, nodes, [], config);

      // Reheat while running should maintain running state
      manager.reheat(0.5);
      expect(manager.getState()).toBe('running');
    });

    it('ignores reheat when stopped', () => {
      const nodes = createTestNodes();
      const config = createTestConfig();

      // Start then stop
      manager.start(container, nodes, [], config);
      manager.stop();

      // Reheat when stopped should be no-op
      manager.reheat(0.5);
      expect(manager.getState()).toBe('stopped');
    });

    it('ignores reheat when never started', () => {
      manager.reheat(0.5);
      expect(manager.getState()).toBe('stopped');
    });
  });

  describe('destroy()', () => {
    it('cleans up DOM on destroy()', () => {
      const nodes = createTestNodes();
      const config = createTestConfig();

      manager.start(container, nodes, [], config);

      // Verify something is rendered (D3 may not render immediately in JSDOM)
      manager.destroy();

      // After destroy, container should be empty
      expect(container.children.length).toBe(0);
    });

    it('nullifies references on destroy()', () => {
      const nodes = createTestNodes();
      const config = createTestConfig();

      manager.start(container, nodes, [], config);
      manager.destroy();

      // Calling methods after destroy should be safe (no errors)
      expect(() => manager.stop()).not.toThrow();
      expect(() => manager.reheat()).not.toThrow();
      expect(manager.getState()).toBe('stopped');
    });

    it('is idempotent (multiple destroys are safe)', () => {
      const nodes = createTestNodes();
      const config = createTestConfig();

      manager.start(container, nodes, [], config);
      manager.destroy();
      manager.destroy();
      manager.destroy();

      expect(manager.getState()).toBe('stopped');
    });
  });

  describe('callbacks', () => {
    it('calls onTick callback during simulation', async () => {
      const nodes = createTestNodes();
      const config = createTestConfig({ maxTicks: 5, maxTime: 5000 });
      const onTick = vi.fn();

      manager.start(container, nodes, [], config, { onTick });

      // Wait for simulation ticks
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(onTick).toHaveBeenCalled();
      expect(onTick.mock.calls[0][0]).toEqual(expect.arrayContaining([
        expect.objectContaining({ id: 'a' }),
        expect.objectContaining({ id: 'b' }),
        expect.objectContaining({ id: 'c' }),
      ]));
    });

    it('calls onEnd callback when simulation stops', async () => {
      const nodes = createTestNodes();
      // Very low maxTicks to trigger auto-stop quickly
      const config = createTestConfig({ maxTicks: 3, maxTime: 5000 });
      const onEnd = vi.fn();

      manager.start(container, nodes, [], config, { onEnd });

      // Wait for auto-stop
      await new Promise((resolve) => setTimeout(resolve, 150));

      expect(onEnd).toHaveBeenCalled();
      expect(manager.getState()).toBe('stopped');
    });
  });

  describe('auto-stop', () => {
    it('auto-stops after maxTicks', async () => {
      const nodes = createTestNodes();
      const config = createTestConfig({ maxTicks: 5, maxTime: 10000 });

      manager.start(container, nodes, [], config);

      // Wait for enough ticks
      await new Promise((resolve) => setTimeout(resolve, 200));

      expect(manager.getState()).toBe('stopped');
    });
  });

  describe('node position control', () => {
    it('updateNodePosition sets fx/fy on node', () => {
      const nodes = createTestNodes();
      const config = createTestConfig();

      manager.start(container, nodes, [], config);
      manager.updateNodePosition('a', 100, 200);

      const nodeA = nodes.find((n) => n.id === 'a');
      expect(nodeA?.fx).toBe(100);
      expect(nodeA?.fy).toBe(200);
    });

    it('releaseNode clears fx/fy on node', () => {
      const nodes = createTestNodes();
      const config = createTestConfig();

      manager.start(container, nodes, [], config);
      manager.updateNodePosition('a', 100, 200);
      manager.releaseNode('a');

      const nodeA = nodes.find((n) => n.id === 'a');
      expect(nodeA?.fx).toBeNull();
      expect(nodeA?.fy).toBeNull();
    });
  });

  describe('memory leak prevention', () => {
    it('no memory leaks after 10 consecutive creates/destroys', () => {
      const nodes = createTestNodes();
      const config = createTestConfig();

      // Create and destroy 10 times
      for (let i = 0; i < 10; i++) {
        manager.start(container, nodes, [], config);
        manager.destroy();
      }

      // Final state should be clean
      expect(manager.getState()).toBe('stopped');
      expect(container.children.length).toBe(0);
    });
  });
});
