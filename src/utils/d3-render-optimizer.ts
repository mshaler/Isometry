import * as d3 from 'd3';
import { performanceMonitor } from './d3Performance';

// ============================================================================
// Render Command Types
// ============================================================================

export interface RenderCommand {
  id: string;
  type: 'circle' | 'rectangle' | 'path' | 'text' | 'group';
  priority: number;
  bounds: { x: number; y: number; width: number; height: number };
  complexity: number; // 1-10 scale
  data: unknown;
}

export interface Viewport {
  x: number;
  y: number;
  width: number;
  height: number;
  scale: number;
}

export interface OptimizationSettings {
  enableViewportCulling: boolean;
  enableLOD: boolean;
  enableCommandBatching: boolean;
  enableProgressiveLoading: boolean;
  lodThreshold: number; // Distance threshold for LOD
  batchSize: number;
  maxCommandsPerFrame: number;
}

// ============================================================================
// Viewport Culling
// ============================================================================

export class ViewportCuller {
  private lastViewport: Viewport | null = null;
  private cullCache = new Map<string, boolean>();
  private cacheInvalidationThreshold = 0.1; // 10% viewport change

  /**
   * Eliminate off-screen render commands before native bridge
   */
  cullCommands(commands: RenderCommand[], viewport: Viewport): RenderCommand[] {
    // Check if viewport changed significantly
    if (this.shouldInvalidateCache(viewport)) {
      this.cullCache.clear();
      this.lastViewport = viewport;
    }

    const visibleCommands: RenderCommand[] = [];
    const culledCount = commands.length;

    for (const command of commands) {
      const cacheKey = `${command.id}-${viewport.scale}`;

      // Check cache first
      if (this.cullCache.has(cacheKey)) {
        if (this.cullCache.get(cacheKey)) {
          visibleCommands.push(command);
        }
        continue;
      }

      // Calculate if command is visible in viewport
      const isVisible = this.isCommandVisible(command, viewport);
      this.cullCache.set(cacheKey, isVisible);

      if (isVisible) {
        visibleCommands.push(command);
      }
    }

    // Update performance metrics
    const cullRatio = 1 - (visibleCommands.length / culledCount);
    performanceMonitor.startMetric('viewport-culling');
    performanceMonitor.endMetric('viewport-culling');

    return visibleCommands;
  }

  private shouldInvalidateCache(newViewport: Viewport): boolean {
    if (!this.lastViewport) return true;

    const last = this.lastViewport;
    const xChange = Math.abs(newViewport.x - last.x) / newViewport.width;
    const yChange = Math.abs(newViewport.y - last.y) / newViewport.height;
    const scaleChange = Math.abs(newViewport.scale - last.scale) / last.scale;

    return xChange > this.cacheInvalidationThreshold ||
           yChange > this.cacheInvalidationThreshold ||
           scaleChange > this.cacheInvalidationThreshold;
  }

  private isCommandVisible(command: RenderCommand, viewport: Viewport): boolean {
    // Transform command bounds to viewport space
    const bounds = command.bounds;
    const viewportBounds = {
      left: viewport.x,
      top: viewport.y,
      right: viewport.x + viewport.width / viewport.scale,
      bottom: viewport.y + viewport.height / viewport.scale
    };

    const commandBounds = {
      left: bounds.x,
      top: bounds.y,
      right: bounds.x + bounds.width,
      bottom: bounds.y + bounds.height
    };

    // Add margin for partially visible elements
    const margin = Math.max(bounds.width, bounds.height) * 0.1;

    return !(
      commandBounds.right < viewportBounds.left - margin ||
      commandBounds.left > viewportBounds.right + margin ||
      commandBounds.bottom < viewportBounds.top - margin ||
      commandBounds.top > viewportBounds.bottom + margin
    );
  }

  getStats(): { cacheSize: number; hitRate: number } {
    return {
      cacheSize: this.cullCache.size,
      hitRate: 0 // TODO: Track cache hits vs misses
    };
  }

  clearCache(): void {
    this.cullCache.clear();
    this.lastViewport = null;
  }
}

// ============================================================================
// Level-of-Detail (LOD) Manager
// ============================================================================

export class LODManager {
  private lodLevels = [
    { scale: 0.1, complexity: 1 },   // Very distant - simple shapes only
    { scale: 0.25, complexity: 3 },  // Distant - reduced detail
    { scale: 0.5, complexity: 5 },   // Medium - normal detail
    { scale: 1.0, complexity: 7 },   // Close - high detail
    { scale: 2.0, complexity: 10 }   // Very close - full detail
  ];

  /**
   * Reduce complexity for distant/small elements
   */
  applyLOD(commands: RenderCommand[], viewport: Viewport): RenderCommand[] {
    return commands.map(command => this.optimizeCommand(command, viewport));
  }

