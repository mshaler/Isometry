/**
 * D3 Optimization Utilities
 *
 * Performance optimization utilities for D3 visualizations to handle large datasets
 * efficiently with Level of Detail (LOD), viewport culling, and progressive rendering.
 */

import * as d3 from 'd3';

// Optimization configuration
export interface OptimizationConfig {
  /** Maximum number of elements to render at full detail */
  maxHighDetailElements: number;
  /** Viewport culling bounds margin */
  viewportMargin: number;
  /** Progressive rendering chunk size */
  progressiveChunkSize: number;
  /** Level of Detail transition thresholds */
  lodThresholds: {
    medium: number;
    low: number;
  };
  /** Enable aggressive optimizations */
  aggressiveMode: boolean;
}

export const DEFAULT_OPTIMIZATION_CONFIG: OptimizationConfig = {
  maxHighDetailElements: 1000,
  viewportMargin: 100,
  progressiveChunkSize: 100,
  lodThresholds: {
    medium: 2000,
    low: 5000
  },
  aggressiveMode: false
};

// Virtual scrolling renderer for large lists
export interface VirtualScrollConfig {
  itemHeight: number;
  containerHeight: number;
  bufferSize: number;
  enableDynamicHeight: boolean;
}

export class VirtualScrollRenderer<T> {
  private data: T[] = [];
  private visibleIndices: { start: number; end: number } = { start: 0, end: 0 };
  private scrollTop = 0;
  private totalHeight = 0;
  private itemHeights: number[] = [];

  constructor(
    private container: d3.Selection<any, any, any, any>,
    private config: VirtualScrollConfig
  ) {
    this.setupScrollListener();
  }

  setData(data: T[]): void {
    this.data = data;
    this.itemHeights = new Array(data.length).fill(this.config.itemHeight);
    this.totalHeight = data.length * this.config.itemHeight;
    this.updateVisibleRange();
  }

  private setupScrollListener(): void {
    this.container.on('scroll', () => {
      this.scrollTop = (this.container.node() as any)?.scrollTop || 0;
      this.updateVisibleRange();
    });
  }

  private updateVisibleRange(): void {
    const startIndex = Math.floor(this.scrollTop / this.config.itemHeight);
    const visibleCount = Math.ceil(this.config.containerHeight / this.config.itemHeight);

    this.visibleIndices = {
      start: Math.max(0, startIndex - this.config.bufferSize),
      end: Math.min(this.data.length, startIndex + visibleCount + this.config.bufferSize)
    };
  }

  render(renderFn: (selection: d3.Selection<any, T, any, any>, index: number) => void): void {
    const visibleData = this.data.slice(this.visibleIndices.start, this.visibleIndices.end);

    // Set container height to maintain scroll position
    this.container
      .style('height', `${this.totalHeight}px`)
      .style('position', 'relative');

    // Render visible items
    const items = this.container
      .selectAll('.virtual-item')
      .data(visibleData, (_d, i) => `${this.visibleIndices.start + i}`);

    items.exit().remove();

    const itemsEnter = items.enter()
      .append('div')
      .classed('virtual-item', true)
      .style('position', 'absolute')
      .style('width', '100%');

    const itemsUpdate = itemsEnter.merge(items as unknown as d3.Selection<HTMLDivElement, T, any, any>);

    itemsUpdate
      .style('top', (_d, i) => `${(this.visibleIndices.start + i) * this.config.itemHeight}px`)
      .style('height', `${this.config.itemHeight}px`)
      .each((_d, i, nodes) => {
        renderFn(d3.select(nodes[i]), this.visibleIndices.start + i);
      });
  }

  updateItemHeight(index: number, height: number): void {
    if (this.config.enableDynamicHeight) {
      this.itemHeights[index] = height;
      this.recalculateHeights();
    }
  }

  private recalculateHeights(): void {
    this.totalHeight = this.itemHeights.reduce((sum, height) => sum + height, 0);
  }

  getVisibleIndices(): { start: number; end: number } {
    return { ...this.visibleIndices };
  }

