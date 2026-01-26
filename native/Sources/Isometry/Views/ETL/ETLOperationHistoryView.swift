import SwiftUI
import Charts

/// ETL Operation History View with analytics and management
struct ETLOperationHistoryView: View {
    @ObservedObject private var etlManager: ETLOperationManager
    @Environment(\.dismiss) private var dismiss

    @State private var selectedResult: ETLOperationResult?
    @State private var showingDetailSheet = false
    @State private var selectedTimeRange: TimeRange = .week
    @State private var searchText = ""

    init(etlManager: ETLOperationManager) {
        self.etlManager = etlManager
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Analytics Section
                analyticsSection
                    .padding()
                    .background(Color(.systemGray6))

                Divider()

                // History List
                historyListSection
            }
            .navigationTitle("Operation History")
            .navigationBarTitleDisplayMode(.large)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Done") {
                        dismiss()
                    }
                }
            }
            .searchable(text: $searchText, prompt: "Search operations...")
            .sheet(isPresented: $showingDetailSheet) {
                if let result = selectedResult {
                    ETLOperationDetailView(result: result)
                }
            }
        }
    }

    // MARK: - Sections

    private var analyticsSection: some View {
        VStack(spacing: 20) {
            // Time Range Picker
            Picker("Time Range", selection: $selectedTimeRange) {
                ForEach(TimeRange.allCases, id: \.self) { range in
                    Text(range.displayName).tag(range)
                }
            }
            .pickerStyle(.segmented)

            // Quick Stats
            HStack(spacing: 20) {
                StatCard(
                    title: "Total Operations",
                    value: "\(filteredResults.count)",
                    systemImage: "list.bullet",
                    color: .blue
                )

                StatCard(
                    title: "Success Rate",
                    value: "\(Int(successRate * 100))%",
                    systemImage: "checkmark.circle",
                    color: successRate > 0.8 ? .green : .orange
                )

                StatCard(
                    title: "Total Imported",
                    value: "\(totalImportedNodes)",
                    systemImage: "square.and.arrow.down",
                    color: .purple
                )

                StatCard(
                    title: "Avg Duration",
                    value: "\(Int(averageDuration))m",
                    systemImage: "clock",
                    color: .indigo
                )
            }

            // Success Rate Chart
            if !chartData.isEmpty {
                Chart(chartData) { dataPoint in
                    LineMark(
                        x: .value("Date", dataPoint.date),
                        y: .value("Success Rate", dataPoint.successRate)
                    )
                    .foregroundStyle(.blue)
                }
                .frame(height: 100)
                .chartYAxis {
                    AxisMarks(position: .leading) { value in
                        AxisGridLine()
                        AxisValueLabel {
                            Text("\(Int((value.as(Double.self) ?? 0) * 100))%")
                                .font(.caption2)
                        }
                    }
                }
                .chartXAxis {
                    AxisMarks(position: .bottom) { value in
                        AxisGridLine()
                        AxisValueLabel(format: .dateTime.day())
                    }
                }
                .padding(.top)
            }
        }
    }

    private var historyListSection: some View {
        List {
            ForEach(filteredResults) { result in
                OperationResultRow(
                    result: result,
                    onTap: {
                        selectedResult = result
                        showingDetailSheet = true
                    }
                )
            }
        }
        .listStyle(.plain)
    }

    // MARK: - Computed Properties

    private var filteredResults: [ETLOperationResult] {
        let timeFilteredResults = etlManager.recentResults.filter { result in
            let cutoffDate = Calendar.current.date(byAdding: selectedTimeRange.calendarComponent, value: -selectedTimeRange.value, to: Date()) ?? Date()
            return result.completedAt >= cutoffDate
        }

        if searchText.isEmpty {
            return timeFilteredResults.sorted { $0.completedAt > $1.completedAt }
        } else {
            return timeFilteredResults.filter { result in
                result.operation.name.localizedCaseInsensitiveContains(searchText) ||
                result.operation.template.description.localizedCaseInsensitiveContains(searchText)
            }.sorted { $0.completedAt > $1.completedAt }
        }
    }

    private var successRate: Double {
        let results = filteredResults
        guard !results.isEmpty else { return 0.0 }

        let successfulOperations = results.filter { $0.status.isSuccess }.count
        return Double(successfulOperations) / Double(results.count)
    }

    private var totalImportedNodes: Int {
        filteredResults.reduce(0) { $0 + $1.importedNodes.count }
    }

    private var averageDuration: Double {
        let results = filteredResults
        guard !results.isEmpty else { return 0.0 }

        let totalDuration = results.reduce(0.0) { $0 + $1.totalDuration }
        return (totalDuration / Double(results.count)) / 60 // Convert to minutes
    }

    private var chartData: [ChartDataPoint] {
        let calendar = Calendar.current
        let endDate = Date()
        let startDate = calendar.date(byAdding: selectedTimeRange.calendarComponent, value: -selectedTimeRange.value, to: endDate) ?? endDate

        var dataPoints: [ChartDataPoint] = []
        var currentDate = startDate

        while currentDate <= endDate {
            let dayResults = etlManager.recentResults.filter { result in
                calendar.isDate(result.completedAt, inSameDayAs: currentDate)
            }

            let successRate = dayResults.isEmpty ? 0.0 : (Double(dayResults.filter { $0.status.isSuccess }.count) / Double(dayResults.count))

            dataPoints.append(ChartDataPoint(date: currentDate, successRate: successRate))
            currentDate = calendar.date(byAdding: .day, value: 1, to: currentDate) ?? endDate
        }

        return dataPoints
    }
}

