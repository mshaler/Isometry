/**
 * React D3 Native Bridge Client for high-performance Canvas rendering
 * Handles debounced messaging, capability detection, and render command batching
 * Connects React D3 components to native Canvas renderer for performance optimization
 */

// ============================================================================
// Type Definitions - React side types for D3 Canvas rendering
// ============================================================================

export interface Viewport {
  x: number;
  y: number;
  width: number;
  height: number;
  scale: number;
}

export interface RenderCommand {
  type: 'circle' | 'rectangle' | 'path' | 'text' | 'group';
  id?: string; // Optional ID for tracking
  [key: string]: any; // Additional properties specific to each command type
}

export interface CircleCommand extends RenderCommand {
  type: 'circle';
  center: { x: number; y: number };
  radius: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  opacity?: number;
}

export interface RectangleCommand extends RenderCommand {
  type: 'rectangle';
  bounds: { x: number; y: number; width: number; height: number };
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  cornerRadius?: number;
  opacity?: number;
}

export interface PathCommand extends RenderCommand {
  type: 'path';
  path: string; // SVG path data
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  opacity?: number;
}

export interface TextCommand extends RenderCommand {
  type: 'text';
  content: string;
  position: { x: number; y: number };
  color?: string;
  fontSize?: number;
  fontFamily?: string;
  alignment?: 'left' | 'center' | 'right';
  opacity?: number;
}

export interface GroupCommand extends RenderCommand {
  type: 'group';
  transform?: {
    translateX?: number;
    translateY?: number;
    scaleX?: number;
    scaleY?: number;
    rotation?: number;
  };
  children: RenderCommand[];
  opacity?: number;
}

export interface CanvasCapabilities {
  nativeRenderingAvailable: boolean;
  supportedShapes: string[];
  maxRenderCommands: number;
  supportsGradients: boolean;
  supportsTextMetrics: boolean;
  platform: string;
}

export interface RenderResult {
  commandsRendered: number;
  renderTime: number;
  primitiveCount: number;
  memoryUsage: number;
}

// ============================================================================
// Performance Monitoring
// ============================================================================

interface PerformanceMetrics {
  messageCount: number;
  totalLatency: number;
  averageLatency: number;
  renderCommandsSent: number;
  viewportUpdates: number;
  capabilityQueries: number;
  nativeRenderTime: number;
  fallbackRenderTime: number;
  performanceImprovement: number; // % improvement over DOM rendering
}

// ============================================================================
// Main D3 Native Bridge Class
// ============================================================================

export class D3NativeBridge {
  private sequenceId = 0;
  private debounceTimer: number | null = null;
  private readonly debounceInterval = 16; // 60fps limit (16ms)

  // Performance monitoring
  private metrics: PerformanceMetrics = {
    messageCount: 0,
    totalLatency: 0,
    averageLatency: 0,
    renderCommandsSent: 0,
    viewportUpdates: 0,
    capabilityQueries: 0,
    nativeRenderTime: 0,
    fallbackRenderTime: 0,
    performanceImprovement: 0
  };

  // Capability state
  private capabilities: CanvasCapabilities | null = null;
  private capabilityCheckPromise: Promise<CanvasCapabilities> | null = null;

  // Batched updates
  private pendingRenderCommands: RenderCommand[] = [];
  // Viewport batching - preserved for future optimization
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private _pendingViewport: Viewport | null = null;

  // Error boundaries
  private consecutiveErrors = 0;
  private readonly maxConsecutiveErrors = 3;
  private isNativeRenderingDisabled = false;

  constructor() {
    this.log('D3NativeBridge initialized');
    this.setupBridgeAvailabilityCheck();

    // Explicitly mark preserved properties
    void this._pendingViewport;
    void this._resetErrorCount;
  }

  // MARK: - Bridge Availability

