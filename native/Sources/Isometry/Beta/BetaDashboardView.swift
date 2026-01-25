import SwiftUI

/// Beta testing dashboard for managing beta features and feedback
public struct BetaDashboardView: View {
    @StateObject private var betaManager = BetaTestingManager()
    @State private var showingFeedback = false
    @State private var showingInstructions = false

    public init() {}

    public var body: some View {
        NavigationView {
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    if betaManager.isBetaMode {
                        headerSection
                        versionInfoSection
                        featuresSection
                        feedbackSection
                        instructionsSection
                    } else {
                        notBetaView
                    }
                }
                .padding()
            }
            .navigationTitle("Beta Dashboard")
            #if os(iOS)
            .navigationBarTitleDisplayMode(.large)
            #endif
            .sheet(isPresented: $showingFeedback) {
                BetaFeedbackView()
            }
            .sheet(isPresented: $showingInstructions) {
                BetaInstructionsView(betaVersion: betaManager.betaVersion)
            }
        }
        .onAppear {
            betaManager.trackBetaEvent(BetaAnalyticsEvent(name: "beta_dashboard_viewed"))
        }
    }

    // MARK: - Header Section

    private var headerSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Image(systemName: "testtube.2")
                    .foregroundColor(.orange)
                    .font(.title2)

                VStack(alignment: .leading, spacing: 4) {
                    Text("Beta Dashboard")
                        .font(.title2)
                        .fontWeight(.semibold)

                    Text("Welcome to the Isometry beta program!")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }

                Spacer()
            }

            if let betaVersion = betaManager.betaVersion {
                HStack {
                    Text("\(betaVersion.configuration.testingPhase.rawValue)")
                        .font(.caption)
                        .fontWeight(.medium)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(Color.orange.opacity(0.2))
                        .foregroundColor(.orange)
                        .cornerRadius(6)

                    Text("Expires: \(betaVersion.expirationDate, style: .date)")
                        .font(.caption)
                        .foregroundStyle(.secondary)

                    Spacer()
                }
            }
        }
    }

    // MARK: - Version Info Section

    private var versionInfoSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Version Information")
                .font(.headline)

            if let betaVersion = betaManager.betaVersion {
                VStack(spacing: 8) {
                    InfoRow(
                        title: "Version",
                        value: betaVersion.configuration.version,
                        icon: "app.badge"
                    )

                    InfoRow(
                        title: "Build",
                        value: betaVersion.configuration.build,
                        icon: "hammer"
                    )

                    InfoRow(
                        title: "Release Date",
                        value: betaVersion.releaseDate.formatted(date: .abbreviated, time: .omitted),
                        icon: "calendar"
                    )

                    InfoRow(
                        title: "Testing Phase",
                        value: betaVersion.configuration.testingPhase.rawValue,
                        icon: "testtube.2"
                    )
                }
            }
        }
        .padding()
        .background(Color.gray.opacity(0.05))
        .cornerRadius(12)
    }

    // MARK: - Features Section

    private var featuresSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Beta Features")
                .font(.headline)

            if let betaVersion = betaManager.betaVersion {
                VStack(spacing: 8) {
                    ForEach(betaVersion.configuration.features, id: \.type) { feature in
                        BetaFeatureRow(
                            feature: feature,
                            onToggle: {
                                betaManager.toggleBetaFeature(feature.type)
                                betaManager.trackBetaEvent(BetaAnalyticsEvent(
                                    name: "beta_feature_toggled",
                                    properties: [
                                        "feature": feature.type.rawValue,
                                        "enabled": !feature.isEnabled
                                    ]
                                ))
                            }
                        )
                    }
                }
            }
        }
        .padding()
        .background(Color.gray.opacity(0.05))
        .cornerRadius(12)
    }

    // MARK: - Feedback Section

    private var feedbackSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Feedback")
                    .font(.headline)

                Spacer()

                Text("\(betaManager.feedbackItems.count) submitted")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            VStack(spacing: 12) {
                Button(action: {
                    showingFeedback = true
                    betaManager.trackBetaEvent(BetaAnalyticsEvent(name: "feedback_button_tapped"))
                }) {
                    HStack {
                        Image(systemName: "plus.message.fill")
                        Text("Submit Feedback")
                    }
                    .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)

                if !betaManager.feedbackItems.isEmpty {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Recent Feedback")
                            .font(.subheadline)
                            .fontWeight(.medium)

                        ForEach(betaManager.feedbackItems.suffix(3).reversed(), id: \.id) { feedback in
                            RecentFeedbackRow(feedback: feedback)
                        }

                        if betaManager.feedbackItems.count > 3 {
                            Text("+ \(betaManager.feedbackItems.count - 3) more items")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }
                }
            }
        }
        .padding()
        .background(Color.gray.opacity(0.05))
        .cornerRadius(12)
    }

    // MARK: - Instructions Section

    private var instructionsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Testing Instructions")
                .font(.headline)

            Button(action: {
                showingInstructions = true
                betaManager.trackBetaEvent(BetaAnalyticsEvent(name: "instructions_viewed"))
            }) {
                HStack {
                    Image(systemName: "doc.text.fill")
                    Text("View Testing Instructions")
                    Spacer()
                    Image(systemName: "chevron.right")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            .buttonStyle(.bordered)

            if let betaVersion = betaManager.betaVersion {
                VStack(alignment: .leading, spacing: 8) {
                    if !betaVersion.newFeatures.isEmpty {
                        Text("New in This Build")
                            .font(.subheadline)
                            .fontWeight(.medium)
                            .foregroundColor(.green)

                        ForEach(Array(betaVersion.newFeatures.enumerated()), id: \.offset) { index, feature in
                            HStack(alignment: .top, spacing: 6) {
                                Text("•")
                                    .foregroundColor(.green)
                                Text(feature)
                                    .font(.caption)
                            }
                        }
                    }

                    if !betaVersion.knownIssues.isEmpty {
                        Text("Known Issues")
                            .font(.subheadline)
                            .fontWeight(.medium)
                            .foregroundColor(.orange)
                            .padding(.top, 8)

                        ForEach(Array(betaVersion.knownIssues.enumerated()), id: \.offset) { index, issue in
                            HStack(alignment: .top, spacing: 6) {
                                Text("•")
                                    .foregroundColor(.orange)
                                Text(issue)
                                    .font(.caption)
                            }
                        }
                    }
                }
            }
        }
        .padding()
        .background(Color.gray.opacity(0.05))
        .cornerRadius(12)
    }

    // MARK: - Not Beta View

    private var notBetaView: some View {
        VStack(spacing: 20) {
            Spacer()

            Image(systemName: "app.badge")
                .font(.system(size: 60))
                .foregroundColor(.blue)

            Text("Release Version")
                .font(.title2)
                .fontWeight(.semibold)

            Text("You're using the release version of Isometry. Beta features are not available.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal)

            Spacer()
        }
    }
}

