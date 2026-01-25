import SwiftUI

/// Detailed view of App Store compliance violations with resolution guidance
public struct ComplianceViolationsDetailView: View {
    let violations: [ComplianceViolation]
    @Environment(\.dismiss) private var dismiss

    public var body: some View {
        NavigationView {
            VStack(alignment: .leading, spacing: 0) {
                if violations.isEmpty {
                    noViolationsView
                } else {
                    violationsListView
                }
            }
            .navigationTitle("Compliance Issues")
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

    // MARK: - No Violations View

    private var noViolationsView: some View {
        VStack(spacing: 20) {
            Spacer()

            Image(systemName: "checkmark.seal.fill")
                .font(.system(size: 60))
                .foregroundColor(.green)

            Text("No Compliance Issues")
                .font(.title2)
                .fontWeight(.semibold)

            Text("Your app meets all App Store compliance requirements and is ready for submission.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal)

            Spacer()
        }
    }

    // MARK: - Violations List View

    private var violationsListView: some View {
        List {
            summarySection
            violationsByCategory
        }
    }

    private var summarySection: some View {
        Section {
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    Image(systemName: "exclamationmark.triangle.fill")
                        .foregroundColor(.red)
                        .font(.title2)

                    VStack(alignment: .leading, spacing: 2) {
                        Text("\(violations.count) Issue\(violations.count == 1 ? "" : "s") Found")
                            .font(.headline)
                            .foregroundColor(.red)

                        Text("These issues must be resolved before App Store submission")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }

                    Spacer()
                }

                severityBreakdown
            }
            .padding(.vertical, 8)
        }
    }

    private var severityBreakdown: some View {
        HStack(spacing: 16) {
            ForEach(ViolationSeverity.allCases, id: \.self) { severity in
                let count = violations.filter { $0.severity == severity }.count
                if count > 0 {
                    VStack(spacing: 2) {
                        Text("\(count)")
                            .font(.caption)
                            .fontWeight(.bold)
                            .foregroundColor(severity.color)

                        Text(severity.displayText)
                            .font(.caption2)
                            .foregroundColor(severity.color)
                    }
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(severity.color.opacity(0.1))
                    .cornerRadius(6)
                }
            }
        }
    }

    private var violationsByCategory: some View {
        ForEach(ViolationCategory.allCases, id: \.self) { category in
            let categoryViolations = violations.filter { $0.category == category }
            if !categoryViolations.isEmpty {
                Section(header: categoryHeader(category)) {
                    ForEach(categoryViolations) { violation in
                        ViolationDetailRow(violation: violation)
                    }
                }
            }
        }
    }

    private func categoryHeader(_ category: ViolationCategory) -> some View {
        HStack {
            Image(systemName: category.icon)
                .foregroundColor(category.color)
            Text(category.displayText)
                .font(.subheadline)
                .fontWeight(.medium)
        }
    }
}

// MARK: - Violation Detail Row

struct ViolationDetailRow: View {
    let violation: ComplianceViolation
    @State private var showingResolution = false

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            // Violation header
            HStack(alignment: .top) {
                Image(systemName: violation.severity.icon)
                    .foregroundColor(violation.severity.color)
                    .font(.title3)

                VStack(alignment: .leading, spacing: 4) {
                    Text(violation.description)
                        .font(.subheadline)
                        .fixedSize(horizontal: false, vertical: true)

                    HStack {
                        Text(violation.severity.displayText.uppercased())
                            .font(.caption2)
                            .fontWeight(.bold)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(violation.severity.color.opacity(0.2))
                            .foregroundColor(violation.severity.color)
                            .cornerRadius(4)

                        Text("•")
                            .foregroundStyle(.tertiary)

                        Text(violation.timestamp, style: .time)
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    }
                }

                Spacer()
            }

