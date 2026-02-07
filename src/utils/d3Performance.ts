import * as d3 from 'd3';

// ============================================================================
// Object Pooling for Canvas Elements
// ============================================================================

interface PoolableCanvasElement {
  type: 'rect' | 'text' | 'circle' | 'path';
  x: number;
  y: number;
  width?: number;
  height?: number;
  style: Record<string, string | number>;
  text?: string;
  reset(): void;
}

class CanvasElement implements PoolableCanvasElement {
  type: 'rect' | 'text' | 'circle' | 'path' = 'rect';
  x: number = 0;
  y: number = 0;
  width?: number;
  height?: number;
  style: Record<string, string | number> = {};
  text?: string;

  constructor(type: PoolableCanvasElement['type'] = 'rect') {
    this.type = type;
  }

  reset(): void {
    this.x = 0;
    this.y = 0;
    this.width = undefined;
    this.height = undefined;
    this.style = {};
    this.text = undefined;
  }

  configure(config: Partial<PoolableCanvasElement>): this {
    Object.assign(this, config);
    return this;
  }
}

class ObjectPool<T> {
  private available: T[] = [];
  private createFn: () => T;
  private resetFn: (item: T) => void;

  constructor(createFn: () => T, resetFn: (item: T) => void, initialSize: number = 10) {
    this.createFn = createFn;
    this.resetFn = resetFn;

    // Pre-populate pool
    for (let i = 0; i < initialSize; i++) {
      this.available.push(createFn());
    }
  }

  acquire(): T {
    if (this.available.length === 0) {
      return this.createFn();
    }
    return this.available.pop()!;
  }

  release(item: T): void {
    this.resetFn(item);
    this.available.push(item);
  }

  size(): { available: number; total: number } {
    return {
      available: this.available.length,
      total: this.available.length // Only tracking available for now
    };
  }

  clear(): void {
    this.available = [];
  }
}

// Global object pools
export const canvasElementPool = new ObjectPool(
  () => new CanvasElement(),
  (element) => element.reset(),
  50 // Start with 50 elements
);

export const rectElementPool = new ObjectPool(
  () => new CanvasElement('rect'),
  (element) => element.reset(),
  30
);

export const textElementPool = new ObjectPool(
  () => new CanvasElement('text'),
  (element) => element.reset(),
  20
);

// ============================================================================
// Canvas Texture Cache
// ============================================================================

interface CachedTexture {
  canvas: OffscreenCanvas;
  ctx: OffscreenCanvasRenderingContext2D;
  width: number;
  height: number;
  lastUsed: number;
  cacheKey: string;
}

class TextureCache {
  private cache = new Map<string, CachedTexture>();
  private maxEntries = 50;
  private maxAge = 300000; // 5 minutes

  createCacheKey(type: string, config: Record<string, string | number | boolean>): string {
    return `${type}:${JSON.stringify(config)}`;
  }

  get(cacheKey: string): CachedTexture | null {
    const texture = this.cache.get(cacheKey);
    if (!texture) return null;

    // Check if expired
    if (Date.now() - texture.lastUsed > this.maxAge) {
      this.cache.delete(cacheKey);
      return null;
    }

    texture.lastUsed = Date.now();
    return texture;
  }

  set(
    cacheKey: string,
    width: number,
    height: number,
    renderFn: (ctx: OffscreenCanvasRenderingContext2D) => void
  ): CachedTexture {
    // Clean up old entries if cache is full
    if (this.cache.size >= this.maxEntries) {
      const oldestKey = this.getOldestEntry();
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    // Create offscreen canvas
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d')!;

    // Render to texture
    renderFn(ctx);

    const texture: CachedTexture = {
      canvas,
      ctx,
      width,
      height,
      lastUsed: Date.now(),
      cacheKey
    };

    this.cache.set(cacheKey, texture);
    return texture;
  }

  private getOldestEntry(): string | null {
    let oldestKey: string | null = null;
    let oldestTime = Date.now();

    for (const [key, texture] of Array.from(this.cache)) {
      if (texture.lastUsed < oldestTime) {
        oldestTime = texture.lastUsed;
        oldestKey = key;
      }
    }

    return oldestKey;
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }

  getStats(): { entries: number; memoryEstimate: number; oldestAge: number } {
    const now = Date.now();
    let memoryEstimate = 0;
    let oldestAge = 0;

    for (const texture of Array.from(this.cache.values())) {
      memoryEstimate += texture.width * texture.height * 4; // RGBA
      oldestAge = Math.max(oldestAge, now - texture.lastUsed);
    }

    return {
      entries: this.cache.size,
      memoryEstimate,
      oldestAge
    };
  }
}

export const textureCache = new TextureCache();

// ============================================================================
// Spatial Indexing for Hit Testing
// ============================================================================

interface SpatialItem {
  id: string;
  bounds: { x: number; y: number; width: number; height: number };
  data: unknown;
}

class SpatialIndex {
  private items: SpatialItem[] = [];
  private dirty = false;
  private sorted = false;

