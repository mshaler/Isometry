/**
 * JSON Importer for Isometry ETL
 *
 * Parses .json files using native JSON.parse.
 * - Single object -> one node
 * - Array of objects -> multiple nodes
 *
 * LATCH mapping with flexible key detection.
 *
 * @module etl/importers/JsonImporter
 */

import { v4 as uuidv4 } from 'uuid';
import { BaseImporter, FileSource } from './BaseImporter';
import { CanonicalNode } from '../types/canonical';
import { generateDeterministicSourceId } from '../id-generation/deterministic';

interface ParsedJson {
  data: unknown;
  filename: string;
}

export class JsonImporter extends BaseImporter {
  protected async parse(source: FileSource): Promise<unknown> {
    try {
      const data = JSON.parse(source.content);
      return { data, filename: source.filename };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`Invalid JSON in ${source.filename}: ${message}`);
    }
  }

  protected async transform(data: unknown): Promise<CanonicalNode[]> {
    const { data: parsed, filename } = data as ParsedJson;
    const now = new Date().toISOString();

    // Array -> multiple nodes
    if (Array.isArray(parsed)) {
      return parsed.map((item, index) =>
        this.objectToNode(item, filename, index, now)
      );
    }

    // Single object -> one node
    if (typeof parsed === 'object' && parsed !== null) {
      return [this.objectToNode(parsed, filename, 0, now)];
    }

    // Primitive value -> wrap in node
    return [this.primitiveToNode(parsed, filename, now)];
  }

  private objectToNode(
    obj: unknown,
    filename: string,
    index: number,
    now: string
  ): CanonicalNode {
    const data = (obj || {}) as Record<string, unknown>;

    const sourceId = generateDeterministicSourceId(
      `${filename}:${index}`,
      data,
      'json-importer'
    );

    return {
      id: uuidv4(),
      sourceId,
      source: 'json-importer',
      nodeType: detectNodeType(data),
      name: detectName(data, index),
      content: JSON.stringify(data, null, 2),
      summary: detectSummary(data),

      // LATCH: Location
      latitude: detectNumber(data, ['latitude', 'lat']) ?? null,
      longitude: detectNumber(data, ['longitude', 'lng', 'lon']) ?? null,
      locationName: detectString(data, ['location_name', 'locationName', 'place']) ?? null,
      locationAddress: detectString(data, ['address', 'location', 'locationAddress']) ?? null,

      // LATCH: Time
      createdAt: detectDate(data, ['created', 'createdAt', 'created_at', 'date', 'timestamp']) || now,
      modifiedAt: detectDate(data, ['modified', 'modifiedAt', 'modified_at', 'updated', 'updatedAt']) || now,
      dueAt: detectDate(data, ['due', 'dueAt', 'due_at', 'deadline', 'dueDate']) || null,
      completedAt: detectDate(data, ['completed', 'completedAt', 'completed_at', 'done']) || null,
      eventStart: detectDate(data, ['start', 'eventStart', 'startDate', 'start_date']) || null,
      eventEnd: detectDate(data, ['end', 'eventEnd', 'endDate', 'end_date']) || null,

      // LATCH: Category
      folder: detectString(data, ['folder', 'category', 'group']) ?? null,
      tags: detectTags(data),
      status: detectString(data, ['status', 'state']) ?? null,

      // LATCH: Hierarchy
      priority: detectPriority(data),
      importance: (data.importance as number) || 0,
      sortOrder: (data.sort_order || data.sortOrder || data.order || 0) as number,

      // Grid
      gridX: 0,
      gridY: 0,

      // Provenance
      sourceUrl: detectString(data, ['url', 'link', 'source_url', 'sourceUrl']) ?? null,
      deletedAt: null,
      version: 1,

      // Store all original keys for reference
      properties: {
        originalFormat: 'json',
        originalKeys: Object.keys(data),
      },
    };
  }

  private primitiveToNode(value: unknown, filename: string, now: string): CanonicalNode {
    return {
      id: uuidv4(),
      sourceId: generateDeterministicSourceId(filename, { value }, 'json-importer'),
      source: 'json-importer',
      nodeType: 'note',
      name: String(value),
      content: JSON.stringify(value, null, 2),
      summary: null,
      latitude: null,
      longitude: null,
      locationName: null,
      locationAddress: null,
      createdAt: now,
      modifiedAt: now,
      dueAt: null,
      completedAt: null,
      eventStart: null,
      eventEnd: null,
      folder: null,
      tags: [],
      status: null,
      priority: 0,
      importance: 0,
      sortOrder: 0,
      gridX: 0,
      gridY: 0,
      sourceUrl: null,
      deletedAt: null,
      version: 1,
      properties: { originalFormat: 'json', primitiveType: typeof value },
    };
  }
}

// Helper functions
function detectNodeType(data: Record<string, unknown>): string {
  return (data.type || data.nodeType || data.node_type || 'note') as string;
}

function detectName(data: Record<string, unknown>, index: number): string {
  const candidates = ['name', 'title', 'subject', 'label', 'description', 'id'];
  for (const key of candidates) {
    const val = data[key];
    if (typeof val === 'string' && val.length > 0) return val;
  }
  return `Item ${index + 1}`;
}

function detectSummary(data: Record<string, unknown>): string | null {
  const candidates = ['summary', 'description', 'excerpt', 'preview'];
  for (const key of candidates) {
    const val = data[key];
    if (typeof val === 'string') return val.slice(0, 200);
  }
  return null;
}

function detectString(data: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const val = data[key];
    if (typeof val === 'string') return val;
  }
  return undefined;
}

function detectNumber(data: Record<string, unknown>, keys: string[]): number | undefined {
  for (const key of keys) {
    const val = data[key];
    if (typeof val === 'number') return val;
  }
  return undefined;
}

function detectDate(data: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const val = data[key];
    if (!val) continue;

    // Handle Date objects
    if (val instanceof Date) return val.toISOString();

    // Handle ISO strings
    if (typeof val === 'string') {
      if (/^\d{4}-\d{2}-\d{2}T/.test(val)) return val;
      const parsed = new Date(val);
      if (!isNaN(parsed.getTime())) return parsed.toISOString();
    }

    // Handle timestamps
    if (typeof val === 'number') {
      const parsed = new Date(val);
      if (!isNaN(parsed.getTime())) return parsed.toISOString();
    }
  }
  return null;
}

function detectTags(data: Record<string, unknown>): string[] {
  const tagKeys = ['tags', 'labels', 'categories', 'keywords'];
  for (const key of tagKeys) {
    const val = data[key];
    if (Array.isArray(val)) return val.map(String);
    if (typeof val === 'string') {
      return val.split(/[,;]/).map(t => t.trim()).filter(Boolean);
    }
  }
  return [];
}

function detectPriority(data: Record<string, unknown>): number {
  const p = data.priority;
  if (typeof p === 'number') return Math.min(5, Math.max(0, p));
  if (typeof p === 'string') {
    const lower = p.toLowerCase();
    if (lower === 'high' || lower === 'urgent' || lower === 'critical') return 5;
    if (lower === 'medium' || lower === 'normal') return 3;
    if (lower === 'low') return 1;
    const num = parseInt(p, 10);
    if (!isNaN(num)) return Math.min(5, Math.max(0, num));
  }
  return 0;
}
