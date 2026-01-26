import SwiftUI

/// ETL Operation Builder - Configure and create new ETL operations
struct ETLOperationBuilderView: View {
    @ObservedObject private var etlManager: ETLOperationManager
    @Environment(\.dismiss) private var dismiss

    private let database: IsometryDatabase
    @State private var selectedTemplate: ETLOperationTemplate
    @State private var configuration: ETLOperationConfiguration
    @State private var isCreatingOperation = false
    @State private var validationErrors: [String] = []

    init(
        etlManager: ETLOperationManager,
        database: IsometryDatabase,
        selectedTemplate: ETLOperationTemplate? = nil
    ) {
        self.etlManager = etlManager
        self.database = database
        let template = selectedTemplate ?? ETLOperationTemplate.allTemplates.first!
        self._selectedTemplate = State(initialValue: template)
        self._configuration = State(initialValue: template.defaultConfiguration)
    }

    var body: some View {
        NavigationStack {
            Form {
                templateSelectionSection
                configurationSection
                permissionsSection
                validationSection
            }
            .navigationTitle("Create Operation")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Cancel") {
                        dismiss()
                    }
                }

                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Create") {
                        Task {
                            await createOperation()
                        }
                    }
                    .disabled(!isValidConfiguration || isCreatingOperation)
                }
            }
            .onChange(of: selectedTemplate) { _, newTemplate in
                configuration = newTemplate.defaultConfiguration
                validateConfiguration()
            }
            .onChange(of: configuration) { _, _ in
                validateConfiguration()
            }
        }
    }

    // MARK: - Sections

    private var templateSelectionSection: some View {
        Section {
            Picker("Operation Type", selection: $selectedTemplate) {
                ForEach(ETLOperationTemplate.allTemplates, id: \.id) { template in
                    VStack(alignment: .leading) {
                        Text(template.name)
                            .tag(template)
                        Text(template.description)
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                }
            }
            .pickerStyle(.navigationLink)

            TemplateInfoCard(template: selectedTemplate)
        } header: {
            Text("Operation Template")
        }
    }

    private var configurationSection: some View {
        Section {
            // Data Sources
            VStack(alignment: .leading, spacing: 12) {
                Text("Data Sources")
                    .font(.subheadline)
                    .fontWeight(.medium)

                LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 2), spacing: 8) {
                    ForEach(selectedTemplate.supportedSources, id: \.self) { source in
                        SourceToggle(
                            source: source,
                            isEnabled: configuration.enabledSources.contains(source)
                        ) { enabled in
                            if enabled {
                                if !configuration.enabledSources.contains(source) {
                                    configuration.enabledSources.append(source)
                                }
                            } else {
                                configuration.enabledSources.removeAll { $0 == source }
                            }
                        }
                    }
                }
            }

            // Batch Size
            HStack {
                Text("Batch Size")
                Spacer()
                TextField("Batch Size", value: $configuration.batchSize, format: .number)
                    .textFieldStyle(.roundedBorder)
                    .frame(width: 100)
                    .keyboardType(.numberPad)
            }

            // Output Folder
            HStack {
                Text("Output Folder")
                Spacer()
                TextField("Optional", text: Binding(
                    get: { configuration.outputFolder ?? "" },
                    set: { configuration.outputFolder = $0.isEmpty ? nil : $0 }
                ))
                .textFieldStyle(.roundedBorder)
                .frame(width: 150)
            }

            // Options
            Toggle("Preserve Metadata", isOn: $configuration.preserveMetadata)
            Toggle("Enable Deduplication", isOn: $configuration.enableDeduplication)

            // Date Range (if applicable)
            if selectedTemplate.category == .import {
                DateRangeSelector(dateRange: $configuration.dateRange)
            }

        } header: {
            Text("Configuration")
        }
    }

    private var permissionsSection: some View {
        Section {
            ForEach(selectedTemplate.requiredPermissions, id: \.self) { permission in
                HStack {
                    Image(systemName: permission.systemImage)
                        .foregroundColor(.blue)
                        .frame(width: 24)

                    VStack(alignment: .leading) {
                        Text(permission.rawValue)
                            .font(.subheadline)
                        Text(permissionDescription(for: permission))
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }

                    Spacer()

                    PermissionStatusIndicator(permission: permission)
                }
                .padding(.vertical, 4)
            }
        } header: {
            Text("Required Permissions")
        } footer: {
            Text("Grant these permissions in System Preferences for the operation to succeed.")
        }
    }

    @ViewBuilder
    private var validationSection: some View {
        if !validationErrors.isEmpty {
            Section {
                ForEach(validationErrors, id: \.self) { error in
                    HStack {
                        Image(systemName: "exclamationmark.triangle")
                            .foregroundColor(.orange)
                        Text(error)
                            .font(.caption)
                    }
                }
            } header: {
                Text("Validation Issues")
            }
        }
    }

    // MARK: - Computed Properties

    private var isValidConfiguration: Bool {
        validationErrors.isEmpty && !configuration.enabledSources.isEmpty
    }

    // MARK: - Actions

    private func createOperation() async {
        isCreatingOperation = true
        defer { isCreatingOperation = false }

        let operation = etlManager.createOperation(from: selectedTemplate)
        var updatedOperation = operation
        updatedOperation.configuration = configuration

        await etlManager.queueOperation(updatedOperation)
        dismiss()
    }

    private func validateConfiguration() {
        validationErrors.removeAll()

        if configuration.enabledSources.isEmpty {
            validationErrors.append("At least one data source must be enabled")
        }

        if configuration.batchSize <= 0 {
            validationErrors.append("Batch size must be greater than 0")
        }

        if configuration.batchSize > 2000 {
            validationErrors.append("Batch size should not exceed 2000 for performance")
        }

        // Validate date range if set
        if let dateRange = configuration.dateRange {
            if dateRange.start > dateRange.end {
                validationErrors.append("Start date must be before end date")
            }

            if dateRange.start > Date() {
                validationErrors.append("Start date cannot be in the future")
            }
        }
    }

    private func permissionDescription(for permission: ETLPermission) -> String {
        switch permission {
        case .notes:
            return "Access to Apple Notes database for importing notes and attachments"
        case .reminders:
            return "Access to Apple Reminders for importing tasks and lists"
        case .calendar:
            return "Access to Apple Calendar for importing events and calendars"
        case .contacts:
            return "Access to Apple Contacts for importing contact information"
        case .fileSystem:
            return "Access to selected folders for importing files"
        case .network:
            return "Network access for cloud synchronization"
        case .fullDiskAccess:
            return "Full disk access for direct database access"
        }
    }
}

