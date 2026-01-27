import SwiftUI
import Charts

/// Version history and lineage viewer for ETL operations
struct ETLVersionHistoryView: View {
    @StateObject private var versionManager: ETLVersionManager
    @State private var selectedStream: String = ""
    @State private var versions: [ETLDataVersion] = []
    @State private var selectedVersions: Set<UUID> = []
    @State private var showingComparison = false
    @State private var showingLineage = false
    @State private var isLoading = false

    private let database: IsometryDatabase

    init(database: IsometryDatabase) {
        self.database = database
        self._versionManager = StateObject(wrappedValue: ETLVersionManager(database: database))
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                streamSelectorSection
                versionTimelineSection
                versionListSection
            }
            .navigationTitle("Version History")
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    HStack {
                        Button {
                            showingLineage = true
                        } label: {
                            Image(systemName: "flowchart")
                        }

                        Button {
                            if selectedVersions.count == 2 {
                                showingComparison = true
                            }
                        } label: {
                            Image(systemName: "arrow.left.arrow.right")
                        }
                        .disabled(selectedVersions.count != 2)
                    }
                }
            }
            .sheet(isPresented: $showingComparison) {
                if selectedVersions.count == 2 {
                    let versionArray = Array(selectedVersions)
                    VersionComparisonView(
                        versionManager: versionManager,
                        fromVersionId: versionArray[0],
                        toVersionId: versionArray[1]
                    )
                }
            }
            .sheet(isPresented: $showingLineage) {
                DataLineageView(database: database, streamId: selectedStream)
            }
        }
        .task {
            await loadVersions()
        }
        .onChange(of: selectedStream) { _, _ in
            Task {
                await loadVersions()
            }
        }
    }

    // MARK: - Stream Selector

    private var streamSelectorSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Data Stream")
                .font(.headline)
                .padding(.horizontal)

            // Stream selector would integrate with ETLDataCatalog
            Menu {
                Button("Apple Notes") { selectedStream = "apple-notes" }
                Button("Apple Reminders") { selectedStream = "apple-reminders" }
                Button("Apple Contacts") { selectedStream = "apple-contacts" }
                Button("Messages") { selectedStream = "messages" }
            } label: {
                HStack {
                    Text(selectedStream.isEmpty ? "Select Stream" : selectedStream)
                        .foregroundColor(selectedStream.isEmpty ? .secondary : .primary)
                    Spacer()
                    Image(systemName: "chevron.down")
                }
                .padding()
                .background(.ultraThinMaterial)
                .cornerRadius(8)
                .padding(.horizontal)
            }
        }
        .padding(.vertical)
        .background(Color(.systemGray6))
    }

    // MARK: - Version Timeline Chart

    private var versionTimelineSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Version Timeline")
                .font(.headline)
                .padding(.horizontal)

            if !versions.isEmpty {
                Chart(versions) { version in
                    PointMark(
                        x: .value("Date", version.createdAt),
                        y: .value("Version", version.versionNumber)
                    )
                    .foregroundStyle(statusColor(for: version.status))
                    .symbolSize(selectedVersions.contains(version.id) ? 100 : 50)
                }
                .frame(height: 150)
                .padding(.horizontal)
                .onTapGesture { location in
                    // Handle tap to select version
                }
            } else {
                EmptyVersionsView()
            }
        }
        .padding(.vertical)
        .background(.ultraThinMaterial)
    }

    // MARK: - Version List

    private var versionListSection: some View {
        List {
            ForEach(versions) { version in
                VersionRowView(
                    version: version,
                    isSelected: selectedVersions.contains(version.id),
                    onToggleSelection: { toggleVersionSelection(version.id) }
                )
            }
        }
        .listStyle(.insetGrouped)
    }

    // MARK: - Actions

    private func loadVersions() async {
        guard !selectedStream.isEmpty else { return }

        isLoading = true
        defer { isLoading = false }

        do {
            versions = try await versionManager.getVersionHistory(for: selectedStream)
        } catch {
            // Handle error
            print("Failed to load versions: \(error)")
        }
    }

    private func toggleVersionSelection(_ versionId: UUID) {
        if selectedVersions.contains(versionId) {
            selectedVersions.remove(versionId)
        } else if selectedVersions.count < 2 {
            selectedVersions.insert(versionId)
        } else {
            // Replace oldest selection
            selectedVersions.removeFirst()
            selectedVersions.insert(versionId)
        }
    }

    private func statusColor(for status: ETLVersionStatus) -> Color {
        switch status {
        case .active: return .green
        case .archived: return .blue
        case .deprecated: return .orange
        case .failed: return .red
        }
    }
}

