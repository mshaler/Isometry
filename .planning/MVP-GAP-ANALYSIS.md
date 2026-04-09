# MVP Gap Analysis — Post-Phase 120 Walkthrough

**Date:** 2026-03-24
**Scope:** What's missing between current state (v9.0 shipped, v9.1 Phase 120 in progress) and a shippable TestFlight MVP
**Codebase:** ~51K TS src + ~84K TS tests + 6.3K CSS + 10.2K Swift LOC across 29 milestones and 119 shipped phases

---

## 🔴 Blockers (Must Fix Before TestFlight)

### 1. FeatureGate DEBUG Bypass

**Status:** Phase 120 SHIP-01 (in progress)
**Risk:** Critical

The `#if DEBUG return true` bypass in FeatureGate means the Free/Pro/Workbench tier system has **never been enforced** in a Release build. Every tier-gated feature needs manual walkthrough in Release configuration. Potential for UI dead-ends where a locked feature shows no paywall, or crashes on code paths never exercised without the bypass.

### 2. SubscriptionManager Returns `.pro` for Unknown Product IDs

**Status:** Phase 120 BUGF-01 (in progress)
**Risk:** Critical

Any garbage product ID gets pro access. Combined with the FeatureGate bypass, the entire monetization layer is untested in production-like conditions. Must return `.free` for unknown IDs.

### 3. Provisioning Profile + CloudKit Entitlement

**Status:** Phase 120 SHIP-02 (in progress), carried as debt since v2.0
**Risk:** Hard blocker

CKSyncEngine won't function on a real device without a valid CloudKit container entitlement. Manual Xcode + Apple Developer Portal task that cannot be deferred further.

### 4. StoreKit Products in App Store Connect

**Status:** Phase 120 SHIP-03 (in progress)
**Risk:** Hard blocker

The `.storekit` sandbox config works locally, but TestFlight requires real product IDs registered in App Store Connect. Without this, the paywall is non-functional for beta testers.

---

## 🟡 High Risk (Ship Without, But You'll Regret It)

### 5. Swift Test Gap — 0.10:1 Ratio

**Risk:** High

| Layer | Production LOC | Test LOC | Ratio |
|-------|---------------|----------|-------|
| TypeScript | ~51K | ~84K | 1.31:1 |
| Swift | ~10.2K | ~763 | 0.10:1 |

**Tested:** BridgeManager, DatabaseManager, AssetsSchemeHandler, SubscriptionManager, FeatureGate, CoreDataTimestampConverter, ProtobufToMarkdown Tier 1, SyncManager state persistence, NotesAdapter fixture DB.

**Untested:** CKSyncEngine actor error paths (token expiry, zone deletion, quota exceeded), SyncMerger conflict edge cases, native ETL adapter error recovery, PermissionManager TCC flow on real devices. A single CKSyncEngine edge case could corrupt data for every beta tester.

### 6. No Crash Reporting / Analytics

**Risk:** High

No MetricKit, Firebase Crashlytics, or Sentry integration anywhere in the codebase. The `checkForSilentCrash()` guard handles one scenario but doesn't provide symbolicated crash reports from real devices. First TestFlight testers will hit crashes that are invisible to the developer.

**Recommendation:** MetricKit is zero-dependency (Apple framework) and provides crash diagnostics, hang rate, disk writes, and launch time metrics with no third-party SDK.

### 7. No Privacy Manifest (PrivacyInfo.xcprivacy)

**Risk:** App Store rejection

Since iOS 17, App Store Connect requires a Privacy Manifest declaring required reason APIs. The app uses at minimum:
- `UserDefaults` (required reason: `CA92.1`)
- `FileManager` / file timestamp APIs (required reason: `C617.1` or `0A2A.1`)
- `Date` / `NSDate` (required reason: `35F9.1`)

App Store review will reject without this file. Takes ~30 minutes to create but is a hard gate.

---

## 🟠 Significant Gaps (Acceptable for Beta, Not for 1.0)

### 8. Onboarding Is Thin

**Current state:** Sample data (v4.4), empty states with CTAs, command palette.
**Gap:** No guided explanation of what LATCH/PAFV/SuperGrid *are* or how to use them.

This is a power-user tool, but TestFlight beta testers need enough context to evaluate it. A 3-screen walkthrough or interactive tooltip tour would dramatically improve feedback quality. Without it, testers will import data, see SuperGrid, and not understand what they're looking at.

### 9. CloudKit Sync Error Recovery UX

**Current state:** Last-writer-wins conflict resolution, SyncStatusPublisher toolbar icon, offline queue.
**Gap:** No user-facing recovery path for "sync stopped working."

When sync fails silently, a beta tester sees stale data and thinks the app is broken. Needs at minimum:
- Sync error banner with human-readable explanation
- Manual "retry sync" action
- "Reset sync" nuclear option for unrecoverable states

### 10. No App Store Metadata

**Gap:** No screenshots, App Store description, category selection, age rating, or content description.

Not a code issue, but a real blocker for TestFlight distribution beyond ad-hoc builds. App Store Connect requires minimum metadata even for TestFlight external testing.

---

## ✅ What's Ship-Ready

| Area | Status | Evidence |
|------|--------|----------|
| Performance | ✅ Profiled + budgeted | 20K-card scale, CI bench job, 6 covering indexes |
| Accessibility | ✅ WCAG 2.1 AA | Contrast tokens, keyboard nav, ARIA, VoiceOver |
| TypeScript tests | ✅ 1.31:1 ratio | Seam tests, E2E, plugin lifecycle, ETL round-trip |
| ETL pipeline | ✅ 9 sources E2E tested | Dedup verified, malformed input recovery |
| Graph algorithms | ✅ 6 algorithms + viz | Differentiator feature, Playwright E2E guard |
| Plugin architecture | ✅ 27/27 plugins | Lifecycle coverage, cross-plugin matrix, CI hard gate |
| Theme system | ✅ 5 themes | Light/dark/system/NeXTSTEP/Material 3, instant switch |
| Command palette | ✅ Fuzzy search + FTS5 | WAI-ARIA combobox, recent commands |
| Virtual scrolling | ✅ 60fps at 10K+ | Data windowing + CSS content-visibility |

---

## Recommended Action

### Phase 120 (In Progress)
Complete both waves as planned — bug fixes (BUGF-01/02, SHIP-01..04) and graph algorithm Phase 2 (GALG-01..04).

### New Phase: Ship Hardening
Address items 5–10 in a dedicated phase:
1. Privacy manifest (PrivacyInfo.xcprivacy)
2. MetricKit crash reporting integration
3. Swift test pass on CKSyncEngine error paths + SyncMerger
4. Sync error recovery UX (error banner + retry + reset)
5. First-run onboarding walkthrough (3 screens)
6. App Store Connect metadata preparation

---

*Analysis based on full walkthrough of PROJECT.md, ROADMAP.md, STATE.md, MEMORY.md, and known technical debt inventory.*
