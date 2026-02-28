# Isometry v5 Roadmap Review

Reviewed file: `/Users/mshaler/Developer/Projects/Isometry/.planning/ROADMAP.md`
Review date: 2026-02-28

## Findings

### 1) High: Execution model contradiction
- `ROADMAP.md` says the build follows a strict dependency graph.
- It also says Phase 6 can run in parallel after Phase 3.
- But the Progress section states numeric execution `1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7`.

Impact:
- Planning and delivery can diverge depending on which rule implementers follow.

Recommendation:
- Declare one authoritative policy:
  - Either dependency-driven execution (preferred), or
  - strict numeric execution.
- Update all sections to match.

### 2) Medium: Requirement count mismatch is documented but not resolved
- Coverage says `78/78` mapped.
- Note says `REQUIREMENTS.md` summary states `67`.

Impact:
- Any automation that trusts summary counts may produce incorrect progress metrics.

Recommendation:
- Correct the count in `REQUIREMENTS.md` so source-of-truth documents agree.

### 3) Medium: Soft-delete and hard-delete lifecycle is under-specified
- Phase 2 includes soft delete + undelete.
- It also requires cascade behavior for hard deletes.

Impact:
- Different implementations may choose incompatible delete semantics.

Recommendation:
- Define:
  - when hard delete is allowed,
  - who triggers it (user/system/admin task),
  - and how it interacts with undo, retention, and cascade rules.

### 4) Low: Planning detail is front-loaded to Phase 1
- Phase 1 has concrete plan files.
- Phases 2-7 remain `TBD`.

Impact:
- Lower predictability for risk, sequencing, and staffing after Phase 1.

Recommendation:
- Add at least skeleton plans for Phases 2-4 with wave sequencing and acceptance checks.

## Open Questions

1. Should roadmap execution be dependency-driven or numeric-driven?
2. Is hard delete exposed to end users, or only to maintenance workflows?
3. Should requirement-count normalization in `REQUIREMENTS.md` happen immediately?

## Summary

The roadmap has strong technical direction and full requirement mapping, but it needs one consistent execution rule and explicit deletion lifecycle semantics to avoid implementation drift.
