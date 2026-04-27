# Phase 182: Three-Explorer Boundary Spec - Context

**Gathered:** 2026-04-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Define the three-way boundary (Formulas/Marks/Audits) with type signatures, composition rules, and regression guards. Deliverable is `01-three-explorer-spec.md` — a spec document, no code. Every chip type from the original discussion document is placed in exactly one explorer, composition rules are defined, and the first set of regression guards is established with verification checks.

</domain>

<decisions>
## Implementation Decisions

### DSL Example Lexicon Depth
- **D-01:** Pattern catalog approach — one canonical example per chip sub-type (~15–20 examples). Covers: row-level calc, aggregate calc, window function, equality filter, range filter, compound filter, single sort, multi-sort, conditional encoding mark, anomaly audit, validation audit. Shows the shape without designing the grammar. Not an exhaustive corpus (that's WA-4's job).

### Regression Guard Verification Format
- **D-02:** Grep-able assertions for each of the 14 FE-RG guards plus FE-RG-15. Each guard gets a one-liner grep command or structural check a reviewer can run against the spec files. Matches the handoff's own "Verifiable checks" pattern. Example: `grep -r "GROUP BY" 01-three-explorer-spec.md` returns only prohibitions, never ownership claims.

### Anti-Feature Documentation
- **D-03:** Bullet + one-sentence rationale format for SPEC-05. Each anti-feature gets: the rejected behavior, a one-sentence "why not" rationale, and a cross-reference to the relevant FE-RG guard where applicable. No worked examples needed — the rationale is sufficient to prevent re-litigation.

### Cross-Category References
- **D-04:** Name the pattern, defer the mechanics. Phase 182 acknowledges that Calculations can reference Filters (e.g., "Filtered Totals") and states which explorer owns the cross-reference. The dependency resolution algorithm and compilation mechanics belong in WA-2 (Phase 184). This spec says "cross-category references exist and are resolved by the compilation pipeline" — it does not specify how.

### Claude's Discretion
- Spec document internal structure (heading order, section breaks) — follow the WA-1 artifact description from the handoff
- Exact count of examples in the lexicon appendix (15–20 range, use judgment on coverage)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Architecture Source
- `.planning/formulas-explorer-handoff-v2.md` — The primary source document. Contains the three-explorer decomposition, all 14 FE-RG guards, worked examples, contract boundaries, and the full WA-1 through WA-7 breakdown. Phase 182 implements WA-1 from this document.

### Original Discussion
- `.planning/Formulas Explorer discussion.md` — The original hypothesis that Phase 182's spec must decompose. Every example from this document must be placed unambiguously into one explorer. Success criteria SC-1 and SPEC-06 require this.

### Requirements
- `.planning/REQUIREMENTS.md` — Requirements SPEC-01 through SPEC-06, GARD-01, GARD-02 define acceptance criteria for this phase.

### Prior Decisions (STATE.md)
- `.planning/STATE.md` §Accumulated Context — Contains all 8 resolved open questions from the handoff questioning session. These are locked inputs to the spec.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/ui/panels/FormulasPanelStub.ts` — Current "Coming soon" stub using PanelFactory/PanelHook/PanelMeta pattern. Shows the panel registration interface any future Formulas Explorer will need to implement.
- `src/ui/panels/PanelTypes.ts` — Panel type contracts (PanelFactory, PanelHook, PanelMeta) that the spec should reference as integration seams.

### Established Patterns
- Panel registration via PanelMeta (id, name, icon, description, dependencies, defaultEnabled) — all three explorers will follow this pattern
- Explorer panels are embedded inline above/below the active view (not side drawer)
- Formulas Explorer toggles below the view from the Analyze dock section
- Existing explorers (Properties, Projection, Visual, LATCH, Data, Notebook) provide structural precedent

### Integration Points
- Analyze ribbon section — where the single "Formulas" parent with three sub-explorers will appear
- PanelManager — orchestrates explorer panel lifecycle
- FilterProvider, PAFVProvider — existing provider patterns that FormulasProvider will follow
- Worker bridge — existing message protocol for SQL execution

</code_context>

<specifics>
## Specific Ideas

No specific requirements beyond what the handoff document and resolved open questions provide. The handoff is the canonical source — the spec formalizes it.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 182-three-explorer-boundary-spec*
*Context gathered: 2026-04-27*
