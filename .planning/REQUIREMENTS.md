# Requirements: Isometry v4.3 Review Fixes

**Defined:** 2026-03-07
**Core Value:** SuperGrid renders imported data through PAFV spatial projection with zero serialization -- sql.js queries directly feed D3.js data joins.

## v4.3 Requirements

Requirements for review fixes milestone. Each maps to roadmap phases.

### Runtime Correctness

- [ ] **RFIX-01**: User can import .xlsx/.xls files via web file picker and see cards rendered correctly
- [ ] **RFIX-02**: User can press ? on a US-layout keyboard (Shift+/) to toggle the help overlay in any real browser
- [ ] **RFIX-03**: User sees brief "Undid: {description}" / "Redid: {description}" toast after pressing Cmd+Z / Cmd+Shift+Z

### Build Health

- [ ] **BFIX-01**: `npx biome check src tests` passes with zero errors on all source and test files at repo HEAD

### Documentation

- [ ] **DFIX-01**: ROADMAP.md, PROJECT.md, and STATE.md consistently reflect v4.2 as shipped and v4.3 as current

## Future Requirements

### Deferred from v4.2

- **CMD-01**: Command palette (Cmd+K) with fuzzy search across all actions
- **A11Y-01**: Full WCAG 2.1 AA accessibility audit and compliance
- **THEME-01**: Light mode / system theme preference support
- **SMART-01**: Smart per-view empty state CTAs (Calendar: "import events with dates", Network: "import connections")

## Out of Scope

| Feature | Reason |
|---------|--------|
| F-006 PERF-01 re-baseline | Not reproducible -- all 2,379 tests pass; transient CI load |
| Full onboarding wizard | Power user tool -- single welcome panel sufficient (v4.2) |
| Light mode | Doubles CSS testing surface; dark-by-design for data viz (v4.2) |
| Custom keyboard shortcut remapping | ~15 actions; standard platform shortcuts sufficient (v4.2) |
| Full command palette (Cmd+K) | HIGH complexity; deferred to dedicated milestone (v4.2) |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| RFIX-01 | Phase 48 | Pending |
| RFIX-02 | Phase 48 | Pending |
| RFIX-03 | Phase 48 | Pending |
| BFIX-01 | Phase 48 | Pending |
| DFIX-01 | Phase 48 | Pending |

**Coverage:**
- v4.3 requirements: 5 total
- Mapped to phases: 5
- Unmapped: 0

---
*Requirements defined: 2026-03-07*
*Last updated: 2026-03-07 after roadmap creation (traceability complete)*