  private optimizeCommand(command: RenderCommand, viewport: Viewport): RenderCommand {
    // Calculate effective size of command in viewport
    const effectiveSize = this.calculateEffectiveSize(command, viewport);
    const targetComplexity = this.getTargetComplexity(effectiveSize);

    // If complexity is already low enough, return as-is
    if (command.complexity <= targetComplexity) {
      return command;
    }

    // Create simplified version of command
    return {
      ...command,
      complexity: targetComplexity,
      data: this.simplifyCommandData(command, targetComplexity)
    };
  }

  private calculateEffectiveSize(command: RenderCommand, viewport: Viewport): number {
    // Calculate how large the command appears in the viewport
    const bounds = command.bounds;
    const scaledWidth = bounds.width * viewport.scale;
    const scaledHeight = bounds.height * viewport.scale;
    return Math.max(scaledWidth, scaledHeight);
  }

  private getTargetComplexity(effectiveSize: number): number {
    // Determine appropriate complexity level based on size
    for (const level of this.lodLevels) {
      if (effectiveSize <= level.scale * 100) { // 100px baseline
        return level.complexity;
      }
    }
    return this.lodLevels[this.lodLevels.length - 1].complexity;
  }

  private simplifyCommandData(command: RenderCommand, targetComplexity: number): unknown {
    // Command-specific simplification logic
    switch (command.type) {
      case 'path':
        return this.simplifyPathData(command.data, targetComplexity);
      case 'text':
        return this.simplifyTextData(command.data, targetComplexity);
      default:
        return command.data;
    }
  }

  private simplifyPathData(data: unknown, targetComplexity: number): unknown {
    // Simplify SVG path data based on target complexity
    // This is a simplified version - real implementation would use
    // path simplification algorithms like Douglas-Peucker
    return data; // TODO: Implement path simplification
  }

  private simplifyTextData(data: unknown, targetComplexity: number): unknown {
    // Simplify text rendering (e.g., remove decorations, simplify font)
    return data; // TODO: Implement text simplification
  }
}

// ============================================================================
// Command Batching and Optimization
// ============================================================================

export class CommandBatcher {
  /**
   * Group similar render operations for efficiency
   */
  batchCommands(commands: RenderCommand[]): RenderCommand[][] {
    const batches = new Map<string, RenderCommand[]>();

    for (const command of commands) {
      const batchKey = this.getBatchKey(command);

      if (!batches.has(batchKey)) {
        batches.set(batchKey, []);
      }

      batches.get(batchKey)!.push(command);
    }

    return Array.from(batches.values());
  }

  private getBatchKey(command: RenderCommand): string {
    // Group commands by type and similar properties
    switch (command.type) {
      case 'circle':
      case 'rectangle':
        return `${command.type}-simple`;
      case 'path':
        return `path-complex-${Math.floor(command.complexity)}`;
      case 'text':
        return `text-${this.getTextBatchKey(command.data)}`;
      default:
        return command.type;
    }
  }

  private getTextBatchKey(data: unknown): string {
    // Group text by font family and size (simplified)
    return 'default'; // TODO: Extract font properties from data
  }

  /**
   * Remove duplicate commands
   */
  deduplicateCommands(commands: RenderCommand[]): RenderCommand[] {
    const seen = new Set<string>();
    const unique: RenderCommand[] = [];

    for (const command of commands) {
      const key = this.getDeduplicationKey(command);

      if (!seen.has(key)) {
        seen.add(key);
        unique.push(command);
      }
    }

    return unique;
  }

  private getDeduplicationKey(command: RenderCommand): string {
    return `${command.type}-${command.bounds.x}-${command.bounds.y}-${JSON.stringify(command.data)}`;
  }
}

// ============================================================================
// Memory Pooling
// ============================================================================

export class CommandPool {
  private pools = new Map<string, RenderCommand[]>();
  private maxPoolSize = 100;

  /**
   * Reuse command objects to reduce memory allocation
   */
  acquireCommand(type: string): RenderCommand {
    const pool = this.pools.get(type) || [];

    if (pool.length > 0) {
      const command = pool.pop()!;
      this.resetCommand(command);
      return command;
    }

    // Create new command if pool is empty
    return this.createCommand(type);
  }

  releaseCommand(command: RenderCommand): void {
    const pool = this.pools.get(command.type) || [];

    if (pool.length < this.maxPoolSize) {
      pool.push(command);
      this.pools.set(command.type, pool);
    }
  }

  private resetCommand(command: RenderCommand): void {
    command.id = '';
    command.priority = 0;
    command.bounds = { x: 0, y: 0, width: 0, height: 0 };
    command.complexity = 1;
    command.data = null;
  }

  private createCommand(type: string): RenderCommand {
    return {
      id: '',
      type: type as RenderCommand['type'],
      priority: 0,
      bounds: { x: 0, y: 0, width: 0, height: 0 },
      complexity: 1,
      data: null
    };
  }

