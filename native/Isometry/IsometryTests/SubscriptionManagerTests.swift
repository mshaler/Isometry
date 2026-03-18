import Testing
import Foundation
@testable import Isometry

// ---------------------------------------------------------------------------
// SubscriptionManager Tests
// ---------------------------------------------------------------------------
// Tests for pure logic in SubscriptionManager: product ID to tier mapping,
// tier ordering, and product ID set completeness.
// StoreKit purchase/entitlement methods cannot be unit tested without
// StoreKit Testing framework — focus on pure logic only.

struct SubscriptionManagerTests {

    // MARK: - tierForProductID mapping

    @Test @MainActor func proMonthlyReturnsPro() {
        let sm = SubscriptionManager()
        #expect(sm.tierForProductID("works.isometry.pro.monthly") == .pro)
    }

    @Test @MainActor func proYearlyReturnsPro() {
        let sm = SubscriptionManager()
        #expect(sm.tierForProductID("works.isometry.pro.yearly") == .pro)
    }

    @Test @MainActor func workbenchMonthlyReturnsWorkbench() {
        let sm = SubscriptionManager()
        #expect(sm.tierForProductID("works.isometry.workbench.monthly") == .workbench)
    }

    @Test @MainActor func workbenchYearlyReturnsWorkbench() {
        let sm = SubscriptionManager()
        #expect(sm.tierForProductID("works.isometry.workbench.yearly") == .workbench)
    }

    @Test @MainActor func unknownProductReturnsFree() {
        let sm = SubscriptionManager()
        #expect(sm.tierForProductID("unknown.product") == .free)
    }

    @Test @MainActor func emptyStringReturnsFree() {
        let sm = SubscriptionManager()
        #expect(sm.tierForProductID("") == .free)
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
