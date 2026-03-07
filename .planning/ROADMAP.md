# Roadmap: Isometry v5

## Overview

Isometry v5 builds a local-first polymorphic data projection platform where sql.js (WASM with FTS5) serves as the single source of truth and D3.js data joins serve as state management -- no framework, no parallel state store. The build is dependency-driven: database foundation first, then CRUD and query functions, then Worker Bridge, then Providers and Views. The web runtime ships as a complete unit. v2.0 wraps that runtime in a native SwiftUI multiplatform shell. v3.0 completes SuperGrid as a fully dynamic, interactive PAFV projection surface. v3.1 extends SuperGrid to N-level axis stacking with collapsible headers, aggregate/hide collapse modes, drag reorder, and full compound D3 keying. v4.0 adds native macOS importers for Apple Notes, Reminders, and Calendar via direct system database reads. v4.1 adds visual intelligence (change tracking, source provenance, calculated field distinction), virtual scrolling for SuperGrid at scale, and full cross-device CloudKit record-level sync replacing iCloud Documents file sync. v4.2 cleans up build pipeline, fills UX gaps (empty states, keyboard shortcuts, visual polish), hardens stability, and validates end-to-end ETL across all sources and views. v4.3 fixes runtime correctness bugs identified by Codex code review. v4.4 makes the app fully accessible, discoverable, and theme-aware -- command palette as universal entry point, full WCAG 2.1 AA compliance, light/dark/system theming, and guided empty states with sample data.

## Milestones

- ✅ **v0.1 Data Foundation** -- Phases 1-2 (shipped 2026-02-28)
- ✅ **v0.5 Providers + Views** -- Phases 4-6 (shipped 2026-02-28)
- ✅ **v1.0 Web Runtime** -- Phases 3, 7 (shipped 2026-03-01)
- ✅ **v1.1 ETL Importers** -- Phases 8-10 (shipped 2026-03-02)
- ✅ **v2.0 Native Shell** -- Phases 11-14 (shipped 2026-03-03)
- ✅ **v3.0 SuperGrid Complete** -- Phases 15-27 (shipped 2026-03-05)
- ✅ **v4.0 Native ETL** -- Phases 33-36 (shipped 2026-03-06)
- ✅ **v3.1 SuperStack** -- Phases 28-32 (shipped 2026-03-06)
- ✅ **v4.1 Sync + Audit** -- Phases 37-41 (shipped 2026-03-07)
- ✅ **v4.2 Polish + QoL** -- Phases 42-47 (shipped 2026-03-07)
- ✅ **v4.3 Review Fixes** -- Phase 48 (shipped 2026-03-07)
- **v4.4 UX Complete** -- Phases 49-52 (in progress)

## Phases

<details>
<summary>v0.1 Data Foundation (Phases 1-2) -- SHIPPED 2026-02-28</summary>

- [x] Phase 1: Database Foundation (4/4 plans) -- completed 2026-02-28
- [x] Phase 2: CRUD + Query Layer (6/6 plans) -- completed 2026-02-28

See: `.planning/milestones/v0.1-ROADMAP.md` for full details.

</details>

<details>
<summary>v0.5 Providers + Views (Phases 4-6) -- SHIPPED 2026-02-28</summary>

- [x] Phase 4: Providers + MutationManager (7/7 plans) -- completed 2026-02-28
- [x] Phase 5: Core D3 Views + Transitions (4/4 plans) -- completed 2026-02-28
- [x] Phase 6: Time + Visual Views (3/3 plans) -- completed 2026-02-28

See: `.planning/milestones/v0.5-ROADMAP.md` for full details.

</details>

<details>
<summary>v1.0 Web Runtime (Phases 3, 7) -- SHIPPED 2026-03-01</summary>

- [x] Phase 3: Worker Bridge (3/3 plans) -- completed 2026-03-01
- [x] Phase 7: Graph Views + SuperGrid (4/4 plans) -- completed 2026-03-01

See: `.planning/milestones/v1.0-ROADMAP.md` for full details.

</details>

<details>
<summary>v1.1 ETL Importers (Phases 8-10) -- SHIPPED 2026-03-02</summary>

