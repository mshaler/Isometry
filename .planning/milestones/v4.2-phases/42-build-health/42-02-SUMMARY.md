---
phase: 42-build-health
plan: 02
subsystem: infra
tags: [xcode, pbxproj, run-script, provisioning-profile, cloudkit, native-build]

# Dependency graph
requires:
  - phase: 11-xcode-shell
    provides: "Xcode project structure with WKWebView Run Script build phase"
provides:
  - "Fixed Xcode Run Script inputPaths referencing correct repo root package.json"
  - "Provisioning profile with CloudKit + iCloud Documents entitlements"
affects: [47-etl-validation]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "$(SRCROOT)/../../package.json for 2-level-deep Xcode projects"

key-files:
  created: []
  modified:
    - "native/Isometry/Isometry.xcodeproj/project.pbxproj"

key-decisions:
  - "inputPaths uses $(SRCROOT)/../../package.json because SRCROOT is native/Isometry (2 levels deep from repo root)"
  - "Provisioning profile regenerated via Xcode automatic signing (not manual Apple Developer Console)"

patterns-established:
  - "Xcode SRCROOT depth: native/Isometry is 2 levels from repo root, always use ../../ for repo-root references"

requirements-completed: [BUILD-03, BUILD-04]

# Metrics
duration: 21min
completed: 2026-03-07
---

# Phase 42 Plan 02: Xcode Build Fix + Provisioning Profile Summary

**Fixed Xcode Run Script inputPaths from ../package.json to ../../package.json and regenerated provisioning profile with CloudKit + iCloud entitlements via automatic signing**

## Performance

- **Duration:** 21 min
- **Started:** 2026-03-07T18:47:57Z
- **Completed:** 2026-03-07T19:09:00Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- Fixed Xcode Run Script build phase inputPaths to correctly reference repo root package.json ($(SRCROOT)/../../package.json instead of $(SRCROOT)/../package.json)
- Verified `make check` passes with BUILD SUCCEEDED and zero project warnings
- Provisioning profile regenerated via Xcode automatic signing with CloudKit, iCloud Documents, and Key-value storage entitlements confirmed across all 3 platforms (iOS, macOS, visionOS)

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix Xcode Run Script input path and verify build** - `4baa8139` (fix)
2. **Task 2: Regenerate provisioning profile (BUILD-04)** - manual human action (Xcode automatic signing, verified via screenshot)

## Files Created/Modified
- `native/Isometry/Isometry.xcodeproj/project.pbxproj` - Changed inputPaths from `$(SRCROOT)/../package.json` to `$(SRCROOT)/../../package.json`

## Decisions Made
- Used `$(SRCROOT)/../../package.json` because `$SRCROOT` resolves to `native/Isometry` (2 levels deep from repo root). Going up 1 level only reaches `native/`, which has no package.json.
- Provisioning profile regenerated via Xcode "Automatically manage signing" rather than manual Apple Developer Console workflow -- all 3 platforms show Xcode Managed Profiles.

## Deviations from Plan

None - plan executed exactly as written.

## Authentication Gates

**Task 2: Provisioning profile regeneration (BUILD-04)**
- **Type:** checkpoint:human-action
- **What was needed:** Apple Developer Console / Xcode signing access to regenerate provisioning profile
- **Outcome:** User confirmed automatic signing in Xcode regenerated profiles for all 3 platforms with CloudKit + iCloud Documents + Key-value storage entitlements. Build succeeded.

## Issues Encountered
None

## User Setup Required
None - provisioning profile regeneration completed during checkpoint.

## Next Phase Readiness
- BUILD-03 and BUILD-04 complete -- native Xcode build is clean with correct signing
- Phase 42 Plan 03 (GitHub Actions CI) is the final plan in this phase
- All prerequisite build infrastructure (TypeScript, Biome, native build) now verified working

## Self-Check: PASSED

- FOUND: 42-02-SUMMARY.md
- FOUND: project.pbxproj
- FOUND: commit 4baa8139

---
*Phase: 42-build-health*
*Completed: 2026-03-07*
