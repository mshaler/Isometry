# Phase 155: CSS Namespace + Design Token Audit - Context

**Gathered:** 2026-04-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Scope all explorer CSS to component namespaces (BEM `.__*` convention) and replace hardcoded spacing/color values with design tokens. Deliverable: zero cross-component class collisions and zero hardcoded px/color values in explorer CSS files.

</domain>

<decisions>
## Implementation Decisions

### Namespace Migration Scope
- **D-01:** Audit ALL 8 explorer CSS files for non-namespaced selectors — not just the two the requirements explicitly name (AlgorithmExplorer, VisualExplorer). This makes VCSS-01 (zero cross-component collisions) bulletproof.
- **D-02:** If `.nv-*` selectors in `network-view.css` or `.dim-btn`/`.dim-switcher` in `card-dimensions.css` are referenced by explorer TS components, migrate them to the appropriate explorer namespace. If they're only used by their own view (not explorers), leave them but document the finding.

### Token Fallback Strategy
- **D-03:** Strip ALL hardcoded fallback values from CSS custom properties. Use `var(--text-sm)` not `var(--text-sm, 13px)`. Design tokens are canonical — hiding their absence causes harder-to-debug theme bugs. Breakage should surface immediately if `design-tokens.css` isn't loaded.

### Hardcoded Value Threshold
- **D-04:** "Zero hardcoded" applies to **spacing** (padding, margin, gap, font-size) and **color** (color, background, border-color) categories only. Structural dimensions (input width like `width: 80px`, `border-radius: 50%`, `opacity`, flex ratios) stay as plain values — they aren't theme-sensitive.

### Claude's Discretion
- Whether to add new tokens to `design-tokens.css` if existing tokens don't cover a needed value (e.g., if `--space-md: 12px` doesn't cover a `6px` gap, Claude can add `--space-2xs: 2px` or map to nearest existing token)
- File organization: whether to consolidate explorer CSS or keep per-file structure
- Order of explorer migration (which of the 8 to do first)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Design System
- `src/styles/design-tokens.css` — Master token definitions (spacing, color, typography, transitions). All token replacements must use values defined here.

### Explorer CSS Files (all 8 — audit targets)
- `src/styles/algorithm-explorer.css` — Currently has ~12 hardcoded px and ~7 fallback hex colors
- `src/styles/visual-explorer.css` — Already mostly tokenized with `--space-*` and `--border-subtle`
- `src/styles/projection-explorer.css` — Needs audit
- `src/styles/latch-explorers.css` — Needs audit
- `src/styles/properties-explorer.css` — Needs audit
- `src/styles/data-explorer.css` — Needs audit
- `src/styles/notebook-explorer.css` — Needs audit
- `src/styles/catalog-actions.css` — Needs audit (DataExplorer sub-component)

### Potentially Affected (cross-reference check needed)
- `src/styles/network-view.css` — Contains `.nv-*` selectors; check if explorer TS references these
- `src/styles/card-dimensions.css` — Contains `.dim-btn`/`.dim-switcher`; check if explorer TS references these

### Requirements
- `.planning/REQUIREMENTS.md` §Visual Consistency — VCSS-01 through VCSS-04

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Design token system** (`design-tokens.css`): Mature vocabulary with `--space-xs/sm/md/lg/xl`, `--text-primary/secondary/muted`, `--bg-primary/secondary/card/surface`, `--border-subtle/muted`, `--accent`, `--danger`, typography scale (`--text-xs/sm/base/lg`), and derived opacity variants
- **BEM convention**: Already used by `algorithm-explorer.css` and `visual-explorer.css` — pattern is `.{explorer}__*`
- **5-theme system**: dark (default), light, system, NeXTSTEP, Material 3 — all via CSS custom properties

### Established Patterns
- `visual-explorer.css` is the gold standard — fully namespaced, uses tokens exclusively, no hardcoded fallbacks
- `algorithm-explorer.css` uses BEM naming but has hardcoded fallbacks (`var(--text-sm, 13px)`) and raw px values (`padding: 8px 12px`)
- 28 CSS files already reference design tokens — the migration pattern is well-established

### Integration Points
- Explorer TS files (`src/explorers/*.ts` or similar) reference CSS class names — renaming selectors requires updating JS/TS class references
- D3 data joins may set class names programmatically — grep for string literals matching old selector names
- Theme switching is handled by `[data-theme]` attribute on root — no impact on namespace migration

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. The gold standard is `visual-explorer.css` for how a fully-migrated explorer file should look.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 155-css-namespace-design-token-audit*
*Context gathered: 2026-04-17*