// MARK: - Supporting Views

struct VersionRowView: View {
    let version: ETLDataVersion
    let isSelected: Bool
    let onToggleSelection: () -> Void

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text("v\(version.versionNumber)")
                        .font(.headline)
                        .fontWeight(.medium)

                    Spacer()

                    StatusBadge(status: version.status)
                }

                Text(version.description)
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                    .lineLimit(2)

                HStack {
                    Text(formatDate(version.createdAt))
                        .font(.caption)
                        .foregroundColor(.secondary)

                    if let operationId = version.createdBy {
                        Text("• ETL \(operationId.uuidString.prefix(8))")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }

                    Spacer()

                    if let nodeCount = version.metadata["nodeCount"] as? Int {
                        Text("\(nodeCount) nodes")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                }
            }

            Spacer()

            if isSelected {
                Image(systemName: "checkmark.circle.fill")
                    .foregroundColor(.blue)
            } else {
                Image(systemName: "circle")
                    .foregroundColor(.secondary)
            }
        }
        .contentShape(Rectangle())
        .onTapGesture {
            onToggleSelection()
        }
    }

    private func formatDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .short
        return formatter.string(from: date)
    }
}

struct StatusBadge: View {
    let status: ETLVersionStatus

    var body: some View {
        Text(status.rawValue.capitalized)
            .font(.caption2)
            .fontWeight(.medium)
            .padding(.horizontal, 6)
            .padding(.vertical, 2)
            .background(backgroundColor)
            .foregroundColor(foregroundColor)
            .cornerRadius(4)
    }

    private var backgroundColor: Color {
        switch status {
        case .active: return .green.opacity(0.2)
        case .archived: return .blue.opacity(0.2)
        case .deprecated: return .orange.opacity(0.2)
        case .failed: return .red.opacity(0.2)
        }
    }

    private var foregroundColor: Color {
        switch status {
        case .active: return .green
        case .archived: return .blue
        case .deprecated: return .orange
        case .failed: return .red
        }
    }
}

struct EmptyVersionsView: View {
    var body: some View {
        VStack(spacing: 12) {
            Image(systemName: "clock.arrow.circlepath")
                .font(.system(size: 48))
                .foregroundColor(.secondary)

            Text("No Version History")
                .font(.headline)
                .foregroundColor(.secondary)

            Text("Select a data stream to view its version history")
                .font(.subheadline)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
        }
        .frame(height: 150)
    }
}

// MARK: - Version Comparison View

struct VersionComparisonView: View {
    let versionManager: ETLVersionManager
    let fromVersionId: UUID
    let toVersionId: UUID

    @State private var versionDiff: ETLVersionDiff?
    @State private var isLoading = true

    var body: some View {
        NavigationStack {
            Group {
                if let diff = versionDiff {
                    VStack(spacing: 20) {
                        versionInfoSection(diff)
                        changesSummarySection(diff)
                        changesDetailSection(diff)
                        Spacer()
                    }
                    .padding()
                } else if isLoading {
                    ProgressView("Comparing versions...")
                } else {
                    VersionErrorView(message: "Failed to compare versions")
                }
            }
            .navigationTitle("Version Comparison")
            .navigationBarTitleDisplayMode(.inline)
            .task {
                await loadVersionDiff()
            }
        }
    }

    private func versionInfoSection(_ diff: ETLVersionDiff) -> some View {
        HStack {
            VersionCompactCard(
                title: "From",
                version: diff.fromVersion,
                color: .blue
            )

            Image(systemName: "arrow.right")
                .font(.title2)
                .foregroundColor(.secondary)

            VersionCompactCard(
                title: "To",
                version: diff.toVersion,
                color: .green
            )
        }
    }

    private func changesSummarySection(_ diff: ETLVersionDiff) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Changes Summary")
                .font(.headline)

            HStack {
                ChangeMetric(
                    label: "Added",
                    count: diff.addedNodes,
                    color: .green,
                    systemImage: "plus.circle"
                )

                ChangeMetric(
                    label: "Modified",
                    count: diff.modifiedNodes,
                    color: .orange,
                    systemImage: "pencil.circle"
                )

                ChangeMetric(
                    label: "Removed",
                    count: diff.removedNodes,
                    color: .red,
                    systemImage: "minus.circle"
                )
            }

