import type { Node, NodeType } from '../types/node';

// Type definitions for JSON processing
export interface JSONImportOptions {
  nodeType?: string;
  folder?: string;
  source?: string;
  fieldMappings?: FieldMapping[];
  streamingMode?: boolean;
  batchSize?: number;
}

export interface FieldMapping {
  jsonPath: string;
  targetProperty: LATCHProperty;
  transform?: FieldTransform;
}

export interface FieldTransform {
  type: 'date' | 'number' | 'boolean' | 'string' | 'array' | 'custom';
  dateFormat?: string;
  customFunction?: (value: any) => any;
}

export type LATCHProperty =
  // Location
  | 'latitude' | 'longitude' | 'locationName' | 'locationAddress'
  // Alphabet (content)
  | 'name' | 'content' | 'summary'
  // Time
  | 'createdAt' | 'modifiedAt' | 'dueAt' | 'completedAt' | 'eventStart' | 'eventEnd'
  // Category
  | 'folder' | 'tags' | 'status' | 'nodeType'
  // Hierarchy
  | 'priority' | 'importance' | 'sortOrder';

export interface JSONImportResult {
  nodes: Node[];
  errors: string[];
  metadata: {
    totalItems: number;
    processedItems: number;
    schema?: JSONSchema;
    inferredMappings?: FieldMapping[];
    streamingMode: boolean;
    processingTimeMs: number;
  };
}

export interface JSONSchema {
  type: 'object' | 'array' | 'primitive';
  rootStructure: StructureAnalysis;
  properties: Record<string, PropertyInfo>;
  arrayItemType?: 'object' | 'primitive';
  estimatedNodeCount: number;
  filename: string;
}

export interface StructureAnalysis {
  isHomogeneous: boolean;
  hasNestedObjects: boolean;
  hasArrays: boolean;
  maxDepth: number;
  sampleSize: number;
}

export interface PropertyInfo {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'null';
  frequency: number; // How often this property appears (0-1)
  sampleValues: any[];
  inferredLATCH?: LATCHProperty;
  nullable: boolean;
}

export interface JSONPreview {
  structure: JSONSchema;
  sampleData: any[];
  inferredMappings: FieldMapping[];
  estimatedNodeCount: number;
  warnings: string[];
}

/**
 * Main function to import JSON file and convert to Isometry nodes
 */
export async function importJSONFile(
  file: File,
  options: JSONImportOptions = {}
): Promise<JSONImportResult> {
  const startTime = Date.now();

  try {
    // Read file content
    const content = await readFileAsText(file);

    // Parse JSON
    const jsonData = JSON.parse(content);

    // Analyze structure and generate schema
    const schema = analyzeJSONStructure(jsonData, file.name);

    // Infer field mappings if not provided
    const fieldMappings = options.fieldMappings || inferFieldMappings(schema);

    // Convert to nodes
    const conversionResult = await convertJSONToNodes(
      jsonData,
      schema,
      fieldMappings,
      options
    );

    const processingTimeMs = Date.now() - startTime;

    return {
      nodes: conversionResult.nodes,
      errors: conversionResult.errors,
      metadata: {
        totalItems: conversionResult.totalItems,
        processedItems: conversionResult.nodes.length,
        schema,
        inferredMappings: fieldMappings,
        streamingMode: options.streamingMode || false,
        processingTimeMs
      }
    };
  } catch (error) {
    const processingTimeMs = Date.now() - startTime;

    return {
      nodes: [],
      errors: [error instanceof Error ? error.message : 'Unknown error during JSON import'],
      metadata: {
        totalItems: 0,
        processedItems: 0,
        streamingMode: false,
        processingTimeMs
      }
    };
  }
}

/**
 * Generate a preview of JSON structure without actually importing
 */
