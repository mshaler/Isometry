---
phase: 157-persistence-schemaprovider-wiring
plan: 02
status: complete
started: 2026-04-17T19:41:00-07:00
completed: 2026-04-17T19:43:00-07:00
---

## Summary

Wired CalcExplorer and AlgorithmExplorer to SchemaProvider for dynamic numeric field detection (BEHV-06, BEHV-07).

### What Changed

- **CalcExplorer**: Deleted `NUMERIC_FIELDS_FALLBACK` constant. `_isNumeric()` now uses SchemaProvider exclusively — returns `false` when schema is not initialized (safe default: all fields show COUNT only). Added schema subscription that triggers `_render()` on change. `destroy()` unsubscribes.
- **AlgorithmExplorer**: `_getNumericConnectionColumns()` now queries `SchemaProvider.getColumns('connections').filter(c => c.isNumeric)` instead of returning `[]`. Runtime behavior unchanged (connections table has no user-defined numeric columns by default), but custom numeric connection attributes now auto-surface in weight picker.

### Key Files

- `src/ui/CalcExplorer.ts` — schema subscription, fallback deleted, _isNumeric uses schema only
- `src/ui/AlgorithmExplorer.ts` — _getNumericConnectionColumns uses SchemaProvider
- `tests/ui/CalcExplorer.test.ts` — 4 new tests covering schema wiring

### Verification

- `grep -c 'NUMERIC_FIELDS_FALLBACK' src/ui/CalcExplorer.ts` → 0
- `npx vitest run tests/ui/CalcExplorer.test.ts` → 4/4 pass
- `npx tsc --noEmit` clean

### Self-Check: PASSED
