/**
 * GSD File Parser Tests
 *
 * Unit tests for parsing PLAN.md files and extracting frontmatter + task blocks.
 */

import { describe, it, expect } from 'vitest';
import {
  parseGSDPlanContent,
  extractTasks,
  normalizeTaskStatus,
} from '../gsdFileParser';
import type { TaskStatus } from '../gsdTypes';

// Test fixtures as inline strings (no file I/O for fast tests)

const FULL_PLAN_MD = `---
phase: 87-gsd-file-synchronization
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/services/gsd/gsdTypes.ts
  - src/services/gsd/gsdFileParser.ts
autonomous: true
user_setup: []
must_haves:
  truths:
    - "System can parse PLAN.md frontmatter"
  artifacts:
    - path: "src/services/gsd/gsdTypes.ts"
      provides: "TypeScript interfaces"
      exports: ["PlanFrontmatter", "GSDTask"]
---

<objective>
Test objective content
</objective>

<tasks>

<task type="auto">
  <name>Task 1: Create parser</name>
  <files>
    src/services/gsd/gsdFileParser.ts
    src/services/gsd/gsdTypes.ts
  </files>
  <action>
Create the parser module.
  </action>
  <verify>
Run typecheck.
  </verify>
  <done>Parser created</done>
</task>

<task type="checkpoint:human-verify">
  <name>Task 2: Verify output</name>
  <files>
    output.md
  </files>
  <action>
Check the output manually.
  </action>
  <verify>
User confirms.
  </verify>
  <done></done>
</task>

</tasks>
`;

const MINIMAL_PLAN_MD = `---
phase: test
plan: 1
type: execute
autonomous: false
---

No tasks here.
`;

const PLAN_WITH_NUMERIC_PLAN = `---
phase: 99-superstack
plan: 3
type: execute
autonomous: true
wave: 2
depends_on:
  - 99-01
  - 99-02
files_modified: single-file.ts
---

<tasks>
<task type="auto">
  <name>Single task</name>
  <files>file.ts</files>
  <action>Do something</action>
  <verify>Check it</verify>
  <done></done>
</task>
</tasks>
`;

const MALFORMED_TASKS_MD = `---
phase: test
plan: 1
type: execute
autonomous: true
---

<tasks>
<task type="auto">
  This task has no name element - should be skipped
  <action>Some action</action>
</task>

<task type="auto">
  <name>Valid task</name>
  <action>This one is valid</action>
  <verify></verify>
  <done></done>
</task>

<task>
  Missing type attribute - might be handled differently
  <name>Another task</name>
</task>
</tasks>
`;

const EMPTY_FILE = '';

const FRONTMATTER_ONLY = `---
phase: test
plan: 1
type: execute
autonomous: true
---

Just some content, no tasks.
`;