  scrollToIndex(index: number): void {
    const targetScrollTop = index * this.config.itemHeight;
    (this.container.node() as any)?.scrollTo({ top: targetScrollTop, behavior: 'smooth' });
  }
}

// Level of Detail (LOD) manager
export class LevelOfDetailManager {
  private currentLOD: 'high' | 'medium' | 'low' = 'high';

  constructor(private config: OptimizationConfig) {}

  determineLOD(elementCount: number, performanceScore: number): 'high' | 'medium' | 'low' {
    // Performance-based LOD adjustment
    if (performanceScore < 50 || elementCount > this.config.lodThresholds.low) {
      return 'low';
    } else if (performanceScore < 70 || elementCount > this.config.lodThresholds.medium) {
      return 'medium';
    }
    return 'high';
  }

  applyLOD<T>(
    selection: d3.Selection<any, T, any, any>,
    lod: 'high' | 'medium' | 'low' = this.currentLOD
  ): d3.Selection<any, T, any, any> {
    this.currentLOD = lod;

    switch (lod) {
      case 'high':
        return selection
          .style('opacity', 1)
          .attr('class', (_d, i, nodes) => {
            const existing = d3.select(nodes[i]).attr('class') || '';
            return existing.replace(/\s*lod-\w+/g, '') + ' lod-high';
          });

      case 'medium':
        return selection
          .style('opacity', 0.8)
          .attr('class', (_d, i, nodes) => {
            const existing = d3.select(nodes[i]).attr('class') || '';
            return existing.replace(/\s*lod-\w+/g, '') + ' lod-medium';
          })
          .style('stroke-width', '1px'); // Reduce stroke width for performance

      case 'low':
        return selection
          .style('opacity', 0.6)
          .attr('class', (_d, i, nodes) => {
            const existing = d3.select(nodes[i]).attr('class') || '';
            return existing.replace(/\s*lod-\w+/g, '') + ' lod-low';
          })
          .style('stroke-width', '0.5px')
          .style('fill', '#999'); // Simplified coloring

      default:
        return selection;
    }
  }

  shouldSkipElement(_index: number, _total: number, lod: 'high' | 'medium' | 'low'): boolean {
    if (lod === 'high') return false;

    const skipRatio = lod === 'medium' ? 0.1 : 0.3;
    return Math.random() < skipRatio;
  }

  getCurrentLOD(): 'high' | 'medium' | 'low' {
    return this.currentLOD;
  }
}

// Viewport culling for off-screen elements
export class ViewportCuller {
  private viewport: DOMRect | null = null;

  updateViewport(containerElement: Element): void {
    this.viewport = containerElement.getBoundingClientRect();
  }

  isInViewport(elementBounds: DOMRect, margin: number = 0): boolean {
    if (!this.viewport) return true;

    return !(
      elementBounds.right + margin < this.viewport.left ||
      elementBounds.left - margin > this.viewport.right ||
      elementBounds.bottom + margin < this.viewport.top ||
      elementBounds.top - margin > this.viewport.bottom
    );
  }

  cullSelection<T>(
    selection: d3.Selection<any, T, any, any>,
    margin: number = 0
  ): d3.Selection<any, T, any, any> {
    return selection.style('display', (_d, i, nodes) => {
      const element = nodes[i] as Element;
      const bounds = element.getBoundingClientRect();
      return this.isInViewport(bounds, margin) ? null : 'none';
    });
  }
}

// Progressive rendering for large datasets
export class ProgressiveRenderer<T> {
  private renderQueue: T[] = [];
  private currentChunk = 0;
  private isRendering = false;
  private animationFrameId: number | null = null;

  constructor(
    private chunkSize: number = 100,
    private onProgress?: (progress: number) => void
  ) {}