- [x] Phase 8: ETL Foundation + Apple Notes Parser (5/5 plans) -- completed 2026-03-01
- [x] Phase 9: Remaining Parsers + Export Pipeline (5/5 plans) -- completed 2026-03-02
- [x] Phase 10: Progress Reporting + Polish (2/2 plans) -- completed 2026-03-02

See: `.planning/milestones/v1.1-ROADMAP.md` for full details.

</details>

<details>
<summary>v2.0 Native Shell (Phases 11-14) -- SHIPPED 2026-03-03</summary>

- [x] Phase 11: Xcode Shell + WKURLSchemeHandler (2/2 plans) -- completed 2026-03-02
- [x] Phase 12: Bridge + Data Persistence (3/3 plans) -- completed 2026-03-03
- [x] Phase 13: Native Chrome + File Import (3/3 plans) -- completed 2026-03-03
- [x] Phase 14: iCloud + StoreKit Tiers (3/3 plans) -- completed 2026-03-03

See: `.planning/milestones/v2.0-ROADMAP.md` for full details.

</details>

<details>
<summary>v3.0 SuperGrid Complete (Phases 15-27) -- SHIPPED 2026-03-05</summary>

- [x] Phase 15: PAFVProvider Stacked Axes (2/2 plans) -- completed 2026-03-04
- [x] Phase 16: SuperGridQuery Worker Wiring (2/2 plans) -- completed 2026-03-04
- [x] Phase 17: SuperGrid Dynamic Axis Reads (2/2 plans) -- completed 2026-03-04
- [x] Phase 18: SuperDynamic (2/2 plans) -- completed 2026-03-04
- [x] Phase 19: SuperPosition + SuperZoom (3/3 plans) -- completed 2026-03-04
- [x] Phase 20: SuperSize (2/2 plans) -- completed 2026-03-05
- [x] Phase 21: SuperSelect (4/4 plans) -- completed 2026-03-05
- [x] Phase 22: SuperDensity (3/3 plans) -- completed 2026-03-05
- [x] Phase 23: SuperSort (3/3 plans) -- completed 2026-03-05
- [x] Phase 24: SuperFilter (3/3 plans) -- completed 2026-03-05
- [x] Phase 25: SuperSearch (3/3 plans) -- completed 2026-03-05
- [x] Phase 26: SuperTime (3/3 plans) -- completed 2026-03-05
- [x] Phase 27: SuperCards + Polish (3/3 plans) -- completed 2026-03-05

See: `.planning/milestones/v3.0-ROADMAP.md` for full details.

</details>

<details>
<summary>v4.0 Native ETL (Phases 33-36) -- SHIPPED 2026-03-06</summary>

- [x] Phase 33: Native ETL Foundation (3/3 plans) -- completed 2026-03-06
- [x] Phase 34: Reminders + Calendar Adapters (3/3 plans) -- completed 2026-03-06
- [x] Phase 35: Notes Adapter -- Title + Metadata (1/1 plan) -- completed 2026-03-06
- [x] Phase 36: Notes Content Extraction (2/2 plans) -- completed 2026-03-06

See: `.planning/milestones/v4.0-ROADMAP.md` for full details.

</details>

<details>
<summary>v3.1 SuperStack (Phases 28-32) -- SHIPPED 2026-03-06</summary>

- [x] Phase 28: N-Level Foundation (3/3 plans) -- completed 2026-03-05
- [x] Phase 29: Multi-Level Row Headers (2/2 plans) -- completed 2026-03-05
- [x] Phase 30: Collapse System (3/3 plans) -- completed 2026-03-06
- [x] Phase 31: Drag Reorder (2/2 plans) -- completed 2026-03-06
- [x] Phase 32: Polish and Performance (2/2 plans) -- completed 2026-03-06

See: `.planning/milestones/v3.1-ROADMAP.md` for full details.

</details>

<details>
<summary>v4.1 Sync + Audit (Phases 37-41) -- SHIPPED 2026-03-07</summary>

- [x] Phase 37: SuperAudit (3/3 plans) -- completed 2026-03-07
- [x] Phase 38: Virtual Scrolling (2/2 plans) -- completed 2026-03-07
- [x] Phase 39: CloudKit Architecture (3/3 plans) -- completed 2026-03-07
- [x] Phase 40: CloudKit Card Sync (2/2 plans) -- completed 2026-03-07
- [x] Phase 41: CloudKit Connection Sync + Polish (2/2 plans) -- completed 2026-03-07

