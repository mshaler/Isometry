# Phase 188: UX Interaction Spec - Context

**Gathered:** 2026-04-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Define the complete UX interaction model for the Formulas/Marks/Audits chip-well explorers as `05-ux-interaction-spec.md`. Covers: live preview behavior, reversibility (undo/redo), error state presentation and recovery, save-as-formula promotion dialog flow, explorer placement in navigation, and WKWebView constraint compliance. Deliverable is a spec document, no code. All outputs land in `.planning/milestones/v15.0-formulas-explorer/`.

This phase layers **interaction semantics** on top of the geometric foundation (Phase 183) and compilation pipeline (Phase 184). The geometry contract says *where things are*; the compilation spec says *what the pipeline produces*; this spec says *how the user experiences the flow*.

</domain>

<decisions>
## Implementation Decisions

### Live Preview Flow
- **D-01:** Immediate trigger — every chip drop, reorder, or remove instantly re-compiles and re-runs the query. No debounce. sql.js in-memory queries are typically <50ms; debounce adds latency without benefit. Matches the Cryptex "continuous tactile interaction" principle.
- **D-02:** D3 keyed transitions for result animation — use existing D3 data-join transition pattern (rows enter/exit/update with opacity+position transitions). Consistent with SuperGrid and other views. No new animation system needed.
- **D-03:** Inline skeleton overlay for long-running queries (>200ms) — subtle loading shimmer overlaid on current view. Current results stay visible but dimmed. Old state remains readable while new results compute. Matches "no commit until commit."

### Reversibility Model
- **D-04:** Per-well undo stack — each chip well maintains its own stack of arrangement snapshots. Undo reverts the last change in the focused well. Matches ROADMAP SC-2 "arrangement-level" language.
- **D-05:** Unlimited in-memory stack depth — keep all arrangement snapshots until session ends or user navigates away. Memory cost is trivial (chip arrangements are small objects). Stack is NOT persisted across sessions.
- **D-06:** Undo triggers immediate re-preview — undo fires the same compile + D3 transition pipeline as a regular chip change. Every arrangement state gets a live preview. Consistent behavior throughout.
- **D-07:** Formula Card save undo is NOT supported — per ROADMAP SC-2, this distinction is explicit. Saving a Formula Card is a permanent action (creates a version row). Chip arrangement undo/redo is separate from card versioning.

### Error State Presentation
- **D-08:** Inline error on chip — offending chip gets a red outline + error icon. Tooltip on hover shows the error message. For dependency cycles, ALL participating chips highlight (uses `CycleError.participants` chip IDs from Phase 184). Error is spatially co-located with the cause.
- **D-09:** Undo suggestion as recovery action — error tooltip includes an "Undo" action link that reverts the chip change that caused the error. Leverages the per-well undo stack (D-04).
- **D-10:** Partial results on compilation error — compile and run valid chips; skip erroring chip(s). View shows partial preview with an indicator that some chips were excluded. User sees the effect of valid chips while fixing errors. Matches "combination reveals insight."

### Save-as-Formula Promotion UI
- **D-11:** Explicit "Save as Formula" button in chip-well toolbar — deliberate action, always visible. Matches "no commit until commit" principle. User clicks when satisfied with their arrangement.
- **D-12:** Minimal dialog: name (required) + description (optional) — two fields only. Visibility defaults to 'active', scope defaults to 'dataset'. Advanced metadata (scope, tags, visibility) editable later from the Formula Card library. Runs `validatePromotion()` before showing dialog; errors block the dialog from opening.
- **D-13:** Post-save: toast + chips stay — success toast ("Formula saved"), chips remain in wells as-is. Arrangement is now both a live preview AND a saved card. User can continue editing (next save creates a new version row). Lowest friction.
- **D-14:** Dialog uses `<dialog>` element — WKWebView constraint compliance (ROADMAP SC-6). No `alert()` or `confirm()`.

### Explorer Placement (Carried Forward)
- **D-15:** Single "Formulas" parent in the Analyze dock section — already exists in code (`section-defs.ts` line 162). Three sub-explorers: Formulas, Marks, Audits (per Phase 182 boundary spec).
- **D-16:** Formulas Explorer is NOT the A in LATCH — orthogonal operator surface (FE-RG-11, STATE.md).

