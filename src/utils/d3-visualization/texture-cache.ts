/**
 * Canvas Texture Cache
 *
 * High-performance texture caching system for D3 canvas rendering.
 * Caches pre-rendered canvas textures to avoid redundant rendering operations.
 */

interface CachedTexture {
  canvas: OffscreenCanvas;
  ctx: OffscreenCanvasRenderingContext2D;
  width: number;
  height: number;
  lastUsed: number;
  cacheKey: string;
}

export class TextureCache {
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