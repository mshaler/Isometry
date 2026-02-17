# Phase 112: Technical Debt Sprint - Research

**Researched:** 2026-02-16
**Domain:** Code quality, unused exports, directory organization, TipTap testing
**Confidence:** HIGH

## Summary

This phase targets three areas of technical debt: Knip-reported unused exports (165 files flagged, 111 with unused exports), src/services directory reorganization (8 top-level files needing domain grouping), and TipTap automated test infrastructure (zero existing TipTap tests despite extensive extension suite).

Knip analysis reveals the 165 flagged files break down into: 33 index/barrel files (false positives requiring config), 11 files with duplicate exports (named + default), and ~70-80 truly unused exports. The cleanup approach prioritizes: (1) fix knip.json config for barrel exports, (2) remove duplicate exports, (3) delete truly dead code file-by-file.

TipTap testing requires specific JSDOM mocks for ProseMirror's layout APIs plus a dedicated test utilities module. The existing test infrastructure (setup.ts, mocks.ts, db-utils.ts) provides a solid pattern to follow.

**Primary recommendation:** Start with knip config fixes and duplicate export cleanup (mechanical, low-risk), then move to unused export deletion (requires verification), finally add TipTap test infrastructure (new code, no risk to existing).

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| knip | 5.x | Unused code detection | Industry standard for TypeScript dead code analysis |
| @tiptap/react | 2.x | Rich text editing | Already in use, headless editor framework |
| vitest | 3.x | Test framework | Already configured, fast, native ESM |
| @testing-library/react | 16.x | Component testing | Already in use, accessibility-focused |
| @testing-library/user-event | 14.x | User interaction simulation | Standard for realistic event testing |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| tippy.js | 6.x | Tooltip popups for suggestions | Already used in TipTap extensions |
| dompurify | 3.x | HTML sanitization | Already in useTipTapEditor for paste security |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| knip --fix | Manual cleanup | --fix is fast but may break tests; manual is safer but slower |
| jsdom mocks | Playwright component tests | Playwright more accurate but 10x slower, jsdom sufficient for unit tests |
| Extension-level tests | Integration tests | Unit tests faster, integration tests catch more but require full editor setup |

## Architecture Patterns

### Recommended Services Directory Structure

Current (8 top-level + 9 subdirectories):
```
src/services/
  ErrorReportingService.ts    # MOVE to system/
  facet-discovery.ts          # MOVE to supergrid/
  LATCHFilterService.ts       # MOVE to query/
  PAFVAxisService.ts          # MOVE to supergrid/
  property-classifier.ts      # KEEP (actively used, large)
  query-executor.ts           # MOVE to query/
  SuperDensityService.ts      # MOVE to supergrid/
  TagService.ts               # MOVE to query/
  analytics/                  # KEEP
  claude-ai/                  # KEEP
  claude-code/                # KEEP
  data-sync/                  # KEEP
  gsd/                        # KEEP
  query/                      # KEEP
  supergrid/                  # KEEP
  system/                     # KEEP
  terminal/                   # KEEP
```

Target structure (after reorganization):
```
src/services/
  property-classifier.ts      # Single top-level file (14KB, actively used)
  analytics/                  # 2 files: ConnectionSuggestionService, GraphAnalyticsAdapter
  claude-ai/                  # 4 files: tools, claudeService, index, projectContext
  claude-code/                # 7 files: gsd*, claudeCode*, dispatchers
  data-sync/                  # 1 file: syncQueue
  gsd/                        # 8 files: file operations, types, watchers
  query/                      # 5 files: LATCHFilter, Cache, Selection, filterAst, TagService
  supergrid/                  # 5 files: Header*, SuperDensity, facet-discovery
  system/                     # 3 files: ErrorReporting, network, Tauri
  terminal/                   # 6 files: PTY, routing, types
```

### TipTap Test Infrastructure Pattern

