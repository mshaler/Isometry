# Phase 57: Notebook Explorer + Polish - Research

**Researched:** 2026-03-08
**Domain:** Markdown rendering, HTML sanitization, workbench UI polish
**Confidence:** HIGH

## Summary

Phase 57 delivers NotebookExplorer v1 with a tabbed Write/Preview layout inside the existing WorkbenchShell Notebook CollapsibleSection, plus a full visual polish pass across all workbench explorer panels. The two new npm dependencies are `marked` (Markdown-to-HTML parser) and `dompurify` (XSS sanitizer). Both are mature, well-typed, small libraries with zero sub-dependencies relevant to this use case.

The implementation follows the exact mount/update/destroy lifecycle pattern established by LatchExplorers, VisualExplorer, and PropertiesExplorer. The textarea editor stores content in a class field (session-only -- no database writes, no localStorage). Markdown keyboard shortcuts (Cmd+B, Cmd+I, Cmd+K) must be handled via a local textarea keydown handler because ShortcutRegistry's input field guard skips INPUT and TEXTAREA elements by design.

The polish pass is a CSS/DOM audit across all 5 explorer panels (Properties, Projection, Visual, LATCH, Notebook) covering spacing token consistency, keyboard accessibility (tab order, focus indicators, ARIA), transition smoothness, empty/loading states, and dual-theme verification. No new infrastructure needed -- only CSS adjustments and ARIA attribute additions.

**Primary recommendation:** Use `marked` v17+ with default GFM enabled + `dompurify` v3.3+ with explicit ALLOWED_TAGS/ALLOWED_ATTR allowlist. Notebook keyboard shortcuts handled via textarea-local keydown (not ShortcutRegistry).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Tabbed toggle (Write | Preview) -- NOT side-by-side or stacked
- Segmented control at top of notebook body: two pill-shaped buttons with accent background on active tab
- Fixed min-height (~150-200px) for the notebook body; no drag-to-resize handle
- Simple tab switch only -- clicking Preview shows preview, clicking Write shows editor; no click-to-edit in preview
- Manual tab switch only -- no auto-preview on idle
- Notebook section defaults to collapsed on first launch
- No resize capability -- tabbed toggle makes resize unnecessary
- Plain `<textarea>` -- no contenteditable, no WYSIWYG in v1
- Placeholder text: "Write Markdown..."
- Tab key moves focus to next element (standard browser behavior, no keyboard trap)
- System font (NOT monospace) -- matches the rest of the app
- Content persists in textarea across tab switches (state maintained in memory)
- Markdown keyboard shortcuts: Cmd+B (bold), Cmd+I (italic), Cmd+K (link) -- wraps selected text in Markdown syntax
- GFM (GitHub Flavored Markdown) -- tables, task lists, strikethrough, autolinks
- Rendered via marked + DOMPurify with strict allowlist (XSS prevention in WKWebView context)
- Preview styling uses app design tokens (--text-*, --bg-*, --accent) -- feels native to Isometry
- Code blocks: monospace background only, no syntax highlighting (deferred to NOTB-03)
- .notebook-chart-preview container: exists in DOM but display:none (hidden, reserved for future D3 charts)
- Session-only -- no writes to IsometryDatabase
- Content clears on page refresh or app restart (NOTE-04)
- Full workbench polish pass across ALL explorer panels (not just Notebook)
- Four polish areas: spacing/typography, keyboard accessibility, transitions, empty/loading states
- Both light AND dark themes verified for all explorer panels
- Panel rail scroll behavior: verify existing 40vh cap + overflow-y:auto works correctly with Notebook added

### Claude's Discretion
- Exact min-height value for notebook body
- DOMPurify allowlist specifics (as long as XSS is blocked)
- Segmented control exact styling within token system
- Polish pass severity threshold for what counts as "blocking"

