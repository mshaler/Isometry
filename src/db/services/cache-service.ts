/**
 * Database Cache Service
 */

import type { Database } from 'sql.js-fts5';
import type { CacheOptions } from '../types/service-types';

export class DatabaseCacheService {
  private cache = new Map<string, { data: any; timestamp: number }>;

  constructor(private db: Database) {}

  get(key: string): any {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    // Check TTL
    if (Date.now() - entry.timestamp > 300000) { // 5 minutes default
      this.cache.delete(key);
      return null;
    }
    
    return entry.data;
  }

  set(key: string, data: any, options?: CacheOptions): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  clear(): void {
    this.cache.clear();
  }
}
