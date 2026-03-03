---
phase: 14-icloud-storekit-tiers
plan: 03
subsystem: App Wiring + Paywall + FeatureGate Integration
tags: [swiftui, storekit, paywall, feature-gate, subscription, tier]
started: 2026-03-03T14:53:00Z
completed: 2026-03-03T15:10:00Z
status: complete
---

## Self-Check: PASSED

## What was built

Wired SubscriptionManager and FeatureGate into the app, created the paywall and settings UI, and integrated tier gating into BridgeManager.

## Key decisions

- D-14-03-01: Used `.secondaryAction` placement for settings gear icon — always visible regardless of sidebar state on both macOS and iOS
- D-14-03-02: Added `#if os(macOS) .frame(minWidth:minHeight:)` to both SettingsView and PaywallView — macOS sheets with NavigationStack+List need explicit sizing
- D-14-03-03: FeatureGate check in import button shows paywall sheet directly — no intermediate alert or toast
- D-14-03-04: `.onChange(of: subscriptionManager.currentTier)` re-sends full LaunchPayload — ensures web runtime gets updated tier immediately after purchase

## Key files

### Created
- `native/Isometry/Isometry/PaywallView.swift` — Custom SwiftUI paywall with Pro product cards, purchase flow, Restore Purchases button, yearly savings highlight, legal text
- `native/Isometry/Isometry/SettingsView.swift` — Settings/account screen showing current tier, upgrade/manage subscription, app version info

### Modified
- `native/Isometry/Isometry/IsometryApp.swift` — Added `@StateObject subscriptionManager`, passes to ContentView, wires to BridgeManager in .onAppear
- `native/Isometry/Isometry/BridgeManager.swift` — Added `subscriptionManager` property, dynamic tier in sendLaunchPayload(), FeatureGate integration in native:action handler with `native:blocked` JS response
- `native/Isometry/Isometry/ContentView.swift` — Added `subscriptionManager` parameter, settings/paywall state, FeatureGate on import button, settings toolbar button, tier change handler

## Commits

- `d35b8ea7`: feat(14-03): create PaywallView and SettingsView
- `4ea5bf4c`: feat(14-03): wire SubscriptionManager + FeatureGate into app
- `7551ed9f`: fix(14-03): add macOS frame sizing to PaywallView/SettingsView + restore iCloud entitlements

## Requirements addressed

- TIER-03: LaunchPayload.tier reflects actual subscription state (dynamic from SubscriptionManager)
- TIER-04: FeatureGate blocks native actions for insufficient tiers (BridgeManager + ContentView import button)

## Deviations

- macOS sheet sizing issue required adding `.frame(minWidth:minHeight:)` modifiers — not in plan but necessary for macOS rendering
- iCloud entitlements temporarily stripped for manual verification (provisioning profile mismatch) — restored after approval
