# Requirements: Isometry v13.3 SuperWidget Shell

**Defined:** 2026-04-21
**Core Value:** SuperGrid renders imported data through PAFV spatial projection with zero serialization — sql.js queries directly feed D3.js data joins.

## v1 Requirements

Requirements for v13.3. Each maps to roadmap phases.

### Tab Management

- [x] **TABS-01**: User can create a new tab via + button in the tab bar
- [x] **TABS-02**: User can close a tab via × button (last tab cannot be closed)
- [x] **TABS-03**: User can switch between tabs by clicking tab headers
- [x] **TABS-04**: Active tab has a visible indicator distinguishing it from inactive tabs
- [x] **TABS-05**: User can reorder tabs via pointer drag-and-drop
- [x] **TABS-06**: Tab bar shows overflow chevrons when tabs exceed available width
- [x] **TABS-07**: User can navigate tabs via keyboard (roving tabindex, arrow keys)
- [x] **TABS-08**: User can close active tab via Cmd+W shortcut
- [x] **TABS-09**: TabSlot type wraps Projection without conflating shell-level tabs with canvas-internal tabs
- [x] **TABS-10**: Tab metadata (canvas type label, badge) flows upward via onTabMetadataChange callback (CANV-06 preserved)

### Shell Replacement

- [x] **SHEL-01**: SuperWidget is the top-level container mounted on #app
- [x] **SHEL-02**: DockNav re-parented as sidebar alongside SuperWidget canvas area
- [x] **SHEL-03**: CommandBar migrated to SuperWidget header slot
- [x] **SHEL-04**: WorkbenchShell fully retired (file deleted or emptied)
- [x] **SHEL-05**: StateCoordinator 16ms batch window drained before shell teardown during migration
- [x] **SHEL-06**: All ~40 shell.* wiring points in main.ts re-routed to SuperWidget equivalents

### Explorer Sidecar

- [x] **SIDE-01**: Bound views auto-show their explorer sidecar (SuperGrid → ProjectionExplorer)
- [x] **SIDE-02**: Switching to unbound view auto-hides the sidecar
- [x] **SIDE-03**: Sidecar show/hide uses CSS grid-template-columns transition (not JS animation)
- [x] **SIDE-04**: Multiple explorers can be mounted in sidecar slots (top-slot, bottom-slot preserved)
- [x] **SIDE-05**: Sidecar show/hide does not trigger unnecessary Worker re-queries or canvas re-renders

### Status Slots

- [x] **STAT-01**: ViewCanvas status shows view name and card count
- [x] **STAT-02**: EditorCanvas status shows active card title
- [x] **STAT-03**: ExplorerCanvas status shows dataset name and last import time
- [x] **STAT-04**: Status slot DOM is cleared on canvas type change in commitProjection
- [x] **STAT-05**: ViewCanvas status includes active filter summary count
- [x] **STAT-06**: Status bar shows CKSyncEngine sync status indicator
- [x] **STAT-07**: ViewCanvas status includes selection count when selection is active

### Tab Persistence

- [x] **PRST-01**: Active tab and enabled tab list survive page reload via StateManager
- [x] **PRST-02**: SuperWidgetStateProvider registered under ui_state key convention (sw:zone:{role}:tabs)
- [x] **PRST-03**: Tab state restores correctly after canvas registry is populated (boot-sequencing)
- [x] **PRST-04**: Migration layer handles sessions with no prior tab state (fresh upgrade path)

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Tab Management

- **TABS-11**: Tab drag-to-detach into separate window
- **TABS-12**: Tab pinning (pinned tabs cannot be closed or reordered past other pinned tabs)
- **TABS-13**: Tab context menu (close others, close to the right)

### Status Slots

- **STAT-08**: Animated auto-save indicator in status bar
- **STAT-09**: Status bar click-to-navigate (click card count opens Data Explorer)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Tab drag-to-detach into separate window | WKWebView architectural impossibility — single web content process |
| Unlimited tab count | Overflow degrades discoverability — cap at 6-8 tabs |
| Per-dataset tab state | Product decision deferred — global tab state simpler for v1 |
| Animated auto-save indicator | Misleading with checkpoint model — CKSyncEngine status is correct |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| TABS-01 | Phase 174 | Complete |
| TABS-02 | Phase 174 | Complete |
| TABS-03 | Phase 174 | Complete |
| TABS-04 | Phase 174 | Complete |
| TABS-05 | Phase 174 | Complete |
| TABS-06 | Phase 174 | Complete |
| TABS-07 | Phase 174 | Complete |
| TABS-08 | Phase 174 | Complete |
| TABS-09 | Phase 174 | Complete |
| TABS-10 | Phase 174 | Complete |
| SHEL-01 | Phase 175 | Complete |
| SHEL-02 | Phase 175 | Complete |
| SHEL-03 | Phase 175 | Complete |
| SHEL-04 | Phase 175 | Complete |
| SHEL-05 | Phase 175 | Complete |
| SHEL-06 | Phase 175 | Complete |
| SIDE-01 | Phase 176 | Complete |
| SIDE-02 | Phase 176 | Complete |
| SIDE-03 | Phase 176 | Complete |
| SIDE-04 | Phase 176 | Complete |
| SIDE-05 | Phase 176 | Complete |
| STAT-01 | Phase 176 | Complete |
| STAT-02 | Phase 176 | Complete |
| STAT-03 | Phase 176 | Complete |
| STAT-04 | Phase 176 | Complete |
| STAT-05 | Phase 176 | Complete |
| STAT-06 | Phase 176 | Complete |
| STAT-07 | Phase 176 | Complete |
| PRST-01 | Phase 177 | Complete |
| PRST-02 | Phase 177 | Complete |
| PRST-03 | Phase 177 | Complete |
| PRST-04 | Phase 177 | Complete |

**Coverage:**
- v1 requirements: 32 total
- Mapped to phases: 32
- Unmapped: 0

---
*Requirements defined: 2026-04-21*
*Last updated: 2026-04-21 after roadmap creation*