            Text("Total Changes: \(diff.totalChanges) (\(String(format: "%.1f", diff.changePercentage))%)")
                .font(.subheadline)
                .foregroundColor(.secondary)
        }
        .padding()
        .background(.ultraThinMaterial)
        .cornerRadius(12)
    }

    private func changesDetailSection(_ diff: ETLVersionDiff) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Detailed Changes")
                .font(.headline)

            // This would show actual node-level differences
            Text("Detailed change tracking would be implemented based on your specific requirements for node-level diff visualization.")
                .font(.subheadline)
                .foregroundColor(.secondary)
                .padding()
                .background(.ultraThinMaterial)
                .cornerRadius(8)
        }
    }

    private func loadVersionDiff() async {
        do {
            versionDiff = try await versionManager.compareVersions(
                from: fromVersionId,
                to: toVersionId
            )
        } catch {
            // Handle error
        }
        isLoading = false
    }
}

struct VersionCompactCard: View {
    let title: String
    let version: ETLDataVersion
    let color: Color

    var body: some View {
        VStack(spacing: 4) {
            Text(title)
                .font(.caption)
                .foregroundColor(.secondary)

            Text("v\(version.versionNumber)")
                .font(.headline)
                .fontWeight(.medium)
                .foregroundColor(color)

            Text(formatDate(version.createdAt))
                .font(.caption2)
                .foregroundColor(.secondary)
        }
        .padding()
        .background(color.opacity(0.1))
        .cornerRadius(8)
    }

    private func formatDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateStyle = .short
        return formatter.string(from: date)
    }
}

struct ChangeMetric: View {
    let label: String
    let count: Int
    let color: Color
    let systemImage: String

    var body: some View {
        VStack(spacing: 4) {
            HStack {
                Image(systemName: systemImage)
                    .foregroundColor(color)
                Text("\(count)")
                    .font(.title2)
                    .fontWeight(.bold)
                    .foregroundColor(color)
            }

            Text(label)
                .font(.caption)
                .foregroundColor(.secondary)
        }
        .frame(maxWidth: .infinity)
    }
}

struct VersionErrorView: View {
    let message: String

    var body: some View {
        VStack(spacing: 12) {
            Image(systemName: "exclamationmark.triangle")
                .font(.system(size: 48))
                .foregroundColor(.orange)

            Text("Error")
                .font(.headline)

            Text(message)
                .font(.subheadline)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
        }
    }
}

// MARK: - Data Lineage View

struct DataLineageView: View {
    let database: IsometryDatabase
    let streamId: String

    @State private var lineageEntries: [ETLLineageEntry] = []
    @State private var isLoading = true

    var body: some View {
        NavigationStack {
            Group {
                if !lineageEntries.isEmpty {
                    List(lineageEntries, id: \.nodeId) { entry in
                        LineageEntryRow(entry: entry)
                    }
                } else if isLoading {
                    ProgressView("Loading lineage...")
                } else {
                    EmptyLineageView()
                }
            }
            .navigationTitle("Data Lineage")
            .navigationBarTitleDisplayMode(.inline)
            .task {
                await loadLineage()
            }
        }
    }

    private func loadLineage() async {
        // This would load lineage for the selected stream
        // Placeholder implementation
        isLoading = false
    }
}

struct LineageEntryRow: View {
    let entry: ETLLineageEntry

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(entry.nodeId)
                .font(.subheadline)
                .fontWeight(.medium)

            Text("\(entry.operationType) from \(entry.sourceSystem)")
                .font(.caption)
                .foregroundColor(.secondary)

            Text(formatDate(entry.timestamp))
                .font(.caption)
                .foregroundColor(.secondary)
        }
    }

    private func formatDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateStyle = .short
        formatter.timeStyle = .short
        return formatter.string(from: date)
    }
}

struct EmptyLineageView: View {
    var body: some View {
        VStack(spacing: 12) {
            Image(systemName: "flowchart.fill")
                .font(.system(size: 48))
                .foregroundColor(.secondary)

            Text("No Lineage Data")
                .font(.headline)
                .foregroundColor(.secondary)

            Text("No lineage information available for this stream")
                .font(.subheadline)
                .foregroundColor(.secondary)
        }
    }
}

#Preview {
    ETLVersionHistoryView(database: try! IsometryDatabase(path: ":memory:"))
}