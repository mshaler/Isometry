# Phase 57: Notebook Explorer + Polish - Context

**Gathered:** 2026-03-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver NotebookExplorer v1 embedded in the workbench's Notebook collapsible section — a session-only Markdown editor with live sanitized HTML preview (GFM), Markdown keyboard shortcuts, and a reserved container for future D3 charts. Additionally, perform a strict visual QA polish pass across ALL workbench explorer panels (Properties, Projection, Visual, LATCH, Notebook) covering spacing, typography, keyboard accessibility, transitions, empty states, and dual-theme verification.

</domain>

<decisions>
## Implementation Decisions

### Pane Layout
- Tabbed toggle (Write | Preview) — NOT side-by-side or stacked
- Segmented control at top of notebook body: two pill-shaped buttons with accent background on active tab
- Fixed min-height (~150-200px) for the notebook body; no drag-to-resize handle
- Simple tab switch only — clicking Preview shows preview, clicking Write shows editor; no click-to-edit in preview
- Manual tab switch only — no auto-preview on idle
- Notebook section defaults to collapsed on first launch
- No resize capability — tabbed toggle makes resize unnecessary; CollapsibleSection body height handles vertical space

### Editor Experience
- Plain `<textarea>` — no contenteditable, no WYSIWYG in v1
- Placeholder text: "Write Markdown..."
- Tab key moves focus to next element (standard browser behavior, no keyboard trap)
- System font (NOT monospace) — matches the rest of the app
- Content persists in textarea across tab switches (state maintained in memory)
- Markdown keyboard shortcuts: Cmd+B (bold), Cmd+I (italic), Cmd+K (link) — wraps selected text in Markdown syntax

### Preview Rendering
- GFM (GitHub Flavored Markdown) — tables, task lists, strikethrough, autolinks
- rendered via marked + DOMPurify with strict allowlist (XSS prevention in WKWebView context)
- Preview styling uses app design tokens (--text-*, --bg-*, --accent) — feels native to Isometry
- Code blocks: monospace background only, no syntax highlighting (deferred to NOTB-03)
- .notebook-chart-preview container: exists in DOM but display:none (hidden, reserved for future D3 charts)

### Session Persistence
- Session-only — no writes to IsometryDatabase
- Content clears on page refresh or app restart (NOTE-04)

### Polish Scope
- Full workbench polish pass across ALL explorer panels (not just Notebook)
- Strict visual QA gate — every panel must pass consistency checklist before milestone ships
- Four polish areas:
  1. Spacing + typography consistency: all panels use consistent padding, font sizes, line heights from design tokens
  2. Keyboard accessibility pass: Tab order through all panels, focus indicators, ARIA attributes complete
  3. Transition smoothness: collapse/expand animations consistent, no layout thrash
  4. Empty/loading states: all panels show appropriate states when no data loaded
- Both light AND dark themes verified for all explorer panels
- Panel rail scroll behavior: verify existing 40vh cap + overflow-y:auto works correctly with Notebook added; fix only if broken
- No word count in v1
- No custom scroll indicators

### Claude's Discretion
- Exact min-height value for notebook body
- DOMPurify allowlist specifics (as long as XSS is blocked)
- Segmented control exact styling within token system
- Polish pass severity threshold for what counts as "blocking"

</decisions>

<specifics>
## Specific Ideas

- "I want GFM AND WYSIWYG Preview like Obsidian with the fluent writing experience of Apple Notes" — captured as deferred idea; v1 bridges toward this with keyboard shortcuts (Cmd+B, Cmd+I, Cmd+K)
- Keyboard shortcuts wrapping selected text in Markdown syntax is the v1 stepping stone toward the future WYSIWYG experience

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `CollapsibleSection`: Notebook already has a section config in WorkbenchShell (storageKey: 'notebook', stub: 'Notebook explorer coming soon') — just need to replace stub with real content
- `WorkbenchShell.getSectionBody('notebook')`: returns the body element for mounting NotebookExplorer
- Design token system: `--text-sm`, `--bg-surface`, `--accent`, `--border-subtle` etc. — all available for notebook CSS
- `ShortcutRegistry`: existing keyboard shortcut system from Phase 44 — notebook shortcuts (Cmd+B/I/K) should integrate or use textarea-local keydown handlers
- `marked` + `DOMPurify`: NOT yet in package.json — need to add as dependencies

### Established Patterns
- Explorer lifecycle: `mount(container)` / `destroy()` pattern used by VisualExplorer, PropertiesExplorer, ProjectionExplorer, LatchExplorers
- CSS scoping: all selectors scoped under component prefix (`.notebook-*` or `.workbench-*`) — no bare element selectors (SHEL-06)
- Constructor injection: providers/config passed via constructor, no singleton imports (INTG-02)
- D3 selection.join for repeated structures (INTG-03) — though Notebook may not need D3 for v1

### Integration Points
- `WorkbenchShell` SECTION_CONFIGS array: Notebook section already defined at index 0
- `main.ts` wiring: mount NotebookExplorer into `shell.getSectionBody('notebook')` following the PropertiesExplorer/LatchExplorers pattern
- Panel rail max-height 40vh: Notebook body competes for vertical space with other expanded panels

</code_context>

<deferred>
## Deferred Ideas

- Full WYSIWYG editor with Obsidian-like inline editing and Apple Notes keyboard shortcuts — future "Notebook Phase B" or dedicated phase
- Formatting toolbar (NOTB-01) — already planned for Notebook Phase B
- D3 chart block rendering from bar schema (NOTB-02) — already planned for Notebook Phase B
- Code syntax highlighting (NOTB-03) — already planned for Notebook Phase B
- Notebook persistence to IsometryDatabase (NPRST-01) — deferred until native actor migration
- Word count / character count in editor — future enhancement

</deferred>

---

*Phase: 57-notebook-explorer-polish*
*Context gathered: 2026-03-08*
