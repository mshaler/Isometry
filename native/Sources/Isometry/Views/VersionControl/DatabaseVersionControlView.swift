import SwiftUI
import Charts

/// Native UI for Database Version Control
/// Provides git-like interface for branch management, merging, and rollback
struct DatabaseVersionControlView: View {
    @State private var versionControl: DatabaseVersionControl
    @State private var branches: [DatabaseBranch] = []
    @State private var currentBranch: String = "main"
    @State private var commitHistory: [DatabaseCommit] = []
    @State private var selectedCommits: Set<UUID> = []

    // UI State
    @State private var showingCreateBranch = false
    @State private var showingMergeDialog = false
    @State private var showingAnalyticsBranch = false
    @State private var showingSyntheticBranch = false
    @State private var showingCommitDialog = false
    @State private var showingConflictResolution = false

    // Merge state
    @State private var mergeBranches: (source: String, target: String) = ("", "")
    @State private var mergeConflicts: [DatabaseConflict] = []
    @State private var mergeStrategy: MergeStrategy = .autoResolve

    private let database: IsometryDatabase

    init(database: IsometryDatabase, storageManager: ContentAwareStorageManager) {
        self.database = database
        self._versionControl = State(initialValue: DatabaseVersionControl(
            database: database,
            storageManager: storageManager
        ))
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                branchSelectorHeader
                commitTimelineSection
                actionButtonsSection
                commitHistoryList
            }
            .navigationTitle("Version Control")
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Menu {
                        Button("Create Branch", systemImage: "plus.branch") {
                            showingCreateBranch = true
                        }
                        Button("Merge Branches", systemImage: "arrow.triangle.merge") {
                            showingMergeDialog = true
                        }
                        Button("Analytics Branch", systemImage: "chart.line.uptrend.xyaxis") {
                            showingAnalyticsBranch = true
                        }
                        Button("Synthetic Branch", systemImage: "wand.and.stars") {
                            showingSyntheticBranch = true
                        }
                    } label: {
                        Image(systemName: "ellipsis.circle")
                    }
                }
            }
        }
        .sheet(isPresented: $showingCreateBranch) {
            CreateBranchView(
                versionControl: versionControl,
                availableBranches: branches.map(\.name),
                currentBranch: currentBranch,
                onBranchCreated: { await refreshBranches() }
            )
        }
        .sheet(isPresented: $showingMergeDialog) {
            MergeBranchView(
                versionControl: versionControl,
                availableBranches: branches.map(\.name),
                onMergeCompleted: { await refreshData() },
                onConflictsDetected: { conflicts in
                    mergeConflicts = conflicts
                    showingConflictResolution = true
                }
            )
        }
        .sheet(isPresented: $showingAnalyticsBranch) {
            CreateAnalyticsBranchView(
                versionControl: versionControl,
                baseBranch: currentBranch,
                onBranchCreated: { await refreshBranches() }
            )
        }
        .sheet(isPresented: $showingSyntheticBranch) {
            CreateSyntheticBranchView(
                versionControl: versionControl,
                onBranchCreated: { await refreshBranches() }
            )
        }
        .sheet(isPresented: $showingCommitDialog) {
            CommitChangesView(
                versionControl: versionControl,
                onCommitCompleted: { await refreshCommitHistory() }
            )
        }
        .sheet(isPresented: $showingConflictResolution) {
            DatabaseConflictResolutionView(
                conflicts: mergeConflicts,
                strategy: $mergeStrategy,
                onResolved: { strategy in
                    // Handle conflict resolution
                    showingConflictResolution = false
                }
            )
        }
        .task {
            await refreshData()
        }
    }

    // MARK: - Branch Selector Header

    private var branchSelectorHeader: some View {
        VStack(spacing: 12) {
            HStack {
                Image(systemName: "branch")
                    .foregroundColor(.blue)
                    .font(.headline)

                Text("Current Branch:")
                    .font(.subheadline)
                    .foregroundColor(.secondary)

                Spacer()
            }

            Menu {
                ForEach(branches, id: \.name) { branch in
                    Button(action: { switchBranch(branch.name) }) {
                        HStack {
                            Text(branch.name)
                            if branch.name == currentBranch {
                                Image(systemName: "checkmark")
                            }
                            if branch.isProtected {
                                Image(systemName: "lock.fill")
                                    .foregroundColor(.orange)
                            }
                        }
                    }
                }
            } label: {
                HStack {
                    Text(currentBranch)
                        .font(.headline)
                        .fontWeight(.medium)

                    Image(systemName: "chevron.down")
                        .font(.caption)
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 8)
                .background(.ultraThinMaterial)
                .cornerRadius(8)
            }

            BranchStatsRow(branches: branches, currentBranch: currentBranch)
        }
        .padding()
        .background(Color.gray.opacity(0.1))
    }

    // MARK: - Commit Timeline Section

    private var commitTimelineSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Commit Timeline")
                .font(.headline)
                .padding(.horizontal)

            if !commitHistory.isEmpty {
                Chart(commitHistory.prefix(20)) { commit in
                    PointMark(
                        x: .value("Time", commit.timestamp),
                        y: .value("Changes", commit.changeCount)
                    )
                    .foregroundStyle(.blue)
                    .symbolSize(selectedCommits.contains(commit.id) ? 100 : 50)
                }
                .frame(height: 120)
                .padding(.horizontal)
                .onTapGesture { location in
                    // Handle commit selection for comparison/rollback
                }
            } else {
                EmptyCommitTimelineView()
            }
        }
        .padding(.vertical)
        .background(.ultraThinMaterial)
    }

    // MARK: - Action Buttons Section

    private var actionButtonsSection: some View {
        HStack(spacing: 16) {
            ActionButton(
                title: "Commit",
                systemImage: "checkmark.circle",
                color: .green,
                action: { showingCommitDialog = true }
            )

            ActionButton(
                title: "Merge",
                systemImage: "arrow.triangle.merge",
                color: .blue,
                action: { showingMergeDialog = true }
            )

            ActionButton(
                title: "Rollback",
                systemImage: "clock.arrow.circlepath",
                color: .orange,
                action: { performRollback() },
                isDisabled: selectedCommits.isEmpty
            )

            ActionButton(
                title: "Analytics",
                systemImage: "chart.line.uptrend.xyaxis",
                color: .purple,
                action: { showingAnalyticsBranch = true }
            )
        }
        .padding()
        .background(Color.gray.opacity(0.1))
    }

    // MARK: - Commit History List

    private var commitHistoryList: some View {
        List {
            ForEach(commitHistory, id: \.id) { commit in
                CommitRowView(
                    commit: commit,
                    isSelected: selectedCommits.contains(commit.id),
                    onToggleSelection: { toggleCommitSelection(commit.id) },
                    onRollback: { rollbackToCommit(commit.id) }
                )
            }
        }
        .listStyle(.sidebar)
    }

    // MARK: - Actions

    private func switchBranch(_ branchName: String) {
        Task {
            do {
                try await versionControl.switchBranch(branchName)
                currentBranch = branchName
                await refreshCommitHistory()
            } catch {
                // Handle error
                print("Failed to switch branch: \(error)")
            }
        }
    }

    private func toggleCommitSelection(_ commitId: UUID) {
        if selectedCommits.contains(commitId) {
            selectedCommits.remove(commitId)
        } else if selectedCommits.count < 2 {
            selectedCommits.insert(commitId)
        }
    }

    private func performRollback() {
        guard let commitId = selectedCommits.first else { return }

        Task {
            do {
                _ = try await versionControl.rollback(to: commitId, preserveChanges: true)
                await refreshData()
            } catch {
                print("Rollback failed: \(error)")
            }
        }
    }

    private func rollbackToCommit(_ commitId: UUID) {
        Task {
            do {
                _ = try await versionControl.rollback(to: commitId, preserveChanges: true)
                await refreshData()
            } catch {
                print("Rollback failed: \(error)")
            }
        }
    }

    private func refreshData() async {
        await refreshBranches()
        await refreshCommitHistory()
    }

    private func refreshBranches() async {
        // Load branches from version control
        // This would be implemented based on actual data source
        branches = [] // Placeholder
    }

    private func refreshCommitHistory() async {
        do {
            commitHistory = try await versionControl.getChangeHistory(branch: currentBranch)
        } catch {
            print("Failed to load commit history: \(error)")
        }
    }
}

