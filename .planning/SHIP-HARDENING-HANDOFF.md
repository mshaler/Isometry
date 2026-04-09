# Phase 121 — Ship Hardening (Revised)

**Handoff Date:** 2026-03-24 (revised 2026-03-25)
**Depends On:** Phase 120 complete (BUGF-01/02, SHIP-01..04, GALG-01..04 all green)
**Goal:** Close the remaining gaps between current state and a shippable TestFlight MVP
**Milestone:** v9.1 → TestFlight External Beta

---

## Context

Phase 120 addressed the two acute monetization bugs (FeatureGate bypass, SubscriptionManager unknown-ID fallback) and the four hard infrastructure blockers (provisioning, CloudKit entitlement, StoreKit products, graph algorithm phase 2). Phase 121 closes the remaining reliability, discoverability, and compliance gaps that would otherwise produce silent crashes, App Store rejection, or low-quality beta feedback.

The TypeScript/Swift test asymmetry (1.31:1 vs 0.10:1) identified in the MVP gap analysis is the overarching theme: the web layer is well-hardened; the native layer is not. Most work areas below address that asymmetry directly or its downstream effects.

### Revision Notes (2026-03-25)

Original handoff reviewed against actual codebase. Key corrections:
- **WA-02 rewritten:** SyncMerger conflict scenarios removed — SyncMerger is a TypeScript `INSERT OR REPLACE` function in `NativeBridge.ts`, not a Swift conflict-resolution class. The project's shipping strategy is last-writer-wins (D-010); no conflict UI exists or is planned. Test scope refocused on CKSyncEngine event handler routing and state persistence.
- **WA-03 corrected:** macOS target is 14+, not 13+.
- **WA-04 simplified:** "Reset Sync" reduced from confirmation sheet to simple alert wrapping existing `clearSyncState()`.
- **WA-05 corrected:** MetricKit wired into existing platform delegates (`IsometryAppDelegate` on macOS, `AppDelegateIOS` on iOS), not a new delegate class.
- **WA-06 descoped:** 3-screen walkthrough replaced with single welcome sheet for beta. Full interactive walkthrough deferred to 1.0. Skip available on all screens.
- **WA-08 added:** Native CLAUDE.md reconciliation — the file still describes the pre-v4.1 checkpoint-only sync model and explicitly says "do not add CKRecord." CKSyncEngine shipped in v4.1. Any future Claude session reading this file will get wrong architectural context.

---

## Pre-Conditions (Verify Before Starting)

- [ ] Phase 120 all work items passing CI
- [ ] FeatureGate returns correct tier values in a Release scheme build (manual smoke test)
- [ ] SubscriptionManager returns `.free` for an unrecognized product ID (unit test assertion exists)
- [ ] CloudKit container entitlement active: `iCloud.works.isometry.Isometry`
- [ ] Real StoreKit product IDs registered in App Store Connect

---

## Work Areas

Work areas are ordered by risk. Complete WA-01 through WA-03 before TestFlight submission. WA-04 through WA-08 are quality gates for useful beta feedback and future session accuracy.

---

### WA-01 — Privacy Manifest (`PrivacyInfo.xcprivacy`)

**Risk:** Hard App Store rejection
**Effort:** ~30 minutes
**Must complete before:** TestFlight external distribution

App Store Connect rejects builds without a Privacy Manifest since iOS 17. The app uses at minimum:

| API | Required Reason Code |
|-----|---------------------|
| `UserDefaults` | `CA92.1` |
| `FileManager` / file timestamp APIs | `C617.1` or `0A2A.1` |
| `Date` / `NSDate` | `35F9.1` |

**Implementation:**

1. Add `PrivacyInfo.xcprivacy` to the main app target (not a framework — the top-level app target)
2. Declare each required reason API with the appropriate reason code
3. Set `NSPrivacyTracking` to `NO` (Isometry does not track users)
4. Set `NSPrivacyCollectedDataTypes` to an empty array (no data collected or transmitted to Isometry servers — local-first architecture)

