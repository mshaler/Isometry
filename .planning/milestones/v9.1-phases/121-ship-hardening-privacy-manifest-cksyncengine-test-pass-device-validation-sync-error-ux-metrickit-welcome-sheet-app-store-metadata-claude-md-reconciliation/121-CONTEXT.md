# Phase 121: Ship Hardening - Context

**Gathered:** 2026-03-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Close remaining gaps between current state and shippable TestFlight MVP — privacy compliance, native test coverage (CKSyncEngine + all adapters), crash/hang reporting, sync error UX, first-run welcome experience, App Store Connect metadata, and documentation accuracy. No new features — hardening, compliance, and polish for the existing codebase.

</domain>

<decisions>
## Implementation Decisions

### Sync Error UX (SUXR-01..03)
- Persistent banner at top of content area (consistent with existing ErrorBanner pattern) — stays until resolved or dismissed
- Human-friendly error message plus small "Details" disclosure showing CKError domain/code for power users and bug reports
- Auto-retry with exponential backoff (5s, 15s, 60s, 5min) with banner showing countdown to next retry; manual "Retry" button as fallback
- "Re-sync All Data" lives in Settings only (Cloud Sync section) — destructive-ish action should not be too easily triggered
- Re-sync requires confirmation alert ("This will re-download all data from iCloud. Continue?")

### Welcome Sheet (WLCM-01)
- Single-page welcome sheet — app icon/name, one-liner tagline, "Load Sample Data" primary button + "Start Empty" secondary
- No carousel or multi-page onboarding — keep it fast and non-fatiguing
- After "Load Sample Data": sheet dismisses, SampleDataManager loads data in background, user lands on SuperGrid with data visible
- First-launch detection via UserDefaults `hasSeenWelcome` boolean flag; reset available in Settings for testing
- Standard SwiftUI accessibility — automatic VoiceOver labels on buttons/text, accessibilityLabel on app icon image, standard focus order

### MetricKit Reporting (MKIT-01..02)
- New "Diagnostics" section in SettingsView showing last crash/hang count
- "Export Diagnostics" button saves raw MXDiagnosticPayload JSON via share sheet or to Files
- Scope limited to MXCrashDiagnostic + MXHangDiagnostic only (crashes and hangs) — performance metrics deferred
- MetricKit subscriber on both iOS and macOS targets
- Diagnostics stored locally between export opportunities

### CKSyncEngine Test Pass (SYNC-T01..T08)
- Protocol mock strategy: extract CKSyncEngine delegate handling into testable protocol, mock engine events, verify SyncManager state transitions and bridge calls — no real CloudKit needed
- 8 sync event scenarios: signIn, signOut, switchAccounts, purged, encryptedDataReset, deleted, serverRecordChanged, non-conflict error
- Test scope extends beyond sync events to include all native adapters (Notes, Reminders, Calendar) to hit Swift test ratio >= 0.20:1
- Adapter mock boundary: mock NoteStore.sqlite responses for Notes adapter, mock EventKit for Reminders/Calendar adapters — verify adapter transform logic without real system data

### Privacy Manifest (PRIV-01)
- Create PrivacyInfo.xcprivacy with all required reason APIs
- Xcode build must produce zero privacy warnings

### Device Validation (DVAL-01)
- Critical path validated on physical iPhone (Release config)
- CloudKit sync verified on two devices
- Test log committed to repo

### App Store Connect Metadata (ASCI-01)
- Metadata sufficient for TestFlight external group submission

### CLAUDE.md Reconciliation (DOCS-01)
- native/Isometry/CLAUDE.md updated from stale v2.0 to reflect v9.0 CKSyncEngine architecture, current bridge protocol, and all post-v2.0 additions

