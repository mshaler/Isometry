import SwiftUI
import Combine

/// Main ETL workflow interface following GSD executor pattern
struct ETLWorkflowView: View {
    @StateObject private var etlManager: ETLOperationManager
    @State private var selectedTemplate: ETLOperationTemplate?
    @State private var showingOperationBuilder = false
    @State private var showingOperationHistory = false
    @State private var selectedCategory: ETLCategory? = nil

    private let database: IsometryDatabase

    init(database: IsometryDatabase) {
        self.database = database
        self._etlManager = StateObject(wrappedValue: ETLOperationManager(
            database: database,
            storageManager: ContentAwareStorageManager(database: database),
            versionManager: ETLVersionManager(database: database)
        ))
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 24) {
                    headerSection
                    activeOperationsSection
                    quickActionsSection
                    operationTemplatesSection
                }
                .padding()
            }
            .navigationTitle("ETL Operations")
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    HStack {
                        Button {
                            showingOperationHistory = true
                        } label: {
                            Image(systemName: "clock.arrow.circlepath")
                        }

                        Button {
                            showingOperationBuilder = true
                        } label: {
                            Image(systemName: "plus.circle")
                        }
                    }
                }
            }
            .sheet(isPresented: $showingOperationBuilder) {
                ETLOperationBuilderView(
                    etlManager: etlManager,
                    database: database,
                    selectedTemplate: selectedTemplate
                )
            }
            .sheet(isPresented: $showingOperationHistory) {
                ETLOperationHistoryView(etlManager: etlManager)
            }
            .refreshable {
                await refreshOperations()
            }
        }
    }

    // MARK: - View Sections

    private var headerSection: some View {
        VStack(spacing: 12) {
            Image(systemName: "arrow.triangle.2.circlepath.circle.fill")
                .font(.system(size: 48))
                .foregroundColor(.blue)

            Text("ETL Operations Center")
                .font(.title2)
                .fontWeight(.semibold)

            Text("Extract, Transform, and Load data with precision")
                .font(.subheadline)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)

            // Status Overview
            HStack(spacing: 20) {
                StatusCard(
                    title: "Active",
                    value: "\(etlManager.currentOperations.count)",
                    color: .blue,
                    systemImage: "play.circle"
                )

                StatusCard(
                    title: "Queued",
                    value: "\(etlManager.queuedOperations.count)",
                    color: .orange,
                    systemImage: "clock"
                )

                StatusCard(
                    title: "Completed",
                    value: "\(etlManager.recentResults.filter { $0.status.isSuccess }.count)",
                    color: .green,
                    systemImage: "checkmark.circle"
                )
            }
        }
        .padding(.vertical)
    }

    @ViewBuilder
    private var activeOperationsSection: some View {
        if !etlManager.currentOperations.isEmpty {
            VStack(alignment: .leading, spacing: 16) {
                Text("Active Operations")
                    .font(.headline)

                ForEach(etlManager.currentOperations) { execution in
                    ActiveOperationCard(
                        execution: execution,
                        onCancel: {
                            Task {
                                await etlManager.cancelOperation(execution.id)
                            }
                        }
                    )
                }
            }
            .padding()
            .background(Color.gray.opacity(0.1))
            .cornerRadius(12)
        }
    }

    private var quickActionsSection: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Quick Actions")
                .font(.headline)

            LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 2), spacing: 12) {
                QuickActionCard(
                    title: "Import Notes",
                    description: "Sync Apple Notes",
                    icon: "note.text",
                    color: .blue,
                    template: .appleNotesImport,
                    onTap: { template in
                        selectedTemplate = template
                        showingOperationBuilder = true
                    }
                )

                QuickActionCard(
                    title: "Import Reminders",
                    description: "Sync Apple Reminders",
                    icon: "checklist",
                    color: .green,
                    template: .appleRemindersImport,
                    onTap: { template in
                        selectedTemplate = template
                        showingOperationBuilder = true
                    }
                )

                QuickActionCard(
                    title: "Full System Import",
                    description: "Import all Apple data",
                    icon: "square.and.arrow.down",
                    color: .purple,
                    template: .fullSystemImport,
                    onTap: { template in
                        selectedTemplate = template
                        showingOperationBuilder = true
                    }
                )

                QuickActionCard(
                    title: "Export Archive",
                    description: "Create complete backup",
                    icon: "square.and.arrow.up",
                    color: .orange,
                    template: .dataExportArchive,
                    onTap: { template in
                        selectedTemplate = template
                        showingOperationBuilder = true
                    }
                )
            }
        }
        .padding()
        .background(Color.gray.opacity(0.1))
        .cornerRadius(12)
    }

    private var operationTemplatesSection: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack {
                Text("All Operations")
                    .font(.headline)

                Spacer()

                // Category Filter
                Menu {
                    Button("All Categories") {
                        selectedCategory = nil
                    }
                    Divider()
                    ForEach(ETLCategory.allCases, id: \.self) { category in
                        Button {
                            selectedCategory = category
                        } label: {
                            HStack {
                                Image(systemName: category.systemImage)
                                Text(category.rawValue)
                            }
                        }
                    }
                } label: {
                    HStack {
                        Text(selectedCategory?.rawValue ?? "All")
                        Image(systemName: "chevron.down")
                    }
                    .font(.subheadline)
                    .foregroundColor(.blue)
                }
            }

            let filteredTemplates = etlManager.getAvailableTemplates().filter { template in
                selectedCategory == nil || template.category == selectedCategory
            }

            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
                ForEach(filteredTemplates, id: \.id) { template in
                    OperationTemplateCard(
                        template: template,
                        onSelect: {
                            selectedTemplate = template
                            showingOperationBuilder = true
                        }
                    )
                }
            }
        }
        .padding()
        .background(Color.gray.opacity(0.1))
        .cornerRadius(12)
    }

    // MARK: - Actions

    private func refreshOperations() async {
        // Refresh operation state
        // The @StateObject will automatically update the UI
    }
}