// MARK: - Supporting Views

struct BranchStatsRow: View {
    let branches: [DatabaseBranch]
    let currentBranch: String

    var body: some View {
        HStack {
            StatItem(
                label: "Total Branches",
                value: "\(branches.count)",
                color: .blue
            )

            StatItem(
                label: "Protected",
                value: "\(branches.filter(\.isProtected).count)",
                color: .orange
            )

            StatItem(
                label: "Uncommitted",
                value: "3", // Placeholder
                color: .red
            )

            Spacer()
        }
    }
}

struct StatItem: View {
    let label: String
    let value: String
    let color: Color

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(value)
                .font(.headline)
                .fontWeight(.bold)
                .foregroundColor(color)

            Text(label)
                .font(.caption2)
                .foregroundColor(.secondary)
        }
    }
}

struct ActionButton: View {
    let title: String
    let systemImage: String
    let color: Color
    let action: () -> Void
    let isDisabled: Bool

    init(
        title: String,
        systemImage: String,
        color: Color,
        action: @escaping () -> Void,
        isDisabled: Bool = false
    ) {
        self.title = title
        self.systemImage = systemImage
        self.color = color
        self.action = action
        self.isDisabled = isDisabled
    }

    var body: some View {
        Button(action: action) {
            VStack(spacing: 4) {
                Image(systemName: systemImage)
                    .font(.title2)

                Text(title)
                    .font(.caption)
            }
            .foregroundColor(isDisabled ? .secondary : color)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 8)
            .background(isDisabled ? Color.gray.opacity(0.3) : color.opacity(0.1))
            .cornerRadius(8)
        }
        .disabled(isDisabled)
    }
}