### Claude's Discretion
- Exact sync error banner layout/styling (follow existing ErrorBanner pattern)
- CKError-to-human-message mapping table
- Exponential backoff implementation (Timer vs DispatchQueue)
- Welcome sheet tagline wording
- MetricKit subscriber architecture (class vs actor)
- Privacy manifest required reason API enumeration (derive from actual API usage)
- Test file organization within IsometryTests/
- App Store Connect metadata field content

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Native Shell Architecture
- `native/Isometry/CLAUDE.md` — Current native shell guide (stale v2.0 — DOCS-01 updates this)
- `native/Isometry/Isometry/SyncManager.swift` — CKSyncEngine actor, SyncStatusPublisher, delegate handling
- `native/Isometry/Isometry/SyncStatusView.swift` — Existing sync status toolbar UI
- `native/Isometry/Isometry/SyncTypes.swift` — Sync type definitions
- `native/Isometry/Isometry/SettingsView.swift` — Settings integration point for Re-sync + MetricKit export
- `native/Isometry/Isometry/BridgeManager.swift` — Bridge protocol, sync forwarding
- `native/Isometry/Isometry/ContentView.swift` — Entry point for welcome sheet presentation
- `native/Isometry/Isometry/IsometryApp.swift` — App lifecycle, SyncManager initialization

### Existing Tests
- `native/Isometry/IsometryTests/SyncManagerTests.swift` — Existing sync tests to extend
- `native/Isometry/IsometryTests/SyncTypesTests.swift` — Existing sync type tests
- `native/Isometry/IsometryTests/` — All existing test files (13 files)

### Native Adapters (test targets)
- `native/Isometry/Isometry/NotesAdapter.swift` — Apple Notes SQLite adapter
- `native/Isometry/Isometry/RemindersAdapter.swift` — EventKit Reminders adapter
- `native/Isometry/Isometry/CalendarAdapter.swift` — EventKit Calendar adapter
- `native/Isometry/Isometry/PermissionManager.swift` — TCC permission management
- `native/Isometry/Isometry/NativeImportCoordinator.swift` — Import orchestration

### Project Architecture
- `CLAUDE-v5.md` — Canonical JS runtime decisions (D-001..D-020)
- `.planning/codebase/CONVENTIONS.md` — Naming, formatting, linting rules
- `.planning/codebase/INTEGRATIONS.md` — StoreKit 2, CloudKit integration patterns

### Prior Phase Context
- `.planning/phases/120-ship-prep/120-CONTEXT.md` — Phase 120 decisions (FeatureGate flip, TestFlight workflow)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `SyncStatusPublisher`: Already models idle/syncing/error(String) states — extend for banner display
- `ErrorBanner` (TypeScript): Existing error banner pattern with 5-category classification — sync error banner should mirror this UX pattern in SwiftUI
- `SampleDataManager` (TypeScript): Existing sample data generation — welcome sheet's "Load Sample Data" calls through existing bridge
- `SettingsView.swift`: Existing settings UI — add Diagnostics section and Re-sync button
- `SyncManagerTests.swift`: 1 existing test file — extend with protocol mock for 8 scenarios

### Established Patterns
- Actor isolation: SyncManager is an actor, SyncStatusPublisher is @MainActor — maintain this boundary
- Bridge protocol: 6 message types — MetricKit and welcome sheet don't need new bridge messages (Swift-only)
- UserDefaults: Already used for app state — `hasSeenWelcome` follows established pattern
- os.Logger: Used throughout native shell for structured logging — MetricKit subscriber should use same pattern

### Integration Points
- `IsometryApp.swift`: MetricKit MXMetricManager.shared.add(subscriber) in app init
- `ContentView.swift`: Welcome sheet presented as `.sheet(isPresented:)` on first launch
- `SettingsView.swift`: New sections for Diagnostics and Re-sync All Data
- `SyncManager.swift`: Error banner state published through SyncStatusPublisher
- `SyncStatusView.swift`: Consumes SyncStatusPublisher — may need enhancement for banner display

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches within the decisions captured above.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 121-ship-hardening*
*Context gathered: 2026-03-25*