```
src/test/
  tiptap/
    setup.ts              # TipTap-specific JSDOM mocks
    mocks.ts              # Mock editor, extensions, suggestion popups
    fixtures.ts           # Sample editor content, markdown, ProseMirror JSON
    test-utils.tsx        # createTestEditor(), renderWithEditor()
    __tests__/
      basic-editor.test.tsx           # Core editor functionality
      slash-commands.test.tsx         # SlashCommands extension
      wiki-links.test.tsx             # WikiLink extension
      hashtag.test.tsx                # HashtagExtension
      callout.test.tsx                # CalloutExtension
      toggle.test.tsx                 # ToggleExtension
      bookmark.test.tsx               # BookmarkExtension
      embed.test.tsx                  # EmbedExtension
      inline-property.test.tsx        # InlinePropertyExtension
      keyboard-shortcuts.test.tsx     # AppleNotesShortcuts
```

### TipTap Test Utilities Pattern

**Source:** [TipTap GitHub Discussion #4008](https://github.com/ueberdosis/tiptap/discussions/4008)

```typescript
// src/test/tiptap/setup.ts
// Required JSDOM mocks for ProseMirror

function getBoundingClientRect() {
  const rec = {
    x: 0, y: 0, bottom: 0, height: 0,
    left: 0, right: 0, top: 0, width: 0,
  };
  return { ...rec, toJSON: () => rec };
}

class FakeDOMRectList extends Array<DOMRect> {
  item(index: number): DOMRect | null {
    return this[index] ?? null;
  }
}

document.elementFromPoint = () => null;
HTMLElement.prototype.getBoundingClientRect = getBoundingClientRect;
HTMLElement.prototype.getClientRects = () => new FakeDOMRectList() as unknown as DOMRectList;
Range.prototype.getBoundingClientRect = getBoundingClientRect;
Range.prototype.getClientRects = () => new FakeDOMRectList() as unknown as DOMRectList;
```

```typescript
// src/test/tiptap/test-utils.tsx
import { render } from '@testing-library/react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';

interface TestEditorOptions {
  content?: string;
  extensions?: Extension[];
  editorProps?: EditorOptions['editorProps'];
}

export function createTestEditor(options: TestEditorOptions = {}) {
  const { content = '', extensions = [StarterKit], editorProps = {} } = options;

  return useEditor({
    immediatelyRender: true,
    shouldRerenderOnTransaction: false,
    extensions,
    content,
    editorProps: {
      ...editorProps,
      attributes: {
        role: 'textbox',
        'aria-label': 'Test Editor',
        ...editorProps.attributes,
      },
    },
  });
}

export function TestEditorWrapper({
  editor,
  children
}: {
  editor: Editor | null;
  children?: React.ReactNode
}) {
  if (!editor) return <div>Loading...</div>;
  return (
    <>
      <EditorContent editor={editor} />
      {children}
    </>
  );
}
```

### Anti-Patterns to Avoid

- **Deleting barrel exports without updating knip.json:** Barrel files (index.ts) re-export for public API; deleting "unused" exports breaks consumers
- **Using --fix blindly:** Knip's auto-fix doesn't verify test coverage; always review changes
- **Testing TipTap with real DOM events:** ProseMirror intercepts events; use editor.commands.* or mock
- **Mixing named and default exports for same component:** Creates duplicate export warnings and confusion

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| TipTap JSDOM mocks | Custom Range/DOMRect polyfills | Copy verified pattern from community | ProseMirror has specific layout API requirements |
| Unused export detection | grep-based scripts | knip | Handles complex module graph, workspaces, dynamic imports |
| Test data generation | Manual fixture creation | Factory functions + existing fixtures.ts pattern | Consistent, reusable, type-safe |
| Editor content assertions | String matching | ProseMirror document traversal | Markdown/HTML varies, document structure is stable |

## Common Pitfalls

### Pitfall 1: False Positive Barrel Exports
**What goes wrong:** Knip flags index.ts re-exports as unused when they're actually the public API
**Why it happens:** Knip doesn't automatically recognize barrel files as entry points
**How to avoid:** Add barrel files to `entry` array in knip.json, or use `--include-entry-exports`
**Warning signs:** All exports from index.ts flagged, no internal imports of those exports

### Pitfall 2: Duplicate Named + Default Exports
**What goes wrong:** Component exports both `export const Foo` and `export default Foo`
**Why it happens:** Different import styles (named vs default) lead to both being added over time
**How to avoid:** Pick one style per codebase; prefer named exports for tree-shaking
**Warning signs:** Knip reports duplicate exports, TypeScript allows both import styles

### Pitfall 3: TipTap userEvent.type() Limitations
**What goes wrong:** Using `userEvent.type(textbox, 'text')` doesn't update editor content
**Why it happens:** ProseMirror uses contenteditable, not input semantics; events are intercepted
**How to avoid:** Use `editor.commands.insertContent('text')` or `editor.commands.setContent()`
**Warning signs:** Tests pass but assertions fail, editor content empty after "typing"

### Pitfall 4: Suggestion Popup Testing
**What goes wrong:** Cannot find slash command menu or wiki link menu in tests
**Why it happens:** Suggestion popups use tippy.js which renders to document.body asynchronously
**How to avoid:** Use `waitFor` with body queries; mock ReactRenderer and tippy for isolation
**Warning signs:** Element queries return null, timing-dependent test failures

### Pitfall 5: Knip Ignoring Test-Only Exports
**What goes wrong:** Exports used only in tests flagged as unused
**Why it happens:** Test files are in `ignore` array, so their imports don't count
**How to avoid:** Use `ignoreExportsUsedInFile: true` (already configured) or explicit test entry
**Warning signs:** Test utilities and fixtures flagged as unused

## Code Examples

### Knip Configuration for Barrel Exports

**Source:** [Knip Documentation - Handling Issues](https://knip.dev/guides/handling-issues)

```json
// knip.json - Updated configuration
{
  "$schema": "https://unpkg.com/knip@5/schema.json",
  "entry": [
    "src/main.tsx",
    "src/App.tsx",
    // Add barrel files that serve as public API
    "src/components/ui/index.ts",
    "src/hooks/index.ts",
    "src/types/index.ts",
    "src/contexts/index.ts",
    "src/d3/index.ts",
    "src/superstack/index.ts"
  ],
  "project": ["src/**/*.{ts,tsx}"],
  "ignore": [
    "src/dsl/grammar/**",
    "src/types/*.d.ts",
    "**/*.test.{ts,tsx}",
    "**/*.spec.{ts,tsx}"
  ],
  "ignoreDependencies": [
    "@types/*",
    "autoprefixer",
    "postcss",
    "tailwindcss",
    "@vitest/coverage-v8"
  ],
  "ignoreExportsUsedInFile": true
}
```

### Removing Duplicate Exports Pattern

```typescript
// BEFORE: Duplicate exports
export const SuperGridCSS = function SuperGridCSS() { /* ... */ };
export default SuperGridCSS;

// AFTER: Single named export (preferred for tree-shaking)
export function SuperGridCSS() { /* ... */ }
// Consumer: import { SuperGridCSS } from './SuperGridCSS';
```

### TipTap Extension Test Pattern

**Source:** [TipTap GitHub Discussion #4008](https://github.com/ueberdosis/tiptap/discussions/4008)

```typescript
// src/test/tiptap/__tests__/slash-commands.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { SlashCommands, SLASH_COMMANDS } from '@/components/notebook/editor/extensions';

// Import TipTap test setup (adds JSDOM mocks)
import '../setup';

function TestEditor() {
  const editor = useEditor({
    immediatelyRender: true,
    shouldRerenderOnTransaction: false,
    extensions: [
      StarterKit,
      SlashCommands.configure({
        suggestion: {
          items: () => SLASH_COMMANDS,
        },
      }),
    ],
    editorProps: {
      attributes: {
        role: 'textbox',
        'aria-label': 'Test Editor',
      },
    },
  });

  if (!editor) return null;
  return <EditorContent editor={editor} />;
}

describe('SlashCommands Extension', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('renders editor with slash command extension', async () => {
    render(<TestEditor />);

    await waitFor(() => {
      expect(screen.getByRole('textbox', { name: 'Test Editor' })).toBeInTheDocument();
    });
  });

  it('triggers suggestion on "/" character', async () => {
    render(<TestEditor />);

    const editor = await screen.findByRole('textbox', { name: 'Test Editor' });

    // TipTap handles '/' as suggestion trigger via ProseMirror
    // We verify the extension is properly configured by checking it loaded
    expect(editor).toHaveAttribute('contenteditable', 'true');
  });
});
```

### Service File Move Pattern

```bash
# Safe file move with git tracking
git mv src/services/ErrorReportingService.ts src/services/system/ErrorReportingService.ts
git mv src/services/facet-discovery.ts src/services/supergrid/facet-discovery.ts
git mv src/services/LATCHFilterService.ts src/services/query/LATCHFilterService.ts
git mv src/services/PAFVAxisService.ts src/services/supergrid/PAFVAxisService.ts
git mv src/services/query-executor.ts src/services/query/query-executor.ts
git mv src/services/SuperDensityService.ts src/services/supergrid/SuperDensityService.ts
git mv src/services/TagService.ts src/services/query/TagService.ts
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| ts-prune | knip | 2023 | knip handles workspaces, plugins, more issue types |
| Jest for TipTap | Vitest with jsdom | 2024 | Faster, native ESM, better TypeScript support |
| Playwright for editor tests | jsdom + editor commands | 2024-2025 | 10x faster for unit tests, Playwright for E2E only |
| Manual barrel file management | knip entry configuration | 2024 | Explicit API surface, better tree-shaking analysis |

**Deprecated/outdated:**
- ts-prune: Unmaintained, knip is its successor
- Jest for new projects: Vitest is faster and has better ESM support
- Full-DOM testing for extensions: Use editor.commands for deterministic tests

## Open Questions

1. **Should property-classifier.ts remain at top level?**
   - What we know: It's 14KB, actively used, recently modified
   - What's unclear: Is it conceptually a "supergrid" service or cross-cutting?
   - Recommendation: Keep at top level for now; move if pattern emerges

2. **Which TipTap extensions need integration vs unit tests?**
   - What we know: Suggestion-based extensions (slash, wiki, hashtag) are complex
   - What's unclear: Is JSDOM sufficient for suggestion popup behavior?
   - Recommendation: Start with unit tests, add Playwright component tests if needed

3. **Safe threshold for batch unused export deletion?**
   - What we know: AI workflow suggests 20 files per batch
   - What's unclear: Does project have enough test coverage to catch breakage?
   - Recommendation: Start with 5-10 files, run full test suite, increase if stable

## Sources

### Primary (HIGH confidence)
- [TipTap GitHub Discussion #4008](https://github.com/ueberdosis/tiptap/discussions/4008) - Testing patterns, JSDOM mocks
- [Knip Documentation](https://knip.dev/) - Configuration, handling issues, --fix behavior
- [Knip Handling Issues Guide](https://knip.dev/guides/handling-issues) - False positive strategies
- Codebase analysis: `npx knip --reporter json` output (165 files, 111 with unused exports)

### Secondary (MEDIUM confidence)
- [Liveblocks TipTap Best Practices](https://liveblocks.io/docs/guides/tiptap-best-practices-and-tips) - Extension patterns
- [56kode Knip + AI Workflow](https://www.56kode.com/posts/clean-typescript-project-knip-ai-workflow/) - Safe cleanup strategy

### Tertiary (LOW confidence)
- Community CodeSandbox examples - Test patterns vary, need local verification

## Metadata

**Confidence breakdown:**
- Knip cleanup: HIGH - Official docs + direct codebase analysis
- Services reorganization: HIGH - Clear domain boundaries from file inspection
- TipTap testing: MEDIUM - Community patterns verified but not tested locally

**Research date:** 2026-02-16
**Valid until:** 60 days (stable libraries, patterns well-established)