### Deferred Ideas (OUT OF SCOPE)
- Full WYSIWYG editor with Obsidian-like inline editing and Apple Notes keyboard shortcuts
- Formatting toolbar (NOTB-01)
- D3 chart block rendering from bar schema (NOTB-02)
- Code syntax highlighting (NOTB-03)
- Notebook persistence to IsometryDatabase (NPRST-01)
- Word count / character count in editor
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| NOTE-01 | NotebookExplorer v1 with resizable two-pane layout (textarea editor + sanitized HTML preview) | CONTEXT.md specifies tabbed toggle (not resizable side-by-side). marked + DOMPurify stack. Mount/destroy lifecycle matches LatchExplorers pattern. |
| NOTE-02 | Markdown rendered via marked + DOMPurify with strict allowlist preventing XSS in WKWebView context | marked v17+ has GFM enabled by default. DOMPurify v3.3+ with ALLOWED_TAGS/ALLOWED_ATTR config. Blocks script, event handlers, javascript: URIs automatically. |
| NOTE-03 | D3 chart preview stub container (.notebook-chart-preview) reserved for future use | Single div with display:none in CSS. No logic needed -- pure DOM placeholder. |
| NOTE-04 | Session-only persistence -- no writes to IsometryDatabase | Content stored in class field string. No localStorage, no bridge.send, no database interaction. Clears on page refresh. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| marked | ^17.0.0 | Markdown-to-HTML parser | 11K+ npm dependents, GFM enabled by default, zero dependencies, ESM native, ~35KB minified |
| dompurify | ^3.3.0 | HTML sanitizer (XSS prevention) | Industry standard from cure53 security firm, 3.7K+ dependents, DOM-only (no regex), ~15KB gzipped |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @types/dompurify | latest | TypeScript type definitions | DOMPurify ships types in repo but @types package may be needed for strict TS |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| marked | markdown-it | markdown-it has more plugins but is heavier; marked is faster and simpler for GFM-only |
| marked | remark/unified | Full AST pipeline is overkill for simple parse-to-HTML; adds 5+ dependencies |
| dompurify | sanitize-html | sanitize-html is larger and regex-based; DOMPurify uses browser's own parser (safer) |

**Installation:**
```bash
npm install marked dompurify
npm install --save-dev @types/dompurify
```

Note: Check if marked v17 ships its own types (likely yes given TypeScript folder in repo). If so, @types/marked is not needed. DOMPurify may also ship types -- verify after install.

## Architecture Patterns

### Recommended Project Structure
```
src/
├── ui/
│   └── NotebookExplorer.ts    # New: NotebookExplorer class
├── styles/
│   └── notebook-explorer.css  # New: Notebook-specific CSS
```

### Pattern 1: Explorer Lifecycle (mount/update/destroy)
**What:** Every explorer follows the same lifecycle contract: constructor receives config, mount(container) creates DOM, update() refreshes content, destroy() removes DOM and unsubscribes.
**When to use:** All workbench explorers.
**Example (from LatchExplorers):**
```typescript
export class NotebookExplorer {
  private _rootEl: HTMLElement | null = null;
  private _content: string = ''; // Session-only state

  constructor(/* no providers needed -- session only */) {}

  mount(container: HTMLElement): void {
    // Create .notebook-explorer root
    // Create segmented control (Write | Preview tabs)
    // Create textarea for Write mode
    // Create preview div for Preview mode
    // Create .notebook-chart-preview (display:none)
    container.appendChild(this._rootEl!);
  }

  destroy(): void {
    // Remove keydown listener from textarea
    this._rootEl?.remove();
    this._rootEl = null;
  }
}
```

### Pattern 2: Tabbed Toggle (Segmented Control)
**What:** Two pill-shaped buttons at top of notebook body. Active tab gets accent background. Clicking toggles between Write view (textarea visible) and Preview view (rendered HTML visible).
**When to use:** NotebookExplorer tab switching.
**Example:**
```typescript
private _activeTab: 'write' | 'preview' = 'write';

private _switchTab(tab: 'write' | 'preview'): void {
  this._activeTab = tab;
  // Toggle display of textarea vs preview div
  // Update segmented control active state
  // If switching to preview: render markdown -> sanitize -> set innerHTML
}
```

