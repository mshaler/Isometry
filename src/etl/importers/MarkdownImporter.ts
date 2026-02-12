/**
 * Markdown Importer for Isometry ETL
 *
 * Parses .md files with optional YAML frontmatter.
 * Uses gray-matter for frontmatter and marked for HTML conversion.
 *
 * LATCH mapping:
 * - L: locationName, locationAddress from frontmatter
 * - A: name from title/first H1
 * - T: createdAt, modifiedAt, dueAt from flexible key detection
 * - C: folder, tags, status from frontmatter
 * - H: priority, importance from frontmatter
 *
 * @module etl/importers/MarkdownImporter
 */

import matter from 'gray-matter';
import { marked } from 'marked';
import { v4 as uuidv4 } from 'uuid';
import { BaseImporter, FileSource } from './BaseImporter';
import { CanonicalNode } from '../types/canonical';
import { generateDeterministicSourceId } from '../id-generation/deterministic';

interface ParsedMarkdown {
  frontmatter: Record<string, unknown>;
  html: string;
  raw: string;
  filename: string;
}

export class MarkdownImporter extends BaseImporter {
  protected async parse(source: FileSource): Promise<unknown> {
    const parsed = matter(source.content);
    const html = await marked.parse(parsed.content);

    return {
      frontmatter: parsed.data,
      html,
      raw: parsed.content,
      filename: source.filename,
    };
  }

  protected async transform(data: unknown): Promise<CanonicalNode[]> {
    const { frontmatter, html, raw, filename } = data as ParsedMarkdown;
    const now = new Date().toISOString();

    const sourceId = generateDeterministicSourceId(
      filename,
      frontmatter,
      'markdown-importer'
    );

    const node: CanonicalNode = {
      id: uuidv4(),
      sourceId,
      source: 'markdown-importer',
      nodeType: detectNodeType(frontmatter),
      name: detectName(frontmatter, raw),
      content: html,
      summary: detectSummary(frontmatter, raw),

      // LATCH: Location
      latitude: null,
      longitude: null,
      locationName:
        ((frontmatter.location_name ||
          frontmatter.locationName) as string | null) ?? null,
      locationAddress:
        ((frontmatter.location ||
          frontmatter.address ||
          frontmatter.locationAddress) as string | null) ?? null,

      // LATCH: Time (flexible key detection)
      createdAt:
        detectDate(frontmatter, ['created', 'createdAt', 'created_at', 'date']) ||
        now,
      modifiedAt:
        detectDate(frontmatter, [
          'modified',
          'modifiedAt',
          'modified_at',
          'updated',
        ]) || now,
      dueAt:
        detectDate(frontmatter, ['due', 'dueAt', 'due_at', 'deadline']) || null,
      completedAt:
        detectDate(frontmatter, ['completed', 'completedAt', 'completed_at']) ||
        null,
      eventStart:
        detectDate(frontmatter, [
          'start',
          'eventStart',
          'event_start',
          'start_date',
        ]) || null,
      eventEnd:
        detectDate(frontmatter, ['end', 'eventEnd', 'event_end', 'end_date']) ||
        null,

      // LATCH: Category
      folder:
        ((frontmatter.folder || frontmatter.category) as string | null) ?? null,
      tags: detectTags(frontmatter),
      status:
        ((frontmatter.status || frontmatter.state) as string | null) ?? null,

      // LATCH: Hierarchy
      priority: detectPriority(frontmatter),
      importance: (frontmatter.importance as number) || 0,
      sortOrder:
        ((frontmatter.sort_order || frontmatter.sortOrder || 0) as number),

      // Grid
      gridX: 0,
      gridY: 0,

      // Provenance
      sourceUrl:
        ((frontmatter.url ||
          frontmatter.source_url ||
          frontmatter.link) as string | null) ?? null,
      deletedAt: null,
      version: 1,

      // Extended properties for unknown keys
      properties: extractUnknownProperties(frontmatter),
    };

    return [node];
  }
}

// Helper functions for flexible field detection
function detectNodeType(fm: Record<string, unknown>): string {
  return (fm.type || fm.nodeType || fm.node_type || 'note') as string;
}

function detectName(fm: Record<string, unknown>, raw: string): string {
  if (fm.title) return fm.title as string;
  if (fm.name) return fm.name as string;

  // Extract from first H1
  const h1Match = raw.match(/^#\s+(.+)$/m);
  if (h1Match) return h1Match[1];

  return 'Untitled';
}

function detectSummary(
  fm: Record<string, unknown>,
  raw: string
): string | null {
  if (fm.summary) return fm.summary as string;
  if (fm.description) return fm.description as string;

  // First non-heading, non-empty line (max 200 chars)
  const lines = raw.split('\n').filter((line) => {
    const t = line.trim();
    return t && !t.startsWith('#') && !t.startsWith('---');
  });
  return lines[0]?.slice(0, 200) || null;
}

function detectDate(
  fm: Record<string, unknown>,
  keys: string[]
): string | null {
  for (const key of keys) {
    const val = fm[key];
    if (val) {
      // Handle Date objects
      if (val instanceof Date) return val.toISOString();
      // Handle strings - ensure ISO format
      if (typeof val === 'string') {
        // If already ISO, return as-is
        if (/^\d{4}-\d{2}-\d{2}T/.test(val)) return val;
        // Try to parse and convert
        const parsed = new Date(val);
        if (!isNaN(parsed.getTime())) return parsed.toISOString();
      }
    }
  }
  return null;
}

function detectTags(fm: Record<string, unknown>): string[] {
  const tags = fm.tags || fm.labels || fm.categories;
  if (!tags) return [];
  if (Array.isArray(tags)) return tags.map(String);
  if (typeof tags === 'string') {
    return tags
      .split(/[,;]/)
      .map((t) => t.trim())
      .filter(Boolean);
  }
  return [];
}

function detectPriority(fm: Record<string, unknown>): number {
  const p = fm.priority;
  if (typeof p === 'number') return Math.min(5, Math.max(0, p));
  if (typeof p === 'string') {
    const lower = p.toLowerCase();
    if (lower === 'high' || lower === 'urgent') return 5;
    if (lower === 'medium' || lower === 'normal') return 3;
    if (lower === 'low') return 1;
    const num = parseInt(p, 10);
    if (!isNaN(num)) return Math.min(5, Math.max(0, num));
  }
  return 0;
}

// Known LATCH keys that map to CanonicalNode fields
const KNOWN_KEYS = new Set([
  'title',
  'name',
  'type',
  'nodeType',
  'node_type',
  'content',
  'summary',
  'description',
  'latitude',
  'longitude',
  'location',
  'location_name',
  'locationName',
  'address',
  'locationAddress',
  'location_address',
  'created',
  'createdAt',
  'created_at',
  'date',
  'modified',
  'modifiedAt',
  'modified_at',
  'updated',
  'due',
  'dueAt',
  'due_at',
  'deadline',
  'completed',
  'completedAt',
  'completed_at',
  'start',
  'eventStart',
  'event_start',
  'start_date',
  'end',
  'eventEnd',
  'event_end',
  'end_date',
  'folder',
  'category',
  'tags',
  'labels',
  'categories',
  'status',
  'state',
  'priority',
  'importance',
  'sort_order',
  'sortOrder',
  'url',
  'source_url',
  'link',
]);

function extractUnknownProperties(
  fm: Record<string, unknown>
): Record<string, unknown> {
  const props: Record<string, unknown> = {
    originalFormat: 'markdown',
  };

  for (const [key, value] of Object.entries(fm)) {
    if (!KNOWN_KEYS.has(key)) {
      props[key] = value;
    }
  }

  return props;
}
