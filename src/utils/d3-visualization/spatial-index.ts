/**
 * Spatial Indexing for Hit Testing
 *
 * Efficient spatial data structure for fast collision detection and hit testing
 * in D3 visualizations. Optimized for point queries and range queries.
 */

interface SpatialItem {
  id: string;
  bounds: { x: number; y: number; width: number; height: number };
  data: unknown;
}

export class SpatialIndex {
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
export type { SpatialItem };