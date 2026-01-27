// ============================================================================
// Database Schema Loader
// ============================================================================
// Dynamically loads schema information from SQLite database for autocomplete
// ============================================================================

// Database function type for executing queries
type DatabaseFunction = <T = Record<string, unknown>>(sql: string, params: unknown[]) => T[] | Promise<T[]>;

export interface SchemaField {
  name: string;
  type: 'text' | 'number' | 'date' | 'select' | 'array';
  table?: string;
  sqlType?: string;
  values?: string[]; // For select fields
}

export interface TableInfo {
  name: string;
  fields: SchemaField[];
}

/**
 * Map SQL types to DSL field types
 */
function mapSQLTypeToFieldType(sqlType: string): SchemaField['type'] {
  const type = sqlType.toLowerCase();

  if (type.includes('text') || type.includes('varchar') || type.includes('char')) {
    return 'text';
  }

  if (type.includes('int') || type.includes('real') || type.includes('numeric') || type.includes('decimal')) {
    return 'number';
  }

  // Common date/time patterns
  if (type.includes('date') || type.includes('time')) {
    return 'date';
  }

  // Default to text for unknown types
  return 'text';
}

/**
 * Get field type with domain knowledge for specific fields
 */
function getFieldTypeWithDomainKnowledge(fieldName: string, sqlType: string): SchemaField {
  const baseType = mapSQLTypeToFieldType(sqlType);

  // Apply domain knowledge based on field names
  const lowerName = fieldName.toLowerCase();

  // Date/time fields - be specific to avoid false positives
  if (lowerName.endsWith('_at') || // created_at, modified_at, etc.
      lowerName.includes('date') || lowerName.includes('time') ||
      ['due', 'due_at', 'created', 'modified', 'completed', 'event_start', 'event_end'].includes(lowerName)) {
    return {
      name: fieldName,
      type: 'date',
      sqlType
    };
  }

  // JSON array fields
  if (lowerName === 'tags' || sqlType.toLowerCase().includes('json')) {
    return {
      name: fieldName,
      type: 'array',
      sqlType
    };
  }

  // Status/category fields (select with common values)
  if (lowerName === 'status') {
    return {
      name: fieldName,
      type: 'select',
      sqlType,
      values: ['active', 'pending', 'archived', 'completed', 'draft']
    };
  }

  if (lowerName === 'node_type') {
    return {
      name: fieldName,
      type: 'select',
      sqlType,
      values: ['note', 'task', 'event', 'contact', 'reference']
    };
  }

  if (lowerName === 'priority') {
    return {
      name: fieldName,
      type: 'number',
      sqlType
    };
  }

  return {
    name: fieldName,
    type: baseType,
    sqlType
  };
}

/**
 * Load table schema information from SQLite
 */
export async function loadTableSchema(execute: DatabaseFunction, tableName: string): Promise<TableInfo | null> {
  try {
    // Get column information using PRAGMA
    const columns = (await execute(`PRAGMA table_info(${tableName})`, [])) as Array<{
      cid: number;
      name: string;
      type: string;
      notnull: number;
      dflt_value: string | null;
      pk: number;
    }>;

    if (!columns || columns.length === 0) {
      return null;
    }

    const fields: SchemaField[] = columns
      .filter(col => !col.name.startsWith('_')) // Skip private fields
      .map(col => ({
        ...getFieldTypeWithDomainKnowledge(col.name, col.type),
        table: tableName
      }));

    return {
      name: tableName,
      fields
    };
  } catch (error) {
    console.error(`Error loading schema for table ${tableName}:`, error);
    return null;
  }
}

/**
 * Load schema information for all main tables
 */
export async function loadDatabaseSchema(execute: DatabaseFunction): Promise<SchemaField[]> {
  const mainTables = ['nodes', 'notebook_cards', 'edges', 'attachments'];
  const allFields: SchemaField[] = [];

  for (const tableName of mainTables) {
    const tableInfo = await loadTableSchema(execute, tableName);
    if (tableInfo) {
      allFields.push(...tableInfo.fields);
    }
  }

  // Remove duplicates and add unique qualifier for conflicting names
  const fieldMap = new Map<string, SchemaField[]>();

  allFields.forEach(field => {
    if (!fieldMap.has(field.name)) {
      fieldMap.set(field.name, []);
    }
    fieldMap.get(field.name)!.push(field);
  });

  const uniqueFields: SchemaField[] = [];

  fieldMap.forEach((fields, _name) => {
    if (fields.length === 1) {
      // Unique field name, use as-is
      uniqueFields.push(fields[0]);
    } else {
      // Conflicting names, add table qualifier
      fields.forEach(field => {
        uniqueFields.push({
          ...field,
          name: `${field.table}.${field.name}` // Qualified name for conflicts
        });
      });
    }
  });

  return uniqueFields.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Cache for schema information to avoid repeated queries
 */
let schemaCache: SchemaField[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Get schema fields with caching
 */
export async function getSchemaFields(execute: DatabaseFunction): Promise<SchemaField[]> {
  const now = Date.now();

  // Return cached data if still valid
  if (schemaCache && (now - cacheTimestamp) < CACHE_TTL) {
    return schemaCache;
  }

  try {
    // Load fresh schema data
    const fields = await loadDatabaseSchema(execute);

    // Update cache
    schemaCache = fields;
    cacheTimestamp = now;

    return fields;
  } catch (error) {
    console.error('Error loading database schema:', error);

    // Return cached data if available, even if stale
    if (schemaCache) {
      return schemaCache;
    }

    // Fallback to empty array if no cache
    return [];
  }
}

/**
 * Clear schema cache (useful after schema migrations)
 */
export function clearSchemaCache(): void {
  schemaCache = null;
  cacheTimestamp = 0;
}