struct CommitRowView: View {
    let commit: DatabaseCommit
    let isSelected: Bool
    let onToggleSelection: () -> Void
    let onRollback: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text(commit.message)
                        .font(.subheadline)
                        .fontWeight(.medium)
                        .lineLimit(2)

                    Text("\(commit.author) • \(formatDate(commit.timestamp))")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }

                Spacer()

                HStack {
                    if isSelected {
                        Image(systemName: "checkmark.circle.fill")
                            .foregroundColor(.blue)
                    }

                    Menu {
                        Button("Rollback to Here", systemImage: "clock.arrow.circlepath") {
                            onRollback()
                        }
                        Button("View Changes", systemImage: "doc.text.magnifyingglass") {
                            // Show commit details
                        }
                        Button("Create Branch", systemImage: "plus.branch") {
                            // Create branch from this commit
                        }
                    } label: {
                        Image(systemName: "ellipsis")
                            .foregroundColor(.secondary)
                    }
                }
            }

            HStack {
                CommitStatBadge(
                    label: "Changes",
                    value: "\(commit.changeCount)",
                    color: .blue
                )

                if !commit.artifactIds.isEmpty {
                    CommitStatBadge(
                        label: "Artifacts",
                        value: "\(commit.artifactIds.count)",
                        color: .green
                    )
                }

                Spacer()

                Text(commit.id.uuidString.prefix(8))
                    .font(.caption)
                    .font(.system(.caption, design: .monospaced))
                    .foregroundColor(.secondary)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(Color.gray.opacity(0.1))
                    .cornerRadius(4)
            }
        }
        .contentShape(Rectangle())
        .onTapGesture {
            onToggleSelection()
        }
    }

    private func formatDate(_ date: Date) -> String {
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .abbreviated
        return formatter.localizedString(for: date, relativeTo: Date())
    }
}

struct CommitStatBadge: View {
    let label: String
    let value: String
    let color: Color