Audit third-party SDKs (SwiftProtobuf, graphology Worker-side only — no native SDK privacy manifests expected, but verify).

**Success criteria:**
- [ ] `PrivacyInfo.xcprivacy` present in app target
- [ ] All required reason APIs declared
- [ ] Xcode build produces no "Missing Privacy Manifest" warnings
- [ ] Archive + validate in App Store Connect with no privacy-related rejections

---

### WA-02 — Swift Test Pass: CKSyncEngine Event Handler Routing

**Risk:** Data corruption for beta testers on sync edge cases
**Effort:** ~1.5 days
**Must complete before:** TestFlight external distribution

Current Swift test ratio is 0.10:1. The existing 15 SyncManager tests cover state persistence and offline queue round-trips. The gap is CKSyncEngine **event handler routing** — the `handleEvent()`, `handleAccountChange()`, `handleFetchedDatabaseChanges()`, and `handleSentRecordZoneChanges()` methods that determine what happens when CloudKit reports errors or state changes.

**Architecture constraint:** `SyncManager.initialize()` creates a real `CKSyncEngine` requiring CloudKit entitlements — cannot be called in unit tests. Tests must exercise logic via:
1. State-based assertions on file system side effects (queue files, state files, system fields)
2. Extracted handler logic testable without a live CKSyncEngine
3. Observable side effects (statusPublisher state changes, clearSyncState file deletion)

**CKSyncEngine event handler paths to cover:**

| Handler | Scenario | Expected Side Effect |
|---------|----------|---------------------|
| `handleAccountChange` | `.signOut` | `clearSyncState()` removes all 3 persistence files, empties in-memory state |
| `handleAccountChange` | `.switchAccounts` | Same as signOut — full state clear |
| `handleAccountChange` | `.signIn` | No state change (zone auto-created on first send) |
| `handleFetchedDatabaseChanges` | zone `.purged` | `clearSyncState()` called |
| `handleFetchedDatabaseChanges` | zone `.encryptedDataReset` | `needsFullReupload` set to `true`; `consumeReuploadFlag()` returns true then false |
| `handleFetchedDatabaseChanges` | zone `.deleted` | `clearSyncState()` called |
| `handleSentRecordZoneChanges` | `.serverRecordChanged` conflict | Pending change removed from queue (conflict resolved via server-wins) |
| `handleSentRecordZoneChanges` | non-conflict error | `statusPublisher.status` set to `.error(message)` |

**SyncMerger note:** SyncMerger is a TypeScript function (`handleNativeSync()` in `NativeBridge.ts`) that builds `INSERT OR REPLACE` SQL. It implements last-writer-wins via SQL overwrite per D-010. There is no Swift conflict detection class. Do not test SyncMerger from Swift — it's covered by the ETL E2E test infrastructure (v8.5).

**Notes:**
- Use Swift Testing `@Test` macros (project already uses them — see `SyncManagerTests.swift`)
- `clearSyncState()` is private — test via file system assertions (files deleted after handler runs)
- `statusPublisher` is `nonisolated(unsafe)` — test state changes via MainActor hop

**Success criteria:**
- [ ] All 8 event handler scenarios have explicit test coverage
- [ ] `clearSyncState()` file deletion verified for signOut/switchAccounts/purged/deleted
- [ ] `encryptedDataReset` → `consumeReuploadFlag()` round-trip verified
- [ ] `statusPublisher` error state verified for non-conflict send failures
- [ ] Swift test ratio improves from 0.10:1 to ≥ 0.20:1
- [ ] No existing passing tests regressed

---

### WA-03 — First Native Device Validation Pass

**Risk:** Unknown integration failures on real hardware
**Effort:** ~half day (test execution, not code)
**Must complete before:** TestFlight external distribution

All prior testing has been browser-based or simulator-based. This is the first full critical-path exercise on physical hardware.

**Devices needed:** At minimum one iPhone (iOS 17+) and one Mac (macOS 14+). iPad is a stretch goal.