// MARK: - Supporting Views

struct TemplateInfoCard: View {
    let template: ETLOperationTemplate

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                VStack(alignment: .leading) {
                    Text(template.name)
                        .font(.subheadline)
                        .fontWeight(.medium)

                    Text(template.description)
                        .font(.caption)
                        .foregroundColor(.secondary)
                }

                Spacer()

                ComplexityBadge(complexity: template.complexity)
            }

            HStack(spacing: 16) {
                InfoPill(
                    icon: "clock",
                    text: "\(Int(template.estimatedDuration / 60))m",
                    color: .blue
                )

                InfoPill(
                    icon: template.category.systemImage,
                    text: template.category.rawValue,
                    color: .green
                )

                InfoPill(
                    icon: "list.bullet",
                    text: "\(template.supportedSources.count) sources",
                    color: .orange
                )
            }
        }
        .padding()
        .background(.ultraThinMaterial)
        .cornerRadius(8)
    }
}

struct InfoPill: View {
    let icon: String
    let text: String
    let color: Color

    var body: some View {
        HStack(spacing: 4) {
            Image(systemName: icon)
                .font(.caption2)
            Text(text)
                .font(.caption2)
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(color.opacity(0.1))
        .foregroundColor(color)
        .cornerRadius(12)
    }
}

struct SourceToggle: View {
    let source: ETLSourceType
    let isEnabled: Bool
    let onToggle: (Bool) -> Void