    var body: some View {
        HStack(spacing: 4) {
            Text(value)
                .font(.caption2)
                .fontWeight(.medium)
            Text(label)
                .font(.caption2)
        }
        .padding(.horizontal, 6)
        .padding(.vertical, 2)
        .background(color.opacity(0.1))
        .foregroundColor(color)
        .cornerRadius(4)
    }
}

struct EmptyCommitTimelineView: View {
    var body: some View {
        VStack(spacing: 8) {
            Image(systemName: "clock")
                .font(.system(size: 32))
                .foregroundColor(.secondary)

            Text("No Commits")
                .font(.subheadline)
                .fontWeight(.medium)
                .foregroundColor(.secondary)

            Text("Make your first commit to see the timeline")
                .font(.caption)
                .foregroundColor(.secondary)
        }
        .frame(height: 120)
    }
}

// MARK: - Create Branch View

struct CreateBranchView: View {
    let versionControl: DatabaseVersionControl
    let availableBranches: [String]
    let currentBranch: String
    let onBranchCreated: () async -> Void

    @State private var branchName = ""
    @State private var description = ""
    @State private var sourceBranch = ""
    @State private var isCreating = false
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            Form {
                Section("Branch Details") {
                    TextField("Branch name", text: $branchName)
                        #if canImport(UIKit)
                        .textInputAutocapitalization(.never)
                        #endif

                    TextField("Description (optional)", text: $description, axis: .vertical)
                        .lineLimit(2...4)
                }

                Section("Source Branch") {
                    Picker("Create from", selection: $sourceBranch) {
                        ForEach(availableBranches, id: \.self) { branch in
                            Text(branch).tag(branch)
                        }
                    }
                }
            }
            .navigationTitle("Create Branch")
            #if canImport(UIKit)
.navigationBarTitleDisplayMode(.inline)
#endif
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Cancel") {
                        dismiss()
                    }
                }

                ToolbarItem(placement: .primaryAction) {
                    Button("Create") {
                        Task { await createBranch() }
                    }
                    .disabled(branchName.isEmpty || isCreating)
                }
            }
        }
        .onAppear {
            sourceBranch = currentBranch
        }
    }

    private func createBranch() async {
        isCreating = true
        defer { isCreating = false }

        do {
            _ = try await versionControl.createBranch(
                name: branchName,
                description: description.isEmpty ? nil : description,
                fromBranch: sourceBranch
            )
            await onBranchCreated()
            dismiss()
        } catch {
            // Handle error
            print("Failed to create branch: \(error)")
        }
    }
}

// MARK: - Merge Branch View

struct MergeBranchView: View {
    let versionControl: DatabaseVersionControl
    let availableBranches: [String]
    let onMergeCompleted: () async -> Void
    let onConflictsDetected: ([DatabaseConflict]) -> Void

    @State private var sourceBranch = ""
    @State private var targetBranch = ""
    @State private var mergeStrategy: MergeStrategy = .autoResolve
    @State private var commitMessage = ""
    @State private var isMerging = false
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            Form {
                Section("Merge Configuration") {
                    Picker("Source Branch", selection: $sourceBranch) {
                        ForEach(availableBranches, id: \.self) { branch in
                            Text(branch).tag(branch)
                        }
                    }

                    Picker("Target Branch", selection: $targetBranch) {
                        ForEach(availableBranches, id: \.self) { branch in
                            Text(branch).tag(branch)
                        }
                    }

                    Picker("Merge Strategy", selection: $mergeStrategy) {
                        ForEach(MergeStrategy.allCases, id: \.self) { strategy in
                            Text(strategy.displayName).tag(strategy)
                        }
                    }
                }

                Section("Commit Message") {
                    TextField("Optional merge commit message", text: $commitMessage, axis: .vertical)
                        .lineLimit(2...4)
                }
            }
            .navigationTitle("Merge Branches")
            #if canImport(UIKit)
.navigationBarTitleDisplayMode(.inline)
#endif
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Cancel") {
                        dismiss()
                    }
                }

                ToolbarItem(placement: .primaryAction) {
                    Button("Merge") {
                        Task { await performMerge() }
                    }
                    .disabled(sourceBranch.isEmpty || targetBranch.isEmpty || isMerging)
                }
            }
        }
    }

    private func performMerge() async {
        isMerging = true
        defer { isMerging = false }

        do {
            _ = try await versionControl.mergeBranch(
                from: sourceBranch,
                into: targetBranch,
                strategy: mergeStrategy,
                commitMessage: commitMessage.isEmpty ? nil : commitMessage
            )
            await onMergeCompleted()
            dismiss()
        } catch DatabaseVersionError.mergeConflicts(let conflicts) {
            onConflictsDetected(conflicts)
        } catch {
            print("Merge failed: \(error)")
        }
    }
}

