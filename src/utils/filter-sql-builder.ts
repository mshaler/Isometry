import type { FilterState, CompiledQuery } from '@/types/filter';

/**
 * filter-sql-builder.ts
 *
 * Builds SQL WHERE clauses from LATCH filter state.
 * CRITICAL: Uses parameterized queries to prevent SQL injection.
 *
 * Security:
 * - ALWAYS use ? placeholders for user input
 * - NEVER concatenate user input into SQL strings
 * - Returns { sql, params } tuple for safe query execution
 *
 * Performance:
 * - Uses FTS5 for Alphabet (full-text search)
 * - Uses indexes for Time range queries
 * - Uses recursive CTEs for Hierarchy (when needed)
 */

/**
 * Build SQL WHERE clause from filter state
 *
 * @param filters - Current filter state (LATCH axes)
 * @returns { sql: string, params: any[] } - SQL fragment and params for safe execution
 */
export function buildFilterSQL(filters: FilterState): CompiledQuery {
  const conditions: string[] = [];
  const params: (string | number | boolean | null)[] = [];

  // Location filter
  if (filters.location) {
    const loc = filters.location;
    if (loc.type === 'point' && loc.latitude !== undefined && loc.longitude !== undefined) {
      // For MVP: simple point check (future: radius search)
      conditions.push('latitude = ? AND longitude = ?');
      params.push(loc.latitude, loc.longitude);
    } else if (loc.type === 'box') {
      // Bounding box filter
      if (loc.north !== undefined && loc.south !== undefined && loc.east !== undefined && loc.west !== undefined) {
        conditions.push('latitude BETWEEN ? AND ? AND longitude BETWEEN ? AND ?');
        params.push(loc.south, loc.north, loc.west, loc.east);
      }
    } else if (loc.type === 'radius') {
      // Radius search (requires Haversine formula or SQLite extension)
      // For MVP: placeholder (future: use spatialite extension)
      if (loc.centerLat !== undefined && loc.centerLon !== undefined && loc.radiusKm !== undefined) {
        conditions.push('1 = 1'); // Placeholder - implement Haversine in Wave 4
        // Future: Use spatialite or Haversine formula
      }
    }
  }

  // Alphabet filter (text search)
  if (filters.alphabet) {
    const alpha = filters.alphabet;
    if (alpha.type === 'search' && alpha.value) {
      // Use FTS5 for fast full-text search with relevance ranking
      const fts5Query = buildFTS5Query(alpha.value);
      if (fts5Query) {
        // Join with FTS5 virtual table for fast search
        conditions.push('id IN (SELECT rowid FROM nodes_fts WHERE nodes_fts MATCH ?)');
        params.push(fts5Query);
      } else {
        // Fallback to LIKE if query is invalid
        conditions.push('(name LIKE ? OR content LIKE ?)');
        const searchTerm = `%${alpha.value}%`;
        params.push(searchTerm, searchTerm);
      }
    } else if (alpha.type === 'startsWith' && alpha.value) {
      // Prefix search (efficient with indexes)
      conditions.push('name LIKE ?');
      params.push(`${alpha.value}%`);
    } else if (alpha.type === 'range' && alpha.value) {
      // Alphabetic range (A-F, G-M, etc.)
      const end = String.fromCharCode(alpha.value.charCodeAt(0) + 1);
      conditions.push('name >= ? AND name < ?');
      params.push(alpha.value, end);
    }
  }

  // Time filter
  if (filters.time) {
    const time = filters.time;
    const field = time.field === 'created' ? 'created_at' :
                  time.field === 'modified' ? 'modified_at' :
                  'due_at';

    if (time.type === 'range') {
      if (time.start && time.end) {
        conditions.push(`${field} BETWEEN ? AND ?`);
        params.push(time.start, time.end);
      } else if (time.start) {
        conditions.push(`${field} >= ?`);
        params.push(time.start);
      } else if (time.end) {
        conditions.push(`${field} <= ?`);
        params.push(time.end);
      }
    } else if (time.type === 'preset') {
      // Preset time ranges (today, this-week, etc.)
      const { start, end } = resolveTimePreset(time.preset);
      if (start && end) {
        conditions.push(`${field} BETWEEN ? AND ?`);
        params.push(start, end);
      } else if (start) {
        conditions.push(`${field} >= ?`);
        params.push(start);
      } else if (end) {
        conditions.push(`${field} <= ?`);
        params.push(end);
      }
    } else if (time.type === 'relative' && time.amount && time.unit) {
      // Relative time (last 7 days, next 30 days, etc.)
      const { start, end } = resolveRelativeTime(time.amount, time.unit, time.direction || 'past');
      conditions.push(`${field} BETWEEN ? AND ?`);
      params.push(start, end);
    }
  }

  // Category filter
  if (filters.category) {
    const cat = filters.category;
    const categoryConditions: string[] = [];

    if (cat.tags && cat.tags.length > 0) {
      // Tag filter using JSON array contains
      // For each tag, check if it exists in the tags JSON array
      const tagPlaceholders = cat.tags.map(() => '?').join(', ');
      categoryConditions.push(`EXISTS (
        SELECT 1 FROM json_each(tags)
        WHERE value IN (${tagPlaceholders})
      )`);
      params.push(...cat.tags);
    }

    if (cat.folders && cat.folders.length > 0) {
      const folderPlaceholders = cat.folders.map(() => '?').join(', ');
      categoryConditions.push(`folder IN (${folderPlaceholders})`);
      params.push(...cat.folders);
    }

    if (cat.statuses && cat.statuses.length > 0) {
      const statusPlaceholders = cat.statuses.map(() => '?').join(', ');
      categoryConditions.push(`status IN (${statusPlaceholders})`);
      params.push(...cat.statuses);
    }

    if (cat.nodeTypes && cat.nodeTypes.length > 0) {
      const typePlaceholders = cat.nodeTypes.map(() => '?').join(', ');
      categoryConditions.push(`node_type IN (${typePlaceholders})`);
      params.push(...cat.nodeTypes);
    }

    if (categoryConditions.length > 0) {
      const operator = cat.type === 'include' ? 'OR' : 'AND NOT';
      conditions.push(`(${categoryConditions.join(` ${operator} `)})`);
    }
  }

  // Hierarchy filter
  if (filters.hierarchy) {
    const hier = filters.hierarchy;

    if (hier.type === 'priority') {
      // Priority-based filtering
      if (hier.minPriority !== undefined && hier.maxPriority !== undefined) {
        conditions.push('priority BETWEEN ? AND ?');
        params.push(hier.minPriority, hier.maxPriority);
      } else if (hier.minPriority !== undefined) {
        conditions.push('priority >= ?');
        params.push(hier.minPriority);
      } else if (hier.maxPriority !== undefined) {
        conditions.push('priority <= ?');
        params.push(hier.maxPriority);
      }
    } else if (hier.type === 'top-n' && hier.limit) {
      // Top N by sort order (handled in LIMIT clause, not WHERE)
      // This affects the query structure, not just WHERE clause
      // Will be handled by the query executor
    }
  }

  // Combine all conditions
  const sql = conditions.length > 0 ? conditions.join(' AND ') : '1 = 1';

  return { sql, params };
}

