/**
 * Word Document Processor - DOCX import/export functionality
 */

import * as mammoth from 'mammoth';
import JSZip from 'jszip';
import type { Node } from '../../../types/node';
import type {
  OfficeImportOptions,
  OfficeImportResult,
  WordDocumentData,
  DocumentStyle,
  MammothImage,
  DocumentTransform
} from './types';

export class WordProcessor {

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

  /**
   * Process Word document from ArrayBuffer
   */
  private async processWordDocument(
    arrayBuffer: ArrayBuffer,
    preserveFormatting: boolean
  ): Promise<WordDocumentData> {
    const extractedImages: { id: string; buffer: ArrayBuffer; contentType: string }[] = [];
    const extractedStyles: Record<string, {
      color?: string;
      fontSize?: number;
      fontFamily?: string;
      bold?: boolean;
      italic?: boolean;
    }> = {};

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

  /**
   * Create Node from Word document data
   */
  private async createNodeFromWordData(
    docData: WordDocumentData,
    fileName: string,
    options: {
      nodeType?: string;
      folder?: string;
      source?: string;
      preserveFormatting?: boolean;
    }
  ): Promise<Node> {
    const {
      nodeType = 'document',
      folder,
      source = 'word-import',
      preserveFormatting: _preserveFormatting = true
    } = options;

    // Generate summary
    const summary = this.generateDocumentSummary(docData.content);

    return {
      id: `word_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      nodeType: nodeType as Node['nodeType'],
      name: fileName.replace(/\.(docx|doc)$/i, ''),
      content: docData.content,
      summary,
      latitude: null,
      longitude: null,
      locationName: null,
      locationAddress: null,
      createdAt: new Date().toISOString(),
      modifiedAt: new Date().toISOString(),
      dueAt: null,
      completedAt: null,
      eventStart: null,
      eventEnd: null,
      folder: folder || 'imported',
      tags: ['word', 'document', 'imported', nodeType],
      status: 'active' as Node['status'],
      priority: 1,
      importance: 0,
      sortOrder: 0,
      source,
      sourceId: fileName,
      sourceUrl: null,
      deletedAt: null,
      version: 1
    };
  }

  /**
   * Convert HTML to Markdown
   */
  private convertHtmlToMarkdown(html: string): string {
    const markdown = html
      // Headers
      .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '\n# $1\n\n')
      .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '\n## $1\n\n')
      .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '\n### $1\n\n')
      .replace(/<h4[^>]*>(.*?)<\/h4>/gi, '\n#### $1\n\n')
      .replace(/<h5[^>]*>(.*?)<\/h5>/gi, '\n##### $1\n\n')
      .replace(/<h6[^>]*>(.*?)<\/h6>/gi, '\n###### $1\n\n')

      // Bold and italic
      .replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**')
      .replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**')
      .replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*')
      .replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*')
      .replace(/<u[^>]*>(.*?)<\/u>/gi, '<u>$1</u>')

      // Lists
      .replace(/<ul[^>]*>/gi, '\n')
      .replace(/<\/ul>/gi, '\n')
      .replace(/<ol[^>]*>/gi, '\n')
      .replace(/<\/ol>/gi, '\n')
      .replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n')

      // Links
      .replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)')

      // Images
      .replace(/<img[^>]*src="([^"]*)"[^>]*alt="([^"]*)"[^>]*>/gi, '![$2]($1)')
      .replace(/<img[^>]*src="([^"]*)"[^>]*>/gi, '![]($1)')

      // Paragraphs and line breaks
      .replace(/<p[^>]*>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<br[^>]*>/gi, '\n')

      // Code
      .replace(/<code[^>]*>(.*?)<\/code>/gi, '`$1`')
      .replace(/<pre[^>]*>(.*?)<\/pre>/gi, '```\n$1\n```')

      // Blockquotes
      .replace(/<blockquote[^>]*>(.*?)<\/blockquote>/gi, '> $1\n')

      // Remove any remaining HTML tags
      .replace(/<[^>]*>/g, '')

      // Clean up multiple newlines
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    return markdown;
  }

  /**
   * Convert Markdown to Word-compatible HTML
   */
  private convertMarkdownToWordHTML(markdown: string): string {
    const html = markdown
      // Headers
      .replace(/^# (.+)$/gm, '<h1>$1</h1>')
      .replace(/^## (.+)$/gm, '<h2>$1</h2>')
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      .replace(/^#### (.+)$/gm, '<h4>$1</h4>')
      .replace(/^##### (.+)$/gm, '<h5>$1</h5>')
      .replace(/^###### (.+)$/gm, '<h6>$1</h6>')

      // Bold and italic
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')

      // Lists (simple implementation)
      .replace(/^- (.+)$/gm, '<li>$1</li>')
      .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')

      // Line breaks
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br/>')

      // Wrap in paragraphs
      .replace(/^(?!<[hou])/gm, '<p>')
      .replace(/(?<!>)$/gm, '</p>');

    return html;
  }

  /**
   * Generate document summary
   */
  private generateDocumentSummary(content: string): string {
    const wordCount = this.countWords(content);
    const paragraphs = content.split('\n\n').filter(p => p.trim()).length;

    return `Word document with ${wordCount} words and ${paragraphs} paragraphs.`;
  }

  /**
   * Count words in text
   */
  private countWords(text: string): number {
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
  }

  /**
   * Create Word document XML
   */
  private createWordDocumentXML(node: Node, htmlContent: string): string {
    const wordML = this.convertHTMLToWordML(htmlContent);

    return `<?xml version="1.0" encoding="UTF-8"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p>
      <w:r>
        <w:t>${this.escapeXml(node.name || 'Untitled Document')}</w:t>
      </w:r>
    </w:p>
    ${wordML}
    <w:sectPr>
      <w:pgSz w:w="12240" w:h="15840"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/>
    </w:sectPr>
  </w:body>
</w:document>`;
  }

  /**
   * Convert HTML to WordML
   */
  private convertHTMLToWordML(html: string): string {
    // Basic HTML to WordML conversion
    return html
      .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>$1</w:t></w:r></w:p>')
      .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '<w:p><w:pPr><w:pStyle w:val="Heading2"/></w:pPr><w:r><w:t>$1</w:t></w:r></w:p>')
      .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '<w:p><w:pPr><w:pStyle w:val="Heading3"/></w:pPr><w:r><w:t>$1</w:t></w:r></w:p>')
      .replace(/<p[^>]*>(.*?)<\/p>/gi, '<w:p><w:r><w:t>$1</w:t></w:r></w:p>')
      .replace(/<strong[^>]*>(.*?)<\/strong>/gi, '<w:r><w:rPr><w:b/></w:rPr><w:t>$1</w:t></w:r>')
      .replace(/<em[^>]*>(.*?)<\/em>/gi, '<w:r><w:rPr><w:i/></w:rPr><w:t>$1</w:t></w:r>')
      .replace(/<br[^>]*>/gi, '<w:br/>')
      .replace(/<[^>]*>/g, ''); // Remove any remaining HTML tags
  }

  /**
   * Package as DOCX ZIP file
   */
  private async packageAsDocx(wordXML: string, _node: Node): Promise<Blob> {
    const zip = new JSZip();

    // [Content_Types].xml
    zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`);

    // _rels/.rels
    zip.folder('_rels')?.file('.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`);

    // word/_rels/document.xml.rels
    zip.folder('word')?.folder('_rels')?.file('document.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
</Relationships>`);

    // word/document.xml
    zip.folder('word')?.file('document.xml', wordXML);

    return zip.generateAsync({ type: 'blob' });
  }

  /**
   * Extract styles from HTML
   */
  private extractStylesFromHtml(html: string, styles: Record<string, DocumentStyle>): void {
    // Create a temporary DOM element to parse HTML
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;

    // Parse HTML to extract inline styles and class-based styles
    const elements = tempDiv.querySelectorAll('*');

    elements.forEach(element => {
      const tagName = element.tagName.toLowerCase();
      const className = element.className;

      if (className) {
        styles[className] = this.getDefaultStyleForElement(tagName, className);
      }

      // Extract inline styles
      const style = element.getAttribute('style');
      if (style) {
        styles[`${tagName}_inline`] = this.parseInlineStyle(style);
      }
    });
  }

  /**
   * Parse inline style string
   */
  private parseInlineStyle(styleStr: string): DocumentStyle {
    const style: DocumentStyle = {};
    const declarations = styleStr.split(';');

    declarations.forEach(declaration => {
      const [property, value] = declaration.split(':').map(s => s.trim());

      if (property && value) {
        switch (property) {
          case 'font-size':
            style.fontSize = parseFloat(value);
            break;
          case 'font-family':
            style.fontFamily = value.replace(/['"]/g, '');
            break;
          case 'color':
            style.color = value;
            break;
          case 'font-weight':
            style.bold = value === 'bold' || parseInt(value) >= 600;
            break;
          case 'font-style':
            style.italic = value === 'italic';
            break;
          case 'text-decoration':
            style.underline = value.includes('underline');
            break;
        }
      }
    });

    return style;
  }

  /**
   * Get default style for element
   */
  private getDefaultStyleForElement(tagName: string, className?: string): DocumentStyle {
    const style: DocumentStyle = {};

    // Default styles by tag
    switch (tagName) {
      case 'h1':
        style.fontSize = 24;
        style.bold = true;
        break;
      case 'h2':
        style.fontSize = 20;
        style.bold = true;
        break;
      case 'h3':
        style.fontSize = 18;
        style.bold = true;
        break;
      case 'strong':
      case 'b':
        style.bold = true;
        break;
      case 'em':
      case 'i':
        style.italic = true;
        break;
      case 'u':
        style.underline = true;
        break;
    }

    // Add class-specific styles
    if (className) {
      if (className.includes('document-title')) {
        style.fontSize = 28;
        style.bold = true;
      } else if (className.includes('document-subtitle')) {
        style.fontSize = 16;
        style.italic = true;
      }
    }

    return style;
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