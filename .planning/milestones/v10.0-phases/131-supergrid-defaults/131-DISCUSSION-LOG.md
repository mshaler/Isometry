# Phase 131: SuperGrid Defaults - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-27
**Phase:** 131-supergrid-defaults
**Areas discussed:** Default axis mappings, Fallback strategy, Override detection, Registry architecture

---

## Default Axis Mappings

### Q1: How should we define the default axes for each source type?

| Option | Description | Selected |
|--------|-------------|----------|
| Hand-curated per type | Specify ideal col/row/sort/density/calc for each of the 9 SourceType values + alto_index catch-all | ✓ |
| Heuristic-based | Use SchemaProvider's LATCH classification to auto-pick axes | |
| Hybrid | Hand-curated for 9 known types, LATCH heuristic for unknown types | |

**User's choice:** Hand-curated per type
**Notes:** None — recommended option selected.

### Q2: For alto_index_* dynamic types, should each known directory get its own mapping?

| Option | Description | Selected |
|--------|-------------|----------|
| One alto_index catch-all | All alto_index_* directories share a single default mapping | ✓ |
| Per-directory mappings | Separate mappings for alto_index_notes, alto_index_contacts, etc. | |

**User's choice:** One alto_index catch-all
**Notes:** Alto Index data is structurally similar across directories (same protobuf schema).

### Q3: Should the registry also define sort and density/calc defaults?

| Option | Description | Selected |
|--------|-------------|----------|
| Axes only | Registry maps source_type → colAxes + rowAxes only | ✓ |
| Full PAFV + sort + density + calc | Registry maps all 5+ fields per source type | |
| Axes + sort only | Axes plus default sort order per type | |

**User's choice:** Axes only
**Notes:** Sort/density/calc are not source-type-specific enough to warrant per-type mappings.

---

## Fallback Strategy

### Q4: How should fallback columns be selected when the expected default is missing?

| Option | Description | Selected |
|--------|-------------|----------|
| Ordered fallback list | Each registry entry has a priority list; first valid one wins | ✓ |
| LATCH family fallback | Ask SchemaProvider for first available column in the same LATCH family | |
| First valid column | Use first column from getAllAxisColumns() | |

**User's choice:** Ordered fallback list
**Notes:** None — recommended option selected.

---

## Override Detection

### Q5: How should we detect that the user has overridden the defaults?

| Option | Description | Selected |
|--------|-------------|----------|
| Compare against registry | Pure comparison of current PAFV state vs registry output for this source_type | ✓ |
| Dirty flag | Boolean 'overridden' flag in ui_state | |
| Override key tracking | Separate override keys per dataset | |

**User's choice:** Compare against registry
**Notes:** No extra state needed — pure comparison function.

---

## Registry Architecture

### Q6: Where should the ViewDefaultsRegistry live?

| Option | Description | Selected |
|--------|-------------|----------|
| Static Map in its own file | New src/providers/ViewDefaultsRegistry.ts with frozen Map | ✓ |
| Inline in PAFVProvider | Extend existing VIEW_DEFAULTS constant | |
| JSON config file | External JSON loaded at boot | |

**User's choice:** Static Map in its own file
**Notes:** Matches STATE.md decision: "ViewDefaultsRegistry is a static Map."

### Q7: For alto_index_* matching, how should the registry key work?

| Option | Description | Selected |
|--------|-------------|----------|
| Prefix match with 'alto_index' key | Exact match first, then startsWith prefix match | ✓ |
| Wildcard key 'alto_index_*' | Glob matching | |
| Default/fallback entry | '_default' key catches unknown types | |

**User's choice:** Prefix match with 'alto_index' key
**Notes:** Same pattern as DedupEngine.

---

## Claude's Discretion

- Specific column names in each source type's default mapping
- The DefaultMapping TypeScript interface shape
- Whether applyDefaults() lives on PAFVProvider or standalone

## Deferred Ideas

None — discussion stayed within phase scope.
