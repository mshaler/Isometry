# Phase 186: Operator-Contract Template - Context

**Gathered:** 2026-04-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Fork the geometry contract template into an operator-surface variant (`operator-contract-template.md`) with a usage guide that distinguishes the two templates. Deliverable is a reusable template document plus inline usage guide. No code ships.

</domain>

<decisions>
## Implementation Decisions

### Template Structure
- **D-01:** Single section replaces both §2 and §3 — a new "Operator Surface" section describes what the operator does instead of spatial projection (input/output contracts, operator semantics, what makes it non-geometric). Matches the handoff's "with §2-§3 replaced by an operator-surface section" language.
- **D-02:** Remaining 10 sections (§1, §4-§12) carry over with rewritten guidance prompts — same section structure, but italicized prompts are operator-aware (e.g., §4 Data Binding says "What operator inputs does this surface accept?" instead of "What shape of data does this view accept?"). Preserves template consistency while steering authors toward operator thinking.

### Usage Guide
- **D-03:** Usage guide lives inline as a §0 "When to use this template" section at the top of operator-contract-template.md, with a cross-link to the geometry variant. Self-contained — an author reading the template sees the guidance immediately.
- **D-04:** Concrete distinguishing example uses Time Explorer (PAFV-bound, projects data onto spatial planes) vs. Chip Well (operator surface, produces configuration consumed by views). Both have completed contracts the reader can inspect.

### File Placement
- **D-05:** File lives at `.planning/operator-contract-template.md` — sibling to `geometry-contract-template.md`. Same directory, consistent naming, immediately discoverable.

### Carried Forward (Locked)
- "Function not chrome" philosophy applies to all contracts and templates (geometry family convention)
- All deliverables are .md specs, no code ships (v15.0 principle)
- Template fork decided as WA-7 in this milestone (STATE.md — originally OQ-7 in handoff)
- Formulas Explorer is NOT the A in LATCH — orthogonal operator surface (FE-RG-11)

### Claude's Discretion
- Exact wording of the operator-surface guidance prompts in each section — follow the geometry template's tone and depth
- Whether to add a brief cross-link back to the operator template from the geometry template header
- Level of detail in the Time Explorer vs. Chip Well contrast example — enough to distinguish, not a full comparison essay

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Template Being Forked
- `.planning/geometry-contract-template.md` — The 12-section geometry contract template. This is the parent document being forked. All section structure, guidance prompts, and examples must be understood before creating the operator variant.

### Completed Operator-Surface Contract (reference for what operator contracts look like)
- `.planning/milestones/v15.0-formulas-explorer/06-chip-well-geometry.md` — The first completed contract that uses the operator-surface pattern. Shows how §3 becomes "N/A — operator surface" and how other sections adapt. This is the existence proof that motivates the template fork.

### Completed Geometry Contract (contrast reference)
- `.planning/time-explorer-geometry.md` — Completed PAFV-bound geometry contract. Used as the geometry-side of the concrete distinguishing example in the usage guide.

### Architecture Source
- `.planning/formulas-explorer-handoff-v2.md` §Contract Boundaries (lines 305-315) — Explains the geometry vs. operator distinction and the template fork rationale. Also §Open Questions item 7 (line 398) for the original recommendation.

### Requirements
- `.planning/REQUIREMENTS.md` — Requirements TMPL-01 and TMPL-02 define acceptance criteria for this phase.

### Prior Decisions
- `.planning/STATE.md` §Accumulated Context — Contains the resolved decision to create the operator-contract template as WA-7 in this milestone.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `.planning/geometry-contract-template.md` — Direct parent; fork and modify
- `.planning/milestones/v15.0-formulas-explorer/06-chip-well-geometry.md` — Shows how the operator pattern works in practice (§3 N/A, §4 input/output contracts for configuration not data)
- `.planning/time-explorer-geometry.md` — Geometry contrast for the usage guide example

### Established Patterns
- Geometry contracts follow "function not chrome" — describe spatial function, not visual styling
- Template sections use italicized guidance prompts that steer the author
- §3 PAFV binding is the key differentiator — geometry contracts bind to PAFV planes; operator contracts don't

### Integration Points
- Any future explorer authoring an operator-surface contract will use this template
- The geometry template itself may get a brief cross-link to the operator variant (Claude's discretion)
- Phase 183 chip-well geometry contract is the first retroactive consumer — it demonstrates the pattern this template formalizes

</code_context>

<specifics>
## Specific Ideas

No specific requirements beyond what the handoff document and resolved open questions provide. The fork is mechanical — the creative work is in the operator-surface section design and the distinguishing example.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 186-operator-contract-template*
*Context gathered: 2026-04-27*