  private setupBridgeAvailabilityCheck(): void {
    if (typeof window === 'undefined') {
      this.warn('D3NativeBridge: Running in non-browser environment');
      return;
    }

    if (!(window as any)._isometryBridge?.d3canvas) {
      this.warn('D3NativeBridge: Native bridge not available, DOM fallback enabled');

      // Listen for bridge ready event
      window.addEventListener('isometry-bridge-ready', () => {
        this.log('D3NativeBridge: Native bridge became available');
        this.queryCapabilities(); // Re-check capabilities
      });
    } else {
      // Query capabilities on initialization
      this.queryCapabilities();
    }
  }

  public get isNativeBridgeAvailable(): boolean {
    return !!(window as any)._isometryBridge?.d3canvas && !this.isNativeRenderingDisabled;
  }

  // MARK: - Capability Detection

  public async getCapabilities(): Promise<CanvasCapabilities> {
    // Return cached capabilities if available
    if (this.capabilities) {
      return this.capabilities;
    }

    // Return pending promise if query in progress
    if (this.capabilityCheckPromise) {
      return this.capabilityCheckPromise;
    }

    // Create new capability check promise
    this.capabilityCheckPromise = this.queryCapabilities();
    return this.capabilityCheckPromise;
  }

  private async queryCapabilities(): Promise<CanvasCapabilities> {
    const startTime = performance.now();

    try {
      if (!this.isNativeBridgeAvailable) {
        // Return fallback capabilities for DOM rendering
        this.capabilities = {
          nativeRenderingAvailable: false,
          supportedShapes: ['circle', 'rectangle', 'path', 'text', 'group'],
          maxRenderCommands: 10000, // DOM can handle large numbers but slower
          supportsGradients: true,
          supportsTextMetrics: true,
          platform: 'DOM'
        };
        return this.capabilities;
      }

      const bridge = (window as any)._isometryBridge.d3canvas;
      const result = await bridge.getCapabilities();

      this.capabilities = result;
      this.metrics.capabilityQueries++;
      this.metrics.totalLatency += performance.now() - startTime;
      this.metrics.messageCount++;

      this.log('D3Canvas capabilities:', result);
      return result;

    } catch (error) {
      this.error('Failed to query D3Canvas capabilities:', error);
      this.handleBridgeError();

      // Return fallback capabilities
      this.capabilities = {
        nativeRenderingAvailable: false,
        supportedShapes: ['circle', 'rectangle', 'path', 'text', 'group'],
        maxRenderCommands: 1000,
        supportsGradients: true,
        supportsTextMetrics: true,
        platform: 'DOM-Fallback'
      };
      return this.capabilities;
    } finally {
      this.capabilityCheckPromise = null;
    }
  }

  // MARK: - Render Command Messaging

  /**
   * Send D3 render commands to native Canvas renderer
   * Debounced to prevent bridge flooding during rapid updates
   */
  public sendRenderCommands(commands: RenderCommand[]): Promise<RenderResult | null> {
    return new Promise((resolve, reject) => {
      // Validate commands
      const validCommands = this.validateRenderCommands(commands);
      if (validCommands.length === 0) {
        resolve(null);
        return;
      }

      // Store for potential batching
      this.pendingRenderCommands = validCommands;

      // Cancel existing debounce timer
      if (this.debounceTimer !== null) {
        clearTimeout(this.debounceTimer);
      }

      // Debounce rapid render updates
      this.debounceTimer = window.setTimeout(async () => {
        try {
          const result = await this.sendRenderCommandsImmediate(this.pendingRenderCommands);
          resolve(result);
        } catch (error) {
          reject(error);
        } finally {
          this.debounceTimer = null;
          this.pendingRenderCommands = [];
        }
      }, this.debounceInterval);
    });
  }

