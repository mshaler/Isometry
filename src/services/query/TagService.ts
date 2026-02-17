/**
 * TagService - Query and cache tags from the database
 *
 * Phase 97-02: Provides tag suggestions for hashtag autocomplete
 */

import type { Database as SqlJsDatabase } from 'sql.js';

export interface TagServiceOptions {
  /** Cache TTL in milliseconds (default: 60000 = 1 minute) */
  cacheTTL?: number;
  /** Maximum results to return (default: 10) */
  maxResults?: number;
}

/**
 * Service for querying tags from the nodes table
 */
export class TagService {
  private cache: string[] | null = null;
  private cacheExpiry: number = 0;
  private readonly cacheTTL: number;
  private readonly maxResults: number;

  constructor(options: TagServiceOptions = {}) {
    this.cacheTTL = options.cacheTTL ?? 60000;
    this.maxResults = options.maxResults ?? 10;
  }

  /**
   * Get all unique tags from the database
   */
  getAllTags(db: SqlJsDatabase | null): string[] {
    if (!db) return [];

    const now = Date.now();
    if (this.cache && now < this.cacheExpiry) {
      return this.cache;
    }

    try {
      // Query distinct tags from nodes.tags (JSON array)
      const results = db.exec(`
        SELECT DISTINCT value as tag
        FROM nodes, json_each(nodes.tags)
        WHERE nodes.deleted_at IS NULL
          AND value IS NOT NULL
          AND value != ''
        ORDER BY tag COLLATE NOCASE
      `);

      const tags = results[0]?.values.map(row => String(row[0])) || [];
      this.cache = tags;
      this.cacheExpiry = now + this.cacheTTL;

      return tags;
    } catch (error) {
      console.error('TagService.getAllTags error:', error);
      return this.cache || [];
    }
  }

  /**
   * Search tags by query string (case-insensitive prefix match)
   */
  searchTags(db: SqlJsDatabase | null, query: string): string[] {
    const allTags = this.getAllTags(db);

    if (!query) {
      return allTags.slice(0, this.maxResults);
    }

    const lowerQuery = query.toLowerCase();
    return allTags
      .filter(tag => tag.toLowerCase().startsWith(lowerQuery))
      .slice(0, this.maxResults);
  }

  /**
   * Check if a tag exists
   */
  hasTag(db: SqlJsDatabase | null, tag: string): boolean {
    const allTags = this.getAllTags(db);
    return allTags.some(t => t.toLowerCase() === tag.toLowerCase());
  }

  /**
   * Invalidate the cache (call after tag changes)
   */
  invalidateCache(): void {
    this.cache = null;
    this.cacheExpiry = 0;
  }
}

// Singleton instance for global use
export const tagService = new TagService();