### Pattern 3: Textarea-Local Keyboard Shortcuts
**What:** Cmd+B/I/K handled via keydown listener on the textarea element itself (NOT via ShortcutRegistry). ShortcutRegistry's input field guard (line 60 of ShortcutRegistry.ts) returns early for INPUT/TEXTAREA targets, so global shortcuts never fire when textarea is focused.
**When to use:** Markdown formatting shortcuts that manipulate textarea selection.
**Example:**
```typescript
textarea.addEventListener('keydown', (e: KeyboardEvent) => {
  const cmd = e.metaKey || e.ctrlKey;
  if (!cmd) return;

  if (e.key === 'b') {
    e.preventDefault();
    this._wrapSelection('**', '**'); // Bold
  } else if (e.key === 'i') {
    e.preventDefault();
    this._wrapSelection('_', '_'); // Italic
  } else if (e.key === 'k') {
    e.preventDefault();
    this._wrapSelection('[', '](url)'); // Link
  }
});

private _wrapSelection(before: string, after: string): void {
  const textarea = this._textareaEl!;
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const text = textarea.value;
  const selected = text.substring(start, end);
  const replacement = before + selected + after;
  textarea.value = text.substring(0, start) + replacement + text.substring(end);
  // Position cursor after the wrapped text
  textarea.selectionStart = start + before.length;
  textarea.selectionEnd = start + before.length + selected.length;
  textarea.focus();
  // Update in-memory content
  this._content = textarea.value;
}
```

### Pattern 4: Markdown Render Pipeline
**What:** Convert markdown string to sanitized HTML on tab switch to Preview.
**When to use:** Every time user clicks the Preview tab.
**Example:**
```typescript
import { marked } from 'marked';
import DOMPurify from 'dompurify';

private _renderPreview(): void {
  const rawHtml = marked.parse(this._content) as string;
  const cleanHtml = DOMPurify.sanitize(rawHtml, {
    ALLOWED_TAGS: [
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'p', 'br', 'hr',
      'ul', 'ol', 'li',
      'blockquote', 'pre', 'code',
      'strong', 'em', 'del', 's',
      'a', 'img',
      'table', 'thead', 'tbody', 'tr', 'th', 'td',
      'input', // GFM task list checkboxes
      'div', 'span',
    ],
    ALLOWED_ATTR: [
      'href', 'src', 'alt', 'title',
      'class',
      'type', 'checked', 'disabled', // for task list checkboxes
    ],
    ALLOW_DATA_ATTR: false,
    FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form'],
    FORBID_ATTR: ['onerror', 'onclick', 'onload', 'onmouseover', 'style'],
  });
  this._previewEl!.innerHTML = cleanHtml;
}
```

### Pattern 5: main.ts Wiring
**What:** Mount NotebookExplorer into WorkbenchShell notebook section body, following the established pattern from Properties/Projection/LATCH explorers.
**When to use:** App bootstrap in main.ts.
**Example (matching existing pattern from main.ts lines 515-559):**
```typescript
// 14d. Mount NotebookExplorer into WorkbenchShell Notebook section (Phase 57)
const notebookBody = shell.getSectionBody('notebook');
if (notebookBody) {
  notebookBody.textContent = ''; // Clear stub content
}

const notebookExplorer = new NotebookExplorer();
notebookExplorer.mount(notebookBody!);
```

### Anti-Patterns to Avoid
- **Don't register Cmd+B/I/K in ShortcutRegistry:** ShortcutRegistry guards against TEXTAREA targets -- shortcuts would never fire. Use textarea-local keydown instead.
- **Don't use innerHTML for the editor:** Plain `<textarea>` is the locked decision. No contenteditable, no WYSIWYG.
- **Don't persist to localStorage or database:** Session-only is a locked decision (NOTE-04). Content lives only in the class field.
- **Don't render markdown on every keystroke:** Render only on tab switch to Preview (manual tab switch only -- locked decision).
- **Don't add a 5th section to SECTION_CONFIGS:** Notebook section already exists at index 0 in WorkbenchShell. Just mount into its body.
- **Don't use `marked.parse()` with `async: true`:** Synchronous parsing is sufficient for session-only notes. Async adds complexity for no benefit.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Markdown parsing | Custom regex-based parser | `marked` | GFM tables, task lists, strikethrough have edge cases; marked handles 100% of GFM spec |
| HTML sanitization | Custom regex sanitizer | `dompurify` | Regex-based sanitization is bypassable (mXSS attacks); DOMPurify uses browser's DOM parser |
| Segmented control | New component class | Plain DOM elements with CSS | Two buttons and a class toggle -- no abstraction needed |
| Textarea selection wrapping | External library | Native selectionStart/selectionEnd API | Browser API is simple and sufficient for wrap-before/after pattern |

