---
phase: 14-icloud-storekit-tiers
plan: 02
subsystem: StoreKit 2 Subscriptions + Feature Gating
tags: [storekit, subscriptions, feature-gating, tier, swift]
dependency_graph:
  requires: []
  provides:
    - Tier enum (free/pro/workbench) with Comparable ordering
    - SubscriptionManager StoreKit 2 lifecycle (product load, purchase, entitlements, updates)
    - FeatureGate static tier enforcement for native actions
    - Isometry.storekit local config for sandbox testing
  affects:
    - native/Isometry/Isometry/BridgeManager.swift (14-03 wires SubscriptionManager in)
    - native/Isometry/Isometry/IsometryApp.swift (14-03 adds @StateObject SubscriptionManager)
    - native/Isometry/Isometry/ContentView.swift (14-03 adds paywall and settings UI)
tech_stack:
  added: []
  patterns:
    - StoreKit 2 @MainActor ObservableObject subscription manager
    - Transaction.updates listener started before product loading (Pitfall 6 prevention)
    - finish() called only after refreshEntitlements() (transaction ordering guarantee)
    - VerificationResult switch -- .verified only, never .unverified for entitlements
    - FeatureGate as pure static functions (no state, easily unit-testable)
key_files:
  created:
    - native/Isometry/Isometry/SubscriptionManager.swift
    - native/Isometry/Isometry/FeatureGate.swift
    - native/Isometry/Isometry/Isometry.storekit
  modified: []
decisions:
  - "[14-02] fileImport requires Pro tier per CONTEXT.md: Pro gates ETL/file import features"
  - "[14-02] Combine import added explicitly -- StoreKit does not re-export ObservableObject/Published"
  - "[14-02] .storekit groupNumber: Workbench=1 (highest priority), Pro=2 -- Apple uses lower=higher"
  - "[14-02] productIDs is Set<String> in SubscriptionManager -- order irrelevant for lookup, products sorted by price after load"
metrics:
  duration_seconds: 189
  completed_date: "2026-03-03"
  tasks_completed: 2
  files_created: 3
  files_modified: 0
  commits: 2
---

# Phase 14 Plan 02: StoreKit 2 SubscriptionManager + FeatureGate Summary

**One-liner:** StoreKit 2 subscription manager with Tier enum (free/pro/workbench), FeatureGate enforcement, and 4-product .storekit local sandbox config.

## What Was Built

### SubscriptionManager.swift (TIER-02)

`@MainActor final class SubscriptionManager: ObservableObject` following the BridgeManager pattern:

- **Tier enum** at top of file with `free < pro < workbench` Comparable ordering via index-based `<` operator
- **StoreError.failedVerification** LocalizedError for unverified transaction guard
- **@Published** `currentTier: Tier = .free`, `products: [Product]`, `purchaseInProgress: Bool`
- **init()** ordering: Transaction.updates listener first, then loadProducts(), then refreshEntitlements()
- **loadProducts()**: `Product.products(for: Self.productIDs)` sorted by price ascending; logs errors, never throws
- **purchase()**: Sets purchaseInProgress, defers reset; `.success` path calls checkVerified → refreshEntitlements → finish(); handles `.userCancelled`, `.pending`, `@unknown default`
- **refreshEntitlements()**: Iterates `Transaction.currentEntitlements`; only `.verified` transactions grant tier; `.unverified` logged and skipped
- **restorePurchases()**: `AppStore.sync()` then `refreshEntitlements()` for App Store review compliance
- **listenForTransactionUpdates()**: `Task(priority: .background)` iterating `Transaction.updates`; verified only; refresh then finish

### FeatureGate.swift (TIER-04)

Pure static struct with zero state:

- **NativeFeature enum**: `fileImport`, `cloudSave`, `exportData` -- all require `.pro`
- **requiredTier(for:)**: switch returning required Tier per feature
- **isAllowed(_:for:)**: `currentTier >= requiredTier(for: feature)` using Tier's Comparable

### Isometry.storekit

Valid JSON StoreKit configuration file for Xcode local sandbox testing:

- Single group "IsometrySubscriptions" with 4 products
- `works.isometry.pro.monthly` -- $4.99/month, 7-day FREE_TRIAL, groupNumber 2
- `works.isometry.pro.yearly` -- $49.99/year, 7-day FREE_TRIAL, groupNumber 2
- `works.isometry.workbench.monthly` -- $9.99/month, no trial, groupNumber 1
- `works.isometry.workbench.yearly` -- $99.99/year, no trial, groupNumber 1
- Product IDs match `SubscriptionManager.productIDs` exactly

## Verification Results

| Check | Result |
|-------|--------|
| Project builds without errors | PASS |
| `FeatureGate.isAllowed(.fileImport, for: .free)` returns false | PASS |
| `FeatureGate.isAllowed(.fileImport, for: .pro)` returns true | PASS |
| `Tier.free < Tier.pro < Tier.workbench` ordering | PASS |
| .storekit is valid JSON with 4 products | PASS |
| Product IDs in SubscriptionManager match .storekit | PASS |
| Pro products have 7-day FREE_TRIAL | PASS |
| Workbench products have no introductory offer | PASS |
| Workbench groupNumber 1 > Pro groupNumber 2 | PASS |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Missing Combine import in SubscriptionManager.swift**
- **Found during:** Task 1 build verification
- **Issue:** `@Published` and `ObservableObject` require `import Combine` in Swift. StoreKit does not re-export them. Build failed with "type 'SubscriptionManager' does not conform to protocol 'ObservableObject'" and "'@Published' missing Combine import" errors.
- **Fix:** Added `import Combine` at top of SubscriptionManager.swift
- **Files modified:** `native/Isometry/Isometry/SubscriptionManager.swift`
- **Commit:** 06ab0cf5

## Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create SubscriptionManager with StoreKit 2 lifecycle and Tier enum | 06ab0cf5 | SubscriptionManager.swift |
| 2 | Create FeatureGate and StoreKit configuration file | 324d721f | FeatureGate.swift, Isometry.storekit |

## Self-Check

Verifying files exist and commits are present:

## Self-Check: PASSED
