# Phase 87: GSD File Synchronization - Research

**Researched:** 2026-02-15
**Domain:** Bidirectional file synchronization between markdown files and React UI state
**Confidence:** HIGH

## Summary

Phase 87 implements bidirectional synchronization between on-disk GSD markdown files (`.planning/` directory) and React UI state, allowing users to see live phase progress and update task status with changes persisted back to files. The technical challenge is bridging the browser environment's lack of direct filesystem access with the need for real-time file monitoring and updates.

The good news: Phase 85 already implemented the critical infrastructure. ClaudeCodeServer provides WebSocket-based file monitoring via chokidar (node-pty backend), and message routing infrastructure exists. Phase 87 extends this foundation to parse GSD markdown files, synchronize state bidirectionally, and handle concurrent edit conflicts.

**Primary recommendation:** Use existing WebSocket infrastructure from Phase 85, add gray-matter for markdown frontmatter parsing, implement optimistic updates with last-write-wins conflict resolution (defer CRDT/OT complexity), and use debounced file watching (400-500ms) to prevent update storms.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| chokidar | 5.x (ESM) | File watching on Node.js backend | Industry standard (30M+ repos), cross-platform, production-proven, built into Phase 85 ClaudeCodeServer |
| gray-matter | Latest | Markdown frontmatter parsing | Battle-tested (Gatsby, Astro, Netlify), TypeScript types included, handles YAML/JSON/TOML |
| ws | Existing | WebSocket server/client | Already integrated in Phase 85 for terminal communication |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| zod-matter | Latest | Type-safe frontmatter validation | If runtime validation needed (gray-matter has no validation) |
| remark-frontmatter | Latest | AST-based frontmatter parsing | If need to manipulate frontmatter programmatically (overkill for this phase) |
| fast-diff | Latest | Efficient text diffing | For showing what changed in conflict resolution UI |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| chokidar | fs.watch (native) | Native lacks cross-platform reliability, no debouncing, no ignored paths |
| gray-matter | front-matter | gray-matter more flexible (TOML/JSON support), better TypeScript types |
| Last-write-wins | CRDT/OT | CRDT/OT adds significant complexity for rare conflict case, defer to future phase |

**Installation:**
```bash
npm install gray-matter  # Add to Isometry package.json
# chokidar and ws already installed from Phase 85
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── services/
│   ├── gsd/
│   │   ├── gsdFileParser.ts      # gray-matter wrapper, parse PLAN.md frontmatter
│   │   ├── gsdFileWriter.ts      # Write updates back to PLAN.md files
│   │   ├── gsdFileSyncService.ts # Orchestrate file↔state sync
│   │   └── gsdConflictResolver.ts # Handle concurrent edits
│   ├── claude-code/
│   │   ├── claudeCodeServer.ts   # EXISTING - extend with GSD file routes
│   │   └── gsdService.ts         # EXISTING - SQLite-based GSD state
├── hooks/
│   ├── useGSDFileSync.ts         # React hook for component consumption
│   └── useGSDTaskToggle.ts       # Hook for task status updates
├── components/
│   └── shell/
│       ├── GSDProgressDisplay.tsx # Show phase/task progress
│       └── GSDConflictModal.tsx   # UI for resolving conflicts
```

### Pattern 1: WebSocket Message Flow (File → UI)
**What:** Backend file watcher detects change → parse file → send update via WebSocket → React updates state
**When to use:** User edits `.planning/` files externally (VS Code, Claude Code terminal)
**Example:**
```typescript
// Backend: claudeCodeServer.ts (extend existing file monitoring)
// Source: Phase 85 implementation, extend for GSD files
private async startGSDFileMonitoring(ws: WebSocket, sessionId: string): void {
  const planningPath = path.join(this.projectPath, '.planning');

  const watcher = chokidar.watch(planningPath, {
    ignored: /(^|[\/\\])\../, // Ignore dotfiles
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: {
      stabilityThreshold: 400, // Wait 400ms for write to finish
      pollInterval: 100
    }
  });

  watcher.on('change', async (filePath) => {
    if (!filePath.endsWith('.md')) return;

    const parsed = await this.parseGSDFile(filePath);
    ws.send(JSON.stringify({
      type: 'gsd_file_update',
      sessionId,
      filePath: path.relative(this.projectPath, filePath),
      data: parsed
    }));
  });

  this.fileWatchers.set(sessionId, watcher);
}

// Frontend: useGSDFileSync.ts
const { data, isLoading } = useQuery({
  queryKey: ['gsd-file-sync', sessionId],
  queryFn: async () => {
    // WebSocket connection established in useEffect
    return new Promise((resolve) => {
      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.type === 'gsd_file_update') {
          queryClient.setQueryData(['gsd-tasks', msg.filePath], msg.data);
        }
      };
    });
  }
});
```

