/**
 * Unified filter AST + SQL compiler for LATCH/slider filtering.
 * One typed contract used by both LATCHFilterService and slider filters.
 */

export type FilterOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'starts_with'
  | 'in_list'
  | 'range'
  | 'before'
  | 'after';

export interface FilterPredicate {
  field: string;
  operator: FilterOperator;
  value: unknown;
}

export interface CompiledFilterSQL {
  whereClause: string;
  parameters: unknown[];
  isEmpty: boolean;
}

function ensureSafeFieldName(field: string): string {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(field)) {
    throw new Error(`Unsafe filter field: ${field}`);
  }
  return field;
}

function compileStaticColumnPredicate(predicate: FilterPredicate): CompiledFilterSQL {
  const field = ensureSafeFieldName(predicate.field);
  const { operator, value } = predicate;

  switch (operator) {
    case 'equals':
      return { whereClause: `${field} = ?`, parameters: [value], isEmpty: false };
    case 'not_equals':
      return { whereClause: `(${field} != ? OR ${field} IS NULL)`, parameters: [value], isEmpty: false };
    case 'contains':
      return { whereClause: `${field} LIKE ?`, parameters: [`%${String(value)}%`], isEmpty: false };
    case 'starts_with':
      return { whereClause: `${field} LIKE ?`, parameters: [`${String(value)}%`], isEmpty: false };
    case 'in_list': {
      if (!Array.isArray(value) || value.length === 0) {
        return { whereClause: '', parameters: [], isEmpty: true };
      }
      const placeholders = value.map(() => '?').join(', ');
      return { whereClause: `${field} IN (${placeholders})`, parameters: value, isEmpty: false };
    }
    case 'range': {
      if (!Array.isArray(value) || value.length !== 2) {
        return { whereClause: '', parameters: [], isEmpty: true };
      }
      return {
        whereClause: `${field} BETWEEN ? AND ?`,
        parameters: [value[0], value[1]],
        isEmpty: false,
      };
    }
    case 'before':
      return { whereClause: `${field} < ?`, parameters: [value], isEmpty: false };
    case 'after':
      return { whereClause: `${field} > ?`, parameters: [value], isEmpty: false };
    default:
      return { whereClause: '', parameters: [], isEmpty: true };
  }
}

function compileDynamicPropertyPredicate(predicate: FilterPredicate): CompiledFilterSQL {
  const key = predicate.field.replace(/^node_properties\./, '');
  const { operator, value } = predicate;

  // Keep backward compatibility: value/value_type plus typed columns.
  const textExpr = `COALESCE(np.value_string, np.value_json, np.value)`;
  const numberExpr = `COALESCE(np.value_number, CAST(np.value AS REAL))`;
  const boolExpr = `COALESCE(np.value_boolean, CAST(np.value AS INTEGER))`;

  let propClause = '';
  const params: unknown[] = [key];

  switch (operator) {
    case 'equals':
      if (typeof value === 'number') {
        propClause = `${numberExpr} = ?`;
        params.push(value);
      } else if (typeof value === 'boolean') {
        propClause = `${boolExpr} = ?`;
        params.push(value ? 1 : 0);
      } else {
        propClause = `${textExpr} = ?`;
        params.push(String(value));
      }
      break;
    case 'contains':
      propClause = `${textExpr} LIKE ?`;
      params.push(`%${String(value)}%`);
      break;
    case 'starts_with':
      propClause = `${textExpr} LIKE ?`;
      params.push(`${String(value)}%`);
      break;
    case 'range':
      if (!Array.isArray(value) || value.length !== 2) {
        return { whereClause: '', parameters: [], isEmpty: true };
      }
      propClause = `${numberExpr} BETWEEN ? AND ?`;
      params.push(value[0], value[1]);
      break;
    case 'before':
      propClause = `${textExpr} < ?`;
      params.push(String(value));
      break;
    case 'after':
      propClause = `${textExpr} > ?`;
      params.push(String(value));
      break;
    default:
      return { whereClause: '', parameters: [], isEmpty: true };
  }

  return {
    whereClause: `id IN (SELECT np.node_id FROM node_properties np WHERE np.key = ? AND ${propClause})`,
    parameters: params,
    isEmpty: false,
  };
}

function compileDerivedPredicate(predicate: FilterPredicate): CompiledFilterSQL {
  const { operator, value } = predicate;

  // Derived string length: len:<column>
  if (predicate.field.startsWith('len:')) {
    const column = ensureSafeFieldName(predicate.field.slice(4));
    if (operator !== 'range' || !Array.isArray(value) || value.length !== 2) {
      return { whereClause: '', parameters: [], isEmpty: true };
    }
    return {
      whereClause: `LENGTH(COALESCE(${column}, '')) BETWEEN ? AND ?`,
      parameters: [value[0], value[1]],
      isEmpty: false,
    };
  }

  // Derived tag count: tagcount:tags
  if (predicate.field.startsWith('tagcount:')) {
    const column = ensureSafeFieldName(predicate.field.slice(9));
    if (operator !== 'range' || !Array.isArray(value) || value.length !== 2) {
      return { whereClause: '', parameters: [], isEmpty: true };
    }
    const expr = `CASE
      WHEN ${column} IS NULL OR TRIM(${column}) = '' THEN 0
      WHEN json_valid(${column}) THEN json_array_length(${column})
      ELSE 1 + LENGTH(${column}) - LENGTH(REPLACE(${column}, ',', ''))
    END`;
    return {
      whereClause: `${expr} BETWEEN ? AND ?`,
      parameters: [value[0], value[1]],
      isEmpty: false,
    };
  }

  // Graph degree metric: graph.degree
  if (predicate.field === 'graph.degree') {
    if (operator !== 'range' || !Array.isArray(value) || value.length !== 2) {
      return { whereClause: '', parameters: [], isEmpty: true };
    }
    return {
      whereClause: `id IN (
        SELECT node_id
        FROM (
          SELECT source_id AS node_id FROM edges
          UNION ALL
          SELECT target_id AS node_id FROM edges
        ) e
        GROUP BY node_id
        HAVING COUNT(*) BETWEEN ? AND ?
      )`,
      parameters: [value[0], value[1]],
      isEmpty: false,
    };
  }

  return { whereClause: '', parameters: [], isEmpty: true };
}

export function compileFilterPredicates(predicates: FilterPredicate[]): CompiledFilterSQL {
  const clauses: string[] = ['deleted_at IS NULL'];
  const parameters: unknown[] = [];

  for (const predicate of predicates) {
    let compiled: CompiledFilterSQL;
    if (predicate.field.startsWith('node_properties.')) {
      compiled = compileDynamicPropertyPredicate(predicate);
    } else if (
      predicate.field.startsWith('len:') ||
      predicate.field.startsWith('tagcount:') ||
      predicate.field === 'graph.degree'
    ) {
      compiled = compileDerivedPredicate(predicate);
    } else {
      compiled = compileStaticColumnPredicate(predicate);
    }

    if (!compiled.isEmpty && compiled.whereClause) {
      clauses.push(`(${compiled.whereClause})`);
      parameters.push(...compiled.parameters);
    }
  }

  return {
    whereClause: clauses.join(' AND '),
    parameters,
    isEmpty: predicates.length === 0,
  };
}
