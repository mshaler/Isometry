import SwiftUI

/// Beta feedback collection interface
public struct BetaFeedbackView: View {
    @StateObject private var betaManager = BetaTestingManager()
    @Environment(\.dismiss) private var dismiss

    @State private var selectedCategory: FeedbackCategory.CategoryType = .general
    @State private var feedbackTitle = ""
    @State private var feedbackDescription = ""
    @State private var selectedSeverity: BetaFeedback.FeedbackSeverity = .medium
    @State private var includeScreenshot = false
    @State private var includeDeviceInfo = true
    @State private var isSubmitting = false
    @State private var showingSuccessMessage = false

    public init() {}

    public var body: some View {
        NavigationView {
            Form {
                categorySection
                detailsSection
                severitySection
                attachmentsSection
                deviceInfoSection
                submitSection
            }
            .navigationTitle("Beta Feedback")
            #if os(iOS)
            #if canImport(UIKit)
.navigationBarTitleDisplayMode(.inline)
#endif
            #endif
            .toolbar {
                #if os(iOS)
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Cancel") {
                        dismiss()
                    }
                }
                #else
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        dismiss()
                    }
                }
                #endif
            }
            .alert("Feedback Sent", isPresented: $showingSuccessMessage) {
                Button("OK") {
                    dismiss()
                }
            } message: {
                Text("Thank you for your feedback! It helps us improve Isometry.")
            }
        }
    }

    // MARK: - Sections

    private var categorySection: some View {
        Section("Feedback Type") {
            if let betaVersion = betaManager.betaVersion {
                Picker("Category", selection: $selectedCategory) {
                    ForEach(betaVersion.configuration.feedbackCategories, id: \.type) { category in
                        HStack {
                            Image(systemName: category.icon)
                                .foregroundColor(.blue)
                            VStack(alignment: .leading, spacing: 2) {
                                Text(category.name)
                                    .font(.subheadline)
                                Text(category.description)
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                        }
                        .tag(category.type)
                    }
                }
                .pickerStyle(.menu)
            }
        }
    }

    private var detailsSection: some View {
        Section("Details") {
            TextField("Summary", text: $feedbackTitle)
                .textFieldStyle(.roundedBorder)

            VStack(alignment: .leading, spacing: 8) {
                Text("Description")
                    .font(.subheadline)
                    .fontWeight(.medium)

                TextEditor(text: $feedbackDescription)
                    .frame(minHeight: 100)
                    .padding(8)
                    .background(Color.gray.opacity(0.1))
                    .cornerRadius(8)

                Text("Please provide as much detail as possible to help us understand and reproduce the issue.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
    }

    private var severitySection: some View {
        Section("Severity") {
            Picker("Severity", selection: $selectedSeverity) {
                ForEach(BetaFeedback.FeedbackSeverity.allCases, id: \.self) { severity in
                    HStack {
                        Image(systemName: severity.icon)
                            .foregroundColor(severity.color)
                        Text(severity.rawValue)
                        Text("- \(severity.description)")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    .tag(severity)
                }
            }
            .pickerStyle(.menu)
        }
    }

    private var attachmentsSection: some View {
        Section("Attachments") {
            Toggle("Include Screenshot", isOn: $includeScreenshot)
                .help("Automatically capture a screenshot to help explain the issue")

            if includeScreenshot {
                Text("A screenshot will be automatically captured when you submit this feedback.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
    }

    private var deviceInfoSection: some View {
        Section("Device Information") {
            Toggle("Include Device Info", isOn: $includeDeviceInfo)
                .help("Include device model, OS version, and app version to help with debugging")

            if includeDeviceInfo {
                VStack(alignment: .leading, spacing: 4) {
                    let deviceInfo = BetaDeviceInfo.current
                    Text("Device: \(deviceInfo.model)")
                    Text("OS: \(deviceInfo.osVersion)")
                    Text("App Version: \(deviceInfo.appVersion) (\(deviceInfo.buildNumber))")
                }
                .font(.caption)
                .foregroundStyle(.secondary)
            }
        }
    }

    private var submitSection: some View {
        Section {
            Button(action: submitFeedback) {
                HStack {
                    if isSubmitting {
                        ProgressView()
                            .scaleEffect(0.8)
                    } else {
                        Image(systemName: "paperplane.fill")
                    }
                    Text(isSubmitting ? "Sending Feedback..." : "Send Feedback")
                }
                .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .disabled(feedbackTitle.isEmpty || feedbackDescription.isEmpty || isSubmitting)
        } footer: {
            VStack(alignment: .leading, spacing: 8) {
                Text("Your feedback helps us improve Isometry. We read every submission and use it to prioritize bug fixes and new features.")

                Text("Privacy: Your feedback is sent securely and is only used for app improvement. No personal data is collected unless specifically included in your description.")
            }
            .font(.caption)
            .foregroundStyle(.secondary)
        }
    }

    // MARK: - Actions

    private func submitFeedback() {
        isSubmitting = true

        Task {
            // Create feedback object
            var attachments: [FeedbackAttachment] = []

            if includeScreenshot {
                // In production, would capture actual screenshot
                attachments.append(FeedbackAttachment(
                    type: .screenshot,
                    data: Data(),
                    filename: "screenshot_\(Date().timeIntervalSince1970).png"
                ))
            }

            let feedback = BetaFeedback(
                category: selectedCategory,
                title: feedbackTitle,
                description: feedbackDescription,
                severity: selectedSeverity,
                attachments: attachments,
                deviceInfo: includeDeviceInfo ? BetaDeviceInfo.current : BetaDeviceInfo(
                    model: "Unknown",
                    osVersion: "Unknown",
                    appVersion: "Unknown",
                    buildNumber: "Unknown",
                    locale: "Unknown",
                    timezone: "Unknown"
                ),
                timestamp: Date()
            )

            // Submit feedback
            betaManager.submitFeedback(feedback)

            // Track analytics event
            betaManager.trackBetaEvent(BetaAnalyticsEvent(
                name: "feedback_submitted",
                properties: [
                    "category": selectedCategory.rawValue,
                    "severity": selectedSeverity.rawValue,
                    "has_screenshot": includeScreenshot,
                    "has_device_info": includeDeviceInfo
                ]
            ))

            // Simulate network delay
            try? await Task.sleep(nanoseconds: 1_500_000_000) // 1.5 seconds

            await MainActor.run {
                isSubmitting = false
                showingSuccessMessage = true
            }
        }
    }
}

// MARK: - Extensions

extension BetaFeedback.FeedbackSeverity {
    var color: Color {
        switch self {
        case .low:
            return .blue
        case .medium:
            return .orange
        case .high:
            return .red
        case .critical:
            return .purple
        }
    }

    var icon: String {
        switch self {
        case .low:
            return "info.circle"
        case .medium:
            return "exclamationmark.triangle"
        case .high:
            return "exclamationmark.triangle.fill"
        case .critical:
            return "exclamationmark.octagon.fill"
        }
    }

    var description: String {
        switch self {
        case .low:
            return "Minor issue or suggestion"
        case .medium:
            return "Noticeable problem that affects usability"
        case .high:
            return "Significant issue that impacts core functionality"
        case .critical:
            return "App crash or data loss"
        }
    }
}