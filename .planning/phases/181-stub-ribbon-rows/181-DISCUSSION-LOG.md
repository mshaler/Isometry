# Phase 181: Stub Ribbon Rows - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-22
**Phase:** 181-stub-ribbon-rows
**Areas discussed:** Row placement strategy, Disabled visual treatment, Placeholder item labels, Row density

---

## Row Placement Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Separate grid rows | Add `stories` and `datasets` grid areas to superwidget.css, create new slots in SuperWidget.ts | ✓ |
| Stack inside existing ribbon slot | Render all three bars as siblings inside single `[data-slot="ribbon"]` | |
| You decide | Let Claude pick | |

**User's choice:** Separate grid rows
**Notes:** Clean separation, each row independently styleable.

---

## Disabled Visual Treatment

| Option | Description | Selected |
|--------|-------------|----------|
| Muted color only | `color: var(--text-muted)` + `opacity: 0.5` + `cursor: not-allowed`. No extra UI elements. | ✓ |
| Muted + "Coming Soon" tooltip | Same muted styling with native `title` tooltip on hover | |
| Muted + visible badge | Small "Coming Soon" label at end of each row | |
| You decide | Let Claude pick | |

**User's choice:** Muted color only (minimal)
**Notes:** None.

---

## Placeholder Item Labels

| Option | Description | Selected |
|--------|-------------|----------|
| Requirement examples verbatim | "New Story"/"Play"/"Share" and "Import"/"Export"/"Browse" | |
| Pick different labels | Claude's discretion on exact wording, differentiate from existing nav items | |
| You decide | Let Claude pick | ✓ |

**User's choice:** You decide
**Notes:** Claude should differentiate from existing nav ribbon labels.

---

## Row Density

| Option | Description | Selected |
|--------|-------------|----------|
| Match nav ribbon (56px) | Consistent visual weight, all three rows look like peers. Total ~168px. | ✓ |
| Compact stubs (~36-40px) | Shorter rows signal placeholder status through visual hierarchy. Total ~128px. | |
| You decide | Let Claude pick | |

**User's choice:** Match nav ribbon (56px each)
**Notes:** All three rows are visual peers with consistent height.

---

## Claude's Discretion

- Exact placeholder item labels and Lucide icon choices
- Whether stub rows reuse dock-nav.css or get separate CSS
- Whether stub item definitions use a data array or hardcoded DOM
- Section header label treatment

## Deferred Ideas

None — discussion stayed within phase scope.
