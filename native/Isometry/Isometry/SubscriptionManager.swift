import Combine
import StoreKit
import os

// ---------------------------------------------------------------------------
// Tier — TIER-02
// ---------------------------------------------------------------------------
// Free/Pro/Workbench tiers with Comparable ordering: free < pro < workbench.
// rawValue maps directly to the tier string sent in LaunchPayload.

enum Tier: String, Comparable, CaseIterable {
    case free, pro, workbench

    static func < (lhs: Tier, rhs: Tier) -> Bool {
        let order: [Tier] = [.free, .pro, .workbench]
        return order.firstIndex(of: lhs)! < order.firstIndex(of: rhs)!
    }
}

// ---------------------------------------------------------------------------
// StoreError — TIER-02
// ---------------------------------------------------------------------------

enum StoreError: LocalizedError {
    case failedVerification
    var errorDescription: String? { "Transaction verification failed" }
}

// ---------------------------------------------------------------------------
// SubscriptionManager — TIER-02
// ---------------------------------------------------------------------------
// Owns StoreKit 2 product loading, purchase flow, entitlement checking, and
// transaction update listening. Follows BridgeManager's @MainActor pattern
// so @Published properties update SwiftUI views on the main actor.
//
// CRITICAL ordering in init():
//   1. Start Transaction.updates listener FIRST — don't miss pending transactions
//      that fire immediately when the listener is created (Pitfall 6)
//   2. Load products in background Task
//   3. Check current entitlements in background Task
//
// CRITICAL in purchase():
//   finish() only after refreshEntitlements() — never before (Pitfall from RESEARCH.md)

private let logger = Logger(subsystem: "works.isometry.app", category: "Subscriptions")

@MainActor
final class SubscriptionManager: ObservableObject {

    // MARK: - Published State

    /// Current subscription tier. Starts free; updated by refreshEntitlements().
    @Published private(set) var currentTier: Tier = .free

    /// All loaded subscription products, sorted by price ascending.
    @Published private(set) var products: [Product] = []

    /// True while a purchase is in progress (drives loading UI).
    @Published private(set) var purchaseInProgress: Bool = false

    // MARK: - Product Identifiers

    /// Must match the .storekit configuration file and App Store Connect exactly.
    static let productIDs: Set<String> = [
        "works.isometry.pro.monthly",
        "works.isometry.pro.yearly",
        "works.isometry.workbench.monthly",
        "works.isometry.workbench.yearly"
    ]

    // MARK: - Private

    private var updatesTask: Task<Void, Never>?

    // MARK: - Init / Deinit

    init() {
        // Step 1: Start transaction updates listener BEFORE anything else.
        // Pending transactions (renewals, Ask to Buy approvals) fire immediately
        // when the listener is created — starting late risks missing them.
        updatesTask = listenForTransactionUpdates()

        // Step 2: Load the product catalog from StoreKit / .storekit config.
        Task { await loadProducts() }

        // Step 3: Check what entitlements are currently active.
        Task { await refreshEntitlements() }
    }

    deinit {
        updatesTask?.cancel()
    }

    // MARK: - Product Loading

    /// Load all subscription products from StoreKit.
    /// Sorts by price ascending so the cheapest option is first.
    /// Logs errors but does not throw — app functions without products loaded.
    func loadProducts() async {
        do {
            let loaded = try await Product.products(for: Self.productIDs)
            products = loaded.sorted { $0.price < $1.price }
            logger.info("Loaded \(self.products.count) subscription products")
        } catch {
            logger.error("loadProducts failed: \(error.localizedDescription)")
        }
    }

    // MARK: - Purchase

