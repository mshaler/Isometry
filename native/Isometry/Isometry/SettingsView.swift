import SwiftUI
#if os(iOS)
import UIKit
#else
import AppKit
#endif

// ---------------------------------------------------------------------------
// SettingsView — TIER-03
// ---------------------------------------------------------------------------
// Settings/account screen showing current subscription tier and options.
// Accessible from a toolbar button (gear icon) — always visible regardless
// of sidebar state (per CONTEXT.md).
//
// - Free tier: shows "Upgrade to Pro" button → presents PaywallView
// - Pro/Workbench: shows tier badge + "Manage Subscription" link → App Store
//
// Requirements addressed:
//   - TIER-03: Subscription section with tier badge and manage/upgrade options
//   - MKIT-02: Diagnostics section with crash/hang counts and JSON export

struct SettingsView: View {
    @ObservedObject var subscriptionManager: SubscriptionManager
    /// MetricKitSubscriber provides crash/hang counts and export data (MKIT-02).
    @ObservedObject var metricKitSubscriber: MetricKitSubscriber
    /// SyncManager for Re-sync All Data action (SUXR-03). Optional — sync may not be active.
    var syncManager: SyncManager?
    @Environment(\.dismiss) var dismiss

    @AppStorage("theme") private var theme: String = "dark"
    @State private var showingPaywall = false
    @State private var showingExportSheet = false
    @State private var exportData: Data?
    @State private var showingResyncAlert = false

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

                // MARK: Appearance
                Section {
                    Picker("Appearance", selection: $theme) {
                        Text("Light").tag("light")
                        Text("Dark").tag("dark")
                        Text("System").tag("system")
                    }
                    .pickerStyle(.segmented)
                } header: {
                    Text("Appearance")
                }

                // MARK: Cloud Sync (SUXR-03)
                Section("Cloud Sync") {
                    Button("Re-sync All Data") {
                        showingResyncAlert = true
                    }
                    .foregroundStyle(.red)
                }
                .alert("Re-sync All Data?", isPresented: $showingResyncAlert) {
                    Button("Cancel", role: .cancel) {}
                    Button("Re-sync", role: .destructive) {
                        Task { await syncManager?.triggerResync() }
                    }
                } message: {
                    Text("This will re-download all data from iCloud. Your local data will be replaced.")
                }

                // MARK: Diagnostics (MKIT-02)
                Section {
                    HStack {
                        Text("Crashes")
                            .font(.body)
                        Spacer()
                        Text("\(metricKitSubscriber.crashCount)")
                            .font(.body)
                            .foregroundStyle(.secondary)
                    }
                    HStack {
                        Text("Hangs")
                            .font(.body)
                        Spacer()
                        Text("\(metricKitSubscriber.hangCount)")
                            .font(.body)
                            .foregroundStyle(.secondary)
                    }
                    Button("Export Diagnostics") {
                        exportDiagnostics()
                    }
                    .buttonStyle(.bordered)
                } header: {
                    Text("Diagnostics")
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
            #if os(iOS)
            .sheet(isPresented: $showingExportSheet) {
                if let data = exportData {
                    ActivityView(activityItems: [data])
                }
            }
            #endif
        }
        #if os(macOS)
        .frame(minWidth: 400, minHeight: 300)
        #endif
    }

    // MARK: - Diagnostics Export (MKIT-02)

    /// Exports MetricKit diagnostic payloads as JSON.
    /// On iOS: presents UIActivityViewController via sheet.
    /// On macOS: presents NSSavePanel.
    private func exportDiagnostics() {
        guard let data = metricKitSubscriber.exportJSON() else {
            // No payloads yet — nothing to export
            return
        }
        #if os(iOS)
        exportData = data
        showingExportSheet = true
        #else
        let savePanel = NSSavePanel()
        savePanel.nameFieldStringValue = "isometry-diagnostics.json"
        savePanel.allowedContentTypes = [.json]
        savePanel.begin { response in
            guard response == .OK, let url = savePanel.url else { return }
            try? data.write(to: url)
        }
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

// ---------------------------------------------------------------------------
// ActivityView — iOS Share Sheet Wrapper (MKIT-02)
// ---------------------------------------------------------------------------
// UIViewControllerRepresentable wrapping UIActivityViewController for
// presenting the diagnostics JSON export share sheet on iOS.

#if os(iOS)
struct ActivityView: UIViewControllerRepresentable {
    let activityItems: [Any]

    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: activityItems, applicationActivities: nil)
    }

    func updateUIViewController(_ uiViewController: UIActivityViewController, context: Context) {}
}
#endif
