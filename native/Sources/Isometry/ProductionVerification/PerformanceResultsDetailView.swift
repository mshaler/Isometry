import SwiftUI

/// Detailed view of performance validation results and optimization guidance
public struct PerformanceResultsDetailView: View {
    let results: [PerformanceResult]
    let issues: [PerformanceIssue]
    @Environment(\.dismiss) private var dismiss

    public var body: some View {
        NavigationView {
            VStack(alignment: .leading, spacing: 0) {
                if issues.isEmpty {
                    noIssuesView
                } else {
                    issuesListView
                }
            }
            .navigationTitle("Performance Details")
            #if os(iOS)
            #if canImport(UIKit)
.navigationBarTitleDisplayMode(.inline)
#endif
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

    // MARK: - No Issues View

    private var noIssuesView: some View {
        VStack(spacing: 20) {
            Spacer()

            Image(systemName: "star.fill")
                .font(.system(size: 60))
                .foregroundColor(.green)

            Text("Excellent Performance")
                .font(.title2)
                .fontWeight(.semibold)

            Text("Your app meets all performance benchmarks and is ready for production deployment.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal)

            Spacer()

            VStack(spacing: 12) {
                Text("Performance Summary")
                    .font(.headline)

                LazyVStack(spacing: 8) {
                    ForEach(results.suffix(5)) { result in
                        PerformanceResultRow(result: result)
                    }
                }
                .padding()
                .background(Color.green.opacity(0.05))
                .cornerRadius(8)
            }
        }
        .padding()
    }

    // MARK: - Issues List View

    private var issuesListView: some View {
        List {
            summarySection
            issuesByCategory
            optimizationGuidanceSection
            detailedResultsSection
        }
    }

    private var summarySection: some View {
        Section {
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    Image(systemName: "exclamationmark.triangle.fill")
                        .foregroundColor(.orange)
                        .font(.title2)

                    VStack(alignment: .leading, spacing: 2) {
                        Text("\(issues.count) Performance Issue\(issues.count == 1 ? "" : "s") Found")
                            .font(.headline)
                            .foregroundColor(.orange)

                        Text("Address these issues to optimize app performance")
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
            ForEach([PerformanceIssueSeverity.critical, .high, .medium, .low], id: \.self) { severity in
                let count = issues.filter { $0.severity == severity }.count
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

    private var issuesByCategory: some View {
        ForEach([PerformanceIssueCategory.launchTime, .memoryUsage, .memoryLeak, .renderingPerformance, .frameDrops, .batteryImpact, .cpuUsage], id: \.self) { category in
            let categoryIssues = issues.filter { $0.category == category }
            if !categoryIssues.isEmpty {
                Section(header: categoryHeader(category)) {
                    ForEach(categoryIssues) { issue in
                        PerformanceIssueDetailRow(issue: issue)
                    }
                }
            }
        }
    }

    private func categoryHeader(_ category: PerformanceIssueCategory) -> some View {
        HStack {
            Image(systemName: category.icon)
                .foregroundColor(category.color)
            Text(category.displayText)
                .font(.subheadline)
                .fontWeight(.medium)
        }
    }

    private var optimizationGuidanceSection: some View {
        Section("Optimization Guidance") {
            VStack(alignment: .leading, spacing: 12) {
                ForEach(Array(optimizationRecommendations().enumerated()), id: \.offset) { index, recommendation in
                    OptimizationRecommendationRow(
                        priority: recommendation.priority,
                        title: recommendation.title,
                        description: recommendation.description,
                        steps: recommendation.steps
                    )
                }
            }
        }
    }

    private var detailedResultsSection: some View {
        Section("Detailed Validation Log") {
            VStack(alignment: .leading, spacing: 4) {
                ForEach(results.reversed()) { result in
                    PerformanceResultRow(result: result)
                }
            }
            .padding(.vertical, 4)
        }
    }

    // MARK: - Optimization Recommendations

    private func optimizationRecommendations() -> [OptimizationRecommendation] {
        var recommendations: [OptimizationRecommendation] = []

        // Launch time optimization
        if issues.contains(where: { $0.category == .launchTime }) {
            recommendations.append(OptimizationRecommendation(
                priority: .high,
                title: "Optimize App Launch Time",
                description: "Reduce time to first frame and initial user interaction",
                steps: [
                    "Profile launch sequence using Instruments Time Profiler",
                    "Move heavy initialization to background queues",
                    "Implement lazy loading for non-critical components",
                    "Optimize database initialization and CloudKit setup"
                ]
            ))
        }

        // Memory optimization
        if issues.contains(where: { $0.category == .memoryUsage || $0.category == .memoryLeak }) {
            recommendations.append(OptimizationRecommendation(
                priority: .high,
                title: "Optimize Memory Usage",
                description: "Reduce memory footprint and prevent leaks",
                steps: [
                    "Use Instruments Leaks tool to identify memory leaks",
                    "Implement pagination for large datasets",
                    "Add memory pressure handling",
                    "Optimize image loading and caching strategies"
                ]
            ))
        }

        // Rendering optimization
        if issues.contains(where: { $0.category == .renderingPerformance || $0.category == .frameDrops }) {
            recommendations.append(OptimizationRecommendation(
                priority: .medium,
                title: "Improve Rendering Performance",
                description: "Achieve smooth 60 FPS with minimal frame drops",
                steps: [
                    "Profile rendering with Core Animation Instrument",
                    "Implement view recycling for SuperGrid cells",
                    "Reduce visual complexity during animations",
                    "Optimize SwiftUI view hierarchy and update triggers"
                ]
            ))
        }

        // Battery optimization
        if issues.contains(where: { $0.category == .batteryImpact || $0.category == .cpuUsage }) {
            recommendations.append(OptimizationRecommendation(
                priority: .medium,
                title: "Reduce Battery Impact",
                description: "Minimize energy consumption and CPU usage",
                steps: [
                    "Reduce background processing frequency",
                    "Optimize CloudKit sync intervals",
                    "Implement efficient sleep/wake patterns",
                    "Use energy-efficient algorithms for data processing"
                ]
            ))
        }

        return recommendations
    }
}

// MARK: - Supporting Views

struct PerformanceIssueDetailRow: View {
    let issue: PerformanceIssue
    @State private var showingOptimization = false

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            // Issue header
            HStack(alignment: .top) {
                Image(systemName: issue.severity.icon)
                    .foregroundColor(issue.severity.color)
                    .font(.title3)

                VStack(alignment: .leading, spacing: 4) {
                    Text(issue.description)
                        .font(.subheadline)
                        .fixedSize(horizontal: false, vertical: true)

                    HStack {
                        Text(issue.severity.displayText.uppercased())
                            .font(.caption2)
                            .fontWeight(.bold)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(issue.severity.color.opacity(0.2))
                            .foregroundColor(issue.severity.color)
                            .cornerRadius(4)

                        Text("•")
                            .foregroundStyle(.tertiary)

                        Text(issue.timestamp, style: .time)
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    }
                }

                Spacer()
            }

            // Optimization guidance
            if let guidance = optimizationSteps(for: issue) {
                DisclosureGroup(
                    isExpanded: $showingOptimization,
                    content: {
                        VStack(alignment: .leading, spacing: 8) {
                            Text("How to Optimize")
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
                        Text("Optimization Steps")
                            .font(.caption)
                            .fontWeight(.medium)
                            .foregroundColor(.blue)
                    }
                )
            }
        }
        .padding(.vertical, 4)
    }

    private func optimizationSteps(for issue: PerformanceIssue) -> [String]? {
        switch issue.category {
        case .launchTime:
            return [
                "Profile app launch using Instruments Time Profiler",
                "Identify bottlenecks in the main thread",
                "Move heavy operations to background queues",
                "Implement lazy initialization for non-critical components",
                "Optimize database and CloudKit initialization"
            ]

        case .memoryUsage:
            return [
                "Use Instruments Allocations tool to track memory usage",
                "Implement data pagination for large collections",
                "Add memory pressure notifications handling",
                "Optimize image loading and release strategies",
                "Review retain cycles in closures and delegates"
            ]

        case .memoryLeak:
            return [
                "Run Instruments Leaks tool to identify leak sources",
                "Check for retain cycles in closures and completion handlers",
                "Verify delegate patterns use weak references",
                "Review subscription and observer cleanup",
                "Test memory behavior during background/foreground transitions"
            ]

        case .renderingPerformance:
            return [
                "Profile with Core Animation instrument",
                "Identify expensive SwiftUI view updates",
                "Implement view recycling for list/grid components",
                "Reduce view hierarchy complexity",
                "Optimize animation timing and easing"
            ]

        case .frameDrops:
            return [
                "Identify frame drop causes with Time Profiler",
                "Move expensive calculations off the main thread",
                "Implement asynchronous image loading",
                "Reduce view update frequency during animations",
                "Optimize layout calculation complexity"
            ]

        case .batteryImpact:
            return [
                "Profile energy usage with Energy Log instrument",
                "Reduce background processing frequency",
                "Optimize timer and polling intervals",
                "Implement efficient sleep/wake cycles",
                "Use background app refresh judiciously"
            ]

        case .cpuUsage:
            return [
                "Profile CPU usage with Time Profiler",
                "Optimize algorithms for better time complexity",
                "Distribute work across multiple threads efficiently",
                "Implement caching for expensive computations",
                "Reduce polling and real-time update frequency"
            ]
        }
    }
}

struct OptimizationRecommendationRow: View {
    let priority: OptimizationPriority
    let title: String
    let description: String
    let steps: [String]
    @State private var isExpanded = false

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text(title)
                        .font(.subheadline)
                        .fontWeight(.medium)

                    Text(description)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                Spacer()

                Text(priority.displayText)
                    .font(.caption2)
                    .fontWeight(.bold)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(priority.color.opacity(0.2))
                    .foregroundColor(priority.color)
                    .cornerRadius(4)
            }

            if isExpanded {
                VStack(alignment: .leading, spacing: 4) {
                    ForEach(Array(steps.enumerated()), id: \.offset) { index, step in
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
            }

            Button(action: { isExpanded.toggle() }) {
                Text(isExpanded ? "Hide Steps" : "Show Steps")
                    .font(.caption)
                    .foregroundColor(.blue)
            }
        }
        .padding()
        .background(priority.color.opacity(0.05))
        .cornerRadius(8)
    }
}

// MARK: - Supporting Types

struct OptimizationRecommendation {
    let priority: OptimizationPriority
    let title: String
    let description: String
    let steps: [String]
}

enum OptimizationPriority {
    case high
    case medium
    case low

    var displayText: String {
        switch self {
        case .high: return "High Priority"
        case .medium: return "Medium Priority"
        case .low: return "Low Priority"
        }
    }

    var color: Color {
        switch self {
        case .high: return .red
        case .medium: return .orange
        case .low: return .blue
        }
    }
}

// MARK: - Extensions

extension PerformanceIssueCategory {
    var icon: String {
        switch self {
        case .launchTime:
            return "timer"
        case .memoryUsage:
            return "memorychip"
        case .memoryLeak:
            return "drop"
        case .renderingPerformance:
            return "display"
        case .frameDrops:
            return "viewfinder"
        case .batteryImpact:
            return "battery.100"
        case .cpuUsage:
            return "cpu"
        }
    }

    var color: Color {
        switch self {
        case .launchTime:
            return .purple
        case .memoryUsage, .memoryLeak:
            return .red
        case .renderingPerformance, .frameDrops:
            return .blue
        case .batteryImpact, .cpuUsage:
            return .green
        }
    }
}

extension PerformanceIssueSeverity {
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