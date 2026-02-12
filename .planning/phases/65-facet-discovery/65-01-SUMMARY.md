---
phase: 65-facet-discovery
plan: 01
subsystem: database
tags: [schema-on-read, node_properties, LATCH, dynamic-properties, EAV]

# Dependency graph
requires:
  - phase: 64-markdown-import
    provides: node_properties table with EAV storage for YAML frontmatter
provides:
  - Dynamic property discovery from node_properties table
  - LATCH bucket inference for arbitrary property keys
  - ClassifiedProperty interface with isDynamic flag
  - discoverDynamicProperties() function
affects: [facet-ui, filter-system, navigator-ui]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Schema-on-read: properties auto-classified without schema changes
    - LATCH inference: automatic bucket assignment based on value type and key patterns
    - Collision detection: dynamic properties with "(custom)" suffix for schema conflicts

key-files:
  created: []
  modified:
    - src/services/property-classifier.ts
    - src/services/__tests__/property-classifier.test.ts

key-decisions:
  - "Node count threshold of 3+ ensures only meaningful properties surface (reduces noise)"
  - "LATCH inference rules: number→H, array/boolean→C, date-keys→T, location-keys→L, string→A"
  - "Collision handling adds '(custom)' suffix rather than override schema facets"
  - "sourceColumn format 'node_properties.{key}' signals projection query to join EAV table"

patterns-established:
  - "Dynamic properties sortOrder = 1000 + bucket.length (appear after schema facets)"
  - "humanizeKey() converts snake_case to Title Case for display names"
  - "Value type detection from node_properties.value_type column (set by importer)"

# Metrics
duration: 4min
completed: 2026-02-12
---

# Phase 65 Plan 01: Facet Discovery Summary

**Schema-on-read dynamic property discovery with automatic LATCH bucket inference from node_properties EAV table**

## Performance

- **Duration:** 4 minutes
- **Started:** 2026-02-12T20:22:23Z
- **Completed:** 2026-02-12T20:26:02Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Extended ClassifiedProperty interface with isDynamic and nodeCount fields
- Implemented discoverDynamicProperties() querying node_properties with 3+ node threshold
- Added inferLATCHBucket() with smart routing: numbers→Hierarchy, arrays/booleans→Category, date-strings→Time, location-keys→Location, default→Alphabet
- Integrated dynamic properties into classifyProperties() with collision detection (adds "(custom)" suffix)
- Comprehensive test coverage: discovery, filtering, inference, collision handling

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend property classifier** - `9855b9f2` (feat)
   - Extended ClassifiedProperty interface
   - Added discoverDynamicProperties(), inferLATCHBucket(), humanizeKey()
   - Integrated into classifyProperties() with collision detection

2. **Task 2: Add tests** - `1678e532` (test)
   - Test dynamic property discovery from node_properties
   - Test node count threshold (>=3)
   - Test LATCH bucket inference for all value types
   - Test collision detection and "(custom)" suffix
   - Fixed FOUND-02 test for capitalized edge names

## Files Created/Modified
- `src/services/property-classifier.ts` - Added dynamic property discovery, LATCH inference, collision detection
- `src/services/__tests__/property-classifier.test.ts` - Added 4 new test cases for Phase 65 functionality

## Decisions Made

**Node count threshold = 3**: Properties appearing in fewer than 3 nodes are filtered out to reduce UI noise. Surfacing rare one-off properties would clutter navigators.

**LATCH inference priority**: Time detection (date patterns) before Location (address patterns) before default Alphabet. This ordering ensures date-like fields don't get misclassified.

**Collision suffix "(custom)"**: When dynamic property key matches schema facet sourceColumn, append " (custom)" to display name rather than skip or override. Preserves both schema and user data visibility.

**sourceColumn format**: Dynamic properties use `node_properties.{key}` format. This signals projection queries to JOIN the EAV table and extract the value. Schema facets use direct column names like `priority`.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - implementation followed spec cleanly. Pre-existing test needed update for capitalized edge type names (Link vs LINK) from earlier phase.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

**Ready for UI integration:** Dynamic properties now appear in classifyProperties() result with isDynamic flag. FilterNav can render them with badge showing nodeCount.

**Ready for projection queries:** sourceColumn format `node_properties.{key}` enables query builders to detect dynamic properties and generate appropriate JOINs.

**Schema-on-read complete:** Users can add arbitrary YAML frontmatter keys to markdown files, and they will automatically surface as filterable facets after import.

## Self-Check: PASSED

**Files:**
- ✓ src/services/property-classifier.ts
- ✓ src/services/__tests__/property-classifier.test.ts

**Commits:**
- ✓ 9855b9f2 (feat: dynamic property discovery)
- ✓ 1678e532 (test: comprehensive tests)

All claimed files and commits verified to exist.

---
*Phase: 65-facet-discovery*
*Completed: 2026-02-12*
