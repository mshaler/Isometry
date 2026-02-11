/**
 * Database Query Service
 */

import type { Database } from 'sql.js-fts5';
import type { BindParams } from 'sql.js';
import type { QueryOptions } from '../types/service-types';

export class DatabaseQueryService {
  constructor(private db: Database) {}

  async execute(sql: string, params?: BindParams): Promise<unknown[]> {
    try {
      const result = this.db.exec(sql, params);
      return result[0]?.values || [];
    } catch (error) {
      throw new Error(`Query failed: ${error}`);
    }
  }

  async query(sql: string, params?: BindParams, _options?: QueryOptions): Promise<unknown[]> {
    return this.execute(sql, params);
  }
}
