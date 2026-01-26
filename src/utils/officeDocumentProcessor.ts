import * as XLSX from 'xlsx';
import mammoth from 'mammoth';
import type { Node } from '../types/node';

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
  styles: Record<string, { color?: string; fontSize?: number; fontFamily?: string; bold?: boolean; italic?: boolean; }>;
}

interface MammothImage {
  read(format: string): Promise<string>;
  contentType: string;
}

/**
 * Comprehensive Office document processor for XLSX and DOCX files
 * Provides high-fidelity import/export for business documents
 */
export class OfficeDocumentProcessor {

  // MARK: - XLSX Processing

  /**
   * Import Excel file and convert to Node array
   */
  async importExcel(file: File, options: OfficeImportOptions = {}): Promise<OfficeImportResult> {
    const {
      nodeType = 'spreadsheet',
      folder = null,
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

  // MARK: - DOCX Processing

  /**
   * Import Word document and convert to Node
   */
  async importWord(file: File, options: OfficeImportOptions = {}): Promise<OfficeImportResult> {
    const {
      nodeType = 'document',
      folder = null,
      source = 'word-import',
      preserveFormatting = true
    } = options;

    try {
      const arrayBuffer = await file.arrayBuffer();
      const docData = await this.processWordDocument(arrayBuffer, preserveFormatting);

      // Create node from document content
      const node = await this.createNodeFromWordData(
        docData,
        file.name,
        { nodeType, folder, source, preserveFormatting }
      );

      return {
        nodes: [node],
        errors: [],
        metadata: {
          wordCount: this.countWords(docData.content),
          tableCount: (docData.html.match(/<table/g) || []).length
        }
      };
    } catch (error) {
      throw new Error(`Failed to import Word document: ${error}`);
    }
  }

  /**
   * Export node to Word document format
   */
  async exportToWord(node: Node): Promise<Blob> {
    // Convert markdown content to HTML
    const htmlContent = this.convertMarkdownToWordHTML(node.content || '');

    // Create Word document structure
    const wordXML = this.createWordDocumentXML(node, htmlContent);

    // Package as DOCX (ZIP format)
    return this.packageAsDocx(wordXML, node);
  }

  // MARK: - Private Processing Methods

  private processExcelSheet(
    worksheet: XLSX.WorkSheet,
    sheetName: string,
    _extractTables: boolean
  ): ExcelSheetData {
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1:A1');
    const data: (string | number | boolean | null)[][] = [];

    // Extract data row by row
    for (let row = range.s.r; row <= range.e.r; row++) {
      const rowData: (string | number | boolean | null)[] = [];

      for (let col = range.s.c; col <= range.e.c; col++) {
        const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
        const cell = worksheet[cellAddress];

        if (cell) {
          // Handle different cell types
          switch (cell.t) {
            case 'n': // Number
              rowData.push(cell.v);
              break;
            case 's': // String
              rowData.push(cell.v);
              break;
            case 'b': // Boolean
              rowData.push(cell.v);
              break;
            case 'd': // Date
              rowData.push(cell.w || cell.v);
              break;
            default:
              rowData.push(cell.w || cell.v || '');
          }
        } else {
          rowData.push(null);
        }
      }

      data.push(rowData);
    }

    return {
      name: sheetName,
      data,
      range: worksheet['!ref'] || 'A1:A1',
      rowCount: range.e.r - range.s.r + 1,
      colCount: range.e.c - range.s.c + 1
    };
  }

  private async processWordDocument(
    arrayBuffer: ArrayBuffer,
    preserveFormatting: boolean
  ): Promise<WordDocumentData> {
    const options = {
      convertImage: mammoth.images.imgElement((image: MammothImage) => {
        return image.read('base64').then((imageBuffer: string) => {
          return {
            src: `data:${image.contentType};base64,${imageBuffer}`
          };
        });
      }),
      includeDefaultStyleMap: preserveFormatting,
      styleMap: preserveFormatting ? [
        "p[style-name='Heading 1'] => h1",
        "p[style-name='Heading 2'] => h2",
        "p[style-name='Heading 3'] => h3",
        "b => strong",
        "i => em"
      ] : []
    };

    const result = await mammoth.convertToHtml({ arrayBuffer }, options);
    const _textResult = await mammoth.extractRawText({ arrayBuffer });

    return {
      content: this.convertHtmlToMarkdown(result.value),
      html: result.value,
      images: [], // TODO: Extract images if needed
      styles: {} // TODO: Extract style information
    };
  }

  private async createNodeFromSheetData(
    sheetData: ExcelSheetData,
    filename: string,
    sheetName: string,
    options: Pick<OfficeImportOptions, 'nodeType' | 'folder' | 'source'>
  ): Promise<Node> {
    // Convert sheet data to markdown table
    const markdownContent = this.convertSheetDataToMarkdown(sheetData);

    return {
      id: crypto.randomUUID(),
      nodeType: options.nodeType || 'spreadsheet',
      name: `${filename} - ${sheetName}`,
      content: markdownContent,
      summary: this.generateSheetSummary(sheetData),
      createdAt: new Date().toISOString(),
      modifiedAt: new Date().toISOString(),
      folder: options.folder || null,
      tags: [`excel-import`, `sheet-${sheetName.toLowerCase()}`],
      source: options.source || 'excel-import',
      sourceId: `${filename}-${sheetName}`,
      sourceUrl: null
    };
  }

  private async createNodeFromWordData(
    docData: WordDocumentData,
    filename: string,
    options: Pick<OfficeImportOptions, 'nodeType' | 'folder' | 'source' | 'preserveFormatting'>
  ): Promise<Node> {
    return {
      id: crypto.randomUUID(),
      nodeType: options.nodeType || 'document',
      name: filename.replace(/\.docx?$/i, ''),
      content: docData.content,
      summary: this.generateDocumentSummary(docData.content),
      createdAt: new Date().toISOString(),
      modifiedAt: new Date().toISOString(),
      folder: options.folder || null,
      tags: ['word-import', options.preserveFormatting ? 'formatted' : 'plain-text'],
      source: options.source || 'word-import',
      sourceId: filename,
      sourceUrl: null
    };
  }

  // MARK: - Conversion Utilities

  private convertSheetDataToMarkdown(sheetData: ExcelSheetData): string {
    if (sheetData.data.length === 0) {
      return `# ${sheetData.name}\n\n*Empty sheet*`;
    }

    const lines = [`# ${sheetData.name}\n`];

    // Add metadata
    lines.push(`*Range: ${sheetData.range} (${sheetData.rowCount}×${sheetData.colCount})*\n`);

    // Convert to markdown table
    const nonEmptyRows = sheetData.data.filter(row =>
      row.some(cell => cell !== null && cell !== '')
    );

    if (nonEmptyRows.length === 0) {
      lines.push('*No data*');
      return lines.join('\n');
    }

    // Use first non-empty row as headers
    const headers = nonEmptyRows[0].map(cell =>
      String(cell || '').replace(/\|/g, '\\|')
    );

    lines.push('| ' + headers.join(' | ') + ' |');
    lines.push('| ' + headers.map(() => '---').join(' | ') + ' |');

    // Add data rows
    for (let i = 1; i < nonEmptyRows.length; i++) {
      const row = nonEmptyRows[i].map(cell =>
        String(cell || '').replace(/\|/g, '\\|')
      );
      lines.push('| ' + row.join(' | ') + ' |');
    }

    return lines.join('\n');
  }

  private convertHtmlToMarkdown(html: string): string {
    let markdown = html;

    // Convert headers
    markdown = markdown.replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n');
    markdown = markdown.replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n');
    markdown = markdown.replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n');

    // Convert emphasis
    markdown = markdown.replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**');
    markdown = markdown.replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**');
    markdown = markdown.replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*');
    markdown = markdown.replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*');

    // Convert paragraphs
    markdown = markdown.replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n');

    // Convert line breaks
    markdown = markdown.replace(/<br[^>]*>/gi, '\n');

    // Convert lists
    markdown = markdown.replace(/<ul[^>]*>(.*?)<\/ul>/gis, '$1\n');
    markdown = markdown.replace(/<ol[^>]*>(.*?)<\/ol>/gis, '$1\n');
    markdown = markdown.replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n');

    // Remove remaining HTML tags
    markdown = markdown.replace(/<[^>]*>/g, '');

    // Clean up multiple newlines
    markdown = markdown.replace(/\n{3,}/g, '\n\n');

    return markdown.trim();
  }

  private convertMarkdownToWordHTML(markdown: string): string {
    let html = markdown;

    // Convert headers
    html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

    // Convert emphasis
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

    // Convert paragraphs
    html = html.replace(/\n\n/g, '</p><p>');
    html = `<p>${html}</p>`;

    // Convert lists (simple)
    html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');

    return html;
  }

  // MARK: - Helper Methods

  private generateSheetSummary(sheetData: ExcelSheetData): string {
    const { rowCount, colCount, name } = sheetData;
    const nonEmptyRows = sheetData.data.filter(row =>
      row.some(cell => cell !== null && cell !== '')
    ).length;

    return `Excel sheet "${name}" with ${nonEmptyRows}/${rowCount} rows and ${colCount} columns`;
  }

  private generateDocumentSummary(content: string): string {
    const words = this.countWords(content);
    const lines = content.split('\n').length;
    const firstLine = content.split('\n')[0]?.substring(0, 100) || '';

    return `Word document with ${words} words, ${lines} lines. ${firstLine}${firstLine.length > 100 ? '...' : ''}`;
  }

  private countWords(text: string): number {
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
  }

  private sanitizeSheetName(name: string): string {
    return name
      .replace(/[:/?*[\]\\]/g, '_')
      .substring(0, 31); // Excel sheet name limit
  }

  private nodeContentToWorksheetData(node: Node): (string | number)[][] {
    const content = node.content || '';

    // If content contains markdown table, parse it
    const tableMatch = content.match(/\|(.+\|.+)\n\|(.+)\|\n((\|.+\|.+\n?)+)/);
    if (tableMatch) {
      return this.parseMarkdownTable(tableMatch[0]);
    }

    // Otherwise, treat as simple text data
    const lines = content.split('\n').filter(line => line.trim());
    return [
      ['Content'],
      ...lines.map(line => [line])
    ];
  }

  private parseMarkdownTable(markdownTable: string): (string | number)[][] {
    const lines = markdownTable.trim().split('\n');
    const data: (string | number)[][] = [];

    for (let i = 0; i < lines.length; i++) {
      if (i === 1) continue; // Skip separator line

      const row = lines[i]
        .split('|')
        .slice(1, -1) // Remove empty first/last elements
        .map(cell => {
          const trimmed = cell.trim();
          const num = Number(trimmed);
          return isNaN(num) ? trimmed : num;
        });

      data.push(row);
    }

    return data;
  }

  private addNodeMetadataToWorksheet(worksheet: XLSX.WorkSheet, node: Node): void {
    // Add metadata as comments or in a separate area
    const _metadataRange = 'Z1:Z10'; // Use column Z for metadata

    const metadata = [
      ['Metadata'],
      ['Node ID', node.id],
      ['Name', node.name || ''],
      ['Type', node.nodeType],
      ['Created', node.createdAt],
      ['Modified', node.modifiedAt],
      ['Source', node.source || ''],
      ['Tags', node.tags?.join(', ') || '']
    ];

    metadata.forEach(([key, value], index) => {
      const cellRef = `Z${index + 1}`;
      worksheet[cellRef] = { t: 's', v: index === 0 ? key : `${key}: ${value}` };
    });
  }

  private createWordDocumentXML(node: Node, htmlContent: string): string {
    // Simplified Word XML structure
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p>
      <w:r>
        <w:t>${node.name || 'Untitled Document'}</w:t>
      </w:r>
    </w:p>
    ${this.convertHTMLToWordML(htmlContent)}
  </w:body>
</w:document>`;
  }

  private convertHTMLToWordML(html: string): string {
    // Simplified HTML to WordML conversion
    let wordML = html;

    // Convert paragraphs
    wordML = wordML.replace(/<p[^>]*>(.*?)<\/p>/gi, '<w:p><w:r><w:t>$1</w:t></w:r></w:p>');

    // Convert headers
    wordML = wordML.replace(/<h1[^>]*>(.*?)<\/h1>/gi, '<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>$1</w:t></w:r></w:p>');

    // Remove other HTML tags for now
    wordML = wordML.replace(/<[^>]*>/g, '');

    return wordML;
  }

  private async packageAsDocx(wordXML: string, _node: Node): Promise<Blob> {
    // For now, return as plain XML - full DOCX packaging would require ZIP library
    // TODO: Implement proper DOCX packaging with relationships, content types, etc.
    const xmlBlob = new Blob([wordXML], {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    });

    return xmlBlob;
  }
}

// Export singleton instance
export const officeProcessor = new OfficeDocumentProcessor();

// Export utility functions
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export async function importOfficeFile(
  file: File,
  options?: OfficeImportOptions
): Promise<OfficeImportResult> {
  const processor = new OfficeDocumentProcessor();

  if (file.name.toLowerCase().endsWith('.xlsx') || file.name.toLowerCase().endsWith('.xls')) {
    return processor.importExcel(file, options);
  } else if (file.name.toLowerCase().endsWith('.docx') || file.name.toLowerCase().endsWith('.doc')) {
    return processor.importWord(file, options);
  } else {
    throw new Error(`Unsupported file type: ${file.name}`);
  }
}