// MARK: - Supporting Views

struct InfoRow: View {
    let title: String
    let value: String
    let icon: String

    var body: some View {
        HStack {
            Image(systemName: icon)
                .foregroundColor(.blue)
                .frame(width: 20)

            Text(title)
                .font(.subheadline)

            Spacer()

            Text(value)
                .font(.subheadline)
                .fontWeight(.medium)
        }
    }
}

struct BetaFeatureRow: View {
    let feature: BetaFeature
    let onToggle: () -> Void

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                HStack {
                    Text(feature.name)
                        .font(.subheadline)
                        .fontWeight(.medium)

                    if feature.isExperimental {
                        Text("EXPERIMENTAL")
                            .font(.caption2)
                            .fontWeight(.bold)
                            .padding(.horizontal, 4)
                            .padding(.vertical, 1)
                            .background(Color.orange.opacity(0.2))
                            .foregroundColor(.orange)
                            .cornerRadius(3)
                    }
                }

                Text(feature.description)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            Spacer()

            Toggle("", isOn: .constant(feature.isEnabled))
                .labelsHidden()
                .onTapGesture {
                    onToggle()
                }
        }
        .padding()
        .background(feature.isEnabled ? Color.blue.opacity(0.05) : Color.gray.opacity(0.05))
        .cornerRadius(8)
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .stroke(feature.isEnabled ? Color.blue.opacity(0.3) : Color.clear, lineWidth: 1)
        )
    }
}

struct RecentFeedbackRow: View {
    let feedback: BetaFeedback

    var body: some View {
        HStack {
            Image(systemName: feedbackCategoryIcon(feedback.category))
                .foregroundColor(feedback.severity.color)
                .frame(width: 20)

            VStack(alignment: .leading, spacing: 2) {
                Text(feedback.title)
                    .font(.caption)
                    .fontWeight(.medium)
                    .lineLimit(1)

                HStack {
                    Text(feedback.category.rawValue.capitalized)
                        .font(.caption2)
                        .foregroundStyle(.secondary)

                    Text("•")
                        .font(.caption2)
                        .foregroundStyle(.tertiary)

                    Text(feedback.severity.rawValue)
                        .font(.caption2)
                        .foregroundColor(feedback.severity.color)

                    Spacer()

                    Text(feedback.timestamp, style: .relative)
                        .font(.caption2)
                        .foregroundStyle(.tertiary)
                }
            }

            Spacer()

            Image(systemName: statusIcon(feedback.status))
                .foregroundColor(statusColor(feedback.status))
                .font(.caption)
        }
        .padding(8)
        .background(Color.gray.opacity(0.05))
        .cornerRadius(6)
    }

    private func feedbackCategoryIcon(_ category: FeedbackCategory.CategoryType) -> String {
        switch category {
        case .bug: return "ladybug.fill"
        case .performance: return "speedometer"
        case .ui: return "paintbrush.fill"
        case .feature: return "lightbulb.fill"
        case .sync: return "icloud.fill"
        case .general: return "message.fill"
        }
    }

    private func statusIcon(_ status: BetaFeedback.FeedbackStatus) -> String {
        switch status {
        case .pending: return "clock"
        case .sent: return "checkmark.circle"
        case .acknowledged: return "eye.circle"
        case .resolved: return "checkmark.circle.fill"
        }
    }

    private func statusColor(_ status: BetaFeedback.FeedbackStatus) -> Color {
        switch status {
        case .pending: return .orange
        case .sent: return .blue
        case .acknowledged: return .purple
        case .resolved: return .green
        }
    }
}