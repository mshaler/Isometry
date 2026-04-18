---
phase: 157-persistence-schemaprovider-wiring
plan: 01
status: complete
started: 2026-04-17T19:34:00-07:00
completed: 2026-04-17T19:37:00-07:00
---

## Summary

Migrated PropertiesExplorer from localStorage to bridge ui:set/ui:get for all durable state (BEHV-04, BEHV-05).

### What Changed

- Removed all 6 localStorage calls (5 column collapse + 1 depth)
- `mount()` is now async — reads `props:col-collapse` and `props:depth` from bridge before building DOM
- Column toggle writes collapse state as JSON to `props:col-collapse` via bridge
- Depth change writes to `props:depth` via bridge
- Added `_persistCollapseState()` and `_persistDepth()` helper methods
- Graceful degradation: when no bridge is configured, defaults apply silently
- Updated `main.ts` to use `void propertiesExplorer.mount()` (fire-and-forget since subscribe wiring happens synchronously)
- Updated 4 existing Phase 73 tests to await async mount()
- Updated 2 old collapse tests from localStorage to bridge assertions

### Key Files

- `src/ui/PropertiesExplorer.ts` — zero localStorage, async mount with bridge restore
- `tests/ui/PropertiesExplorer.test.ts` — 6 new persistence migration tests, 4 updated Phase 73 tests
- `src/main.ts` — `void propertiesExplorer.mount()` call site update

### Verification

- `grep -c 'localStorage' src/ui/PropertiesExplorer.ts` → 0
- 43/43 PropertiesExplorer tests pass
- `npx tsc --noEmit` clean

### Self-Check: PASSED
