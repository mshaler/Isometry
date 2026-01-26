import html2pdf from 'html2pdf.js';
import type { NotebookCard } from '../types/notebook';
import { officeProcessor, downloadBlob } from './officeDocumentProcessor';

export interface PDFOptions {
  pageSize?: 'a4' | 'letter' | 'legal';
  orientation?: 'portrait' | 'landscape';
  margin?: number | { top: number; right: number; bottom: number; left: number };
  filename?: string;
  quality?: number; // 0.1 to 2.0
}

export interface HTMLOptions {
  includeCSS?: boolean;
  standalone?: boolean;
  filename?: string;
  theme?: 'NeXTSTEP' | 'Modern';
}

export interface JSONOptions {
  filename?: string;
  includeMetadata?: boolean;
  prettyPrint?: boolean;
}

export interface OfficeExportOptions {
  filename?: string;
  includeMetadata?: boolean;
  multipleSheets?: boolean; // For Excel: create separate sheets for each card
}

/**
 * Export notebook card as PDF using html2pdf.js
 */
export async function exportToPDF(card: NotebookCard, options: PDFOptions = {}): Promise<void> {
  const {
    pageSize = 'a4',
    orientation = 'portrait',
    margin = 0.5,
    filename = `${sanitizeFilename(card.properties?.title || 'notebook-card')}.pdf`,
    quality = 1.2,
  } = options;

  try {
    // Create HTML content for PDF generation
    const htmlContent = createHTMLContent(card, {
      includeCSS: true,
      standalone: true,
      theme: 'Modern' // Use clean theme for PDF
    });

    // Create temporary element for html2pdf
    const element = document.createElement('div');
    element.innerHTML = htmlContent;
    element.style.width = '100%';
    element.style.padding = '20px';
    element.style.fontSize = '14px';
    element.style.lineHeight = '1.6';
    element.style.color = '#333';
    element.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

    // Configure html2pdf options
    const opt = {
      margin: typeof margin === 'number' ? margin : [margin.top, margin.right, margin.bottom, margin.left],
      filename,
      image: { type: 'jpeg', quality: quality * 0.92 },
      html2canvas: {
        scale: quality,
        useCORS: true,
        allowTaint: true,
        letterRendering: true
      },
      jsPDF: {
        unit: 'in',
        format: pageSize,
        orientation,
        compressPDF: true
      }
    };

    // Generate and download PDF
    await html2pdf().set(opt).from(element).save();
  } catch (error) {
    console.error('PDF export failed:', error);
    throw new Error(`Failed to export PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Export notebook card as standalone HTML
 */
export function exportToHTML(card: NotebookCard, options: HTMLOptions = {}): void {
  const {
    includeCSS = true,
    standalone = true,
    filename = `${sanitizeFilename(card.properties?.title || 'notebook-card')}.html`,
    theme = 'Modern',
  } = options;

  try {
    const htmlContent = createHTMLContent(card, { includeCSS, standalone, theme });
    downloadFile(htmlContent, filename, 'text/html');
  } catch (error) {
    console.error('HTML export failed:', error);
    throw new Error(`Failed to export HTML: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Export notebook card(s) as JSON
 */
export function exportToJSON(
  cardOrCards: NotebookCard | NotebookCard[],
  options: JSONOptions = {}
): void {
  const {
    filename = Array.isArray(cardOrCards) ? 'notebook-cards.json' : `${sanitizeFilename(cardOrCards.properties?.title || 'notebook-card')}.json`,
    includeMetadata = true,
    prettyPrint = true,
  } = options;

  try {
    const cards = Array.isArray(cardOrCards) ? cardOrCards : [cardOrCards];

    const exportData = cards.map(card => {
      const baseData = {
        id: card.id,
        nodeId: card.nodeId,
        cardType: card.cardType,
        markdownContent: card.markdownContent,
        properties: card.properties,
        templateId: card.templateId,
      };

      if (includeMetadata) {
        return {
          ...baseData,
          createdAt: card.createdAt,
          modifiedAt: card.modifiedAt,
          layoutPosition: card.layoutPosition,
          renderedContent: card.renderedContent,
          exportedAt: new Date().toISOString(),
          exportVersion: '1.0',
        };
      }

      return baseData;
    });

    const finalData = Array.isArray(cardOrCards) ? exportData : exportData[0];
    const jsonString = prettyPrint
      ? JSON.stringify(finalData, null, 2)
      : JSON.stringify(finalData);

    downloadFile(jsonString, filename, 'application/json');
  } catch (error) {
    console.error('JSON export failed:', error);
    throw new Error(`Failed to export JSON: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Create HTML content from notebook card
 */
function createHTMLContent(card: NotebookCard, options: HTMLOptions): string {
  const { includeCSS = true, standalone = true, theme = 'Modern' } = options;

  // Get card properties
  const title = card.properties?.title || 'Untitled Card';
  const content = card.markdownContent || '';
  const createdAt = card.createdAt ? new Date(card.createdAt).toLocaleDateString() : '';
  const cardType = card.cardType;

  // Convert markdown to basic HTML (simple conversion)
  const htmlContent = markdownToHTML(content);

  // Build CSS based on theme
  const css = includeCSS ? getThemeCSS(theme) : '';

  if (standalone) {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  ${css ? `<style>${css}</style>` : ''}
</head>
<body>
  <div class="notebook-card">
    <header class="card-header">
      <h1 class="card-title">${escapeHtml(title)}</h1>
      <div class="card-meta">
        <span class="card-type">${escapeHtml(cardType)}</span>
        ${createdAt ? `<span class="card-date">${createdAt}</span>` : ''}
      </div>
    </header>
    <main class="card-content">
      ${htmlContent}
    </main>
    <footer class="card-footer">
      <p>Exported from Isometry Notebook • ${new Date().toLocaleString()}</p>
    </footer>
  </div>
</body>
</html>
    `.trim();
  } else {
    return `
<div class="notebook-card">
  <header class="card-header">
    <h1 class="card-title">${escapeHtml(title)}</h1>
    <div class="card-meta">
      <span class="card-type">${escapeHtml(cardType)}</span>
      ${createdAt ? `<span class="card-date">${createdAt}</span>` : ''}
    </div>
  </header>
  <main class="card-content">
    ${htmlContent}
  </main>
</div>
    `.trim();
  }
}

/**
 * Simple markdown to HTML conversion
 */
function markdownToHTML(markdown: string): string {
  let html = escapeHtml(markdown);

  // Headers
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

  // Bold and italic
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

  // Code blocks
  html = html.replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre><code class="language-$1">$2</code></pre>');
  html = html.replace(/`(.+?)`/g, '<code>$1</code>');

  // Lists
  html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');

  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

  // Paragraphs
  html = html.replace(/\n\n/g, '</p><p>');
  html = `<p>${html}</p>`;
  html = html.replace(/<p><\/p>/g, '');

  return html;
}

/**
 * Get CSS styles based on theme
 */
function getThemeCSS(theme: 'NeXTSTEP' | 'Modern'): string {
  const baseCSS = `
    .notebook-card {
      max-width: 800px;
      margin: 0 auto;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      line-height: 1.6;
    }

    .card-header {
      margin-bottom: 2rem;
      padding-bottom: 1rem;
      border-bottom: 1px solid #e5e7eb;
    }

    .card-title {
      margin: 0 0 0.5rem 0;
      font-size: 2rem;
      font-weight: 700;
    }

    .card-meta {
      display: flex;
      gap: 1rem;
      font-size: 0.875rem;
      color: #6b7280;
    }

    .card-content {
      margin-bottom: 2rem;
    }

    .card-content h1, .card-content h2, .card-content h3 {
      margin: 1.5rem 0 1rem 0;
      font-weight: 600;
    }

    .card-content p {
      margin: 1rem 0;
    }

    .card-content ul {
      margin: 1rem 0;
      padding-left: 1.5rem;
    }

    .card-content li {
      margin: 0.5rem 0;
    }

    .card-content pre {
      background: #f3f4f6;
      padding: 1rem;
      border-radius: 0.5rem;
      overflow-x: auto;
      font-family: "SF Mono", Monaco, Menlo, monospace;
      font-size: 0.875rem;
    }

    .card-content code {
      background: #f3f4f6;
      padding: 0.125rem 0.25rem;
      border-radius: 0.25rem;
      font-family: "SF Mono", Monaco, Menlo, monospace;
      font-size: 0.875rem;
    }

    .card-footer {
      border-top: 1px solid #e5e7eb;
      padding-top: 1rem;
      text-align: center;
      color: #6b7280;
      font-size: 0.875rem;
    }
  `;

  if (theme === 'NeXTSTEP') {
    return baseCSS + `
      body {
        background: #c0c0c0;
        color: #000;
      }

      .notebook-card {
        background: white;
        border: 2px solid #707070;
        padding: 1.5rem;
      }

      .card-header {
        border-bottom-color: #707070;
      }

      .card-footer {
        border-top-color: #707070;
      }

      .card-content pre {
        background: #f0f0f0;
        border: 1px solid #707070;
      }

      .card-content code {
        background: #f0f0f0;
        border: 1px solid #707070;
      }
    `;
  }

  return baseCSS + `
    body {
      background: #f9fafb;
      color: #111827;
    }

    .notebook-card {
      background: white;
      border-radius: 0.5rem;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
      padding: 2rem;
    }
  `;
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Sanitize filename for download
 */
function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-zA-Z0-9\-_\s]/g, '')
    .replace(/\s+/g, '-')
    .toLowerCase()
    .substring(0, 100);
}

/**
 * Download file with given content
 */
function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

/**
 * Export notebook card(s) as Excel XLSX
 */
export async function exportToExcel(
  cardOrCards: NotebookCard | NotebookCard[],
  options: OfficeExportOptions = {}
): Promise<void> {
  const {
    filename = Array.isArray(cardOrCards) ? 'notebook-cards.xlsx' : `${sanitizeFilename(cardOrCards.properties?.title || 'notebook-card')}.xlsx`,
    includeMetadata = true,
    multipleSheets = true,
  } = options;

  try {
    const cards = Array.isArray(cardOrCards) ? cardOrCards : [cardOrCards];

    // Convert NotebookCards to Nodes for office processor
    const nodes = cards.map(card => ({
      id: card.id,
      nodeType: card.cardType,
      name: card.properties?.title || 'Untitled',
      content: card.markdownContent || '',
      summary: card.properties?.title || '',
      createdAt: card.createdAt,
      modifiedAt: card.modifiedAt,
      folder: null,
      tags: [],
      source: 'notebook-export',
      sourceId: card.id,
      sourceUrl: null
    }));

    const blob = await officeProcessor.exportToExcel(nodes, filename);
    downloadBlob(blob, filename);
  } catch (error) {
    console.error('Excel export failed:', error);
    throw new Error(`Failed to export Excel: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Export notebook card as Word DOCX
 */
export async function exportToWord(
  card: NotebookCard,
  options: OfficeExportOptions = {}
): Promise<void> {
  const {
    filename = `${sanitizeFilename(card.properties?.title || 'notebook-card')}.docx`,
  } = options;

  try {
    // Convert NotebookCard to Node for office processor
    const node = {
      id: card.id,
      nodeType: card.cardType,
      name: card.properties?.title || 'Untitled',
      content: card.markdownContent || '',
      summary: card.properties?.title || '',
      createdAt: card.createdAt,
      modifiedAt: card.modifiedAt,
      folder: null,
      tags: [],
      source: 'notebook-export',
      sourceId: card.id,
      sourceUrl: null
    };

    const blob = await officeProcessor.exportToWord(node);
    downloadBlob(blob, filename);
  } catch (error) {
    console.error('Word export failed:', error);
    throw new Error(`Failed to export Word: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}