---
phase: 92-card-creation-flow
plan: 01
subsystem: ui
tags: [notebook, creation-flow, state-machine, ime-guard, tdd]
dependency_graph:
  requires: [91-mutationmanager-notebook-migration]
  provides: [card-creation-state-machine, notebook-buffering-state]
  affects: [NotebookExplorer, SelectionProvider, MutationManager]
tech_stack:
  added: []
  patterns: [state-machine, blur-commit, ime-composition-guard, data-attribute-state]
key_files:
  created:
    - tests/seams/ui/notebook-creation-flow.test.ts
  modified:
    - src/ui/NotebookExplorer.ts
    - src/styles/notebook-explorer.css
    - tests/seams/ui/notebook-shadow-buffer.test.ts
decisions:
  - "_creationState string union ('idle' | 'buffering' | 'editing') — explicit state machine, not derived flags"
  - "blur handler is state-aware: buffering state routes to _evaluateBufferingCommit(), editing state routes to _commitTitle()"
  - "_deferredBlur flag tracks whether blur arrived during IME composition; compositionend re-evaluates"
  - "UUID extracted from mutation.forward[0].params[0] — createCardMutation puts id first per CARD_COLUMNS order"
  - "wasBuffering local captures state before _showEditor() resets it — enables post-creation textarea focus"
metrics:
  duration_seconds: 245
  completed_date: "2026-03-18"
  tasks_completed: 1
  tasks_total: 1
  files_created: 1
  files_modified: 3
requirements: [CREA-01, CREA-02, CREA-03, CREA-04, CREA-05]
---

# Phase 92 Plan 01: Card Creation State Machine Summary

**One-liner:** 3-state creation machine (idle/buffering/editing) with "New Card" button, IME guard, and createCardMutation + SelectionProvider auto-select wiring.

## What Was Built

NotebookExplorer gained a card creation state machine that prevents ghost cards while enabling fast card creation from the Notebook panel:

- **idle state**: Idle panel shows hint text + accent-colored "New Card" button
- **buffering state**: Title input visible, focused, no editor elements — holds name in memory only
- **editing state**: Full editor shown after card INSERT + selection load

State transitions are tracked via `data-creation-state` attribute on `.notebook-explorer` root for CSS-driven visibility and test assertions.

## Implementation Details

### State machine fields
```typescript
private _creationState: 'idle' | 'buffering' | 'editing' = 'idle';
private _isComposing = false;
private _deferredBlur = false;
```

### Key methods added
- `_enterBuffering()` — transitions to buffering, resets state, shows/hides correct elements
- `_evaluateBufferingCommit()` — trim-checks name, calls createCardMutation → MutationManager.execute() → SelectionProvider.select()
- `_abandonCreation()` — clears input, resets state, calls _showIdle()
- `enterCreationMode()` — public API for Cmd+N and Command Palette (Phase 02)

### Blur handler upgrade
The title input blur handler is now state-aware:
- buffering: routes to `_evaluateBufferingCommit()` (with IME deferral)
- editing: routes to `_commitTitle()` (existing shadow-buffer behavior)

### IME guard
`compositionstart` sets `_isComposing = true`. If blur fires while composing, sets `_deferredBlur = true` and returns. `compositionend` clears flag and re-evaluates if `_deferredBlur` is set.

### CSS additions
`.notebook-idle` updated to flex-column layout. New classes:
- `.notebook-idle-hint` — muted hint text
- `.notebook-new-card-btn` — accent-background primary CTA, 32px min-height, weight 600

## Tests

**notebook-creation-flow.test.ts** (6 tests, all pass):
1. Happy path: click → buffering → type → blur → INSERT + select
2. Abandon on empty blur → idle, no mutation
3. Abandon on Escape → idle, no mutation
4. IME guard: blur during composition deferred, commit after compositionend
5. Whitespace-only name → abandon, no mutation
6. data-creation-state attribute: idle → buffering → editing

**notebook-shadow-buffer.test.ts** (6 tests, all still pass):
- Updated Test 5 assertion to match new idle DOM structure (hint + button instead of plain textContent)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated shadow-buffer test assertion for new idle DOM structure**
- **Found during:** Task 1 — GREEN phase verification
- **Issue:** `notebook-shadow-buffer.test.ts` Test 5 asserted `idleEl.textContent === 'Select a card to start editing'` — the plain text that was replaced by structured DOM (p.notebook-idle-hint + button.notebook-new-card-btn)
- **Fix:** Updated assertion to query `.notebook-idle-hint` text and verify `.notebook-new-card-btn` exists
- **Files modified:** `tests/seams/ui/notebook-shadow-buffer.test.ts`
- **Commit:** ed82a05f (included in task commit)

## Self-Check: PASSED

- FOUND: src/ui/NotebookExplorer.ts
- FOUND: src/styles/notebook-explorer.css
- FOUND: tests/seams/ui/notebook-creation-flow.test.ts
- FOUND: commit ed82a05f
