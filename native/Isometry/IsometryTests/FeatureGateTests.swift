import Testing
import Foundation
@testable import Isometry

// ---------------------------------------------------------------------------
// FeatureGate Tests
// ---------------------------------------------------------------------------
// Tests for tier enforcement logic, required tier mapping, and the
// ISOMETRY_ENFORCE_GATES debug override mechanism.

struct FeatureGateTests {

    // MARK: - requiredTier mapping

    @Test func requiredTierForFileImportIsPro() {
        #expect(FeatureGate.requiredTier(for: .fileImport) == .pro)
    }

    @Test func requiredTierForCloudSaveIsPro() {
        #expect(FeatureGate.requiredTier(for: .cloudSave) == .pro)
    }

    @Test func requiredTierForExportDataIsPro() {
        #expect(FeatureGate.requiredTier(for: .exportData) == .pro)
    }

    @Test func allFeaturesRequireProTier() {
        for feature in NativeFeature.allCases {
            #expect(
                FeatureGate.requiredTier(for: feature) == .pro,
                "Expected \(feature.rawValue) to require .pro tier"
            )
        }
    }

    // MARK: - Tier comparison logic (production path)

    @Test func proTierMeetsProRequirement() {
        // Test the underlying comparison: pro >= pro is true
        #expect(Tier.pro >= FeatureGate.requiredTier(for: .fileImport))
    }

    @Test func freeTierDoesNotMeetProRequirement() {
        // Test the underlying comparison: free >= pro is false
        #expect(!(Tier.free >= FeatureGate.requiredTier(for: .fileImport)))
    }

    @Test func workbenchTierMeetsProRequirement() {
        // Test the underlying comparison: workbench >= pro is true
        #expect(Tier.workbench >= FeatureGate.requiredTier(for: .fileImport))
    }

    // MARK: - isAllowed in DEBUG (default bypass active)

    @Test func isAllowedReturnsTrueInDebugByDefault() {
        // In DEBUG without ISOMETRY_ENFORCE_GATES, all features should be allowed
        // even for free tier (the default bypass)
        #expect(FeatureGate.isAllowed(.fileImport, for: .free) == true)
    }

    // MARK: - isEnforcingGates property

    @Test func isEnforcingGatesReflectsEnvironment() {
        // In test environment without ISOMETRY_ENFORCE_GATES set,
        // isEnforcingGates should be false (DEBUG default)
        #expect(FeatureGate.isEnforcingGates == false)
    }
}