// MARK: - Supporting Views

struct StatCard: View {
    let title: String
    let value: String
    let systemImage: String
    let color: Color

    var body: some View {
        VStack(spacing: 8) {
            Image(systemName: systemImage)
                .font(.title2)
                .foregroundColor(color)

            Text(value)
                .font(.title3)
                .fontWeight(.semibold)

            Text(title)
                .font(.caption2)
                .foregroundColor(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding()
        .background(.ultraThinMaterial)
        .cornerRadius(8)
    }
}

struct OperationResultRow: View {
    let result: ETLOperationResult
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: 12) {
                // Status Indicator
                statusIcon
                    .frame(width: 24)

                VStack(alignment: .leading, spacing: 4) {
                    Text(result.operation.name)
                        .font(.subheadline)
                        .fontWeight(.medium)
                        .foregroundColor(.primary)

                    HStack(spacing: 8) {
                        Text(formatDuration(result.totalDuration))
                            .font(.caption)
                            .foregroundColor(.secondary)

                        Text("•")
                            .font(.caption)
                            .foregroundColor(.secondary)

                        Text("\(result.importedNodes.count) imported")
                            .font(.caption)
                            .foregroundColor(.secondary)

                        if !result.errors.isEmpty {
                            Text("•")
                                .font(.caption)
                                .foregroundColor(.secondary)

                            Text("\(result.errors.count) errors")
                                .font(.caption)
                                .foregroundColor(.red)
                        }
                    }

                    Text(RelativeDateTimeFormatter().localizedString(for: result.completedAt, relativeTo: Date()))
                        .font(.caption2)
                        .foregroundColor(.secondary)
                }

                Spacer()

                // Success Rate Circle
                SuccessRateCircle(rate: result.successRate)
            }
            .padding(.vertical, 8)
        }
        .buttonStyle(.plain)
    }

    private var statusIcon: some View {
        Group {
            switch result.status {
            case .success:
                Image(systemName: "checkmark.circle.fill")
                    .foregroundColor(.green)
            case .partialSuccess:
                Image(systemName: "exclamationmark.circle.fill")
                    .foregroundColor(.orange)
            case .failed:
                Image(systemName: "xmark.circle.fill")
                    .foregroundColor(.red)
            }
        }
        .font(.title3)
    }

    private func formatDuration(_ duration: TimeInterval) -> String {
        let minutes = Int(duration / 60)
        let seconds = Int(duration.truncatingRemainder(dividingBy: 60))

        if minutes > 0 {
            return "\(minutes)m \(seconds)s"
        } else {
            return "\(seconds)s"
        }
    }
}

struct SuccessRateCircle: View {
    let rate: Double

    var body: some View {
        ZStack {
            Circle()
                .stroke(Color.gray.opacity(0.3), lineWidth: 3)

            Circle()
                .trim(from: 0, to: rate)
                .stroke(rateColor, style: StrokeStyle(lineWidth: 3, lineCap: .round))
                .rotationEffect(.degrees(-90))

            Text("\(Int(rate * 100))%")
                .font(.caption2)
                .fontWeight(.medium)
                .foregroundColor(rateColor)
        }
        .frame(width: 32, height: 32)
    }

