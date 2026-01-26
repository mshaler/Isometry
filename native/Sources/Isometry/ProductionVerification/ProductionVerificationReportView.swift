import SwiftUI

/// Comprehensive production verification report for human review and App Store submission
public struct ProductionVerificationReportView: View {
    let report: ProductionVerificationReport
    @Environment(\.dismiss) private var dismiss

    public var body: some View {
        NavigationView {
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    summarySection
                    statusBreakdownSection
                    recommendationsSection
                    detailedResultsSection
                    exportSection
                }
                .padding()
            }
            .navigationTitle("Production Verification Report")
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

    // MARK: - Summary Section

    private var summarySection: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Image(systemName: report.isReadyForProduction ? "checkmark.seal.fill" : "exclamationmark.triangle.fill")
                    .foregroundColor(report.isReadyForProduction ? .green : .orange)
                    .font(.title)

                VStack(alignment: .leading, spacing: 4) {
                    Text(report.isReadyForProduction ? "Production Ready" : "Needs Attention")
                        .font(.title2)
                        .fontWeight(.semibold)
                        .foregroundColor(report.isReadyForProduction ? .green : .orange)

                    Text("Verification completed on \(report.timestamp, format: .dateTime)")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                Spacer()
            }

            if report.isReadyForProduction {
                successSummary
            } else {
                issuesSummary
            }
        }
        .padding()
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(report.isReadyForProduction ? Color.green.opacity(0.1) : Color.orange.opacity(0.1))
        )
    }

    private var successSummary: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("🎉 Your Isometry app is ready for production!")
                .font(.subheadline)
                .fontWeight(.medium)

            Text("All CloudKit verification checks have passed. You can proceed with confidence to App Store submission.")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
    }

    private var issuesSummary: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("⚠️ Issues found that need attention")
                .font(.subheadline)
                .fontWeight(.medium)

            Text("\(report.errors.count) issue(s) detected. Please review the recommendations below before proceeding to App Store submission.")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
    }

    // MARK: - Status Breakdown Section

    private var statusBreakdownSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Verification Status")
                .font(.headline)

            LazyVGrid(columns: [
                GridItem(.flexible()),
                GridItem(.flexible())
            ], spacing: 12) {
                VerificationStatusCard(
                    title: "CloudKit Container",
                    status: report.containerStatus.displayStatus,
                    description: containerDescription
                )

                VerificationStatusCard(
                    title: "Schema Deployment",
                    status: report.schemaStatus.displayStatus,
                    description: schemaDescription
                )

                VerificationStatusCard(
                    title: "Permissions",
                    status: report.permissionsStatus.displayStatus,
                    description: permissionsDescription
                )

                VerificationStatusCard(
                    title: "Usage Quota",
                    status: report.quotaStatus.displayStatus,
                    description: quotaDescription
                )
            }
        }
    }

    private var containerDescription: String {
        switch report.containerStatus {
        case .available:
            return "Container is accessible and ready for production use"
        case .noAccount:
            return "iCloud account not configured on device"
        case .restricted:
            return "iCloud access is restricted"
        default:
            return "Container status could not be determined"
        }
    }

    private var schemaDescription: String {
        switch report.schemaStatus {
        case .deployed:
            return "All required record types (Node, ViewConfig, FilterPreset, SyncState) are deployed"
        case .incomplete:
            return "Some record types are missing from the schema"
        default:
            return "Schema deployment status unknown"
        }
    }

    private var permissionsDescription: String {
        switch report.permissionsStatus {
        case .verified:
            return "Read and write permissions verified successfully"
        case .denied:
            return "CloudKit permissions are insufficient"
        default:
            return "Permissions status could not be verified"
        }
    }

    private var quotaDescription: String {
        switch report.quotaStatus {
        case .withinLimits:
            return "CloudKit usage is well within limits"
        case .approaching:
            return "Usage is approaching CloudKit limits"
        case .exceeded:
            return "Usage may exceed CloudKit limits"
        default:
            return "Usage quota could not be determined"
        }
    }

    // MARK: - Recommendations Section

    private var recommendationsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Recommendations")
                .font(.headline)

            if report.recommendations.isEmpty {
                Text("No additional recommendations - your setup looks great!")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .padding()
                    .background(Color.green.opacity(0.1))
                    .cornerRadius(8)
            } else {
                VStack(alignment: .leading, spacing: 8) {
                    ForEach(Array(report.recommendations.enumerated()), id: \.offset) { index, recommendation in
                        RecommendationRow(
                            number: index + 1,
                            text: recommendation,
                            isHighPriority: report.errors.contains { $0.localizedCaseInsensitiveContains(recommendation.components(separatedBy: " ").first ?? "") }
                        )
                    }
                }
            }
        }
    }

    // MARK: - Detailed Results Section

    private var detailedResultsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Detailed Verification Log")
                .font(.headline)

            VStack(alignment: .leading, spacing: 4) {
                ForEach(report.results) { result in
                    DetailedResultRow(result: result)
                }
            }
            .padding()
            .background(Color.gray.opacity(0.05))
            .cornerRadius(8)
        }
    }

    // MARK: - Export Section

    private var exportSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Export Report")
                .font(.headline)

            HStack(spacing: 12) {
                Button(action: exportAsText) {
                    HStack {
                        Image(systemName: "doc.text")
                        Text("Export as Text")
                    }
                }
                .buttonStyle(.bordered)
                .accessibilityLabel("Export verification report as text")
                .accessibilityHint("Copies the verification report to the clipboard as plain text")

                Button(action: shareReport) {
                    HStack {
                        Image(systemName: "square.and.arrow.up")
                        Text("Share Report")
                    }
                }
                .buttonStyle(.bordered)
                .accessibilityLabel("Share verification report")
                .accessibilityHint("Opens share sheet to send the report to stakeholders")

                Spacer()
            }
        }
    }

    // MARK: - Actions

    private func exportAsText() {
        let reportText = generateReportText()
        #if os(macOS)
        let pasteboard = NSPasteboard.general
        pasteboard.clearContents()
        pasteboard.setString(reportText, forType: .string)
        #elseif os(iOS)
        UIPasteboard.general.string = reportText
        #endif
    }

    private func shareReport() {
        let reportText = generateReportText()
        #if os(iOS)
        let activityController = UIActivityViewController(
            activityItems: [reportText],
            applicationActivities: nil
        )
        // Present activity controller
        #endif
    }

    private func generateReportText() -> String {
        var text = "# Isometry Production Verification Report\n\n"
        text += "**Generated:** \(report.timestamp.formatted())\n"
        text += "**Status:** \(report.isReadyForProduction ? "✅ Production Ready" : "⚠️ Needs Attention")\n"
        text += "**Version:** Isometry v2.3 Production Readiness\n"
        text += "**Report Type:** CloudKit Production Infrastructure Verification\n\n"

        text += "## Summary\n"
        text += "- Container: \(report.containerStatus.displayStatus.text)\n"
        text += "- Schema: \(report.schemaStatus.displayStatus.text)\n"
        text += "- Permissions: \(report.permissionsStatus.displayStatus.text)\n"
        text += "- Quota: \(report.quotaStatus.displayStatus.text)\n\n"

        if !report.errors.isEmpty {
            text += "## Issues\n"
            for error in report.errors {
                text += "- \(error)\n"
            }
            text += "\n"
        }

        if !report.recommendations.isEmpty {
            text += "## Recommendations\n"
            for recommendation in report.recommendations {
                text += "- \(recommendation)\n"
            }
            text += "\n"
        }

        text += "## Detailed Log\n"
        for result in report.results {
            text += "\(result.timestamp.formatted(.dateTime.hour().minute().second())) - \(result.message)\n"
        }

        text += "\n---\n"
        text += "**Note:** This report validates CloudKit production infrastructure for App Store submission.\n"
        text += "Generated by Isometry v2.3 Production Readiness Infrastructure Verification System.\n"

        return text
    }
}

