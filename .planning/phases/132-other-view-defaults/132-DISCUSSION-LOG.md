# Phase 132: Other View Defaults - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-27
**Phase:** 132-other-view-defaults
**Areas discussed:** View-to-source mappings, Badge presentation, Auto-switch UX, Non-SuperGrid defaults scope

---

## View-to-Source Mappings

### Curation Approach

| Option | Description | Selected |
|--------|-------------|----------|
| Hand-curate all 10 | Specify which views get recommended for each source type. Most control, matches Phase 131 (D-01). | ✓ |
| Curate obvious, Claude picks rest | Decide strong matches, Claude fills in weaker recommendations. | |
| You decide | Claude's discretion on full mapping table. | |

**User's choice:** Hand-curate all 10
**Notes:** Consistent with Phase 131 hand-curation philosophy.

### Recommendation Count

| Option | Description | Selected |
|--------|-------------|----------|
| 1 best view per type | Each source type gets exactly one recommended non-SuperGrid view. | ✓ |
| 1-3 ranked views per type | Multiple views recommended per type with ranking. | |
| 0-1 per type | Some types may not have a meaningful recommendation. | |

**User's choice:** 1 best view per type

### Date-Heavy Types

| Option | Description | Selected |
|--------|-------------|----------|
| Both → Timeline | Calendar and reminders both date-centric. | ✓ |
| Calendar → Timeline, Reminders → Kanban | Calendar date-centric, reminders task-centric. | |
| Calendar → Calendar/Map, Reminders → Timeline | Calendar view for calendar data, Timeline for reminders. | |

**User's choice:** Both → Timeline

### Hierarchical/Relational Types

| Option | Description | Selected |
|--------|-------------|----------|
| Notes → Tree, Alto → Network | Notes have folder hierarchy, Alto has cross-entity relationships. | ✓ |
| All three → Tree | All have folder/container structure. | |
| Notes → Tree, Alto → Tree | Both hierarchical. | |

**User's choice:** Notes → Tree, Alto → Network

### Generic File Imports

| Option | Description | Selected |
|--------|-------------|----------|
| No recommendation — SuperGrid is best | Structurally generic, no meaningful non-SuperGrid view. | ✓ |
| Markdown → Tree, rest → none | Markdown has folder structure. | |
| All → List as safe default | List as universal fallback. | |

**User's choice:** No recommendation — SuperGrid is best

---

## Badge Presentation

### Badge Style

| Option | Description | Selected |
|--------|-------------|----------|
| Static ✦ glyph after label | Append ✦ next to view label. Simple, no animation. | ✓ |
| Colored dot indicator | Small accent dot. Subtler but may confuse with notifications. | |
| Highlighted background | Subtle background tint on recommended items. | |

**User's choice:** Static ✦ glyph after label

### Tooltip

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, brief tooltip | Hover shows "Recommended for calendar data" via title attribute. | ✓ |
| No tooltip | ✦ is self-explanatory. | |
| Tooltip + first-time toast | Tooltip plus one-time toast explaining what ✦ means. | |

**User's choice:** Yes, brief tooltip

---

## Auto-Switch UX

### Feedback

| Option | Description | Selected |
|--------|-------------|----------|
| Toast explaining the switch | Brief toast: "Switched to Timeline — best view for calendar data." | ✓ |
| Silent switch | Just switch. Matches Phase 131 silent behavior. | |
| Toast with undo action | Toast with Undo button to return to SuperGrid. | |

**User's choice:** Toast explaining the switch

### Flag Gate

| Option | Description | Selected |
|--------|-------------|----------|
| Same flag — one gate for all defaults | Reuse `view:defaults:applied:{datasetId}`. One flag, one gate. | ✓ |
| Separate flag for view switch | New `view:autoswitch:applied:{datasetId}` flag. More granular. | |

**User's choice:** Same flag — one gate for all defaults

---

## Non-SuperGrid Defaults Scope

### Scope Decision

| Option | Description | Selected |
|--------|-------------|----------|
| View-specific config per type | Each recommended view gets whatever config makes it useful. | ✓ |
| Axes only — match Phase 131 | Keep registry to axes. Views handle own sort/filter defaults. | |
| Axes + sort only | Extend to sort field only. Middle ground. | |

**User's choice:** View-specific config per type

### Interface Design

| Option | Description | Selected |
|--------|-------------|----------|
| New ViewRecommendation interface | Separate from DefaultMapping. Clean separation. | ✓ |
| Extend DefaultMapping with optional fields | Add optional fields to existing interface. | |
| You decide | Claude's discretion on interface shape. | |

**User's choice:** New ViewRecommendation interface

---

## Claude's Discretion

- Specific viewConfig fields per view type
- Registry storage approach (same Map, parallel Map, or combined)
- Toast message wording and duration
- SidebarNav badge update mechanism

## Deferred Ideas

None — discussion stayed within phase scope