describe('parseGSDPlanContent', () => {
  describe('frontmatter parsing', () => {
    it('extracts all frontmatter fields from valid PLAN.md', () => {
      const result = parseGSDPlanContent(FULL_PLAN_MD, 'test.md');

      expect(result.frontmatter.phase).toBe('87-gsd-file-synchronization');
      // YAML parses 01 as integer 1 (leading zero is stripped)
      expect(result.frontmatter.plan).toBe(1);
      expect(result.frontmatter.type).toBe('execute');
      expect(result.frontmatter.wave).toBe(1);
      expect(result.frontmatter.depends_on).toEqual([]);
      expect(result.frontmatter.files_modified).toEqual([
        'src/services/gsd/gsdTypes.ts',
        'src/services/gsd/gsdFileParser.ts',
      ]);
      expect(result.frontmatter.autonomous).toBe(true);
      expect(result.frontmatter.user_setup).toEqual([]);
    });

    it('parses must_haves section with truths and artifacts', () => {
      const result = parseGSDPlanContent(FULL_PLAN_MD, 'test.md');

      expect(result.frontmatter.must_haves).toBeDefined();
      expect(result.frontmatter.must_haves?.truths).toEqual([
        'System can parse PLAN.md frontmatter',
      ]);
      expect(result.frontmatter.must_haves?.artifacts).toHaveLength(1);
      expect(result.frontmatter.must_haves?.artifacts?.[0].path).toBe(
        'src/services/gsd/gsdTypes.ts'
      );
    });

    it('uses defaults for missing optional fields', () => {
      const result = parseGSDPlanContent(MINIMAL_PLAN_MD, 'test.md');

      expect(result.frontmatter.phase).toBe('test');
      expect(result.frontmatter.plan).toBe(1);
      expect(result.frontmatter.type).toBe('execute');
      expect(result.frontmatter.wave).toBeUndefined();
      expect(result.frontmatter.depends_on).toEqual([]);
      expect(result.frontmatter.files_modified).toEqual([]);
      expect(result.frontmatter.autonomous).toBe(false);
      expect(result.frontmatter.user_setup).toBeUndefined();
      expect(result.frontmatter.must_haves).toBeUndefined();
    });

    it('normalizes single string to array for array fields', () => {
      const result = parseGSDPlanContent(PLAN_WITH_NUMERIC_PLAN, 'test.md');

      // files_modified was a single string in the fixture
      expect(result.frontmatter.files_modified).toEqual(['single-file.ts']);
      expect(result.frontmatter.depends_on).toEqual(['99-01', '99-02']);
    });

    it('preserves numeric plan values', () => {
      const result = parseGSDPlanContent(PLAN_WITH_NUMERIC_PLAN, 'test.md');

      expect(result.frontmatter.plan).toBe(3);
    });

    it('preserves filePath in result', () => {
      const result = parseGSDPlanContent(FULL_PLAN_MD, '/path/to/plan.md');

      expect(result.filePath).toBe('/path/to/plan.md');
    });
  });

  describe('task extraction', () => {
    it('extracts multiple tasks in order', () => {
      const result = parseGSDPlanContent(FULL_PLAN_MD, 'test.md');

      expect(result.tasks).toHaveLength(2);
      expect(result.tasks[0].name).toBe('Task 1: Create parser');
      expect(result.tasks[1].name).toBe('Task 2: Verify output');
    });

    it('parses task type correctly', () => {
      const result = parseGSDPlanContent(FULL_PLAN_MD, 'test.md');

      expect(result.tasks[0].type).toBe('auto');
      expect(result.tasks[1].type).toBe('checkpoint:human-verify');
    });

    it('extracts files as array', () => {
      const result = parseGSDPlanContent(FULL_PLAN_MD, 'test.md');

      expect(result.tasks[0].files).toEqual([
        'src/services/gsd/gsdFileParser.ts',
        'src/services/gsd/gsdTypes.ts',
      ]);
    });

    it('extracts action, verify, and done content', () => {
      const result = parseGSDPlanContent(FULL_PLAN_MD, 'test.md');
      const task1 = result.tasks[0];

      expect(task1.action).toContain('Create the parser module');
      expect(task1.verify).toContain('Run typecheck');
      expect(task1.done).toBe('Parser created');
    });

    it('sets status=complete when done has content', () => {
      const result = parseGSDPlanContent(FULL_PLAN_MD, 'test.md');

      expect(result.tasks[0].status).toBe('complete');
    });

    it('sets status=pending when done is empty', () => {
      const result = parseGSDPlanContent(FULL_PLAN_MD, 'test.md');

      expect(result.tasks[1].status).toBe('pending');
    });
  });

  describe('edge cases', () => {
    it('handles empty file gracefully', () => {
      const result = parseGSDPlanContent(EMPTY_FILE, 'test.md');

      expect(result.frontmatter.phase).toBe('');
      expect(result.frontmatter.plan).toBe('');
      expect(result.tasks).toEqual([]);
    });

    it('returns empty tasks array when no tasks in content', () => {
      const result = parseGSDPlanContent(FRONTMATTER_ONLY, 'test.md');

      expect(result.tasks).toEqual([]);
      expect(result.frontmatter.phase).toBe('test');
    });

    it('skips malformed tasks without name element', () => {
      const result = parseGSDPlanContent(MALFORMED_TASKS_MD, 'test.md');

      // Only the task with a valid <name> element should be extracted
      expect(result.tasks.length).toBeGreaterThanOrEqual(1);
      expect(result.tasks.some((t) => t.name === 'Valid task')).toBe(true);
    });

    it('includes rawContent in result', () => {
      const result = parseGSDPlanContent(FULL_PLAN_MD, 'test.md');

      expect(result.rawContent).toContain('<objective>');
      expect(result.rawContent).toContain('<tasks>');
      // Frontmatter should NOT be in rawContent
      expect(result.rawContent).not.toContain('---\nphase:');
    });
  });
});

