import type { FilterState, CompiledQuery, AlphabetFilter, TimeFilter, CategoryFilter, HierarchyFilter, TimePreset, LocationFilter } from '../types/filter';

export function compileFilters(filters: FilterState): CompiledQuery {
  const conditions: string[] = [];
  const params: (string | number | boolean | null)[] = [];

  // Always exclude deleted
  conditions.push('deleted_at IS NULL');

  // Location filter
  if (filters.location) {
    const locationSQL = compileLocationFilter(filters.location);
    if (locationSQL.sql) {
      conditions.push(locationSQL.sql);
      params.push(...locationSQL.params);
    }
  }

  // Alphabet filter (text search with FTS5)
  if (filters.alphabet) {
    const alphabetSQL = compileAlphabetFilter(filters.alphabet);
    if (alphabetSQL.sql) {
      conditions.push(alphabetSQL.sql);
      params.push(...alphabetSQL.params);
    }
  }

  // Category filter
  if (filters.category) {
    const categorySQL = compileCategoryFilter(filters.category);
    if (categorySQL.sql) {
      conditions.push(categorySQL.sql);
      params.push(...categorySQL.params);
    }
  }

  // Time filter
  if (filters.time) {
    const timeSQL = compileTimeFilter(filters.time);
    if (timeSQL.sql) {
      conditions.push(timeSQL.sql);
      params.push(...timeSQL.params);
    }
  }

  // Hierarchy filter
  if (filters.hierarchy) {
    const hierarchySQL = compileHierarchyFilter(filters.hierarchy);
    if (hierarchySQL.sql) {
      conditions.push(hierarchySQL.sql);
      params.push(...hierarchySQL.params);
    }
  }

  return {
    sql: conditions.join(' AND '),
    params,
  };
}

function compileLocationFilter(filter: LocationFilter): CompiledQuery {
  // For MVP: Use bounding box (fast, indexed)
  // Future: Use spatialite extension for accurate radius queries

  if (filter.type === 'box' && filter.north != null && filter.south != null && filter.east != null && filter.west != null) {
    // Bounding box query
    return {
      sql: 'latitude BETWEEN ? AND ? AND longitude BETWEEN ? AND ?',
      params: [filter.south, filter.north, filter.west, filter.east],
    };
  } else if (filter.type === 'radius' && filter.centerLat != null && filter.centerLon != null && filter.radiusKm != null) {
    // Convert radius to approximate bounding box
    // 1 degree latitude ≈ 111km
    // 1 degree longitude varies by latitude (cos adjustment)
    const latDelta = filter.radiusKm / 111;
    const lngDelta = filter.radiusKm / (111 * Math.cos((filter.centerLat * Math.PI) / 180));

    const south = filter.centerLat - latDelta;
    const north = filter.centerLat + latDelta;
    const west = filter.centerLon - lngDelta;
    const east = filter.centerLon + lngDelta;

    return {
      sql: 'latitude BETWEEN ? AND ? AND longitude BETWEEN ? AND ?',
      params: [south, north, west, east],
    };
  } else if (filter.type === 'point' && filter.latitude != null && filter.longitude != null) {
    // Exact point match (unlikely, but supported)
    return {
      sql: 'latitude = ? AND longitude = ?',
      params: [filter.latitude, filter.longitude],
    };
  }

  return { sql: '', params: [] };
}

function compileAlphabetFilter(filter: AlphabetFilter): CompiledQuery {
  if (filter.type === 'search' && filter.value) {
    // Use FTS5 for fast full-text search with relevance ranking
    const fts5Query = buildFTS5Query(filter.value);
    if (fts5Query) {
      // Join with FTS5 virtual table for fast search
      return {
        sql: 'id IN (SELECT rowid FROM nodes_fts WHERE nodes_fts MATCH ?)',
        params: [fts5Query],
      };
    } else {
      // Fallback to LIKE if query is invalid
      const searchTerm = `%${filter.value}%`;
      return {
        sql: '(name LIKE ? OR content LIKE ?)',
        params: [searchTerm, searchTerm],
      };
    }
  } else if (filter.type === 'startsWith' && filter.value) {
    // Prefix search (efficient with indexes)
    return {
      sql: 'name LIKE ?',
      params: [`${filter.value}%`],
    };
  } else if (filter.type === 'range' && filter.value) {
    // Alphabetic range (A-F, G-M, etc.)
    const end = String.fromCharCode(filter.value.charCodeAt(0) + 1);
    return {
      sql: 'name >= ? AND name < ?',
      params: [filter.value, end],
    };
  }

  return { sql: '', params: [] };
}

