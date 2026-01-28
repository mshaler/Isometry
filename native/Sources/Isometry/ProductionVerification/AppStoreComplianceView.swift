import SwiftUI

/// App Store compliance verification interface
public struct AppStoreComplianceView: View {
    @StateObject private var verifier = AppStoreComplianceVerifier()
    @State private var isRunningVerification = false
    @State private var showingViolationsDetail = false

    public init() {}

    public var body: some View {
        NavigationView {
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    headerSection
                    complianceOverviewSection
                    violationsSection
                    recommendationsSection
                    actionSection
                }
                .padding()
            }
            .navigationTitle("App Store Compliance")
            .sheet(isPresented: $showingViolationsDetail) {
                ComplianceViolationsDetailView(violations: verifier.violations)
            }
        }
    }

    // MARK: - Header Section

    private var headerSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Image(systemName: "app.badge.checkmark")
                    .foregroundColor(.blue)
                    .font(.title2)

                VStack(alignment: .leading, spacing: 4) {
                    Text("App Store Compliance")
                        .font(.title2)
                        .fontWeight(.semibold)

                    Text("Verify readiness for App Store submission")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }

                Spacer()
            }

            overallStatusBadge
        }
    }

    private var overallStatusBadge: some View {
        HStack {
            Image(systemName: verifier.overallStatus.icon)
                .foregroundColor(verifier.overallStatus.color)
            Text(verifier.overallStatus.displayText)
                .fontWeight(.medium)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 6)
        .background(verifier.overallStatus.color.opacity(0.1))
        .foregroundColor(verifier.overallStatus.color)
        .cornerRadius(8)
        .accessibilityLabel("Compliance status: \(verifier.overallStatus.displayText)")
        .accessibilityValue(verifier.overallStatus.displayText)
    }

    // MARK: - Compliance Overview Section

    private var complianceOverviewSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Compliance Areas")
                .font(.headline)
                .accessibilityAddTraits(.isHeader)

            LazyVGrid(columns: [
                GridItem(.adaptive(minimum: 160), spacing: 12),
                GridItem(.adaptive(minimum: 160), spacing: 12)
            ], spacing: 12) {
                ComplianceAreaCard(
                    title: "Privacy",
                    icon: "hand.raised.fill",
                    status: verifier.privacyComplianceStatus,
                    description: "iOS 17+ privacy requirements, CloudKit compliance"
                )

                ComplianceAreaCard(
                    title: "Accessibility",
                    icon: "accessibility",
                    status: verifier.accessibilityComplianceStatus,
                    description: "WCAG 2.1 AA standards, VoiceOver support"
                )

                ComplianceAreaCard(
                    title: "Content",
                    icon: "doc.text.fill",
                    status: verifier.contentComplianceStatus,
                    description: "Age rating, content guidelines"
                )

                ComplianceAreaCard(
                    title: "Technical",
                    icon: "gear.badge.checkmark",
                    status: verifier.technicalComplianceStatus,
                    description: "Performance, completeness, metadata"
                )
            }
        }
    }

    // MARK: - Violations Section

    private var violationsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            if !verifier.violations.isEmpty {
                HStack {
                    Text("Compliance Issues")
                        .font(.headline)
                        .accessibilityAddTraits(.isHeader)

                    Spacer()

                    Button("View Details") {
                        showingViolationsDetail = true
                    }
                    .buttonStyle(.bordered)
                    .controlSize(.small)
                    .accessibilityLabel("View compliance violations details")
                    .accessibilityHint("Opens detailed view of compliance issues with resolution guidance")
                }

                VStack(spacing: 8) {
                    ForEach(verifier.violations.prefix(3)) { violation in
                        ViolationRow(violation: violation)
                    }

                    if verifier.violations.count > 3 {
                        Text("+ \(verifier.violations.count - 3) more issues")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                            .padding(.vertical, 4)
                    }
                }
            }
        }
    }

    // MARK: - Recommendations Section

    private var recommendationsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            if !verifier.recommendations.isEmpty {
                Text("Recommendations")
                    .font(.headline)

                VStack(alignment: .leading, spacing: 8) {
                    ForEach(Array(verifier.recommendations.enumerated()), id: \.offset) { index, recommendation in
                        AppStoreRecommendationRow(
                            number: index + 1,
                            text: recommendation
                        )
                    }
                }
            }
        }
    }

    // MARK: - Action Section

    private var actionSection: some View {
        VStack(spacing: 16) {
            Button(action: startCompliance) {
                HStack {
                    if isRunningVerification {
                        ProgressView()
                            .scaleEffect(0.8)
                    } else {
                        Image(systemName: "play.circle.fill")
                    }
                    Text(isRunningVerification ? "Running Compliance Check..." : "Run Compliance Verification")
                }
                .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .disabled(isRunningVerification)
            .accessibilityLabel(isRunningVerification ? "Compliance verification in progress" : "Run App Store compliance verification")
            .accessibilityHint(isRunningVerification ? "Please wait while compliance checks are performed" : "Tap to start comprehensive App Store compliance verification")

            if verifier.overallStatus == .compliant {
                appStoreReadySection
            }

            // Results log
            if !verifier.complianceResults.isEmpty {
                resultsLogSection
            }
        }
    }

    private var appStoreReadySection: some View {
        VStack(spacing: 12) {
            HStack {
                Image(systemName: "checkmark.seal.fill")
                    .foregroundColor(.green)
                    .font(.title)

                VStack(alignment: .leading, spacing: 4) {
                    Text("Ready for App Store!")
                        .font(.title2)
                        .fontWeight(.semibold)
                        .foregroundColor(.green)

                    Text("All compliance requirements have been verified")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                Spacer()
            }

            HStack(spacing: 12) {
                Button("Export Compliance Report") {
                    exportComplianceReport()
                }
                .buttonStyle(.bordered)

                Button("Prepare Submission") {
                    prepareAppStoreSubmission()
                }
                .buttonStyle(.borderedProminent)
            }
        }
        .padding()
        .background(Color.green.opacity(0.1))
        .cornerRadius(12)
    }

    private var resultsLogSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Verification Log")
                .font(.subheadline)
                .fontWeight(.medium)

            ScrollView {
                LazyVStack(alignment: .leading, spacing: 4) {
                    ForEach(verifier.complianceResults.suffix(10)) { result in
                        ComplianceResultRow(result: result)
                    }
                }
            }
            .frame(maxHeight: 150)
            .padding(8)
            .background(Color.gray.opacity(0.05))
            .cornerRadius(8)
        }
    }

    // MARK: - Actions

    private func startCompliance() {
        isRunningVerification = true

        Task {
            await verifier.verifyAppStoreCompliance()
            await MainActor.run {
                isRunningVerification = false
            }
        }
    }

    private func exportComplianceReport() {
        // Generate and export compliance report
        let report = generateComplianceReportText()
        #if os(macOS)
        let pasteboard = NSPasteboard.general
        pasteboard.clearContents()
        pasteboard.setString(report, forType: .string)
        #elseif os(iOS)
        UIPasteboard.general.string = report
        #endif
    }

    private func prepareAppStoreSubmission() {
        // Navigate to submission preparation
    }

    private func generateComplianceReportText() -> String {
        var report = "# Isometry App Store Compliance Report\n\n"
        report += "**Generated:** \(Date().formatted())\n"
        report += "**Overall Status:** \(verifier.overallStatus.displayText)\n"
        report += "**Version:** Isometry v2.3 Production Readiness\n"
        report += "**Report Type:** App Store Compliance Verification (WCAG 2.1 AA)\n\n"

        report += "## Compliance Areas\n"
        report += "- Privacy: \(verifier.privacyComplianceStatus.displayText)\n"
        report += "- Accessibility: \(verifier.accessibilityComplianceStatus.displayText)\n"
        report += "- Content: \(verifier.contentComplianceStatus.displayText)\n"
        report += "- Technical: \(verifier.technicalComplianceStatus.displayText)\n\n"

        if !verifier.violations.isEmpty {
            report += "## Issues\n"
            for violation in verifier.violations {
                report += "- [\(violation.category)] \(violation.description)\n"
            }
            report += "\n"
        }

        if !verifier.recommendations.isEmpty {
            report += "## Recommendations\n"
            for recommendation in verifier.recommendations {
                report += "- \(recommendation)\n"
            }
            report += "\n"
        }

        report += "## Detailed Results\n"
        for result in verifier.complianceResults {
            report += "\(result.timestamp.formatted(.dateTime)) - \(result.message)\n"
        }

        report += "\n---\n"
        report += "**Note:** This report validates App Store compliance including WCAG 2.1 AA accessibility standards.\n"
        report += "Generated by Isometry v2.3 Production Readiness Infrastructure Verification System.\n"

        return report
    }
}

