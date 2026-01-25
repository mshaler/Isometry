import SwiftUI

/// Detailed beta testing instructions and guidelines
public struct BetaInstructionsView: View {
    let betaVersion: BetaVersion?
    @Environment(\.dismiss) private var dismiss

    public init(betaVersion: BetaVersion?) {
        self.betaVersion = betaVersion
    }

    public var body: some View {
        NavigationView {
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    headerSection
                    testingFocusSection
                    stepByStepGuide
                    knownIssuesSection
                    feedbackGuidelinesSection
                    contactSection
                }
                .padding()
            }
            .navigationTitle("Beta Testing Guide")
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            #endif
            .toolbar {
                #if os(iOS)
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Done") {
                        dismiss()
                    }
                }
                #else
                ToolbarItem(placement: .primaryAction) {
                    Button("Done") {
                        dismiss()
                    }
                }
                #endif
            }
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
                    Text("Isometry Beta Testing")
                        .font(.title2)
                        .fontWeight(.semibold)

                    if let betaVersion = betaVersion {
                        Text("Version \(betaVersion.configuration.version) (\(betaVersion.configuration.build))")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                }

                Spacer()
            }

            Text("Thank you for participating in the Isometry beta program! Your feedback is invaluable in helping us create the best possible experience.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
        .padding()
        .background(Color.orange.opacity(0.1))
        .cornerRadius(12)
    }

    // MARK: - Testing Focus Section

    private var testingFocusSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("What to Focus On")
                .font(.headline)

            VStack(alignment: .leading, spacing: 12) {
                TestingFocusItem(
                    icon: "grid",
                    title: "SuperGrid Visualization",
                    description: "Test with various dataset sizes and configurations. Pay attention to performance with 100+ and 1000+ items.",
                    priority: .high
                )

                TestingFocusItem(
                    icon: "icloud.and.arrow.up.and.arrow.down",
                    title: "CloudKit Sync",
                    description: "Test syncing between multiple devices. Create, edit, and delete items to verify sync reliability.",
                    priority: .high
                )

                TestingFocusItem(
                    icon: "speedometer",
                    title: "Performance",
                    description: "Monitor app responsiveness, launch time, and battery usage. Report any slowdowns or frame drops.",
                    priority: .medium
                )

                TestingFocusItem(
                    icon: "line.horizontal.3.decrease.circle",
                    title: "Filter System",
                    description: "Test filtering by category, time, priority, and search functionality. Verify filter combinations work correctly.",
                    priority: .medium
                )

                TestingFocusItem(
                    icon: "accessibility",
                    title: "Accessibility",
                    description: "Test with VoiceOver, larger text sizes, and high contrast modes. Ensure all features remain usable.",
                    priority: .low
                )
            }
        }
    }

    // MARK: - Step by Step Guide

    private var stepByStepGuide: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Step-by-Step Testing Guide")
                .font(.headline)

            VStack(alignment: .leading, spacing: 16) {
                TestingStep(
                    number: 1,
                    title: "Initial Setup",
                    description: "Launch the app and complete the onboarding process. Import sample data or connect your own data sources.",
                    estimatedTime: "5 minutes"
                )

                TestingStep(
                    number: 2,
                    title: "Basic Navigation",
                    description: "Explore the SuperGrid view. Try zooming, panning, and switching between different view modes (grid, list, etc.).",
                    estimatedTime: "10 minutes"
                )

                TestingStep(
                    number: 3,
                    title: "Data Management",
                    description: "Create new items, edit existing ones, and organize them into categories. Test the full CRUD lifecycle.",
                    estimatedTime: "15 minutes"
                )

                TestingStep(
                    number: 4,
                    title: "Sync Testing",
                    description: "If you have multiple devices, test syncing. Make changes on one device and verify they appear on others.",
                    estimatedTime: "10 minutes"
                )

                TestingStep(
                    number: 5,
                    title: "Filter & Search",
                    description: "Apply various filters, use the search functionality, and test filter combinations. Clear filters and try again.",
                    estimatedTime: "10 minutes"
                )

                TestingStep(
                    number: 6,
                    title: "Edge Cases",
                    description: "Test with large datasets, poor network conditions, and while switching between apps frequently.",
                    estimatedTime: "15 minutes"
                )
            }
        }
    }

    // MARK: - Known Issues Section

    private var knownIssuesSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Known Issues")
                .font(.headline)

            if let betaVersion = betaVersion, !betaVersion.knownIssues.isEmpty {
                VStack(alignment: .leading, spacing: 8) {
                    ForEach(Array(betaVersion.knownIssues.enumerated()), id: \.offset) { index, issue in
                        HStack(alignment: .top, spacing: 8) {
                            Image(systemName: "exclamationmark.triangle.fill")
                                .foregroundColor(.orange)
                                .font(.caption)

                            Text(issue)
                                .font(.caption)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                    }
                }
                .padding()
                .background(Color.orange.opacity(0.1))
                .cornerRadius(8)
            } else {
                Text("No known issues at this time. If you encounter any problems, please report them using the feedback system.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
        }
    }

    // MARK: - Feedback Guidelines Section

    private var feedbackGuidelinesSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Feedback Guidelines")
                .font(.headline)

            VStack(alignment: .leading, spacing: 12) {
                FeedbackGuideline(
                    icon: "checkmark.circle.fill",
                    title: "Be Specific",
                    description: "Describe exactly what you were doing when the issue occurred. Include step-by-step instructions to reproduce the problem."
                )

                FeedbackGuideline(
                    icon: "camera.fill",
                    title: "Include Screenshots",
                    description: "Screenshots help us understand visual issues quickly. The feedback form can automatically capture screenshots."
                )

                FeedbackGuideline(
                    icon: "info.circle.fill",
                    title: "Provide Context",
                    description: "Include information about your device, what data you were working with, and any relevant settings you had configured."
                )

                FeedbackGuideline(
                    icon: "star.fill",
                    title: "Suggest Improvements",
                    description: "Don't just report problems - tell us what you'd like to see improved or what features would be helpful."
                )
            }

            Text("Quality feedback helps us prioritize fixes and improvements. Every submission is reviewed by our development team.")
                .font(.caption)
                .foregroundStyle(.secondary)
                .padding(.top, 8)
        }
    }

    // MARK: - Contact Section

    private var contactSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Contact & Support")
                .font(.headline)

            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Image(systemName: "message.fill")
                        .foregroundColor(.blue)
                    Text("Use the in-app feedback system for the fastest response")
                        .font(.caption)
                }

                HStack {
                    Image(systemName: "clock.fill")
                        .foregroundColor(.blue)
                    Text("We typically respond to feedback within 24-48 hours")
                        .font(.caption)
                }

                HStack {
                    Image(systemName: "shield.fill")
                        .foregroundColor(.blue)
                    Text("Your feedback and data are kept private and secure")
                        .font(.caption)
                }
            }
            .padding()
            .background(Color.blue.opacity(0.1))
            .cornerRadius(8)
        }
    }
}