  private async sendRenderCommandsImmediate(commands: RenderCommand[]): Promise<RenderResult | null> {
    if (!this.isNativeBridgeAvailable) {
      this.warn('D3NativeBridge: Native rendering not available, using DOM fallback');
      return this.trackDOMFallbackRendering(commands);
    }

    const startTime = performance.now();

    try {
      const bridge = (window as any)._isometryBridge.d3canvas;
      const result = await bridge.renderCommands({
        commands: commands,
        sequenceId: this.getNextSequenceId()
      });

      // Update performance metrics
      const renderTime = performance.now() - startTime;
      this.updateRenderMetrics(commands.length, renderTime, result);

      this.log(`D3Canvas: Rendered ${commands.length} commands in ${renderTime.toFixed(2)}ms`);
      return result;

    } catch (error) {
      this.error('Failed to send D3Canvas render commands:', error);
      this.handleBridgeError();

      // Fall back to DOM rendering
      return this.trackDOMFallbackRendering(commands);
    }
  }

  private validateRenderCommands(commands: RenderCommand[]): RenderCommand[] {
    return commands.filter(command => {
      if (!command.type) {
        this.warn('Invalid render command: missing type', command);
        return false;
      }

      const supportedTypes = ['circle', 'rectangle', 'path', 'text', 'group'];
      if (!supportedTypes.includes(command.type)) {
        this.warn(`Unsupported render command type: ${command.type}`, command);
        return false;
      }

      return true;
    });
  }

  // MARK: - Viewport Updates

  /**
   * Send viewport/canvas update to native renderer
   * Not debounced as viewport changes should be immediate for responsiveness
   */
  public async sendCanvasUpdate(viewport: Viewport): Promise<boolean> {
    if (!this.isNativeBridgeAvailable) {
      // For DOM fallback, we don't need to send viewport updates
      return true;
    }

    const startTime = performance.now();

    try {
      const bridge = (window as any)._isometryBridge.d3canvas;
      await bridge.canvasUpdate({
        viewport: viewport,
        sequenceId: this.getNextSequenceId()
      });

      const latency = performance.now() - startTime;
      this.metrics.viewportUpdates++;
      this.metrics.totalLatency += latency;
      this.metrics.messageCount++;

      this.log(`D3Canvas: Viewport updated in ${latency.toFixed(2)}ms`);
      return true;

    } catch (error) {
      this.error('Failed to send D3Canvas viewport update:', error);
      this.handleBridgeError();
      return false;
    }
  }

  // MARK: - Performance Tracking

  // Metrics tracking - result preserved for future analytics
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private updateRenderMetrics(commandCount: number, renderTime: number, _result: RenderResult): void {
    this.metrics.renderCommandsSent += commandCount;
    this.metrics.nativeRenderTime += renderTime;
    this.metrics.totalLatency += renderTime;
    this.metrics.messageCount++;

    // Calculate average latency
    this.metrics.averageLatency = this.metrics.totalLatency / this.metrics.messageCount;

    // Estimate performance improvement (native vs DOM fallback)
    if (this.metrics.fallbackRenderTime > 0 && this.metrics.nativeRenderTime > 0) {
      this.metrics.performanceImprovement =
        ((this.metrics.fallbackRenderTime - this.metrics.nativeRenderTime) / this.metrics.fallbackRenderTime) * 100;
    }
  }

  private trackDOMFallbackRendering(commands: RenderCommand[]): RenderResult {
    const startTime = performance.now();

    // Simulate DOM rendering time (typically slower)
    const estimatedDOMTime = commands.length * 0.5; // 0.5ms per command estimate

    const renderTime = performance.now() - startTime + estimatedDOMTime;
    this.metrics.fallbackRenderTime += renderTime;

    return {
      commandsRendered: commands.length,
      renderTime: renderTime,
      primitiveCount: commands.length, // Rough estimate
      memoryUsage: commands.length * 100 // Rough estimate in bytes
    };
  }

  // MARK: - Error Handling

  private handleBridgeError(): void {
    this.consecutiveErrors++;

    if (this.consecutiveErrors >= this.maxConsecutiveErrors) {
      this.error(`D3NativeBridge: Disabling native rendering after ${this.consecutiveErrors} consecutive errors`);
      this.isNativeRenderingDisabled = true;

      // Re-enable after a delay
      setTimeout(() => {
        this.isNativeRenderingDisabled = false;
        this.consecutiveErrors = 0;
        this.log('D3NativeBridge: Re-enabling native rendering after error recovery period');
      }, 10000); // 10 second recovery
    }
  }