### Pattern 2: Bidirectional Update (UI → File)
**What:** User toggles task checkbox in UI → optimistic update → send to backend → write to file → confirm
**When to use:** User interacts with GSD GUI task list
**Example:**
```typescript
// Source: Optimistic update pattern from TanStack Query best practices
const useGSDTaskToggle = (planPath: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ taskId, status }: { taskId: string; status: TaskStatus }) => {
      // Send to backend via WebSocket
      ws.send(JSON.stringify({
        type: 'gsd_task_update',
        planPath,
        taskId,
        status
      }));

      // Wait for confirmation
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Update timeout')), 5000);
        ws.once('gsd_task_updated', () => {
          clearTimeout(timeout);
          resolve();
        });
      });
    },

    // Optimistic update
    onMutate: async ({ taskId, status }) => {
      await queryClient.cancelQueries({ queryKey: ['gsd-tasks', planPath] });
      const previous = queryClient.getQueryData(['gsd-tasks', planPath]);

      queryClient.setQueryData(['gsd-tasks', planPath], (old: Task[]) =>
        old.map(task => task.id === taskId ? { ...task, status } : task)
      );

      return { previous };
    },

    // Rollback on error
    onError: (err, variables, context) => {
      queryClient.setQueryData(['gsd-tasks', planPath], context.previous);
    },

    // Refetch on success
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['gsd-tasks', planPath] });
    }
  });
};
```

### Pattern 3: Conflict Resolution (Last-Write-Wins)
**What:** Detect concurrent edits, show diff to user, let user choose which version to keep
**When to use:** File modified externally while user has unsaved UI changes
**Example:**
```typescript
// Source: Standard conflict resolution pattern
interface ConflictData {
  filePath: string;
  fileVersion: ParsedGSDFile;  // What's on disk
  uiVersion: ParsedGSDFile;    // What user sees in UI
  timestamp: Date;
}

const GSDConflictModal: React.FC<{ conflict: ConflictData }> = ({ conflict }) => {
  const handleResolve = (choice: 'file' | 'ui' | 'merge') => {
    switch (choice) {
      case 'file':
        // Discard UI changes, reload from file
        queryClient.setQueryData(['gsd-tasks', conflict.filePath], conflict.fileVersion);
        break;
      case 'ui':
        // Keep UI version, overwrite file
        ws.send({ type: 'gsd_force_write', filePath: conflict.filePath, data: conflict.uiVersion });
        break;
      case 'merge':
        // Manual merge (future enhancement - defer to Phase 88)
        showMergeEditor(conflict);
        break;
    }
  };

  return (
    <Dialog>
      <h2>Conflict Detected: {conflict.filePath}</h2>
      <div className="diff-viewer">
        <DiffView
          before={conflict.fileVersion}
          after={conflict.uiVersion}
        />
      </div>
      <button onClick={() => handleResolve('file')}>Keep File Version</button>
      <button onClick={() => handleResolve('ui')}>Keep UI Version</button>
    </Dialog>
  );
};
```