// MARK: - Supporting Views

struct VerificationStatusCard: View {
    let title: String
    let status: (color: Color, icon: String, text: String)
    let description: String

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Image(systemName: status.icon)
                    .foregroundColor(status.color)
                    .font(.title3)

                Text(title)
                    .font(.subheadline)
                    .fontWeight(.medium)
            }

            Text(status.text)
                .font(.caption)
                .fontWeight(.medium)
                .foregroundColor(status.color)

            Text(description)
                .font(.caption2)
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding()
        .background(Color.gray.opacity(0.05))
        .cornerRadius(8)
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .stroke(status.color.opacity(0.3), lineWidth: 1)
        )
    }
}

struct RecommendationRow: View {
    let number: Int
    let text: String
    let isHighPriority: Bool

    var body: some View {
        HStack(alignment: .top, spacing: 8) {
            Text("\(number).")
                .font(.caption)
                .fontWeight(.medium)
                .foregroundColor(isHighPriority ? .red : .blue)

            Text(text)
                .font(.caption)
                .fixedSize(horizontal: false, vertical: true)

            if isHighPriority {
                Image(systemName: "exclamationmark.triangle.fill")
                    .foregroundColor(.red)
                    .font(.caption2)
            }
        }
        .padding(8)
        .background(isHighPriority ? Color.red.opacity(0.1) : Color.blue.opacity(0.05))
        .cornerRadius(6)
    }
}

struct DetailedResultRow: View {
    let result: VerificationResult

    var body: some View {
        HStack(alignment: .top, spacing: 8) {
            Text(result.timestamp, format: .dateTime.hour().minute().second())
                .font(.caption2)
                .foregroundStyle(.tertiary)
                .frame(width: 60, alignment: .leading)

            Image(systemName: result.type.icon)
                .foregroundColor(result.type.color)
                .font(.caption)
                .frame(width: 16)

            Text(result.message)
                .font(.caption)
                .fixedSize(horizontal: false, vertical: true)
        }
    }
}