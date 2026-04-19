---
status: resolved
trigger: "Clicking 'Data' in the DockNav shows both the Data Explorer AND the Projections Explorer simultaneously in the top slot, causing visual overlap."
created: 2026-04-18T23:15:00.000Z
updated: 2026-04-19T00:10:00.000Z
---

## Current Focus

hypothesis: CONFIRMED — two separate fixes applied: (1) PivotConfigPanel permanently hidden via display:none on mount (ProjectionExplorer is the canonical axis UI); (2) projection-explorer__well min-width: 0 + overflow: hidden prevents wells from overflowing the slot container at narrow widths.
test: TypeScript passes (0 errors). Pending human verification.
expecting: SuperGrid shows no embedded PivotConfigPanel at any time; ProjectionExplorer wells stay contained within top slot.
next_action: Human verify both problems are resolved

## Symptoms

expected: Clicking "Data" in DockNav shows only Data Explorer in top slot. Projections Explorer only appears when SuperGrid view is active and triggered from the Visualization dock section.
actual: Both Data Explorer and Projections Explorer render simultaneously in the top slot when Data dock item is clicked, while SuperGrid is the active view.
errors: No console errors — this is a panel visibility/routing logic bug
reproduction: 1) Have SuperGrid as active view 2) Click "Data" icon in dock 3) Both Data Explorer AND Projections Explorer appear in top slot
started: Observed after v12.0 Phase 160. Likely related to Phase 152 (top slot embedding), Phase 153 (bottom slot), or Phase 156 (PanelManager architecture).

## Eliminated

- hypothesis: ProjectionExplorer has its own auto-show logic that fires on Data click
  evidence: ProjectionExplorer has no show/hide logic of its own — it is purely a UI component. All visibility is controlled by PanelManager.
  timestamp: 2026-04-18T23:20:00.000Z

- hypothesis: panelManager 'projection' panel is re-shown after hide('projection') is called
  evidence: PanelManager has no subscription/async behavior. hide() is synchronous, no re-show path exists. The previous fix (hide 'projection' in integrate:catalog branch) is correct but addresses the wrong component.
  timestamp: 2026-04-18T23:45:00.000Z

- hypothesis: The duplicate "AVAILABLE, ROWS, COLUMNS, Z" UI is the panelManager 'projection' panel (ProjectionExplorer)
  evidence: ProjectionExplorer wells are labeled "Available, X, Y, Z". The user-visible "AVAILABLE, ROWS, COLUMNS, Z" labels match PivotConfigPanel (src/views/pivot/PivotConfigPanel.ts line 93-96) which renders inside PivotTable._configContainer, which is mounted inside the SuperGrid view-content area (NOT the top slot). The 'projection' panelManager panel is a separate DOM tree in projectionChildEl.
  timestamp: 2026-04-18T23:45:00.000Z

- hypothesis: PivotConfigPanel should be conditionally shown/hidden based on Data Explorer state
  evidence: This approach (setConfigPanelVisible toggle) was implemented in the prior session but is over-engineered. Since ProjectionExplorer is the sole canonical axis configuration UI, PivotConfigPanel should never be shown. The toggle adds complexity for no benefit.
  timestamp: 2026-04-19T00:10:00.000Z

## Evidence

- timestamp: 2026-04-18T23:18:00.000Z
  checked: main.ts onActivateItem handler, lines 897–941
  found: When integrate:catalog is clicked and integrate group is not visible, panelManager.showGroup('integrate') is called. The 'integrate' coupling group contains only ['data-explorer', 'properties'] — 'projection' is NOT in this group and is not hidden.
  implication: The 'projection' panel stays visible when Data is clicked because there is no code in the integrate:catalog branch to hide it.

- timestamp: 2026-04-18T23:18:00.000Z
  checked: main.ts PanelManager config, lines 1697–1713
  found: groups config: [{ name: 'integrate', panelIds: ['data-explorer', 'properties'] }]. syncTopSlotVisibility() has no mutual-exclusion logic — it only checks if ANY child is visible.
  implication: The top slot renders all visible children simultaneously, so projection + data-explorer + properties can all be visible at once.

- timestamp: 2026-04-18T23:18:00.000Z
  checked: main.ts visualize section handler, lines 924–941
  found: When visualize:supergrid is clicked, panelManager.show('projection') is called. When a non-supergrid view is clicked, panelManager.hide('projection') is called. But this hide only fires on visualize section clicks — not on integrate section clicks.
  implication: Once 'projection' is shown by switching to SuperGrid, it stays shown until another visualize click occurs.

- timestamp: 2026-04-18T23:45:00.000Z
  checked: src/views/pivot/PivotConfigPanel.ts and PivotTable.ts
  found: PivotConfigPanel labels its zones "Available", "Rows", "Columns". PivotTable.mount() creates _configContainer and calls configPanel.mount(_configContainer) inside the PivotTable DOM, which lives inside view-content. This is completely separate from the panelManager's projectionChildEl in the top slot.
  implication: The user sees PivotConfigPanel (embedded in SuperGrid view-content) as a "duplicate" of the Projection Explorer, because both show field wells. The canonical fix is to always hide the PivotConfigPanel.

- timestamp: 2026-04-19T00:10:00.000Z
  checked: projection-explorer.css .projection-explorer__well
  found: min-width: 80px with flex: 1 1 0 prevents wells from shrinking below 80px each. With 4 wells (Available=2x, X, Y, Z) the minimum rendered width is 5×80=400px. At slot widths narrower than this, content overflows behind the DockNav sidebar.
  implication: Replace min-width: 80px with min-width: 0 and add overflow: hidden on the well to contain content without forcing a minimum rendered width.

## Resolution

root_cause: TWO distinct problems: (1) PivotConfigPanel embedded in PivotTable always renders in SuperGrid view-content, creating a redundant axis configuration UI alongside the top-slot ProjectionExplorer. The ProjectionExplorer is the canonical UI and PivotConfigPanel is vestigial — it predates the PanelManager/top-slot architecture. (2) projection-explorer__well had min-width: 80px which prevented flex shrinking, causing the wells to extend behind the DockNav sidebar at narrow slot widths.
fix: (1) Set display:none on _configContainer at mount time in PivotTable.ts — the panel is permanently hidden. Removed setConfigPanelVisible() from PivotTable and ProductionSuperGrid entirely. Removed all setConfigPanelVisible call sites from main.ts. (2) Changed .projection-explorer__well min-width from 80px to 0 and added overflow: hidden so wells flex-shrink to fit the available slot width. Added overflow:hidden + min-width:0 to chip labels for proper text truncation.
verification: TypeScript 0 errors. Pending human verification.
files_changed: [src/views/pivot/PivotTable.ts, src/views/pivot/ProductionSuperGrid.ts, src/main.ts, src/styles/projection-explorer.css]