See: `.planning/milestones/v4.1-ROADMAP.md` for full details.

</details>

<details>
<summary>v4.2 Polish + QoL (Phases 42-47) -- SHIPPED 2026-03-07</summary>

- [x] Phase 42: Build Health (3/3 plans) -- completed 2026-03-07
- [x] Phase 43: Empty States + First Launch (2/2 plans) -- completed 2026-03-07
- [x] Phase 44: Keyboard Shortcuts + Navigation (2/2 plans) -- completed 2026-03-07
- [x] Phase 45: Visual Polish (3/3 plans) -- completed 2026-03-07
- [x] Phase 46: Stability + Error Handling (2/2 plans) -- completed 2026-03-07
- [x] Phase 47: ETL Validation (3/3 plans) -- completed 2026-03-07

See: `.planning/milestones/v4.2-ROADMAP.md` for full details.

</details>

<details>
<summary>v4.3 Review Fixes (Phase 48) -- SHIPPED 2026-03-07</summary>

- [x] Phase 48: Review Fixes (2/2 plans) -- completed 2026-03-07

See: `.planning/milestones/v4.3-ROADMAP.md` for full details.

</details>

### v4.4 UX Complete (Phases 49-52)

**Milestone Goal:** Make the app fully accessible, discoverable, and theme-aware -- command palette as universal entry point, full WCAG 2.1 AA compliance, light/dark/system theming, and guided empty states with sample data.

- [ ] **Phase 49: Theme System** - Light/Dark/System CSS theming with native shell sync
- [ ] **Phase 50: Accessibility** - WCAG 2.1 AA compliance across all views and SuperGrid
- [ ] **Phase 51: Command Palette** - Cmd+K universal entry point with fuzzy search
- [ ] **Phase 52: Sample Data + Empty States** - One-click sample data and guided per-view CTAs

## Phase Details

### Phase 49: Theme System
**Goal**: Users can choose how the app looks -- light, dark, or matching their system preference -- and the choice persists across sessions and stays consistent between the native shell and web runtime
**Depends on**: Nothing (first phase of v4.4; restructures CSS tokens that all subsequent phases build on)
**Requirements**: THME-01, THME-02, THME-03, THME-04, THME-05, THME-06, THME-07
**Success Criteria** (what must be TRUE):
  1. User can toggle between Light, Dark, and System in a settings UI, and the entire app recolors immediately without page reload
  2. All 9 views render correctly in light mode -- no invisible text, no unreadable SVG elements, no hardcoded hex colors bleeding through
  3. Switching macOS/iOS system appearance while the app is set to "System" theme updates the app in real time
  4. Theme choice survives app restart (relaunch shows the previously selected theme)
  5. The native SwiftUI sidebar, toolbar, and status bar appearance matches the web content theme
**Plans**: 3 plans

Plans:
- [ ] 49-01-PLAN.md — CSS token restructuring with dark/light/system palettes and hardcoded color migration
- [ ] 49-02-PLAN.md — ThemeProvider with persistence, matchMedia listener, and keyboard shortcut
- [ ] 49-03-PLAN.md — Native SwiftUI shell theme sync with Appearance picker

### Phase 50: Accessibility
**Goal**: Users who rely on screen readers, keyboard navigation, or adjusted display settings can operate the full application -- every view, every interaction, every state change is perceivable and operable
**Depends on**: Phase 49 (contrast audit requires finalized light and dark token palettes)
**Requirements**: A11Y-01, A11Y-02, A11Y-03, A11Y-04, A11Y-05, A11Y-06, A11Y-07, A11Y-08, A11Y-09, A11Y-10, A11Y-11
**Success Criteria** (what must be TRUE):
  1. VoiceOver reads meaningful descriptions when landing on any SVG view ("Network view, 42 cards") and navigates SuperGrid rows/columns with structural context
  2. A keyboard-only user can reach every interactive element (toolbar buttons, view switcher, SVG nodes, SuperGrid cells) via Tab/Shift+Tab and activate them with Enter/Space
  3. All text and UI elements pass WCAG 2.1 AA contrast ratios in both light and dark themes -- no invisible or hard-to-read content
  4. Enabling "Reduce Motion" in system settings suppresses all D3 transitions, SVG morphs, and crossfade animations
  5. A skip-to-content link is the first Tab stop, and an aria-live region announces view switches, filter changes, and import completions without requiring the user to navigate to the notification
