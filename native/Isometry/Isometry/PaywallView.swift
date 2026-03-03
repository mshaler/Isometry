import SwiftUI
import StoreKit

// ---------------------------------------------------------------------------
// PaywallView — TIER-03
// ---------------------------------------------------------------------------
// Custom SwiftUI paywall showing Pro subscription options with purchase flow.
// Two entry points: (1) Settings "Upgrade to Pro" button, (2) gated import action.
// Includes Restore Purchases button for App Store review compliance.
//
// Design: System colors and materials for platform-appropriate appearance.
// iOS 15+ compatible — does NOT use SubscriptionStoreView (iOS 17+).

struct PaywallView: View {
    @ObservedObject var subscriptionManager: SubscriptionManager
    @Environment(\.dismiss) var dismiss

    @State private var errorMessage: String?
    @State private var showingError = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 24) {
                    // MARK: Header
                    headerSection

                    // MARK: Features
                    featuresSection

                    // MARK: Pro Products
                    proProductsSection

                    // MARK: Workbench Products (informational)
                    workbenchSection

                    // MARK: Restore Purchases
                    restoreButton

                    // MARK: Legal
                    legalText
                }
                .padding()
            }
            .navigationTitle("Upgrade")
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            #endif
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close") { dismiss() }
                }
            }
            .alert("Purchase Error", isPresented: $showingError) {
                Button("OK", role: .cancel) {}
            } message: {
                Text(errorMessage ?? "An unknown error occurred.")
            }
        }
    }

    // MARK: - Sections

    private var headerSection: some View {
        VStack(spacing: 8) {
            Image(systemName: "star.circle.fill")
                .font(.system(size: 56))
                .foregroundStyle(.yellow)

            Text("Upgrade to Pro")
                .font(.title.bold())

            Text("Unlock powerful features for your data")
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
        .padding(.top, 8)
    }

    private var featuresSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            featureRow(icon: "square.and.arrow.down.fill", title: "File Import", description: "Import JSON, CSV, Markdown, and Excel files")
            featureRow(icon: "icloud.fill", title: "Cloud Save", description: "Save and sync your data across devices")
            featureRow(icon: "square.and.arrow.up.fill", title: "Data Export", description: "Export your data in multiple formats")
        }
        .padding()
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 12))
    }

    private func featureRow(icon: String, title: String, description: String) -> some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .font(.title3)
                .foregroundStyle(.blue)
                .frame(width: 28)

            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.subheadline.bold())
                Text(description)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
    }

    private var proProductsSection: some View {
        VStack(spacing: 12) {
            let proProducts = subscriptionManager.products.filter { $0.id.contains("pro") }

            if proProducts.isEmpty {
                ProgressView("Loading products...")
                    .padding()
            } else {
                ForEach(proProducts, id: \.id) { product in
                    productCard(product: product, highlight: product.id.contains("yearly"))
                }
            }
        }
    }

    private func productCard(product: Product, highlight: Bool) -> some View {
        VStack(spacing: 8) {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text(product.displayName)
                        .font(.headline)
                    Text(product.displayPrice + " / " + periodLabel(product))
                        .font(.subheadline)
                        .foregroundStyle(.secondary)

                    if highlight, let monthlyEquivalent = monthlyPrice(for: product) {
                        Text("Save ~17% vs monthly (\(monthlyEquivalent)/mo)")
                            .font(.caption)
                            .foregroundStyle(.green)
                    }
                }
                Spacer()
            }

            Button {
                Task {
                    do {
                        let success = try await subscriptionManager.purchase(product)
                        if success { dismiss() }
                    } catch {
                        errorMessage = error.localizedDescription
                        showingError = true
                    }
                }
            } label: {
                Text("Subscribe")
                    .font(.headline)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 10)
            }
            .buttonStyle(.borderedProminent)
            .disabled(subscriptionManager.purchaseInProgress)
        }
        .padding()
        .background(
            RoundedRectangle(cornerRadius: 12)
                .strokeBorder(highlight ? Color.blue : Color.secondary.opacity(0.3), lineWidth: highlight ? 2 : 1)
        )
    }

    private var workbenchSection: some View {
        let workbenchProducts = subscriptionManager.products.filter { $0.id.contains("workbench") }
        return Group {
            if !workbenchProducts.isEmpty {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Workbench")
                        .font(.headline)
                        .foregroundStyle(.secondary)
                    Text("Full access to all current and future features. Everything in Pro, plus advanced collaboration tools coming soon.")
                        .font(.caption)
                        .foregroundStyle(.secondary)

                    ForEach(workbenchProducts, id: \.id) { product in
                        productCard(product: product, highlight: false)
                    }
                }
            }
        }
    }

    private var restoreButton: some View {
        Button {
            Task {
                try? await subscriptionManager.restorePurchases()
                if subscriptionManager.currentTier >= .pro {
                    dismiss()
                }
            }
        } label: {
            Text("Restore Purchases")
                .font(.subheadline)
        }
        .disabled(subscriptionManager.purchaseInProgress)
        .padding(.top, 4)
    }

    private var legalText: some View {
        Text("Payment will be charged to your Apple ID account. Subscription automatically renews unless cancelled at least 24 hours before the end of the current period.")
            .font(.caption2)
            .foregroundStyle(.secondary)
            .multilineTextAlignment(.center)
            .padding(.horizontal)
    }

    // MARK: - Helpers

    private func periodLabel(_ product: Product) -> String {
        guard let subscription = product.subscription else { return "" }
        switch subscription.subscriptionPeriod.unit {
        case .month: return "month"
        case .year: return "year"
        case .week: return "week"
        case .day: return "day"
        @unknown default: return ""
        }
    }

    private func monthlyPrice(for product: Product) -> String? {
        guard let subscription = product.subscription,
              subscription.subscriptionPeriod.unit == .year else { return nil }
        let monthly = product.price / 12
        let currencyCode = product.priceFormatStyle.currencyCode
        return monthly.formatted(.currency(code: currencyCode))
    }
}