**Key insight:** Markdown parsing and HTML sanitization are the only two areas where hand-rolling is dangerous. The rest of NotebookExplorer is straightforward DOM manipulation matching existing explorer patterns.

## Common Pitfalls

### Pitfall 1: XSS via marked Output in WKWebView
**What goes wrong:** marked produces raw HTML that may contain `<script>`, `javascript:` URIs, or event handlers. In WKWebView, injected script runs with full bridge access.
**Why it happens:** marked is a parser, not a sanitizer. Its output is trusted HTML only if the input is trusted.
**How to avoid:** Always pipe marked output through DOMPurify.sanitize() before setting innerHTML. Never skip sanitization, even for "known safe" content.
**Warning signs:** Any code path that sets innerHTML with marked output without DOMPurify in between.

### Pitfall 2: ShortcutRegistry Conflict with Textarea
**What goes wrong:** Registering Cmd+B/I/K in ShortcutRegistry -- they never fire because the input guard returns early for TEXTAREA targets.
**Why it happens:** ShortcutRegistry intentionally skips form fields to prevent shortcut-typing conflicts.
**How to avoid:** Handle Cmd+B/I/K via a keydown listener directly on the textarea element. This is a textarea-scoped concern, not a global shortcut.
**Warning signs:** Shortcuts work everywhere except when the notebook textarea is focused.

### Pitfall 3: Content Loss on Tab Switch
**What goes wrong:** Switching from Write to Preview and back clears the textarea content because the DOM element was removed/recreated.
**Why it happens:** Using display:none toggle on the same elements (correct approach) vs. destroying and recreating elements (wrong approach).
**How to avoid:** Store content in a class field (`this._content`). On Write tab, sync textarea value from field. On every input event, sync field from textarea. The textarea and preview elements are both always in the DOM -- just toggle visibility.
**Warning signs:** User writes text, switches to Preview, switches back, text is gone.

### Pitfall 4: Notebook Section Defaults to Expanded
**What goes wrong:** The notebook section expands on first visit, taking up panel rail space before the user needs it.
**Why it happens:** CollapsibleSection defaults to expanded unless `defaultCollapsed: true` is set.
**How to avoid:** The existing SECTION_CONFIGS for notebook in WorkbenchShell does NOT currently set `defaultCollapsed: true`. This needs to be added per the user decision.
**Warning signs:** Fresh install shows Notebook section expanded with empty state.

### Pitfall 5: Cmd+K Conflicts with Command Palette
**What goes wrong:** Cmd+K opens the command palette instead of inserting a Markdown link when the textarea is focused.
**Why it happens:** ShortcutRegistry fires Cmd+K for the command palette globally.
**How to avoid:** ShortcutRegistry already guards against TEXTAREA targets (returns early). When textarea is focused, the global Cmd+K won't fire. The local textarea keydown handler catches Cmd+K for link insertion. No conflict exists -- but verify this in tests.
**Warning signs:** Cmd+K opens palette when typing in notebook instead of inserting link syntax.

### Pitfall 6: DOMPurify Stripping GFM Task List Checkboxes
**What goes wrong:** GFM task lists render as `<input type="checkbox" checked disabled>`. DOMPurify's default config may strip `<input>` tags.
**Why it happens:** `<input>` is not in DOMPurify's default ALLOWED_TAGS for good security reasons.
**How to avoid:** Explicitly include `'input'` in ALLOWED_TAGS and `'type', 'checked', 'disabled'` in ALLOWED_ATTR. This is safe because the checkboxes are disabled (read-only).
**Warning signs:** Task lists render as plain list items without checkboxes.