    private var rateColor: Color {
        if rate >= 0.9 {
            return .green
        } else if rate >= 0.7 {
            return .orange
        } else {
            return .red
        }
    }
}

// MARK: - Operation Detail View

struct ETLOperationDetailView: View {
    let result: ETLOperationResult
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    // Header
                    operationHeaderSection

                    // Metrics
                    metricsSection

                    // Timeline
                    timelineSection

                    // Errors (if any)
                    if !result.errors.isEmpty {
                        errorsSection
                    }

                    // Imported Nodes
                    importedNodesSection
                }
                .padding()
            }
            .navigationTitle("Operation Details")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Done") {
                        dismiss()
                    }
                }
            }
        }
    }

    private var operationHeaderSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                statusBadge
                Spacer()
                ComplexityBadge(complexity: result.operation.template.complexity)
            }

            Text(result.operation.name)
                .font(.title2)
                .fontWeight(.semibold)

            Text(result.operation.template.description)
                .font(.subheadline)
                .foregroundColor(.secondary)

            HStack(spacing: 16) {
                Label(
                    formatDateTime(result.startedAt),
                    systemImage: "play.circle"
                )
                .font(.caption)

                Label(
                    formatDateTime(result.completedAt),
                    systemImage: "checkmark.circle"
                )
                .font(.caption)
            }
            .foregroundColor(.secondary)
        }
    }

    private var statusBadge: some View {
        Group {
            switch result.status {
            case .success:
                Label("Success", systemImage: "checkmark.circle.fill")
                    .foregroundColor(.green)
            case .partialSuccess:
                Label("Partial Success", systemImage: "exclamationmark.circle.fill")
                    .foregroundColor(.orange)
            case .failed(let error):
                Label("Failed", systemImage: "xmark.circle.fill")
                    .foregroundColor(.red)
            }
        }
        .font(.caption)
        .padding(.horizontal, 12)
        .padding(.vertical, 6)
        .background(.ultraThinMaterial)
        .cornerRadius(16)
    }

    private var metricsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Metrics")
                .font(.headline)

            HStack(spacing: 16) {
                MetricCard(
                    title: "Duration",
                    value: formatDuration(result.totalDuration),
                    icon: "clock",
                    color: .blue
                )

                MetricCard(
                    title: "Processed",
                    value: "\(result.processedItems)",
                    icon: "list.bullet",
                    color: .indigo
                )

                MetricCard(
                    title: "Imported",
                    value: "\(result.importedNodes.count)",
                    icon: "square.and.arrow.down",
                    color: .green
                )

                MetricCard(
                    title: "Errors",
                    value: "\(result.errors.count)",
                    icon: "exclamationmark.triangle",
                    color: .red
                )
            }

            // Success Rate Progress Bar
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text("Success Rate")
                        .font(.subheadline)
                        .fontWeight(.medium)

                    Spacer()

                    Text("\(Int(result.successRate * 100))%")
                        .font(.subheadline)
                        .fontWeight(.semibold)
                        .foregroundColor(result.successRate > 0.8 ? .green : .orange)
                }

                ProgressView(value: result.successRate)
                    .progressViewStyle(.linear)
                    .tint(result.successRate > 0.8 ? .green : .orange)
            }
        }
    }

    private var timelineSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Timeline")
                .font(.headline)

            VStack(alignment: .leading, spacing: 8) {
                TimelineItem(
                    title: "Operation Started",
                    time: formatTime(result.startedAt),
                    isCompleted: true
                )

                TimelineItem(
                    title: "Processing Completed",
                    time: formatTime(result.completedAt),
                    isCompleted: true
                )

                TimelineItem(
                    title: "Total Duration",
                    time: formatDuration(result.totalDuration),
                    isCompleted: true,
                    isLast: true
                )
            }
            .padding(.leading, 8)
        }
    }

    @ViewBuilder
    private var errorsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Errors (\(result.errors.count))")
                .font(.headline)
                .foregroundColor(.red)

            VStack(alignment: .leading, spacing: 8) {
                ForEach(Array(result.errors.enumerated()), id: \.offset) { index, error in
                    ErrorRow(index: index + 1, error: error)
                }
            }
        }
    }

    private var importedNodesSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Imported Nodes (\(result.importedNodes.count))")
                .font(.headline)

            if result.importedNodes.isEmpty {
                Text("No nodes were imported in this operation.")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                    .frame(maxWidth: .infinity, alignment: .center)
                    .padding()
            } else {
                LazyVStack(alignment: .leading, spacing: 8) {
                    ForEach(result.importedNodes.prefix(10), id: \.id) { node in
                        NodeSummaryRow(node: node)
                    }

                    if result.importedNodes.count > 10 {
                        Text("And \(result.importedNodes.count - 10) more nodes...")
                            .font(.caption)
                            .foregroundColor(.secondary)
                            .padding(.top, 4)
                    }
                }
            }
        }
    }

    private func formatDateTime(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .short
        return formatter.string(from: date)
    }

    private func formatTime(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.timeStyle = .medium
        return formatter.string(from: date)
    }

    private func formatDuration(_ duration: TimeInterval) -> String {
        let minutes = Int(duration / 60)
        let seconds = Int(duration.truncatingRemainder(dividingBy: 60))

        if minutes > 0 {
            return "\(minutes)m \(seconds)s"
        } else {
            return "\(seconds)s"
        }
    }
}