**Critical path to walk:**

1. **Fresh install** — no prior app data on device
2. **ETL → SuperGrid** — import at least one of the 9 tested ETL sources; verify SuperGrid renders correctly with real data
3. **LATCH axis switching** — switch grouping axis at least twice; verify no layout artifacts
4. **CloudKit sync** — make a change on device A, verify it appears on device B within 60 seconds
5. **Offline queue** — put device in airplane mode, make 3 edits, re-enable network, verify all 3 sync
6. **Graph view** — open network view with at least 20 nodes; verify force simulation runs at acceptable frame rate
7. **Tier gating** — in Release build, verify a Pro-gated feature shows paywall, not crash or silent no-op

**Document findings as a test log** — even passing results. This becomes the baseline for regression on subsequent TestFlight builds.

**Success criteria:**
- [ ] Critical path completed on physical iPhone in Release configuration
- [ ] No crashes on critical path
- [ ] CloudKit sync end-to-end verified on two devices
- [ ] Test log committed to `.planning/device-tests/` or equivalent

---

### WA-04 — Sync Error Recovery UX

**Risk:** Beta testers conclude app is broken when sync fails silently
**Effort:** Low-Medium (~half day)

Current state: last-writer-wins conflict resolution, `SyncStatusPublisher` toolbar icon (idle/syncing/error), offline queue. Gap: no user-facing recovery path when sync stops working.

**Required additions:**

1. **Sync error banner** — persistent, dismissible banner when `SyncStatusPublisher.status == .error`. Human-readable message (not raw CKError). Appears in ContentView overlay, visible in all views.
2. **"Retry Sync" action** — available from the error banner and from SettingsView. Calls `bridgeManager.syncManager?.fetchChanges()`.
3. **"Re-sync All Data" in Settings** — wire existing `clearSyncState()` (SyncManager line 632) to a Settings button with a simple `.alert` confirmation. No custom confirmation sheet needed. Copy: "This will re-upload all your data to iCloud. Your local data will not be deleted."

**Error message copy:**

| CKError | User-facing message |
|---------|---------------------|
| `.networkUnavailable` | "Sync paused — no internet connection. Your changes are saved locally." |
| `.quotaExceeded` | "iCloud storage is full. Free up space in Settings → iCloud to resume sync." |
| `.notAuthenticated` | "Sign in to iCloud in Settings to enable sync." |
| `.userDeletedZone` | "Sync data was reset in iCloud. Re-syncing now..." (auto-recover) |
| generic | "Sync encountered an error. Tap to retry." |

**Implementation note:** `SyncStatusPublisher` already publishes `.error(String)` with `localizedDescription`. Map raw error strings to the copy table above via a `syncErrorMessage(for:)` helper. The `.userDeletedZone` case is already auto-recovered in `handleFetchedDatabaseChanges` — banner should show informational message, not an action.

**Success criteria:**
- [ ] Sync error banner visible in ContentView when sync fails
- [ ] "Retry Sync" action triggers `fetchChanges()` and clears banner on success
- [ ] "Re-sync All Data" option in SettingsView with alert confirmation
- [ ] No raw error codes or stack traces visible to user

---

### WA-05 — MetricKit Crash Reporting

**Risk:** First-wave crashes are invisible to developer
**Effort:** Low (~2 hours)
**Zero external dependencies** — Apple framework (iOS 14+ / macOS 12+)

