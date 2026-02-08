/**
 * D3 Parsers - Data parsing utilities for D3.js
 *
 * Bridge eliminated - minimal parsing utilities
 */

import * as d3 from 'd3';

export interface ParsedData {
  [key: string]: unknown;
  id: string | number;
  value: unknown;
  type: 'string' | 'number' | 'date' | 'boolean';
}

export type VisualizationType =
  | 'bar-chart'
  | 'line-chart'
  | 'scatter-plot'
  | 'histogram'
  | 'network-graph'
  | 'pie-chart'
  | 'area-chart'
  | 'bar'
  | 'line'
  | 'area'
  | 'scatter'
  | 'pie'
  | 'unknown';

export interface VisualizationConfig {
  type: VisualizationType;
  axes?: {
    x?: string;
    y?: string;
    color?: string;
    size?: string;
  };
  encoding?: {
    xType: 'categorical' | 'continuous' | 'temporal';
    yType: 'categorical' | 'continuous' | 'temporal';
  };
  suggestions?: string[];
  confidence?: number;
}

export function parseCSVData(csvString: string): ParsedData[] {
  const data = d3.csvParse(csvString);
  return data.map((row, index) => ({
    id: index,
    value: row,
    type: 'string' as const
  }));
}

export function parseTSVData(tsvString: string): ParsedData[] {
  const data = d3.tsvParse(tsvString);
  return data.map((row, index) => ({
    id: index,
    value: row,
    type: 'string' as const
  }));
}

export function parseJSONData(jsonString: string): ParsedData[] {
  try {
    const data = JSON.parse(jsonString);
    if (Array.isArray(data)) {
      return data.map((item, index) => ({
        id: item.id || index,
        value: item,
        type: typeof item === 'object' ? 'string' : typeof item
      })) as ParsedData[];
    }
    return [{
      id: 0,
      value: data,
      type: typeof data
    }] as ParsedData[];
  } catch {
    return [];
  }
}

export function detectDataType(value: unknown): 'string' | 'number' | 'date' | 'boolean' {
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'number') return 'number';
  if (value instanceof Date) return 'date';

  // Try to parse as number
  const numValue = Number(value);
  if (!isNaN(numValue) && isFinite(numValue)) return 'number';

  // Try to parse as date
  const dateValue = new Date(String(value));
  if (!isNaN(dateValue.getTime())) return 'date';

  return 'string';
}


export interface VisualizationDirective {
  type: string;
  config: VisualizationConfig;
  data: ParsedData[];
  x?: string;
  y?: string;
  color?: string;
  size?: string;
}

export interface ChartDataResult extends Array<ParsedData> {
  isValid: boolean;
  data: ParsedData[];
  error?: string;
}

export function parseChartData(content: string): ParsedData[] {
  try {
    let data: ParsedData[] = [];

    // Try to detect CSV/TSV first
    if (content.includes(',') || content.includes('\t')) {
      if (content.includes('\t')) {
        data = parseTSVData(content);
      } else {
        data = parseCSVData(content);
      }
    }
    // Try JSON
    else if (content.trim().startsWith('{') || content.trim().startsWith('[')) {
      data = parseJSONData(content);
    }

    return data;
  } catch (error) {
    return [];
  }
}

export function detectVisualizationType(data: ParsedData[]): VisualizationConfig {
  if (data.length === 0) {
    return {
      type: 'unknown',
      axes: {},
      encoding: { xType: 'categorical', yType: 'continuous' },
      suggestions: [],
      confidence: 0
    };
  }

  // Simple heuristics for visualization type detection
  const hasNumericData = data.some(d => typeof d.value === 'number' || d.type === 'number');
  const hasDateData = data.some(d => d.type === 'date');

  let type: VisualizationConfig['type'] = 'bar'; // default
  let confidence = 0.5;

  if (hasDateData && hasNumericData) {
    type = 'line';
    confidence = 0.8;
  } else if (hasNumericData) {
    type = data.length > 20 ? 'histogram' : 'bar';
    confidence = 0.7;
  }

  return {
    type,
    axes: { x: 'index', y: 'value' },
    encoding: {
      xType: hasDateData ? 'temporal' : 'categorical',
      yType: hasNumericData ? 'continuous' : 'categorical'
    },
    suggestions: [`Try a ${type} chart`, 'Consider data transformation'],
    confidence
  };
}

export function extractVisualizationConfig(content: string): VisualizationDirective | null {
  const data = parseChartData(content);
  if (data.length === 0) return null;

  const config = detectVisualizationType(data);

  return {
    type: config.type as string,
    config,
    data
  };
}

export default {
  parseCSVData,
  parseTSVData,
  parseJSONData,
  detectDataType,
  parseChartData,
  detectVisualizationType,
  extractVisualizationConfig
};