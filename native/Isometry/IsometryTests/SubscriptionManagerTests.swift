import Testing
import Foundation
@testable import Isometry

// ---------------------------------------------------------------------------
// SubscriptionManager Tests
// ---------------------------------------------------------------------------
// Tests for pure logic in SubscriptionManager: product ID to tier mapping,
// tier ordering, and product ID set completeness.
// tierForProductID is static — no SubscriptionManager instance needed,
// avoiding StoreKit transaction listener side effects in parallel test clones.

struct SubscriptionManagerTests {

    // MARK: - tierForProductID mapping (static — no instance needed)

    @Test func proMonthlyReturnsPro() {
        #expect(SubscriptionManager.tierForProductID("works.isometry.pro.monthly") == .pro)
    }

    @Test func proYearlyReturnsPro() {
        #expect(SubscriptionManager.tierForProductID("works.isometry.pro.yearly") == .pro)
    }

    @Test func workbenchMonthlyReturnsWorkbench() {
        #expect(SubscriptionManager.tierForProductID("works.isometry.workbench.monthly") == .workbench)
    }

    @Test func workbenchYearlyReturnsWorkbench() {
        #expect(SubscriptionManager.tierForProductID("works.isometry.workbench.yearly") == .workbench)
    }

    @Test func unknownProductReturnsFree() {
        #expect(SubscriptionManager.tierForProductID("unknown.product") == .free)
    }

    @Test func emptyStringReturnsFree() {
        #expect(SubscriptionManager.tierForProductID("") == .free)
    }

    @Test func productIDContainingProSubstringReturnsFree() {
        // "production" contains "pro" as a substring but not as a dot-segment —
        // the fixed implementation must return .free, not .pro.
        #expect(SubscriptionManager.tierForProductID("com.example.production.v2") == .free)
    }

    @Test func caseInsensitiveProReturnsPro() {
        #expect(SubscriptionManager.tierForProductID("works.isometry.PRO.monthly") == .pro)
    }

    // MARK: - Tier ordering (Comparable)

    @Test func freeIsLessThanPro() {
        #expect(Tier.free < Tier.pro)
    }

    @Test func proIsLessThanWorkbench() {
        #expect(Tier.pro < Tier.workbench)
    }

    @Test func freeIsLessThanWorkbench() {
        #expect(Tier.free < Tier.workbench)
    }

    @Test func workbenchIsNotLessThanPro() {
        #expect(!(Tier.workbench < Tier.pro))
    }

    // MARK: - productIDs set

    @Test func productIDsContainsExactlyFourEntries() {
        #expect(SubscriptionManager.productIDs.count == 4)
    }

    @Test func productIDsContainsExpectedIDs() {
        let expected: Set<String> = [
            "works.isometry.pro.monthly",
            "works.isometry.pro.yearly",
            "works.isometry.workbench.monthly",
            "works.isometry.workbench.yearly"
        ]
        #expect(SubscriptionManager.productIDs == expected)
    }
}
