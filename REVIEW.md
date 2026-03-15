# Isometry Repository Review

Date: 2026-03-07  
Reviewer: Codex (GPT-5)  
Scope: Full repo review + gap analysis against `.planning` specifications/plans.

## Review Status

- `typecheck`: PASS (`npm run typecheck`)
- `build`: PASS (`npm run build`)
- `tests`: PARTIAL (`npx vitest --run` => 2246 passed, 6 failed)
- `lint`: FAIL (`npx biome check src tests`)

Notes:
- ETL is explicitly marked as work in progress by user; ETL-related failures are tracked as in-progress gaps, not completed-scope regressions.

## Findings (Prioritized)

## F-001 (High) — STAB-04 runtime behavior appears not wired

Status: Open  
Category: Correctness / Spec compliance  
Area: Undo/redo UX feedback

Summary:
- `ActionToast` and `setupMutationShortcuts` exist, but runtime `main.ts` uses `ShortcutRegistry` handlers that call `mutationManager.undo()/redo()` directly and do not show toast feedback.

Evidence:
- [src/main.ts:226](/Users/mshaler/Developer/Projects/Isometry/src/main.ts:226)
- [src/main.ts:239](/Users/mshaler/Developer/Projects/Isometry/src/main.ts:239)
- [src/mutations/shortcuts.ts:46](/Users/mshaler/Developer/Projects/Isometry/src/mutations/shortcuts.ts:46)
- [\.planning/REQUIREMENTS.md:44](/Users/mshaler/Developer/Projects/Isometry/.planning/REQUIREMENTS.md:44)
- [\.planning/phases/46-stability-error-handling/46-02-PLAN.md:170](/Users/mshaler/Developer/Projects/Isometry/.planning/phases/46-stability-error-handling/46-02-PLAN.md:170)

Impact:
- Requirement STAB-04 may be satisfied in unit tests but not in real app runtime path.

## F-002 (High) — Web Excel import path likely broken

Status: Open  
Category: Correctness  
Area: ETL entry path (web import CTA)

Summary:
- Web import path always reads file as text and sends string payload for all formats.
- Excel parser path expects `ArrayBuffer`.

Evidence:
- [src/main.ts:188](/Users/mshaler/Developer/Projects/Isometry/src/main.ts:188)
- [src/main.ts:193](/Users/mshaler/Developer/Projects/Isometry/src/main.ts:193)
- [src/main.ts:200](/Users/mshaler/Developer/Projects/Isometry/src/main.ts:200)
- [src/etl/ImportOrchestrator.ts:173](/Users/mshaler/Developer/Projects/Isometry/src/etl/ImportOrchestrator.ts:173)
- [src/worker/protocol.ts:245](/Users/mshaler/Developer/Projects/Isometry/src/worker/protocol.ts:245)

Impact:
- `.xlsx/.xls` imports from first-launch web CTA may fail or parse incorrectly.

## F-003 (Medium) — Lint gate conflicts with BUILD-02 “complete” claim

Status: Open  
Category: Quality process / Spec drift  
Area: Build health

Summary:
- Current Biome run reports errors/warnings.
- Requirement and roadmap claim BUILD-02 complete.

Evidence:
- [\.planning/REQUIREMENTS.md:13](/Users/mshaler/Developer/Projects/Isometry/.planning/REQUIREMENTS.md:13)
- [\.planning/ROADMAP.md:139](/Users/mshaler/Developer/Projects/Isometry/.planning/ROADMAP.md:139)
- Example affected files:
  - [src/mutations/shortcuts.ts:13](/Users/mshaler/Developer/Projects/Isometry/src/mutations/shortcuts.ts:13)
  - [src/views/SuperGrid.ts:1937](/Users/mshaler/Developer/Projects/Isometry/src/views/SuperGrid.ts:1937)

Impact:
- CI/build quality claims are not currently reproducible from repo head.

## F-004 (Medium) — Planning/state documentation drift