  insert(item: SpatialItem): void {
    this.items.push(item);
    this.dirty = true;
  }

  remove(id: string): boolean {
    const index = this.items.findIndex(item => item.id === id);
    if (index !== -1) {
      this.items.splice(index, 1);
      this.dirty = true;
      return true;
    }
    return false;
  }

  clear(): void {
    this.items = [];
    this.dirty = false;
    this.sorted = false;
  }

  query(x: number, y: number, width: number = 0, height: number = 0): SpatialItem[] {
    if (this.dirty) {
      this.rebuild();
    }

    const queryBounds = {
      left: x,
      top: y,
      right: x + width,
      bottom: y + height
    };

    return this.items.filter(item => {
      const bounds = {
        left: item.bounds.x,
        top: item.bounds.y,
        right: item.bounds.x + item.bounds.width,
        bottom: item.bounds.y + item.bounds.height
      };

      return !(
        queryBounds.right < bounds.left ||
        queryBounds.left > bounds.right ||
        queryBounds.bottom < bounds.top ||
        queryBounds.top > bounds.bottom
      );
    });
  }

  findAtPoint(x: number, y: number): SpatialItem | null {
    const items = this.query(x, y);
    return items.length > 0 ? items[0] : null;
  }

  private rebuild(): void {
    // Sort by x coordinate for faster queries
    this.items.sort((a, b) => a.bounds.x - b.bounds.x);
    this.dirty = false;
    this.sorted = true;
  }

  size(): number {
    return this.items.length;
  }

  getStats(): { items: number; dirty: boolean; sorted: boolean } {
    return {
      items: this.items.length,
      dirty: this.dirty,
      sorted: this.sorted
    };
  }
}

export const spatialIndex = new SpatialIndex();

// ============================================================================
// Transition Management
// ============================================================================

interface TransitionConfig {
  duration: number;
  easing: (t: number) => number;
  onUpdate?: (progress: number) => void;
  onComplete?: () => void;
}

interface ActiveTransition {
  id: string;
  startTime: number;
  config: TransitionConfig;
  startValues: Record<string, number>;
  endValues: Record<string, number>;
  currentValues: Record<string, number>;
}

class TransitionManager {
  private activeTransitions = new Map<string, ActiveTransition>();
  private animationFrame: number | null = null;

  start(
    id: string,
    startValues: Record<string, number>,
    endValues: Record<string, number>,
    config: TransitionConfig
  ): void {
    const transition: ActiveTransition = {
      id,
      startTime: performance.now(),
      config,
      startValues: { ...startValues },
      endValues: { ...endValues },
      currentValues: { ...startValues }
    };

    this.activeTransitions.set(id, transition);
    this.ensureAnimationLoop();
  }

  stop(id: string): boolean {
    return this.activeTransitions.delete(id);
  }

  isActive(id: string): boolean {
    return this.activeTransitions.has(id);
  }

  getCurrentValues(id: string): Record<string, number> | null {
    const transition = this.activeTransitions.get(id);
    return transition ? { ...transition.currentValues } : null;
  }

  private ensureAnimationLoop(): void {
    if (this.animationFrame === null && this.activeTransitions.size > 0) {
      this.animationFrame = requestAnimationFrame(() => this.update());
    }
  }