// MARK: - Supporting Views

struct StatusCard: View {
    let title: String
    let value: String
    let color: Color
    let systemImage: String

    var body: some View {
        VStack(spacing: 8) {
            HStack {
                Image(systemName: systemImage)
                    .foregroundColor(color)
                Text(value)
                    .font(.title2)
                    .fontWeight(.bold)
                    .foregroundColor(color)
            }

            Text(title)
                .font(.caption)
                .foregroundColor(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding()
        .background(color.opacity(0.1))
        .cornerRadius(8)
    }
}

struct ActiveOperationCard: View {
    let execution: ETLOperationExecution
    let onCancel: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                VStack(alignment: .leading) {
                    Text(execution.operation.name)
                        .font(.subheadline)
                        .fontWeight(.medium)

                    Text(execution.currentPhase.displayName)
                        .font(.caption)
                        .foregroundColor(.blue)
                }

                Spacer()

                Button("Cancel") {
                    onCancel()
                }
                .font(.caption)
                .foregroundColor(.red)
            }

            // Progress Bar
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text("Progress")
                        .font(.caption2)
                        .foregroundColor(.secondary)

                    Spacer()

                    Text("\(Int(execution.progress * 100))%")
                        .font(.caption2)
                        .foregroundColor(.secondary)
                }

                ProgressView(value: execution.progress)
                    .progressViewStyle(.linear)
                    .tint(.blue)
            }

            // Phase Indicators
            HStack(spacing: 8) {
                ForEach(ETLPhase.allCases, id: \.self) { phase in
                    PhaseIndicator(
                        phase: phase,
                        isCurrent: phase == execution.currentPhase,
                        isCompleted: ETLPhase.allCases.firstIndex(of: phase)! < ETLPhase.allCases.firstIndex(of: execution.currentPhase)!
                    )
                }
            }
        }
        .padding()
        .background(.ultraThinMaterial)
        .cornerRadius(10)
    }
}

struct PhaseIndicator: View {
    let phase: ETLPhase
    let isCurrent: Bool
    let isCompleted: Bool

    var body: some View {
        VStack(spacing: 2) {
            Image(systemName: phase.systemImage)
                .font(.caption2)
                .foregroundColor(indicatorColor)

            Circle()
                .fill(indicatorColor)
                .frame(width: 6, height: 6)
        }
    }

    private var indicatorColor: Color {
        if isCompleted {
            return .green
        } else if isCurrent {
            return .blue
        } else {
            return .gray
        }
    }
}

struct QuickActionCard: View {
    let title: String
    let description: String
    let icon: String
    let color: Color
    let template: ETLOperationTemplate
    let onTap: (ETLOperationTemplate) -> Void

    var body: some View {
        Button {
            onTap(template)
        } label: {
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    Image(systemName: icon)
                        .font(.title2)
                        .foregroundColor(color)

                    Spacer()

                    ComplexityBadge(complexity: template.complexity)
                }

                VStack(alignment: .leading, spacing: 4) {
                    Text(title)
                        .font(.subheadline)
                        .fontWeight(.medium)
                        .foregroundColor(.primary)

                    Text(description)
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .lineLimit(2)
                }

                Spacer()
            }
            .padding()
            .frame(height: 100)
            .background(.ultraThinMaterial)
            .cornerRadius(10)
        }
        .buttonStyle(.plain)
    }
}

struct OperationTemplateCard: View {
    let template: ETLOperationTemplate
    let onSelect: () -> Void

    var body: some View {
        Button {
            onSelect()
        } label: {
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    Image(systemName: template.category.systemImage)
                        .foregroundColor(.blue)

                    Spacer()

                    ComplexityBadge(complexity: template.complexity)
                }

                VStack(alignment: .leading, spacing: 4) {
                    Text(template.name)
                        .font(.subheadline)
                        .fontWeight(.medium)
                        .foregroundColor(.primary)

                    Text(template.description)
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .lineLimit(3)
                }

                Spacer()

                HStack {
                    Text("\(Int(template.estimatedDuration / 60))m")
                        .font(.caption2)
                        .foregroundColor(.secondary)

                    Spacer()

                    ForEach(template.supportedSources.prefix(3), id: \.self) { source in
                        Image(systemName: source.systemImage)
                            .font(.caption2)
                            .foregroundColor(.secondary)
                    }

                    if template.supportedSources.count > 3 {
                        Text("+\(template.supportedSources.count - 3)")
                            .font(.caption2)
                            .foregroundColor(.secondary)
                    }
                }
            }
            .padding()
            .frame(height: 140)
            .background(.ultraThinMaterial)
            .cornerRadius(10)
        }
        .buttonStyle(.plain)
    }
}

struct ComplexityBadge: View {
    let complexity: ETLComplexity

    var body: some View {
        Text(complexity.rawValue)
            .font(.caption2)
            .fontWeight(.medium)
            .padding(.horizontal, 6)
            .padding(.vertical, 2)
            .background(badgeColor.opacity(0.2))
            .foregroundColor(badgeColor)
            .cornerRadius(4)
    }

    private var badgeColor: Color {
        switch complexity {
        case .simple: return .green
        case .moderate: return .blue
        case .complex: return .orange
        case .advanced: return .red
        }
    }
}

// MARK: - Preview

#Preview {
    ETLWorkflowView(database: try! IsometryDatabase(path: ":memory:"))
}