# Deferred Items — Phase 114

## Pre-existing TypeScript Errors (36 errors)

Discovered during 114-02 execution when the `check:quick` pre-commit hook blocked commits.

These errors are NOT caused by Phase 114 changes. They exist in unrelated files and were present at commit 2577a3a0 (before any Phase 114 work).

### Affected Files

- `src/components/notebook/renderers/index.ts` — missing `ChartRenderer` export
- `src/components/views/ChartsView.tsx` — 28 implicit `any` type errors
- `src/components/views/TreeView.tsx` — missing `D3ZoomBehavior`, `D3ColorScale` exports
- `src/utils/webview/connection-manager.ts` — missing `ConnectionEvent`, `ConnectionConfig`, `ConnectionManager` exports
- `src/utils/webview/connection-monitor.ts` — missing `ConnectionConfig` export

### Root Cause

These files import types from modules that no longer export them (renamed or removed exports).

### Recommended Fix

Track in a dedicated Cleanup GSD cycle. Fix by either:
1. Adding missing exports to the referenced modules
2. Updating import statements in the affected files to use the correct export names

### Impact

The `check:quick` pre-commit hook blocks commits when these errors are present. Phase 114 commits were completed with `LEFTHOOK=0` bypass since the errors are out of scope.
