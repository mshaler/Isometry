import * as XLSX from 'xlsx';
import * as mammoth from 'mammoth';
import * as JSZip from 'jszip';
import type { Node, NodeType } from '../types/node';

// Type definitions for document processing
interface DocumentStyle {
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
  styles: Record<string, { color?: string; fontSize?: number; fontFamily?: string; bold?: boolean; italic?: boolean; underline?: boolean; }>;
}

interface MammothImage {
  read(format: string): Promise<string>;
  contentType: string;
}

interface DocumentTransform {
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

  // MARK: - DOCX Processing

  /**
   * Import Word document and convert to Node
   */
  async importWord(file: File, options: OfficeImportOptions = {}): Promise<OfficeImportResult> {
    const {
      nodeType = 'document',
      folder = undefined,
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
    const extractedImages: { id: string; buffer: ArrayBuffer; contentType: string }[] = [];
    const extractedStyles: Record<string, { color?: string; fontSize?: number; fontFamily?: string; bold?: boolean; italic?: boolean; }> = {};

    const options = {
      convertImage: mammoth.images.imgElement((image: MammothImage) => {
        return image.read('base64').then((imageBuffer: string) => {
          // Generate unique ID for this image
          const imageId = `img_${crypto.randomUUID()}`;

          // Convert base64 back to ArrayBuffer for storage
          const binaryString = atob(imageBuffer);
          const buffer = new ArrayBuffer(binaryString.length);
          const uint8Array = new Uint8Array(buffer);
          for (let i = 0; i < binaryString.length; i++) {
            uint8Array[i] = binaryString.charCodeAt(i);
          }

          // Store image data
          extractedImages.push({
            id: imageId,
            buffer: buffer,
            contentType: image.contentType
          });

          return {
            src: `data:${image.contentType};base64,${imageBuffer}`,
            'data-image-id': imageId
          };
        });
      }),
      includeDefaultStyleMap: preserveFormatting,
      styleMap: preserveFormatting ? [
        "p[style-name='Heading 1'] => h1",
        "p[style-name='Heading 2'] => h2",
        "p[style-name='Heading 3'] => h3",
        "p[style-name='Title'] => h1.document-title",
        "p[style-name='Subtitle'] => h2.document-subtitle",
        "p[style-name='Quote'] => blockquote",
        "p[style-name='Code'] => code",
        "b => strong",
        "i => em",
        "u => u"
      ] : [],
      transformDocument: preserveFormatting ? ((element: DocumentTransform) => {
        // Extract style information from paragraph elements
        if (element.styleId && element.styleName) {
          const styleInfo: DocumentStyle = {
            bold: element.alignment?.bold || false,
            italic: element.alignment?.italic || false
          };

          // Extract font information if available
          if (element.font) {
            styleInfo.fontFamily = element.font.name;
            styleInfo.fontSize = element.font.size;
          }

          // Extract color information if available
          if (element.color) {
            styleInfo.color = element.color;
          }

          extractedStyles[element.styleName] = styleInfo;
        }
        return element;
      }) : undefined
    };

    const result = await mammoth.convertToHtml({ arrayBuffer }, options);

    // Parse the HTML to extract additional style information
    this.extractStylesFromHtml(result.value, extractedStyles);

    return {
      content: this.convertHtmlToMarkdown(result.value),
      html: result.value,
      images: extractedImages,
      styles: extractedStyles
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
      nodeType: (options.nodeType || 'resource') as NodeType,
      name: `${filename} - ${sheetName}`,
      content: markdownContent,
      summary: this.generateSheetSummary(sheetData),

      // LATCH: Location
      latitude: null,
      longitude: null,
      locationName: null,
      locationAddress: null,

      // LATCH: Time
      createdAt: new Date().toISOString(),
      modifiedAt: new Date().toISOString(),
      dueAt: null,
      completedAt: null,
      eventStart: null,
      eventEnd: null,

      // LATCH: Category
      folder: options.folder || null,
      tags: [`excel-import`, `sheet-${sheetName.toLowerCase()}`],
      status: null,

      // LATCH: Hierarchy
      priority: 0,
      importance: 0,
      sortOrder: 0,

      // Metadata
      source: options.source || 'excel-import',
      sourceId: `${filename}-${sheetName}`,
      sourceUrl: null,
      deletedAt: null,
      version: 1
    };
  }

  private async createNodeFromWordData(
    docData: WordDocumentData,
    filename: string,
    options: Pick<OfficeImportOptions, 'nodeType' | 'folder' | 'source' | 'preserveFormatting'>
  ): Promise<Node> {
    return {
      id: crypto.randomUUID(),
      nodeType: (options.nodeType || 'note') as NodeType,
      name: filename.replace(/\.docx?$/i, ''),
      content: docData.content,
      summary: this.generateDocumentSummary(docData.content),

      // LATCH: Location
      latitude: null,
      longitude: null,
      locationName: null,
      locationAddress: null,

      // LATCH: Time
      createdAt: new Date().toISOString(),
      modifiedAt: new Date().toISOString(),
      dueAt: null,
      completedAt: null,
      eventStart: null,
      eventEnd: null,

      // LATCH: Category
      folder: options.folder || null,
      tags: ['word-import', options.preserveFormatting ? 'formatted' : 'plain-text'],
      status: null,

      // LATCH: Hierarchy
      priority: 0,
      importance: 0,
      sortOrder: 0,

      // Metadata
      source: options.source || 'word-import',
      sourceId: filename,
      sourceUrl: null,
      deletedAt: null,
      version: 1
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
    markdown = markdown.replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, '$1\n');
    markdown = markdown.replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, '$1\n');
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
    html = html.replace(/(<li>[\s\S]*<\/li>)/, '<ul>$1</ul>');

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
    // const _metadataRange = 'Z1:Z10'; // Reserved: Use column Z for metadata

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

  /**
   * Extract style information from HTML content
   */
  private extractStylesFromHtml(html: string, styles: Record<string, DocumentStyle>): void {
    // Parse HTML to extract inline styles and class-based styles
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // Extract styles from elements with style attributes
    const elementsWithStyles = doc.querySelectorAll('[style]');
    elementsWithStyles.forEach((element, index) => {
      const styleAttr = element.getAttribute('style');
      if (styleAttr) {
        const parsedStyle = this.parseInlineStyle(styleAttr);
        styles[`inline-style-${index}`] = parsedStyle;
      }
    });

    // Extract styles from class names and tag names
    const styledElements = doc.querySelectorAll('h1, h2, h3, h4, h5, h6, strong, em, u, code, blockquote');
    styledElements.forEach((element) => {
      const tagName = element.tagName.toLowerCase();
      const className = element.className;

      if (className) {
        styles[className] = this.getDefaultStyleForElement(tagName, className);
      } else if (!styles[tagName]) {
        styles[tagName] = this.getDefaultStyleForElement(tagName);
      }
    });
  }

  /**
   * Parse inline CSS style string into style object
   */
  private parseInlineStyle(styleStr: string): DocumentStyle {
    const style: DocumentStyle = {};
    const declarations = styleStr.split(';').filter(d => d.trim());

    declarations.forEach(decl => {
      const [property, value] = decl.split(':').map(s => s.trim());
      if (property && value) {
        switch (property) {
          case 'color':
            style.color = value;
            break;
          case 'font-size':
            style.fontSize = parseInt(value.replace(/[^\d]/g, ''));
            break;
          case 'font-family':
            style.fontFamily = value.replace(/['"]/g, '');
            break;
          case 'font-weight':
            style.bold = value === 'bold' || parseInt(value) >= 600;
            break;
          case 'font-style':
            style.italic = value === 'italic';
            break;
        }
      }
    });

    return style;
  }

  /**
   * Get default style for HTML elements
   */
  private getDefaultStyleForElement(tagName: string, className?: string): DocumentStyle {
    const baseStyles: Record<string, DocumentStyle> = {
      'h1': { fontSize: 24, bold: true },
      'h2': { fontSize: 20, bold: true },
      'h3': { fontSize: 18, bold: true },
      'h4': { fontSize: 16, bold: true },
      'h5': { fontSize: 14, bold: true },
      'h6': { fontSize: 12, bold: true },
      'strong': { bold: true },
      'em': { italic: true },
      'u': { underline: true },
      'code': { fontFamily: 'monospace' },
      'blockquote': { italic: true, color: '#666666' }
    };

    const style = { ...(baseStyles[tagName] || {}) };

    // Add class-specific styles
    if (className) {
      if (className.includes('document-title')) {
        style.fontSize = 28;
        style.bold = true;
      } else if (className.includes('document-subtitle')) {
        style.fontSize = 18;
        style.italic = true;
      }
    }

    return style;
  }

  private convertHTMLToWordML(html: string): string {
    // Enhanced HTML to WordML conversion with better style support
    let wordML = html;

    // Convert paragraphs with style preservation
    wordML = wordML.replace(/<p[^>]*>(.*?)<\/p>/gi, '<w:p><w:r><w:t>$1</w:t></w:r></w:p>');

    // Convert headers with proper styles
    wordML = wordML.replace(/<h1[^>]*>(.*?)<\/h1>/gi, '<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>$1</w:t></w:r></w:p>');
    wordML = wordML.replace(/<h2[^>]*>(.*?)<\/h2>/gi, '<w:p><w:pPr><w:pStyle w:val="Heading2"/></w:pPr><w:r><w:t>$1</w:t></w:r></w:p>');
    wordML = wordML.replace(/<h3[^>]*>(.*?)<\/h3>/gi, '<w:p><w:pPr><w:pStyle w:val="Heading3"/></w:pPr><w:r><w:t>$1</w:t></w:r></w:p>');

    // Convert formatting elements
    wordML = wordML.replace(/<strong[^>]*>(.*?)<\/strong>/gi, '<w:r><w:rPr><w:b/></w:rPr><w:t>$1</w:t></w:r>');
    wordML = wordML.replace(/<em[^>]*>(.*?)<\/em>/gi, '<w:r><w:rPr><w:i/></w:rPr><w:t>$1</w:t></w:r>');
    wordML = wordML.replace(/<u[^>]*>(.*?)<\/u>/gi, '<w:r><w:rPr><w:u w:val="single"/></w:rPr><w:t>$1</w:t></w:r>');

    // Convert blockquotes
    wordML = wordML.replace(/<blockquote[^>]*>(.*?)<\/blockquote>/gi, '<w:p><w:pPr><w:pStyle w:val="Quote"/></w:pPr><w:r><w:t>$1</w:t></w:r></w:p>');

    // Handle images with proper WordML structure
    wordML = wordML.replace(/<img[^>]*data-image-id="([^"]*)"[^>]*>/gi,
      '<w:p><w:r><w:drawing><wp:inline><wp:extent cx="3048000" cy="2286000"/><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="1" name="Image $1"/></pic:nvPicPr></pic:pic></a:graphic></wp:inline></w:drawing></w:r></w:p>');

    // Remove remaining HTML tags
    wordML = wordML.replace(/<[^>]*>/g, '');

    return wordML;
  }

  private async packageAsDocx(wordXML: string, node: Node): Promise<Blob> {
    const zip = new JSZip();

    // Add [Content_Types].xml
    const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
</Types>`;

    // Add _rels/.rels
    const mainRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`;

    // Add word/_rels/document.xml.rels
    const wordRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

    // Add word/styles.xml
    const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault>
      <w:rPr>
        <w:rFonts w:ascii="Calibri" w:eastAsia="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/>
        <w:sz w:val="22"/>
        <w:szCs w:val="22"/>
        <w:lang w:val="en-US" w:eastAsia="en-US" w:bidi="ar-SA"/>
      </w:rPr>
    </w:rPrDefault>
    <w:pPrDefault>
      <w:pPr>
        <w:spacing w:after="160" w:line="259" w:lineRule="auto"/>
      </w:pPr>
    </w:pPrDefault>
  </w:docDefaults>
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal">
    <w:name w:val="Normal"/>
    <w:qFormat/>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading1">
    <w:name w:val="Heading 1"/>
    <w:basedOn w:val="Normal"/>
    <w:next w:val="Normal"/>
    <w:link w:val="Heading1Char"/>
    <w:uiPriority w:val="9"/>
    <w:qFormat/>
    <w:pPr>
      <w:keepNext/>
      <w:keepLines/>
      <w:spacing w:before="480" w:after="0"/>
      <w:outlineLvl w:val="0"/>
    </w:pPr>
    <w:rPr>
      <w:rFonts w:asciiTheme="majorHAnsi" w:eastAsiaTheme="majorEastAsia" w:hAnsiTheme="majorHAnsi" w:cstheme="majorBidi"/>
      <w:color w:val="2F5496" w:themeColor="accent1" w:themeShade="BF"/>
      <w:sz w:val="32"/>
      <w:szCs w:val="32"/>
    </w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading2">
    <w:name w:val="Heading 2"/>
    <w:basedOn w:val="Normal"/>
    <w:next w:val="Normal"/>
    <w:link w:val="Heading2Char"/>
    <w:uiPriority w:val="9"/>
    <w:qFormat/>
    <w:pPr>
      <w:keepNext/>
      <w:keepLines/>
      <w:spacing w:before="200" w:after="0"/>
      <w:outlineLvl w:val="1"/>
    </w:pPr>
    <w:rPr>
      <w:rFonts w:asciiTheme="majorHAnsi" w:eastAsiaTheme="majorEastAsia" w:hAnsiTheme="majorHAnsi" w:cstheme="majorBidi"/>
      <w:color w:val="2F5496" w:themeColor="accent1" w:themeShade="BF"/>
      <w:sz w:val="26"/>
      <w:szCs w:val="26"/>
    </w:rPr>
  </w:style>
</w:styles>`;

    // Add docProps/app.xml
    const appProps = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>Isometry Document Processor</Application>
  <ScaleCrop>false</ScaleCrop>
  <LinksUpToDate>false</LinksUpToDate>
  <SharedDoc>false</SharedDoc>
  <HyperlinksChanged>false</HyperlinksChanged>
  <AppVersion>1.0.0</AppVersion>
</Properties>`;

    // Add docProps/core.xml
    const coreProps = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>${this.escapeXml(node.name || 'Untitled Document')}</dc:title>
  <dc:creator>Isometry</dc:creator>
  <cp:lastModifiedBy>Isometry</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString()}</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">${new Date().toISOString()}</dcterms:modified>
</cp:coreProperties>`;

    // Create zip structure
    zip.file('[Content_Types].xml', contentTypes);
    zip.folder('_rels')?.file('.rels', mainRels);
    zip.folder('docProps')?.file('app.xml', appProps);
    zip.folder('docProps')?.file('core.xml', coreProps);

    const wordFolder = zip.folder('word');
    wordFolder?.file('document.xml', wordXML);
    wordFolder?.file('styles.xml', styles);
    wordFolder?.folder('_rels')?.file('document.xml.rels', wordRels);

    // Generate the DOCX file
    const docxArrayBuffer = await zip.generateAsync({
      type: 'arraybuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 }
    });

    return new Blob([docxArrayBuffer], {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    });
  }

  /**
   * Escape XML special characters
   */
  private escapeXml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
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