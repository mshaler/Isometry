/**
 * Object Pooling for Canvas Elements
 *
 * High-performance object pooling system for D3 canvas rendering.
 * Reduces garbage collection pressure by reusing objects.
 */

export interface PoolableCanvasElement {
  type: 'rect' | 'text' | 'circle' | 'path';
  x: number;
  y: number;
  width?: number;
  height?: number;
  style: Record<string, string | number>;
  text?: string;
  reset(): void;
}

export class CanvasElement implements PoolableCanvasElement {
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

export class ObjectPool<T> {
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