/**
 * Resolve time preset to actual date range
 */
function resolveTimePreset(preset: string | undefined): { start?: string; end?: string } {
  if (!preset) return {};

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch (preset) {
    case 'today':
      return {
        start: today.toISOString(),
        end: new Date(today.getTime() + 86400000).toISOString(),
      };
    case 'yesterday': {
      const yesterday = new Date(today.getTime() - 86400000);
      return {
        start: yesterday.toISOString(),
        end: today.toISOString(),
      };
    }
    case 'this-week': {
      const weekStart = new Date(today.getTime() - today.getDay() * 86400000);
      return {
        start: weekStart.toISOString(),
        end: now.toISOString(),
      };
    }
    case 'last-7-days':
      return {
        start: new Date(now.getTime() - 7 * 86400000).toISOString(),
        end: now.toISOString(),
      };
    case 'last-30-days':
      return {
        start: new Date(now.getTime() - 30 * 86400000).toISOString(),
        end: now.toISOString(),
      };
    case 'last-90-days':
      return {
        start: new Date(now.getTime() - 90 * 86400000).toISOString(),
        end: now.toISOString(),
      };
    case 'this-month': {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      return {
        start: monthStart.toISOString(),
        end: now.toISOString(),
      };
    }
    case 'this-year': {
      const yearStart = new Date(now.getFullYear(), 0, 1);
      return {
        start: yearStart.toISOString(),
        end: now.toISOString(),
      };
    }
    default:
      return {};
  }
}

