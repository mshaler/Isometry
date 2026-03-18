---
phase: quick
plan: sf4
subsystem: views, database, docs
tags: [d3-compliance, database-hardening, tech-debt]
dependency_graph:
  requires: []
  provides: [gallery-d3-join, database-init-guard]
  affects: [GalleryView, Database, CONCERNS.md]
tech_stack:
  added: []
  patterns: [d3-data-join-html-div]
key_files:
  created: []
  modified:
    - src/views/GalleryView.ts
    - tests/views/GalleryView.test.ts
    - src/database/Database.ts
    - .planning/codebase/CONCERNS.md
decisions: []
metrics:
  duration: 220s
  completed: "2026-03-18T00:34:31Z"
  tasks_completed: 3
  tasks_total: 3
---

# Quick Task sf4: Fix Actionable Code Concerns Summary

GalleryView converted from wipe-and-rebuild to D3 data join with key function `(d) => d.id`, Database.initialize() hardened with double-init guard, and 4 CONCERNS.md items resolved/accepted.

## What Was Done

### Task 1: Convert GalleryView to D3 data join (TDD)

Replaced the `while(firstChild) removeChild` + loop pattern with `d3.select(grid).selectAll().data(cards, (d) => d.id).join()`. The enter handler creates tile divs with image/icon content and name spans. The update handler efficiently updates only name text and audit attributes without recreating DOM nodes. The exit handler removes tiles for cards no longer in the dataset.

Also updated `_updateGalleryFocus()` to use `d3.select().selectAll().classed()` for consistency with the D3 pattern.

Moved `makeFallbackIcon()` to module-level function (no longer needs `this` context). Removed the `renderGalleryTile()` private method.

Added 6 new tests proving D3 data join enter/update/exit paths work correctly (15 total tests).

**Files:** `src/views/GalleryView.ts`, `tests/views/GalleryView.test.ts`
**Commit:** 2b10f5a7

### Task 2: Harden Database.applySchema() and simplify TD-02

Added `_initialized` boolean flag to Database class. `initialize()` now throws `"Database already initialized -- call close() first"` if called while already initialized. Flag is reset in `close()` to allow proper re-initialization after teardown.

Renamed `isNodeEnv` to `isTestEnv` in `applySchema()` since SQL_WASM_PATH is set exclusively by Vitest globalSetup (not a general Node.js detection).

**Files:** `src/database/Database.ts`
**Commit:** 8c5dd9ae

### Task 3: Update CONCERNS.md

- **TD-01:** Resolved -- GalleryView now uses D3 data join with key function
- **TD-02:** Accepted -- node:fs vs ?raw split is a necessary Vite/Vitest duality, variable naming clarified
- **BUG-01:** Resolved -- Database.initialize() has double-init guard
- **TD-06:** Resolved -- parseTableToMarkdown() already converts HTML tables from alto-index
- Removed GalleryView from Test Coverage Gaps table (now fully tested)

**Files:** `.planning/codebase/CONCERNS.md`
**Commit:** 87b725d9

## Deviations from Plan

None -- plan executed exactly as written.

## Verification Results

- `npx vitest run tests/views/GalleryView.test.ts` -- 15/15 passed
- `npx vitest run tests/database/Database.test.ts` -- 34/34 passed
- D3 key function `(d) => d.id` confirmed in GalleryView.ts
- 3 Resolved items confirmed in CONCERNS.md

## Self-Check: PASSED
