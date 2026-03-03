---
phase: 14-icloud-storekit-tiers
plan: 01
subsystem: database
tags: [swift, icloud, icloud-documents, nsfIlecoordinator, ubiquity-container, xcode-entitlements]

# Dependency graph
requires:
  - phase: 12-native-data-layer
    provides: DatabaseManager actor with saveCheckpoint and two-init pattern
provides:
  - iCloud Documents path resolution for DatabaseManager via async factory
  - Auto-migration from local Application Support to iCloud ubiquity container
  - NSFileCoordinator-wrapped checkpoint writes for iCloud safety
  - Isometry.entitlements with CloudDocuments + ubiquity-container-identifiers
  - Async ContentView wiring that never blocks main thread for iCloud resolution
affects:
  - 14-02-storekit (SubscriptionManager feeds tier into BridgeManager alongside DatabaseManager)
  - 14-03-feature-gate (feature gating operates on DatabaseManager initialized by this plan)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "iCloud Documents ubiquity container via FileManager.url(forUbiquityContainerIdentifier:nil)"
    - "Task.detached(priority: .userInitiated) for blocking API calls off main thread"
    - "NSFileCoordinator.coordinate(writingItemAt:.forReplacing) wrapping entire atomic rotation sequence"
    - "useCoordinator flag pattern: detect iCloud path by 'Mobile Documents'/'CloudDocs' in path string"
    - "Auto-migration: copy-without-delete (safety net) via NSFileCoordinator"

key-files:
  created:
    - native/Isometry/Isometry/Isometry.entitlements
  modified:
    - native/Isometry/Isometry/DatabaseManager.swift
    - native/Isometry/Isometry/ContentView.swift
    - native/Isometry/Isometry.xcodeproj/project.pbxproj

key-decisions:
  - "Database file stored in ubiquity container ROOT (not Documents/) — hidden from iOS Files app per plan spec"
  - "useCoordinator flag detected from path string (Mobile Documents/CloudDocs) rather than separate property — no extra storage"
  - "Auto-migration copies without deleting local file — safety net if iCloud unexpectedly unavailable on next launch"
  - "Entire .tmp/.bak/.db rotation runs inside single NSFileCoordinator block — prevents sync daemon observing partial state (Pitfall 8)"
  - "WebView load is NOT blocked by iCloud resolution — async Task fires after webView.load() call"

patterns-established:
  - "Pattern: background-thread iCloud resolution via Task.detached — never call url(forUbiquityContainerIdentifier:) from main thread"
  - "Pattern: NSFileCoordinator block wraps all intermediate atomic write steps, not just the final write"
  - "Pattern: CODE_SIGN_ENTITLEMENTS set in target build config (Debug+Release) for entitlements to take effect"

requirements-completed: [TIER-01]

# Metrics
duration: 4min
completed: 2026-03-03
---

# Phase 14 Plan 01: iCloud Documents for DatabaseManager Summary

**iCloud Documents path resolution via async factory with NSFileCoordinator checkpoint writes and auto-migration from local Application Support to ubiquity container**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-03T21:37:38Z
- **Completed:** 2026-03-03T21:41:29Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- DatabaseManager gains async `makeForProduction()` factory that resolves iCloud ubiquity container on a background thread, silently falling back to Application Support when iCloud is unavailable
- NSFileCoordinator wraps the entire .tmp/.bak/.db atomic rotation in `saveCheckpointCoordinated()` — sync daemon can never observe a partial write
- Auto-migration copies existing local database to iCloud container on first iCloud-enabled launch (without deleting local copy as safety net)
- Isometry.entitlements created with `CloudDocuments` service + `iCloud.works.isometry.Isometry` container identifier; `CODE_SIGN_ENTITLEMENTS` added to both Debug and Release target configurations
- ContentView.setupWebView() updated to use async Task with `DatabaseManager.makeForProduction()` — WebView load is never blocked by iCloud resolution

## Task Commits

Each task was committed atomically:

1. **Task 1: Create entitlements file and add async factory to DatabaseManager with iCloud path resolution** - `06ab0cf5` (feat — included in prior plan-02 agent execution which correctly ran plan-01 as dependency)
2. **Task 2: Wire async DatabaseManager factory into ContentView and update Xcode project** - `79e36ea2` (feat)

## Files Created/Modified
- `native/Isometry/Isometry/Isometry.entitlements` - iCloud Documents entitlement with ubiquity container identifier `iCloud.works.isometry.Isometry`
- `native/Isometry/Isometry/DatabaseManager.swift` - Async factory, resolveStorageDirectory(), autoMigrateIfNeeded(), saveCheckpointCoordinated(), useCoordinator flag
- `native/Isometry/Isometry/ContentView.swift` - setupWebView() uses async Task with DatabaseManager.makeForProduction()
- `native/Isometry/Isometry.xcodeproj/project.pbxproj` - CODE_SIGN_ENTITLEMENTS set for Isometry target Debug + Release

## Decisions Made

- **Database hidden from Files app**: File stored in ubiquity container root (`/Isometry/`), NOT in `Documents/Isometry/`. The plan explicitly specifies this; no `NSUbiquitousContainers` in Info.plist needed.
- **useCoordinator flag via path inspection**: Detects iCloud path by checking for "Mobile Documents" or "CloudDocs" in the path string — straightforward and no additional property storage needed.
- **Auto-migration safety net**: Local database is NOT deleted after migration. If iCloud later becomes unavailable (sign-out, disable), the app falls back to local and the file is still there.
- **Single NSFileCoordinator block for full rotation**: Per Pitfall 8, all .tmp write + .db->.bak rotate + .tmp->.db rename run inside one `coordinate(writingItemAt:)` block — sync daemon sees an atomic transition.

## Deviations from Plan

None — plan executed exactly as written. Task 1 work was already committed by a prior execution of plan-02 (which correctly included plan-01 as a dependency). Task 2 (ContentView async wiring) was the remaining piece.

## Issues Encountered

- **Provisioning profile mismatch on signed build**: `xcodebuild -scheme Isometry -destination 'platform=macOS'` fails at code-signing step because the Mac Team Provisioning Profile does not yet include the `com.apple.developer.ubiquity-container-identifiers` entitlement. This is expected — the provisioning profile must be regenerated in Apple Developer Portal after enabling iCloud Documents capability. Build succeeds with `CODE_SIGNING_ALLOWED=NO` flag, confirming Swift code is correct.

## User Setup Required

**External capability requires manual configuration in Apple Developer Portal:**
1. Log into developer.apple.com → Certificates, IDs & Profiles
2. Select the Isometry App ID (`works.isometry.Isometry`)
3. Enable "iCloud" capability and add container `iCloud.works.isometry.Isometry`
4. Regenerate and download the provisioning profile
5. In Xcode: Signing & Capabilities tab → iCloud → check "iCloud Documents" and add container `iCloud.works.isometry.Isometry`

After this, `xcodebuild -scheme Isometry -destination 'platform=macOS' build` should succeed without code-signing override.

## Next Phase Readiness

- iCloud Documents foundation is complete; DatabaseManager correctly resolves storage path at launch
- Plan 14-02 (SubscriptionManager) already committed — tier management ready for Plan 14-03 wiring
- Plan 14-03 (FeatureGate + tier wiring into LaunchPayload) can proceed immediately

---
*Phase: 14-icloud-storekit-tiers*
*Completed: 2026-03-03*
