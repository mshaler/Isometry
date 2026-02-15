import type { Database } from 'sql.js';

/**
 * Template variable definition for {{variable}} placeholders
 */
export interface TemplateVariable {
  name: string;  // Variable name (e.g., 'date', 'project_name')
  type: 'text' | 'date' | 'time' | 'datetime';  // Input type
  default?: string;  // Default value
  description?: string;  // Help text
}

/**
 * Template definition for /template slash command
 */
export interface Template {
  id: string;
  name: string;
  description: string | null;
  category: string | null;  // 'meeting', 'project', 'note', 'daily', 'custom'
  content: string;  // Markdown content
  variables: TemplateVariable[];  // Parsed from JSON
  createdAt: string;
  modifiedAt: string;
  usageCount: number;
}

/**
 * Query templates, optionally filtered by category.
 * Returns templates sorted by usage count (most used first).
 */
export function queryTemplates(
  db: Database | null,
  category?: string
): Template[] {
  if (!db) return [];

  try {
    const sql = category
      ? `SELECT id, name, description, category, content, variables, created_at, modified_at, usage_count
         FROM templates
         WHERE category = ?
         ORDER BY usage_count DESC, name ASC`
      : `SELECT id, name, description, category, content, variables, created_at, modified_at, usage_count
         FROM templates
         ORDER BY usage_count DESC, name ASC`;

    const params = category ? [category] : [];
    const results = db.exec(sql, params);

    if (!results[0]?.values) return [];

    return results[0].values.map((row) => rowToTemplate(row as TemplateRow));
  } catch (error) {
    console.error('Failed to query templates:', error);
    return [];
  }
}

/**
 * Search templates using FTS5 full-text search.
 * Falls back to queryTemplates on empty query or error.
 */
export function searchTemplates(
  db: Database | null,
  query: string,
  limit: number = 10
): Template[] {
  if (!db) return [];
  if (!query.trim()) return queryTemplates(db);

  try {
    const results = db.exec(
      `SELECT t.id, t.name, t.description, t.category, t.content, t.variables,
              t.created_at, t.modified_at, t.usage_count
       FROM templates_fts
       JOIN templates t ON templates_fts.rowid = t.rowid
       WHERE templates_fts MATCH ?
       ORDER BY rank, t.usage_count DESC
       LIMIT ?`,
      [query, limit]
    );

    if (!results[0]?.values) return [];

    return results[0].values.map((row) => rowToTemplate(row as TemplateRow));
  } catch (error) {
    console.error('FTS5 search failed, falling back to regular query:', error);
    return queryTemplates(db);
  }
}

/**
 * Get a single template by ID.
 */
export function getTemplate(
  db: Database | null,
  templateId: string
): Template | null {
  if (!db) return null;

  try {
    const results = db.exec(
      `SELECT id, name, description, category, content, variables, created_at, modified_at, usage_count
       FROM templates
       WHERE id = ?`,
      [templateId]
    );

    if (!results[0]?.values?.[0]) return null;

    return rowToTemplate(results[0].values[0] as TemplateRow);
  } catch (error) {
    console.error('Failed to get template:', error);
    return null;
  }
}

/**
 * Create a new template.
 */
export function createTemplate(
  db: Database | null,
  template: Omit<Template, 'id' | 'createdAt' | 'modifiedAt' | 'usageCount'>
): string | null {
  if (!db) return null;

  try {
    const id = `template-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const variablesJson = JSON.stringify(template.variables || []);

    db.run(
      `INSERT INTO templates (id, name, description, category, content, variables)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, template.name, template.description, template.category, template.content, variablesJson]
    );

    return id;
  } catch (error) {
    console.error('Failed to create template:', error);
    return null;
  }
}

/**
 * Update an existing template.
 */
export function updateTemplate(
  db: Database | null,
  templateId: string,
  updates: Partial<Pick<Template, 'name' | 'description' | 'category' | 'content' | 'variables'>>
): boolean {
  if (!db) return false;

  try {
    const setClauses: string[] = [];
    const params: (string | null)[] = [];

    if (updates.name !== undefined) {
      setClauses.push('name = ?');
      params.push(updates.name);
    }
    if (updates.description !== undefined) {
      setClauses.push('description = ?');
      params.push(updates.description);
    }
    if (updates.category !== undefined) {
      setClauses.push('category = ?');
      params.push(updates.category);
    }
    if (updates.content !== undefined) {
      setClauses.push('content = ?');
      params.push(updates.content);
    }
    if (updates.variables !== undefined) {
      setClauses.push('variables = ?');
      params.push(JSON.stringify(updates.variables));
    }

    if (setClauses.length === 0) return true;

    setClauses.push("modified_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')");
    params.push(templateId);

    db.run(
      `UPDATE templates SET ${setClauses.join(', ')} WHERE id = ?`,
      params
    );

    return true;
  } catch (error) {
    console.error('Failed to update template:', error);
    return false;
  }
}

/**
 * Delete a template by ID.
 */
export function deleteTemplate(
  db: Database | null,
  templateId: string
): boolean {
  if (!db) return false;

  try {
    db.run('DELETE FROM templates WHERE id = ?', [templateId]);
    return true;
  } catch (error) {
    console.error('Failed to delete template:', error);
    return false;
  }
}