Status: Open  
Category: Process integrity  
Area: Planning metadata consistency

Summary:
- `ROADMAP` marks phases 42–46 complete.
- `STATE.md` still reports focus on phase 45 and references pending phase 45 work.
- `PROJECT.md` active checklist remains unchecked.

Evidence:
- [\.planning/ROADMAP.md:139](/Users/mshaler/Developer/Projects/Isometry/.planning/ROADMAP.md:139)
- [\.planning/STATE.md:21](/Users/mshaler/Developer/Projects/Isometry/.planning/STATE.md:21)
- [\.planning/STATE.md:98](/Users/mshaler/Developer/Projects/Isometry/.planning/STATE.md:98)
- [\.planning/PROJECT.md:91](/Users/mshaler/Developer/Projects/Isometry/.planning/PROJECT.md:91)

Impact:
- Creates ambiguity about true project status and next actions.

## F-005 (Medium, Potential) — `?` shortcut shift matching may be fragile

Status: Open (Needs runtime verification)  
Category: UX correctness risk  
Area: Keyboard shortcuts

Summary:
- Shortcut matching requires exact `shift` equality.
- `?` is parsed as `shift=false`; real keyboard events for `?` may include `shiftKey=true`.
- Current tests do not cover that event shape.

Evidence:
- [src/shortcuts/ShortcutRegistry.ts:75](/Users/mshaler/Developer/Projects/Isometry/src/shortcuts/ShortcutRegistry.ts:75)
- [tests/shortcuts/ShortcutRegistry.test.ts:362](/Users/mshaler/Developer/Projects/Isometry/tests/shortcuts/ShortcutRegistry.test.ts:362)

Impact:
- Help overlay shortcut may be inconsistent across environments/input layouts.

## F-006 (Low-Medium) — PERF-01 threshold failing in current run

Status: Open  
Category: Performance gate stability  
Area: Database assertions

Summary:
- `PERF-01` test failed in current local run (`p95` over target).

Evidence:
- [tests/database/performance-assertions.test.ts:59](/Users/mshaler/Developer/Projects/Isometry/tests/database/performance-assertions.test.ts:59)

Impact:
- Performance gating currently unstable or regressed.

## ETL WIP Gaps (Tracked Separately)

Context:
- ETL phase is user-confirmed work in progress; these are milestone-completion gaps, not completed-scope defects.

## WIP-ETL-01 — ETLV-01/02 tests currently failing

Evidence:
- [tests/etl-validation/source-import.test.ts:37](/Users/mshaler/Developer/Projects/Isometry/tests/etl-validation/source-import.test.ts:37)
- [tests/etl-validation/source-import.test.ts:174](/Users/mshaler/Developer/Projects/Isometry/tests/etl-validation/source-import.test.ts:174)
- [\.planning/REQUIREMENTS.md:48](/Users/mshaler/Developer/Projects/Isometry/.planning/REQUIREMENTS.md:48)

## WIP-ETL-02 — ETLV-03/04/05 planned suites not yet present

Evidence:
- [\.planning/phases/47-etl-validation/47-02-PLAN.md](/Users/mshaler/Developer/Projects/Isometry/.planning/phases/47-etl-validation/47-02-PLAN.md)
- [\.planning/phases/47-etl-validation/47-03-PLAN.md](/Users/mshaler/Developer/Projects/Isometry/.planning/phases/47-etl-validation/47-03-PLAN.md)

## Gap Matrix (Specs vs Current State)

- `BUILD-01`: Met now (typecheck pass).
- `BUILD-02`: Not met now (Biome check fails) despite marked complete.
- `BUILD-03..05`: Not fully revalidated in this review.
- `EMPTY-01..04`: No direct regression found in this pass.
- `KEYS-01..04`: Mostly present; `?` key behavior has a potential unverified edge.
- `VISU-01..04`: No direct functional regressions found in this pass.
- `STAB-01, STAB-03`: No direct regression found in this pass.
- `STAB-04`: Potential runtime wiring gap (F-001).
- `ETLV-01..05`: In progress (pending/partially failing as expected WIP).