export async function previewJSONFile(file: File): Promise<JSONPreview> {
  try {
    const content = await readFileAsText(file);
    const jsonData = JSON.parse(content);

    const schema = analyzeJSONStructure(jsonData, file.name);
    const inferredMappings = inferFieldMappings(schema);

    // Get sample data for preview (max 5 items)
    const sampleData = getSampleData(jsonData, 5);

    const warnings: string[] = [];

    // Generate warnings based on analysis
    if (schema.estimatedNodeCount > 1000) {
      warnings.push(`Large dataset: ${schema.estimatedNodeCount} items will be imported`);
    }

    if (schema.rootStructure.hasNestedObjects) {
      warnings.push('Complex nested structure detected - some data may be flattened');
    }

    if (inferredMappings.length === 0) {
      warnings.push('No LATCH properties auto-detected - manual mapping may be needed');
    }

    return {
      structure: schema,
      sampleData,
      inferredMappings,
      estimatedNodeCount: schema.estimatedNodeCount,
      warnings
    };
  } catch (error) {
    throw new Error(`Failed to preview JSON: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Analyze JSON structure and generate schema
 */
export function analyzeJSONStructure(data: any, filename: string): JSONSchema {
  const analysis = analyzeStructure(data);

  let properties: Record<string, PropertyInfo> = {};
  let arrayItemType: 'object' | 'primitive' | undefined;
  let estimatedNodeCount = 1;

  if (analysis.type === 'object') {
    properties = analyzeObjectProperties(data);
    estimatedNodeCount = 1;
  } else if (analysis.type === 'array') {
    if (data.length > 0) {
      const firstItem = data[0];
      if (typeof firstItem === 'object' && firstItem !== null) {
        arrayItemType = 'object';
        properties = analyzeArrayItemProperties(data);
        estimatedNodeCount = data.length;
      } else {
        arrayItemType = 'primitive';
        estimatedNodeCount = data.length;
      }
    }
  }

  return {
    type: analysis.type,
    rootStructure: analysis,
    properties,
    arrayItemType,
    estimatedNodeCount,
    filename
  };
}

function analyzeStructure(data: any): StructureAnalysis {
  if (Array.isArray(data)) {
    return analyzeArrayStructure(data);
  } else if (typeof data === 'object' && data !== null) {
    return analyzeObjectStructure(data);
  } else {
    return {
      isHomogeneous: true,
      hasNestedObjects: false,
      hasArrays: false,
      maxDepth: 0,
      sampleSize: 1
    };
  }
}

function analyzeArrayStructure(arr: any[]): StructureAnalysis {
  if (arr.length === 0) {
    return {
      isHomogeneous: true,
      hasNestedObjects: false,
      hasArrays: false,
      maxDepth: 1,
      sampleSize: 0
    };
  }

  const sampleSize = Math.min(arr.length, 10);
  const sample = arr.slice(0, sampleSize);

  const types = sample.map(item => typeof item);
  const isHomogeneous = types.every(type => type === types[0]);

  let hasNestedObjects = false;
  let hasArrays = false;
  let maxDepth = 1;

  for (const item of sample) {
    if (typeof item === 'object' && item !== null) {
      if (Array.isArray(item)) {
        hasArrays = true;
      } else {
        hasNestedObjects = true;
      }
      const itemDepth = calculateDepth(item);
      maxDepth = Math.max(maxDepth, itemDepth + 1);
    }
  }

  return {
    isHomogeneous,
    hasNestedObjects,
    hasArrays,
    maxDepth,
    sampleSize: arr.length
  };
}

function analyzeObjectStructure(obj: any): StructureAnalysis {
  let hasNestedObjects = false;
  let hasArrays = false;
  let maxDepth = 1;

  for (const value of Object.values(obj)) {
    if (Array.isArray(value)) {
      hasArrays = true;
      const arrayDepth = calculateDepth(value);
      maxDepth = Math.max(maxDepth, arrayDepth + 1);
    } else if (typeof value === 'object' && value !== null) {
      hasNestedObjects = true;
      const objDepth = calculateDepth(value);
      maxDepth = Math.max(maxDepth, objDepth + 1);
    }
  }

  return {
    isHomogeneous: true,
    hasNestedObjects,
    hasArrays,
    maxDepth,
    sampleSize: 1
  };
}

function calculateDepth(obj: any): number {
  if (typeof obj !== 'object' || obj === null) {
    return 0;
  }

  if (Array.isArray(obj)) {
    return obj.length > 0 ? 1 + Math.max(...obj.map(calculateDepth)) : 1;
  }

  const depths = Object.values(obj).map(calculateDepth);
  return depths.length > 0 ? 1 + Math.max(...depths) : 1;
}

function analyzeObjectProperties(obj: any): Record<string, PropertyInfo> {
  const properties: Record<string, PropertyInfo> = {};

  for (const [key, value] of Object.entries(obj)) {
    properties[key] = analyzeProperty(key, [value]);
  }

  return properties;
}

function analyzeArrayItemProperties(arr: any[]): Record<string, PropertyInfo> {
  const properties: Record<string, PropertyInfo> = {};

  // Get all possible keys from array items
  const allKeys = new Set<string>();
  const objectItems = arr.filter(item => typeof item === 'object' && item !== null);

  for (const item of objectItems) {
    Object.keys(item).forEach(key => allKeys.add(key));
  }

  // Analyze each property across all items
  for (const key of allKeys) {
    const values = objectItems
      .map(item => item[key])
      .filter(val => val !== undefined);

    properties[key] = analyzeProperty(key, values);
  }

  return properties;
}

function analyzeProperty(key: string, values: any[]): PropertyInfo {
  const nonNullValues = values.filter(val => val !== null && val !== undefined);
  const types = nonNullValues.map(val => {
    if (Array.isArray(val)) return 'array';
    return typeof val;
  });

  const dominantType = getMostCommonType(types);
  const frequency = values.length / Math.max(1, values.length); // Simplified for single object analysis
  const sampleValues = nonNullValues.slice(0, 3);
  const nullable = values.some(val => val === null || val === undefined);

  return {
    type: dominantType,
    frequency,
    sampleValues,
    inferredLATCH: inferLATCHProperty(key, sampleValues, dominantType),
    nullable
  };
}

function getMostCommonType(types: string[]): PropertyInfo['type'] {
  if (types.length === 0) return 'null';

  const counts = types.reduce((acc, type) => {
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const mostCommon = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return mostCommon[0] as PropertyInfo['type'];
}

function inferLATCHProperty(key: string, sampleValues: any[], type: PropertyInfo['type']): LATCHProperty | undefined {
  const lowerKey = key.toLowerCase();

  // Location
  if (lowerKey.includes('lat') && type === 'number') return 'latitude';
  if (lowerKey.includes('lon') && type === 'number') return 'longitude';
  if (lowerKey.includes('address')) return 'locationAddress';
  if (lowerKey.includes('location') && type === 'string') return 'locationName';

  // Alphabet
  if (lowerKey.includes('name') || lowerKey.includes('title')) return 'name';
  if (lowerKey.includes('content') || lowerKey.includes('body') || lowerKey.includes('text')) return 'content';
  if (lowerKey.includes('summary') || lowerKey.includes('description') || lowerKey.includes('excerpt')) return 'summary';

  // Time
  if (lowerKey.includes('created')) return 'createdAt';
  if (lowerKey.includes('modified') || lowerKey.includes('updated')) return 'modifiedAt';
  if (lowerKey.includes('due')) return 'dueAt';
  if (lowerKey.includes('completed')) return 'completedAt';
  if (lowerKey.includes('start')) return 'eventStart';
  if (lowerKey.includes('end')) return 'eventEnd';

  // Category
  if (lowerKey.includes('folder') || lowerKey.includes('directory')) return 'folder';
  if (lowerKey.includes('tag') || lowerKey.includes('category')) return 'tags';
  if (lowerKey.includes('status') || lowerKey.includes('state')) return 'status';
  if (lowerKey.includes('type')) return 'nodeType';

  // Hierarchy
  if (lowerKey.includes('priority')) return 'priority';
  if (lowerKey.includes('importance')) return 'importance';
  if (lowerKey.includes('order') || lowerKey.includes('sort')) return 'sortOrder';

  return undefined;
}

function inferFieldMappings(schema: JSONSchema): FieldMapping[] {
  const mappings: FieldMapping[] = [];

  for (const [key, property] of Object.entries(schema.properties)) {
    if (property.inferredLATCH) {
      const mapping: FieldMapping = {
        jsonPath: key,
        targetProperty: property.inferredLATCH
      };

      // Add transform for known types
      if (property.inferredLATCH.includes('At') && property.type === 'string') {
        mapping.transform = { type: 'date' };
      } else if (['priority', 'importance', 'sortOrder'].includes(property.inferredLATCH) && property.type === 'string') {
        mapping.transform = { type: 'number' };
      } else if (property.inferredLATCH === 'tags' && property.type === 'string') {
        mapping.transform = { type: 'array' };
      }

      mappings.push(mapping);
    }
  }

  return mappings;
}

function getSampleData(data: any, maxItems: number): any[] {
  if (Array.isArray(data)) {
    return data.slice(0, maxItems);
  } else {
    return [data];
  }
}

interface ConversionResult {
  nodes: Node[];
  errors: string[];
  totalItems: number;
}

async function convertJSONToNodes(
  data: any,
  schema: JSONSchema,
  fieldMappings: FieldMapping[],
  options: JSONImportOptions
): Promise<ConversionResult> {
  const nodes: Node[] = [];
  const errors: string[] = [];
  let totalItems = 0;

  if (schema.type === 'array') {
    totalItems = data.length;

    for (let i = 0; i < data.length; i++) {
      try {
        const item = data[i];
        const node = convertItemToNode(item, fieldMappings, options, i, schema.filename);
        nodes.push(node);
      } catch (error) {
        errors.push(`Item ${i}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  } else if (schema.type === 'object') {
    totalItems = 1;

    try {
      const node = convertItemToNode(data, fieldMappings, options, 0, schema.filename);
      nodes.push(node);
    } catch (error) {
      errors.push(`Object conversion: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  } else {
    totalItems = 1;

    try {
      const node = createPrimitiveNode(data, options, schema.filename);
      nodes.push(node);
    } catch (error) {
      errors.push(`Primitive conversion: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  return { nodes, errors, totalItems };
}

function convertItemToNode(
  item: any,
  fieldMappings: FieldMapping[],
  options: JSONImportOptions,
  index: number,
  filename: string
): Node {
  // Initialize node with defaults
  const node: Partial<Node> = {
    id: crypto.randomUUID(),
    nodeType: (options.nodeType as NodeType) || 'json-object',
    name: `${filename.replace('.json', '')} (${index + 1})`,
    content: '',
    summary: '',
    createdAt: new Date(),
    modifiedAt: new Date(),
    folder: options.folder,
    tags: ['json-import'],
    priority: 0,
    importance: 0,
    sortOrder: index,
    source: options.source || 'json-import',
    sourceId: `${filename}[${index}]`,
    version: 1,
    syncVersion: 0
  };

  // Apply field mappings
  for (const mapping of fieldMappings) {
    try {
      const value = getValueByPath(item, mapping.jsonPath);
      if (value !== undefined) {
        const transformedValue = applyTransform(value, mapping.transform);
        setNodeProperty(node, mapping.targetProperty, transformedValue);
      }
    } catch (error) {
      // Skip invalid mappings
    }
  }

  // Generate content from unmapped properties
  if (!node.content) {
    node.content = generateMarkdownContent(item, fieldMappings);
  }

  // Generate summary if not mapped
  if (!node.summary) {
    node.summary = generateSummary(item, node.name || 'JSON Object');
  }

  return node as Node;
}

function createPrimitiveNode(value: any, options: JSONImportOptions, filename: string): Node {
  return {
    id: crypto.randomUUID(),
    nodeType: 'json-value' as NodeType,
    name: filename.replace('.json', ''),
    content: String(value),
    summary: `JSON value: ${String(value).substring(0, 100)}`,
    createdAt: new Date(),
    modifiedAt: new Date(),
    folder: options.folder,
    tags: ['json-import', 'primitive'],
    priority: 0,
    importance: 0,
    sortOrder: 0,
    source: options.source || 'json-import',
    sourceId: filename,
    version: 1,
    syncVersion: 0
  };
}

function getValueByPath(obj: any, path: string): any {
  // Simple path resolution (supports dot notation)
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

function applyTransform(value: any, transform?: FieldTransform): any {
  if (!transform) return value;

  switch (transform.type) {
    case 'date':
      if (typeof value === 'string') {
        const date = new Date(value);
        return isNaN(date.getTime()) ? new Date() : date;
      }
      return new Date();

    case 'number':
      return typeof value === 'number' ? value : parseInt(String(value)) || 0;

    case 'boolean':
      return Boolean(value);

    case 'array':
      if (Array.isArray(value)) return value;
      if (typeof value === 'string') {
        return value.split(',').map(s => s.trim());
      }
      return [value];

    case 'string':
      return String(value);

    case 'custom':
      return transform.customFunction ? transform.customFunction(value) : value;

    default:
      return value;
  }
}

function setNodeProperty(node: Partial<Node>, property: LATCHProperty, value: any): void {
  switch (property) {
    case 'name':
      node.name = String(value);
      break;
    case 'content':
      node.content = String(value);
      break;
    case 'summary':
      node.summary = String(value);
      break;
    case 'latitude':
      node.latitude = Number(value);
      break;
    case 'longitude':
      node.longitude = Number(value);
      break;
    case 'locationName':
      node.locationName = String(value);
      break;
    case 'locationAddress':
      node.locationAddress = String(value);
      break;
    case 'createdAt':
      node.createdAt = value instanceof Date ? value : new Date(value);
      break;
    case 'modifiedAt':
      node.modifiedAt = value instanceof Date ? value : new Date(value);
      break;
    case 'dueAt':
      node.dueAt = value instanceof Date ? value : new Date(value);
      break;
    case 'completedAt':
      node.completedAt = value instanceof Date ? value : new Date(value);
      break;
    case 'eventStart':
      node.eventStart = value instanceof Date ? value : new Date(value);
      break;
    case 'eventEnd':
      node.eventEnd = value instanceof Date ? value : new Date(value);
      break;
    case 'folder':
      node.folder = String(value);
      break;
    case 'tags':
      node.tags = Array.isArray(value) ? value.map(String) : [String(value)];
      break;
    case 'status':
      node.status = String(value);
      break;
    case 'nodeType':
      node.nodeType = String(value) as NodeType;
      break;
    case 'priority':
      node.priority = Number(value);
      break;
    case 'importance':
      node.importance = Number(value);
      break;
    case 'sortOrder':
      node.sortOrder = Number(value);
      break;
  }
}

function generateMarkdownContent(item: any, mappedFields: FieldMapping[]): string {
  const mappedPaths = new Set(mappedFields.map(m => m.jsonPath));
  const lines: string[] = [];

  function processValue(key: string, value: any, depth = 0): void {
    const indent = '  '.repeat(depth);

    if (mappedPaths.has(key)) {
      return; // Skip already mapped fields
    }

    if (typeof value === 'object' && value !== null) {
      if (Array.isArray(value)) {
        lines.push(`${indent}**${key}:** [${value.length} items]`);
        if (value.length <= 5) {
          value.forEach((item, index) => {
            lines.push(`${indent}  ${index + 1}. ${formatValue(item)}`);
          });
        }
      } else {
        lines.push(`${indent}**${key}:**`);
        Object.entries(value).forEach(([subKey, subValue]) => {
          processValue(subKey, subValue, depth + 1);
        });
      }
    } else {
      lines.push(`${indent}**${key}:** ${formatValue(value)}`);
    }
  }

  Object.entries(item).forEach(([key, value]) => {
    processValue(key, value);
  });

  return lines.join('\n');
}

function formatValue(value: any): string {
  if (typeof value === 'string') {
    return value.substring(0, 200) + (value.length > 200 ? '...' : '');
  }
  return String(value);
}

function generateSummary(item: any, defaultName: string): string {
  if (typeof item === 'object' && item !== null) {
    const propertyCount = Object.keys(item).length;
    return `JSON object "${defaultName}" with ${propertyCount} properties`;
  }
  return `JSON value: ${String(item).substring(0, 100)}`;
}

async function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}