  render(
    data: T[],
    _container: d3.Selection<any, any, any, any>,
    renderFn: (chunk: T[], chunkIndex: number) => void
  ): Promise<void> {
    return new Promise((resolve) => {
      this.renderQueue = [...data];
      this.currentChunk = 0;
      this.isRendering = true;

      const processChunk = () => {
        if (!this.isRendering || this.renderQueue.length === 0) {
          this.isRendering = false;
          resolve();
          return;
        }

        const chunk = this.renderQueue.splice(0, this.chunkSize);
        renderFn(chunk, this.currentChunk);

        this.currentChunk++;
        const progress = ((data.length - this.renderQueue.length) / data.length) * 100;
        this.onProgress?.(progress);

        // Use requestAnimationFrame to maintain 60fps
        this.animationFrameId = requestAnimationFrame(processChunk);
      };

      processChunk();
    });
  }

  cancel(): void {
    this.isRendering = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }
}

// Main optimization functions for public API

/**
 * Optimize D3 selection for large datasets with automatic LOD and viewport culling
 */
export function optimizeForLargeDatasets<T>(
  selection: d3.Selection<any, T, any, any>,
  dataSize: number,
  _viewport: { width: number; height: number },
  config: Partial<OptimizationConfig> = {}
): {
  selection: d3.Selection<any, T, any, any>;
  lodManager: LevelOfDetailManager;
  viewportCuller: ViewportCuller;
  cleanup: () => void;
} {
  const fullConfig = { ...DEFAULT_OPTIMIZATION_CONFIG, ...config };
  const lodManager = new LevelOfDetailManager(fullConfig);
  const viewportCuller = new ViewportCuller();

  // Determine initial LOD based on data size
  const initialLOD = lodManager.determineLOD(dataSize, 100); // Start with good performance score

  // Apply LOD to selection
  let optimizedSelection = lodManager.applyLOD(selection, initialLOD);

  // Setup viewport culling if container is available
  const container = selection.node()?.closest('.canvas-container');
  if (container) {
    viewportCuller.updateViewport(container as Element);
    optimizedSelection = viewportCuller.cullSelection(optimizedSelection, fullConfig.viewportMargin);

    // Update viewport on scroll/resize
    const updateViewport = () => {
      viewportCuller.updateViewport(container as Element);
      viewportCuller.cullSelection(optimizedSelection, fullConfig.viewportMargin);
    };

    container.addEventListener('scroll', updateViewport);
    window.addEventListener('resize', updateViewport);

    const cleanup = () => {
      container.removeEventListener('scroll', updateViewport);
      window.removeEventListener('resize', updateViewport);
    };

    return { selection: optimizedSelection, lodManager, viewportCuller, cleanup };
  }

  return {
    selection: optimizedSelection,
    lodManager,
    viewportCuller,
    cleanup: () => {}
  };
}

/**
 * Enable virtual scrolling for large lists
 */
export function enableVirtualScrolling<T>(
  container: d3.Selection<any, any, any, any>,
  data: T[],
  config: Partial<VirtualScrollConfig>
): VirtualScrollRenderer<T> {
  const fullConfig: VirtualScrollConfig = {
    itemHeight: 30,
    containerHeight: 400,
    bufferSize: 5,
    enableDynamicHeight: false,
    ...config
  };

  const renderer = new VirtualScrollRenderer<T>(container, fullConfig);
  renderer.setData(data);

  return renderer;
}

/**
 * Batch D3 updates to minimize DOM manipulation
 */
export function batchD3Updates(
  updates: Array<() => void>,
  batchSize: number = 10
): Promise<void> {
  return new Promise((resolve) => {
    let currentIndex = 0;

    const processBatch = () => {
      const endIndex = Math.min(currentIndex + batchSize, updates.length);

      // Execute batch of updates
      for (let i = currentIndex; i < endIndex; i++) {
        updates[i]();
      }

      currentIndex = endIndex;

      if (currentIndex >= updates.length) {
        resolve();
      } else {
        // Schedule next batch
        requestAnimationFrame(processBatch);
      }
    };

    processBatch();
  });
}

/**
 * Create performance-optimized force simulation
 */