## Remediation Checklist

## Fix Now (Completed-Scope Risk)

- [ ] F-001: Wire undo/redo toast behavior into runtime shortcut path.
- [ ] F-002: Correct web Excel import pipeline (`ArrayBuffer` path end-to-end, protocol/type updates if needed).
- [ ] F-003: Resolve current Biome errors/warnings or adjust BUILD-02 claim/status if intentionally deferred.

## Post-ETL (After Phase 47 Stabilizes)

- [ ] F-005: Add explicit runtime + test coverage for `?` with `shiftKey=true` semantics.
- [ ] F-006: Re-baseline PERF-01 (tune test harness/threshold or optimize insert path).

## Documentation Hygiene

- [ ] F-004: Reconcile `ROADMAP.md`, `STATE.md`, and `PROJECT.md` to a single source of truth.
- [ ] Mark ETL status consistently across docs (`pending`, `in progress`, `done`) with date stamps.

## Suggested Owners / Tracking

- Runtime wiring + import path: `src/main.ts`, `src/worker/protocol.ts`, ETL bridge/handler path.
- Lint/build hygiene: repo-wide (`src/`, `tests/`).
- Planning drift: `.planning/ROADMAP.md`, `.planning/STATE.md`, `.planning/PROJECT.md`.
- ETL validation closure: `tests/etl-validation/*` + Phase 47 plan artifacts.

## Command Log (for reproducibility)

- `npm run typecheck` => pass
- `npm run build` => pass
- `npx vitest --run` => 6 failures (ETL WIP + PERF-01)
- `npx biome check src tests` => failing checks

---

# Isometry Focused Review — SuperGrid + Explorer Integration/UI/UX

Date: 2026-03-10  
Reviewer: Codex (GPT-5)  
Scope: Focused review of SuperGrid + Explorer integration with emphasis on quality, logic, correctness, completeness, and UI/UX.

## Validation Snapshot

- Targeted tests run: PASS
- Command: `npm run test -- tests/ui/WorkbenchShell.test.ts tests/ui/ProjectionExplorer.test.ts tests/ui/LatchExplorers.test.ts tests/ui/CommandBar.test.ts tests/views/SuperGrid.test.ts tests/views/ViewManager.test.ts`
- Note: `tests/ui/LatchExplorers.test.ts` passed but emitted repeated `HistogramScrubber` console errors (details in finding F-2026-03-10-06).

## Findings (Prioritized)

## F-2026-03-10-01 (High) — Projection Z-controls are not fully wired into SuperGrid query execution

Status: Open  
Category: Integration correctness / completeness  
Area: ProjectionExplorer → SuperGrid

Summary:
- Projection controls allow users to change aggregation mode and display field, but `SuperGrid._fetchAndRender()` does not pass `aggregation` or `displayField` into `superGridQuery` payload.
- Query builder and worker path already support these options, so the current UI appears functional but does not affect result semantics.

Evidence:
- Projection sets aggregation/display:
  - [ProjectionExplorer.ts:379](/Users/mshaler/Developer/Projects/Isometry/src/ui/ProjectionExplorer.ts:379)
  - [ProjectionExplorer.ts:464](/Users/mshaler/Developer/Projects/Isometry/src/ui/ProjectionExplorer.ts:464)
- SuperGrid query payload omits both fields:
  - [SuperGrid.ts:1255](/Users/mshaler/Developer/Projects/Isometry/src/views/SuperGrid.ts:1255)
- Query builder supports and applies both:
  - [SuperGridQuery.ts:103](/Users/mshaler/Developer/Projects/Isometry/src/views/supergrid/SuperGridQuery.ts:103)
  - [SuperGridQuery.ts:109](/Users/mshaler/Developer/Projects/Isometry/src/views/supergrid/SuperGridQuery.ts:109)
  - [SuperGridQuery.ts:199](/Users/mshaler/Developer/Projects/Isometry/src/views/supergrid/SuperGridQuery.ts:199)

