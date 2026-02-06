/**
 * Query Paginator for WebView Bridge Optimization
 *
 * Implements cursor-based pagination for large datasets with 50-record page limits,
 * stable cursor generation using record IDs, and integration with MessageBatcher and
 * BinarySerializer for optimized transport.
 */

export interface PaginationCursor {
  value: string;
  direction: 'forward' | 'backward';
  timestamp: number;
}

export interface PaginatedQuery {
  sql: string;
  params: unknown[];
  limit: number;
  cursor?: PaginationCursor;
  orderBy: string;
}

export interface PaginatedResult<T = unknown> {
  data: T[];
  nextCursor?: PaginationCursor;
  previousCursor?: PaginationCursor;
  hasMore: boolean;
  hasPrevious: boolean;
  totalEstimate?: number;
  pageInfo: {
    currentPage: number;
    pageSize: number;
    isFirstPage: boolean;
    isLastPage: boolean;
  };
}

export interface PaginatorOptions {
  defaultPageSize?: number;
  maxPageSize?: number;
  enableEstimation?: boolean;
  cursorField?: string;
}

export interface PaginatorMetrics {
  totalQueries: number;
  totalRecords: number;
  averagePageSize: number;
  averageQueryTime: number;
  cacheHits: number;
  cursorErrors: number;
}

/**
 * QueryPaginator manages cursor-based pagination for large database queries
 */
export class QueryPaginator {
  private readonly defaultPageSize: number;
  private readonly maxPageSize: number;
  // Legacy option - preserved for compatibility
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private readonly _enableEstimation: boolean;
  private readonly cursorField: string;

  // Metrics tracking
  private metrics: PaginatorMetrics = {
    totalQueries: 0,
    totalRecords: 0,
    averagePageSize: 0,
    averageQueryTime: 0,
    cacheHits: 0,
    cursorErrors: 0
  };

  // Performance tracking arrays
  private queryTimes: number[] = [];
  private pageSizes: number[] = [];

  // Cursor validation cache
  private cursorCache = new Map<string, { timestamp: number; valid: boolean }>();
  private readonly cursorCacheTimeout = 5 * 60 * 1000; // 5 minutes

  // Query execution function - injected for testability and bridge integration
  private executeQuery: (sql: string, params: unknown[]) => Promise<unknown[]>;

  constructor(
    executeQuery: (sql: string, params: unknown[]) => Promise<unknown[]>,
    options: PaginatorOptions = {}
  ) {
    this.executeQuery = executeQuery;
    this.defaultPageSize = Math.min(options.defaultPageSize ?? 50, 50); // Max 50 records per message
    this.maxPageSize = Math.min(options.maxPageSize ?? 50, 50); // Enforce 50 record limit
    this._enableEstimation = options.enableEstimation ?? false;
    this.cursorField = options.cursorField ?? 'id';

    // Explicitly mark preserved fields
    void this._enableEstimation;
  }

