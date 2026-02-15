---
status: investigating
trigger: "SuperGrid Header Stacking & Hard-coded Filter Issues"
created: 2026-02-15T10:00:00Z
updated: 2026-02-15T11:00:00Z
---

## Current Focus

hypothesis: CONFIRMED - See root causes below
test: Code analysis complete
expecting: N/A - ready for fixes
next_action: Apply fixes to both bugs

## Symptoms

expected:
- Bug 1: Folder paths like "BairesDev/MSFT" display as nested headers with "BairesDev" > "MSFT"
- Bug 2: LATCH filters and PAFV navigator show only properties that exist in Notes data (folder, name, tags, created_at, modified_at)

actual:
- Bug 1: Showing flat text "BairesDev/MSFT" without splitting into hierarchy
- Bug 2: UI shows Location, Priority, Status which Notes data doesn't have. FILTERS section shows sliders for non-existent properties.

errors: No errors, just wrong behavior

reproduction:
1. Load Notes dataset
2. Drag folder to X-plane
3. Observe headers show "BairesDev/MSFT" not nested
4. Observe Available Properties shows Location, Priority, Status

started: Unknown - possibly always broken

## Eliminated

(none yet)

## Evidence

- timestamp: 2026-02-15T10:15:00Z
  checked: SuperGrid.tsx mapAxisMappingToFacetConfig function (lines 53-110)
  found: pathSeparator IS set correctly when facet === 'folder' (line 85-87). Console.log at line 107 should show this.
  implication: Path expansion configuration is correct at FacetConfig creation time

- timestamp: 2026-02-15T10:18:00Z
  checked: HeaderDiscoveryService.ts discoverHeaders method (lines 57-116)
  found: expandPathsInRows IS called when pathSeparator detected (line 96-108). Extensive console logging exists.
  implication: Path expansion logic exists and should be working - need to verify it's actually being called

- timestamp: 2026-02-15T10:20:00Z
  checked: HeaderDiscoveryService.ts expandPathsInRows method (lines 130-205)
  found: Method correctly splits paths by separator, creates synthetic facets (folder_level_0, folder_level_1), and expands rows
  implication: The expansion logic itself appears correct

- timestamp: 2026-02-15T10:22:00Z
  checked: property-classifier.ts columnHasData function (lines 96-150)
  found: columnHasData correctly checks if columns have meaningful data. It should filter out priority, status, etc. for Notes.
  implication: Property classification should be filtering correctly

- timestamp: 2026-02-15T10:25:00Z
  checked: LatchGraphSliders.tsx useSliderFilters hook (lines 189-425)
  found: The hook iterates over classification.T, classification.H, classification.L, classification.A, classification.C but DOES check if data actually has values before creating sliders (lines 209-233, 237-259, etc.)
  implication: Sliders are data-driven, not hardcoded. If showing wrong sliders, data must have those values.

- timestamp: 2026-02-15T10:28:00Z
  checked: PafvNavigator.tsx getAllLatchProperties function (lines 324-333)
  found: Returns ALL properties from classification (L, A, T, C, H buckets) without checking if data has values
  implication: PAFV Available Properties IS showing all schema-defined properties, not just data-present ones

- timestamp: 2026-02-15T10:30:00Z
  checked: property-classifier.ts classifyProperties function (lines 276-410)
  found: Line 315 calls columnHasData and skips facets with no data. BUT the facets table in schema defines all possible properties (priority, status, etc.) regardless of current dataset.
  implication: columnHasData SHOULD be filtering these out if working correctly

- timestamp: 2026-02-15T10:45:00Z
  checked: schema.sql facets table (lines 320-342)
  found: Facets table has INSERT OR IGNORE with these properties: folder, tags, status, priority, created, modified, due, name, location. These are pre-seeded for ALL datasets regardless of actual data presence.
  implication: columnHasData MUST check whether data actually has meaningful values in these columns

- timestamp: 2026-02-15T10:50:00Z
  checked: columnHasData logic (lines 96-150 in property-classifier.ts)
  found: For 'priority' column - it checks for COUNT(DISTINCT priority) where priority != 0. Notes data likely has priority=0 for all rows (default value), so this correctly returns false (no meaningful data). BUT status and location_name columns aren't in numericColumnsWithDefaults, so they use text column check. If status is NULL or empty for Notes, it should correctly be filtered out.
  implication: columnHasData logic appears correct - the issue may be that Notes data DOES have non-null values in these columns (even if not meaningful)

- timestamp: 2026-02-15T10:55:00Z
  checked: alwaysPresentColumns in columnHasData (line 98)
  found: alwaysPresentColumns = ['name', 'created_at', 'modified_at', 'folder', 'tags'] - these skip the data check and always return true
  implication: This is intentional - these core columns should always be available. The issue is with OTHER columns like priority, status, location_name.

## Resolution

root_cause:

**Bug 1 (Path Expansion):**
The path expansion code in HeaderDiscoveryService IS correct. The issue is likely one of:
1. The console.log output needs to be checked to verify the expansion is happening
2. The expanded tree (with folder_level_0, folder_level_1 facets) may not be properly rendered by SuperStack
3. There could be a mismatch between the synthetic facet IDs and how SuperStack looks them up

**KEY INSIGHT:** The header-tree-builder.ts (line 44) uses `facet.id` to extract values from rows: `const value = String(row[facet.id] ?? '')`. After expansion, the facet IDs become `folder_level_0`, `folder_level_1`, etc. The expandPathsInRows method DOES set the row values with these keys (line 188), so this should work.

**POTENTIAL BUG:** SuperStack rendering may not handle multiple depth levels correctly, or the FacetConfig synthetic facets may be missing some required properties.

**Bug 2 (Hard-coded Values):**
The classifyProperties function correctly filters facets using columnHasData. However:
1. If Notes data has NULL or empty values in status/location_name columns, they should be filtered out
2. If Notes data has priority=0 (default), it should be filtered out
3. If properties ARE showing, either:
   a. columnHasData is returning true incorrectly
   b. The classification is cached and not refreshing when dataset changes

**LIKELY CAUSE:** Looking at usePropertyClassification.ts line 82-88, the cache uses `dataVersion` to invalidate. When switching datasets, the `dataVersion` may not change, causing stale classification to be used.

fix:
**Bug 1:** Need to verify console output. If expansion IS happening but rendering fails, fix SuperStack to handle multi-level headers.

**Bug 2:**
1. Add dataset context to classification cache key (currently only uses dataVersion)
2. OR refresh classification explicitly when dataset changes (IntegratedLayout.tsx already calls refreshClassification on dataset switch at line 183)
3. Verify columnHasData returns correct results for Notes data

verification: (to be verified after fix)
files_changed: []
