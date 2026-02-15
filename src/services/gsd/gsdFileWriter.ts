/**
 * GSD File Writer - Atomic writes for task status updates
 *
 * Handles writing task status changes back to PLAN.md files.
 * Uses atomic write pattern (temp file + rename) to prevent corruption.
 */

import { readFile, writeFile, rename } from 'fs/promises';
import matter from 'gray-matter';
import { join } from 'path';
import type { ParsedPlanFile, PlanFrontmatter, TaskStatus } from './gsdTypes';
import { devLogger } from '../../utils/logging';

/**
 * Update a task's status in a PLAN.md file
 *
 * Task status is represented by presence of <done> element:
 * - 'complete': <done> element with content
 * - 'in_progress': Add <!-- status: in_progress --> comment before task
 * - 'pending': No <done> element, no status comment
 *
 * @param projectPath - Project root path
 * @param planPath - Relative path to plan file (e.g., 'phases/87-xxx/87-01-PLAN.md')
 * @param taskIndex - Zero-based index of the task to update
 * @param newStatus - New status to set
 */
export async function updateTaskStatus(
  projectPath: string,
  planPath: string,
  taskIndex: number,
  newStatus: TaskStatus
): Promise<void> {
  const fullPath = join(projectPath, '.planning', planPath);
  const fileContent = await readFile(fullPath, 'utf-8');
  const { data: frontmatter, content } = matter(fileContent);

  // Track task positions for accurate replacement
  const taskRegex = /<task\s+type="([^"]+)"[^>]*>([\s\S]*?)<\/task>/g;
  let match: RegExpExecArray | null;
  const tasks: Array<{ start: number; end: number; content: string; type: string }> = [];

  while ((match = taskRegex.exec(content)) !== null) {
    tasks.push({
      start: match.index,
      end: match.index + match[0].length,
      content: match[2],
      type: match[1],
    });
  }

  if (taskIndex < 0 || taskIndex >= tasks.length) {
    throw new Error(`Task index ${taskIndex} out of bounds (${tasks.length} tasks)`);
  }

  const task = tasks[taskIndex];
  let newTaskContent = task.content;

  // Remove existing status comment if present
  newTaskContent = newTaskContent.replace(/<!--\s*status:\s*\w+\s*-->\n?/g, '');

  // Update based on new status
  if (newStatus === 'complete') {
    // Add <done> if not present
    if (!/<done>/.test(newTaskContent)) {
      // Find insertion point (after <verify> or at end before </task>)
      const verifyMatch = /<\/verify>/.exec(newTaskContent);
      const insertPos = verifyMatch
        ? verifyMatch.index + verifyMatch[0].length
        : newTaskContent.length;

      newTaskContent =
        newTaskContent.slice(0, insertPos) +
        '\n  <done>Task completed</done>' +
        newTaskContent.slice(insertPos);
    }
  } else if (newStatus === 'in_progress') {
    // Add status comment at start of task content
    newTaskContent = `\n  <!-- status: in_progress -->` + newTaskContent;
  } else if (newStatus === 'pending') {
    // Remove <done> element if present
    newTaskContent = newTaskContent.replace(/<done>[\s\S]*?<\/done>\n?/g, '');
  }

  // Reconstruct full task
  const newTask = `<task type="${task.type}">${newTaskContent}</task>`;

  // Replace in content
  const updatedContent =
    content.slice(0, task.start) + newTask + content.slice(task.end);

  // Reconstruct file with frontmatter
  const fullContent = matter.stringify(updatedContent, frontmatter as PlanFrontmatter);

  // Atomic write: write to temp, then rename
  const tempPath = `${fullPath}.tmp`;
  await writeFile(tempPath, fullContent, 'utf-8');
  await rename(tempPath, fullPath);

  devLogger.debug('Updated task status', {
    component: 'gsdFileWriter',
    planPath,
    taskIndex,
    newStatus,
  });
}

/**
 * Write a complete ParsedPlanFile back to disk
 *
 * Uses atomic write pattern (temp file + rename) for safety.
 *
 * @param projectPath - Project root path
 * @param planPath - Relative path to plan file
 * @param parsed - Parsed plan file to write
 */
export async function writeGSDPlanFile(
  projectPath: string,
  planPath: string,
  parsed: ParsedPlanFile
): Promise<void> {
  const fullPath = join(projectPath, '.planning', planPath);
  const fullContent = matter.stringify(parsed.rawContent, parsed.frontmatter as object);

  // Atomic write: write to temp, then rename
  const tempPath = `${fullPath}.tmp`;
  await writeFile(tempPath, fullContent, 'utf-8');
  await rename(tempPath, fullPath);

  devLogger.debug('Wrote GSD plan file', {
    component: 'gsdFileWriter',
    planPath,
  });
}
