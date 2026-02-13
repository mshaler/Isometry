/**
 * Test Data Generator for Performance Benchmarks
 *
 * Generates synthetic node data at various scales (1k, 5k, 10k)
 * with realistic LATCH property distributions.
 */

import type { Node } from '@/types/node';

// Seeded random for reproducibility
function seededRandom(seed: number): () => number {
  return () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
}

// Sample data pools
const FOLDERS = ['Work', 'Personal', 'Projects', 'Archive', 'Inbox', 'Research'];
const TAGS_POOL = ['urgent', 'important', 'review', 'draft', 'published', 'meeting', 'idea', 'todo', 'done'];
const STATUSES = ['active', 'pending', 'completed', 'archived', 'draft'];
const PRIORITIES = [1, 2, 3, 4, 5];
const WORDS = [
  'project', 'meeting', 'review', 'design', 'implementation', 'testing',
  'documentation', 'planning', 'research', 'analysis', 'report', 'update',
  'milestone', 'deadline', 'task', 'feature', 'bug', 'fix', 'enhancement'
];

export interface GeneratorOptions {
  seed?: number;
  includeContent?: boolean;
  contentLength?: number;
}

/**
 * Generate a single synthetic node
 */
function generateNode(index: number, random: () => number, options: GeneratorOptions = {}): Node {
  const { includeContent = true, contentLength = 100 } = options;

  const folder = FOLDERS[Math.floor(random() * FOLDERS.length)];
  const status = STATUSES[Math.floor(random() * STATUSES.length)];
  const priority = PRIORITIES[Math.floor(random() * PRIORITIES.length)];

  // Generate 1-3 tags
  const tagCount = Math.floor(random() * 3) + 1;
  const tags: string[] = [];
  for (let i = 0; i < tagCount; i++) {
    const tag = TAGS_POOL[Math.floor(random() * TAGS_POOL.length)];
    if (!tags.includes(tag)) tags.push(tag);
  }

  // Generate title from random words
  const wordCount = Math.floor(random() * 4) + 2;
  const titleWords: string[] = [];
  for (let i = 0; i < wordCount; i++) {
    titleWords.push(WORDS[Math.floor(random() * WORDS.length)]);
  }
  const name = titleWords.join(' ');

  // Generate content if requested
  let content = '';
  if (includeContent) {
    const contentWords: string[] = [];
    const numWords = Math.floor(random() * contentLength) + 10;
    for (let i = 0; i < numWords; i++) {
      contentWords.push(WORDS[Math.floor(random() * WORDS.length)]);
    }
    content = contentWords.join(' ');
  }

  // Generate timestamps within last 90 days
  const now = Date.now();
  const ninetyDays = 90 * 24 * 60 * 60 * 1000;
  const createdAt = new Date(now - Math.floor(random() * ninetyDays)).toISOString();
  const modifiedAt = new Date(now - Math.floor(random() * ninetyDays * 0.5)).toISOString();

  return {
    id: `node-${index}`,
    name,
    content,
    folder,
    tags,
    status,
    priority,
    created_at: createdAt,
    modified_at: modifiedAt,
    source: 'benchmark',
    source_id: `bench-${index}`,
  };
}

/**
 * Generate an array of synthetic nodes
 */
export function generateNodes(count: number, options: GeneratorOptions = {}): Node[] {
  const seed = options.seed ?? 12345;
  const random = seededRandom(seed);
  const nodes: Node[] = [];

  for (let i = 0; i < count; i++) {
    nodes.push(generateNode(i, random, options));
  }

  return nodes;
}

/**
 * Generate nodes at standard benchmark scales
 */
export function generateBenchmarkData(scale: '1k' | '5k' | '10k', options: GeneratorOptions = {}): Node[] {
  const counts: Record<string, number> = {
    '1k': 1000,
    '5k': 5000,
    '10k': 10000,
  };
  return generateNodes(counts[scale], options);
}

/**
 * Insert benchmark nodes into database
 */
export async function insertBenchmarkNodes(
  db: { run: (sql: string, params?: unknown[]) => void },
  nodes: Node[]
): Promise<void> {
  const insertSQL = `
    INSERT INTO nodes (id, name, content, folder, tags, status, priority, created_at, modified_at, source, source_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  for (const node of nodes) {
    db.run(insertSQL, [
      node.id,
      node.name,
      node.content || '',
      node.folder || '',
      JSON.stringify(node.tags || []),
      node.status || 'active',
      node.priority || 3,
      node.created_at,
      node.modified_at,
      node.source || 'benchmark',
      node.source_id || node.id,
    ]);
  }
}
