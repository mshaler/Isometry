# Phase 63: Notebook Formatting Toolbar - Research

**Researched:** 2026-03-09
**Domain:** Textarea Markdown formatting toolbar with undo-safe text insertion
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- 8 buttons total: bold, italic, code, strikethrough | heading, list, blockquote | link
- Three visual groups separated by thin vertical dividers:
  - **Text style:** bold, italic, strikethrough
  - **Structure:** heading, list, blockquote
  - **Insert:** link, code
- Heading button cycles H1 -> H2 -> H3 -> plain on repeated clicks (Notion/Bear pattern)
- List button creates unordered lists only (- prefix); ordered lists are manual
- Title attribute tooltips showing keyboard shortcut hints (e.g., "Bold (Cmd+B)")
- Unicode glyphs for button labels (B, I, H, bullet, link, </>, strikethrough S, >)
- Zero icon dependencies -- matches existing zero-dependency UI philosophy
- Toolbar sits between the Write/Preview segmented control and the textarea
- Visible only in Write mode -- hidden when Preview tab is active
- No active/pressed state detection -- buttons are stateless (always same appearance)
- Atomic undo: Cmd+Z removes the full formatting insertion as one step (both markers)
- Always-wrap (additive): clicking bold on already-bold text wraps again, doesn't toggle/unwrap
- Uses document.execCommand('insertText') for undo-safe insertion -- deprecated but universally supported in WebKit/WKWebView
- Both toolbar buttons AND existing Cmd+B/I/K shortcuts use the new undo-safe method -- single code path, _wrapSelection() replaced entirely
- Heading, list, and blockquote buttons always insert prefix at line start regardless of cursor position
- Multi-line selection: prefix each selected line (e.g., selecting 3 lines + clicking list creates 3 list items)
- Link button inserts [text](url) placeholder -- no modal/prompt dialog

### Claude's Discretion
- Exact Unicode glyphs for each button (B vs **B** vs similar)
- Button sizing, padding, and hover/focus styles within existing design token system
- CSS implementation of vertical divider separators
- Handling of edge cases (cursor at very start/end of textarea, empty textarea)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| NOTE-01 | Formatting toolbar with bold, italic, heading, list, and link buttons above textarea | Toolbar DOM creation pattern, CSS styling with design tokens, button-to-action mapping |
| NOTE-02 | Toolbar uses undo-safe textarea insertion (document.execCommand or InputEvent, not direct value assignment) | GitHub markdown-toolbar-element reference pattern with contentEditable trick, input event sync |
</phase_requirements>

## Summary

This phase adds a Markdown formatting toolbar to the existing NotebookExplorer and fixes the broken `_wrapSelection()` method that destroys the browser undo stack. The scope is well-contained: modify one TypeScript file (`NotebookExplorer.ts`) and one CSS file (`notebook-explorer.css`), with zero new dependencies.

The critical technical challenge is undo-safe text insertion in a `<textarea>`. The existing `_wrapSelection()` sets `textarea.value` directly via string concatenation, which destroys the native undo history. The proven fix is GitHub's `markdown-toolbar-element` pattern: temporarily set `textarea.contentEditable = 'true'`, call `document.execCommand('insertText', false, text)`, then reset `contentEditable = 'false'`. This preserves the browser's native undo stack in WebKit. The `execCommand` API is deprecated but MDN explicitly notes it remains valid for undo-preserving use cases where no alternative exists.

**Primary recommendation:** Replace `_wrapSelection()` with an undo-safe insertion function using the contentEditable + execCommand('insertText') trick from GitHub's markdown-toolbar-element, then build the toolbar buttons on top of that foundation.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| No new dependencies | -- | Pure DOM manipulation | Project zero-dependency UI philosophy |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| marked | (existing) | Markdown preview rendering | Already in NotebookExplorer |
| DOMPurify | (existing) | XSS sanitization | Already in NotebookExplorer |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `execCommand('insertText')` | `textarea.setRangeText()` | setRangeText does NOT preserve undo stack -- confirmed by GitHub choosing execCommand over it |
| `execCommand('insertText')` | InputEvent constructor dispatch | Synthetic InputEvent does not trigger native undo integration in any browser |
| Custom toolbar | `@github/markdown-toolbar-element` | Web component with 0 deps, but adds dependency and doesn't match project's class-based UI pattern |