`checkForSilentCrash()` handles one specific scenario (WebKit bug #176855). It doesn't provide symbolicated crash reports, hang diagnostics, or performance metrics from real devices.

**Implementation:**

Wire `MXMetricManagerSubscriber` into the **existing** platform delegates:

- **macOS:** `IsometryAppDelegate` (already exists in `IsometryApp.swift` line 170) — add `MXMetricManagerSubscriber` conformance, call `MXMetricManager.shared.add(self)` in `applicationDidFinishLaunching`.
- **iOS:** `AppDelegateIOS` (already exists in `IsometryApp.swift` line 198) — add `MXMetricManagerSubscriber` conformance, call `MXMetricManager.shared.add(self)` in `application(_:didFinishLaunchingWithOptions:)`.

Both delegates implement:
- `didReceive(_ payloads: [MXDiagnosticPayload])` — write crash + hang diagnostics to local JSON log
- `didReceive(_ payloads: [MXMetricPayload])` — write launch time, memory, disk write metrics

For beta, write to `Application Support/Isometry/diagnostics/` as timestamped JSON files. Not in Documents (users shouldn't see raw diagnostics). Share via a "Export Diagnostics" button in SettingsView that copies the directory contents to a shareable `.zip`.

**Success criteria:**
- [ ] `MXMetricManagerSubscriber` registered on both macOS and iOS app launch
- [ ] Crash and hang diagnostics written to local JSON log
- [ ] Performance metrics (launch time, memory) captured
- [ ] "Export Diagnostics" in SettingsView produces shareable archive

---

### WA-06 — First-Run Welcome Sheet

**Risk:** Low-quality beta feedback ("what is this?")
**Effort:** Low (~half day)

For beta, a single welcome sheet is sufficient. Beta testers are self-selected — they'll explore. Save a full interactive walkthrough for 1.0.

**Single welcome sheet:**

- **Headline:** "Your data, every way at once"
- **Body:** One paragraph. LATCH in plain English: "Isometry organizes your notes, tasks, and events by Location, Alphabet, Time, Category, and Hierarchy — then shows the connections between them as a graph. Import your data and switch between 9 views to see different projections of the same information."
- **Primary CTA:** "Load Sample Data" (triggers existing `SampleDataManager` from v4.4)
- **Secondary CTA:** "Import Your Data" (navigates to Data Explorer import panel)
- **Tertiary:** "Skip" link (always visible, dismisses sheet)
- **Gate:** `UserDefaults` key `hasSeenWelcome` — show only on first launch
- **Accessible:** VoiceOver labels on all elements, Escape key dismisses

**Implementation:** SwiftUI `.sheet` on ContentView, gated on `!hasSeenWelcome`. The sample data CTA calls the existing `native:action` bridge message with `kind: "loadSampleData"` (or equivalent existing handler). No new bridge messages needed.

**Success criteria:**
- [ ] Welcome sheet shown on first launch only
- [ ] "Load Sample Data" triggers SampleDataManager
- [ ] "Skip" always available, dismisses sheet
- [ ] `hasSeenWelcome` persisted after dismissal
- [ ] VoiceOver navigable

---

### WA-07 — App Store Connect Metadata

**Risk:** Cannot distribute TestFlight externally without minimum metadata
**Effort:** Low (content, not code)

**Required for TestFlight external testing:**
- App name, subtitle, description (preview copy is fine — not final)
- At least one screenshot per supported device size (iPhone 6.9" required; iPad optional for beta)
- Age rating questionnaire completed
- Category selected (Productivity)
- Content rights declaration

**Suggested beta description copy:**

> Isometry is a personal knowledge tool that lets you see your data every way at once — as a grid, a timeline, a graph, or a kanban board — without changing the underlying data. Built for Mac and iPhone, local-first, synced via iCloud.
>
> This is a TestFlight beta. Data may not persist between beta builds. Please report bugs via [contact method].

**Screenshots:** Use simulator screenshots from the existing CI pipeline if device screenshots aren't available. The goal is clearing the metadata gate, not polishing marketing copy.

**Success criteria:**
- [ ] App Store Connect app record complete enough to submit TestFlight build
- [ ] At least one screenshot uploaded per required device size
- [ ] Age rating and category set
- [ ] External TestFlight group created with at least one test email

---

### WA-08 — Native CLAUDE.md Reconciliation

**Risk:** Future Claude sessions get wrong architectural context, produce conflicting code
**Effort:** Low (~30 minutes)

The native `CLAUDE.md` (`native/Isometry/CLAUDE.md`) was written for v2.0 and has not been updated since. Critical inaccuracies:

| Section | Says | Reality (v9.0) |
|---------|------|----------------|
| iCloud Sync Model | "whole-database checkpoint sync via iCloud ubiquity container" | CKSyncEngine record-level sync shipped in v4.1 |
| iCloud Sync Model | "There is no CKRecord, CKModifyRecordsOperation, or CKServerChangeToken" | CKSyncEngine uses CKRecord extensively (SyncTypes.swift, SyncManager.swift) |
| What NOT To Do | "Don't implement record-level CloudKit sync" | Already implemented and shipping |
| What NOT To Do | "Don't add Swift data models that mirror JS types" | PendingChange, CodableValue, BatchSnapshot exist |
| File Map | Lists 10 files | Missing SyncManager.swift, SyncTypes.swift, SyncStatusView.swift, ProtobufToMarkdown.swift, AltoIndexAdapter.swift, and 5 other files added since v2.0 |
| Bridge Protocol | "6 message types" | `native:sync` added in v4.1, `export-all-cards` added for sync recovery |
| Database storage | "ubiquity container root" | Migrated to Application Support in v4.1 |

**Implementation:** Update the existing file to reflect v9.0 reality. Do not rewrite from scratch — preserve the document's useful structure and philosophy, correct the factual errors, update the file map, and add the sync architecture section.

**Success criteria:**
- [ ] No statements claiming CKRecord/CloudKit sync doesn't exist
- [ ] File map includes all current Swift source files
- [ ] Bridge protocol section reflects all message types including `native:sync`
- [ ] iCloud sync section describes CKSyncEngine architecture
- [ ] Database storage location corrected to Application Support

---

## Out of Scope (This Phase)

| Item | Rationale |
|------|-----------|
| v1.0 App Store polish (final screenshots, marketing copy) | Post-beta |
| Swift test ratio to 0.5:1 | Target for v1.0, not TestFlight gate |
| Remote crash reporting endpoint | MetricKit local logs sufficient for beta |
| iPad-specific layout validation | Stretch goal; iPhone + Mac are the primary targets |
| Full interactive onboarding walkthrough | Deferred to 1.0; welcome sheet sufficient for beta |
| SyncMerger conflict detection UI | Out of scope per D-010 (last-writer-wins is shipping strategy) |
| Semantic similarity / sqlite-vec | Future roadmap item |

---

## Regression Guards

Before marking Phase 121 complete, verify these existing behaviors are unaffected:

- [ ] `__agg__` prefix convention on aggregate aliases in calc query pipeline (production bug fix — do not regress)
- [ ] FTS5/BM25 search returns results with correct ranking (command palette + SuperSearch)
- [ ] All 27 plugins pass lifecycle coverage CI gate
- [ ] Virtual scrolling maintains 60fps at 10K+ cards (CI bench job)
- [ ] Theme switching (all 5 themes) works without reload
- [ ] WCAG 2.1 AA contrast tokens unaffected by any new UI added in WA-04 and WA-06

---

## Success Criteria (Phase Gate)

Phase 121 is complete when:

1. `PrivacyInfo.xcprivacy` present; Xcode build produces no privacy warnings
2. CKSyncEngine event handler routing tested for all 8 scenarios in WA-02
3. Native device validation pass completed and logged
4. Sync error banner + retry + re-sync implemented
5. MetricKit subscriber registered on both platforms, writing local diagnostic logs
6. Welcome sheet ships on first launch and is VoiceOver navigable
7. App Store Connect metadata sufficient for TestFlight external group
8. Native CLAUDE.md reflects v9.0 architecture accurately
9. All regression guards above pass

---

*Original handoff authored by Claude (advisor) based on MVP Gap Analysis dated 2026-03-24.*
*Revised 2026-03-25 after codebase review corrected SyncMerger scope, platform targets, delegate wiring, and onboarding scope.*
