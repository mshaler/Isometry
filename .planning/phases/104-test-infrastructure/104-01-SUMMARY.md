---
phase: 104-test-infrastructure
plan: "01"
subsystem: test-infrastructure
tags: [test-helpers, plugin-registry, vitest, jsdom]
dependency_graph:
  requires: []
  provides: [makePluginHarness, usePlugin, mockContainerDimensions]
  affects: [tests/views/pivot/helpers]
tech_stack:
  added: []
  patterns: [harness-factory, auto-destroy-afterEach, jsdom-defineProperty]
key_files:
  created:
    - tests/views/pivot/helpers/makePluginHarness.ts
    - tests/views/pivot/helpers/usePlugin.ts
    - tests/views/pivot/helpers/mockContainerDimensions.ts
    - tests/views/pivot/helpers/pluginHarness.test.ts
  modified: []
decisions:
  - "usePlugin uses bracket notation to access registry._plugins (test-only, avoids production API surface change)"
  - "makePluginHarness.ts was pre-committed via feat(104-02); remaining 3 files committed in this plan"
metrics:
  duration: "~8 minutes"
  completed: "2026-03-22"
  tasks_completed: 2
  tasks_total: 2
  files_created: 4
  files_modified: 0
requirements: [INFR-01, INFR-02, INFR-03]
---

# Phase 104 Plan 01: Test Infrastructure Summary

**One-liner:** Shared Vitest harness factory (makePluginHarness), auto-destroy wrapper (usePlugin), and jsdom dimension mock (mockContainerDimensions) eliminating boilerplate across 11+ plugin test files.

## What Was Built

Three helper modules in `tests/views/pivot/helpers/` plus a 21-test verification suite:

1. **makePluginHarness.ts** — One-call factory returning `{ registry, catalog, ctx, enable, disable, runPipeline }`. Creates a fresh `PluginRegistry`, calls `registerCatalog()` to wire all 27 plugins with real shared state, and builds a `RenderContext` from configurable options (rows, cols, containerHeight, data).

2. **usePlugin.ts** — Auto-destroy wrapper that calls `harness.enable(pluginId)`, retrieves the `PluginHook` instance from the registry's private `_plugins` map (bracket notation, test-only), and registers an `afterEach` cleanup that calls `harness.disable(pluginId)` (triggering `destroy()`).

3. **mockContainerDimensions.ts** — Uses `Object.defineProperty` with `configurable: true` to mock `clientHeight`, `clientWidth`, `scrollTop`, `scrollLeft`, and `getBoundingClientRect` on jsdom `HTMLElement` instances without per-file prototype patching.

4. **pluginHarness.test.ts** — 21 tests across 3 describe blocks covering all helper behaviors; uses `// @vitest-environment jsdom` annotation.

## Task Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create makePluginHarness, usePlugin, mockContainerDimensions | ef82c71c (prior) + 27e5ce70 | 4 helper files |
| 2 | Write tests proving all three helpers work | 27e5ce70 | pluginHarness.test.ts |

## Verification

- `npx vitest run tests/views/pivot/helpers/pluginHarness.test.ts` — 21/21 tests pass
- `npx tsc --noEmit` — no errors in new files
- Pre-existing failures (9 test files: source-view-matrix, CommandBar, ProjectionExplorer, ListView, KanbanView, dataset-eviction) are unrelated to this plan's changes

## Deviations from Plan

### Context Discovered

**makePluginHarness.ts was already committed** (ef82c71c as part of feat(104-02)) before this plan execution began. The remaining 3 files (usePlugin.ts, mockContainerDimensions.ts, pluginHarness.test.ts) were untracked and were implemented fresh.

No behavioral deviations — all helpers match the plan spec exactly.

## Self-Check: PASSED

All 4 files exist on disk. Both commits (ef82c71c, 27e5ce70) verified in git log. All 21 tests pass.
