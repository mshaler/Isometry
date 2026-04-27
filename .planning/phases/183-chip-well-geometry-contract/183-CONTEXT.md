# Phase 183: Chip-Well Geometry Contract - Context

**Gathered:** 2026-04-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Produce `06-chip-well-geometry.md` — a standalone, Formulas-agnostic geometry contract that defines the chip-well spatial primitive. Fills all 12 sections of the geometry contract template. The contract must be reusable by any explorer (Projections, Formulas, Marks, Audits, future) without inheriting Formulas-specific concepts. Deliverable is a spec document, no code.

</domain>

<decisions>
## Implementation Decisions

### Drag State Visual Spec Depth
- **D-01:** Semantic descriptions only — each of the 6 drag states (default, drag-source-active, drag-target-valid, drag-target-invalid, drop-rejected, promotion-prompt) gets a prose description of intent and visual cue type. No specific CSS properties, colors, or opacities. Implementation picks from design tokens. Matches the template's "function not chrome" philosophy.
- **D-02:** End-states only — no animation timing or duration specs. Contract describes what each state looks like, not how long transitions take. Animation timing is implementation chrome.

### Keyboard & Accessibility Contract
- **D-03:** Self-sufficient for WCAG 2.1 AA — contract specifies ARIA roles per element (role=listbox on well, role=option on chip), keyboard bindings (Tab/Arrow/Enter/Delete), AND live-region announcement templates for each drag state transition (e.g., "Chip moved to position 3 of 5 in Filters"). No additional a11y design work should be needed by implementers.
- **D-04:** Grab mode pattern for keyboard drag — focus chip, Enter/Space to grab, arrow keys to reposition, Enter to drop, Escape to cancel. Standard ARIA Practices drag-and-drop pattern. Announcement on grab: "Grabbed [chip name], use arrow keys to reorder."

### Overflow & Degenerate Cases
- **D-05:** No hard chip limit per well — wells wrap chips to new rows as needed. Contract describes wrapping behavior and scroll affordance when content exceeds panel height. Practical limit is screen real estate, not an artificial number.
- **D-06:** Touch/iPad drag IS in scope — include basic touch spec alongside pointer events: long-press to grab, drag to move, release to drop. Makes the contract complete for the iPad target.
- **D-07:** Drag abort returns chip to original position — semantic description only, no animation specification. Consistent with D-02.

### Composition Seam Granularity
- **D-08:** Named interfaces with responsibilities — each seam gets: interface name, what it publishes, what it consumes, and which phase/WA owns the implementation. No TypeScript-flavored signatures. Phases 184/185 own implementation detail.

### Carried Forward (Locked)
- Cross-well drag: copy by default, modifier key for move, never reject (STATE.md)
- §3 PAFV binding: explicit "N/A — operator surface" with rationale (FE-RG-13)
- Coordinate system: wells vertically stacked, chips flow horizontally with wrap, fixed-height variable-width tokens (ROADMAP SC-2)
- Contract must be Formulas-agnostic — no Formulas-specific language (GEOM-06)

### Claude's Discretion
- Internal document structure (heading order, section breaks) — follow the geometry contract template structure
- Exact wording of ARIA announcement templates — use judgment for clarity and screen reader conventions
- Level of detail in §10 (Out of Scope) — enumerate the boundaries clearly but concisely
- Number and selection of degenerate cases in §6 — cover the ones named in the handoff plus any obvious gaps

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Geometry Contract Template (structural reference)
- `.planning/geometry-contract-template.md` — The 12-section template this contract fills. Defines section structure, intent, and expected content for each section.

### Time Explorer Geometry (cousin contract)
- `.planning/time-explorer-geometry.md` — Existing geometry contract for the Time Explorer. Structural peer — shows how a completed geometry contract looks. The key contrast: Time Explorer IS PAFV-bound; chip wells are NOT.

### Architecture Source
- `.planning/formulas-explorer-handoff-v2.md` §WA-6 (lines 270-298) — The primary guidance for this phase. Pre-specifies what each of the 12 sections should contain for chip wells specifically.

### Three-Explorer Boundary Spec (Phase 182 output)
- `.planning/milestones/v15.0-formulas-explorer/01-three-explorer-spec.md` — Defines which chip well categories each explorer hosts. This contract references those categories generically; per-explorer specifics live in 01-three-explorer-spec.md.

### Requirements
- `.planning/REQUIREMENTS.md` — Requirements GEOM-01 through GEOM-06 define acceptance criteria for this phase.

### Prior Decisions
- `.planning/STATE.md` §Accumulated Context — Contains locked decisions on cross-well drag, template fork, and other resolved open questions.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `.planning/geometry-contract-template.md` — Template to fill; 12-section structure with guidance prompts
- `.planning/time-explorer-geometry.md` — Completed geometry contract to reference for style and depth
- `src/ui/panels/FormulasPanelStub.ts` — Current stub; shows PanelFactory/PanelHook/PanelMeta registration pattern
- `src/ui/panels/PanelTypes.ts` — Panel type contracts that chip well integration points should reference

### Established Patterns
- Geometry contracts are standalone documents in `.planning/contracts/` or `.planning/` root
- Contracts describe function, not chrome — visual styling lives in design tokens / Figma
- Panel registration via PanelMeta (id, name, icon, description, dependencies, defaultEnabled)
- Pointer-event-based interaction (WKWebView constraint — no native drag API)

### Integration Points
- Explorer panels — chip wells are embedded within explorer panel UI
- Compilation pipeline (WA-2/Phase 184) — downstream consumer of chip well output
- Formula Card library (WA-3/Phase 185) — drag source for top-down card placement
- Cross-well drag — governed by copy-by-default rule from STATE.md

</code_context>

<specifics>
## Specific Ideas

No specific requirements beyond what the handoff document WA-6 section and resolved open questions provide. The handoff is the canonical source — the geometry contract formalizes it into the 12-section template structure.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 183-chip-well-geometry-contract*
*Context gathered: 2026-04-27*