  private update(): void {
    const now = performance.now();
    const completedTransitions: string[] = [];

    for (const [id, transition] of Array.from(this.activeTransitions)) {
      const elapsed = now - transition.startTime;
      const progress = Math.min(elapsed / transition.config.duration, 1);
      const easedProgress = transition.config.easing(progress);

      // Update current values
      for (const key in transition.startValues) {
        const start = transition.startValues[key];
        const end = transition.endValues[key];
        transition.currentValues[key] = start + (end - start) * easedProgress;
      }

      // Call update callback
      transition.config.onUpdate?.(progress);

      // Check if completed
      if (progress >= 1) {
        completedTransitions.push(id);
        transition.config.onComplete?.();
      }
    }

    // Remove completed transitions
    for (const id of completedTransitions) {
      this.activeTransitions.delete(id);
    }

    // Continue loop if needed
    if (this.activeTransitions.size > 0) {
      this.animationFrame = requestAnimationFrame(() => this.update());
    } else {
      this.animationFrame = null;
    }
  }

  getStats(): { active: number; hasAnimationFrame: boolean } {
    return {
      active: this.activeTransitions.size,
      hasAnimationFrame: this.animationFrame !== null
    };
  }

  clear(): void {
    this.activeTransitions.clear();
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
  }
}

export const transitionManager = new TransitionManager();

// ============================================================================
// Native Rendering Integration
// ============================================================================

export interface NativeRenderingMetrics {
  timestamp: number;
  renderTime: number;
  commandCount: number;
  memoryUsage: number; // bytes
  cacheHitRate: number; // 0.0 to 1.0
  frameRate: number;
  droppedFrames: number;
  complexity: {
    pathCommandCount: number;
    simpleShapeCount: number;
    textCommandCount: number;
    transformCount: number;
    complexityScore: number; // 0.0 to 10.0
  };
}

export interface PerformanceComparison {
  domRendering: {
    avgRenderTime: number;
    avgFrameRate: number;
    memoryUsage: number;
  };
  nativeRendering: NativeRenderingMetrics | null;
  recommendation: 'dom' | 'native' | 'hybrid';
  reasoning: string;
  expectedImprovement: number; // percentage
}

export function performanceComparison(
  domMetrics: { renderTime: number; frameRate: number; memoryUsage: number },
  nativeMetrics: NativeRenderingMetrics | null,
  datasetSize: number,
  complexity: number
): PerformanceComparison {
  // Base comparison data
  const comparison: PerformanceComparison = {
    domRendering: {
      avgRenderTime: domMetrics.renderTime,
      avgFrameRate: domMetrics.frameRate,
      memoryUsage: domMetrics.memoryUsage
    },
    nativeRendering: nativeMetrics,
    recommendation: 'dom',
    reasoning: 'Default DOM rendering',
    expectedImprovement: 0
  };

  // If no native metrics available, stick with DOM
  if (!nativeMetrics) {
    comparison.reasoning = 'Native rendering not available';
    return comparison;
  }

  // Performance analysis factors
  const domSlow = domMetrics.renderTime > 0.0167; // > 16ms (60fps)
  const nativeFaster = nativeMetrics.renderTime < domMetrics.renderTime;
  const largeDataset = datasetSize > 1000;
  const highComplexity = complexity > 5.0;

  // Decision logic
  if (largeDataset && highComplexity && nativeFaster) {
    comparison.recommendation = 'native';
    comparison.reasoning = 'Large dataset with high complexity benefits from native rendering';
    comparison.expectedImprovement = Math.min(
      ((domMetrics.renderTime - nativeMetrics.renderTime) / domMetrics.renderTime) * 100,
      200 // Cap at 200% improvement
    );
  } else if (domSlow && nativeFaster) {
    comparison.recommendation = 'native';
    comparison.reasoning = 'DOM rendering performance below target, native faster';
    comparison.expectedImprovement = ((domMetrics.renderTime - nativeMetrics.renderTime) / domMetrics.renderTime) * 100;
  } else if (largeDataset && !nativeFaster) {
    comparison.recommendation = 'hybrid';
    comparison.reasoning = 'Large dataset with mixed performance - use viewport culling with DOM';
    comparison.expectedImprovement = 25;
  } else {
    comparison.recommendation = 'dom';
    comparison.reasoning = 'DOM rendering sufficient for current dataset and complexity';
  }

  return comparison;
}

// ============================================================================
// Performance Monitoring (Enhanced)
// ============================================================================

interface PerformanceMetric {
  name: string;
  startTime: number;
  duration?: number;
  samples: number[];
  lastUpdated: number;
}

// Legacy interface - Disabled in sql.js architecture
// interface ExtendedPerformanceMetrics {
//   basic: PerformanceMetric;
//   nativeRendering?: NativeRenderingMetrics;
//   comparison?: PerformanceComparison;
// }

class PerformanceMonitor {
  private metrics = new Map<string, PerformanceMetric>();
  private frameTimeHistory: number[] = [];
  private lastFrameTime = 0;
  private maxHistorySize = 60; // Keep 60 samples for FPS calculation

