# Deferred Items — Phase 23 SuperSort

## Pre-Existing Test Failures (Out of Scope for Plan 23-02)

### 1. tests/worker/supergrid.handler.test.ts — 6 failures
- **Origin:** Pre-existing before Plan 23-02 execution
- **Tests:** `handleSuperGridQuery` handler tests failing with `db.prepare is not a function`
- **Status:** Out of scope — pre-existing issue not caused by Plan 23-02 changes

### 2. tests/providers/PAFVProvider.test.ts — 14 sortOverrides failures
- **Origin:** Pre-existing working-directory changes (plan 23-03 tests written ahead of implementation)
- **Tests:** `PAFVProvider — sortOverrides` describe blocks require `getSortOverrides()` and `setSortOverrides()` methods that will be implemented in Plan 23-03
- **Status:** Expected — will be resolved in Plan 23-03 (PAFVProvider.sortOverrides implementation)
