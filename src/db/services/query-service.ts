/**
 * Database Query Service
 */

import type { Database } from 'sql.js-fts5';
import type { QueryOptions } from '../types/service-types';

export class DatabaseQueryService {
  constructor(private db: Database) {}

  async execute(sql: string, params?: unknown[]): Promise<any[]> {
    try {
      const result = this.db.exec(sql, params);
      return result[0]?.values || [];
    } catch (error) {
      throw new Error(`Query failed: ${error}`);
    }
  }

  async query(sql: string, params?: unknown[], options?: QueryOptions): Promise<any[]> {
    return this.execute(sql, params);
  }
}