/**
 * Build FTS5 MATCH query with operator support
 *
 * FTS5 Syntax:
 * - Prefix search: "test*" (matches test, testing, tester)
 * - Phrase search: "exact phrase" (matches exact phrase)
 * - AND operator: "foo AND bar" or just "foo bar" (both terms required)
 * - OR operator: "foo OR bar" (either term)
 * - NOT operator: "foo NOT bar" (exclude term)
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

function compileCategoryFilter(filter: CategoryFilter): CompiledQuery {
  const conditions: string[] = [];
  const params: (string | number | null)[] = [];
  
  if (filter.folders?.length) {
    const placeholders = filter.folders.map(() => '?').join(', ');
    const op = filter.type === 'include' ? 'IN' : 'NOT IN';
    conditions.push(`folder ${op} (${placeholders})`);
    params.push(...filter.folders);
  }
  
  if (filter.nodeTypes?.length) {
    const placeholders = filter.nodeTypes.map(() => '?').join(', ');
    conditions.push(`node_type IN (${placeholders})`);
    params.push(...filter.nodeTypes);
  }
  
  return {
    sql: conditions.join(' AND '),
    params,
  };
}

function compileTimeFilter(filter: TimeFilter): CompiledQuery {
  const column = filter.field === 'created' ? 'created_at'
    : filter.field === 'modified' ? 'modified_at'
    : 'due_at';
  
  if (filter.type === 'preset' && filter.preset) {
    const sql = getPresetSQL(filter.preset, column);
    return { sql, params: [] };
  }
  
  if (filter.type === 'range') {
    const conditions: string[] = [];
    const params: string[] = [];
    
    if (filter.start) {
      conditions.push(`${column} >= ?`);
      params.push(filter.start);
    }
    if (filter.end) {
      conditions.push(`${column} <= ?`);
      params.push(filter.end);
    }
    
    return { sql: conditions.join(' AND '), params };
  }
  
  return { sql: '', params: [] };
}

function getPresetSQL(preset: TimePreset, column: string): string {
  switch (preset) {
    case 'today':
      return `date(${column}) = date('now')`;
    case 'yesterday':
      return `date(${column}) = date('now', '-1 day')`;
    case 'this-week':
      return `${column} >= date('now', 'weekday 0', '-7 days')`;
    case 'last-week':
      return `${column} >= date('now', 'weekday 0', '-14 days') AND ${column} < date('now', 'weekday 0', '-7 days')`;
    case 'last-7-days':
      return `${column} >= datetime('now', '-7 days')`;
    case 'last-30-days':
      return `${column} >= datetime('now', '-30 days')`;
    case 'last-90-days':
      return `${column} >= datetime('now', '-90 days')`;
    case 'this-month':
      return `strftime('%Y-%m', ${column}) = strftime('%Y-%m', 'now')`;
    case 'last-month':
      return `strftime('%Y-%m', ${column}) = strftime('%Y-%m', 'now', '-1 month')`;
    case 'this-year':
      return `strftime('%Y', ${column}) = strftime('%Y', 'now')`;
    case 'overdue':
      return `${column} < datetime('now') AND completed_at IS NULL`;
    default:
      return '1=1';
  }
}

function compileHierarchyFilter(filter: HierarchyFilter): CompiledQuery {
  const conditions: string[] = [];
  const params: (string | number)[] = [];

  // Priority range filter
  if (filter.minPriority != null) {
    conditions.push('priority >= ?');
    params.push(filter.minPriority);
  }
  if (filter.maxPriority != null) {
    conditions.push('priority <= ?');
    params.push(filter.maxPriority);
  }

  // Subtree filter (via recursive CTE)
  if (filter.type === 'subtree' && filter.subtreeRoots?.length) {
    // Build recursive CTE to get all descendants of selected root nodes
    const rootPlaceholders = filter.subtreeRoots.map(() => '?').join(', ');

    // Recursive CTE pattern:
    // 1. Start with selected root nodes
    // 2. Recursively add all descendants via NEST edges
    // Note: This uses a subquery that will be joined with the main query
    const subtreeSQL = `id IN (
      WITH RECURSIVE subtree AS (
        -- Base case: selected root nodes
        SELECT id FROM nodes WHERE id IN (${rootPlaceholders})

        UNION ALL

        -- Recursive case: find children via NEST edges
        SELECT n.id
        FROM nodes n
        INNER JOIN edges e ON e.target_id = n.id
        INNER JOIN subtree s ON e.source_id = s.id
        WHERE e.edge_type = 'NEST'
      )
      SELECT id FROM subtree
    )`;

    conditions.push(subtreeSQL);
    params.push(...filter.subtreeRoots);
  }

  return {
    sql: conditions.join(' AND '),
    params
  };
}
