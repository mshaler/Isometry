---
phase: 14
name: icloud-storekit-tiers
status: human_needed
score: 10/10
verified: 2026-03-03
---

# Phase 14 Verification: iCloud + StoreKit Tiers

## Must-Have Verification

### TIER-01: iCloud Documents

| # | Check | Status | Evidence |
|---|-------|--------|----------|
| 1 | DatabaseManager resolves to iCloud ubiquity container when available | ✓ | `resolveStorageDirectory()` calls `url(forUbiquityContainerIdentifier: nil)` |
| 2 | Falls back to Application Support/Isometry/ when iCloud unavailable | ✓ | Fallback path in `resolveStorageDirectory()` |
| 3 | NSFileCoordinator wraps checkpoint writes in iCloud context | ✓ | `saveCheckpointCoordinated()` wraps full atomic rotation in coordination block |
| 4 | Auto-migration copies local DB to iCloud on first launch | ✓ | `autoMigrateIfNeeded(to:)` checks for local DB and copies to iCloud |
| 5 | Main thread not blocked by iCloud resolution | ✓ | `Task.detached(priority: .userInitiated)` in `makeForProduction()` |
| 6 | Entitlements file configured | ✓ | `Isometry.entitlements` has CloudDocuments + iCloud.works.isometry.Isometry |

### TIER-02: SubscriptionManager + FeatureGate

| # | Check | Status | Evidence |
|---|-------|--------|----------|
| 1 | Tier enum: free < pro < workbench (Comparable) | ✓ | `static func <` with order array |
| 2 | Transaction.updates listener starts in init() | ✓ | First line of init() |
| 3 | purchase() finishes transaction only after refreshEntitlements() | ✓ | `await refreshEntitlements()` then `await transaction.finish()` |
| 4 | refreshEntitlements() only grants verified transactions | ✓ | `.unverified` case logs warning and skips |
| 5 | restorePurchases() calls AppStore.sync() | ✓ | Present for App Store review compliance |
| 6 | FeatureGate.isAllowed() enforces tier | ✓ | Uses Comparable: `currentTier >= requiredTier(for: feature)` |
| 7 | StoreKit config has 4 products | ✓ | Pro monthly/yearly + Workbench monthly/yearly in Isometry.storekit |

### TIER-03: LaunchPayload Dynamic Tier

| # | Check | Status | Evidence |
|---|-------|--------|----------|
| 1 | sendLaunchPayload() uses dynamic tier | ✓ | `subscriptionManager?.currentTier.rawValue ?? "free"` |
| 2 | Tier change re-sends LaunchPayload | ✓ | `.onChange(of: subscriptionManager.currentTier)` in ContentView |

### TIER-04: FeatureGate Integration

| # | Check | Status | Evidence |
|---|-------|--------|----------|
| 1 | BridgeManager native:action checks FeatureGate | ✓ | `FeatureGate.isAllowed(feature, for: currentTier)` with `native:blocked` JS response |
| 2 | Import button gated in ContentView | ✓ | `showingPaywall = true` when tier insufficient |
| 3 | Paywall with Restore Purchases | ✓ | PaywallView has restore button calling `AppStore.sync()` |
| 4 | Settings screen accessible via toolbar | ✓ | Gear icon in `.secondaryAction` placement |

## Automated Score: 10/10

All code artifacts present and correctly wired.

## Human Verification Required

The following items need manual testing (cannot be verified by code inspection alone):

1. **iCloud sync end-to-end** — Requires Apple Developer portal configuration (register ubiquity container `iCloud.works.isometry.Isometry`), then test sync between two devices
2. **StoreKit sandbox purchase** — Run app with Isometry.storekit selected in Xcode scheme, complete a sandbox purchase, verify tier updates
3. **Post-purchase live activation** — After sandbox purchase, verify file import works without app restart (tier change → LaunchPayload re-send)
4. **Provisioning profile** — Regenerate after adding iCloud container to App ID

## Requirement Traceability

| Requirement | Plan | Status |
|-------------|------|--------|
| TIER-01 | 14-01 | ✓ Implemented |
| TIER-02 | 14-02 | ✓ Implemented |
| TIER-03 | 14-03 | ✓ Implemented |
| TIER-04 | 14-02, 14-03 | ✓ Implemented |