**Installation:**
```bash
# No installation needed -- zero new dependencies
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── ui/
│   └── NotebookExplorer.ts   # MODIFY: add toolbar, fix _wrapSelection
├── styles/
│   └── notebook-explorer.css  # MODIFY: add toolbar styles
tests/
├── ui/
│   └── NotebookExplorer.test.ts  # MODIFY: add toolbar + undo tests
```

### Pattern 1: Undo-Safe Text Insertion (contentEditable Trick)
**What:** Temporarily make textarea contentEditable, use execCommand('insertText'), then revert
**When to use:** Every programmatic text insertion into the notebook textarea
**Example:**
```typescript
// Source: github/markdown-toolbar-element (verified 2026-03-09)
function undoSafeInsert(textarea: HTMLTextAreaElement, text: string): void {
    // Focus required for execCommand to work
    textarea.focus();

    // Temporarily enable contentEditable for execCommand support
    textarea.contentEditable = 'true';
    try {
        document.execCommand('insertText', false, text);
    } catch (_e) {
        // Fallback: direct value assignment (loses undo, but at least inserts)
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const before = textarea.value.slice(0, start);
        const after = textarea.value.slice(end);
        textarea.value = before + text + after;
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
    }
    textarea.contentEditable = 'false';
}
```

### Pattern 2: Inline Wrap (bold, italic, code, strikethrough, link)
**What:** Select text range, replace with before + selected + after via single insertText call
**When to use:** Any formatting that wraps selected text with symmetric or asymmetric markers
**Example:**
```typescript
// Undo-safe inline wrap: replaces _wrapSelection entirely
function wrapInline(textarea: HTMLTextAreaElement, before: string, after: string): void {
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = textarea.value.substring(start, end);
    const replacement = before + selected + after;

    // Set selection to cover the text being replaced
    textarea.selectionStart = start;
    textarea.selectionEnd = end;

    // Single insertText call = single undo step
    undoSafeInsert(textarea, replacement);

    // Reposition cursor: inside wrappers if no selection, or reselect text
    if (selected.length > 0) {
        textarea.selectionStart = start + before.length;
        textarea.selectionEnd = start + before.length + selected.length;
    } else {
        textarea.selectionStart = start + before.length;
        textarea.selectionEnd = start + before.length;
    }
}
```

### Pattern 3: Line Prefix (heading, list, blockquote)
**What:** Insert prefix at start of current line(s), regardless of cursor position within line
**When to use:** Block-level formatting that operates on full lines
**Example:**
```typescript
// Undo-safe line prefix: heading, list, blockquote
function prefixLines(textarea: HTMLTextAreaElement, prefix: string): void {
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;

    // Find line boundaries for selection range
    const lineStart = text.lastIndexOf('\n', start - 1) + 1;
    const lineEnd = end;

    // Get selected lines, prefix each
    const selectedText = text.substring(lineStart, lineEnd);
    const lines = selectedText.split('\n');
    const prefixed = lines.map(line => prefix + line).join('\n');

    // Select the full line range, then insert
    textarea.selectionStart = lineStart;
    textarea.selectionEnd = lineEnd;
    undoSafeInsert(textarea, prefixed);

    // Position cursor after prefix on first line
    textarea.selectionStart = lineStart + prefix.length;
    textarea.selectionEnd = lineStart + prefixed.length;
}
```