describe('extractTasks', () => {
  it('extracts single task block', () => {
    const content = `
<task type="auto">
  <name>My Task</name>
  <files>file.ts</files>
  <action>Do the thing</action>
  <verify>Check it</verify>
  <done>Done!</done>
</task>
`;
    const tasks = extractTasks(content);

    expect(tasks).toHaveLength(1);
    expect(tasks[0].name).toBe('My Task');
    expect(tasks[0].type).toBe('auto');
    expect(tasks[0].files).toEqual(['file.ts']);
    expect(tasks[0].action).toBe('Do the thing');
    expect(tasks[0].verify).toBe('Check it');
    expect(tasks[0].done).toBe('Done!');
    expect(tasks[0].status).toBe('complete');
  });

  it('extracts multiple task blocks in order', () => {
    const content = `
<task type="auto">
  <name>First</name>
  <done>Complete</done>
</task>

<task type="auto">
  <name>Second</name>
  <done></done>
</task>

<task type="auto">
  <name>Third</name>
  <done>Also done</done>
</task>
`;
    const tasks = extractTasks(content);

    expect(tasks).toHaveLength(3);
    expect(tasks[0].name).toBe('First');
    expect(tasks[1].name).toBe('Second');
    expect(tasks[2].name).toBe('Third');
  });

  it('parses checkpoint types correctly', () => {
    const content = `
<task type="checkpoint:human-verify">
  <name>Verify</name>
</task>
<task type="checkpoint:decision">
  <name>Decide</name>
</task>
<task type="checkpoint:human-action">
  <name>Manual Step</name>
</task>
`;
    const tasks = extractTasks(content);

    expect(tasks).toHaveLength(3);
    expect(tasks[0].type).toBe('checkpoint:human-verify');
    expect(tasks[1].type).toBe('checkpoint:decision');
    expect(tasks[2].type).toBe('checkpoint:human-action');
  });

  it('handles multiline file lists', () => {
    const content = `
<task type="auto">
  <name>Multi-file task</name>
  <files>
    src/a.ts
    src/b.ts
    src/c.ts
  </files>
</task>
`;
    const tasks = extractTasks(content);

    expect(tasks[0].files).toEqual(['src/a.ts', 'src/b.ts', 'src/c.ts']);
  });

  it('handles missing optional elements with defaults', () => {
    const content = `
<task type="auto">
  <name>Minimal task</name>
</task>
`;
    const tasks = extractTasks(content);

    expect(tasks[0].files).toEqual([]);
    expect(tasks[0].action).toBe('');
    expect(tasks[0].verify).toBe('');
    expect(tasks[0].done).toBe('');
    expect(tasks[0].status).toBe('pending');
  });

  it('returns empty array for content with no tasks', () => {
    const content = 'Just some regular markdown content.';
    const tasks = extractTasks(content);

    expect(tasks).toEqual([]);
  });
});

describe('normalizeTaskStatus', () => {
  it('returns complete when done has content', () => {
    const status = normalizeTaskStatus({ done: 'Task completed successfully' });
    expect(status).toBe('complete');
  });

  it('returns pending when done is empty string', () => {
    const status = normalizeTaskStatus({ done: '' });
    expect(status).toBe('pending');
  });

  it('returns pending when done is whitespace only', () => {
    const status = normalizeTaskStatus({ done: '   \n\t  ' });
    expect(status).toBe('pending');
  });

  it('returns complete for any non-whitespace content', () => {
    const status = normalizeTaskStatus({ done: 'x' });
    expect(status).toBe('complete');
  });

  const statusCases: [string, TaskStatus][] = [
    ['Implementation done', 'complete'],
    ['Complete', 'complete'],
    ['', 'pending'],
    ['  ', 'pending'],
  ];

  it.each(statusCases)('normalizeTaskStatus({ done: "%s" }) returns %s', (done, expected) => {
    expect(normalizeTaskStatus({ done })).toBe(expected);
  });
});