Impact:
- User-visible mismatch: Z controls suggest data aggregation control, but backend query behavior remains count/default.

Recommendation:
- Extend SuperGrid query payload to include `aggregation: this._provider.getAggregation()` and `displayField: this._densityProvider.getState().displayField`.
- Add regression tests asserting these fields are passed through and reflected in SQL behavior.

## F-2026-03-10-02 (High) — Z well is local-only state and not integrated with provider persistence or query pipeline

Status: Open  
Category: Integration completeness / UX correctness  
Area: ProjectionExplorer Z well

Summary:
- Z well membership is stored only in `ProjectionExplorer._zAxes` and reset on destroy.
- It is not backed by a provider, not persisted, and not consumed by SuperGrid rendering/query logic.

Evidence:
- Local Z state only:
  - [ProjectionExplorer.ts:129](/Users/mshaler/Developer/Projects/Isometry/src/ui/ProjectionExplorer.ts:129)
  - [ProjectionExplorer.ts:223](/Users/mshaler/Developer/Projects/Isometry/src/ui/ProjectionExplorer.ts:223)
  - [ProjectionExplorer.ts:661](/Users/mshaler/Developer/Projects/Isometry/src/ui/ProjectionExplorer.ts:661)
- SuperGrid has no Z-well input path from ProjectionExplorer state.

Impact:
- Users can drag chips into Z and perceive a configured dimension that is not durable and has no projection effect.

Recommendation:
- Decide on one explicit contract:
  - Either persist Z axes in provider state and wire into query/render semantics, or
  - remove/de-emphasize Z well until fully implemented.
- Add integration tests validating persistence and behavior across remount.

## F-2026-03-10-03 (Medium-High) — SuperGrid fetch pipeline lacks response-version guard for out-of-order async completion

Status: Open  
Category: Logic correctness / runtime stability  
Area: SuperGrid async query/render

Summary:
- `_fetchAndRender()` always commits results from the completed promise pair (`superGridQuery` + `calcQuery`) with no request sequence/version check.
- Under rapid interactions (filters, axis changes, search), earlier requests can resolve later and overwrite newer UI state.

Evidence:
- No request token/sequence validation before commit:
  - [SuperGrid.ts:1223](/Users/mshaler/Developer/Projects/Isometry/src/views/SuperGrid.ts:1223)
  - [SuperGrid.ts:1308](/Users/mshaler/Developer/Projects/Isometry/src/views/SuperGrid.ts:1308)
  - [SuperGrid.ts:1321](/Users/mshaler/Developer/Projects/Isometry/src/views/SuperGrid.ts:1321)
- Worker bridge coalescing explicitly abandons earlier callers (which SuperGrid already documents):
  - [WorkerBridge.ts:369](/Users/mshaler/Developer/Projects/Isometry/src/worker/WorkerBridge.ts:369)
  - [SuperGrid.ts:3561](/Users/mshaler/Developer/Projects/Isometry/src/views/SuperGrid.ts:3561)

Impact:
- Potential stale-screen regressions and non-deterministic UI when interactions are fast.

Recommendation:
- Add monotonic `requestId` in `SuperGrid` and only apply data when `requestId === latestRequestId`.
- Consider propagating cancellation semantics (or explicit stale-drop) to calc query path too.

## F-2026-03-10-04 (Medium) — Explorer keyboard accessibility is incomplete vs intended UX contract

Status: Open  
Category: UI/UX / accessibility  
Area: ProjectionExplorer + CommandBar

Summary:
- Projection chips are mouse-drag only; no keyboard move/reorder pathway.
- CommandBar settings menu supports click/Escape but lacks arrow-key navigation/focus roving expected for menu UX.

