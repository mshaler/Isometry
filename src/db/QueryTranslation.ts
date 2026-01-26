/**
 * Query Translation and Optimization Layer
 *
 * Routes common React query patterns to optimized native endpoints while maintaining
 * sql.js compatibility for complex queries. Provides intelligent pattern matching
 * and fallback strategies for maximum performance and compatibility.
 */

export interface QueryAnalysis {
  sql: string;
  params: unknown[];
  patterns: QueryPattern[];
  complexity: 'simple' | 'complex';
  canOptimize: boolean;
  estimatedRows: number;
  hasJoins: boolean;
  hasFTS: boolean;
}

export interface QueryPattern {
  type: 'select_nodes' | 'select_notebook_cards' | 'select_search' | 'insert' | 'update' | 'delete' | 'complex';
  table?: string;
  filters?: Record<string, unknown>;
  orderBy?: string;
  limit?: number;
  confidence: number; // 0-1, how confident we are in this pattern match
}

export interface OptimizedCall {
  type: 'endpoint';
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  url: string;
  body?: unknown;
  expectedFormat: 'rows' | 'json';
}

export interface SQLCall {
  type: 'sql';
  sql: string;
  params: unknown[];
}

export type TranslationResult = OptimizedCall | SQLCall;

/**
 * Query Optimizer class for intelligent routing and analysis
 */
export class QueryOptimizer {
  private patterns: Map<RegExp, QueryPattern['type']> = new Map();
  private performanceThresholds = {
    maxSimpleRows: 1000,
    maxComplexityScore: 10,
    minConfidence: 0.8,
  };

  constructor() {
    this.initializePatterns();
  }

