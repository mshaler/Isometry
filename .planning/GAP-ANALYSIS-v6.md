# Gap Analysis: Isometry v5 Web Runtime (v6)

**Date:** 2026-02-28  
**Replaces:** `.planning/GAP-ANALYSIS-v5.md`  
**Scope:** Compare canonical planning/spec docs to implemented codebase and define dependency-correct gap closure order.

---

## 1. Executive Summary

The codebase is in a strong **v0.1 Data Foundation complete** state and is verified by tests/typecheck.  
The **Web Runtime milestone (v1.0, Phases 3-6)** has not started in implementation terms.

Key correction from v5 analysis: next work must start with **Phase 3 Worker Bridge**, not PAFV/SuperGrid-first UI work.

---

## 2. Verified Current State

## 2.1 Implemented and Passing

- Database bootstrap with custom sql.js FTS5 WASM
- Canonical schema (`cards`, `connections`, `cards_fts`, `ui_state`)
- Card CRUD (soft delete + undelete)
- Connection CRUD (including `via_card_id` semantics)
- FTS search (rowid joins, rank ordering, snippets)
- Graph traversal and shortest path
- Performance assertion tests for PERF-01..04 on seeded large dataset

**Validation run (2026-02-28):**
- `npm run typecheck` → pass
- `npm test` → pass (151/151 tests)

## 2.2 Not Yet Implemented

- Phase 3: Worker Bridge (typed protocol + correlation IDs + worker handlers)
- Phase 4: Providers + SQL allowlist safety + MutationManager undo/redo + tier persistence
- Phase 5: D3 runtime views, transitions, search UX extensions, PERF-05
- Phase 6: ETL importers
- Phase 7: Native shell/platform safety

---

## 3. Architecture Gap Analysis

## 3.1 Gap A (Critical): Worker-First Runtime Layer Missing

**Required by spec/roadmap:** all DB operations off main thread via WorkerBridge.  
**Current:** all implemented DB/query APIs are direct in-process calls from library code.

**Consequence:** cannot safely build Providers and D3 runtime on intended architecture.

## 3.2 Gap B (Critical): SQL Safety + Provider Compilation Layer Missing

**Required:** allowlisted filter compilation, operator/field validation, parameterization enforcement at provider boundary (SAFE + PROV requirements).  
**Current:** query modules are parameterized, but provider-layer safety model does not exist yet.

**Consequence:** runtime filtering/axis remapping cannot be implemented in the intended secure pattern.

## 3.3 Gap C (Critical): MutationManager / Undo-Redo / Dirty Flag Missing

**Required:** command log with inverse operations, undo/redo shortcuts, write notification behavior.  
**Current:** no mutation command infrastructure exists.

**Consequence:** interactive view mutations (drag/drop, edits) would be non-compliant and hard to stabilize later.

## 3.4 Gap D (Major): D3 Runtime and View System Missing

**Required:** nine views, keyed D3 joins, view transitions, search UI behavior (debounce/keyboard/chips), render performance gate.  
**Current:** no D3 runtime implementation files exist.

**Consequence:** core v1 product value is not yet observable despite strong data foundation.

## 3.5 Gap E (Major): Planning/Tracking Consistency Drift

Some high-level requirement tracking documents still present pending/unchecked status for items already validated in v0.1 verification/milestone docs.

**Consequence:** verification signal can appear contradictory during milestone planning.

## 3.6 Gap F (Moderate): Known Deferred Technical Debt

- `withStatement` is a defined-but-throwing Phase 3+ entry point
- WKWebView MIME handling is a spike patch; full native solution deferred
- Dual-path schema load (`node:fs` vs `?raw`) remains in place

**Consequence:** acceptable in current phase, but should be intentionally addressed as runtime architecture is introduced.

---

## 4. Compare/Contrast vs v5 Gap Analysis

## 4.1 What v5 Got Right

- Correctly identified database/query layer as robust.
- Correctly identified UI runtime as largely unimplemented.
- Correctly called out worker offloading and D3 join discipline as important.

## 4.2 What v5 Needs Corrected

1. **Execution order:** recommended PAFV/UI-first sequencing conflicts with roadmap dependency graph.  
2. **Gap framing:** over-focuses on rendering and underweights missing Worker/Provider/Mutation safety layers.  
3. **Planning alignment:** should explicitly map next steps to Phase 3 → Phase 4 → Phase 5, not “Phase 3.1 PAFV Engine Foundation.”

---

## 5. Dependency-Correct Gap Closure Plan

## Phase 3 (First): Worker Bridge

1. Create worker entry, message envelope types, correlation map, and error propagation.
2. Route existing database/query operations through worker handlers.
3. Add WorkerBridge integration tests (including correlation/error paths).
4. Ensure main-thread runtime path contains zero direct sql.js execution.

## Phase 4 (Second): Providers + Mutation Safety

1. Implement SQL safety allowlists and compile-time/runtime validation rules.
2. Implement Filter/Axis(or canonical equivalent)/Selection/Density/View provider stack.
3. Implement tier persistence behavior and restore flow.
4. Implement MutationManager command log, inverse operations, dirty flag, undo/redo.

## Phase 5 (Third): D3 Views + Search UX

1. Implement views with strict keyed `.join()` pattern and minimal field projection queries.
2. Implement transitions and family-aware switching behavior.
3. Implement SRCH-05..07 UX requirements.
4. Add PERF-05 benchmarks/assertions and enforce the 16ms render target.

## Phase 6 (Fourth): ETL

1. Add importer pipeline per ETL-01..06 and idempotency/dedup guarantees.
2. Validate batch transaction and reporting behaviors.

---

## 6. Risks and Mitigations

1. **Risk:** Premature D3 implementation before Worker/Providers.  
   **Mitigation:** hard gate UI execution work until Phase 3/4 contracts pass.

2. **Risk:** Structured-clone overhead from oversized payloads.  
   **Mitigation:** enforce SQL projection discipline (no `SELECT *` in view queries).

3. **Risk:** Spec drift between canonical and supplemental docs.  
   **Mitigation:** treat roadmap + corrected requirements + core module contracts as precedence set during implementation.

---

## 7. Acceptance Criteria for This Gap Analysis

- Accurately reflects current codebase state (v0.1 complete, v1.0 runtime not started)
- Matches canonical dependency order (3 → 4 → 5 → 6)
- Explicitly identifies architecture-safety gaps (Worker/Provider/Mutation), not just rendering gaps
- Provides actionable next sequence for implementation planning

---

*Prepared after direct codebase/document review and local validation (`typecheck`, full test suite) on 2026-02-28.*
