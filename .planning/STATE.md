---
gsd_state_version: 1.0
milestone: v6.1
milestone_name: Test Harness
status: unknown
last_updated: "2026-03-17T12:14:23Z"
progress:
  total_phases: 5
  completed_phases: 4
  total_plans: 11
  completed_plans: 11
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-15)

**Core value:** SuperGrid renders imported data through PAFV spatial projection with zero serialization -- sql.js queries directly feed D3.js data joins.
**Current focus:** v6.1 Test Harness -- Phase 82 (UI Control Seams A)

## Current Position

Phase: 82 (4 of 5 in v6.1) [UI Control Seams A]
Plan: 2 of 2 in current phase (COMPLETE)
Status: Complete
Last activity: 2026-03-17 -- Completed 82-02: CommandBar + ShortcutRegistry destroy seam tests (12 tests: CMDB-01..02)

Progress: [████████░░] 80%

## Performance Metrics

**Velocity:**
- v6.0 milestone: 5 phases, 13 plans in 2 days
- v5.3 milestone: 5 phases, 12 plans in 1 day
- v5.2 milestone: 7 phases, 13 plans in 2 days
- v5.1 milestone: 4 phases, 7 plans in 1 day
- v5.0 milestone: 4 phases, 11 plans in 1 day

*Updated after each plan completion*

## Accumulated Context

### Decisions

All TypeScript architectural decisions locked (D-001..D-011). Full logs in PROJECT.md.
All v6.0 performance decisions archived to `.planning/milestones/v6.0-ROADMAP.md`.

v6.1-specific:
- Anti-patching rule: if a test fails, fix the app -- never weaken the assertion
- Seam tests live in tests/seams/ with domain subdirs (filter/coordinator/ui/etl) for Phases 80-83
- realDb.ts factory replaces seed.ts for lightweight seam tests — tests/harness/ is the shared factory dir
- seedConnections uses source_id/target_id (actual schema columns, not from_card_id/to_card_id)
- test:seams uses --passWithNoTests so it exits 0 before Phase 80 adds tests
- [Phase 84-ui-polish]: WA5: HistogramScrubber lazy-creates error element on first failure; _showError/_clearError lifecycle; Retry calls _fetchAndRender()
- [Phase 84]: Roving tabindex pattern for CommandBar (ArrowDown/Up/Home/End) and ViewTabBar (ArrowLeft/Right/Home/End) — one tabindex=0 per component, rest -1
- [Phase 84]: AppDialog.show() uses native <dialog> element — built-in a11y + ::backdrop without extra markup
- [Phase 84]: Spread projectionOpt only when aggregation \!== 'count' to preserve backward compat — count is the default mode
- [Phase 84-02]: data-attribute-over-has pattern — dataset attributes for behavioral DOM queries instead of :has() CSS selectors; class-based CSS rule before progressive-enhancement :has()
- [Phase 84]: setState idempotent via early-return guard; setSectionState on WorkbenchShell adds has-explorer class for Plan 02 CSS sync; data-section-state on root element for CSS selector specificity
- [Phase 80]: SQLite LIKE case-insensitive for ASCII only — Epsilon has no 'a', correct to exclude from %a% results
- [Phase 80]: FTS trigger fires on INSERT regardless of deleted_at — exclusion happens via deleted_at IS NULL in compile().where
- [Phase 80-02]: SQLite GROUP_CONCAT does not respect outer ORDER BY within aggregate groups — insertion order is used; test for card membership not sequence when asserting name-based sort
- [Phase 81-coordinator-density-seams]: Bridge spy captures state inside coordinator callback at fire-time — matches production pattern
- [Phase 82-ui-control-seams-a-02]: jsdom isMac=false (navigator.platform empty) — Cmd maps to ctrlKey for ShortcutRegistry seam tests
- [Phase 82-ui-control-seams-a-02]: Input field guard test: dispatch from INPUT element (bubbles:true) so event.target is the input, not document
- [Phase 82-ui-control-seams-a-02]: CommandPalette _keydownHandler is on input element (not document) — post-destroy verification asserts no errors, not callback count

### Blockers/Concerns

- SQL budget tests fail in full-suite parallel runs due to CPU contention -- pre-existing, not a regression

## Session Continuity

Last session: 2026-03-17
Stopped at: Completed 82-02-PLAN.md: CommandBar + ShortcutRegistry Destroy Seam Tests (12 tests across CMDB-01..02)
Resume: Phase 82 Plan 02 complete — Phase 82 UI Control Seams A fully complete; ready for next phase (83-etl-seams or 84-ui-polish)