### Anti-Patterns to Avoid
- **Polling instead of file watching:** Wastes resources, adds latency, misses rapid changes
- **No debouncing:** Editor atomic saves trigger 3-4 events per save, causes update storm
- **Synchronous file I/O:** Blocks event loop, use `fs/promises` exclusively
- **Ignoring write completion:** Read file before editor finishes writing, get truncated data (use chokidar `awaitWriteFinish`)
- **Direct DOM manipulation:** React state is source of truth, use controlled components

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Markdown frontmatter parsing | Regex-based parser | gray-matter | Edge cases (escaped delimiters, nested YAML, TOML support), battle-tested in 30M+ repos |
| File watching | Custom fs.watch wrapper | chokidar | Cross-platform quirks (macOS FSEvents, Linux inotify, Windows ReadDirectoryChangesW), atomic save detection |
| Text diffing | Character-by-character loop | fast-diff or diff-match-patch | Performance (O(n²) naive vs O(nd) Myers), handles large files |
| WebSocket reconnection | Manual retry logic | Existing ClaudeCodeServer pattern from Phase 85 | Exponential backoff, heartbeat, connection state management |
| Conflict resolution (CRDT) | Custom operational transform | Defer to Phase 88 or future | Complexity explosion (vector clocks, causal ordering, tombstones) |

**Key insight:** GSD files are small (typically <50 tasks per PLAN.md), human-edited (not rapid concurrent changes), and local-first (single user). Last-write-wins with conflict UI is sufficient. CRDT/OT solves problems this phase doesn't have.

## Common Pitfalls

### Pitfall 1: Race Condition Between File Write and Read
**What goes wrong:** Backend writes file → watcher triggers immediately → read starts before write completes → read gets partial file
**Why it happens:** Many editors (VS Code, Vim) use atomic save (write to temp file, rename), which triggers multiple filesystem events
**How to avoid:** Use chokidar's `awaitWriteFinish` option with 400ms stabilityThreshold
**Warning signs:** Parsing errors on valid markdown, truncated frontmatter, intermittent failures

### Pitfall 2: Update Loop (UI → File → Watcher → UI)
**What goes wrong:** User clicks checkbox → write to file → watcher detects change → sends update to UI → triggers another write → infinite loop
**Why it happens:** No mechanism to distinguish "file changed by UI" vs "file changed externally"
**How to avoid:** Add `skipWatch` flag to backend write operations, include version/timestamp in messages, debounce UI updates
**Warning signs:** CPU spike on single checkbox toggle, WebSocket message storm, file modification times changing rapidly

### Pitfall 3: Stale File Handle After Editor Atomic Save
**What goes wrong:** Editor saves file (write temp, rename) → original file inode changes → watcher still watching old inode → misses updates
**Why it happens:** Some filesystem watchers track inode numbers, not paths
**How to avoid:** chokidar v5 handles this automatically by watching paths, not inodes
**Warning signs:** First save detected, subsequent saves ignored until app restart

### Pitfall 4: Markdown Checkbox Syntax Ambiguity
**What goes wrong:** Task status stored as `- [ ]` (unchecked) / `- [x]` (checked) in markdown, but different tools use `[X]`, `[✓]`, `[*]` variants
**Why it happens:** No formal markdown task list specification until GitHub Flavored Markdown standardized `[ ]` and `[x]`
**How to avoid:** Normalize to GFM syntax on parse, reject non-standard variants with clear error
**Warning signs:** Tasks appearing as unchecked in UI despite being marked complete in file

### Pitfall 5: Frontmatter Array vs String Ambiguity
**What goes wrong:** YAML frontmatter allows both `files_modified: src/foo.ts` (string) and `files_modified: [src/foo.ts]` (array) → type errors
**Why it happens:** YAML parser treats single-element array and scalar as same type in some contexts
**How to avoid:** Use zod-matter or manual validation to enforce array types, normalize on parse
**Warning signs:** `files_modified.map is not a function` errors, TypeScript type errors despite correct markdown

## Code Examples

Verified patterns from official sources and Phase 85 implementation:

### Parse GSD PLAN.md File with Frontmatter
```typescript
// Source: gray-matter official docs + GSD PLAN.md structure
import matter from 'gray-matter';
import { readFile } from 'fs/promises';

interface PlanFrontmatter {
  phase: string;
  plan: string;
  type: 'execute' | 'research';
  wave: number;
  depends_on: string[];
  files_modified: string[];
  autonomous: boolean;
}

interface TaskItem {
  name: string;
  type: 'auto' | 'manual';
  files: string[];
  status: 'pending' | 'in_progress' | 'complete';
  doneText?: string;
}

async function parseGSDPlan(filePath: string): Promise<{
  frontmatter: PlanFrontmatter;
  tasks: TaskItem[];
  rawContent: string;
}> {
  const fileContent = await readFile(filePath, 'utf-8');
  const { data, content } = matter(fileContent);

  // Parse task blocks from markdown content
  const tasks: TaskItem[] = [];
  const taskRegex = /<task type="(auto|manual)">([\s\S]*?)<\/task>/g;
  let match;

  while ((match = taskRegex.exec(content)) !== null) {
    const taskType = match[1] as 'auto' | 'manual';
    const taskContent = match[2];

    const nameMatch = /<name>(.*?)<\/name>/.exec(taskContent);
    const filesMatch = /<files>([\s\S]*?)<\/files>/.exec(taskContent);
    const doneMatch = /<done>([\s\S]*?)<\/done>/.exec(taskContent);

    tasks.push({
      name: nameMatch?.[1] || 'Unnamed task',
      type: taskType,
      files: filesMatch?.[1].split('\n').map(f => f.trim()).filter(Boolean) || [],
      status: doneMatch ? 'complete' : 'pending',
      doneText: doneMatch?.[1]
    });
  }

  return {
    frontmatter: data as PlanFrontmatter,
    tasks,
    rawContent: content
  };
}
```

### Write Task Status Update Back to File
```typescript
// Source: Atomic write pattern from Node.js best practices
import { writeFile } from 'fs/promises';
import { stringify } from 'gray-matter';

async function updateTaskStatus(
  filePath: string,
  taskIndex: number,
  newStatus: 'pending' | 'in_progress' | 'complete'
): Promise<void> {
  const parsed = await parseGSDPlan(filePath);

  // Update the specific task
  if (taskIndex < 0 || taskIndex >= parsed.tasks.length) {
    throw new Error(`Task index ${taskIndex} out of bounds`);
  }

  parsed.tasks[taskIndex].status = newStatus;

  // Reconstruct markdown with updated task status
  let updatedContent = parsed.rawContent;
  let taskCount = 0;

  updatedContent = updatedContent.replace(
    /<task type="(auto|manual)">([\s\S]*?)<\/task>/g,
    (match, type, content) => {
      if (taskCount === taskIndex) {
        // Update this task
        const task = parsed.tasks[taskCount];
        if (task.status === 'complete' && !content.includes('<done>')) {
          // Add <done> section
          content += `\n  <done>\n${task.doneText || 'Task completed'}\n  </done>\n`;
        }
      }
      taskCount++;
      return `<task type="${type}">${content}</task>`;
    }
  );

  // Write atomically (write to temp, rename)
  const tempPath = `${filePath}.tmp`;
  const fullContent = stringify(updatedContent, parsed.frontmatter);

  await writeFile(tempPath, fullContent, 'utf-8');
  await writeFile(filePath, fullContent, 'utf-8'); // Overwrite original
}
```

