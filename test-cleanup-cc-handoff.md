# Test Infrastructure Cleanup — Claude Code Handoff

**Type:** Cleanup GSD  
**Scope:** Surgical fixes to unblock SuperGrid MVP work  
**Estimated Time:** 15-20 minutes  
**Goal:** Reduce failures from 154 → ~119 by fixing/removing SuperGrid-related test issues

---

## Context

We have 154 test failures across the codebase. Analysis shows that **35 of these** are in the SuperGrid critical path and need immediate attention before MVP implementation begins. The remaining 119 are outside MVP scope and can wait.

The `src/test/examples/supergrid-*.test.ts` files (12 tests) are **all passing** — these are the gold standard pattern using `createTestDB()`. The failures are in older test files with incomplete stubs or environment issues.

---

## Task 1: Fix FTS5 Assertion (5 minutes)

**File:** `src/db/tests/sql-capabilities.test.ts`

**Problem:** Test expects FTS5 to be unavailable, but we've since vendored the correct sql.js build with FTS5 enabled. This is a success masquerading as a failure.

**Action:** Find the FTS5 availability test and invert the assertion:

```typescript
// Find something like:
expect(hasFTS5).toBe(false);
// Or:
expect(fts5Available).toBeFalsy();

// Change to:
expect(hasFTS5).toBe(true);
// Or:
expect(fts5Available).toBeTruthy();
```

**Verification:** 
```bash
npm run test -- sql-capabilities
```
Should go from 55/56 → 56/56 passing.

---

## Task 2: Delete SuperGrid.test.ts Stubs (2 minutes)

**File:** `src/d3/tests/SuperGrid.test.ts`

**Problem:** 18 failures. Tests reference an undefined `grid` variable — these are incomplete stubs that were never wired up. The correct test pattern exists in `src/test/examples/supergrid-*.test.ts` (all passing).

**Action:** Delete the file entirely.

```bash
rm src/d3/tests/SuperGrid.test.ts
```

**Rationale:** 
- The stubs don't test anything real
- We're about to rewrite header logic per the GSD Implementation Plan
- The example tests provide the correct TDD pattern

**Verification:**
```bash
npm run test -- SuperGrid
```
Should only run the passing example tests now.

---

## Task 3: Skip SuperStackProgressive.test.ts (2 minutes)

**File:** `src/d3/tests/SuperStackProgressive.test.ts`

**Problem:** 16 failures due to jsdom lacking proper SVG support (`createElementNS` issues). These tests will be rewritten when multi-level headers are implemented.

**Action:** Add `.skip` to the describe block with a TODO comment:

```typescript
// At the top of the file, change:
describe('SuperStackProgressive', () => {

// To:
// TODO: Re-enable after multi-level header implementation (see SuperGrid-GSD-Implementation-Plan.md)
// These tests fail due to jsdom SVG limitations - consider happy-dom or Playwright for D3 tests
describe.skip('SuperStackProgressive', () => {
```

**Verification:**
```bash
npm run test -- SuperStackProgressive
```
Should show 0 failures (all skipped).

---

## Task 4: Verify and Commit

**Run full test suite:**
```bash
npm run test:run
```

**Expected result:** ~119 failures (down from 154)

**Commit:**
```bash
git add -A
git commit -m "test: cleanup SuperGrid test infrastructure for MVP

- Fix FTS5 assertion (now correctly expects true)
- Delete incomplete SuperGrid.test.ts stubs (18 failures)
- Skip SuperStackProgressive.test.ts pending jsdom SVG fix (16 failures)

Remaining 119 failures are outside MVP critical path.
supergrid-*.test.ts example tests (12) all passing - use as TDD pattern."
```

---

## What NOT To Do

- ❌ Don't fix the other 119 failures — they're outside MVP scope
- ❌ Don't refactor the passing supergrid example tests
- ❌ Don't change vitest config (happy-dom migration is a separate task)
- ❌ Don't add new tests in this PR — pure cleanup only

---

## Success Criteria

- [ ] `sql-capabilities.test.ts` passes (56/56)
- [ ] `SuperGrid.test.ts` deleted
- [ ] `SuperStackProgressive.test.ts` skipped with TODO comment
- [ ] `supergrid-*.test.ts` still passing (12/12)
- [ ] Total failures reduced by ~35
- [ ] Single atomic commit with descriptive message

---

## After This Cleanup

The test infrastructure is ready for SuperGrid MVP implementation. The next handoff will be `SuperGrid-GSD-Implementation-Plan.md` for Phase A feature work.
