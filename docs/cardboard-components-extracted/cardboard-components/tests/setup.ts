/**
 * Test setup for CardBoard components
 * Configures jsdom environment and global test utilities
 */

import { vi } from 'vitest';

// Mock requestAnimationFrame for D3 transitions
global.requestAnimationFrame = (callback: FrameRequestCallback): number => {
  return setTimeout(() => callback(Date.now()), 16) as unknown as number;
};

global.cancelAnimationFrame = (id: number): void => {
  clearTimeout(id);
};

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Helper to create a container element
export function createTestContainer(): HTMLElement {
  const container = document.createElement('div');
  container.id = 'test-container';
  document.body.appendChild(container);
  return container;
}

// Helper to cleanup after tests
export function cleanupTestContainer(): void {
  const container = document.getElementById('test-container');
  if (container) {
    container.remove();
  }
}

// Helper to wait for D3 transitions to complete
export function waitForTransition(ms: number = 350): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Helper to create mock CardValue data
export function createMockNode(overrides: Partial<import('./src/components/types').NodeValue> = {}): import('./src/components/types').NodeValue {
  return {
    id: `node-${Math.random().toString(36).slice(2, 9)}`,
    type: 'node',
    nodeType: 'Task',
    name: 'Test Node',
    content: 'Test content',
    createdAt: new Date(),
    updatedAt: new Date(),
    properties: {},
    latch: {},
    ...overrides,
  };
}

export function createMockEdge(overrides: Partial<import('./src/components/types').EdgeValue> = {}): import('./src/components/types').EdgeValue {
  return {
    id: `edge-${Math.random().toString(36).slice(2, 9)}`,
    type: 'edge',
    edgeType: 'LINK',
    sourceId: 'source-1',
    targetId: 'target-1',
    directed: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    properties: {},
    latch: {},
    ...overrides,
  };
}
