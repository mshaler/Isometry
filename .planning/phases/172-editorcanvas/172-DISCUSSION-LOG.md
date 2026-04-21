# Phase 172: EditorCanvas - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-21
**Phase:** 172-editorcanvas
**Areas discussed:** Destroy safety scope, Status slot content, Selection propagation, NotebookExplorer mounting

---

## Destroy Safety Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Delegate to NE.destroy() | EditorCanvas.destroy() calls NotebookExplorer.destroy() which already flushes and unsubscribes. EditorCanvas only adds wrapper-div cleanup and status-el nulling. | ✓ |
| Wrapper intercepts first | EditorCanvas.destroy() does its own flush/cancel logic before calling NE.destroy(). More explicit control but duplicates NE's existing teardown. | |

**User's choice:** Delegate to NE.destroy()
**Notes:** NE has no debounced auto-save timer — uses shadow-buffer with blur-commit. The "4 provider handles" maps to NE's internal subscriptions.

### Follow-up: 600ms post-destroy assertion location

| Option | Description | Selected |
|--------|-------------|----------|
| Unit test in Phase 172 | EditorCanvas.test.ts asserts no bridge.send calls 600ms after destroy(). Catches regressions immediately. | ✓ |
| Defer to Phase 173 | Integration tests in Phase 173 cover all 3 canvases. Avoids duplicating assertion logic. | |

**User's choice:** Unit test in Phase 172

---

## Status Slot Content

| Option | Description | Selected |
|--------|-------------|----------|
| Card title only | Status slot shows the selected card's name/title. Simple, matches ECNV-02 exactly. Empty/idle shows 'No card selected'. | ✓ |
| Card title + type badge | Shows card title plus a small type indicator (e.g. the LATCH category). Richer info but may be noisy. | |
| Card title + modified state | Shows title with a dot/indicator when there are unsaved edits in the shadow buffer. Useful but adds complexity. | |

**User's choice:** Card title only
**Notes:** "No card selected" for idle state.

---

## Selection Propagation

| Option | Description | Selected |
|--------|-------------|----------|
| Pass-through only | EditorCanvas passes the shared SelectionProvider in NE config. NE already subscribes on mount and reads the current selection. No extra wiring needed. | ✓ |
| Eager query on mount | EditorCanvas explicitly reads SelectionProvider.getSelectedIds() on mount and pre-selects before NE subscribes. Belt-and-suspenders but may be redundant. | |

**User's choice:** Pass-through only
**Notes:** SelectionProvider is shared Tier 3 in-memory. NE already handles subscription and current-selection read internally.

---

## NotebookExplorer Mounting

| Option | Description | Selected |
|--------|-------------|----------|
| Config bag like ViewCanvas | EditorCanvasConfig with all 6 providers (bridge, selection, filter, alias, schema, mutations). Matches ViewCanvas pattern. main.ts wiring passes them at registration time. | ✓ |
| Minimal config + global access | EditorCanvas takes only canvasId + selection, fetches other providers from a global/singleton. Less boilerplate but breaks the explicit dependency pattern. | |

**User's choice:** Config bag like ViewCanvas
**Notes:** Consistent with ViewCanvas pattern from Phase 171.

---

## Claude's Discretion

- CSS class naming for wrapper div and status bar elements
- Status slot DOM setup approach (idempotent vs one-shot)
- Internal subscription callback structure
- Test file organization

## Deferred Ideas

None — discussion stayed within phase scope.