  private initializePatterns(): void {
    // Common React query patterns with regex matching
    this.patterns.set(
      /SELECT\s+\*\s+FROM\s+nodes\s+WHERE.*deleted_at\s+IS\s+NULL/i,
      'select_nodes'
    );
    this.patterns.set(
      /SELECT\s+\*\s+FROM\s+nodes\s+WHERE.*folder\s*=\s*\?/i,
      'select_nodes'
    );
    this.patterns.set(
      /SELECT\s+\*\s+FROM\s+notebook_cards.*ORDER\s+BY\s+modified_at/i,
      'select_notebook_cards'
    );
    this.patterns.set(
      /SELECT.*FROM.*MATCH\s*\(/i,
      'select_search'
    );
    this.patterns.set(
      /INSERT\s+INTO\s+nodes/i,
      'insert'
    );
    this.patterns.set(
      /UPDATE\s+nodes\s+SET.*WHERE\s+id\s*=\s*\?/i,
      'update'
    );
    this.patterns.set(
      /DELETE\s+FROM\s+nodes\s+WHERE\s+id\s*=\s*\?/i,
      'delete'
    );
  }

  /**
   * Analyze SQL query to determine optimization potential
   */
  analyzeQuery(sql: string, params: unknown[] = []): QueryAnalysis {
    const normalizedSQL = sql.trim().replace(/\s+/g, ' ');
    const patterns: QueryPattern[] = [];
    let complexity: 'simple' | 'complex' = 'simple';

    // Pattern matching
    for (const [regex, type] of this.patterns) {
      if (regex.test(normalizedSQL)) {
        patterns.push({
          type,
          confidence: this.calculateConfidence(normalizedSQL, type),
          ...this.extractPatternDetails(normalizedSQL, type, params),
        });
      }
    }

    // Complexity analysis
    const hasJoins = /\bJOIN\b/i.test(normalizedSQL);
    const hasFTS = /\bMATCH\b/i.test(normalizedSQL);
    const hasSubqueries = /\(\s*SELECT/i.test(normalizedSQL);
    const hasWindow = /\bOVER\s*\(/i.test(normalizedSQL);
    const hasRecursive = /\bWITH\s+RECURSIVE/i.test(normalizedSQL);

    if (hasJoins || hasSubqueries || hasWindow || hasRecursive) {
      complexity = 'complex';
    }

    const complexityScore = this.calculateComplexityScore(normalizedSQL);
    const estimatedRows = this.estimateResultSize(normalizedSQL, params);

    return {
      sql: normalizedSQL,
      params,
      patterns,
      complexity,
      canOptimize: this.shouldOptimize({
        sql: normalizedSQL,
        params,
        patterns,
        complexity,
        canOptimize: false, // Will be set by shouldOptimize
        estimatedRows,
        hasJoins,
        hasFTS,
      }),
      estimatedRows,
      hasJoins,
      hasFTS,
    };
  }

  /**
   * Determine if query should be optimized based on analysis
   */
  shouldOptimize(analysis: QueryAnalysis): boolean {
    // Don't optimize complex queries
    if (analysis.complexity === 'complex') {
      return false;
    }

    // Must have at least one confident pattern match
    const bestPattern = analysis.patterns.reduce((best, current) =>
      current.confidence > (best?.confidence || 0) ? current : best
    , null as QueryPattern | null);

    if (!bestPattern || bestPattern.confidence < this.performanceThresholds.minConfidence) {
      return false;
    }

    // Don't optimize very large result sets
    if (analysis.estimatedRows > this.performanceThresholds.maxSimpleRows) {
      return false;
    }

    // FTS queries should be optimized
    if (analysis.hasFTS) {
      return true;
    }

    // Simple CRUD operations should be optimized
    return ['select_nodes', 'select_notebook_cards', 'insert', 'update', 'delete'].includes(bestPattern.type);
  }

  /**
   * Translate query analysis to optimized endpoint call
   */
  translateToEndpoint(analysis: QueryAnalysis): OptimizedCall | null {
    if (!analysis.canOptimize) {
      return null;
    }

    const bestPattern = analysis.patterns.reduce((best, current) =>
      current.confidence > (best?.confidence || 0) ? current : best
    , null as QueryPattern | null);

    if (!bestPattern) {
      return null;
    }

    switch (bestPattern.type) {
      case 'select_nodes':
        return this.buildNodesEndpoint(analysis, bestPattern);

      case 'select_notebook_cards':
        return this.buildNotebookCardsEndpoint(analysis, bestPattern);

      case 'select_search':
        return this.buildSearchEndpoint(analysis, bestPattern);

      case 'insert':
        return this.buildInsertEndpoint(analysis, bestPattern);

      case 'update':
        return this.buildUpdateEndpoint(analysis, bestPattern);

      case 'delete':
        return this.buildDeleteEndpoint(analysis, bestPattern);

      default:
        return null;
    }
  }

  /**
   * Create fallback SQL execution call
   */
  fallbackToSQL(sql: string, params: unknown[] = []): SQLCall {
    return {
      type: 'sql',
      sql,
      params,
    };
  }

  private calculateConfidence(sql: string, type: QueryPattern['type']): number {
    let confidence = 0.5;

    switch (type) {
      case 'select_nodes':
        if (sql.includes('deleted_at IS NULL')) confidence += 0.3;
        if (sql.includes('ORDER BY modified_at')) confidence += 0.2;
        break;

      case 'select_notebook_cards':
        if (sql.includes('notebook_cards')) confidence += 0.4;
        if (sql.includes('ORDER BY')) confidence += 0.1;
        break;

      case 'select_search':
        if (sql.includes('MATCH(')) confidence += 0.4;
        if (sql.includes('fts_')) confidence += 0.1;
        break;

      case 'insert':
      case 'update':
      case 'delete':
        confidence += 0.3;
        break;
    }

    return Math.min(confidence, 1.0);
  }

  private extractPatternDetails(sql: string, type: QueryPattern['type'], params: unknown[]): Partial<QueryPattern> {
    const details: Partial<QueryPattern> = { type };

    // Extract table name
    const tableMatch = sql.match(/FROM\s+(\w+)/i);
    if (tableMatch) {
      details.table = tableMatch[1];
    }

    // Extract filters from WHERE clause
    if (sql.includes('folder =') && params.length > 0) {
      details.filters = { folder: params[0] };
    }

    // Extract ORDER BY
    const orderMatch = sql.match(/ORDER\s+BY\s+([\w_]+)/i);
    if (orderMatch) {
      details.orderBy = orderMatch[1];
    }

    // Extract LIMIT
    const limitMatch = sql.match(/LIMIT\s+(\d+)/i);
    if (limitMatch) {
      details.limit = parseInt(limitMatch[1], 10);
    }

    return details;
  }

  private calculateComplexityScore(sql: string): number {
    let score = 0;

    if (/\bJOIN\b/i.test(sql)) score += 3;
    if (/\bUNION\b/i.test(sql)) score += 2;
    if (/\(\s*SELECT/i.test(sql)) score += 3;
    if (/\bWITH\b/i.test(sql)) score += 4;
    if (/\bOVER\s*\(/i.test(sql)) score += 3;
    if (/\bCASE\s+WHEN/i.test(sql)) score += 1;

    return score;
  }

  private estimateResultSize(sql: string, params: unknown[]): number {
    // Simple heuristic estimation
    if (sql.includes('LIMIT')) {
      const limitMatch = sql.match(/LIMIT\s+(\d+)/i);
      return limitMatch ? parseInt(limitMatch[1], 10) : 100;
    }

    if (sql.includes('WHERE id =')) {
      return 1;
    }

    if (sql.includes('WHERE folder =')) {
      return 50;
    }

    if (sql.includes('MATCH(')) {
      return 25;
    }

    return 100; // Default estimate
  }

  private buildNodesEndpoint(analysis: QueryAnalysis, pattern: QueryPattern): OptimizedCall {
    const queryParams = new URLSearchParams();

    if (pattern.filters?.folder) {
      queryParams.set('folder', String(pattern.filters.folder));
    }

    if (pattern.orderBy) {
      queryParams.set('sort', pattern.orderBy);
    }

    if (pattern.limit) {
      queryParams.set('limit', String(pattern.limit));
    }

    const url = `/api/nodes${queryParams.toString() ? '?' + queryParams.toString() : ''}`;

    return {
      type: 'endpoint',
      method: 'GET',
      url,
      expectedFormat: 'rows',
    };
  }

  private buildNotebookCardsEndpoint(analysis: QueryAnalysis, pattern: QueryPattern): OptimizedCall {
    const queryParams = new URLSearchParams();

    if (pattern.filters?.folder) {
      queryParams.set('folder', String(pattern.filters.folder));
    }

    if (pattern.orderBy) {
      queryParams.set('sort', pattern.orderBy);
    }

    if (pattern.limit) {
      queryParams.set('limit', String(pattern.limit));
    }

    const url = `/api/notebook-cards${queryParams.toString() ? '?' + queryParams.toString() : ''}`;

    return {
      type: 'endpoint',
      method: 'GET',
      url,
      expectedFormat: 'rows',
    };
  }

  private buildSearchEndpoint(analysis: QueryAnalysis, pattern: QueryPattern): OptimizedCall {
    // Extract search query from MATCH() clause
    const matchPattern = /MATCH\s*\(\s*(['"])(.*?)\1\s*\)/i;
    const match = analysis.sql.match(matchPattern);
    const query = match ? match[2] : analysis.params[0]?.toString() || '';

    const queryParams = new URLSearchParams();
    queryParams.set('q', query);

    if (pattern.limit) {
      queryParams.set('limit', String(pattern.limit));
    }

    return {
      type: 'endpoint',
      method: 'GET',
      url: `/api/search?${queryParams.toString()}`,
      expectedFormat: 'rows',
    };
  }

  private buildInsertEndpoint(analysis: QueryAnalysis, pattern: QueryPattern): OptimizedCall {
    return {
      type: 'endpoint',
      method: 'POST',
      url: `/api/${pattern.table}`,
      body: this.extractInsertData(analysis),
      expectedFormat: 'json',
    };
  }

  private buildUpdateEndpoint(analysis: QueryAnalysis, pattern: QueryPattern): OptimizedCall {
    const id = this.extractIdFromParams(analysis.params);
    return {
      type: 'endpoint',
      method: 'PUT',
      url: `/api/${pattern.table}/${id}`,
      body: this.extractUpdateData(analysis),
      expectedFormat: 'json',
    };
  }

  private buildDeleteEndpoint(analysis: QueryAnalysis, pattern: QueryPattern): OptimizedCall {
    const id = this.extractIdFromParams(analysis.params);
    return {
      type: 'endpoint',
      method: 'DELETE',
      url: `/api/${pattern.table}/${id}`,
      expectedFormat: 'json',
    };
  }

  private extractInsertData(analysis: QueryAnalysis): Record<string, unknown> {
    // Simple extraction - would need more sophisticated parsing for production
    return Object.fromEntries(
      analysis.params.map((param, index) => [`field_${index}`, param])
    );
  }

  private extractUpdateData(analysis: QueryAnalysis): Record<string, unknown> {
    // Simple extraction - would need more sophisticated parsing for production
    const params = analysis.params.slice(0, -1); // Last param is usually the ID
    return Object.fromEntries(
      params.map((param, index) => [`field_${index}`, param])
    );
  }

  private extractIdFromParams(params: unknown[]): string {
    // ID is typically the last parameter in UPDATE/DELETE queries
    return String(params[params.length - 1] || '');
  }
}

/**
 * Main translation function - analyze and route query optimally
 */
export function translateQuery(sql: string, params: unknown[] = []): TranslationResult {
  const optimizer = new QueryOptimizer();
  const analysis = optimizer.analyzeQuery(sql, params);

  if (process.env.NODE_ENV === 'development') {
    console.log('Query Analysis:', {
      sql: sql.substring(0, 100) + (sql.length > 100 ? '...' : ''),
      canOptimize: analysis.canOptimize,
      complexity: analysis.complexity,
      patterns: analysis.patterns.map(p => ({ type: p.type, confidence: p.confidence })),
    });
  }

  if (analysis.canOptimize) {
    const optimized = optimizer.translateToEndpoint(analysis);
    if (optimized) {
      return optimized;
    }
  }

  return optimizer.fallbackToSQL(sql, params);
}

/**
 * Convenience function to check if query should be optimized
 */
export function shouldOptimize(sql: string, params: unknown[] = []): boolean {
  const optimizer = new QueryOptimizer();
  const analysis = optimizer.analyzeQuery(sql, params);
  return analysis.canOptimize;
}

/**
 * Export the main optimizer instance for advanced usage
 */
export const queryOptimizer = new QueryOptimizer();