### WKWebView Constraints (Carried Forward)
- **D-17:** Pointer events for chip drag — no HTML5 DnD API (unreliable in WKWebView).
- **D-18:** No `:has()` behavioral selectors — use data-attribute patterns instead.
- **D-19:** `<dialog>` for all prompts — no `alert()`, `confirm()`, or `prompt()`.

### Claude's Discretion
- Explain panel toggle placement and interaction (defers to chip-well geometry §9 composition seam)
- D3 transition timing/easing specifics (use existing codebase patterns)
- Keyboard shortcut mapping for undo/redo (standard Cmd+Z / Cmd+Shift+Z)
- Error clearing behavior (errors clear automatically when the causing condition is resolved)
- Multiple simultaneous errors presentation (each chip shows its own error independently)
- Wireframe text descriptions layout and formatting within the spec document

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Architecture Source (primary)
- `.planning/formulas-explorer-handoff-v2.md` — Primary source. §WA-5 (lines 248-268) defines the UX interaction spec deliverable. Appendix B (lines 431-440) defines Cryptex/Dream Orb design principles that inform all interaction decisions.

### Three-Explorer Boundary Spec (Phase 182 output)
- `.planning/milestones/v15.0-formulas-explorer/01-three-explorer-spec.md` — Defines which chip types belong to which explorer, composition rules, and FE-RG guards. Interaction spec must respect these boundaries.

### Chip-Well Geometry Contract (Phase 183 output)
- `.planning/milestones/v15.0-formulas-explorer/06-chip-well-geometry.md` — Defines spatial layout, drag states, keyboard/a11y contracts, drop-zone semantics. This spec layers interaction semantics on top of that geometric foundation. §7 (States) and §8 (Interaction contracts) are the key integration points.

### Compilation Pipeline Spec (Phase 184 output)
- `.planning/milestones/v15.0-formulas-explorer/02-compilation-pipeline.md` — Defines clause mapping, dependency graph (with `CycleError.participants`), bind-value protocol, Marks/Audits annotation algorithms, and explain panel output shape `(sql_text, [bind_values])`. Error types originate here.

### Formula Card Schema (Phase 185 output)
- `.planning/milestones/v15.0-formulas-explorer/03-formula-card-schema.md` — Defines `formula_cards` table DDL, promotion API (`promoteToCard`/`hydrateChips`/`validatePromotion`), versioning strategy (every save = new version row), and visibility enum. Promotion dialog flow references this API.

### Original Discussion (reference examples)
- `.planning/Formulas Explorer discussion.md` — Original hypothesis document. Cryptex/Dream Orb references that inspired the interaction model.

### Requirements
- `.planning/REQUIREMENTS.md` — Requirements UXIN-01 through UXIN-06 define acceptance criteria for this phase.

### Prior Decisions
- `.planning/STATE.md` §Accumulated Context — Contains locked decisions from the questioning session and all phase-level decisions from Phases 182-187.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/ui/section-defs.ts` — DOCK_DEFS already has `{ key: 'formula', label: 'Formulas', icon: 'code' }` in the Analyze section (line 162). Explorer placement is pre-wired.
- `src/ui/panels/FormulasPanelStub.ts` — Current "Coming soon" stub using PanelFactory/PanelHook/PanelMeta pattern. Shows the panel registration interface.
- Existing D3 transition patterns in SuperGrid and other views — D-02 references these for result animation.

### Established Patterns
- D3 data-join enter/exit/update transitions used across all views (SuperGrid, TreeView, NetworkView)
- `<dialog>` element used in AppDialog component (Phase 84 UI polish)
- Data-attribute-over-`:has()` pattern established in v6.1 (§UI polish)
- Pointer-event-based interaction throughout (WKWebView constraint)
- `queueMicrotask` batched subscriber notifications after state changes

### Integration Points
- Worker bridge — existing message protocol for SQL execution (`supergrid:query`, `supergrid:calc`). Live preview re-runs queries through this path.
- `FilterProvider.compile()` → `QueryBuilder` — existing compilation pattern. FormulasProvider will follow this same path.
- `ErrorBanner` component — existing error display pattern (though D-08 specifies inline-on-chip instead)
- PanelManager — orchestrates explorer panel lifecycle

</code_context>

<specifics>
## Specific Ideas

No specific requirements beyond the captured decisions. The Cryptex/Dream Orb design principles (continuous tactile interaction, reversibility, no commit until commit, combination reveals insight) are operationalized through the decisions above.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 188-ux-interaction-spec*
*Context gathered: 2026-04-27*
