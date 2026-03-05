# Deferred Items — Phase 24 SuperFilter

## Pre-existing Test Failures (Out of Scope)

### tests/worker/supergrid.handler.test.ts — 5 tests failing

**Status:** Pre-existing before Plan 24-02 execution (confirmed via git stash).

**Failures:**
- `handleSuperGridQuery > returns cells with card_ids split from comma-string to string[]`
- `handleSuperGridQuery > returns single cell with total count when both axes are empty`
- `handleSuperGridQuery > handles null card_ids (empty group) gracefully`
- `handleSuperGridQuery > handles empty string card_ids gracefully`
- `handleSuperGridQuery > returns empty cells array when db returns no results`

**Root cause:** `TypeError: db.prepare is not a function` — likely a mock setup issue in the worker test environment, not related to SuperFilter implementation.

**Action:** Do not fix — out of scope for Phase 24. Should be addressed in a dedicated bug-fix pass on worker handler tests.

---

*Created during Phase 24 Plan 02 execution.*