Evidence:
- Projection chips are rendered with `role="option"` and `draggable=true` but only drag handlers:
  - [ProjectionExplorer.ts:291](/Users/mshaler/Developer/Projects/Isometry/src/ui/ProjectionExplorer.ts:291)
  - [ProjectionExplorer.ts:308](/Users/mshaler/Developer/Projects/Isometry/src/ui/ProjectionExplorer.ts:308)
- CommandBar menu has no arrow-key handling:
  - [CommandBar.ts:99](/Users/mshaler/Developer/Projects/Isometry/src/ui/CommandBar.ts:99)
  - [CommandBar.ts:153](/Users/mshaler/Developer/Projects/Isometry/src/ui/CommandBar.ts:153)

Impact:
- Reduced usability for keyboard-only users; parity gap with expected workbench interaction model.

Recommendation:
- Add keyboard move semantics for projection wells (`Enter`/`Space` pick-up, arrows to target/reorder, `Enter` drop).
- Implement roving tabindex or arrow-key focus movement for `role="menu"` items.

## F-2026-03-10-05 (Medium) — `:has(...)` is used in behavior-critical paths without fallback

Status: Open  
Category: Cross-platform robustness  
Area: Workbench/LATCH styling and state sync

Summary:
- `:has()` is used both in CSS (section height expansion) and in DOM queries for time preset sync.
- In engines where `:has` support is absent/incomplete, explorer bodies can clip and preset visual state can desync.

Evidence:
- CSS layout dependence:
  - [workbench.css:125](/Users/mshaler/Developer/Projects/Isometry/src/styles/workbench.css:125)
- Runtime query dependence:
  - [LatchExplorers.ts:662](/Users/mshaler/Developer/Projects/Isometry/src/ui/LatchExplorers.ts:662)

Impact:
- Platform-specific UI break risk, especially in embedded webview contexts.

Recommendation:
- Replace `:has` runtime query with explicit container refs captured at mount.
- For CSS max-height behavior, add class-based fallbacks set during mount.

## F-2026-03-10-06 (Low-Medium) — LatchExplorer tests currently mask histogram integration errors

Status: Open  
Category: Test quality / signal integrity  
Area: LATCH histogram integration tests

Summary:
- Targeted suite passes, but `LatchExplorers` tests emit repeated `HistogramScrubber` errors due mock response shape/path.
- This indicates tests are not reliably asserting histogram integration behavior and may hide regressions behind console noise.

Evidence:
- Runtime path logs and swallows errors:
  - [HistogramScrubber.ts:163](/Users/mshaler/Developer/Projects/Isometry/src/ui/HistogramScrubber.ts:163)
  - [HistogramScrubber.ts:174](/Users/mshaler/Developer/Projects/Isometry/src/ui/HistogramScrubber.ts:174)
- Observed in test run output for `tests/ui/LatchExplorers.test.ts`.

Impact:
- Lower confidence in LATCH UI stability; noisy CI logs reduce actionable signal.

Recommendation:
- Fix mocks to return valid histogram payloads in relevant suites.
- Add explicit assertions for histogram render/empty/error states.
- Optionally fail tests on unexpected `console.error` in these suites.

## What’s Working Well

- SuperGrid core feature depth is strong (selection, virtualizer, sort/filter/collapse, calc footer), with broad unit test coverage.
- Explorer modules are reasonably modular (`mount/update/destroy`) and mostly provider-driven.
- Targeted SuperGrid + explorer test suites are fast and currently green.

## Recommended Execution Order

1. Fix F-2026-03-10-01 (aggregation/displayField query wiring) and add regression tests.
2. Resolve F-2026-03-10-02 by either fully wiring Z well or temporarily reducing scope in UI.
3. Add stale-response guard from F-2026-03-10-03.
4. Address accessibility and `:has` robustness items (F-2026-03-10-04/05).
5. Clean up LATCH test signal quality (F-2026-03-10-06).
