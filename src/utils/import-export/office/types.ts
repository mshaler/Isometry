/**
 * Office Document Processing Types
 */

import type { Node } from '../../../types/node';

// Type definitions for document processing
export interface DocumentStyle {
  fontSize?: number;
  fontFamily?: string;
  color?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
}

export interface OfficeImportOptions {
  nodeType?: string;
  folder?: string;
  source?: string;
  preserveFormatting?: boolean;
  extractTables?: boolean;
  sheetNames?: string[]; // For XLSX: specific sheets to import
}

export interface OfficeImportResult {
  nodes: Node[];
  errors: string[];
  metadata: {
    totalSheets?: number;
    processedSheets?: string[];
    wordCount?: number;
    tableCount?: number;
  };
}

export interface ExcelSheetData {
  name: string;
  data: (string | number | boolean | null)[][];
  range: string;
  rowCount: number;
  colCount: number;
}

export interface WordDocumentData {
  content: string;
  html: string;
  images: { id: string; buffer: ArrayBuffer; contentType: string }[];
  styles: Record<string, {
    color?: string;
    fontSize?: number;
    fontFamily?: string;
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
  }>;
}

export interface MammothImage {
  read(format: string): Promise<string>;
  contentType: string;
}

export interface DocumentTransform {
  styleId?: string;
  styleName?: string;
  alignment?: {
    bold?: boolean;
    italic?: boolean;
  };
  font?: {
    name?: string;
    size?: number;
  };
  color?: string;
  type?: string;
  children?: DocumentTransform[];
}