/**
 * Resolve relative time to date range
 */
function resolveRelativeTime(
  amount: number,
  unit: 'day' | 'week' | 'month' | 'year',
  direction: 'past' | 'future'
): { start: string; end: string } {
  const now = new Date();
  const multiplier = direction === 'past' ? -1 : 1;

  let offsetMs = 0;
  switch (unit) {
    case 'day':
      offsetMs = amount * 86400000;
      break;
    case 'week':
      offsetMs = amount * 7 * 86400000;
      break;
    case 'month':
      offsetMs = amount * 30 * 86400000; // Approximate
      break;
    case 'year':
      offsetMs = amount * 365 * 86400000; // Approximate
      break;
  }

  const targetDate = new Date(now.getTime() + multiplier * offsetMs);

  if (direction === 'past') {
    return {
      start: targetDate.toISOString(),
      end: now.toISOString(),
    };
  } else {
    return {
      start: now.toISOString(),
      end: targetDate.toISOString(),
    };
  }
}

/**
 * Build FTS5 MATCH query with operator support
 *
 * FTS5 Syntax:
 * - Prefix search: "test*" (matches test, testing, tester)
 * - Phrase search: "exact phrase" (matches exact phrase)
 * - AND operator: "foo AND bar" or just "foo bar" (both terms required)
 * - OR operator: "foo OR bar" (either term)
 * - NOT operator: "foo NOT bar" or "-bar" (exclude term)
 * - Column filter: "name:test" (search only in name column)
 * - Parentheses: "(foo OR bar) AND baz" (complex logic)
 *
 * Security: Escapes FTS5 special characters to prevent query syntax errors
 *
 * @param input - User search query
 * @returns FTS5 MATCH query string, or null if invalid
 */
function buildFTS5Query(input: string): string | null {
  if (!input || input.trim().length === 0) {
    return null;
  }

  // Trim and truncate very long queries
  let query = input.trim();
  if (query.length > 200) {
    query = query.substring(0, 200);
  }

  // Check if query looks like FTS5 syntax (has operators or quotes)
  const hasOperators = /\b(AND|OR|NOT)\b|["*()-]/.test(query);

  if (hasOperators) {
    // User is using FTS5 operators, validate and sanitize
    try {
      // Basic validation: balanced quotes and parentheses
      const quoteCount = (query.match(/"/g) || []).length;
      const openParen = (query.match(/\(/g) || []).length;
      const closeParen = (query.match(/\)/g) || []).length;

      if (quoteCount % 2 !== 0) {
        // Unbalanced quotes - add closing quote
        query += '"';
      }

      if (openParen !== closeParen) {
        // Unbalanced parentheses - fallback to simple search
        return escapeFTS5Simple(query);
      }

      // Return as-is (user knows what they're doing)
      return query;
    } catch (e) {
      // Invalid syntax - fallback to simple search
      return escapeFTS5Simple(query);
    }
  } else {
    // Simple search - escape special chars and search all terms
    return escapeFTS5Simple(query);
  }
}

/**
 * Escape query for simple FTS5 search (no operators)
 * Treats each word as a separate term with implicit AND
 */
function escapeFTS5Simple(input: string): string {
  // Split into words
  const words = input.trim().split(/\s+/);

  // Escape FTS5 special characters in each word
  const escapedWords = words.map(word => {
    // Escape quotes and special FTS5 chars
    return word.replace(/["*()-]/g, '');
  }).filter(word => word.length > 0);

  if (escapedWords.length === 0) {
    return '';
  }

  // Join with implicit AND (space)
  return escapedWords.join(' ');
}