/**
 * Increment usage count when template is applied.
 */
export function incrementTemplateUsage(
  db: Database | null,
  templateId: string
): boolean {
  if (!db) return false;

  try {
    db.run(
      'UPDATE templates SET usage_count = usage_count + 1 WHERE id = ?',
      [templateId]
    );
    return true;
  } catch (error) {
    console.error('Failed to increment template usage:', error);
    return false;
  }
}

/**
 * Ensure templates table exists (for databases initialized before Phase 95).
 * Uses CREATE TABLE IF NOT EXISTS so it's safe to call on every init.
 */
function ensureTemplatesTableExists(db: Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS templates (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      category TEXT,
      content TEXT NOT NULL,
      variables TEXT,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
      modified_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
      usage_count INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_templates_category ON templates(category);
    CREATE INDEX IF NOT EXISTS idx_templates_usage ON templates(usage_count DESC);
    CREATE INDEX IF NOT EXISTS idx_templates_name ON templates(name);
  `);
}

/**
 * Seed built-in templates on first database initialization.
 * Uses INSERT OR IGNORE so it's safe to call on every init.
 *
 * NOTE: First ensures templates table exists to handle databases
 * initialized before Phase 95 (schema race condition fix).
 */
export function seedBuiltInTemplates(db: Database | null): void {
  if (!db) return;

  // Ensure table exists before seeding (fixes race condition for pre-Phase 95 databases)
  try {
    ensureTemplatesTableExists(db);
  } catch (tableError) {
    console.error('[templates] Failed to ensure templates table exists:', tableError);
    return;
  }

  const builtInTemplates = [
    {
      id: 'builtin-meeting-notes',
      name: 'Meeting Notes',
      description: 'Standard meeting notes template with attendees, agenda, and action items',
      category: 'meeting',
      content: `# Meeting Notes

**Date:** {{date}}
**Time:** {{time}}
**Attendees:**

## Agenda

1.

## Discussion

## Action Items

- [ ]

## Next Steps
`,
      variables: [
        { name: 'date', type: 'date', default: '{{today}}' },
        { name: 'time', type: 'time' },
      ],
    },
    {
      id: 'builtin-daily-note',
      name: 'Daily Note',
      description: 'Daily journal template with gratitude, goals, and reflection sections',
      category: 'daily',
      content: `# Daily Note - {{date}}

## Morning

### Gratitude
-

### Today's Goals
- [ ]

## Evening

### What went well?

### What could improve?

### Notes
`,
      variables: [
        { name: 'date', type: 'date', default: '{{today}}' },
      ],
    },
    {
      id: 'builtin-project',
      name: 'Project',
      description: 'Project overview template with goals, milestones, and resources',
      category: 'project',
      content: `# Project: {{project_name}}

**Created:** {{date}}
**Status:** Planning

## Overview

## Goals

1.

## Milestones

- [ ] Phase 1:
- [ ] Phase 2:
- [ ] Phase 3:

## Resources

## Notes
`,
      variables: [
        { name: 'project_name', type: 'text', description: 'Name of the project' },
        { name: 'date', type: 'date', default: '{{today}}' },
      ],
    },
    {
      id: 'builtin-task',
      name: 'Task',
      description: 'Simple task template with due date, priority, and subtasks',
      category: 'note',
      content: `# Task: {{task_name}}

**Due:** {{due_date}}
**Priority:** Medium

## Description

## Subtasks

- [ ]

## Notes
`,
      variables: [
        { name: 'task_name', type: 'text', description: 'Name of the task' },
        { name: 'due_date', type: 'date' },
      ],
    },
  ];

  try {
    for (const template of builtInTemplates) {
      db.run(
        `INSERT OR IGNORE INTO templates (id, name, description, category, content, variables)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          template.id,
          template.name,
          template.description,
          template.category,
          template.content,
          JSON.stringify(template.variables),
        ]
      );
    }
    console.log('[templates] Built-in templates seeded successfully');
  } catch (error) {
    console.error('Failed to seed built-in templates:', error);
  }
}

/**
 * Parse variables JSON string into TemplateVariable array.
 */
function parseVariables(variables: unknown): TemplateVariable[] {
  if (!variables) return [];

  try {
    const parsed = typeof variables === 'string' ? JSON.parse(variables) : variables;
    if (!Array.isArray(parsed)) return [];
    return parsed as TemplateVariable[];
  } catch {
    return [];
  }
}

/**
 * Convert a SQL result row to a Template object.
 * Row format: [id, name, description, category, content, variables, createdAt, modifiedAt, usageCount]
 */
type TemplateRow = [
  unknown, unknown, unknown, unknown, unknown,
  unknown, unknown, unknown, unknown
];

function rowToTemplate(row: TemplateRow): Template {
  const [id, name, desc, cat, content, vars, created, modified, usage] = row;
  return {
    id: String(id),
    name: String(name),
    description: desc ? String(desc) : null,
    category: cat ? String(cat) : null,
    content: String(content),
    variables: parseVariables(vars),
    createdAt: String(created),
    modifiedAt: String(modified),
    usageCount: Number(usage),
  };
}