### Pitfall 7: CSS max-height Override Missing for Notebook
**What goes wrong:** Notebook section body clips at 500px (the default CollapsibleSection max-height).
**Why it happens:** The CSS override for real explorer content (workbench.css line ~127) only covers `.properties-explorer`, `.projection-explorer`, and `.latch-explorers`.
**How to avoid:** Add `.collapsible-section__body:has(> .notebook-explorer)` to the max-height override rule in workbench.css.
**Warning signs:** Notebook content gets clipped when there's a lot of Markdown written.

## Code Examples

### Marked Parse (Synchronous, GFM Default)
```typescript
// Source: https://marked.js.org/using_advanced
import { marked } from 'marked';

// GFM is enabled by default (gfm: true since v0.2.1)
// Tables, task lists, strikethrough, autolinks all work out of the box
const html = marked.parse('# Hello\n\n- [x] Task done\n- [ ] Task pending');
// Returns: <h1>Hello</h1>\n<ul>\n<li><input checked="" disabled="" type="checkbox"> Task done</li>...
```

### DOMPurify Strict Allowlist
```typescript
// Source: https://github.com/cure53/DOMPurify
import DOMPurify from 'dompurify';

const SANITIZE_CONFIG: DOMPurify.Config = {
  ALLOWED_TAGS: [
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'p', 'br', 'hr',
    'ul', 'ol', 'li',
    'blockquote', 'pre', 'code',
    'strong', 'em', 'del', 's',
    'a', 'img',
    'table', 'thead', 'tbody', 'tr', 'th', 'td',
    'input', // GFM task list checkboxes
    'div', 'span',
  ],
  ALLOWED_ATTR: [
    'href', 'src', 'alt', 'title', 'class',
    'type', 'checked', 'disabled',
  ],
  ALLOW_DATA_ATTR: false,
  FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form'],
  FORBID_ATTR: ['onerror', 'onclick', 'onload', 'onmouseover', 'style'],
};

const clean = DOMPurify.sanitize(dirty, SANITIZE_CONFIG);
```

