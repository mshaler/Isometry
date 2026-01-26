// D3 data parsing utilities for automatic visualization detection and rendering

export interface ParsedData {
  data: unknown[];
  schema: DataSchema;
  isValid: boolean;
  error?: string;
}

export interface DataSchema {
  fields: FieldSchema[];
  rowCount: number;
  hasHeaders: boolean;
}

export interface FieldSchema {
  name: string;
  type: 'string' | 'number' | 'date' | 'boolean' | 'unknown';
  nullable: boolean;
  unique: boolean;
  sampleValues: unknown[];
}

export type VisualizationType =
  | 'bar-chart'
  | 'line-chart'
  | 'scatter-plot'
  | 'histogram'
  | 'network-graph'
  | 'pie-chart'
  | 'area-chart'
  | 'unknown';

export interface VisualizationConfig {
  type: VisualizationType;
  axes: {
    x?: string;
    y?: string;
    color?: string;
    size?: string;
  };
  encoding: {
    xType: 'categorical' | 'continuous' | 'temporal';
    yType: 'categorical' | 'continuous' | 'temporal';
  };
  suggestions: string[];
  confidence: number; // 0-1 score
}

export interface VisualizationDirective {
  type: VisualizationType;
  x?: string;
  y?: string;
  color?: string;
  size?: string;
  title?: string;
  options?: Record<string, unknown>;
}

/**
 * Parse chart data from markdown content
 */
export function parseChartData(content: string): ParsedData {
  try {
    // Extract JSON data blocks
    const jsonData = extractJSONData(content);
    if (jsonData.length > 0) {
      return parseJSONData(jsonData[0]);
    }

    // Extract CSV data
    const csvData = extractCSVData(content);
    if (csvData) {
      return parseCSVData(csvData);
    }

    // Extract markdown tables
    const tableData = extractTableData(content);
    if (tableData.length > 0) {
      return parseTableData(tableData[0]);
    }

    return {
      data: [],
      schema: { fields: [], rowCount: 0, hasHeaders: false },
      isValid: false,
      error: 'No valid data found in content'
    };

  } catch (error) {
    return {
      data: [],
      schema: { fields: [], rowCount: 0, hasHeaders: false },
      isValid: false,
      error: error instanceof Error ? error.message : 'Unknown parsing error'
    };
  }
}

/**
 * Detect optimal visualization type based on data structure
 */
export function detectVisualizationType(data: unknown[]): VisualizationConfig {
  if (!data || data.length === 0) {
    return {
      type: 'unknown',
      axes: {},
      encoding: { xType: 'categorical', yType: 'continuous' },
      suggestions: ['Add data to enable visualization'],
      confidence: 0
    };
  }

  const schema = analyzeDataSchema(data);
  const numFields = schema.fields.filter(f => f.type === 'number');
  const catFields = schema.fields.filter(f => f.type === 'string');
  const dateFields = schema.fields.filter(f => f.type === 'date');

  // Network graph detection (nodes and edges)
  if (hasNetworkStructure(data)) {
    return {
      type: 'network-graph',
      axes: { x: 'source', y: 'target' },
      encoding: { xType: 'categorical', yType: 'categorical' },
      suggestions: ['Showing network/graph relationships'],
      confidence: 0.9
    };
  }

  // Time series detection
  if (dateFields.length > 0 && numFields.length > 0) {
    const dateField = dateFields[0].name;
    const valueField = numFields[0].name;

    return {
      type: 'line-chart',
      axes: { x: dateField, y: valueField },
      encoding: { xType: 'temporal', yType: 'continuous' },
      suggestions: ['Time series data detected', 'Consider area chart for cumulative data'],
      confidence: 0.85
    };
  }

  // Single numeric field - histogram
  if (numFields.length === 1 && catFields.length === 0) {
    return {
      type: 'histogram',
      axes: { x: numFields[0].name },
      encoding: { xType: 'continuous', yType: 'continuous' },
      suggestions: ['Distribution analysis', 'Shows frequency of values'],
      confidence: 0.8
    };
  }

  // Two numeric fields - scatter plot
  if (numFields.length >= 2) {
    return {
      type: 'scatter-plot',
      axes: { x: numFields[0].name, y: numFields[1].name, size: numFields[2]?.name },
      encoding: { xType: 'continuous', yType: 'continuous' },
      suggestions: ['Correlation analysis', 'Add color encoding for categories'],
      confidence: 0.75
    };
  }

  // Categorical + numeric - bar chart
  if (catFields.length >= 1 && numFields.length >= 1) {
    const uniqueCategories = new Set(data.map(d => d[catFields[0].name])).size;

    // Pie chart for small number of categories
    if (uniqueCategories <= 6 && numFields.length === 1) {
      return {
        type: 'pie-chart',
        axes: { x: catFields[0].name, y: numFields[0].name },
        encoding: { xType: 'categorical', yType: 'continuous' },
        suggestions: ['Parts-to-whole relationship', 'Consider bar chart for comparison'],
        confidence: 0.7
      };
    }

    return {
      type: 'bar-chart',
      axes: { x: catFields[0].name, y: numFields[0].name },
      encoding: { xType: 'categorical', yType: 'continuous' },
      suggestions: ['Category comparison', 'Consider horizontal bars for long labels'],
      confidence: 0.8
    };
  }

  // Fallback
  return {
    type: 'bar-chart',
    axes: { x: schema.fields[0]?.name, y: schema.fields[1]?.name },
    encoding: { xType: 'categorical', yType: 'continuous' },
    suggestions: ['Generic visualization', 'Refine data structure for better charts'],
    confidence: 0.3
  };
}

