# Phase 48: Review Fixes - Context

**Gathered:** 2026-03-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix all runtime correctness bugs and process gaps identified by Codex code review. Every shipped feature works correctly in real browsers, lint gate holds, and planning docs are accurate. Specifically: broken Excel web import (ArrayBuffer path), non-functional ? shortcut on US keyboards (shiftKey matching), missing undo/redo toast in runtime path, Biome lint drift (17 errors + 8 warnings), and stale planning docs (ROADMAP/PROJECT/STATE consistency).

</domain>

<decisions>
## Implementation Decisions

### Toast feedback scope
- Wire ActionToast into MutationManager itself (e.g., `setToast(toast)`) so undo/redo from ANY trigger (keyboard, toolbar, programmatic) shows feedback — single wiring point
- The existing `setupMutationShortcuts()` in `mutations/shortcuts.ts` becomes redundant — ShortcutRegistry handles key binding, MutationManager handles toast
- Silent on empty stack — no toast when nothing to undo/redo (consistent with VS Code, Figma)
- Keep 2-second auto-dismiss (current ActionToast default)
- Message format per success criteria: "Undid: {description}" / "Redid: {description}"

### Excel import error handling
- Split file read path by format: binary formats (.xlsx, .xls) use `file.arrayBuffer()`, text formats (.json, .csv, .md, .html) keep `file.text()` — matches what each parser actually expects
- Import errors (corrupt/unsupported Excel) shown via ImportToast error — consistent with existing `ImportToast.showError()` pattern, non-blocking, auto-dismisses
- Add file size guard: reject files over threshold (e.g., 25MB) with ImportToast error before attempting parse — prevents browser hangs from giant Excel dumps
- Existing ImportToast success wiring (main.ts:280-283 bridge.importFile wrapper) is sufficient — ArrayBuffer fix just ensures data reaches the parser correctly

### Biome lint cleanup
- Fix ALL diagnostics — both 17 errors and 8 warnings — clean slate for v4.3
- Auto-fix formatting issues via `biome check --write`; manually review and fix logic-related lint errors (unused vars, dead code)
- Add `make lint` target to Makefile, include in `make ci` — prevents future drift, matches existing `make check` pattern
- Also verify `npx tsc --noEmit` passes; add `make typecheck` target to Makefile alongside `make lint`

### Shift-key matching (? shortcut)
- General fix: for plain-key shortcuts (no explicit Cmd/Shift/Alt modifiers in registration), skip shiftKey matching entirely — match on event.key only. If user registered '?', the key match is sufficient regardless of shiftKey state
- This future-proofs for any shifted-character shortcut (!, @, #, etc.) without maintaining a fragile character set
- Keep '?' as the help overlay label (not 'Shift+/') — users think "press question mark"
- Add regression test: simulate KeyboardEvent with key='?' and shiftKey=true, verify handler fires

### Claude's Discretion
- Exact file size threshold for Excel guard (25MB suggested, adjust based on parser capabilities)
- Whether to remove or deprecate `setupMutationShortcuts()` after MutationManager gets toast wiring
- Exact Biome rule adjustments if any warnings are false positives
- Planning doc reconciliation details (ROADMAP/PROJECT/STATE content updates)

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ActionToast` (src/ui/ActionToast.ts): Fully implemented, 2s auto-dismiss, aria-live, .is-visible toggle — just needs wiring into MutationManager
- `ImportToast` (src/ui/ImportToast.ts): Has `showError()` pattern — reuse for Excel import failure feedback
- `ShortcutRegistry` (src/shortcuts/ShortcutRegistry.ts): Central keydown handler with ParsedShortcut matching — fix goes in the matching loop (line 72-89)
- `MutationManager` (src/mutations/MutationManager.ts): Has `undo()`/`redo()` returning Promise<boolean> — add optional toast callback after successful operations
- `Makefile`: Exists with `make check`, `make warnings`, `make all`, `make ci` targets — add `make lint` and `make typecheck`

### Established Patterns
- ImportToast pattern: CSS class toggle, aria-live, timer-based dismiss — ActionToast already follows this
- bridge.importFile wrapper in main.ts (line 280-283): intercepts ImportResult for toast — Excel fix feeds into this existing path
- ShortcutRegistry parse() (line 168-179): splits on '+', lowercases — fix is in the matching logic, not parsing

### Integration Points
- `main.ts:188` — file.text() call needs conditional split for binary vs text formats
- `main.ts:226-240` — undo/redo ShortcutRegistry handlers can be simplified once MutationManager owns toast
- `ShortcutRegistry.ts:72-89` — matching loop needs shiftKey bypass for plain-key shortcuts
- `MutationManager.ts` — add setToast() method and toast.show() calls in undo()/redo()

</code_context>

<specifics>
## Specific Ideas

No specific requirements — all fixes are well-defined by the Codex review findings and success criteria. The implementation approach is constrained by existing patterns (ImportToast, ActionToast, ShortcutRegistry, MutationManager).

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 48-review-fixes*
*Context gathered: 2026-03-07*
