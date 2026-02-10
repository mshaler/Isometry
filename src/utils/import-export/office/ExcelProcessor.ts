/**
 * Excel Document Processor - XLSX import/export functionality
 */

import * as XLSX from 'xlsx';
import type { Node } from '../../../types/node';
import type {
  OfficeImportOptions,
  OfficeImportResult,
  ExcelSheetData
} from './types';

export class ExcelProcessor {

  /**
   * Import Excel file and convert to Node array
   */
  async importExcel(file: File, options: OfficeImportOptions = {}): Promise<OfficeImportResult> {
    const {
      nodeType = 'spreadsheet',
      folder = undefined,
      source = 'excel-import',
      sheetNames = [],
      extractTables = true
    } = options;

    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array', cellStyles: true });

      const nodes: Node[] = [];
      const errors: string[] = [];
      const processedSheets: string[] = [];

      // Determine which sheets to process
      const sheetsToProcess = sheetNames.length > 0
        ? sheetNames.filter(name => workbook.SheetNames.includes(name))
        : workbook.SheetNames;

      for (const sheetName of sheetsToProcess) {
        try {
          const worksheet = workbook.Sheets[sheetName];
          const sheetData = this.processExcelSheet(worksheet, sheetName, extractTables);

          // Create node from sheet data
          const node = await this.createNodeFromSheetData(
            sheetData,
            file.name,
            sheetName,
            { nodeType, folder, source }
          );

          nodes.push(node);
          processedSheets.push(sheetName);
        } catch (error) {
          errors.push(`Failed to process sheet "${sheetName}": ${error}`);
        }
      }

      return {
        nodes,
        errors,
        metadata: {
          totalSheets: workbook.SheetNames.length,
          processedSheets,
          tableCount: nodes.reduce((sum, node) =>
            sum + (node.content?.match(/\|.*\|/g)?.length || 0), 0
          )
        }
      };
    } catch (error) {
      throw new Error(`Failed to import Excel file: ${error}`);
    }
  }

  /**
   * Export nodes to Excel format
   */
  async exportToExcel(nodes: Node[], _filename?: string): Promise<Blob> {
    const workbook = XLSX.utils.book_new();

    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      const sheetName = this.sanitizeSheetName(node.name || `Sheet${i + 1}`);

      // Convert node content to worksheet data
      const worksheetData = this.nodeContentToWorksheetData(node);
      const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);

      // Add metadata as comments or separate section
      this.addNodeMetadataToWorksheet(worksheet, node);

      XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    }

    // Generate Excel file
    const excelBuffer = XLSX.write(workbook, {
      bookType: 'xlsx',
      type: 'array',
      cellStyles: true
    });

    return new Blob([excelBuffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
  }

  /**
   * Process Excel sheet data
   */
  private processExcelSheet(
    worksheet: XLSX.WorkSheet,
    sheetName: string,
    _extractTables: boolean = true
  ): ExcelSheetData {
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1:A1');
    const data: (string | number | boolean | null)[][] = [];

    // Extract data from cells
    for (let row = range.s.r; row <= range.e.r; row++) {
      const rowData: (string | number | boolean | null)[] = [];
      for (let col = range.s.c; col <= range.e.c; col++) {
        const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
        const cell = worksheet[cellAddress];

        if (cell && cell.v !== undefined) {
          rowData[col] = cell.v;
        } else {
          rowData[col] = null;
        }
      }
      data[row] = rowData;
    }

    return {
      name: sheetName,
      data,
      range: worksheet['!ref'] || 'A1:A1',
      rowCount: range.e.r - range.s.r + 1,
      colCount: range.e.c - range.s.c + 1
    };
  }

  /**
   * Create Node from sheet data
   */
  private async createNodeFromSheetData(
    sheetData: ExcelSheetData,
    fileName: string,
    sheetName: string,
    options: { nodeType?: string; folder?: string; source?: string }
  ): Promise<Node> {
    const { nodeType = 'spreadsheet', folder, source = 'excel-import' } = options;

    // Convert sheet data to markdown table
    const markdownContent = this.convertSheetDataToMarkdown(sheetData);

    // Generate summary
    const summary = this.generateSheetSummary(sheetData);

    return {
      id: `excel_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: `${fileName} - ${sheetName}`,
      content: markdownContent,
      summary,
      folder: folder || 'imported',
      tags: ['excel', 'imported', nodeType],
      status: 'active',
      priority: 1,
      location: '',
      created_at: new Date().toISOString(),
      modified_at: new Date().toISOString(),
      source,
      source_id: `${fileName}_${sheetName}`,
      metadata: {
        originalFileName: fileName,
        sheetName,
        rowCount: sheetData.rowCount,
        colCount: sheetData.colCount,
        cellRange: sheetData.range,
        importedAt: new Date().toISOString()
      }
    };
  }

  /**
   * Convert sheet data to markdown table
   */
  private convertSheetDataToMarkdown(sheetData: ExcelSheetData): string {
    if (sheetData.data.length === 0) {
      return `# ${sheetData.name}\n\nEmpty sheet`;
    }

    let markdown = `# ${sheetData.name}\n\n`;

    // Filter out rows that are entirely null/empty
    const nonEmptyRows = sheetData.data.filter(row =>
      row && row.some(cell => cell !== null && cell !== undefined && cell !== '')
    );

    if (nonEmptyRows.length === 0) {
      return markdown + 'Empty sheet';
    }

    // Create markdown table
    const headers = nonEmptyRows[0]?.map(cell => String(cell || '')) || [];
    const maxCols = Math.max(...nonEmptyRows.map(row => row?.length || 0));

    // Ensure headers array has enough columns
    while (headers.length < maxCols) {
      headers.push(`Column ${headers.length + 1}`);
    }

    // Table header
    markdown += '| ' + headers.join(' | ') + ' |\n';
    markdown += '|' + headers.map(() => '---').join('|') + '|\n';

    // Table rows (skip header row if we used it)
    const dataRows = nonEmptyRows.slice(1);
    for (const row of dataRows) {
      const cells = [];
      for (let i = 0; i < maxCols; i++) {
        const cell = row?.[i];
        cells.push(String(cell !== null && cell !== undefined ? cell : ''));
      }
      markdown += '| ' + cells.join(' | ') + ' |\n';
    }

    return markdown;
  }

  /**
   * Generate sheet summary
   */
  private generateSheetSummary(sheetData: ExcelSheetData): string {
    const nonEmptyRows = sheetData.data.filter(row =>
      row && row.some(cell => cell !== null && cell !== undefined && cell !== '')
    );

    return `Excel sheet "${sheetData.name}" with ${nonEmptyRows.length} rows and ${sheetData.colCount} columns.`;
  }

  /**
   * Convert Node content to worksheet data
   */
  private nodeContentToWorksheetData(node: Node): (string | number)[][] {
    if (!node.content) {
      return [
        ['Name', node.name || ''],
        ['Summary', node.summary || ''],
        ['Status', node.status || ''],
        ['Priority', node.priority || ''],
        ['Tags', (node.tags || []).join(', ')]
      ];
    }

    // Try to parse markdown table
    const tableMatches = node.content.match(/\|.*\|/g);
    if (tableMatches && tableMatches.length > 1) {
      return this.parseMarkdownTable(tableMatches.join('\n'));
    }

    // Fallback: split content into lines
    const lines = node.content.split('\n').filter(line => line.trim());
    return lines.map(line => [line]);
  }

  /**
   * Parse markdown table to array format
   */
  private parseMarkdownTable(markdownTable: string): (string | number)[][] {
    const lines = markdownTable.split('\n').filter(line => line.includes('|'));
    const result: (string | number)[][] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Skip separator line (contains only |, -, and spaces)
      if (line.match(/^[|\s-]+$/)) {
        continue;
      }

      const cells = line.split('|')
        .map(cell => cell.trim())
        .filter((_cell, index, array) => index > 0 && index < array.length - 1); // Remove empty start/end

      // Convert numeric strings to numbers
      const processedCells = cells.map(cell => {
        const num = parseFloat(cell);
        return !isNaN(num) && isFinite(num) ? num : cell;
      });

      result.push(processedCells);
    }

    return result;
  }

  /**
   * Add node metadata to worksheet
   */
  private addNodeMetadataToWorksheet(worksheet: XLSX.WorkSheet, node: Node): void {
    // Find the last row to add metadata below the data
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1:A1');
    const metadataStartRow = range.e.r + 3; // Leave some space

    const metadata = [
      ['Metadata'],
      ['Name:', node.name || ''],
      ['Summary:', node.summary || ''],
      ['Status:', node.status || ''],
      ['Priority:', String(node.priority || '')],
      ['Tags:', (node.tags || []).join(', ')],
      ['Created:', node.created_at || ''],
      ['Modified:', node.modified_at || '']
    ];

    metadata.forEach((row, index) => {
      row.forEach((cell, colIndex) => {
        const cellAddress = XLSX.utils.encode_cell({
          r: metadataStartRow + index,
          c: colIndex
        });
        worksheet[cellAddress] = { v: cell, t: 's' };
      });
    });

    // Update the range to include metadata
    worksheet['!ref'] = XLSX.utils.encode_range({
      s: { r: 0, c: 0 },
      e: { r: metadataStartRow + metadata.length - 1, c: Math.max(range.e.c, 1) }
    });
  }

  /**
   * Sanitize sheet name for Excel
   */
  private sanitizeSheetName(name: string): string {
    return name
      .replace(/[\\/?*[\]]/g, '_') // Replace invalid chars
      .slice(0, 31); // Excel sheet names max 31 chars
  }
}