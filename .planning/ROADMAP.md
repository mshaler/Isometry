# Roadmap: Isometry v5

## Overview

Isometry v5 builds a local-first polymorphic data projection platform where sql.js (WASM with FTS5) serves as the single source of truth and D3.js data joins serve as state management — no framework, no parallel state store. The build is dependency-driven: database foundation first, then CRUD and query functions, then Worker Bridge, then Providers and Views. The web runtime ships as a complete unit. v2.0 wraps that runtime in a native SwiftUI multiplatform shell.

## Milestones

- ✅ **v0.1 Data Foundation** — Phases 1-2 (shipped 2026-02-28)
- ✅ **v0.5 Providers + Views** — Phases 4-6 (shipped 2026-02-28)
- ✅ **v1.0 Web Runtime** — Phases 3, 7 (shipped 2026-03-01)
- ✅ **v1.1 ETL Importers** — Phases 8-10 (shipped 2026-03-02)
- 🚧 **v2.0 Native Shell** — Phases 11-14 (in progress)

## Phases

<details>
<summary>✅ v0.1 Data Foundation (Phases 1-2) — SHIPPED 2026-02-28</summary>

- [x] Phase 1: Database Foundation (4/4 plans) — completed 2026-02-28
- [x] Phase 2: CRUD + Query Layer (6/6 plans) — completed 2026-02-28

See: `.planning/milestones/v0.1-ROADMAP.md` for full details.

</details>

<details>
<summary>✅ v0.5 Providers + Views (Phases 4-6) — SHIPPED 2026-02-28</summary>

- [x] Phase 4: Providers + MutationManager (7/7 plans) — completed 2026-02-28
- [x] Phase 5: Core D3 Views + Transitions (4/4 plans) — completed 2026-02-28
- [x] Phase 6: Time + Visual Views (3/3 plans) — completed 2026-02-28

See: `.planning/milestones/v0.5-ROADMAP.md` for full details.

</details>

<details>
<summary>✅ v1.0 Web Runtime (Phases 3, 7) — SHIPPED 2026-03-01</summary>

- [x] Phase 3: Worker Bridge (3/3 plans) — completed 2026-03-01
- [x] Phase 7: Graph Views + SuperGrid (4/4 plans) — completed 2026-03-01

See: `.planning/milestones/v1.0-ROADMAP.md` for full details.

</details>

<details>
<summary>✅ v1.1 ETL Importers (Phases 8-10) — SHIPPED 2026-03-02</summary>

- [x] Phase 8: ETL Foundation + Apple Notes Parser (5/5 plans) — completed 2026-03-01
- [x] Phase 9: Remaining Parsers + Export Pipeline (5/5 plans) — completed 2026-03-02
- [x] Phase 10: Progress Reporting + Polish (2/2 plans) — completed 2026-03-02

See: `.planning/milestones/v1.1-ROADMAP.md` for full details.

</details>

### 🚧 v2.0 Native Shell (In Progress)

**Milestone Goal:** Bring the complete TypeScript/D3.js/sql.js web runtime into a native SwiftUI multiplatform app with persistent storage, a native file picker, and optional iCloud sync and tier gating. Swift handles exactly five concerns — serving the Vite bundle with correct WASM MIME types, bridging 5 message types between JS and native, persisting the sql.js database as a file blob, providing a native file picker that feeds bytes to the existing ETL pipeline, and app lifecycle integration.

- [ ] **Phase 11: Xcode Shell + WKURLSchemeHandler** — Xcode multiplatform project, `app://` scheme handler, build pipeline, web runtime loads on iOS and macOS
- [ ] **Phase 12: Bridge + Data Persistence** — Full 5-message bridge protocol, DatabaseManager atomic read/write, lifecycle checkpoint saves, crash recovery
- [ ] **Phase 13: Native Chrome + File Import** — SwiftUI NavigationSplitView, iOS toolbar, macOS menus, native file picker delegating to existing ETL
- [ ] **Phase 14: iCloud + StoreKit Tiers** — iCloud Documents path, StoreKit 2 subscriptions, tier gating via LaunchPayload and FeatureGate

## Phase Details

### Phase 11: Xcode Shell + WKURLSchemeHandler
**Goal**: The web runtime loads and renders all 9 D3 views inside a native WKWebView on both iOS and macOS, with WASM serving correctly via a custom `app://` scheme
**Depends on**: Nothing (first phase of v2.0)
**Requirements**: SHELL-01, SHELL-02, SHELL-03, SHELL-04
**Success Criteria** (what must be TRUE):
  1. User opens the app on iOS simulator or macOS and sees the existing web runtime rendering all 9 D3 views without errors
  2. sql.js WASM loads without MIME type rejection in a Release build served via the `app://` scheme handler
  3. Xcode Run Script build phase runs `npm run build` automatically before each build, embedding the current `dist/` bundle
  4. In DEBUG builds, WKWebView loads from `localhost:5173` Vite dev server and hot module replacement is functional
**Plans**: TBD