// MARK: - Supporting Views

struct ComplianceAreaCard: View {
    let title: String
    let icon: String
    let status: AppStoreComplianceStatus
    let description: String

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Image(systemName: icon)
                    .foregroundColor(.blue)
                    .font(.title3)

                Text(title)
                    .font(.subheadline)
                    .fontWeight(.medium)

                Spacer()

                Image(systemName: status.icon)
                    .foregroundColor(status.color)
                    .font(.caption)
            }

            Text(status.displayText)
                .font(.caption)
                .fontWeight(.medium)
                .foregroundColor(status.color)

            Text(description)
                .font(.caption2)
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding()
        .background(Color.gray.opacity(0.05))
        .cornerRadius(8)
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .stroke(status.color.opacity(0.3), lineWidth: 1)
        )
    }
}

struct ViolationRow: View {
    let violation: ComplianceViolation

    var body: some View {
        HStack(alignment: .top, spacing: 8) {
            Image(systemName: violation.severity.icon)
                .foregroundColor(violation.severity.color)
                .font(.caption)
                .frame(width: 16)

            VStack(alignment: .leading, spacing: 2) {
                Text(violation.category.displayText)
                    .font(.caption)
                    .fontWeight(.medium)
                    .foregroundColor(violation.severity.color)

                Text(violation.description)
                    .font(.caption2)
                    .fixedSize(horizontal: false, vertical: true)
            }

            Spacer()
        }
        .padding(8)
        .background(violation.severity.color.opacity(0.1))
        .cornerRadius(6)
    }
}

