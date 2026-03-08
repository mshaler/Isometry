---
phase: 49-theme-system
plan: 01
subsystem: ui
tags: [css-custom-properties, theming, design-tokens, dark-mode, light-mode]

# Dependency graph
requires:
  - phase: 48-review-fixes
    provides: "Clean biome lint baseline, design-tokens.css token system"
provides:
  - "Multi-theme CSS token system (dark/light/system palettes)"
  - "--drag-over-bg token for SuperGrid"
  - "Theme transition CSS with 200ms timing and .no-theme-transition escape hatch"
  - "CSS var() references in all TypeScript rendering code (zero hardcoded hex)"
  - "FOWT prevention via data-theme='dark' default on <html>"
affects: [49-02, 49-03, theme-provider, native-shell-sync]

# Tech tracking
tech-stack:
  added: []
  patterns: ["[data-theme] attribute selector scoping for CSS custom properties", "CSS var() in SVG presentation attributes via D3 .attr()"]

key-files:
  created:
    - tests/styles/design-tokens.test.ts
  modified:
    - src/styles/design-tokens.css
    - src/audit/audit-colors.ts
    - src/views/NetworkView.ts
    - src/views/SuperGrid.ts
    - src/styles/help-overlay.css
    - src/styles/import-toast.css
    - src/styles/action-toast.css
    - index.html
    - tests/audit/AuditState.test.ts
    - tests/views/SuperGrid.test.ts

key-decisions:
  - "Reuse existing --overlay-bg, --overlay-shadow-heavy, --border-subtle tokens for help-overlay instead of creating new ones"
  - "Use var(--cell-hover) for import-toast error detail background (semantically similar opacity-based overlay)"

patterns-established:
  - "CSS var() in audit-colors.ts: all color constants reference CSS custom properties instead of hex literals"
  - "[data-theme] attribute on <html> as theme toggle mechanism"

requirements-completed: [THME-02, THME-05, THME-07]

# Metrics
duration: 5min
completed: 2026-03-08
---

# Phase 49 Plan 01: CSS Token Foundation Summary

**Multi-theme design token system with dark/light/system CSS palettes and zero hardcoded colors in TypeScript rendering code**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-07T23:57:33Z
- **Completed:** 2026-03-08T00:03:01Z
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments
- Restructured design-tokens.css from single :root block to three theme-scoped palettes (dark default, light explicit, system with @media prefers-color-scheme)
- Eliminated all hardcoded hex colors from TypeScript rendering code (audit-colors.ts, NetworkView.ts, SuperGrid.ts)
- Replaced all inline rgba() values in CSS component files (help-overlay, import-toast, action-toast) with semantic CSS var() references
- Added theme transition CSS (200ms timing) with .no-theme-transition escape hatch for first-paint prevention
- Added FOWT prevention via data-theme="dark" default attribute on <html> element

## Task Commits

Each task was committed atomically:

1. **Task 1: Restructure design-tokens.css with dark/light/system palettes and transition CSS** - `49d602e4` (feat, TDD)
2. **Task 2: Migrate hardcoded colors in TypeScript and CSS to CSS var() references** - `638f2a4a` (feat)

## Files Created/Modified
- `src/styles/design-tokens.css` - Restructured: 3 theme palettes, --drag-over-bg token, --theme-transition, body styling, transition rules
- `src/audit/audit-colors.ts` - All hex values replaced with var(--audit-*) and var(--source-*) references
- `src/views/NetworkView.ts` - d3.schemeCategory10 replaced with CSS var() source token ordinal scale
- `src/views/SuperGrid.ts` - Inline rgba(0,150,136,0.18) replaced with var(--drag-over-bg)
- `src/styles/help-overlay.css` - 3 inline rgba() replaced with var(--overlay-bg), var(--overlay-shadow-heavy), var(--border-subtle)
- `src/styles/import-toast.css` - rgba(0,0,0,0.2) replaced with var(--cell-hover)
- `src/styles/action-toast.css` - rgba(74,158,255,0.3) replaced with var(--accent-border)
- `index.html` - Added data-theme="dark" attribute to <html> element
- `tests/styles/design-tokens.test.ts` - 20 TDD tests for token structure, palettes, transitions
- `tests/audit/AuditState.test.ts` - Updated AUDIT_COLORS assertions for var() values
- `tests/views/SuperGrid.test.ts` - Updated drag-over background assertion for var() value

## Decisions Made
- Reused existing --overlay-bg token for help-overlay backdrop instead of creating a dedicated --help-overlay-bg token (semantically identical purpose)
- Used var(--cell-hover) for import-toast error detail background (semantically similar semi-transparent overlay)
- Kept d3.schemeCategory10 reference only in a code comment for documentation context

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated test assertions for new CSS var() values**
- **Found during:** Task 2 (color migration)
- **Issue:** 2 existing tests (AuditState.test.ts, SuperGrid.test.ts) asserted on old hardcoded hex/rgba values that no longer match after migration to var() references
- **Fix:** Updated assertions to expect var(--audit-new), var(--audit-modified), var(--audit-deleted), and var(--drag-over-bg)
- **Files modified:** tests/audit/AuditState.test.ts, tests/views/SuperGrid.test.ts
- **Verification:** All 2411 tests pass
- **Committed in:** 638f2a4a (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug fix)
**Impact on plan:** Test assertion update was a direct consequence of the planned color migration. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All CSS tokens are now theme-scoped and ready for ThemeProvider (Plan 02) to toggle via data-theme attribute
- The [data-theme="system"] + @media block handles OS preference changes automatically at CSS level
- body styling and FOWT prevention are in place for seamless first-paint on any theme

## Self-Check: PASSED

All 11 files verified present. Both task commits (49d602e4, 638f2a4a) verified in git log.

---
*Phase: 49-theme-system*
*Completed: 2026-03-08*
