import type { FilterState, CompiledQuery, AlphabetFilter, TimeFilter, CategoryFilter, HierarchyFilter, TimePreset } from '../types/filter';

export function compileFilters(filters: FilterState): CompiledQuery {
  const conditions: string[] = [];
  const params: (string | number | boolean | null)[] = [];

  // Always exclude deleted
  conditions.push('deleted_at IS NULL');

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
  if (filter.type === 'priority' || filter.type === 'range') {
    const conditions: string[] = [];
    const params: number[] = [];
    
    if (filter.minPriority != null) {
      conditions.push('priority >= ?');
      params.push(filter.minPriority);
    }
    if (filter.maxPriority != null) {
      conditions.push('priority <= ?');
      params.push(filter.maxPriority);
    }
    
    return { sql: conditions.join(' AND '), params };
  }
  
  return { sql: '', params: [] };
}
