import SwiftUI

/// Performance validation interface for production readiness
public struct PerformanceValidationView: View {
    @StateObject private var validator = PerformanceValidator()
    @State private var isRunningValidation = false
    @State private var showingDetailedResults = false

    public init() {}

    public var body: some View {
        NavigationView {
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    headerSection
                    performanceOverviewSection
                    issuesSection
                    recommendationsSection
                    actionSection
                }
                .padding()
            }
            .navigationTitle("Performance Validation")
            #if os(iOS)
            .navigationBarTitleDisplayMode(.large)
            #endif
            .sheet(isPresented: $showingDetailedResults) {
                PerformanceResultsDetailView(
                    results: validator.performanceResults,
                    issues: validator.performanceIssues
                )
            }
        }
    }

    // MARK: - Header Section

    private var headerSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Image(systemName: "speedometer")
                    .foregroundColor(.blue)
                    .font(.title2)

                VStack(alignment: .leading, spacing: 4) {
                    Text("Performance Validation")
                        .font(.title2)
                        .fontWeight(.semibold)

                    Text("Validate app performance for production release")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }

                Spacer()
            }

            overallPerformanceBadge
        }
    }

    private var overallPerformanceBadge: some View {
        HStack {
            Image(systemName: validator.overallPerformanceStatus.icon)
                .foregroundColor(validator.overallPerformanceStatus.color)
            Text(validator.overallPerformanceStatus.displayText)
                .fontWeight(.medium)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 6)
        .background(validator.overallPerformanceStatus.color.opacity(0.1))
        .foregroundColor(validator.overallPerformanceStatus.color)
        .cornerRadius(8)
        .accessibilityLabel("Performance status: \(validator.overallPerformanceStatus.displayText)")
        .accessibilityValue(validator.overallPerformanceStatus.displayText)
    }

    // MARK: - Performance Overview Section

    private var performanceOverviewSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Performance Areas")
                .font(.headline)
                .accessibilityAddTraits(.isHeader)

            LazyVGrid(columns: [
                GridItem(.adaptive(minimum: 150), spacing: 12),
                GridItem(.adaptive(minimum: 150), spacing: 12)
            ], spacing: 12) {
                PerformanceAreaCard(
                    title: "Launch Time",
                    icon: "timer",
                    status: validator.launchTimeStatus,
                    description: "App startup and initialization speed"
                )

                PerformanceAreaCard(
                    title: "Memory Usage",
                    icon: "memorychip",
                    status: validator.memoryUsageStatus,
                    description: "RAM usage and memory leak detection"
                )

                PerformanceAreaCard(
                    title: "Rendering",
                    icon: "display",
                    status: validator.renderingPerformanceStatus,
                    description: "Frame rate and visual smoothness"
                )

                PerformanceAreaCard(
                    title: "Battery Impact",
                    icon: "battery.100",
                    status: validator.batteryImpactStatus,
                    description: "Energy efficiency and CPU usage"
                )
            }
        }
    }

    // MARK: - Issues Section

    private var issuesSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            if !validator.performanceIssues.isEmpty {
                HStack {
                    Text("Performance Issues")
                        .font(.headline)

                    Spacer()

                    Button("View Details") {
                        showingDetailedResults = true
                    }
                    .buttonStyle(.bordered)
                    .controlSize(.small)
                }

                VStack(spacing: 8) {
                    ForEach(validator.performanceIssues.prefix(3)) { issue in
                        PerformanceIssueRow(issue: issue)
                    }

                    if validator.performanceIssues.count > 3 {
                        Text("+ \(validator.performanceIssues.count - 3) more issues")
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
            if !validator.performanceRecommendations.isEmpty {
                Text("Performance Recommendations")
                    .font(.headline)

                VStack(alignment: .leading, spacing: 8) {
                    ForEach(Array(validator.performanceRecommendations.enumerated()), id: \.offset) { index, recommendation in
                        PerformanceRecommendationRow(
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
            Button(action: startPerformanceValidation) {
                HStack {
                    if isRunningValidation {
                        ProgressView()
                            .scaleEffect(0.8)
                    } else {
                        Image(systemName: "play.circle.fill")
                    }
                    Text(isRunningValidation ? "Running Performance Validation..." : "Run Performance Validation")
                }
                .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .disabled(isRunningValidation)
            .accessibilityLabel(isRunningValidation ? "Performance validation in progress" : "Run performance validation")
            .accessibilityHint(isRunningValidation ? "Please wait while app performance is being validated" : "Tap to start comprehensive performance validation checks")

            if validator.overallPerformanceStatus == .excellent {
                productionReadySection
            }

            // Results log
            if !validator.performanceResults.isEmpty {
                resultsLogSection
            }
        }
    }

    private var productionReadySection: some View {
        VStack(spacing: 12) {
            HStack {
                Image(systemName: "checkmark.seal.fill")
                    .foregroundColor(.green)
                    .font(.title)

                VStack(alignment: .leading, spacing: 4) {
                    Text("Performance Excellent!")
                        .font(.title2)
                        .fontWeight(.semibold)
                        .foregroundColor(.green)

                    Text("App performance meets all production standards")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                Spacer()
            }

            HStack(spacing: 12) {
                Button("Export Performance Report") {
                    exportPerformanceReport()
                }
                .buttonStyle(.bordered)

                Button("Continue to Submission") {
                    continueToSubmission()
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
            Text("Validation Log")
                .font(.subheadline)
                .fontWeight(.medium)

            ScrollView {
                LazyVStack(alignment: .leading, spacing: 4) {
                    ForEach(validator.performanceResults.suffix(10)) { result in
                        PerformanceResultRow(result: result)
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

    private func startPerformanceValidation() {
        isRunningValidation = true

        Task {
            await validator.validatePerformance()
            await MainActor.run {
                isRunningValidation = false
            }
        }
    }

    private func exportPerformanceReport() {
        let report = generatePerformanceReportText()
        #if os(macOS)
        let pasteboard = NSPasteboard.general
        pasteboard.clearContents()
        pasteboard.setString(report, forType: .string)
        #elseif os(iOS)
        UIPasteboard.general.string = report
        #endif
    }

    private func continueToSubmission() {
        // Navigate to App Store submission preparation
    }

    private func generatePerformanceReportText() -> String {
        var report = "# Isometry Performance Validation Report\n\n"
        report += "**Generated:** \(Date().formatted())\n"
        report += "**Overall Status:** \(validator.overallPerformanceStatus.displayText)\n"
        report += "**Version:** Isometry v2.3 Production Readiness\n"
        report += "**Report Type:** Application Performance Validation (60fps Target)\n\n"

        report += "## Performance Areas\n"
        report += "- Launch Time: \(validator.launchTimeStatus.displayText)\n"
        report += "- Memory Usage: \(validator.memoryUsageStatus.displayText)\n"
        report += "- Rendering: \(validator.renderingPerformanceStatus.displayText)\n"
        report += "- Battery Impact: \(validator.batteryImpactStatus.displayText)\n\n"

        if !validator.performanceIssues.isEmpty {
            report += "## Performance Issues\n"
            for issue in validator.performanceIssues {
                report += "- [\(issue.category)] \(issue.description)\n"
            }
            report += "\n"
        }

        if !validator.performanceRecommendations.isEmpty {
            report += "## Recommendations\n"
            for recommendation in validator.performanceRecommendations {
                report += "- \(recommendation)\n"
            }
            report += "\n"
        }

        report += "## Detailed Results\n"
        for result in validator.performanceResults {
            report += "\(result.timestamp.formatted(.dateTime)) - \(result.message)\n"
        }

        report += "\n---\n"
        report += "**Note:** This report validates application performance for 60fps production targets.\n"
        report += "Generated by Isometry v2.3 Production Readiness Infrastructure Verification System.\n"

        return report
    }
}

// MARK: - Supporting Views

struct PerformanceAreaCard: View {
    let title: String
    let icon: String
    let status: PerformanceStatus
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

struct PerformanceIssueRow: View {
    let issue: PerformanceIssue

    var body: some View {
        HStack(alignment: .top, spacing: 8) {
            Image(systemName: issue.severity.icon)
                .foregroundColor(issue.severity.color)
                .font(.caption)
                .frame(width: 16)

            VStack(alignment: .leading, spacing: 2) {
                Text(issue.category.displayText)
                    .font(.caption)
                    .fontWeight(.medium)
                    .foregroundColor(issue.severity.color)

                Text(issue.description)
                    .font(.caption2)
                    .fixedSize(horizontal: false, vertical: true)
            }

            Spacer()
        }
        .padding(8)
        .background(issue.severity.color.opacity(0.1))
        .cornerRadius(6)
    }
}

struct PerformanceRecommendationRow: View {
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

struct PerformanceResultRow: View {
    let result: PerformanceResult

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

extension PerformanceStatus {
    var color: Color {
        switch self {
        case .excellent:
            return .green
        case .good:
            return .blue
        case .acceptable:
            return .orange
        case .poor:
            return .red
        case .inProgress:
            return .purple
        case .notStarted, .unknown:
            return .gray
        }
    }

    var icon: String {
        switch self {
        case .excellent:
            return "star.fill"
        case .good:
            return "checkmark.circle.fill"
        case .acceptable:
            return "exclamationmark.triangle.fill"
        case .poor:
            return "xmark.circle.fill"
        case .inProgress:
            return "progress.indicator"
        case .notStarted, .unknown:
            return "questionmark.circle"
        }
    }

    var displayText: String {
        switch self {
        case .excellent:
            return "Excellent"
        case .good:
            return "Good"
        case .acceptable:
            return "Acceptable"
        case .poor:
            return "Needs Improvement"
        case .inProgress:
            return "Validating..."
        case .notStarted:
            return "Not Started"
        case .unknown:
            return "Unknown"
        }
    }
}

extension PerformanceResultType {
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

extension PerformanceIssueCategory {
    var displayText: String {
        switch self {
        case .launchTime:
            return "Launch Time"
        case .memoryUsage:
            return "Memory Usage"
        case .memoryLeak:
            return "Memory Leak"
        case .renderingPerformance:
            return "Rendering"
        case .frameDrops:
            return "Frame Drops"
        case .batteryImpact:
            return "Battery Impact"
        case .cpuUsage:
            return "CPU Usage"
        }
    }
}

extension PerformanceIssueSeverity {
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