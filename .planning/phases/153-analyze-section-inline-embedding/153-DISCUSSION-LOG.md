# Phase 153: Analyze Section Inline Embedding - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-16
**Phase:** 153-analyze-section-inline-embedding
**Areas discussed:** Filter toggle wiring, Cross-view filter persistence, Stacking order, Formulas stub scope

---

## Filter Toggle Wiring

| Option | Description | Selected |
|--------|-------------|----------|
| Special case (like DataExplorer) | showLatchFilters()/hideLatchFilters() functions with lazy mount into bottom-slot child div. Bypasses PanelRegistry. Matches Phase 152 pattern. | ✓ |
| PanelRegistry with redirected mount target | Keep PanelRegistry.enable/disable but change mount container to bottom-slot child div. More abstracted but PanelRegistry wasn't designed for positional slot mounting. | |

**User's choice:** Special case (like DataExplorer)
**Notes:** None

### Follow-up: Analyze onActivateItem Branch

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, dedicated branch | if (sectionKey === 'analyze') with itemKey routing for 'filter' and 'formula'. Clean separation matching integrate/visualize pattern. | ✓ |
| No, keep in dockToPanelMap | Remove from dockToPanelMap and handle via generic panel toggle path with special container logic. | |

**User's choice:** Yes, dedicated branch
**Notes:** None

---

## Cross-View Filter Persistence

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, sibling survival is enough | Bottom slot is sibling of view-content in flex column. View switches replace view-content internals only. Just verify with a test. | ✓ |
| Add explicit guard logic | In visualize branch, explicitly check and re-show bottom slot after view switch. Belt-and-suspenders. | |

**User's choice:** Sibling survival is enough
**Notes:** None

---

## Stacking Order

| Option | Description | Selected |
|--------|-------------|----------|
| Fixed order: Filters first, Formulas second | Child divs in fixed DOM order. Matches top-slot pattern. | ✓ |
| Dynamic order based on activation | Whichever toggled first appears on top. More complex, no prior pattern. | |

**User's choice:** Fixed order
**Notes:** None

---

## Formulas Stub Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse existing stub content | Mount FormulasPanelStub content (icon + heading + 'coming soon' body) into bottom-slot child div. | ✓ |
| Minimal placeholder | Styled div saying 'Formulas' with no description. | |
| Empty container only | Hidden child div shows nothing when toggled. | |

**User's choice:** Reuse existing stub content
**Notes:** None

---

## Claude's Discretion

- LatchExplorers instantiation approach (reuse factory closure vs inline constructor)
- syncBottomSlotVisibility implementation (standalone vs generic)
- CSS class naming for bottom-slot children
- Whether analyze branch hides DataExplorer on section switch

## Deferred Ideas

None — discussion stayed within phase scope
