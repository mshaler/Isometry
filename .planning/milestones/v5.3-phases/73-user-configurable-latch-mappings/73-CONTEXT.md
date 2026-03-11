# Phase 73: User-Configurable LATCH Mappings - Context

**Gathered:** 2026-03-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can override automatic LATCH family assignments for any column and toggle individual field visibility, with overrides persisted across sessions via ui_state (Tier 2). LatchExplorers and PropertiesExplorer reflect changes immediately. This phase does NOT add new LATCH families, new field types, or per-view overrides — configuration is global.

</domain>

<decisions>
## Implementation Decisions

### Reassignment interaction
- Dropdown picker triggered from a LATCH chip badge on each field row in PropertiesExplorer
- Chip shows current family letter (e.g., [C]) — click opens dropdown with all 5 LATCH families
- Dropdown marks the heuristic-assigned family with "(default)" suffix for reference
- Reassignment available in PropertiesExplorer only — LatchExplorers just reflect the result
- Instant re-render on reassignment: field disappears from old column, appears in new column immediately (no animation)

### Override visibility
- Overridden fields get a dot indicator on the LATCH chip badge (e.g., [C•] vs [C]) to distinguish from heuristic assignments
- No aggregate override count or summary in headers — dot indicators are sufficient
- Disabled fields shown greyed out in place within their LATCH column (reduced opacity, unchecked toggle)

### Reset behavior
- Per-field reset: selecting the "(default)" family in the dropdown clears the override — no extra UI needed
- Bulk "Reset all LATCH mappings" button in PropertiesExplorer footer, visible only when ≥1 override exists
- Confirmation dialog before bulk reset: "Reset N custom mappings to defaults?"
- "Reset all" only restores LATCH family assignments — does NOT re-enable disabled fields (separate concerns)

### Field disable scope
- Disabled fields removed entirely from LatchExplorers filter sections (not greyed out)
- Disabling a field auto-clears any active filters on it (FilterProvider.removeFilter() on disable)
- Disabled fields excluded from PropertiesExplorer and ProjectionExplorer available pools (per UCFG-02)
- SuperGrid continues to show all columns regardless of disabled state — it's a data view, not a configuration surface
- "Enable all" button in PropertiesExplorer footer (next to "Reset all"), visible only when ≥1 field is disabled

### Claude's Discretion
- Exact dropdown component implementation (native select, custom popover, etc.)
- Chip badge styling details (size, font, dot indicator implementation)
- Confirmation dialog styling for bulk reset
- ui_state key naming convention for override persistence
- SchemaProvider merge logic details (user overrides always win per UCFG-05)

</decisions>

<specifics>
## Specific Ideas

- LATCH chip badge serves dual purpose: visual indicator of current family + trigger for reassignment dropdown
- "(default)" label in dropdown helps users understand what they're deviating from and provides natural reset path
- Footer action area in PropertiesExplorer houses both "Reset all LATCH mappings" and "Enable all" — only visible when relevant

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `PropertiesExplorer` (src/ui/PropertiesExplorer.ts): Already has per-field toggle checkboxes grouped by LATCH columns — add chip badge + dropdown to existing row layout
- `SchemaProvider` (src/providers/SchemaProvider.ts): Already classifies columns into LATCH families via PRAGMA heuristics — needs override merge layer (UCFG-05)
- `getLatchFamily()` (src/providers/latch.ts): Delegates to SchemaProvider when wired, falls back to LATCH_FAMILIES_FALLBACK — override layer sits between these
- `LatchExplorers` (src/ui/LatchExplorers.ts): Uses `_getFieldsForFamily()` with SchemaProvider — will automatically reflect overrides once SchemaProvider merges them
- `CollapsibleSection` (src/ui/CollapsibleSection.ts): Reusable for any new UI sections
- `ActionToast` pattern: Available for undo feedback on reset actions
- `ui_state` persistence (src/worker/handlers/ui-state.handler.ts): Established Tier 2 pattern for session-surviving state

### Established Patterns
- D3 selection.join for DOM updates in PropertiesExplorer and LatchExplorers
- SchemaProvider subscriber notification via queueMicrotask batching
- `setSchemaProvider()` wiring pattern across providers (allowlist, StateManager, PAFVProvider, SuperDensityProvider)
- ui_state key convention: `notebook:{cardId}` for notebooks — likely `latch:overrides` and `latch:disabled` for this phase

### Integration Points
- SchemaProvider.initialize() — override merge must happen after PRAGMA classification, before consumers read
- PropertiesExplorer constructor/config — needs SchemaProvider reference (already optional `schema?` param)
- LatchExplorers._getFieldsForFamily() — already delegates to SchemaProvider, will reflect overrides automatically
- FilterProvider — disable handler must call removeFilter() for cleared fields
- ui_state Worker handler — persist/restore override and disabled-field maps

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 73-user-configurable-latch-mappings*
*Context gathered: 2026-03-11*