### Textarea Selection Wrapping
```typescript
// Source: Native browser API (HTMLTextAreaElement.selectionStart/End)
function wrapSelection(textarea: HTMLTextAreaElement, before: string, after: string): void {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const text = textarea.value;
  const selected = text.substring(start, end);

  textarea.value = text.substring(0, start) + before + selected + after + text.substring(end);

  // Reselect the original text (inside the wrapper)
  textarea.selectionStart = start + before.length;
  textarea.selectionEnd = start + before.length + selected.length;
  textarea.focus();
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| marked.setOptions() global config | marked.use() instance-level config | marked v4+ | Per-instance configuration, no global state pollution |
| DOMPurify.sanitize() with default tags | Explicit ALLOWED_TAGS allowlist | Best practice, no version change | Stricter security posture, especially important in WKWebView |
| Side-by-side split pane editors | Tabbed Write/Preview toggle | User decision (locked) | Simpler layout, less horizontal space needed in panel rail |
| innerHTML = marked.parse(input) | innerHTML = DOMPurify.sanitize(marked.parse(input)) | DOMPurify adoption as standard practice | XSS prevention becomes explicit rather than hoped-for |

**Deprecated/outdated:**
- `marked`'s built-in `sanitize` option was removed in v5.0+. Use DOMPurify instead (recommended by marked docs).
- `marked.setOptions()` is deprecated in favor of `marked.use()` for global config.

## Open Questions

1. **marked v17 TypeScript Types**
   - What we know: marked has a TypeScript folder in its repo, suggesting built-in types
   - What's unclear: Whether @types/marked is still needed or if types ship with the package
   - Recommendation: Install marked first, check if types resolve. If not, add @types/marked. LOW risk -- easy to fix after install.

2. **DOMPurify Import Style**
   - What we know: `import DOMPurify from 'dompurify'` is the documented ESM import
   - What's unclear: Whether this works cleanly with Vite/TypeScript strict mode or needs `esModuleInterop`
   - Recommendation: Try the standard import. If TypeScript complains, use `import * as DOMPurify from 'dompurify'` or check tsconfig. LOW risk.

3. **Notebook Section defaultCollapsed**
   - What we know: User decided notebook defaults to collapsed on first launch
   - What's unclear: The current SECTION_CONFIGS entry for 'notebook' in WorkbenchShell.ts does NOT set `defaultCollapsed: true`
   - Recommendation: Add `defaultCollapsed: true` to the notebook SECTION_CONFIGS entry. This is a one-line fix.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.0 |
| Config file | vitest.config.ts (root) |
| Quick run command | `npx vitest --run tests/ui/NotebookExplorer.test.ts` |
| Full suite command | `npx vitest --run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| NOTE-01 | NotebookExplorer mounts with tabbed layout (Write/Preview), textarea visible in Write mode, preview visible in Preview mode | unit | `npx vitest --run tests/ui/NotebookExplorer.test.ts` | No -- Wave 0 |
| NOTE-02 | XSS payloads sanitized: `<script>`, `onerror=`, `javascript:` stripped from preview output | unit | `npx vitest --run tests/ui/NotebookExplorer.test.ts` | No -- Wave 0 |
| NOTE-03 | .notebook-chart-preview container exists in DOM after mount | unit | `npx vitest --run tests/ui/NotebookExplorer.test.ts` | No -- Wave 0 |
| NOTE-04 | No bridge.send or database calls during notebook lifecycle (mount, type, switch tabs, destroy) | unit | `npx vitest --run tests/ui/NotebookExplorer.test.ts` | No -- Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest --run tests/ui/NotebookExplorer.test.ts`
- **Per wave merge:** `npx vitest --run`
- **Phase gate:** Full suite green before /gsd:verify-work

### Wave 0 Gaps
- [ ] `tests/ui/NotebookExplorer.test.ts` -- covers NOTE-01, NOTE-02, NOTE-03, NOTE-04
- [ ] npm install marked dompurify (+ @types/dompurify if needed)

## Sources

### Primary (HIGH confidence)
- [marked.js.org](https://marked.js.org/) - GFM default enabled (gfm: true since v0.2.1), options documentation, security recommendations
- [marked.js.org/using_advanced](https://marked.js.org/using_advanced) - Configuration options, marked.use() pattern, async mode
- [github.com/cure53/DOMPurify](https://github.com/cure53/DOMPurify) - v3.3.2, ALLOWED_TAGS/ALLOWED_ATTR config, ESM import, TypeScript types
- Existing codebase: LatchExplorers.ts, WorkbenchShell.ts, VisualExplorer.ts, CollapsibleSection.ts, ShortcutRegistry.ts, main.ts -- all patterns verified by reading source

### Secondary (MEDIUM confidence)
- [npmjs.com/package/marked](https://www.npmjs.com/package/marked) - v17.0.3 latest, 11K+ dependents
- [npmjs.com/package/dompurify](https://www.npmjs.com/package/dompurify) - v3.3.2, 3.7K+ dependents
- [DOMPurify Wiki - Default TAGs/ATTRs allowlist](https://github.com/cure53/DOMPurify/wiki/Default-TAGs-ATTRIBUTEs-allow-list-&-blocklist) - Default behavior reference

### Tertiary (LOW confidence)
- None -- all findings verified through primary or secondary sources

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - marked and DOMPurify are industry-standard, verified via official docs and npm
- Architecture: HIGH - follows exact patterns from 4 existing explorers in this codebase (verified by reading source)
- Pitfalls: HIGH - all pitfalls derived from reading actual codebase code (ShortcutRegistry guard, CollapsibleSection defaults, CSS max-height override)

**Research date:** 2026-03-08
**Valid until:** 2026-04-08 (stable domain -- markdown parsing and HTML sanitization are mature)