Plans:
- [ ] 11-01: TBD

### Phase 12: Bridge + Data Persistence
**Goal**: The web runtime persists its database across sessions — data survives app restarts, background transitions, and WebContent process terminations
**Depends on**: Phase 11
**Requirements**: BRDG-01, BRDG-02, BRDG-03, BRDG-04, BRDG-05, DATA-01, DATA-02, DATA-03, DATA-04, DATA-05, SHELL-05
**Success Criteria** (what must be TRUE):
  1. User creates a card, backgrounds the app, and relaunches — the card is still present (database persisted and rehydrated)
  2. User backgrounds the app on iOS and the database is saved within the background execution window without data loss
  3. Autosave timer writes a checkpoint every 30 seconds while the app is active, with no user-visible jank
  4. After a simulated WebContent process crash (memory pressure), the app reloads and restores from the last saved checkpoint
  5. Swift and JavaScript can exchange all 5 bridge message types without retain cycles or memory leaks
**Plans**: TBD

Plans:
- [ ] 12-01: TBD

### Phase 13: Native Chrome + File Import
**Goal**: The app feels native — it has a proper SwiftUI shell with platform-appropriate navigation and menus, and users can import files via the native file picker feeding the existing ETL pipeline
**Depends on**: Phase 12
**Requirements**: CHRM-01, CHRM-02, CHRM-03, CHRM-04, CHRM-05, FILE-01, FILE-02, FILE-03, FILE-04
**Success Criteria** (what must be TRUE):
  1. On iPad and macOS, a NavigationSplitView sidebar shows view-switching controls; on iPhone, a stack navigation pattern is used
  2. User can pick a .json, .md, .csv, or .xlsx file from the Files app (iOS) or NSOpenPanel (macOS) and see the existing ImportToast progress UI
  3. macOS File menu shows an Import item and Edit menu shows Undo/Redo with standard keyboard shortcuts (Cmd+Z, Cmd+Shift+Z)
  4. Web content renders below the notch and Dynamic Island because safe area insets are delivered via LaunchPayload
  5. Files larger than 50MB trigger a user-visible warning and are rejected before being passed to the ETL pipeline
**Plans**: TBD

Plans:
- [ ] 13-01: TBD

### Phase 14: iCloud + StoreKit Tiers
**Goal**: The database file syncs automatically across devices via iCloud Documents, and the app enforces Free/Pro/Workbench feature tiers via StoreKit 2 subscriptions
**Depends on**: Phase 12
**Requirements**: TIER-01, TIER-02, TIER-03, TIER-04
**Success Criteria** (what must be TRUE):
  1. User with iCloud Drive enabled creates a card on iPhone, opens the app on iPad, and sees the card after iCloud sync completes
  2. User can subscribe to Pro or Workbench tier via a native StoreKit 2 purchase sheet
  3. After subscribing to Pro, views and ETL features gated to Pro become accessible without restarting the app
  4. FeatureGate.swift blocks native actions (file import, cloud save) when the user's tier does not include that feature
**Plans**: TBD

Plans:
- [ ] 14-01: TBD

## Progress

**Execution Order:**
Phases execute in order: 11 → 12 → 13 → 14 (Phase 14 depends on Phase 12, can overlap with Phase 13)

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Database Foundation | v0.1 | 4/4 | Complete | 2026-02-28 |
| 2. CRUD + Query Layer | v0.1 | 6/6 | Complete | 2026-02-28 |
| 3. Worker Bridge | v1.0 | 3/3 | Complete | 2026-03-01 |
| 4. Providers + MutationManager | v0.5 | 7/7 | Complete | 2026-02-28 |
| 5. Core D3 Views + Transitions | v0.5 | 4/4 | Complete | 2026-02-28 |
| 6. Time + Visual Views | v0.5 | 3/3 | Complete | 2026-02-28 |
| 7. Graph Views + SuperGrid | v1.0 | 4/4 | Complete | 2026-03-01 |
| 8. ETL Foundation + Apple Notes Parser | v1.1 | 5/5 | Complete | 2026-03-01 |
| 9. Remaining Parsers + Export Pipeline | v1.1 | 5/5 | Complete | 2026-03-02 |
| 10. Progress Reporting + Polish | v1.1 | 2/2 | Complete | 2026-03-02 |
| 11. Xcode Shell + WKURLSchemeHandler | v2.0 | 0/TBD | Not started | - |
| 12. Bridge + Data Persistence | v2.0 | 0/TBD | Not started | - |
| 13. Native Chrome + File Import | v2.0 | 0/TBD | Not started | - |
| 14. iCloud + StoreKit Tiers | v2.0 | 0/TBD | Not started | - |

---
*Roadmap created: 2026-02-27*
*v0.1 Data Foundation shipped: 2026-02-28*
*v0.5 Providers + Views shipped: 2026-02-28*
*v1.0 Web Runtime shipped: 2026-03-01*
*v1.1 ETL Importers shipped: 2026-03-02*
*v2.0 Native Shell roadmap added: 2026-03-02*