    /// Initiate a StoreKit 2 purchase for the given product.
    /// Returns true if the purchase succeeded and entitlements were refreshed.
    /// Returns false on user cancellation or pending (Ask to Buy).
    ///
    /// CRITICAL: finish() is called ONLY after refreshEntitlements() updates
    /// currentTier. Finishing before unlocking features would consume the
    /// transaction without granting access.
    func purchase(_ product: Product) async throws -> Bool {
        purchaseInProgress = true
        defer { purchaseInProgress = false }

        let result = try await product.purchase()

        switch result {
        case .success(let verification):
            let transaction = try checkVerified(verification)
            await refreshEntitlements()
            // CRITICAL: finish() ONLY after refreshEntitlements() has updated tier
            await transaction.finish()
            logger.info("Purchase succeeded for \(product.id) — tier now \(self.currentTier.rawValue)")
            return true

        case .userCancelled:
            logger.info("Purchase cancelled by user for \(product.id)")
            return false

        case .pending:
            // Ask to Buy: parent approval pending — will arrive via Transaction.updates
            logger.info("Purchase pending (Ask to Buy) for \(product.id)")
            return false

        @unknown default:
            logger.warning("Unknown purchase result for \(product.id)")
            return false
        }
    }

    // MARK: - Entitlement Refresh

    /// Check Transaction.currentEntitlements and set the highest active tier.
    /// Only grants entitlement for .verified transactions — never for .unverified
    /// (jailbroken devices can forge unverified transactions).
    func refreshEntitlements() async {
        var highestTier: Tier = .free

        for await entitlement in Transaction.currentEntitlements {
            switch entitlement {
            case .verified(let transaction):
                let tier = Self.tierForProductID(transaction.productID)
                if tier > highestTier {
                    highestTier = tier
                }
            case .unverified(_, let error):
                // Do NOT grant entitlement — log and skip
                logger.warning("Skipping unverified entitlement: \(error.localizedDescription)")
            }
        }

        currentTier = highestTier
        logger.info("Entitlements refreshed — current tier: \(self.currentTier.rawValue)")
    }

    // MARK: - Restore Purchases

    /// Force re-verification of all transactions via AppStore.sync().
    /// Required for App Store review compliance — reviewers check for this button.
    /// After sync, refreshEntitlements() re-reads currentEntitlements.
    func restorePurchases() async throws {
        try await AppStore.sync()
        await refreshEntitlements()
        logger.info("Purchases restored — tier: \(self.currentTier.rawValue)")
    }

    // MARK: - Transaction Updates Listener

    /// Background task that listens for transactions occurring outside the app:
    /// subscription renewals, revocations, Ask to Buy approvals, cross-device purchases.
    private func listenForTransactionUpdates() -> Task<Void, Never> {
        Task(priority: .background) {
            for await update in Transaction.updates {
                guard let transaction = try? self.checkVerified(update) else {
                    logger.warning("Skipping unverified transaction update")
                    continue
                }
                await self.refreshEntitlements()
                // finish() after refreshEntitlements() — consistent with purchase() ordering
                await transaction.finish()
                logger.info("Transaction update processed: \(transaction.productID)")
            }
        }
    }

    // MARK: - Verification

    /// Unwrap a VerificationResult, throwing StoreError.failedVerification for .unverified.
    func checkVerified<T>(_ result: VerificationResult<T>) throws -> T {
        switch result {
        case .verified(let value):
            return value
        case .unverified:
            throw StoreError.failedVerification
        }
    }

    // MARK: - Tier Mapping

    /// Map a StoreKit product ID to the corresponding Tier value.
    /// Product IDs follow the pattern: works.isometry.<tier>.<period>
    ///
    /// Uses dot-segment matching to avoid false positives from substrings.
    /// For example, "com.example.production.v2" contains "pro" as a substring
    /// but split on "." produces ["com", "example", "production", "v2"] — none
    /// of which equals "pro", so it correctly returns .free.
    nonisolated static func tierForProductID(_ productID: String) -> Tier {
        let components = productID.lowercased().split(separator: ".")
        if components.contains("workbench") { return .workbench }
        if components.contains("pro") { return .pro }
        return .free
    }
}
