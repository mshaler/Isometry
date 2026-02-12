# Phase 73: SuperGrid Phase A — Core MVP

**Milestone:** v5.0 SuperGrid MVP
**Phase:** 73 of 76 (SuperGrid Phase A)
**Created:** 2026-02-12
**Status:** PLANNING

## Goal

Implement the four critical SuperGrid features that block MVP readiness. This phase brings SuperGrid from 30% → 70% completion.

## Scope

SuperGrid Phase A focuses on the foundational features that all other Super* capabilities depend on:

1. **SuperStack Multi-Level Headers** — Nested headers with visual spanning
2. **SuperDensity Controls** — Value (GROUP BY) + Extent (empty cell filtering)
3. **SuperZoom Upper-Left Anchor** — Pin zoom to top-left corner
4. **Header Click Zones** — Zone-based hit testing and cursor feedback

## Reference Documents

- `SuperGrid-GSD-Implementation-Plan.md` — Detailed implementation guidance
- `specs/SuperGrid-Specification.md` — Full feature specification
- `src/d3/SuperGridEngine/` — Implementation target directory

## Phase Structure

| Plan | Focus | Priority | Estimated Effort |
|------|-------|----------|------------------|
| 73-01 | SuperStack Multi-Level Headers | P0 | 1-2 days |
| 73-02 | SuperDensity Controls | P0 | 1 day |
| 73-03 | SuperZoom Upper-Left Anchor | P1 | 2-4 hours |
| 73-04 | Header Click Zones | P0 | 1 day |

## Success Criteria

Phase A is complete when:
- [ ] 2-level headers render with correct visual spanning
- [ ] Click parent header selects all children
- [ ] Value slider changes SQL GROUP BY
- [ ] Extent toggle filters empty cells
- [ ] Zoom pins to upper-left corner
- [ ] Cannot pan past grid boundaries
- [ ] Cursor changes per zone
- [ ] Parent label click toggles collapse
- [ ] Child body click selects children
- [ ] All tests pass: `npm run test`
- [ ] Type check passes: `npm run typecheck`
- [ ] Lint passes: `npm run check`

## Dependencies

- **Requires:** Phase 69 (File Importers) — COMPLETE
- **Parallel with:** Phases 70-72 (v4.8 completion) — Can run independently
- **Blocks:** SuperGrid Phase B (SuperDynamic, SuperCalc, SuperAudit)

## Architecture Constraints

Per CLAUDE.md:
- D3's `.join()` with key functions — always
- No external state management (D3's data join IS state)
- Files under 500 lines
- TDD workflow (test first)