### Detect and Show File Conflicts
```typescript
// Source: Git-style conflict detection pattern
import { diff } from 'fast-diff';

interface ConflictDetection {
  hasConflict: boolean;
  conflictingSections: Array<{
    field: string;
    fileValue: unknown;
    uiValue: unknown;
    diffText?: string;
  }>;
}

function detectConflict(
  fileVersion: ParsedGSDFile,
  uiVersion: ParsedGSDFile,
  lastSyncTimestamp: number
): ConflictDetection {
  const conflicts: ConflictDetection['conflictingSections'] = [];

  // Compare task statuses
  fileVersion.tasks.forEach((fileTask, i) => {
    const uiTask = uiVersion.tasks[i];
    if (fileTask.status !== uiTask.status) {
      conflicts.push({
        field: `tasks[${i}].status`,
        fileValue: fileTask.status,
        uiValue: uiTask.status
      });
    }
  });

  // Compare frontmatter
  if (fileVersion.frontmatter.wave !== uiVersion.frontmatter.wave) {
    conflicts.push({
      field: 'wave',
      fileValue: fileVersion.frontmatter.wave,
      uiValue: uiVersion.frontmatter.wave
    });
  }

  return {
    hasConflict: conflicts.length > 0,
    conflictingSections: conflicts
  };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Polling filesystem every N seconds | chokidar event-based watching | chokidar v1 (2014) | <50ms latency vs seconds, no wasted CPU |
| Regex markdown parsing | gray-matter AST parsing | 2015+ | Handles edge cases (escaped delimiters, nested YAML) |
| Manual conflict resolution | CRDT-based auto-merge | 2020+ (Figma, Linear) | Zero conflicts, but complex for single-user local app |
| fs.watch (native Node.js) | chokidar v5 (ESM, 2025) | 2025 | Node v20+, modern ESM, better cross-platform |

**Deprecated/outdated:**
- fs.watchFile (polling-based): Replaced by fs.watch → chokidar (2014+)
- front-matter package: Less flexible than gray-matter, no TOML support
- Operational Transformation for markdown: CRDT is newer approach (2020+), but both are overkill for Phase 87

## Open Questions

1. **Should we support manual task reordering in the UI?**
   - What we know: Tasks are numbered sequentially in PLAN.md files (`<task>` blocks)
   - What's unclear: If user drags task 2 above task 1 in UI, should we renumber in file?
   - Recommendation: Defer to Phase 88. For Phase 87, read-only order (matches file) is sufficient.

2. **How to handle PLAN.md files created by Claude Code during phase execution?**
   - What we know: Claude Code creates PLAN files on-the-fly during `/gsd:plan-phase`
   - What's unclear: Should we sync these mid-creation or wait for completion?
   - Recommendation: Watch for file creation events, but only parse when file contains closing `</tasks>` tag (indicates complete).

3. **Should phase progress percentages be calculated client-side or server-side?**
   - What we know: Need to show "3/5 tasks complete" in UI
   - What's unclear: Parse file on every render vs cache in SQLite (gsdService.ts)
   - Recommendation: Hybrid - parse on file change, cache in React Query, invalidate on WebSocket update.

## Sources

### Primary (HIGH confidence)
- chokidar v5 documentation: [GitHub - paulmillr/chokidar](https://github.com/paulmillr/chokidar)
- gray-matter documentation: [GitHub - jonschlinkert/gray-matter](https://github.com/jonschlinkert/gray-matter)
- Phase 85 ClaudeCodeServer implementation: `src/services/claude-code/claudeCodeServer.ts`
- Phase 85 file monitoring pattern: Lines 124-133 in claudeCodeServer.ts (already implements chokidar watching)

### Secondary (MEDIUM confidence)
- Chokidar best practices 2026: [How to Watch File Changes in Node.js](https://oneuptime.com/blog/post/2026-01-22-nodejs-watch-file-changes/view)
- WebSocket complete guide 2026: [WebSockets: The Complete Guide for 2026](https://devtoolbox.dedyn.io/blog/websocket-complete-guide)
- React Query optimistic updates: TanStack Query official docs (accessed 2026-02-15)

### Tertiary (LOW confidence)
- CRDT vs OT comparison: [Building real-time collaboration applications: OT vs CRDT](https://www.tiny.cloud/blog/real-time-collaboration-ot-vs-crdt/)
- Markdown Hijacker bidirectional sync: [Markdown Hijacker - Beyond the Vault](https://www.obsidianstats.com/plugins/markdown-hijacker) (Obsidian plugin, different architecture but similar problem space)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - chokidar and gray-matter are industry standard, Phase 85 already uses chokidar
- Architecture: HIGH - Extends existing Phase 85 WebSocket infrastructure, verified patterns
- Pitfalls: MEDIUM - Based on general Node.js file watching experience, not GSD-specific testing
- Conflict resolution: MEDIUM - Last-write-wins is well-understood, but CRDT comparison is conceptual

**Research date:** 2026-02-15
**Valid until:** 2026-03-15 (30 days - stable technologies, unlikely to change rapidly)