struct AppStoreRecommendationRow: View {
    let number: Int
    let text: String

    var body: some View {
        HStack(alignment: .top, spacing: 8) {
            Text("\(number).")
                .font(.caption)
                .fontWeight(.medium)
                .foregroundColor(.blue)
                .frame(width: 16)

            Text(text)
                .font(.caption)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(8)
        .background(Color.blue.opacity(0.05))
        .cornerRadius(6)
    }
}

struct ComplianceResultRow: View {
    let result: ComplianceResult

    var body: some View {
        HStack(alignment: .top, spacing: 6) {
            Text(result.timestamp, format: .dateTime.hour().minute().second())
                .font(.caption2)
                .foregroundStyle(.tertiary)
                .frame(width: 50, alignment: .leading)

            Image(systemName: result.type.icon)
                .foregroundColor(result.type.color)
                .font(.caption2)
                .frame(width: 12)

            Text(result.message)
                .font(.caption2)
                .fixedSize(horizontal: false, vertical: true)
        }
    }
}

// MARK: - Extensions

extension AppStoreComplianceStatus {
    var color: Color {
        switch self {
        case .compliant:
            return .green
        case .warning:
            return .orange
        case .violation:
            return .red
        case .inProgress:
            return .blue
        case .notStarted, .unknown:
            return .gray
        }
    }

    var icon: String {
        switch self {
        case .compliant:
            return "checkmark.circle.fill"
        case .warning:
            return "exclamationmark.triangle.fill"
        case .violation:
            return "xmark.circle.fill"
        case .inProgress:
            return "progress.indicator"
        case .notStarted, .unknown:
            return "questionmark.circle"
        }
    }

    var displayText: String {
        switch self {
        case .compliant:
            return "Compliant"
        case .warning:
            return "Needs Attention"
        case .violation:
            return "Violations Found"
        case .inProgress:
            return "In Progress"
        case .notStarted:
            return "Not Started"
        case .unknown:
            return "Unknown"
        }
    }
}

extension ComplianceResultType {
    var color: Color {
        switch self {
        case .info:
            return .blue
        case .success:
            return .green
        case .warning:
            return .orange
        case .error:
            return .red
        }
    }

    var icon: String {
        switch self {
        case .info:
            return "info.circle"
        case .success:
            return "checkmark.circle.fill"
        case .warning:
            return "exclamationmark.triangle.fill"
        case .error:
            return "xmark.circle.fill"
        }
    }
}

extension ViolationCategory {
    var displayText: String {
        switch self {
        case .privacy:
            return "Privacy"
        case .accessibility:
            return "Accessibility"
        case .content:
            return "Content"
        case .technical:
            return "Technical"
        }
    }
}

extension ViolationSeverity {
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
}