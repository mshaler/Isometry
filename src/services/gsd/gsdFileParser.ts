/**
 * GSD File Parser
 *
 * Parses PLAN.md files from the .planning directory structure.
 * Extracts frontmatter using gray-matter and task blocks using regex.
 */

import * as fs from 'fs/promises';
import matter from 'gray-matter';
import type {
  GSDTask,
  MustHaves,
  ParsedPlanFile,
  PlanFrontmatter,
  TaskStatus,
  TaskType,
} from './gsdTypes';

/**
 * Parse a GSD PLAN.md file into structured data
 *
 * @param filePath - Absolute path to the PLAN.md file
 * @returns Parsed plan file with frontmatter and tasks
 */
export async function parseGSDPlanFile(filePath: string): Promise<ParsedPlanFile> {
  const fileContent = await fs.readFile(filePath, 'utf-8');
  const { data, content } = matter(fileContent);

  const frontmatter = normalizeFrontmatter(data);
  const tasks = extractTasks(content);

  return {
    frontmatter,
    tasks,
    rawContent: content,
    filePath,
  };
}

/**
 * Parse GSD plan file from string content (for testing without file I/O)
 *
 * @param content - Raw markdown content including frontmatter
 * @param filePath - Virtual file path for the result
 * @returns Parsed plan file with frontmatter and tasks
 */
export function parseGSDPlanContent(content: string, filePath: string = 'virtual.md'): ParsedPlanFile {
  const { data, content: bodyContent } = matter(content);

  const frontmatter = normalizeFrontmatter(data);
  const tasks = extractTasks(bodyContent);

  return {
    frontmatter,
    tasks,
    rawContent: bodyContent,
    filePath,
  };
}

/**
 * Normalize frontmatter data with defaults for optional fields
 */
function normalizeFrontmatter(data: Record<string, unknown>): PlanFrontmatter {
  return {
    phase: String(data.phase ?? ''),
    plan: typeof data.plan === 'number' ? data.plan : String(data.plan ?? ''),
    type: String(data.type ?? 'execute'),
    wave: typeof data.wave === 'number' ? data.wave : undefined,
    depends_on: normalizeStringArray(data.depends_on),
    files_modified: normalizeStringArray(data.files_modified),
    autonomous: Boolean(data.autonomous),
    user_setup: data.user_setup ? normalizeStringArray(data.user_setup) : undefined,
    must_haves: data.must_haves ? normalizeMustHaves(data.must_haves) : undefined,
  };
}

/**
 * Normalize a value to a string array
 * Handles: undefined, null, single string, array of strings
 */
function normalizeStringArray(value: unknown): string[] {
  if (value === undefined || value === null) {
    return [];
  }
  if (typeof value === 'string') {
    return [value];
  }
  if (Array.isArray(value)) {
    return value.map(String);
  }
  return [];
}

/**
 * Normalize must_haves object
 */
function normalizeMustHaves(value: unknown): MustHaves {
  if (typeof value !== 'object' || value === null) {
    return {};
  }

  const obj = value as Record<string, unknown>;

  return {
    truths: obj.truths ? normalizeStringArray(obj.truths) : undefined,
    artifacts: Array.isArray(obj.artifacts) ? obj.artifacts : undefined,
    key_links: Array.isArray(obj.key_links) ? obj.key_links : undefined,
  };
}

/**
 * Extract task blocks from markdown content
 *
 * Parses XML-like <task>...</task> blocks and extracts their inner elements.
 * Handles malformed blocks gracefully by skipping them.
 *
 * @param content - Markdown content (without frontmatter)
 * @returns Array of parsed tasks in document order
 */
export function extractTasks(content: string): GSDTask[] {
  const tasks: GSDTask[] = [];

  // Match <task type="...">...</task> blocks (non-greedy, handles multiline)
  const taskBlockRegex = /<task\s+type="([^"]*)"[^>]*>([\s\S]*?)<\/task>/g;

  let match: RegExpExecArray | null;
  while ((match = taskBlockRegex.exec(content)) !== null) {
    const taskType = match[1] as TaskType;
    const taskContent = match[2];

    const task = parseTaskBlock(taskType, taskContent);
    if (task) {
      tasks.push(task);
    }
  }

  return tasks;
}

/**
 * Parse a single task block's content
 */
function parseTaskBlock(type: TaskType, content: string): GSDTask | null {
  const name = extractElement(content, 'name');
  if (!name) {
    // Tasks must have a name
    return null;
  }

  const filesRaw = extractElement(content, 'files');
  const files = filesRaw
    ? filesRaw
        .split('\n')
        .map((f) => f.trim())
        .filter(Boolean)
    : [];

  const action = extractElement(content, 'action') ?? '';
  const verify = extractElement(content, 'verify') ?? '';
  const done = extractElement(content, 'done') ?? '';

  // Check for tdd attribute in task tag or content
  const tddAttr = content.includes('tdd="true"');

  const status = normalizeTaskStatus({ done });

  return {
    name,
    type,
    files,
    action,
    verify,
    done,
    status,
    ...(tddAttr ? { tdd: true } : {}),
  };
}

/**
 * Extract content from an XML-like element
 *
 * @param content - Block content to search in
 * @param elementName - Name of the element to extract
 * @returns Trimmed content or null if not found
 */
function extractElement(content: string, elementName: string): string | null {
  // Match <element>content</element> or <element>content (unclosed at end)
  const regex = new RegExp(`<${elementName}>([\\s\\S]*?)<\\/${elementName}>`, 'i');
  const match = regex.exec(content);

  if (match) {
    return match[1].trim();
  }

  return null;
}

/**
 * Normalize task status based on done element content
 *
 * - If done has content (non-empty): task is 'complete'
 * - Otherwise: task is 'pending'
 *
 * Note: 'in_progress' status is set externally when execution starts.
 *
 * @param task - Object with done property
 * @returns Normalized status
 */
export function normalizeTaskStatus(task: { done: string }): TaskStatus {
  // If done has actual content (not just whitespace), task is complete
  if (task.done && task.done.trim().length > 0) {
    return 'complete';
  }
  return 'pending';
}