### Pattern 4: Heading Cycle (H1 -> H2 -> H3 -> plain)
**What:** Detect existing heading prefix on current line, cycle to next level or remove
**When to use:** Heading toolbar button only
**Example:**
```typescript
function cycleHeading(textarea: HTMLTextAreaElement): void {
    const start = textarea.selectionStart;
    const text = textarea.value;
    const lineStart = text.lastIndexOf('\n', start - 1) + 1;
    const lineEnd = text.indexOf('\n', start);
    const line = text.substring(lineStart, lineEnd === -1 ? text.length : lineEnd);

    // Detect current heading level
    const match = line.match(/^(#{1,3})\s/);
    let replacement: string;
    let cursorOffset: number;

    if (!match) {
        // No heading -> H1
        replacement = '# ' + line;
        cursorOffset = 2;
    } else if (match[1] === '#') {
        // H1 -> H2
        replacement = '## ' + line.substring(2);
        cursorOffset = 1;
    } else if (match[1] === '##') {
        // H2 -> H3
        replacement = '### ' + line.substring(3);
        cursorOffset = 1;
    } else {
        // H3 -> plain
        replacement = line.substring(4);
        cursorOffset = -4;
    }

    textarea.selectionStart = lineStart;
    textarea.selectionEnd = lineEnd === -1 ? text.length : lineEnd;
    undoSafeInsert(textarea, replacement);
}
```

### Anti-Patterns to Avoid
- **Direct textarea.value assignment:** Destroys native undo stack. NEVER set `textarea.value` programmatically for formatting operations.
- **Toggle detection:** User decided always-wrap (additive). Do NOT check if text is already bold/italic and try to unwrap.
- **contenteditable editor:** Do NOT replace textarea with contenteditable div. The textarea + toolbar pattern is the locked decision.
- **Synthetic InputEvent dispatch for undo:** Dispatching `new InputEvent('input', { inputType: 'insertText', data: text })` does NOT integrate with the native undo stack in any browser.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Undo-safe textarea insertion | Custom undo/redo history manager | `execCommand('insertText')` with contentEditable trick | Browser's native undo stack is more reliable than any custom implementation; handles selection, cursor, and input event timing |
| Icon set for toolbar | SVG icon system or icon font | Unicode glyphs (B, I, S, H, etc.) | User decision: zero icon dependencies. Unicode glyphs are universally rendered |
| Tooltip system | Custom tooltip component | Native `title` attribute | User decision: title attribute tooltips. No custom tooltip needed |
| Markdown toggle detection | Regex pattern matching for existing formatting | Always-wrap (additive) behavior | User decision: no toggle/unwrap. Clicking bold on bold text wraps again |

**Key insight:** The entire formatting toolbar is mechanical DOM work on top of a single undo-safe insertion primitive. Get the insertion primitive right (Pattern 1), and everything else is straightforward button-to-action wiring.

## Common Pitfalls

### Pitfall 1: execCommand('insertText') Doesn't Fire Input Events Consistently
**What goes wrong:** After `execCommand('insertText')`, the `_content` field may not sync because the `input` event listener doesn't fire.
**Why it happens:** MDN explicitly states: "Modifications performed by execCommand() may or may not trigger beforeinput and input events, depending on the browser and configuration."
**How to avoid:** After every `undoSafeInsert()` call, explicitly sync `_content = textarea.value`. Do NOT rely on the `input` event listener alone.
**Warning signs:** Content appears in textarea but `_content` field is stale, causing preview to show old content.

### Pitfall 2: execCommand Requires Focus
**What goes wrong:** `execCommand('insertText')` silently fails (returns false) if the textarea is not focused.
**Why it happens:** `execCommand` operates on the active editing context, which requires focus.
**How to avoid:** Call `textarea.focus()` before any `execCommand` call. The existing `_wrapSelection()` already calls `textarea.focus()` at the end -- move it to the beginning.
**Warning signs:** Toolbar button click does nothing, no error in console.

### Pitfall 3: Selection Range Reset After contentEditable Toggle
**What goes wrong:** Setting `contentEditable = 'true'` then `'false'` may reset the selection range in some WebKit versions.
**Why it happens:** The contentEditable mode change can trigger internal selection state recalculation.
**How to avoid:** Save `selectionStart`/`selectionEnd` before the contentEditable toggle, and restore cursor position after the insert completes.
**Warning signs:** Cursor jumps to unexpected position after toolbar button click.

