import { useState, useCallback } from 'react';
import type { SelectedFile, FieldMapping } from '../components/import/ImportWizard';
import type { ImportProgress, ImportResult } from '../components/import/ImportProgress';
import { webViewBridge } from '../utils/webview-bridge';

interface UseMarkdownImportReturn {
  importMarkdownFiles: (files: SelectedFile[], mappings: FieldMapping) => Promise<void>;
  progress: ImportProgress | null;
  error: Error | null;
  results: ImportResult[];
  reset: () => void;
}

export function useMarkdownImport(): UseMarkdownImportReturn {
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [results, setResults] = useState<ImportResult[]>([]);

  const reset = useCallback(() => {
    setProgress(null);
    setError(null);
    setResults([]);
  }, []);

  const importMarkdownFiles = useCallback(async (
    files: SelectedFile[],
    mappings: FieldMapping
  ) => {
    try {
      setError(null);
      setResults([]);

      // Initialize progress
      setProgress({
        total: files.length,
        completed: 0,
        failed: 0,
        currentFile: null,
        percentage: 0,
      });

      const importResults: ImportResult[] = [];

      // Process files sequentially to maintain order and provide clear progress feedback
      for (let i = 0; i < files.length; i++) {
        const file = files[i];

        // Update progress with current file
        setProgress(prev => prev ? {
          ...prev,
          currentFile: file.name,
          percentage: (i / files.length) * 100,
        } : null);

        try {
          // Simulate processing delay for demo purposes
          await new Promise(resolve => setTimeout(resolve, 500));

          // Process the markdown file
          const result = await processMarkdownFile(file, mappings);
          importResults.push(result);

          // Update progress with completion
          setProgress(prev => prev ? {
            ...prev,
            completed: prev.completed + 1,
            percentage: ((i + 1) / files.length) * 100,
          } : null);

          // Update results incrementally for live feedback
          setResults([...importResults]);

        } catch (err) {
          console.error(`Failed to process file ${file.name}:`, err);

          const failureResult: ImportResult = {
            success: false,
            fileName: file.name,
            error: err instanceof Error ? err.message : 'Unknown processing error',
          };

          importResults.push(failureResult);

          // Update progress with failure
          setProgress(prev => prev ? {
            ...prev,
            failed: prev.failed + 1,
            percentage: ((i + 1) / files.length) * 100,
          } : null);

          // Update results with failure
          setResults([...importResults]);
        }
      }

      // Final progress update
      setProgress(prev => prev ? {
        ...prev,
        currentFile: null,
        percentage: 100,
      } : null);

    } catch (err) {
      console.error('Import process failed:', err);
      setError(err instanceof Error ? err : new Error('Import process failed'));
    }
  }, []);

  return {
    importMarkdownFiles,
    progress,
    error,
    results,
    reset,
  };
}

