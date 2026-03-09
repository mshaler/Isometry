# Phase 63: Notebook Formatting Toolbar - Context

**Gathered:** 2026-03-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Add a formatting toolbar above the notebook textarea with undo-safe Markdown insertion. Fix the existing _wrapSelection() method that breaks the browser undo stack. Toolbar provides visual buttons for formatting operations that also work via keyboard shortcuts. Notebook persistence, chart blocks, and per-card scoping are separate phases (64, 65).

</domain>

<decisions>
## Implementation Decisions

### Button set + grouping
- 8 buttons total: bold, italic, code, strikethrough | heading, list, blockquote | link
- Three visual groups separated by thin vertical dividers:
  - **Text style:** bold, italic, strikethrough
  - **Structure:** heading, list, blockquote
  - **Insert:** link, code
- Heading button cycles H1 -> H2 -> H3 -> plain on repeated clicks (Notion/Bear pattern)
- List button creates unordered lists only (- prefix); ordered lists are manual
- Title attribute tooltips showing keyboard shortcut hints (e.g., "Bold (Cmd+B)")

### Toolbar visual style
- Unicode glyphs for button labels (B, I, H, bullet, link, </>, strikethrough S, >)
- Zero icon dependencies — matches existing zero-dependency UI philosophy
- Toolbar sits between the Write/Preview segmented control and the textarea
- Visible only in Write mode — hidden when Preview tab is active
- No active/pressed state detection — buttons are stateless (always same appearance)

### Undo behavior
- Atomic undo: Cmd+Z removes the full formatting insertion as one step (both markers)
- Always-wrap (additive): clicking bold on already-bold text wraps again, doesn't toggle/unwrap
- Uses document.execCommand('insertText') for undo-safe insertion — deprecated but universally supported in WebKit/WKWebView
- Both toolbar buttons AND existing Cmd+B/I/K shortcuts use the new undo-safe method — single code path, _wrapSelection() replaced entirely

### Line-prefix behavior
- Heading, list, and blockquote buttons always insert prefix at line start regardless of cursor position
- Multi-line selection: prefix each selected line (e.g., selecting 3 lines + clicking list creates 3 list items)
- Link button inserts [text](url) placeholder — no modal/prompt dialog

### Claude's Discretion
- Exact Unicode glyphs for each button (B vs **B** vs similar)
- Button sizing, padding, and hover/focus styles within existing design token system
- CSS implementation of vertical divider separators
- Handling of edge cases (cursor at very start/end of textarea, empty textarea)

</decisions>

<specifics>
## Specific Ideas

- Heading cycling (H1 -> H2 -> H3 -> plain) is like Notion's heading button behavior
- The existing Cmd+B/I/K shortcuts already exist but use broken _wrapSelection() — this phase fixes the underlying method AND adds the visible toolbar. Both should share the same undo-safe code path.

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `NotebookExplorer` class (src/ui/NotebookExplorer.ts): 260 lines, tabbed Write/Preview, marked + DOMPurify pipeline, Cmd+B/I/K keydown handler
- `notebook-explorer.css`: Full CSS namespace (.notebook-*) with segmented control, textarea, preview styling
- Design token system: --text-xs..--text-xl typography, --border-subtle, --bg-secondary color tokens available

### Established Patterns
- Zero-dependency UI: pure DOM creation (createElement), no framework components
- CSS namespace scoping: .notebook-* prefix convention (SHEL-06)
- Keyboard shortcuts on textarea bypass ShortcutRegistry (input guard skips TEXTAREA elements)
- Event handler cleanup in destroy() method

### Integration Points
- Toolbar DOM inserts between controlEl (segmented control) and bodyEl (textarea/preview container) in mount()
- _wrapSelection() is the single method to replace — both keyboard shortcuts and toolbar buttons will call the new undo-safe method
- Input event listener already syncs _content field on every keystroke — execCommand triggers this naturally

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 63-notebook-formatting-toolbar*
*Context gathered: 2026-03-09*