export function createPerformantSimulation<T>(
  nodes: T[],
  config: {
    forceStrength?: number;
    linkDistance?: number;
    collisionRadius?: number;
    alphaDecay?: number;
    velocityDecay?: number;
  } = {}
): d3.Simulation<any, undefined> {
  const {
    forceStrength = -30,
    linkDistance = 30,
    collisionRadius = 5,
    alphaDecay = 0.0228,
    velocityDecay = 0.4
  } = config;

  return d3.forceSimulation(nodes as any)
    .force('charge', d3.forceManyBody().strength(forceStrength))
    .force('link', d3.forceLink().distance(linkDistance))
    .force('collision', d3.forceCollide().radius(collisionRadius))
    .alphaDecay(alphaDecay)
    .velocityDecay(velocityDecay)
    .stop(); // Start stopped for manual control
}

/**
 * Debounce data updates to prevent excessive re-renders
 */
export function debounceDataUpdates<T extends (...args: any[]) => any>(
  func: T,
  delay: number = 100
): T {
  let timeoutId: NodeJS.Timeout;

  return ((...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  }) as T;
}

/**
 * Memory pooling for D3 elements
 */
export class D3ElementPool {
  private pools = new Map<string, Element[]>();
  private readonly maxPoolSize: number;

  constructor(maxPoolSize: number = 1000) {
    this.maxPoolSize = maxPoolSize;
  }

  acquire(tagName: string, namespace?: string): Element {
    const key = namespace ? `${namespace}:${tagName}` : tagName;
    const pool = this.pools.get(key) || [];

    const element = pool.pop();
    if (element) {
      // Reset element
      this.resetElement(element);
      return element;
    }

    // Create new element
    return namespace
      ? document.createElementNS(namespace, tagName)
      : document.createElement(tagName);
  }

  release(element: Element): void {
    const tagName = element.tagName.toLowerCase();
    const namespace = element.namespaceURI;
    const key = namespace && namespace !== 'http://www.w3.org/1999/xhtml'
      ? `${namespace}:${tagName}`
      : tagName;

    const pool = this.pools.get(key) || [];

    if (pool.length < this.maxPoolSize) {
      pool.push(element);
      this.pools.set(key, pool);
    }
  }

  private resetElement(element: Element): void {
    // Remove all attributes except essential ones
    const attributesToKeep = ['tagName', 'namespaceURI'];
    const attributesToRemove: string[] = [];

    for (let i = 0; i < element.attributes.length; i++) {
      const attr = element.attributes[i];
      if (!attributesToKeep.includes(attr.name)) {
        attributesToRemove.push(attr.name);
      }
    }

    attributesToRemove.forEach(attr => element.removeAttribute(attr));

    // Clear content
    element.textContent = '';

    // Reset styles
    if (element instanceof HTMLElement || element instanceof SVGElement) {
      (element as any).style.cssText = '';
    }
  }

  clear(): void {
    this.pools.clear();
  }

  getPoolInfo(): Record<string, number> {
    const info: Record<string, number> = {};
    this.pools.forEach((pool, key) => {
      info[key] = pool.length;
    });
    return info;
  }
}

/**
 * Setup memory pooling for a D3 selection
 */
export function setupMemoryPooling(
  selection: d3.Selection<any, any, any, any>,
  poolSize: number = 1000
): D3ElementPool {
  const pool = new D3ElementPool(poolSize);

  // Monkey patch selection methods to use pool
  const originalAppend = selection.append;
  (selection as any).append = function(type: string) {
    return originalAppend.call(this, () => {
      const namespace = (this as any).namespaceURI;
      return pool.acquire(type, namespace || undefined);
    });
  };

  // Add cleanup method
  (selection as any).clearPool = () => pool.clear();
  (selection as any).getPoolInfo = () => pool.getPoolInfo();

  return pool;
}

export default {
  optimizeForLargeDatasets,
  enableVirtualScrolling,
  batchD3Updates,
  createPerformantSimulation,
  debounceDataUpdates,
  setupMemoryPooling,
  LevelOfDetailManager,
  ViewportCuller,
  ProgressiveRenderer,
  VirtualScrollRenderer,
  D3ElementPool
};