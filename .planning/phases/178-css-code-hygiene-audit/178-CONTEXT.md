# Phase 178: CSS & Code Hygiene Audit - Context

**Gathered:** 2026-04-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Systematic scan and fix of CSS hygiene issues (~7,735 LOC across 32 CSS files) plus 3 known TS workarounds. Scope: hardcoded px values → design tokens, overflow:hidden band-aids → proper layout fixes with annotation, workaround comments → clean code. No new features, no TS lint sweep, no architectural changes.

</domain>

<decisions>
## Implementation Decisions

### Audit Scope & Severity
- **D-01:** Aggressive tokenization — push toward near-zero hardcoded px values. Every repeated value gets a semantic token in design-tokens.css. One-off layout specifics also get tokens where a semantic name makes sense.
- **D-02:** All 50 overflow:hidden occurrences must be reviewed. Band-aids replaced with proper layout fixes (flex/grid overflow, text-overflow). Every remaining intentional overflow:hidden gets a `/* intentional: [reason] */` comment so future audits skip them.

### Fix-vs-Document Boundary
- **D-03:** Fix all 3 known TS workarounds in this phase:
  - `src/ui/ViewTabBar.ts` — remove "insertBefore hack" (appendTo param already exists)
  - `src/worker/handlers/ui-state.handler.ts` — clarify "bind param workaround" comment (code is correct, comment is misleading)
  - `src/styles/superwidget.css` — address focus-visible TODO (deferred KBNV-01)
- **D-04:** No broader TS hygiene — no unused import scan, no dead export removal, no naming audit. Strictly CSS + the 3 annotated TS issues.

### Token Extraction Policy
- **D-05:** Fixes ship directly. CONTEXT.md and commit messages document what changed. No separate FINDINGS.md or HYGIENE-REPORT.md artifact.

### Verification Approach
- **D-06:** Run existing 15 Playwright E2E specs + unit tests for functional regression. Manual spot-check key views (SuperGrid, Workbench, DockNav) in browser. No new visual regression infrastructure.

### Claude's Discretion
- Token naming convention and file organization — match whatever patterns already exist in `src/styles/design-tokens.css`. Claude decides the specific scale/naming scheme.
- Judgment call on which overflow:hidden are band-aids vs. intentional — use layout context to determine.
- Priority ordering of which CSS files to tackle first.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Design System
- `src/styles/design-tokens.css` — Existing token definitions (spacing, color, transition). New tokens extend this file.

### CSS Files (audit targets)
- `src/styles/superwidget.css` — 29 hardcoded px, 7 overflow:hidden, 1 TODO comment (87 var() refs)
- `src/styles/pivot.css` — 100 hardcoded px, 4 overflow:hidden (114 var() refs)
- `src/styles/supergrid.css` — 44 hardcoded px, 5 overflow:hidden (56 var() refs)
- `src/styles/workbench.css` — 39 hardcoded px, 6 overflow:hidden (105 var() refs)
- `src/styles/views.css` — 42 hardcoded px, 2 overflow:hidden (107 var() refs)
- `src/styles/card-dimensions.css` — 21 hardcoded px, 8 overflow:hidden (70 var() refs)
- All 32 CSS files in `src/styles/` are in scope (682 total hardcoded px values, 50 total overflow:hidden)

### TS Workarounds (3 files)
- `src/ui/ViewTabBar.ts:19,81` — "insertBefore hack" with appendTo param already available
- `src/worker/handlers/ui-state.handler.ts:67` — misleading "bind param workaround" comment

### Architecture Context
- `.planning/codebase/CONVENTIONS.md` — Established code patterns
- `.planning/codebase/STRUCTURE.md` — File organization

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/styles/design-tokens.css` — Already defines spacing, color, transition, and layout tokens. Heavily adopted (top files: 120, 114, 107 var() references). Extending this is low-risk.
- Existing E2E test suite (15 Playwright specs) — catches functional regressions without new infra.

### Established Patterns
- CSS custom properties via `var(--*)` are the norm — 32 files already use them extensively
- `data-attribute` selectors preferred over `:has()` (v6.1 pattern)
- CSS Grid for major layout (superwidget, workbench, dock-nav)
- Per-file `@vitest-environment` annotation pattern for test configuration

### Integration Points
- design-tokens.css is imported globally — new tokens are immediately available everywhere
- No CSS preprocessor or CSS-in-JS — pure CSS custom properties
- Vite handles CSS bundling — no build config changes needed for token additions

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. User wants aggressive cleanup (near-zero hardcoded px, all band-aids fixed and annotated).

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 178-css-code-hygiene-audit*
*Context gathered: 2026-04-22*
