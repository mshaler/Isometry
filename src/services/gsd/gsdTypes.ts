/**
 * GSD File Parsing Types
 *
 * TypeScript interfaces for parsing GSD PLAN.md files.
 * Used by gsdFileParser.ts to extract structured data from markdown frontmatter and task blocks.
 */

/**
 * Artifact definition in must_haves section
 */
export interface MustHaveArtifact {
  path: string;
  provides: string;
  exports?: string[];
}

/**
 * Key link definition in must_haves section
 */
export interface MustHaveKeyLink {
  from: string;
  to: string;
  via: string;
  pattern?: string;
}

/**
 * Must-haves section containing truths, artifacts, and key links
 */
export interface MustHaves {
  truths?: string[];
  artifacts?: MustHaveArtifact[];
  key_links?: MustHaveKeyLink[];
}

/**
 * PLAN.md frontmatter structure
 * Parsed from YAML between --- delimiters
 */
export interface PlanFrontmatter {
  phase: string;
  plan: string | number;
  type: string;
  wave?: number;
  depends_on: string[];
  files_modified: string[];
  autonomous: boolean;
  user_setup?: string[];
  must_haves?: MustHaves;
}

/**
 * Task status derived from task content
 */
export type TaskStatus = 'pending' | 'in_progress' | 'complete';

/**
 * Task type - auto or checkpoint variants
 */
export type TaskType = 'auto' | 'checkpoint:human-verify' | 'checkpoint:decision' | 'checkpoint:human-action';

/**
 * Parsed GSD task from PLAN.md
 * Extracted from <task>...</task> XML-like blocks in markdown
 */
export interface GSDTask {
  /** Task name from <name> element */
  name: string;
  /** Task type from type attribute */
  type: TaskType;
  /** Files from <files> element, split by newlines */
  files: string[];
  /** Action description from <action> element */
  action: string;
  /** Verification steps from <verify> element */
  verify: string;
  /** Done criteria from <done> element */
  done: string;
  /** Derived status based on done content */
  status: TaskStatus;
  /** Optional TDD flag */
  tdd?: boolean;
}

/**
 * Complete parsed PLAN.md file
 */
export interface ParsedPlanFile {
  /** Parsed frontmatter */
  frontmatter: PlanFrontmatter;
  /** Extracted tasks in order */
  tasks: GSDTask[];
  /** Raw markdown content (without frontmatter) */
  rawContent: string;
  /** Source file path */
  filePath: string;
}