            // Resolution guidance
            if let guidance = resolutionGuidance(for: violation) {
                DisclosureGroup(
                    isExpanded: $showingResolution,
                    content: {
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Resolution Steps")
                                .font(.caption)
                                .fontWeight(.medium)
                                .foregroundColor(.blue)

                            ForEach(Array(guidance.enumerated()), id: \.offset) { index, step in
                                HStack(alignment: .top, spacing: 6) {
                                    Text("\(index + 1).")
                                        .font(.caption2)
                                        .fontWeight(.medium)
                                        .foregroundColor(.blue)

                                    Text(step)
                                        .font(.caption2)
                                        .fixedSize(horizontal: false, vertical: true)
                                }
                            }
                        }
                        .padding(.top, 4)
                    },
                    label: {
                        Text("How to Fix")
                            .font(.caption)
                            .fontWeight(.medium)
                            .foregroundColor(.blue)
                    }
                )
            }
        }
        .padding(.vertical, 4)
    }

    // MARK: - Resolution Guidance

    private func resolutionGuidance(for violation: ComplianceViolation) -> [String]? {
        switch violation.category {
        case .privacy:
            if violation.description.contains("Privacy manifest") {
                return [
                    "Create a PrivacyInfo.xcprivacy file in your app bundle",
                    "Declare any required reason APIs used by your app",
                    "List third-party SDKs and their data collection practices",
                    "Validate the manifest using Xcode's Privacy Report"
                ]
            } else if violation.description.contains("CloudKit") {
                return [
                    "Add NSCloudKitShareInvitationDescription to Info.plist",
                    "Ensure the description explains how users can share data",
                    "Test CloudKit sharing functionality",
                    "Update privacy policy to mention iCloud usage"
                ]
            }

        case .accessibility:
            if violation.description.contains("VoiceOver") {
                return [
                    "Add accessibility labels to all interactive elements",
                    "Test navigation with VoiceOver enabled",
                    "Ensure custom controls have proper accessibility traits",
                    "Provide accessibility hints for complex interactions"
                ]
            } else if violation.description.contains("contrast") {
                return [
                    "Check color contrast ratios using accessibility inspector",
                    "Ensure minimum 4.5:1 contrast for normal text",
                    "Ensure minimum 3:1 contrast for large text",
                    "Test app in high contrast mode"
                ]
            }

        case .technical:
            if violation.description.contains("launch time") {
                return [
                    "Profile app launch using Instruments Time Profiler",
                    "Move heavy initialization to background threads",
                    "Lazy load non-critical components",
                    "Optimize image and data loading"
                ]
            } else if violation.description.contains("memory") {
                return [
                    "Profile memory usage using Instruments Leaks tool",
                    "Implement lazy loading for large datasets",
                    "Add memory pressure handling",
                    "Optimize image caching and data structures"
                ]
            }

        case .content:
            return [
                "Review App Store Review Guidelines section 4.3",
                "Ensure all content is appropriate for declared age rating",
                "Remove any placeholder or test content",
                "Verify all user-generated content has appropriate moderation"
            ]
        }

        return nil
    }
}

// MARK: - Extensions

extension ViolationSeverity: CaseIterable {
    public static var allCases: [ViolationSeverity] = [.critical, .high, .medium, .low]

    var displayText: String {
        switch self {
        case .low:
            return "Low"
        case .medium:
            return "Medium"
        case .high:
            return "High"
        case .critical:
            return "Critical"
        }
    }
}

extension ViolationCategory: CaseIterable {
    public static var allCases: [ViolationCategory] = [.privacy, .accessibility, .content, .technical]

    var icon: String {
        switch self {
        case .privacy:
            return "hand.raised.fill"
        case .accessibility:
            return "accessibility"
        case .content:
            return "doc.text.fill"
        case .technical:
            return "gear.badge.checkmark"
        }
    }

    var color: Color {
        switch self {
        case .privacy:
            return .purple
        case .accessibility:
            return .blue
        case .content:
            return .orange
        case .technical:
            return .green
        }
    }
}