// MARK: - Detail Supporting Views

struct MetricCard: View {
    let title: String
    let value: String
    let icon: String
    let color: Color

    var body: some View {
        VStack(spacing: 4) {
            Image(systemName: icon)
                .font(.caption)
                .foregroundColor(color)

            Text(value)
                .font(.subheadline)
                .fontWeight(.semibold)

            Text(title)
                .font(.caption2)
                .foregroundColor(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding()
        .background(.ultraThinMaterial)
        .cornerRadius(8)
    }
}

struct TimelineItem: View {
    let title: String
    let time: String
    let isCompleted: Bool
    var isLast = false

    var body: some View {
        HStack(spacing: 12) {
            VStack(spacing: 0) {
                Circle()
                    .fill(isCompleted ? Color.green : Color.gray)
                    .frame(width: 8, height: 8)

                if !isLast {
                    Rectangle()
                        .fill(Color.gray.opacity(0.3))
                        .frame(width: 1, height: 24)
                }
            }

            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.subheadline)
                    .fontWeight(.medium)

                Text(time)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }

            Spacer()
        }
    }
}

struct ErrorRow: View {
    let index: Int
    let error: Error

    var body: some View {
        HStack(alignment: .top, spacing: 8) {
            Text("\(index).")
                .font(.caption)
                .foregroundColor(.red)
                .fontWeight(.medium)

            Text(error.localizedDescription)
                .font(.caption)
                .foregroundColor(.red)

            Spacer()
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .background(Color.red.opacity(0.1))
        .cornerRadius(6)
    }
}

struct NodeSummaryRow: View {
    let node: Node

    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: nodeTypeIcon(node.nodeType))
                .font(.caption)
                .foregroundColor(.blue)
                .frame(width: 16)

            Text(node.name)
                .font(.caption)
                .lineLimit(1)

            Spacer()

            if let folder = node.folder {
                Text(folder)
                    .font(.caption2)
                    .foregroundColor(.secondary)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(Color.gray.opacity(0.2))
                    .cornerRadius(4)
            }
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(.ultraThinMaterial)
        .cornerRadius(4)
    }

    private func nodeTypeIcon(_ nodeType: String) -> String {
        switch nodeType {
        case "note": return "note.text"
        case "task": return "checklist"
        case "event": return "calendar"
        case "person": return "person.crop.circle"
        case "bookmark": return "bookmark"
        case "article": return "doc.text"
        default: return "doc"
        }
    }
}

// MARK: - Supporting Types

enum TimeRange: CaseIterable {
    case day
    case week
    case month
    case quarter

    var displayName: String {
        switch self {
        case .day: return "24h"
        case .week: return "7d"
        case .month: return "30d"
        case .quarter: return "90d"
        }
    }

    var value: Int {
        switch self {
        case .day: return 1
        case .week: return 7
        case .month: return 30
        case .quarter: return 90
        }
    }

    var calendarComponent: Calendar.Component {
        switch self {
        case .day, .week, .month, .quarter: return .day
        }
    }
}

struct ChartDataPoint: Identifiable {
    let id = UUID()
    let date: Date
    let successRate: Double
}

// MARK: - Preview

#Preview {
    ETLOperationHistoryView(
        etlManager: ETLOperationManager(database: try! IsometryDatabase(path: ":memory:"))
    )
}