### Pitfall 4: Line Prefix on Empty Selection Prefixes Wrong Line
**What goes wrong:** When cursor is at position 0 (very start), `lastIndexOf('\n', -1)` returns -1, so `lineStart` correctly becomes 0. But when cursor is right after a `\n`, the line-start detection must not treat the newline itself as part of the current line.
**Why it happens:** Off-by-one in `lastIndexOf('\n', start - 1)` boundary.
**How to avoid:** Test edge cases: cursor at position 0, cursor right after `\n`, cursor at end of text, empty textarea. The formula `text.lastIndexOf('\n', start - 1) + 1` is correct for all these cases.
**Warning signs:** Heading/list prefix appears on the wrong line.

### Pitfall 5: Toolbar Buttons Visible in Preview Mode
**What goes wrong:** Toolbar buttons remain visible and clickable when Preview tab is active, but textarea is hidden so formatting has no effect.
**Why it happens:** Toolbar visibility not tied to tab switching logic.
**How to avoid:** In `_switchTab()`, toggle toolbar visibility: `toolbarEl.style.display = tab === 'write' ? '' : 'none'`.
**Warning signs:** User clicks Bold in preview mode, nothing happens, confusion.

### Pitfall 6: Multi-Line Prefix Doubles Newlines
**What goes wrong:** When prefixing multiple selected lines with `- `, the replacement text has doubled newlines.
**Why it happens:** `split('\n')` followed by `join('\n')` is correct, but if the selection includes a trailing newline, the last element is an empty string that gets prefixed.
**How to avoid:** Either trim trailing newline from selection before split, or skip prefixing empty trailing lines.
**Warning signs:** Extra blank `- ` line at end of list creation.

## Code Examples

### Complete Toolbar DOM Creation
```typescript
// Source: Project convention (pure createElement, notebook-* CSS namespace)
private _createToolbar(): HTMLElement {
    const toolbar = document.createElement('div');
    toolbar.className = 'notebook-toolbar';

    // Group 1: Text style
    const textGroup = this._createButtonGroup([
        { label: 'B', title: 'Bold (Cmd+B)', action: () => this._formatInline('**', '**') },
        { label: 'I', title: 'Italic (Cmd+I)', action: () => this._formatInline('_', '_') },
        { label: 'S', title: 'Strikethrough', action: () => this._formatInline('~~', '~~') },
    ]);
    toolbar.appendChild(textGroup);

    // Divider
    toolbar.appendChild(this._createDivider());

    // Group 2: Structure
    const structGroup = this._createButtonGroup([
        { label: 'H', title: 'Heading', action: () => this._cycleHeading() },
        { label: '\u2022', title: 'List', action: () => this._formatLinePrefix('- ') },
        { label: '>', title: 'Blockquote', action: () => this._formatLinePrefix('> ') },
    ]);
    toolbar.appendChild(structGroup);

    // Divider
    toolbar.appendChild(this._createDivider());

    // Group 3: Insert
    const insertGroup = this._createButtonGroup([
        { label: '\uD83D\uDD17', title: 'Link (Cmd+K)', action: () => this._formatInline('[', '](url)') },
        { label: '</>', title: 'Code', action: () => this._formatInline('`', '`') },
    ]);
    toolbar.appendChild(insertGroup);

    return toolbar;
}
```

### CSS Toolbar Styling
```css
/* Source: Project convention (design tokens, notebook-* namespace) */
.notebook-toolbar {
    display: flex;
    align-items: center;
    gap: var(--space-xs);
    padding: var(--space-xs) var(--space-sm);
    border-top: 1px solid var(--border-subtle);
    background: var(--bg-surface);
}

.notebook-toolbar-group {
    display: flex;
    gap: 2px;
}

.notebook-toolbar-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border: none;
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--text-secondary);
    font-size: var(--text-sm);
    cursor: pointer;
    padding: 0;
    transition: background-color var(--transition-fast) ease,
                color var(--transition-fast) ease;
}

.notebook-toolbar-btn:hover {
    background: var(--cell-hover);
    color: var(--text-primary);
}

.notebook-toolbar-btn:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: -2px;
}

.notebook-toolbar-divider {
    width: 1px;
    height: 16px;
    background: var(--border-subtle);
    margin: 0 var(--space-xs);
}
```