  // Native rendering metrics integration
  private nativeMetrics: NativeRenderingMetrics | null = null;
  private lastNativeUpdate = 0;
  // Native metrics interval - preserved for future native integration
   
  private _nativeUpdateInterval = 1000; // Update every second

  constructor() {
    // Explicitly mark preserved properties
    void this._nativeUpdateInterval;
  }

  startMetric(name: string): void {
    this.metrics.set(name, {
      name,
      startTime: performance.now(),
      samples: [],
      lastUpdated: Date.now()
    });
  }

  // Bridge integration for native metrics
  updateNativeMetrics(metrics: NativeRenderingMetrics): void {
    this.nativeMetrics = metrics;
    this.lastNativeUpdate = Date.now();
  }

  getNativeMetrics(): NativeRenderingMetrics | null {
    // Return null if metrics are stale (older than 5 seconds)
    if (!this.nativeMetrics || Date.now() - this.lastNativeUpdate > 5000) {
      return null;
    }
    return this.nativeMetrics;
  }

  // Enhanced performance comparison
  getPerformanceComparison(datasetSize: number, complexity: number): PerformanceComparison | null {
    const domMetrics = {
      renderTime: this.getAverageFrameTime() / 1000, // Convert to seconds
      frameRate: this.getFPS(),
      memoryUsage: this.getMemoryUsage().used * 1024 * 1024 // Convert to bytes
    };

    const nativeMetrics = this.getNativeMetrics();

    if (!nativeMetrics) {
      return null;
    }

    return performanceComparison(domMetrics, nativeMetrics, datasetSize, complexity);
  }

  private getAverageFrameTime(): number {
    if (this.frameTimeHistory.length === 0) return 16; // Default 16ms
    return this.frameTimeHistory.reduce((sum, time) => sum + time, 0) / this.frameTimeHistory.length;
  }

  endMetric(name: string): number {
    const metric = this.metrics.get(name);
    if (!metric) return 0;

    const duration = performance.now() - metric.startTime;
    metric.duration = duration;
    metric.samples.push(duration);
    metric.lastUpdated = Date.now();

    // Keep only recent samples
    if (metric.samples.length > this.maxHistorySize) {
      metric.samples.shift();
    }

    return duration;
  }

  recordFrameTime(): number {
    const now = performance.now();
    if (this.lastFrameTime > 0) {
      const frameTime = now - this.lastFrameTime;
      this.frameTimeHistory.push(frameTime);

      if (this.frameTimeHistory.length > this.maxHistorySize) {
        this.frameTimeHistory.shift();
      }
    }

    this.lastFrameTime = now;
    return this.getFPS();
  }

  getFPS(): number {
    if (this.frameTimeHistory.length === 0) return 0;

    const averageFrameTime = this.frameTimeHistory.reduce((sum, time) => sum + time, 0) / this.frameTimeHistory.length;
    return 1000 / averageFrameTime;
  }

  getMetricStats(name: string): { average: number; min: number; max: number; latest: number; samples: number } | null {
    const metric = this.metrics.get(name);
    if (!metric || metric.samples.length === 0) return null;

    const samples = metric.samples;
    const average = samples.reduce((sum, val) => sum + val, 0) / samples.length;
    const min = Math.min(...samples);
    const max = Math.max(...samples);
    const latest = samples[samples.length - 1];

    return { average, min, max, latest, samples: samples.length };
  }

