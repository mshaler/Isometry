import SwiftUI
#if os(iOS)
import UIKit
#endif

/// Beta feedback collection interface with enhanced accessibility and screenshot capture
public struct BetaFeedbackView: View {
    @StateObject private var betaManager: BetaTestingManager
    @Environment(\.dismiss) private var dismiss

    @State private var selectedCategory: FeedbackCategory.CategoryType = .general
    @State private var feedbackTitle = ""
    @State private var feedbackDescription = ""
    @State private var selectedSeverity: BetaFeedback.FeedbackSeverity = .medium
    @State private var includeScreenshot = false
    @State private var includeDeviceInfo = true
    @State private var isSubmitting = false
    @State private var showingSuccessMessage = false
    @State private var capturedScreenshot: UIImage?
    #if os(iOS)
    @State private var isCapturingScreenshot = false
    #endif

    public init(betaManager: BetaTestingManager) {
        self._betaManager = StateObject(wrappedValue: betaManager)
    }

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
            .navigationBarTitleDisplayMode(.inline)
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
            VStack(alignment: .leading, spacing: 12) {
                Toggle("Include Screenshot", isOn: $includeScreenshot)
                    .help("Capture a screenshot to help explain the issue")
                    .accessibilityLabel("Include screenshot with feedback")

                if includeScreenshot {
                    HStack {
                        VStack(alignment: .leading, spacing: 4) {
                            if let screenshot = capturedScreenshot {
                                Text("Screenshot captured ✓")
                                    .foregroundStyle(.green)
                                    .font(.caption)
                                Button("Retake Screenshot") {
                                    captureScreenshot()
                                }
                                .font(.caption)
                                .buttonStyle(.borderless)
                            } else {
                                Text("Screenshot will be captured automatically")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)

                                #if os(iOS)
                                Button("Capture Screenshot Now") {
                                    captureScreenshot()
                                }
                                .font(.caption)
                                .buttonStyle(.borderless)
                                .disabled(isCapturingScreenshot)
                                #endif
                            }
                        }

                        Spacer()

                        if let screenshot = capturedScreenshot {
                            #if os(iOS)
                            Image(uiImage: screenshot)
                                .resizable()
                                .aspectRatio(contentMode: .fit)
                                .frame(width: 60, height: 60)
                                .cornerRadius(8)
                                .overlay(
                                    RoundedRectangle(cornerRadius: 8)
                                        .stroke(Color.secondary.opacity(0.3), lineWidth: 1)
                                )
                            #else
                            Rectangle()
                                .fill(Color.secondary.opacity(0.3))
                                .frame(width: 60, height: 60)
                                .cornerRadius(8)
                                .overlay(
                                    Text("Screenshot")
                                        .font(.caption2)
                                        .foregroundStyle(.secondary)
                                )
                            #endif
                        }
                    }
                }
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

    /// Capture screenshot using system APIs
    private func captureScreenshot() {
        #if os(iOS)
        guard !isCapturingScreenshot else { return }
        isCapturingScreenshot = true

        DispatchQueue.main.async {
            // Get the key window
            guard let windowScene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
                  let window = windowScene.windows.first(where: { $0.isKeyWindow }) else {
                self.isCapturingScreenshot = false
                return
            }

            // Capture screenshot
            let renderer = UIGraphicsImageRenderer(size: window.bounds.size)
            let screenshot = renderer.image { context in
                window.drawHierarchy(in: window.bounds, afterScreenUpdates: true)
            }

            self.capturedScreenshot = screenshot
            self.isCapturingScreenshot = false
        }
        #else
        // macOS screenshot capture would use different APIs
        // For now, just set a placeholder
        capturedScreenshot = nil
        #endif
    }

    private func submitFeedback() {
        isSubmitting = true

        Task {
            // Capture screenshot if requested and not already captured
            if includeScreenshot && capturedScreenshot == nil {
                await MainActor.run {
                    captureScreenshot()
                }
                // Wait for screenshot capture to complete
                try? await Task.sleep(nanoseconds: 500_000_000) // 0.5 seconds
            }

            // Create feedback object
            var attachments: [FeedbackAttachment] = []

            if includeScreenshot, let screenshot = capturedScreenshot {
                // Convert screenshot to PNG data
                #if os(iOS)
                if let imageData = screenshot.pngData() {
                    attachments.append(FeedbackAttachment(
                        type: .screenshot,
                        data: imageData,
                        filename: "screenshot_\(Date().timeIntervalSince1970).png"
                    ))
                }
                #else
                // macOS screenshot handling would be different
                let placeholderData = "macOS screenshot placeholder".data(using: .utf8) ?? Data()
                attachments.append(FeedbackAttachment(
                    type: .screenshot,
                    data: placeholderData,
                    filename: "screenshot_\(Date().timeIntervalSince1970).txt"
                ))
                #endif
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