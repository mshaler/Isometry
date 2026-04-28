# Phase 188: UX Interaction Spec - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-27
**Phase:** 188-ux-interaction-spec
**Areas discussed:** Live preview flow, Reversibility model, Error state presentation, Save-as-Formula promotion UI

---

## Live Preview Flow

### Q1: When should live preview trigger after a chip change?

| Option | Description | Selected |
|--------|-------------|----------|
| Immediate | Every chip drop/reorder/remove instantly re-compiles and re-runs. sql.js <50ms. | ✓ |
| Debounced 300ms | Wait 300ms after last change before re-running. | |
| Explicit Run button | User clicks Run to preview. Breaks continuous feel. | |

**User's choice:** Immediate
**Notes:** Matches Cryptex "continuous tactile interaction" principle.

### Q2: How should the result animate into the active view?

| Option | Description | Selected |
|--------|-------------|----------|
| D3 keyed transition | Existing D3 data-join pattern — rows enter/exit/update with transitions. | ✓ |
| Crossfade snapshot | Freeze current view, crossfade to new result. | |
| Instant swap | No animation — immediate re-render. | |

**User's choice:** D3 keyed transition
**Notes:** Consistent with SuperGrid and other views. No new animation system.

### Q3: What should the user see during a long-running query?

| Option | Description | Selected |
|--------|-------------|----------|
| Inline skeleton | Subtle shimmer overlaid on current view. Results stay visible but dimmed. | ✓ |
| Spinner in chip well | Small spinner in chip well header. View stays static. | |
| Progress bar | Thin bar at top of view panel. | |

**User's choice:** Inline skeleton
**Notes:** Old state remains readable. Matches "no commit until commit."

---

## Reversibility Model

### Q4: How should undo/redo work for chip arrangements?

| Option | Description | Selected |
|--------|-------------|----------|
| Per-well stack | Each chip well maintains its own undo stack. | ✓ |
| Global arrangement stack | Single stack across all wells. | |
| Per-explorer stack | Stack per explorer (Formulas/Marks/Audits). | |

**User's choice:** Per-well stack
**Notes:** Simple, predictable, matches "arrangement level" roadmap language.

### Q5: How deep should the undo stack be?

| Option | Description | Selected |
|--------|-------------|----------|
| Unlimited in-memory | All snapshots until session ends. Trivial memory cost. | ✓ |
| Fixed depth (20 steps) | Cap at 20 levels. | |
| Since last save | Resets on Formula Card save. | |

**User's choice:** Unlimited in-memory
**Notes:** None.

### Q6: When user undoes, should live preview re-run?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, immediately | Same compile + D3 transition as regular change. | ✓ |
| No, require explicit action | Reverts chips visually but no query re-run. | |

**User's choice:** Yes, immediately
**Notes:** Consistent behavior throughout.

---

## Error State Presentation

### Q7: Where should errors appear?

| Option | Description | Selected |
|--------|-------------|----------|
| Inline on chip | Red outline + error icon on offending chip. Tooltip on hover. | ✓ |
| Banner above chip well | Error banner at top of explorer panel. | |
| Toast notification | Transient toast in corner. | |

**User's choice:** Inline on chip
**Notes:** Spatially co-located with cause. For cycles, all participating chips highlight.

### Q8: What recovery action for errors?

| Option | Description | Selected |
|--------|-------------|----------|
| Undo suggestion | Error tooltip includes "Undo" link leveraging per-well stack. | ✓ |
| Remove chip | Offers to remove the offending chip entirely. | |
| Manual fix only | Show error, let user figure out fix. | |

**User's choice:** Undo suggestion
**Notes:** Leverages per-well undo stack from reversibility decisions.

### Q9: Should compilation errors block preview or show partial results?

| Option | Description | Selected |
|--------|-------------|----------|
| Partial results | Run valid chips, skip erroring ones. Indicator shows exclusions. | ✓ |
| Block entirely | Don't run query if any chip errors. | |
| Last valid state | Keep previous result, don't update. | |

**User's choice:** Partial results
**Notes:** User sees effect of valid chips while fixing errors. Matches "combination reveals insight."

---

## Save-as-Formula Promotion UI

### Q10: How should the dialog be triggered?

| Option | Description | Selected |
|--------|-------------|----------|
| Explicit button | "Save as Formula" button in chip-well toolbar. | ✓ |
| Context menu | Right-click / long-press for Save option. | |
| Both button + context menu | Persistent button AND context menu. | |

**User's choice:** Explicit button
**Notes:** Deliberate action, always visible. Matches "no commit until commit."

### Q11: What fields should the promotion dialog show?

| Option | Description | Selected |
|--------|-------------|----------|
| Name + description | Required name, optional description. Minimal friction. | ✓ |
| Name + desc + visibility | Add visibility dropdown. | |
| Full metadata form | Name, desc, visibility, scope, tags. | |

**User's choice:** Name + description
**Notes:** Visibility defaults active, scope defaults dataset. Advanced fields editable later.

### Q12: What happens after confirm?

| Option | Description | Selected |
|--------|-------------|----------|
| Toast + chips stay | Success toast, chips remain. Can continue editing (new version on next save). | ✓ |
| Toast + navigate to card | Toast then navigate to library. Interrupts flow. | |
| Toast + clear wells | Toast then clear wells. Loses context. | |

**User's choice:** Toast + chips stay
**Notes:** Lowest friction. Arrangement is both live preview and saved card.

---

## Claude's Discretion

- Explain panel toggle placement and interaction
- D3 transition timing/easing specifics
- Keyboard shortcut mapping for undo/redo
- Error clearing behavior
- Multiple simultaneous errors presentation
- Wireframe text description formatting

## Deferred Ideas

None — discussion stayed within phase scope.