    var body: some View {
        Button {
            onToggle(!isEnabled)
        } label: {
            HStack(spacing: 8) {
                Image(systemName: source.systemImage)
                    .font(.caption)
                    .frame(width: 16)

                Text(source.rawValue)
                    .font(.caption)
                    .lineLimit(1)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(isEnabled ? Color.blue : Color(.systemGray5))
            .foregroundColor(isEnabled ? .white : .primary)
            .cornerRadius(8)
        }
        .buttonStyle(.plain)
    }
}

struct DateRangeSelector: View {
    @Binding var dateRange: DateInterval?
    @State private var useCustomRange = false

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Toggle("Limit to Date Range", isOn: $useCustomRange)
                .onChange(of: useCustomRange) { _, enabled in
                    if enabled {
                        dateRange = DateInterval(
                            start: Calendar.current.date(byAdding: .year, value: -1, to: Date()) ?? Date(),
                            end: Date()
                        )
                    } else {
                        dateRange = nil
                    }
                }

            if useCustomRange {
                VStack(spacing: 8) {
                    HStack {
                        Text("From:")
                            .font(.caption)
                        DatePicker(
                            "",
                            selection: Binding(
                                get: { dateRange?.start ?? Date() },
                                set: { newStart in
                                    if let range = dateRange {
                                        dateRange = DateInterval(start: newStart, end: range.end)
                                    }
                                }
                            ),
                            displayedComponents: .date
                        )
                        .labelsHidden()
                    }

                    HStack {
                        Text("To:")
                            .font(.caption)
                        DatePicker(
                            "",
                            selection: Binding(
                                get: { dateRange?.end ?? Date() },
                                set: { newEnd in
                                    if let range = dateRange {
                                        dateRange = DateInterval(start: range.start, end: newEnd)
                                    }
                                }
                            ),
                            displayedComponents: .date
                        )
                        .labelsHidden()
                    }
                }
                .padding(.leading, 16)
            }
        }
    }
}

struct PermissionStatusIndicator: View {
    let permission: ETLPermission
    @State private var status: PermissionStatus = .unknown

    var body: some View {
        HStack(spacing: 4) {
            Image(systemName: status.systemImage)
                .foregroundColor(status.color)
                .font(.caption)

            Text(status.displayName)
                .font(.caption2)
                .foregroundColor(status.color)
        }
        .task {
            status = await checkPermissionStatus(permission)
        }
    }

    private func checkPermissionStatus(_ permission: ETLPermission) async -> PermissionStatus {
        // In a real implementation, this would check actual system permissions
        // For now, simulate different states
        switch permission {
        case .notes, .reminders, .calendar, .contacts:
            return .granted
        case .fileSystem:
            return .granted
        case .network:
            return .granted
        case .fullDiskAccess:
            return .needsApproval
        }
    }
}

enum PermissionStatus {
    case unknown
    case granted
    case denied
    case needsApproval

    var displayName: String {
        switch self {
        case .unknown: return "Checking..."
        case .granted: return "Granted"
        case .denied: return "Denied"
        case .needsApproval: return "Needs Approval"
        }
    }

    var systemImage: String {
        switch self {
        case .unknown: return "questionmark.circle"
        case .granted: return "checkmark.circle.fill"
        case .denied: return "xmark.circle.fill"
        case .needsApproval: return "exclamationmark.triangle.fill"
        }
    }

    var color: Color {
        switch self {
        case .unknown: return .gray
        case .granted: return .green
        case .denied: return .red
        case .needsApproval: return .orange
        }
    }
}

// MARK: - Preview

#Preview {
    ETLOperationBuilderView(
        etlManager: ETLOperationManager(database: try! IsometryDatabase(path: ":memory:")),
        database: try! IsometryDatabase(path: ":memory:"),
        selectedTemplate: .appleNotesImport
    )
}