// Helper function to process individual markdown files
async function processMarkdownFile(
  file: SelectedFile,
  mappings: FieldMapping
): Promise<ImportResult> {
  try {
    // Extract frontmatter and content
    const { frontmatter, content } = parseMarkdownFile(file.content);

    // Apply field mappings to create node properties
    const nodeProperties = applyFieldMappings(frontmatter, mappings);

    // Extract relationships from content
    const relationships = extractRelationships(content);

    // Process tables if present
    const tables = extractTables(content);

    // Process attachments
    const attachments = extractAttachments(content);

    // Create import payload for bridge communication
    const importPayload = {
      fileName: file.name,
      content: content,
      frontmatter: frontmatter,
      properties: nodeProperties,
      relationships: relationships,
      tables: tables,
      attachments: attachments,
    };

    // Send to native bridge for processing
    const result = await sendToNativeBridge('importMarkdown', importPayload);

    return {
      success: true,
      fileName: file.name,
      nodeId: result.nodeId,
      relationshipCount: relationships.length,
      tableCount: tables.length,
      attachmentCount: attachments.length,
    };

  } catch (error) {
    throw new Error(`Failed to process ${file.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Parse markdown file into frontmatter and content
function parseMarkdownFile(content: string): { frontmatter: Record<string, any>, content: string } {
  const lines = content.split('\n');
  let frontmatter: Record<string, any> = {};
  let contentStartIndex = 0;

  // Check for YAML frontmatter
  if (lines[0] === '---') {
    const endIndex = lines.findIndex((line, index) => index > 0 && line === '---');
    if (endIndex > 0) {
      const yamlContent = lines.slice(1, endIndex).join('\n');
      frontmatter = parseYaml(yamlContent);
      contentStartIndex = endIndex + 1;
    }
  }
  // Check for TOML frontmatter
  else if (lines[0] === '+++') {
    const endIndex = lines.findIndex((line, index) => index > 0 && line === '+++');
    if (endIndex > 0) {
      const tomlContent = lines.slice(1, endIndex).join('\n');
      frontmatter = parseToml(tomlContent);
      contentStartIndex = endIndex + 1;
    }
  }
  // Check for JSON frontmatter
  else if (lines[0] === '{') {
    let braceCount = 0;
    let endIndex = -1;

    for (let i = 0; i < lines.length; i++) {
      for (const char of lines[i]) {
        if (char === '{') braceCount++;
        if (char === '}') braceCount--;
      }
      if (braceCount === 0 && i > 0) {
        endIndex = i;
        break;
      }
    }

    if (endIndex > 0) {
      const jsonContent = lines.slice(0, endIndex + 1).join('\n');
      try {
        frontmatter = JSON.parse(jsonContent);
        contentStartIndex = endIndex + 1;
      } catch {
        // Invalid JSON, treat as regular content
      }
    }
  }

  const markdownContent = lines.slice(contentStartIndex).join('\n').trim();

  return {
    frontmatter,
    content: markdownContent,
  };
}

// Apply field mappings to frontmatter
function applyFieldMappings(frontmatter: Record<string, any>, mappings: FieldMapping): Record<string, any> {
  const properties: Record<string, any> = {};

  Object.entries(frontmatter).forEach(([fieldName, value]) => {
    const mapping = mappings[fieldName];
    if (!mapping || mapping.targetProperty === 'ignore') {
      return;
    }

    if (mapping.targetProperty === 'custom' && mapping.customProperty) {
      properties[mapping.customProperty] = value;
    } else {
      // Map to LATCH category
      if (!properties[mapping.targetProperty]) {
        properties[mapping.targetProperty] = [];
      }

      if (Array.isArray(value)) {
        properties[mapping.targetProperty].push(...value);
      } else {
        properties[mapping.targetProperty].push(value);
      }
    }
  });

  return properties;
}

// Extract relationships from markdown content
function extractRelationships(content: string): Array<{
  type: string;
  target: string;
  displayText?: string;
}> {
  const relationships: Array<{
    type: string;
    target: string;
    displayText?: string;
  }> = [];

  // Wiki links: [[target]] or [[display|target]]
  const wikiLinkMatches = content.match(/\[\[([^\]|]+)(\|([^\]]+))?\]\]/g);
  if (wikiLinkMatches) {
    wikiLinkMatches.forEach(match => {
      const components = match.replace(/\[\[|\]\]/g, '').split('|');
      relationships.push({
        type: 'wiki-link',
        target: components[0].trim(),
        displayText: components[1]?.trim(),
      });
    });
  }

  // Hashtags: #tag
  const hashtagMatches = content.match(/#[a-zA-Z][a-zA-Z0-9-_]*/g);
  if (hashtagMatches) {
    hashtagMatches.forEach(match => {
      relationships.push({
        type: 'tag',
        target: match.substring(1),
      });
    });
  }

  // Markdown links: [text](url)
  const linkMatches = content.match(/\[([^\]]+)\]\(([^)]+)\)/g);
  if (linkMatches) {
    linkMatches.forEach(match => {
      const linkMatch = match.match(/\[([^\]]+)\]\(([^)]+)\)/);
      if (linkMatch) {
        relationships.push({
          type: 'markdown-link',
          target: linkMatch[2],
          displayText: linkMatch[1],
        });
      }
    });
  }

  // Image references: ![alt](path)
  const imageMatches = content.match(/!\[([^\]]*)\]\(([^)]+)\)/g);
  if (imageMatches) {
    imageMatches.forEach(match => {
      const imageMatch = match.match(/!\[([^\]]*)\]\(([^)]+)\)/);
      if (imageMatch) {
        relationships.push({
          type: 'image-reference',
          target: imageMatch[2],
          displayText: imageMatch[1] || 'Image',
        });
      }
    });
  }

  return relationships;
}

// Extract tables from markdown content
function extractTables(content: string): Array<{
  headers: string[];
  rows: string[][];
}> {
  const tables: Array<{
    headers: string[];
    rows: string[][];
  }> = [];

  const lines = content.split('\n');
  let currentTable: { headers: string[]; rows: string[][] } | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Check if line looks like a table row
    if (line.includes('|')) {
      const cells = line.split('|').map(cell => cell.trim()).filter(cell => cell !== '');

      if (cells.length > 1) {
        if (!currentTable) {
          // Start new table
          currentTable = {
            headers: cells,
            rows: [],
          };
        } else {
          // Check if this is a separator line (contains only -, :, |, spaces)
          const isSeparator = /^[\s\-:|]+$/.test(line);

          if (!isSeparator) {
            currentTable.rows.push(cells);
          }
        }
      }
    } else {
      // End current table if we hit a non-table line
      if (currentTable && currentTable.rows.length > 0) {
        tables.push(currentTable);
        currentTable = null;
      }
    }
  }

  // Don't forget the last table
  if (currentTable && currentTable.rows.length > 0) {
    tables.push(currentTable);
  }

  return tables;
}

// Extract attachment references
function extractAttachments(content: string): Array<{
  path: string;
  type: string;
  displayText?: string;
}> {
  const attachments: Array<{
    path: string;
    type: string;
    displayText?: string;
  }> = [];

  // File attachments: [text](file.ext)
  const attachmentMatches = content.match(/\[([^\]]+)\]\(([^)]+\.[a-zA-Z0-9]+)\)/g);
  if (attachmentMatches) {
    attachmentMatches.forEach(match => {
      const attachmentMatch = match.match(/\[([^\]]+)\]\(([^)]+\.[a-zA-Z0-9]+)\)/);
      if (attachmentMatch) {
        const filePath = attachmentMatch[2];
        const fileExtension = filePath.split('.').pop()?.toLowerCase() || '';
        const imageExtensions = ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'svg', 'webp'];

        if (!imageExtensions.includes(fileExtension)) {
          attachments.push({
            path: filePath,
            type: fileExtension,
            displayText: attachmentMatch[1],
          });
        }
      }
    });
  }

  return attachments;
}

// Simplified parsers (in real implementation, use proper libraries)
function parseYaml(yamlContent: string): Record<string, any> {
  try {
    const result: Record<string, any> = {};
    const lines = yamlContent.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const colonIndex = trimmed.indexOf(':');
        if (colonIndex > 0) {
          const key = trimmed.substring(0, colonIndex).trim();
          let value: any = trimmed.substring(colonIndex + 1).trim();

          // Handle arrays (simplified)
          if (value.startsWith('[') && value.endsWith(']')) {
            value = value.slice(1, -1).split(',').map((v: string) => v.trim().replace(/^["']|["']$/g, ''));
          } else {
            // Basic type conversion
            if (value === 'true') value = true;
            else if (value === 'false') value = false;
            else if (/^\d+$/.test(value)) value = parseInt(value);
            else if (/^\d+\.\d+$/.test(value)) value = parseFloat(value);
            else value = value.replace(/^["']|["']$/g, '');
          }

          result[key] = value;
        }
      }
    }

    return result;
  } catch {
    return {};
  }
}

function parseToml(tomlContent: string): Record<string, any> {
  try {
    const result: Record<string, any> = {};
    const lines = tomlContent.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const equalIndex = trimmed.indexOf('=');
        if (equalIndex > 0) {
          const key = trimmed.substring(0, equalIndex).trim();
          let value: any = trimmed.substring(equalIndex + 1).trim();

          // Handle arrays (simplified)
          if (value.startsWith('[') && value.endsWith(']')) {
            value = value.slice(1, -1).split(',').map((v: string) => v.trim().replace(/^["']|["']$/g, ''));
          } else {
            // Basic type conversion
            if (value === 'true') value = true;
            else if (value === 'false') value = false;
            else if (/^\d+$/.test(value)) value = parseInt(value);
            else if (/^\d+\.\d+$/.test(value)) value = parseFloat(value);
            else value = value.replace(/^["']|["']$/g, '');
          }

          result[key] = value;
        }
      }
    }

    return result;
  } catch {
    return {};
  }
}

// Bridge communication using the webview bridge
async function sendToNativeBridge(method: string, payload: any): Promise<any> {
  try {
    // Use the actual webview bridge to communicate with native Swift
    if (method === 'importMarkdown') {
      return await webViewBridge.database.importMarkdown(payload);
    } else {
      throw new Error(`Unknown bridge method: ${method}`);
    }
  } catch (error) {
    console.error('Bridge communication failed:', error);

    // Fallback: simulate successful import for development/browser mode
    if (!webViewBridge.isWebViewEnvironment()) {
      console.log('Browser mode - simulating import:', payload);
      await new Promise(resolve => setTimeout(resolve, 100));

      return {
        success: true,
        nodeId: `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        relationshipCount: payload.relationships?.length || 0,
        tableCount: payload.tables?.length || 0,
        attachmentCount: payload.attachments?.length || 0,
      };
    }

    throw error;
  }
}