// MARK: - Supporting Views

struct TestingFocusItem: View {
    let icon: String
    let title: String
    let description: String
    let priority: TestingPriority

    enum TestingPriority {
        case high, medium, low

        var color: Color {
            switch self {
            case .high: return .red
            case .medium: return .orange
            case .low: return .blue
            }
        }

        var text: String {
            switch self {
            case .high: return "High"
            case .medium: return "Medium"
            case .low: return "Low"
            }
        }
    }

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: icon)
                .foregroundColor(.blue)
                .font(.title3)
                .frame(width: 24)

            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text(title)
                        .font(.subheadline)
                        .fontWeight(.medium)

                    Spacer()

                    Text(priority.text)
                        .font(.caption2)
                        .fontWeight(.bold)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(priority.color.opacity(0.2))
                        .foregroundColor(priority.color)
                        .cornerRadius(4)
                }

                Text(description)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .padding()
        .background(Color.gray.opacity(0.05))
        .cornerRadius(8)
    }
}

struct TestingStep: View {
    let number: Int
    let title: String
    let description: String
    let estimatedTime: String

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Text("\(number)")
                .font(.title3)
                .fontWeight(.bold)
                .foregroundColor(.white)
                .frame(width: 32, height: 32)
                .background(Color.blue)
                .clipShape(Circle())

            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text(title)
                        .font(.subheadline)
                        .fontWeight(.medium)

                    Spacer()

                    Text(estimatedTime)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(Color.gray.opacity(0.1))
                        .cornerRadius(4)
                }

                Text(description)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }
}

struct FeedbackGuideline: View {
    let icon: String
    let title: String
    let description: String

    var body: some View {
        HStack(alignment: .top, spacing: 8) {
            Image(systemName: icon)
                .foregroundColor(.green)
                .font(.caption)

            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.caption)
                    .fontWeight(.medium)

                Text(description)
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }
}