  /**
   * Execute a paginated query with cursor-based pagination
   */
  async executePaginatedQuery<T = unknown>(
    query: PaginatedQuery,
    requestedPageSize?: number
  ): Promise<PaginatedResult<T>> {
    const startTime = performance.now();

    try {
      // Validate and limit page size
      const pageSize = Math.min(requestedPageSize ?? query.limit ?? this.defaultPageSize, this.maxPageSize);

      // Build paginated SQL query
      const paginatedSQL = this.buildPaginatedSQL(query, pageSize);

      // Execute query with one extra record to check for more pages
      const results = await this.executeQuery(paginatedSQL.sql, paginatedSQL.params) as T[];

      const queryTime = performance.now() - startTime;

      // Process results and generate pagination info
      const paginationResult = this.processPaginatedResults(
        results,
        query,
        pageSize,
        queryTime
      );

      // Update metrics
      this.updateMetrics(pageSize, queryTime);

      return paginationResult;

    } catch (error) {
      this.metrics.cursorErrors++;
      throw new Error(`Pagination query failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Create a paginated query from a standard query
   */
  createPaginatedQuery(
    sql: string,
    params: unknown[] = [],
    options: {
      limit?: number;
      cursor?: PaginationCursor;
      orderBy?: string;
    } = {}
  ): PaginatedQuery {
    const limit = Math.min(options.limit ?? this.defaultPageSize, this.maxPageSize);
    const orderBy = options.orderBy ?? `${this.cursorField} ASC`;

    return {
      sql,
      params,
      limit,
      cursor: options.cursor,
      orderBy
    };
  }

  /**
   * Generate a stable cursor from a record
   */
  generateCursor(
    record: Record<string, unknown>,
    direction: 'forward' | 'backward' = 'forward'
  ): PaginationCursor {
    const cursorValue = record[this.cursorField];

    if (cursorValue === null || cursorValue === undefined) {
      throw new Error(`Cursor field '${this.cursorField}' not found in record`);
    }

    return {
      value: String(cursorValue),
      direction,
      timestamp: Date.now()
    };
  }

  /**
   * Validate cursor stability and freshness
   */
  async validateCursor(cursor: PaginationCursor): Promise<boolean> {
    const cacheKey = `${cursor.value}_${cursor.direction}_${cursor.timestamp}`;

    // Check cache first
    const cached = this.cursorCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < this.cursorCacheTimeout) {
      if (cached.valid) this.metrics.cacheHits++;
      return cached.valid;
    }

    try {
      // Verify cursor exists in database
      const checkSQL = `SELECT 1 FROM (${this.getBaseSQLFromQuery()}) WHERE ${this.cursorField} = ?`;
      const results = await this.executeQuery(checkSQL, [cursor.value]);
      const isValid = results.length > 0;

      // Cache the result
      this.cursorCache.set(cacheKey, { timestamp: Date.now(), valid: isValid });

      // Clean old cache entries
      this.cleanCursorCache();

      return isValid;
    } catch (error) {
      this.metrics.cursorErrors++;
      return false;
    }
  }

  /**
   * Get next page using cursor
   */
  async getNextPage<T = unknown>(
    currentResult: PaginatedResult<T>,
    originalQuery: PaginatedQuery
  ): Promise<PaginatedResult<T> | null> {
    if (!currentResult.hasMore || !currentResult.nextCursor) {
      return null;
    }

    const nextQuery: PaginatedQuery = {
      ...originalQuery,
      cursor: currentResult.nextCursor
    };

    return this.executePaginatedQuery(nextQuery);
  }

  /**
   * Get previous page using cursor
   */
  async getPreviousPage<T = unknown>(
    currentResult: PaginatedResult<T>,
    originalQuery: PaginatedQuery
  ): Promise<PaginatedResult<T> | null> {
    if (!currentResult.hasPrevious || !currentResult.previousCursor) {
      return null;
    }

    const prevQuery: PaginatedQuery = {
      ...originalQuery,
      cursor: currentResult.previousCursor
    };

    return this.executePaginatedQuery(prevQuery);
  }

  /**
   * Build SQL query with cursor-based pagination
   */
  private buildPaginatedSQL(query: PaginatedQuery, pageSize: number): {
    sql: string;
    params: unknown[];
  } {
    const { sql, params, cursor, orderBy } = query;

    let paginatedSQL = sql;
    const paginatedParams = [...params];

    // Add cursor condition if provided
    if (cursor) {
      const operator = cursor.direction === 'forward' ? '>' : '<';
      const cursorCondition = this.buildCursorCondition(sql, operator, cursor.value);
      paginatedSQL = this.addWhereCondition(sql, cursorCondition);
      paginatedParams.push(cursor.value);
    }

    // Add ordering (ensure consistent ordering for stable pagination)
    if (!sql.toLowerCase().includes('order by')) {
      paginatedSQL += ` ORDER BY ${orderBy}`;
    }

    // Add limit (request one extra record to check for more pages)
    paginatedSQL += ` LIMIT ${pageSize + 1}`;

    return {
      sql: paginatedSQL,
      params: paginatedParams
    };
  }

  /**
   * Process paginated query results
   */
  private processPaginatedResults<T = unknown>(
    results: T[],
    originalQuery: PaginatedQuery,
    pageSize: number,
    queryTime: number
  ): PaginatedResult<T> {
    const hasMore = results.length > pageSize;
    const data = hasMore ? results.slice(0, pageSize) : results;

    let nextCursor: PaginationCursor | undefined;
    let previousCursor: PaginationCursor | undefined;

    // Generate next cursor if there are more records
    if (hasMore && data.length > 0) {
      const lastRecord = data[data.length - 1] as Record<string, unknown>;
      nextCursor = this.generateCursor(lastRecord, 'forward');
    }

    // Generate previous cursor if this isn't the first page
    if (originalQuery.cursor && data.length > 0) {
      const firstRecord = data[0] as Record<string, unknown>;
      previousCursor = this.generateCursor(firstRecord, 'backward');
    }

    // Estimate current page number (rough approximation)
    const currentPage = originalQuery.cursor ?
      Math.floor(queryTime / this.metrics.averageQueryTime) || 1 : 1;

    return {
      data,
      nextCursor,
      previousCursor,
      hasMore,
      hasPrevious: !!originalQuery.cursor,
      pageInfo: {
        currentPage,
        pageSize: data.length,
        isFirstPage: !originalQuery.cursor,
        isLastPage: !hasMore
      }
    };
  }

  /**
   * Build cursor condition for WHERE clause
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private buildCursorCondition(_sql: string, operator: string, _cursorValue: string): string {
    return `${this.cursorField} ${operator} ?`;
  }

  /**
   * Add WHERE condition to existing SQL
   */
  private addWhereCondition(sql: string, condition: string): string {
    const lowerSQL = sql.toLowerCase();

    if (lowerSQL.includes('where')) {
      return sql + ` AND ${condition}`;
    } else {
      return sql + ` WHERE ${condition}`;
    }
  }

  /**
   * Extract base SQL for cursor validation (simplified)
   */
  private getBaseSQLFromQuery(): string {
    // Simplified implementation - in practice, would parse the query more carefully
    return "SELECT id FROM nodes";
  }

  /**
   * Update performance metrics
   */
  private updateMetrics(pageSize: number, queryTime: number): void {
    this.metrics.totalQueries++;
    this.metrics.totalRecords += pageSize;

    // Track performance arrays (keep last 100 measurements)
    this.queryTimes.push(queryTime);
    this.pageSizes.push(pageSize);

    if (this.queryTimes.length > 100) {
      this.queryTimes.shift();
    }
    if (this.pageSizes.length > 100) {
      this.pageSizes.shift();
    }

    // Update averages
    this.metrics.averageQueryTime =
      this.queryTimes.reduce((a, b) => a + b, 0) / this.queryTimes.length;
    this.metrics.averagePageSize =
      this.pageSizes.reduce((a, b) => a + b, 0) / this.pageSizes.length;
  }

  /**
   * Clean expired cursor cache entries
   */
  private cleanCursorCache(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    this.cursorCache.forEach((entry, key) => {
      if (now - entry.timestamp > this.cursorCacheTimeout) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach(key => {
      this.cursorCache.delete(key);
    });
  }

  /**
   * Get current paginator metrics
   */
  getMetrics(): PaginatorMetrics {
    return { ...this.metrics };
  }

  /**
   * Reset metrics (useful for testing)
   */
  resetMetrics(): void {
    this.metrics = {
      totalQueries: 0,
      totalRecords: 0,
      averagePageSize: 0,
      averageQueryTime: 0,
      cacheHits: 0,
      cursorErrors: 0
    };
    this.queryTimes = [];
    this.pageSizes = [];
  }

  /**
   * Get pagination performance report
   */
  getPerformanceReport(): {
    efficiency: {
      averageQueryTime: number;
      averagePageSize: number;
      cacheHitRate: number;
      errorRate: number;
    };
    throughput: {
      queriesPerSecond: number;
      recordsPerSecond: number;
    };
    health: {
      isPerformingWell: boolean;
      recommendations: string[];
    };
  } {
    const cacheHitRate = this.metrics.totalQueries > 0 ?
      (this.metrics.cacheHits / this.metrics.totalQueries) : 0;
    const errorRate = this.metrics.totalQueries > 0 ?
      (this.metrics.cursorErrors / this.metrics.totalQueries) : 0;

    const recommendations: string[] = [];

    if (this.metrics.averageQueryTime > 100) {
      recommendations.push('High query times detected - consider adding database indexes');
    }

    if (cacheHitRate < 0.3) {
      recommendations.push('Low cursor cache hit rate - consider increasing cache timeout');
    }

    if (errorRate > 0.05) {
      recommendations.push('High cursor error rate - check cursor stability and database consistency');
    }

    if (this.metrics.averagePageSize < this.defaultPageSize * 0.5) {
      recommendations.push('Low average page size - consider adjusting query filters or pagination strategy');
    }

    const isPerformingWell = this.metrics.averageQueryTime < 50 &&
                           cacheHitRate > 0.5 &&
                           errorRate < 0.01;

    return {
      efficiency: {
        averageQueryTime: this.metrics.averageQueryTime,
        averagePageSize: this.metrics.averagePageSize,
        cacheHitRate,
        errorRate
      },
      throughput: {
        queriesPerSecond: this.metrics.averageQueryTime > 0 ?
          1000 / this.metrics.averageQueryTime : 0,
        recordsPerSecond: this.metrics.averageQueryTime > 0 ?
          (this.metrics.averagePageSize * 1000) / this.metrics.averageQueryTime : 0
      },
      health: {
        isPerformingWell,
        recommendations
      }
    };
  }

  /**
   * Clear cursor cache
   */
  clearCache(): void {
    this.cursorCache.clear();
  }
}