/**
 * Extract visualization configuration from markdown comments
 */
export function extractVisualizationConfig(content: string): VisualizationDirective | null {
  try {
    // Look for HTML comments with d3 directives
    const htmlCommentPattern = /<!--\s*d3:([\w-]+)(?:,([^>]+))?\s*-->/g;
    const htmlMatch = htmlCommentPattern.exec(content);

    if (htmlMatch) {
      const type = htmlMatch[1] as VisualizationType;
      const params = htmlMatch[2] ? parseDirectiveParams(htmlMatch[2]) : {};

      return { type, ...params };
    }

    // Look for YAML frontmatter
    const yamlPattern = /^---\s*\n([\s\S]*?)\n---/;
    const yamlMatch = content.match(yamlPattern);

    if (yamlMatch) {
      const yamlContent = yamlMatch[1];
      const chartConfig = parseYAMLChartConfig(yamlContent);
      if (chartConfig) return chartConfig;
    }

    // Look for JSON code blocks with visualization metadata
    const jsonPattern = /```json\s*\n([\s\S]*?)\n```/g;
    let jsonMatch;

    while ((jsonMatch = jsonPattern.exec(content)) !== null) {
      try {
        const data = JSON.parse(jsonMatch[1]);
        if (data._visualization) {
          return data._visualization as VisualizationDirective;
        }
      } catch {
        // Continue searching
      }
    }

    return null;
  } catch {
    return null;
  }
}

// Helper functions

function extractJSONData(content: string): unknown[] {
  const patterns = [
    /```json\s*\n([\s\S]*?)\n```/g,
    /```data\s*\n([\s\S]*?)\n```/g,
  ];

  const results: unknown[] = [];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      try {
        const parsed = JSON.parse(match[1]);
        if (Array.isArray(parsed)) {
          results.push(parsed);
        } else if (parsed.data && Array.isArray(parsed.data)) {
          results.push(parsed.data);
        }
      } catch {
        // Skip invalid JSON
      }
    }
  }

  return results;
}

function extractCSVData(content: string): string | null {
  const csvPattern = /```csv\s*\n([\s\S]*?)\n```/;
  const match = content.match(csvPattern);
  return match ? match[1].trim() : null;
}

function extractTableData(content: string): string[] {
  const tablePattern = /\|(.+)\|/g;
  const tables: string[] = [];
  let currentTable = '';
  let inTable = false;

  const lines = content.split('\n');
  for (const line of lines) {
    if (tablePattern.test(line)) {
      if (!inTable) {
        inTable = true;
        currentTable = '';
      }
      currentTable += line + '\n';
    } else if (inTable) {
      if (currentTable.trim()) {
        tables.push(currentTable.trim());
      }
      inTable = false;
    }
  }

  if (inTable && currentTable.trim()) {
    tables.push(currentTable.trim());
  }

  return tables;
}

function parseJSONData(data: unknown[]): ParsedData {
  if (!Array.isArray(data) || data.length === 0) {
    return {
      data: [],
      schema: { fields: [], rowCount: 0, hasHeaders: false },
      isValid: false,
      error: 'Invalid JSON data structure'
    };
  }

  const schema = analyzeDataSchema(data);

  return {
    data,
    schema,
    isValid: true
  };
}

function parseCSVData(csvText: string): ParsedData {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) {
    return {
      data: [],
      schema: { fields: [], rowCount: 0, hasHeaders: false },
      isValid: false,
      error: 'Insufficient CSV data'
    };
  }

  const headers = lines[0].split(',').map(h => h.trim());
  const data = lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim());
    const row: unknown = {};
    headers.forEach((header, index) => {
      const value = values[index];
      row[header] = parseValue(value);
    });
    return row;
  });

  const schema = analyzeDataSchema(data);

  return {
    data,
    schema,
    isValid: true
  };
}