// MARK: - Analytics Branch View

struct CreateAnalyticsBranchView: View {
    let versionControl: DatabaseVersionControl
    let baseBranch: String
    let onBranchCreated: () async -> Void

    @State private var branchName = ""
    @State private var analysisType: AnalysisType = .aggregation
    @State private var targetTables: [String] = []
    @State private var isCreating = false
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            Form {
                Section("Analytics Configuration") {
                    TextField("Branch name", text: $branchName)
                        #if canImport(UIKit)
                        .textInputAutocapitalization(.never)
                        #endif

                    Picker("Analysis Type", selection: $analysisType) {
                        ForEach(AnalysisType.allCases, id: \.self) { type in
                            Text(type.displayName).tag(type)
                        }
                    }
                }

                Section("Data Sources") {
                    // Table selection would go here
                    Text("Select tables for analysis...")
                        .foregroundColor(.secondary)
                }
            }
            .navigationTitle("Analytics Branch")
            #if canImport(UIKit)
.navigationBarTitleDisplayMode(.inline)
#endif
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Cancel") {
                        dismiss()
                    }
                }

                ToolbarItem(placement: .primaryAction) {
                    Button("Create") {
                        Task { await createAnalyticsBranch() }
                    }
                    .disabled(branchName.isEmpty || isCreating)
                }
            }
        }
    }

    private func createAnalyticsBranch() async {
        isCreating = true
        defer { isCreating = false }

        do {
            let config = AnalyticsConfiguration(
                analysisType: analysisType,
                targetTables: targetTables,
                timeRange: nil,
                filters: AnalyticsFilters(),
                aggregations: []
            )

            _ = try await versionControl.createAnalyticsBranch(
                name: branchName,
                basedOn: baseBranch,
                configuration: config
            )

            await onBranchCreated()
            dismiss()
        } catch {
            print("Failed to create analytics branch: \(error)")
        }
    }
}

// MARK: - Synthetic Branch View

struct CreateSyntheticBranchView: View {
    let versionControl: DatabaseVersionControl
    let onBranchCreated: () async -> Void

    @State private var branchName = ""
    @State private var dataScale: DataScale = .medium
    @State private var preserveSchema = true
    @State private var isCreating = false
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            Form {
                Section("Synthetic Data Configuration") {
                    TextField("Branch name", text: $branchName)
                        #if canImport(UIKit)
                        .textInputAutocapitalization(.never)
                        #endif

                    Picker("Data Scale", selection: $dataScale) {
                        ForEach(DataScale.allCases, id: \.self) { scale in
                            Text(scale.displayName).tag(scale)
                        }
                    }

                    Toggle("Preserve Schema", isOn: $preserveSchema)
                }
            }
            .navigationTitle("Synthetic Branch")
            #if canImport(UIKit)
.navigationBarTitleDisplayMode(.inline)
#endif
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Cancel") {
                        dismiss()
                    }
                }

                ToolbarItem(placement: .primaryAction) {
                    Button("Create") {
                        Task { await createSyntheticBranch() }
                    }
                    .disabled(branchName.isEmpty || isCreating)
                }
            }
        }
    }

    private func createSyntheticBranch() async {
        isCreating = true
        defer { isCreating = false }

        do {
            let generator = SyntheticDataGenerator(
                description: "Synthetic data generator",
                scale: dataScale
            )

            _ = try await versionControl.createSyntheticBranch(
                name: branchName,
                generator: generator,
                preserveSchema: preserveSchema
            )

            await onBranchCreated()
            dismiss()
        } catch {
            print("Failed to create synthetic branch: \(error)")
        }
    }
}

