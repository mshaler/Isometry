# Phase 154: Regression Guard + Hardening - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-17
**Phase:** 154-regression-guard-hardening
**Areas discussed:** Test scope & granularity, Test file organization, Regression fix scope

---

## Test Scope & Granularity

| Option | Description | Selected |
|--------|-------------|----------|
| Seam tests only | jsdom, fast, matches existing `tests/seams/ui/` pattern | |
| E2E only | Playwright, real browser, high confidence | |
| Both layers | Seam for wiring + one E2E for smoke | ✓ |

**User's choice:** Both layers — seam tests for wiring logic, plus one Playwright E2E spec as smoke test
**Notes:** Seam tests are the natural fit for DOM wiring assertions; E2E adds confidence for the full dock-toggle-to-visibility flow.

---

## Test File Organization

| Option | Description | Selected |
|--------|-------------|----------|
| Single seam file + single E2E file | One `inline-embedding.test.ts` in seams with describe blocks per flow, one E2E spec | ✓ |
| Per-flow seam files + single E2E | Separate files per flow (top-slot, projections, bottom-slot) + one E2E | |
| Single file for everything | One seam file covering all flows, no E2E separation | |

**User's choice:** Single seam file with describe blocks + single E2E file
**Notes:** Keeps both layers organized without tripling setup boilerplate. Describe blocks provide per-flow granularity within the single file.

---

## Regression Fix Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Strict scope | Only fix regressions traceable to Phase 151-153 changes | |
| Fix anything red | If suite isn't green, fix it regardless of cause | ✓ |
| Already green — focus on new tests | Acknowledge green baseline, only fix if something breaks during this phase | |

**User's choice:** Fix anything red
**Notes:** Suite was already green (4,334 tests, 210 files) at time of discussion. Decision means any failure encountered is fair game to fix.

---

## Claude's Discretion

- Seam test setup strategy (how much of WorkbenchShell/DockNav to instantiate vs stub)
- E2E spec granularity (one test per flow vs combined assertions)
- Whether seam test reuses `makeProviders()` or uses lighter harness
- Describe block naming within seam file

## Deferred Ideas

None — discussion stayed within phase scope
