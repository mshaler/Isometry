import SwiftUI

// ---------------------------------------------------------------------------
// SettingsView — TIER-03
// ---------------------------------------------------------------------------
// Settings/account screen showing current subscription tier and options.
// Accessible from a toolbar button (gear icon) — always visible regardless
// of sidebar state (per CONTEXT.md).
//
// - Free tier: shows "Upgrade to Pro" button → presents PaywallView
// - Pro/Workbench: shows tier badge + "Manage Subscription" link → App Store

struct SettingsView: View {
    @ObservedObject var subscriptionManager: SubscriptionManager
    @Environment(\.dismiss) var dismiss

    @State private var showingPaywall = false

    var body: some View {
        NavigationStack {
            List {
                // MARK: Current Plan
                Section {
                    HStack {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Current Plan")
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                            Text(tierDisplayName)
                                .font(.title2.bold())
                        }

                        Spacer()

                        tierBadge
                    }
                    .padding(.vertical, 4)

                    if subscriptionManager.currentTier == .free {
                        Button {
                            showingPaywall = true
                        } label: {
                            HStack {
                                Image(systemName: "star.fill")
                                    .foregroundStyle(.yellow)
                                Text("Upgrade to Pro")
                                    .font(.headline)
                            }
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 8)
                        }
                        .buttonStyle(.borderedProminent)
                    } else {
                        Link(destination: URL(string: "https://apps.apple.com/account/subscriptions")!) {
                            HStack {
                                Text("Manage Subscription")
                                Spacer()
                                Image(systemName: "arrow.up.right.square")
                                    .foregroundStyle(.secondary)
                            }
                        }
                    }
                } header: {
                    Text("Subscription")
                }

                // MARK: About
                Section {
                    HStack {
                        Text("Version")
                        Spacer()
                        Text(appVersion)
                            .foregroundStyle(.secondary)
                    }
                    HStack {
                        Text("Build")
                        Spacer()
                        Text(buildNumber)
                            .foregroundStyle(.secondary)
                    }
                } header: {
                    Text("About")
                }
            }
            .navigationTitle("Settings")
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            #endif
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
            .sheet(isPresented: $showingPaywall) {
                PaywallView(subscriptionManager: subscriptionManager)
            }
        }
        #if os(macOS)
        .frame(minWidth: 400, minHeight: 300)
        #endif
    }

    // MARK: - Helpers

    private var tierDisplayName: String {
        switch subscriptionManager.currentTier {
        case .free: return "Free"
        case .pro: return "Pro"
        case .workbench: return "Workbench"
        }
    }

    private var tierBadge: some View {
        let (color, icon): (Color, String) = {
            switch subscriptionManager.currentTier {
            case .free: return (.secondary, "person.crop.circle")
            case .pro: return (.blue, "star.circle.fill")
            case .workbench: return (.purple, "hammer.circle.fill")
            }
        }()

        return Image(systemName: icon)
            .font(.title)
            .foregroundStyle(color)
    }

    private var appVersion: String {
        Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "—"
    }

    private var buildNumber: String {
        Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "—"
    }
}