// MARK: - Commit Changes View

struct CommitChangesView: View {
    let versionControl: DatabaseVersionControl
    let onCommitCompleted: () async -> Void

    @State private var commitMessage = ""
    @State private var author = ""
    @State private var isCommitting = false
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            Form {
                Section("Commit Details") {
                    TextField("Commit message", text: $commitMessage, axis: .vertical)
                        .lineLimit(3...6)

                    TextField("Author", text: $author)
                }

                Section("Changes") {
                    // This would show pending changes
                    Text("Loading pending changes...")
                        .foregroundColor(.secondary)
                }
            }
            .navigationTitle("Commit Changes")
            #if canImport(UIKit)
.navigationBarTitleDisplayMode(.inline)
#endif
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Cancel") {
                        dismiss()
                    }
                }

                ToolbarItem(placement: .primaryAction) {
                    Button("Commit") {
                        Task { await commitChanges() }
                    }
                    .disabled(commitMessage.isEmpty || isCommitting)
                }
            }
        }
    }

    private func commitChanges() async {
        isCommitting = true
        defer { isCommitting = false }

        do {
            _ = try await versionControl.commit(
                message: commitMessage,
                author: author.isEmpty ? "user" : author
            )
            await onCommitCompleted()
            dismiss()
        } catch {
            print("Commit failed: \(error)")
        }
    }
}

// MARK: - Conflict Resolution View

struct DatabaseConflictResolutionView: View {
    let conflicts: [DatabaseConflict]
    @Binding var strategy: MergeStrategy
    let onResolved: (MergeStrategy) -> Void

    var body: some View {
        NavigationStack {
            List {
                ForEach(conflicts, id: \.id) { conflict in
                    ConflictRowView(conflict: conflict, strategy: $strategy)
                }
            }
            .navigationTitle("Resolve Conflicts")
            #if canImport(UIKit)
.navigationBarTitleDisplayMode(.inline)
#endif
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Button("Resolve") {
                        onResolved(strategy)
                    }
                }
            }
        }
    }
}

struct ConflictRowView: View {
    let conflict: DatabaseConflict
    @Binding var strategy: MergeStrategy

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Conflict in \(conflict.table)")
                .font(.subheadline)
                .fontWeight(.medium)

            Text("Record ID: \(conflict.recordId)")
                .font(.caption)
                .foregroundColor(.secondary)

            HStack {
                Text("Type: \(conflict.type.rawValue)")
                    .font(.caption)
                    .foregroundColor(.orange)

                Spacer()

                Text("Detected: \(formatDate(conflict.detectedAt))")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
        }
    }

    private func formatDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateStyle = .short
        formatter.timeStyle = .short
        return formatter.string(from: date)
    }
}

// MARK: - Extensions

extension MergeStrategy {
    var displayName: String {
        switch self {
        case .autoResolve: return "Auto Resolve"
        case .preferSource: return "Prefer Source"
        case .preferTarget: return "Prefer Target"
        case .manual: return "Manual"
        case .lastWriterWins: return "Last Writer Wins"
        }
    }
}

extension AnalysisType {
    var displayName: String {
        switch self {
        case .aggregation: return "Aggregation"
        case .timeSeries: return "Time Series"
        case .graph: return "Graph Analysis"
        case .ml: return "Machine Learning"
        }
    }
}

extension DataScale {
    var displayName: String {
        switch self {
        case .small: return "Small (1K)"
        case .medium: return "Medium (10K)"
        case .large: return "Large (100K)"
        case .xlarge: return "Extra Large (1M)"
        }
    }
}

#Preview {
    DatabaseVersionControlView(
        database: try! IsometryDatabase(path: ":memory:"),
        storageManager: ContentAwareStorageManager(
            database: try! IsometryDatabase(path: ":memory:")
        )
    )
}