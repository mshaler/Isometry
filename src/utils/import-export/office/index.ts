/**
 * Office Document Processor - Unified interface for XLSX and DOCX processing
 */

import type { Node } from '../../../types/node';
import type { OfficeImportOptions, OfficeImportResult } from './types';
import { ExcelProcessor } from './ExcelProcessor';
import { WordProcessor } from './WordProcessor';

// Re-export types
export * from './types';

/**
 * Comprehensive Office document processor for XLSX and DOCX files
 * Provides high-fidelity import/export for business documents
 */
export class OfficeDocumentProcessor {
  private excelProcessor: ExcelProcessor;
  private wordProcessor: WordProcessor;

  constructor() {
    this.excelProcessor = new ExcelProcessor();
    this.wordProcessor = new WordProcessor();
  }

  // MARK: - XLSX Processing

  /**
   * Import Excel file and convert to Node array
   */
  async importExcel(file: File, options: OfficeImportOptions = {}): Promise<OfficeImportResult> {
    return this.excelProcessor.importExcel(file, options);
  }

  /**
   * Export nodes to Excel format
   */
  async exportToExcel(nodes: Node[], filename?: string): Promise<Blob> {
    return this.excelProcessor.exportToExcel(nodes, filename);
  }

  // MARK: - DOCX Processing

  /**
   * Import Word document and convert to Node
   */
  async importWord(file: File, options: OfficeImportOptions = {}): Promise<OfficeImportResult> {
    return this.wordProcessor.importWord(file, options);
  }

  /**
   * Export node to Word document format
   */
  async exportToWord(node: Node): Promise<Blob> {
    return this.wordProcessor.exportToWord(node);
  }
}

// Export singleton instance
export const officeProcessor = new OfficeDocumentProcessor();

// Export utility functions
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function getFileExtension(filename: string): string {
  return filename.split('.').pop()?.toLowerCase() || '';
}

export function isExcelFile(file: File): boolean {
  const extension = getFileExtension(file.name);
  return ['xlsx', 'xls'].includes(extension) ||
         file.type.includes('spreadsheet') ||
         file.type.includes('excel');
}

export function isWordFile(file: File): boolean {
  const extension = getFileExtension(file.name);
  return ['docx', 'doc'].includes(extension) ||
         file.type.includes('document') ||
         file.type.includes('word');
}

/**
 * Import an office file (Excel or Word) and convert to nodes
 * Convenience function that detects file type and dispatches to correct processor
 */
export async function importOfficeFile(
  file: File,
  options: OfficeImportOptions = {}
): Promise<OfficeImportResult> {
  if (isExcelFile(file)) {
    return officeProcessor.importExcel(file, options);
  } else if (isWordFile(file)) {
    return officeProcessor.importWord(file, options);
  }
  throw new Error('Unsupported file type');
}

export default OfficeDocumentProcessor;