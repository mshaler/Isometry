import * as fs from 'fs';
import * as path from 'path';

/**
 * Markdown Importer for IsometryKB
 *
 * Parses markdown files and extracts metadata for SuperGrid Cards
 * Follows LATCH taxonomy for organizing data
 */

export interface MarkdownCard {
  id: string;
  name: string;
  content: string;
  summary: string;

  // LATCH: Location (file path)
  folder: string;
  file_path: string;

  // LATCH: Time
  created_at: string;
  modified_at: string;

  // LATCH: Category
  status: string;
  tags: string[];
  document_type: string; // journal, plan, spec, etc.

  // LATCH: Hierarchy
  priority: number;
  importance: number;

  // Metadata
  source: string;
  source_id: string;
  word_count: number;
}

/**
 * Extract title from markdown content (first # heading or filename)
 */
function extractTitle(content: string, filename: string): string {
  const titleMatch = content.match(/^#\s+(.+)$/m);
  if (titleMatch) {
    return titleMatch[1].trim();
  }

  // Fallback to filename without extension
  return path.basename(filename, '.md')
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase());
}

/**
 * Extract summary from markdown (first paragraph or first 200 chars)
 */
function extractSummary(content: string): string {
  // Remove title lines and get first meaningful paragraph
  const lines = content.split('\n');
  let summaryLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip empty lines, headers, and frontmatter
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('---')) {
      continue;
    }

    summaryLines.push(trimmed);

    // Stop at first substantial paragraph
    if (summaryLines.join(' ').length > 100) {
      break;
    }
  }

  const summary = summaryLines.join(' ').substring(0, 200);
  return summary + (summary.length === 200 ? '...' : '');
}

/**
 * Determine document type from folder path
 */
function getDocumentType(filePath: string): string {
  if (filePath.includes('/journal/')) return 'journal';
  if (filePath.includes('/plans/')) return 'plan';
  if (filePath.includes('/specs/')) return 'spec';
  if (filePath.includes('/screenshots/')) return 'screenshot';
  return 'document';
}

/**
 * Determine status from content and type
 */
function extractStatus(content: string, docType: string): string {
  const lower = content.toLowerCase();

  if (lower.includes('✅') || lower.includes('completed')) return 'completed';
  if (lower.includes('🚧') || lower.includes('in progress')) return 'in_progress';
  if (lower.includes('❌') || lower.includes('blocked')) return 'blocked';
  if (lower.includes('📋') || lower.includes('todo')) return 'todo';

  // Default status by document type
  switch (docType) {
    case 'journal': return 'archived';
    case 'plan': return 'in_progress';
    case 'spec': return 'active';
    default: return 'active';
  }
}

/**
 * Calculate importance based on content indicators
 */
function calculateImportance(content: string, docType: string): number {
  let score = 1; // Default

  const lower = content.toLowerCase();

  // High importance indicators
  if (lower.includes('critical') || lower.includes('urgent')) score += 3;
  if (lower.includes('mvp') || lower.includes('foundation')) score += 2;
  if (lower.includes('architecture') || lower.includes('core')) score += 2;

  // Document type weights
  switch (docType) {
    case 'spec':
      score += 1;
      break;
    case 'plan':
      score += 1;
      break;
    case 'journal':
      score -= 1;
      break;
  }

  return Math.min(Math.max(score, 0), 5); // Clamp 0-5
}

/**
 * Parse a single markdown file into a MarkdownCard
 */
export function parseMarkdownFile(filePath: string): MarkdownCard | null {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const stats = fs.statSync(filePath);
    const relativePath = filePath.replace('/Users/mshaler/Developer/Projects/IsometryKB/', '');

    const name = extractTitle(content, filePath);
    const summary = extractSummary(content);
    const docType = getDocumentType(filePath);
    const status = extractStatus(content, docType);
    const importance = calculateImportance(content, docType);

    const card: MarkdownCard = {
      id: path.basename(filePath, '.md').toLowerCase().replace(/[^a-z0-9]/g, '_'),
      name,
      content,
      summary,

      // LATCH: Location
      folder: path.dirname(relativePath),
      file_path: relativePath,

      // LATCH: Time
      created_at: stats.birthtime.toISOString(),
      modified_at: stats.mtime.toISOString(),

      // LATCH: Category
      status,
      tags: [], // Could parse wiki-links later
      document_type: docType,

      // LATCH: Hierarchy
      priority: importance, // Map importance to priority for now
      importance,

      // Metadata
      source: 'IsometryKB',
      source_id: filePath,
      word_count: content.split(/\s+/).length
    };

    return card;

  } catch (error) {
    console.warn(`Failed to parse ${filePath}:`, error);
    return null;
  }
}

/**
 * Discover and parse all markdown files in IsometryKB
 */
export function discoverMarkdownFiles(kbPath: string = '/Users/mshaler/Developer/Projects/IsometryKB'): MarkdownCard[] {
  const cards: MarkdownCard[] = [];

  function walkDirectory(dir: string) {
    try {
      const entries = fs.readdirSync(dir);

      for (const entry of entries) {
        const fullPath = path.join(dir, entry);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
          // Skip node_modules and hidden directories
          if (!entry.startsWith('.') && entry !== 'node_modules') {
            walkDirectory(fullPath);
          }
        } else if (entry.endsWith('.md')) {
          const card = parseMarkdownFile(fullPath);
          if (card) {
            cards.push(card);
          }
        }
      }
    } catch (error) {
      console.warn(`Error reading directory ${dir}:`, error);
    }
  }

  walkDirectory(kbPath);

  return cards.sort((a, b) => {
    // Sort by importance desc, then modified time desc
    if (a.importance !== b.importance) {
      return b.importance - a.importance;
    }
    return new Date(b.modified_at).getTime() - new Date(a.modified_at).getTime();
  });
}

/**
 * Convert MarkdownCard to SQL INSERT statement
 */
export function cardToSQL(card: MarkdownCard): { sql: string; params: any[] } {
  const sql = `
    INSERT OR REPLACE INTO nodes (
      id, name, content, summary,
      folder, status, priority, importance,
      created_at, modified_at,
      source, source_id, node_type
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const params = [
    card.id,
    card.name,
    card.content,
    card.summary,
    card.folder,
    card.status,
    card.priority,
    card.importance,
    card.created_at,
    card.modified_at,
    card.source,
    card.source_id,
    card.document_type
  ];

  return { sql, params };
}