function parseTableData(tableText: string): ParsedData {
  const lines = tableText.trim().split('\n');
  const dataLines = lines.filter(line => !line.includes('---')); // Remove separator lines

  if (dataLines.length < 2) {
    return {
      data: [],
      schema: { fields: [], rowCount: 0, hasHeaders: false },
      isValid: false,
      error: 'Insufficient table data'
    };
  }

  // Extract headers
  const headerLine = dataLines[0];
  const headers = headerLine.split('|').map(h => h.trim()).filter(h => h !== '');

  // Extract data rows
  const data = dataLines.slice(1).map(line => {
    const values = line.split('|').map(v => v.trim()).filter(v => v !== '');
    const row: unknown = {};
    headers.forEach((header, index) => {
      const value = values[index];
      row[header] = parseValue(value);
    });
    return row;
  });

  const schema = analyzeDataSchema(data);

  return {
    data,
    schema,
    isValid: true
  };
}

function analyzeDataSchema(data: unknown[]): DataSchema {
  if (data.length === 0) {
    return { fields: [], rowCount: 0, hasHeaders: false };
  }

  const sampleSize = Math.min(100, data.length);
  const sample = data.slice(0, sampleSize);
  const allKeys = new Set<string>();

  sample.forEach(row => {
    Object.keys(row).forEach(key => allKeys.add(key));
  });

  const fields: FieldSchema[] = Array.from(allKeys).map(key => {
    const values = sample.map(row => row[key]).filter(v => v != null);
    const uniqueValues = new Set(values);

    return {
      name: key,
      type: inferDataType(values),
      nullable: values.length < sample.length,
      unique: uniqueValues.size === values.length,
      sampleValues: Array.from(uniqueValues).slice(0, 5)
    };
  });

  return {
    fields,
    rowCount: data.length,
    hasHeaders: true
  };
}

function inferDataType(values: unknown[]): FieldSchema['type'] {
  if (values.length === 0) return 'unknown';

  const types = new Set<string>();

  for (const value of values) {
    if (typeof value === 'number') {
      types.add('number');
    } else if (typeof value === 'boolean') {
      types.add('boolean');
    } else if (typeof value === 'string') {
      // Check if it's a date
      if (isDateString(value)) {
        types.add('date');
      } else if (isNumericString(value)) {
        types.add('number');
      } else {
        types.add('string');
      }
    }
  }

  // Return most specific type
  if (types.has('date')) return 'date';
  if (types.has('number')) return 'number';
  if (types.has('boolean')) return 'boolean';
  if (types.has('string')) return 'string';

  return 'unknown';
}

function parseValue(value: string): unknown {
  if (!value || value === '') return null;

  // Try number
  if (isNumericString(value)) {
    return parseFloat(value);
  }

  // Try boolean
  if (value.toLowerCase() === 'true') return true;
  if (value.toLowerCase() === 'false') return false;

  // Try date
  if (isDateString(value)) {
    return new Date(value);
  }

  return value;
}

function isNumericString(value: string): boolean {
  return !isNaN(parseFloat(value)) && isFinite(parseFloat(value));
}

function isDateString(value: string): boolean {
  if (!/\d/.test(value)) return false;
  const date = new Date(value);
  return !isNaN(date.getTime()) && date.getFullYear() > 1900;
}

function hasNetworkStructure(data: unknown[]): boolean {
  if (data.length === 0) return false;

  // Check if data has node-link structure
  const firstRow = data[0];
  const keys = Object.keys(firstRow);

  // Common network graph patterns
  const networkPatterns = [
    ['source', 'target'],
    ['from', 'to'],
    ['parent', 'child'],
    ['id', 'parentId'],
    ['nodes', 'edges'],
    ['vertices', 'connections']
  ];

  return networkPatterns.some(pattern =>
    pattern.every(field => keys.some(key =>
      key.toLowerCase().includes(field.toLowerCase())
    ))
  );
}

function parseDirectiveParams(paramString: string): Record<string, string> {
  const params: Record<string, string> = {};

  paramString.split(',').forEach(param => {
    const [key, value] = param.split('=').map(s => s.trim());
    if (key && value) {
      params[key] = value;
    }
  });

  return params;
}

function parseYAMLChartConfig(yamlText: string): VisualizationDirective | null {
  // Simple YAML parsing for chart config
  const lines = yamlText.split('\n');
  const config: unknown = {};

  for (const line of lines) {
    if (line.includes('chart:') || line.includes('visualization:')) {
      // Found chart config section
      continue;
    }

    const match = line.match(/^\s*(\w+):\s*(.+)$/);
    if (match) {
      const [, key, value] = match;
      config[key] = value.replace(/["']/g, '');
    }
  }

  if (config.type) {
    return config as VisualizationDirective;
  }

  return null;
}