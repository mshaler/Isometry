// FeatureGate.swift — TIER-04
// Enforces tier restrictions before allowing native actions.
import Foundation
//
// Per CONTEXT.md decisions:
//   - Pro tier gates ETL/file import and future export
//   - All 9 views are Free — no view gating
//   - iCloud Documents sync is Free — no tier gate on sync
//   - Workbench is defined but nothing is gated to it in Phase 14

// ---------------------------------------------------------------------------
// NativeFeature — the set of native actions that can be gated by tier
// ---------------------------------------------------------------------------

enum NativeFeature: String, CaseIterable {
    case fileImport     // Pro tier (ETL/file import per CONTEXT.md)
    case cloudSave      // Pro tier (future — extensible)
    case exportData     // Pro tier (future — extensible)
}

// ---------------------------------------------------------------------------
// FeatureGate — static tier enforcement
// ---------------------------------------------------------------------------
// Called from BridgeManager's native:action handler before dispatching.
// isAllowed() is a pure function — no state, easily unit-testable.

struct FeatureGate {

    /// Returns the minimum Tier required to use a given native feature.
    static func requiredTier(for feature: NativeFeature) -> Tier {
        switch feature {
        case .fileImport:  return .pro
        case .cloudSave:   return .pro
        case .exportData:  return .pro
        }
    }

    /// Returns true if the currentTier meets or exceeds the feature's required tier.
    /// Uses Tier's Comparable conformance: free < pro < workbench.
    /// DEBUG builds bypass all gates by default to eliminate friction during development.
    /// Set ISOMETRY_ENFORCE_GATES=1 in your Xcode scheme environment variables to
    /// enforce tier gating during development/testing.
    static func isAllowed(_ feature: NativeFeature, for currentTier: Tier) -> Bool {
        #if DEBUG
        if ProcessInfo.processInfo.environment["ISOMETRY_ENFORCE_GATES"] != "1" {
            return true
        }
        #endif
        return currentTier >= requiredTier(for: feature)
    }

    /// Whether tier gates are being enforced in this DEBUG build.
    /// Returns true when ISOMETRY_ENFORCE_GATES=1 is set, or always true in release builds.
    static var isEnforcingGates: Bool {
        #if DEBUG
        return ProcessInfo.processInfo.environment["ISOMETRY_ENFORCE_GATES"] == "1"
        #else
        return true
        #endif
    }
}