### jsdom Test Considerations
```typescript
// Source: vitest jsdom environment behavior
// IMPORTANT: jsdom does NOT implement document.execCommand.
// Tests must verify the formatting RESULT, not the insertion mechanism.
// The execCommand call will fail silently in jsdom, falling through
// to the direct value assignment fallback.

it('bold toolbar button wraps selected text with **', () => {
    const explorer = new NotebookExplorer();
    explorer.mount(container);

    const textarea = container.querySelector('.notebook-textarea') as HTMLTextAreaElement;
    textarea.value = 'hello';
    textarea.selectionStart = 0;
    textarea.selectionEnd = 5;

    // Click bold button
    const boldBtn = container.querySelector('.notebook-toolbar-btn[title*="Bold"]') as HTMLElement;
    boldBtn.click();

    expect(textarea.value).toBe('**hello**');
    explorer.destroy();
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `textarea.value = newText` | `execCommand('insertText')` with contentEditable trick | 2020+ (GitHub adopted) | Preserves native undo stack |
| Custom undo/redo stack | Browser native undo via execCommand | Industry standard | Zero maintenance, handles edge cases browsers already solve |
| Icon font (Font Awesome) | Unicode glyphs or inline SVG | 2022+ trend | Zero dependency, smaller bundle |
| Toggle formatting (detect + remove) | Additive wrapping (always add) | Simplicity choice | Simpler implementation, user-decided for this project |

**Deprecated/outdated:**
- `document.execCommand()`: Officially deprecated by spec, but MDN explicitly acknowledges it remains the only viable approach for undo-preserving textarea modifications. No standards-based replacement exists. GitHub, DEV.to, and other major platforms continue to use it.

## Open Questions

1. **execCommand input event behavior in WKWebView specifically**
   - What we know: MDN says input events "may or may not" fire after execCommand. GitHub's implementation does not rely on the input event.
   - What's unclear: Whether WKWebView's WebKit engine fires input events after execCommand('insertText') with the contentEditable trick.
   - Recommendation: Explicitly sync `_content = textarea.value` after every formatting operation regardless. Do not rely on the input event listener for execCommand-triggered changes.

2. **Heading cycle detection on lines with content after prefix**
   - What we know: `line.match(/^(#{1,3})\s/)` detects heading prefix.
   - What's unclear: Edge case of `####` (H4+) which user didn't request -- should it be treated as plain text or cycled?
   - Recommendation: Treat any line starting with `####` or more as plain text (no match). The cycle only operates on H1/H2/H3.

## Sources

### Primary (HIGH confidence)
- GitHub `markdown-toolbar-element` source code (https://github.com/github/markdown-toolbar-element) -- verified 2026-03-09. Exact `insertText` + contentEditable pattern extracted.
- MDN `document.execCommand` documentation -- confirms deprecated status, confirms undo-preservation is the valid remaining use case, confirms input event inconsistency.
- Existing codebase: `src/ui/NotebookExplorer.ts` (260 lines), `src/styles/notebook-explorer.css` (218 lines), `tests/ui/NotebookExplorer.test.ts` (592 lines) -- read directly.

### Secondary (MEDIUM confidence)
- MDN `setRangeText` documentation -- confirmed it does NOT document undo stack preservation. GitHub chose execCommand over setRangeText.
- Mozilla Bug 1523270 -- referenced in project PITFALLS.md as documentation of textarea.value undo destruction.

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- zero new dependencies, all patterns verified in existing codebase
- Architecture: HIGH -- single file modification (NotebookExplorer.ts), proven insertion pattern from GitHub's production code
- Pitfalls: HIGH -- undo stack destruction is well-documented, fix is proven, edge cases are enumerable

**Research date:** 2026-03-09
**Valid until:** 2026-04-09 (stable domain, no fast-moving dependencies)