  getAllStats(): Record<string, unknown> {
    const stats: Record<string, unknown> = {
      fps: this.getFPS(),
      frameHistory: this.frameTimeHistory.length,
      nativeMetrics: this.getNativeMetrics(),
      hasNativeRendering: this.getNativeMetrics() !== null
    };

    for (const [name] of Array.from(this.metrics)) {
      stats[name] = this.getMetricStats(name);
    }

    return stats;
  }

  clear(): void {
    this.metrics.clear();
    this.frameTimeHistory = [];
    this.lastFrameTime = 0;
  }

  getMemoryUsage(): { used: number; total: number; percentage: number } {
    const memory = (performance as { memory?: { usedJSHeapSize: number; totalJSHeapSize: number } }).memory;
    if (memory) {
      return {
        used: memory.usedJSHeapSize / 1024 / 1024, // MB
        total: memory.totalJSHeapSize / 1024 / 1024, // MB
        percentage: (memory.usedJSHeapSize / memory.totalJSHeapSize) * 100
      };
    }
    return { used: 0, total: 0, percentage: 0 };
  }
}

export const performanceMonitor = new PerformanceMonitor();

// ============================================================================
// Smooth PAFV Transition Effects
// ============================================================================

export const createPAFVTransition = (
  _fromState: unknown,
  _toState: unknown,
  duration: number = 300
): Promise<void> => {
  return new Promise((resolve) => {
    const transitionId = `pafv-${Date.now()}`;

    // Calculate animation values
    const startValues = {
      scaleProgress: 0
    };

    const endValues = {
      scaleProgress: 1
    };

    transitionManager.start(transitionId, startValues, endValues, {
      duration,
      easing: d3.easeCubicInOut,
      onUpdate: (_progress) => {
        // Custom PAFV transition logic can be added here
        // For now, just track progress
      },
      onComplete: () => {
        resolve();
      }
    });
  });
};

// ============================================================================
// Utility Functions
// ============================================================================

export const debounce = <T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number
): ((...args: Parameters<T>) => void) => {
  let timeoutId: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
};

export const throttle = <T extends (...args: unknown[]) => unknown>(
  fn: T,
  limit: number
): ((...args: Parameters<T>) => void) => {
  let inThrottle: boolean;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      fn(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
};

export const measurePerformance = async <T>(
  name: string,
  fn: () => T | Promise<T>
): Promise<T> => {
  performanceMonitor.startMetric(name);
  try {
    const result = await fn();
    performanceMonitor.endMetric(name);
    return result;
  } catch (error) {
    performanceMonitor.endMetric(name);
    throw error;
  }
};

// ============================================================================
// Performance Target Validation
// ============================================================================

interface PerformanceTargets {
  maxFrameTime: number; // 16ms for 60fps
  maxPipelineTime: number; // 100ms for responsiveness
  maxMemoryUsage: number; // 50MB
  minFPS: number; // 30fps minimum
}

const DEFAULT_TARGETS: PerformanceTargets = {
  maxFrameTime: 16,
  maxPipelineTime: 100,
  maxMemoryUsage: 50,
  minFPS: 30
};

export const validatePerformanceTargets = (
  targets: Partial<PerformanceTargets> = {}
): {
  passed: boolean;
  results: Record<string, { target: number; actual: number; passed: boolean }>;
} => {
  const finalTargets = { ...DEFAULT_TARGETS, ...targets };
  const currentFPS = performanceMonitor.getFPS();
  const memory = performanceMonitor.getMemoryUsage();

  const results = {
    fps: {
      target: finalTargets.minFPS,
      actual: currentFPS,
      passed: currentFPS >= finalTargets.minFPS
    },
    memory: {
      target: finalTargets.maxMemoryUsage,
      actual: memory.used,
      passed: memory.used <= finalTargets.maxMemoryUsage
    }
  };

  const passed = Object.values(results).every(result => result.passed);

  return { passed, results };
};

export default {
  canvasElementPool,
  rectElementPool,
  textElementPool,
  textureCache,
  spatialIndex,
  transitionManager,
  performanceMonitor,
  createPAFVTransition,
  debounce,
  throttle,
  measurePerformance,
  validatePerformanceTargets,
  // Native rendering integration
  performanceComparison
};