  // Error recovery - preserved for future error handling improvements
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private _resetErrorCount(): void {
    if (this.consecutiveErrors > 0) {
      this.consecutiveErrors = 0;
      this.log('D3NativeBridge: Error count reset after successful operation');
    }
  }

  // MARK: - Utilities

  private getNextSequenceId(): number {
    return ++this.sequenceId;
  }

  public getPerformanceMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  public resetPerformanceMetrics(): void {
    this.metrics = {
      messageCount: 0,
      totalLatency: 0,
      averageLatency: 0,
      renderCommandsSent: 0,
      viewportUpdates: 0,
      capabilityQueries: 0,
      nativeRenderTime: 0,
      fallbackRenderTime: 0,
      performanceImprovement: 0
    };
    this.log('D3NativeBridge: Performance metrics reset');
  }

  // MARK: - Logging

  private log(...args: any[]): void {
    if (process.env.NODE_ENV === 'development') {
      console.log('[D3NativeBridge]', ...args);
    }
  }

  private warn(...args: any[]): void {
    console.warn('[D3NativeBridge]', ...args);
  }

  private error(...args: any[]): void {
    console.error('[D3NativeBridge]', ...args);
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

export const d3NativeBridge = new D3NativeBridge();

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create a circle render command
 */
export function createCircleCommand(
  center: { x: number; y: number },
  radius: number,
  style: {
    fill?: string;
    stroke?: string;
    strokeWidth?: number;
    opacity?: number;
  } = {}
): CircleCommand {
  return {
    type: 'circle',
    center,
    radius,
    fill: style.fill,
    stroke: style.stroke,
    strokeWidth: style.strokeWidth ?? 1,
    opacity: style.opacity ?? 1
  };
}

/**
 * Create a rectangle render command
 */
export function createRectangleCommand(
  bounds: { x: number; y: number; width: number; height: number },
  style: {
    fill?: string;
    stroke?: string;
    strokeWidth?: number;
    cornerRadius?: number;
    opacity?: number;
  } = {}
): RectangleCommand {
  return {
    type: 'rectangle',
    bounds,
    fill: style.fill,
    stroke: style.stroke,
    strokeWidth: style.strokeWidth ?? 1,
    cornerRadius: style.cornerRadius ?? 0,
    opacity: style.opacity ?? 1
  };
}

/**
 * Create a path render command
 */
export function createPathCommand(
  path: string,
  style: {
    fill?: string;
    stroke?: string;
    strokeWidth?: number;
    opacity?: number;
  } = {}
): PathCommand {
  return {
    type: 'path',
    path,
    fill: style.fill,
    stroke: style.stroke,
    strokeWidth: style.strokeWidth ?? 1,
    opacity: style.opacity ?? 1
  };
}

/**
 * Create a text render command
 */
export function createTextCommand(
  content: string,
  position: { x: number; y: number },
  style: {
    color?: string;
    fontSize?: number;
    fontFamily?: string;
    alignment?: 'left' | 'center' | 'right';
    opacity?: number;
  } = {}
): TextCommand {
  return {
    type: 'text',
    content,
    position,
    color: style.color ?? '#000000',
    fontSize: style.fontSize ?? 12,
    fontFamily: style.fontFamily ?? 'System',
    alignment: style.alignment ?? 'left',
    opacity: style.opacity ?? 1
  };
}

/**
 * Create a group render command
 */
export function createGroupCommand(
  children: RenderCommand[],
  options: {
    transform?: {
      translateX?: number;
      translateY?: number;
      scaleX?: number;
      scaleY?: number;
      rotation?: number;
    };
    opacity?: number;
  } = {}
): GroupCommand {
  return {
    type: 'group',
    children,
    transform: options.transform,
    opacity: options.opacity ?? 1
  };
}