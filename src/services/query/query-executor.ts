/**
 * Query Executor Service
 *
 * Provides safe SQL query execution with DDL prevention and export utilities.
 * Used by the Data Inspector tab for exploring SQLite schema and data.
 */

// DDL regex to prevent data modification
const DDL_REGEX = /^\s*(DROP|ALTER|CREATE|DELETE|UPDATE|INSERT|TRUNCATE)\s/i;

/**
 * Validates that a SQL query is safe for Data Inspector execution.
 * Only SELECT queries are allowed to prevent data modification.
 */
export function validateQuery(sql: string): { valid: boolean; error?: string } {
  if (DDL_REGEX.test(sql)) {
    return { valid: false, error: 'Only SELECT queries allowed in Data Inspector' };
  }
  return { valid: true };
}

/**
 * Result of a query execution
 */
export interface QueryResult {
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
  duration: number;
  truncated: boolean;
}

/**
 * Database interface for query execution.
 * Matches the useSQLite execute function signature.
 */
export interface DatabaseExecutor {
  execute: (sql: string, params?: unknown[]) => Record<string, unknown>[];
}

/**
 * Executes a SQL query with safety checks and automatic LIMIT.
 * Throws an error if the query contains DDL statements.
 */
export function executeQuery(
  db: DatabaseExecutor,
  sql: string
): QueryResult {
  const validation = validateQuery(sql);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  // Auto-append LIMIT 1000 if query lacks LIMIT (per research pitfalls)
  let querySql = sql.trim();
  const hasLimit = /LIMIT\s+\d+/i.test(querySql);
  if (!hasLimit) {
    querySql = querySql.replace(/;?\s*$/, ' LIMIT 1000');
  }

  const start = performance.now();
  const rows = db.execute(querySql);
  const duration = performance.now() - start;

  return {
    columns: rows.length > 0 ? Object.keys(rows[0]) : [],
    rows,
    rowCount: rows.length,
    duration,
    truncated: !hasLimit && rows.length === 1000
  };
}

/**
 * Downloads content as a file via Blob API
 */
function downloadBlob(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Exports query results to CSV format and triggers download.
 * Properly escapes quotes and wraps values containing special characters.
 */
export function exportToCSV(result: QueryResult, filename?: string): void {
  const { columns, rows } = result;
  const csv = [
    columns.join(','),
    ...rows.map(row =>
      columns.map(col => {
        const val = row[col];
        // Escape quotes and wrap strings containing commas/newlines/quotes
        if (typeof val === 'string' && (val.includes(',') || val.includes('\n') || val.includes('"'))) {
          return `"${val.replace(/"/g, '""')}"`;
        }
        return val === null ? '' : String(val);
      }).join(',')
    )
  ].join('\n');

  downloadBlob(csv, filename || 'query-results.csv', 'text/csv');
}

/**
 * Exports query results to JSON format and triggers download.
 * Includes metadata about the query execution.
 */
export function exportToJSON(result: QueryResult, filename?: string): void {
  const json = JSON.stringify({
    query: result.truncated ? '(query was auto-limited to 1000 rows)' : undefined,
    timestamp: new Date().toISOString(),
    columns: result.columns,
    rowCount: result.rowCount,
    duration: result.duration,
    results: result.rows
  }, null, 2);

  downloadBlob(json, filename || 'query-results.json', 'application/json');
}