**Plans**: TBD

Plans:
- [ ] 50-01: TBD
- [ ] 50-02: TBD
- [ ] 50-03: TBD

### Phase 51: Command Palette
**Goal**: Users can discover and execute any action from a single Cmd+K overlay -- switching views, searching cards, toggling settings, and invoking commands -- without memorizing menus or shortcuts
**Depends on**: Phase 50 (command palette implements WAI-ARIA combobox pattern established in the accessibility phase; consumes theme tokens from Phase 49)
**Requirements**: CMDK-01, CMDK-02, CMDK-03, CMDK-04, CMDK-05, CMDK-06, CMDK-07, CMDK-08
**Success Criteria** (what must be TRUE):
  1. User presses Cmd+K from any state and a search overlay appears; typing filters results in real time across views, actions, cards, and settings
  2. Arrow keys move selection through results, Enter executes the selected action (switching view, opening card, toggling setting), and Escape closes the palette
  3. Card search results come from the existing FTS5 index with debounced input -- typing a card name surfaces matching cards alongside action results
  4. Results are grouped by category (Views, Actions, Cards, Settings) with visual headers, and each result shows its keyboard shortcut where applicable
  5. Recently invoked commands appear at the top before search results, and contextual commands (like "Clear Filters") only appear when relevant
**Plans**: TBD

Plans:
- [ ] 51-01: TBD
- [ ] 51-02: TBD

### Phase 52: Sample Data + Empty States
**Goal**: First-time users can explore the app immediately with curated sample data, and every empty state guides them toward the next productive action
**Depends on**: Phase 51 (sample data "Clear" action discoverable via command palette; benefits from fully themed and accessible app)
**Requirements**: SMPL-01, SMPL-02, SMPL-03, SMPL-04, SMPL-05, SMPL-06, SMPL-07
**Success Criteria** (what must be TRUE):
  1. The welcome panel shows a "Try with sample data" button alongside existing import CTAs, and clicking it loads ~25 curated cards with connections that populate all 9 views
  2. Sample data is visually identifiable in the audit overlay (source='sample') and does not appear on other devices via CloudKit sync
  3. User can clear all sample data (via command palette or settings) without affecting any real imported data
  4. Each view-specific empty state shows a guided CTA relevant to that view (e.g., "Import notes to see your network graph") rather than a generic empty message
**Plans**: TBD

Plans:
- [ ] 52-01: TBD
- [ ] 52-02: TBD

## Progress

**Execution Order:**
Phases execute in numeric order. Phases 1-48 complete across 11 milestones. Phases 49-52 are v4.4 UX Complete.

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1-48 | v0.1-v4.3 | 145/145 | Complete | 2026-02-28 to 2026-03-07 |
| 49. Theme System | v4.4 | 0/3 | Planned | - |
| 50. Accessibility | v4.4 | 0/TBD | Not started | - |
| 51. Command Palette | v4.4 | 0/TBD | Not started | - |
| 52. Sample Data + Empty States | v4.4 | 0/TBD | Not started | - |

---
*Roadmap created: 2026-02-27*
*v0.1 Data Foundation shipped: 2026-02-28*
*v0.5 Providers + Views shipped: 2026-02-28*
*v1.0 Web Runtime shipped: 2026-03-01*
*v1.1 ETL Importers shipped: 2026-03-02*
*v2.0 Native Shell shipped: 2026-03-03*
*v3.0 SuperGrid Complete shipped: 2026-03-05*
*v4.0 Native ETL shipped: 2026-03-06*
*v3.1 SuperStack shipped: 2026-03-06*
*v4.1 Sync + Audit shipped: 2026-03-07*
*v4.2 Polish + QoL shipped: 2026-03-07*
*v4.3 Review Fixes shipped: 2026-03-07*
*v4.4 UX Complete roadmap created: 2026-03-07*