  getStats(): Record<string, number> {
    const stats: Record<string, number> = {};

    for (const [type, pool] of this.pools) {
      stats[type] = pool.length;
    }

    return stats;
  }

  clearPools(): void {
    this.pools.clear();
  }
}

// ============================================================================
// Main Render Optimizer
// ============================================================================

export class RenderOptimizer {
  private viewportCuller = new ViewportCuller();
  private lodManager = new LODManager();
  private commandBatcher = new CommandBatcher();
  private commandPool = new CommandPool();

  private settings: OptimizationSettings = {
    enableViewportCulling: true,
    enableLOD: true,
    enableCommandBatching: true,
    enableProgressiveLoading: true,
    lodThreshold: 0.1,
    batchSize: 50,
    maxCommandsPerFrame: 200
  };

  /**
   * Apply intelligent optimization pipeline to render commands
   */
  optimizeCommands(commands: RenderCommand[], viewport: Viewport): RenderCommand[] {
    performanceMonitor.startMetric('render-optimization');

    let optimizedCommands = commands;

    // Step 1: Viewport culling - eliminate off-screen commands
    if (this.settings.enableViewportCulling) {
      optimizedCommands = this.viewportCuller.cullCommands(optimizedCommands, viewport);
    }

    // Step 2: Level-of-Detail optimization - reduce complexity at distance
    if (this.settings.enableLOD) {
      optimizedCommands = this.lodManager.applyLOD(optimizedCommands, viewport);
    }

    // Step 3: Command deduplication
    if (this.settings.enableCommandBatching) {
      optimizedCommands = this.commandBatcher.deduplicateCommands(optimizedCommands);
    }

    // Step 4: Priority sorting - render high-priority items first
    optimizedCommands.sort((a, b) => b.priority - a.priority);

    // Step 5: Command limiting - prevent frame drops
    if (optimizedCommands.length > this.settings.maxCommandsPerFrame) {
      optimizedCommands = optimizedCommands.slice(0, this.settings.maxCommandsPerFrame);
    }

    performanceMonitor.endMetric('render-optimization');

    return optimizedCommands;
  }

  /**
   * Batch optimize commands for native bridge
   */
  batchOptimizeCommands(commands: RenderCommand[]): RenderCommand[][] {
    const batches = this.commandBatcher.batchCommands(commands);
    return batches.map(batch => batch.slice(0, this.settings.batchSize));
  }

  /**
   * Smart throttling during rapid pan/zoom operations
   */
  shouldThrottleRendering(viewport: Viewport, lastViewport: Viewport | null): boolean {
    if (!lastViewport) return false;

    // Calculate viewport change velocity
    const deltaX = Math.abs(viewport.x - lastViewport.x);
    const deltaY = Math.abs(viewport.y - lastViewport.y);
    const deltaScale = Math.abs(viewport.scale - lastViewport.scale);

    // Throttle if rapid movement detected
    const rapidMovement = deltaX > viewport.width * 0.1 ||
                         deltaY > viewport.height * 0.1 ||
                         deltaScale > lastViewport.scale * 0.1;

    return rapidMovement;
  }

  /**
   * Adaptive quality settings based on performance feedback
   */
  adaptQualitySettings(performanceMetrics: { fps: number; renderTime: number }): void {
    const targetFPS = 60;
    const targetRenderTime = 16; // 16ms for 60fps

    // Reduce quality if performance is poor
    if (performanceMetrics.fps < targetFPS * 0.8 || performanceMetrics.renderTime > targetRenderTime * 1.2) {
      this.settings.maxCommandsPerFrame = Math.max(50, this.settings.maxCommandsPerFrame * 0.9);
      this.settings.lodThreshold = Math.min(1.0, this.settings.lodThreshold * 1.1);
    }
    // Increase quality if performance is good
    else if (performanceMetrics.fps > targetFPS * 0.95 && performanceMetrics.renderTime < targetRenderTime * 0.8) {
      this.settings.maxCommandsPerFrame = Math.min(500, this.settings.maxCommandsPerFrame * 1.1);
      this.settings.lodThreshold = Math.max(0.05, this.settings.lodThreshold * 0.9);
    }
  }

  /**
   * Get optimization statistics
   */
  getOptimizationStats(): Record<string, unknown> {
    return {
      settings: this.settings,
      cullingStats: this.viewportCuller.getStats(),
      poolStats: this.commandPool.getStats()
    };
  }

  /**
   * Update optimization settings
   */
  updateSettings(newSettings: Partial<OptimizationSettings>): void {
    this.settings = { ...this.settings, ...newSettings };
  }

  /**
   * Reset optimization state
   */
  reset(): void {
    this.viewportCuller.clearCache();
    this.commandPool.clearPools();
  }
}

// Export singleton instance
export const renderOptimizer = new RenderOptimizer();

// Export individual components for advanced usage
export { ViewportCuller, LODManager, CommandBatcher, CommandPool };