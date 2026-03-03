// FeatureGate.swift — TIER-04
// Enforces tier restrictions before allowing native actions.
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
    static func isAllowed(_ feature: NativeFeature, for currentTier: Tier) -> Bool {
        currentTier >= requiredTier(for: feature)
    }
}
